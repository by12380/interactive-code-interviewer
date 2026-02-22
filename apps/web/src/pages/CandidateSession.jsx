// CandidateSession – focused coding view for a candidate inside a live session.
// Features: Monaco editor with inline AI hints, problem panel, timer, code auto-sync.

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EditorPanel from "../components/EditorPanel.jsx";
import { getSession, pushCode } from "../services/sessionService.js";
import { getCodeHints } from "../api.js";
import { analyzeCode, createAnalyzerState } from "../services/codeAnalyzer.js";
import { QUESTION_BANK } from "../data/questionBank.js";
import "../styles/candidate.css";

const PUSH_MS = 2000;
const LOCAL_DEBOUNCE_MS = 4000;
const AI_DEBOUNCE_MS = 10000;
const THROTTLE_INTERVAL_MS = 12000;
const MAX_AI_HINTS = 6;

export default function CandidateSession() {
  const { sessionId, candidateId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [code, setCode] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [endedByInterviewer, setEndedByInterviewer] = useState(false);

  // Editor refs
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  // Hint state
  const [editorHint, setEditorHint] = useState(null);
  const analyzerStateRef = useRef(createAnalyzerState());
  const hintInFlightRef = useRef(false);
  const aiHintCountRef = useRef(0);
  const lastLocalCodeRef = useRef("");
  const lastAiCodeRef = useRef("");
  const lastThrottleCodeRef = useRef("");

  // Code sync refs
  const codeRef = useRef("");
  const lastPushedRef = useRef("");
  const pushTimerRef = useRef(null);
  const sessionPollerRef = useRef(null);

  // Load session + questions
  useEffect(() => {
    getSession(sessionId)
      .then(async (s) => {
        setSession(s);
        if (s.status === "completed") {
          setEndedByInterviewer(true);
          setSubmitted(true);
          return;
        }
        const qs = (s.questionIds || []).map((qid) => {
          const fromBank = QUESTION_BANK.find((q) => q.id === qid);
          return fromBank || { id: qid, title: qid, description: "", starterCode: "" };
        });
        setQuestions(qs);
        if (qs.length) {
          setCode(qs[0].starterCode || "");
          codeRef.current = qs[0].starterCode || "";
        }
      })
      .catch(() => {});
  }, [sessionId]);

  // Poll session status every 3s to detect when interviewer ends the session
  useEffect(() => {
    if (submitted) return;
    sessionPollerRef.current = setInterval(() => {
      getSession(sessionId)
        .then((s) => {
          if (s.status === "completed") {
            const q = questions[currentIdx];
            pushCode(sessionId, candidateId, {
              code: codeRef.current,
              questionId: q?.id || "_default",
            }).catch(() => {});
            setEndedByInterviewer(true);
            setSubmitted(true);
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(sessionPollerRef.current);
  }, [sessionId, candidateId, submitted, questions, currentIdx]);

  // Timer
  useEffect(() => {
    if (submitted) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [submitted]);

  // Code push loop
  useEffect(() => {
    pushTimerRef.current = setInterval(() => {
      const current = codeRef.current;
      if (current === lastPushedRef.current) return;
      lastPushedRef.current = current;
      const q = questions[currentIdx];
      pushCode(sessionId, candidateId, {
        code: current,
        questionId: q?.id || "_default",
      }).catch(() => {});
    }, PUSH_MS);
    return () => clearInterval(pushTimerRef.current);
  }, [sessionId, candidateId, currentIdx, questions]);

  const question = questions[currentIdx] || null;
  const timeLimit = session?.settings?.timeLimitSeconds || 1800;
  const remaining = Math.max(0, timeLimit - elapsed);
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const handleCodeChange = useCallback((val) => {
    setCode(val || "");
    codeRef.current = val || "";
  }, []);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  }, []);

  const handleDismissHint = useCallback(() => {
    setEditorHint(null);
  }, []);

  // Helper to fire a structured hint into the editor
  const fireHint = useCallback((hints, chatMessage) => {
    if (!hints || hints.length === 0) return;
    setEditorHint({
      hints,
      message: hints[0].message,
    });
  }, []);

  // ── LOCAL PATTERN ANALYSIS (4s debounce) ──────────────────────────
  // Free, zero API cost. Catches wrong approaches and common mistakes.
  useEffect(() => {
    if (submitted || !question) return;
    if (!(session?.settings?.aiInterruptionsEnabled !== false)) return;

    const timer = setTimeout(() => {
      if (code === lastLocalCodeRef.current) return;
      lastLocalCodeRef.current = code;

      const result = analyzeCode(
        code,
        question.id,
        question.starterCode || "",
        analyzerStateRef.current,
        true
      );

      if (!result) return;

      if (result.tier === "local") {
        fireHint([{
          lineNumber: result.lineNumber || null,
          endLineNumber: result.endLineNumber || null,
          severity: result.displaySeverity || "warning",
          message: result.message,
        }]);
      }
    }, LOCAL_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [code, question, submitted, session, fireHint]);

  // ── AI-POWERED HINTS (10s debounce) ───────────────────────────────
  // Fires when user pauses for 10s. Uses /api/code-hints for line-targeted hints.
  useEffect(() => {
    if (submitted || !question) return;
    if (!(session?.settings?.aiInterruptionsEnabled !== false)) return;

    const timer = setTimeout(async () => {
      if (hintInFlightRef.current) return;
      if (code === lastAiCodeRef.current) return;
      if (aiHintCountRef.current >= MAX_AI_HINTS) return;
      if (!analyzerStateRef.current.canInterrupt()) return;

      const userCode = code.replace(question.starterCode || "", "").trim();
      if (userCode.length < 15) return;

      lastAiCodeRef.current = code;
      hintInFlightRef.current = true;

      try {
        const data = await getCodeHints({
          code,
          problemTitle: question.title,
          problemDescription: question.description,
          starterCode: question.starterCode,
        });

        if (data?.hasIssue && data.hints?.length > 0) {
          aiHintCountRef.current++;
          analyzerStateRef.current.markInterrupted("ai-hint-" + Date.now());
          fireHint(data.hints);
        }
      } catch {
        // silently ignore
      } finally {
        hintInFlightRef.current = false;
      }
    }, AI_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [code, question, submitted, session, fireHint]);

  // ── THROTTLE INTERVAL (every 12s, even during continuous typing) ──
  // This is the key fix: if the user never stops typing, debounce-based
  // timers never fire. This interval checks periodically regardless.
  useEffect(() => {
    if (submitted || !question) return;
    if (!(session?.settings?.aiInterruptionsEnabled !== false)) return;

    const interval = setInterval(async () => {
      // Skip if code hasn't changed meaningfully since last throttle check
      if (code === lastThrottleCodeRef.current) return;
      if (hintInFlightRef.current) return;
      if (!analyzerStateRef.current.canInterrupt()) return;

      const userCode = code.replace(question.starterCode || "", "").trim();
      if (userCode.length < 15) return;

      lastThrottleCodeRef.current = code;

      // First try local analysis (free)
      const localResult = analyzeCode(
        code,
        question.id,
        question.starterCode || "",
        analyzerStateRef.current,
        true
      );

      if (localResult && localResult.tier === "local") {
        fireHint([{
          lineNumber: localResult.lineNumber || null,
          endLineNumber: localResult.endLineNumber || null,
          severity: localResult.displaySeverity || "warning",
          message: localResult.message,
        }]);
        return;
      }

      // If local found nothing and AI budget remains, try AI
      if (aiHintCountRef.current >= MAX_AI_HINTS) return;
      if (!analyzerStateRef.current.canAffordAPICall()) return;

      hintInFlightRef.current = true;
      try {
        const data = await getCodeHints({
          code,
          problemTitle: question.title,
          problemDescription: question.description,
          starterCode: question.starterCode,
        });

        if (data?.hasIssue && data.hints?.length > 0) {
          aiHintCountRef.current++;
          analyzerStateRef.current.markInterrupted("throttle-hint-" + Date.now());
          fireHint(data.hints);
        }
      } catch {
        // silently ignore
      } finally {
        hintInFlightRef.current = false;
      }
    }, THROTTLE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [code, question, submitted, session, fireHint]);

  // Reset hints when switching questions
  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      setCode(questions[nextIdx]?.starterCode || "");
      codeRef.current = questions[nextIdx]?.starterCode || "";
      lastPushedRef.current = "";
      setEditorHint(null);
      lastLocalCodeRef.current = "";
      lastAiCodeRef.current = "";
      lastThrottleCodeRef.current = "";
      aiHintCountRef.current = 0;
      analyzerStateRef.current.reset();
    }
  };

  const handleSubmit = () => {
    pushCode(sessionId, candidateId, {
      code,
      questionId: question?.id || "_default",
    }).catch(() => {});
    if (currentIdx < questions.length - 1) {
      handleNext();
    } else {
      setSubmitted(true);
    }
  };

  // Time's up
  useEffect(() => {
    if (remaining <= 0 && !submitted) {
      pushCode(sessionId, candidateId, {
        code: codeRef.current,
        questionId: question?.id || "_default",
      }).catch(() => {});
      setSubmitted(true);
    }
  }, [remaining, submitted, sessionId, candidateId, question]);

  if (submitted) {
    return (
      <div className="cs-join">
        <div className="cs-join__card">
          <h1>Session Complete</h1>
          {endedByInterviewer ? (
            <p>
              The interviewer has ended this session. Your code has been submitted
              automatically and will be reviewed.
            </p>
          ) : (
            <p>Your code has been submitted. The interviewer will review your solutions.</p>
          )}
          <button className="cs-btn cs-btn--primary" onClick={() => navigate("/")}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cs-session">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="cs-session__header">
        <h2>{session?.title || "Interview Session"}</h2>
        <div className="cs-session__meta">
          <span>
            Question {currentIdx + 1}/{questions.length}
          </span>
          <span className={remaining < 300 ? "cs-timer--warn" : ""}>
            Time remaining: {fmtTime(remaining)}
          </span>
        </div>
      </header>

      <div className="cs-session__body">
        {/* ── Left: Problem ───────────────────────────────────── */}
        <aside className="cs-session__problem">
          {question ? (
            <>
              <h3>{question.title}</h3>
              <span
                className={`iv-diff iv-diff--${(question.difficulty || "").toLowerCase()}`}
              >
                {question.difficulty}
              </span>
              <div className="cs-desc">{question.description}</div>

              {session?.settings?.showTestCases &&
                question.testCases?.length > 0 && (
                  <div className="cs-tests">
                    <h4>Test Cases</h4>
                    {question.testCases.slice(0, 3).map((tc, i) => (
                      <pre key={i} className="cs-test-case">
                        Input: {JSON.stringify(tc.input)}
                        {"\n"}Expected: {JSON.stringify(tc.expected)}
                      </pre>
                    ))}
                  </div>
                )}
            </>
          ) : (
            <p className="cs-muted">Loading problem...</p>
          )}
        </aside>

        {/* ── Center: Editor with inline AI hints ─────────────── */}
        <main className="cs-session__editor">
          <EditorPanel
            canUndo={true}
            canRedo={true}
            isEditorDisabled={submitted}
            isRunning={false}
            onUndo={() => editorRef.current?.trigger("toolbar", "undo", null)}
            onRedo={() => editorRef.current?.trigger("toolbar", "redo", null)}
            onRun={() => {}}
            onEditorMount={handleEditorMount}
            onCodeChange={handleCodeChange}
            editorOptions={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              wordWrap: "on",
            }}
            code={code}
            interviewerHint={editorHint}
            onDismissHint={handleDismissHint}
          />
        </main>
      </div>

      {/* ── Bottom bar ────────────────────────────────────────── */}
      <footer className="cs-session__footer">
        <button className="cs-btn cs-btn--primary" onClick={handleSubmit}>
          {currentIdx < questions.length - 1 ? "Submit & Next" : "Submit Final"}
        </button>
      </footer>
    </div>
  );
}
