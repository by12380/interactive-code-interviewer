// CandidateSession – focused coding view for a candidate inside a live session.
// Features: Monaco editor, problem panel, timer, AI hints (permission-gated), code auto-sync.

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { getSession, getQuestion, requestHint, pushCode } from "../services/sessionService.js";
import { QUESTION_BANK } from "../data/questionBank.js";
import "../styles/candidate.css";

const PUSH_MS = 2000;
const SESSION_POLL_MS = 3000;
const ACTIVE_SCREEN_STORAGE_KEY = "activeScreen";

export default function CandidateSession() {
  const { sessionId, candidateId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [code, setCode] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [hint, setHint] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [endedByInterviewer, setEndedByInterviewer] = useState(false);

  const codeRef = useRef("");
  const lastPushedRef = useRef("");
  const pushTimerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(ACTIVE_SCREEN_STORAGE_KEY, "interview");
  }, []);

  // Load session + questions
  useEffect(() => {
    let isCancelled = false;
    getSession(sessionId)
      .then(async (s) => {
        if (isCancelled) return;
        setSession(s);
        const qs = (s.questionIds || []).map((qid) => {
          const fromBank = QUESTION_BANK.find((q) => q.id === qid);
          return fromBank || { id: qid, title: qid, description: "", starterCode: "" };
        });
        setQuestions(qs);
        if (qs.length) {
          setCode(qs[0].starterCode || "");
          codeRef.current = qs[0].starterCode || "";
          lastPushedRef.current = "";
        }
        if (s.status === "completed") {
          setEndedByInterviewer(true);
          setSubmitted(true);
        }
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [sessionId]);

  // Keep session status in sync so interviewer can end interview remotely.
  useEffect(() => {
    if (submitted) return;
    const poll = () => {
      getSession(sessionId)
        .then((s) => {
          setSession(s);
          if (s.status === "completed") {
            setEndedByInterviewer(true);
            setSubmitted(true);
          }
        })
        .catch(() => {});
    };
    const timer = setInterval(poll, SESSION_POLL_MS);
    return () => clearInterval(timer);
  }, [sessionId, submitted]);

  // Timer
  useEffect(() => {
    if (submitted) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [submitted]);

  // Code push loop
  useEffect(() => {
    if (submitted || session?.status === "completed") return;
    pushTimerRef.current = setInterval(() => {
      const current = codeRef.current;
      if (current === lastPushedRef.current) return;
      lastPushedRef.current = current;
      const q = questions[currentIdx];
      pushCode(sessionId, candidateId, { code: current, questionId: q?.id || "_default" }).catch(() => {});
    }, PUSH_MS);
    return () => clearInterval(pushTimerRef.current);
  }, [sessionId, candidateId, currentIdx, questions, submitted, session?.status]);

  const handleCodeChange = useCallback((val) => {
    if (submitted || session?.status === "completed") return;
    setCode(val || "");
    codeRef.current = val || "";
  }, [submitted, session?.status]);

  const question = questions[currentIdx] || null;
  const timeLimit = session?.settings?.timeLimitSeconds || 1800;
  const remaining = Math.max(0, timeLimit - elapsed);
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const handleHint = async () => {
    if (!session?.settings?.hintsEnabled) return;
    setHintLoading(true);
    try {
      const data = await requestHint(sessionId, candidateId, { questionId: question?.id, code });
      setHint(data.hint || "No hint available.");
    } catch (e) {
      setHint(e.message || "Could not get hint.");
    }
    setHintLoading(false);
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      setCode(questions[nextIdx]?.starterCode || "");
      codeRef.current = questions[nextIdx]?.starterCode || "";
      lastPushedRef.current = "";
      setHint("");
    }
  };

  const handleSubmit = () => {
    if (submitted || session?.status === "completed") return;
    // Final push
    pushCode(sessionId, candidateId, { code, questionId: question?.id || "_default" }).catch(() => {});
    if (currentIdx < questions.length - 1) {
      handleNext();
    } else {
      setSubmitted(true);
    }
  };

  // Time's up
  useEffect(() => {
    if (remaining <= 0 && !submitted && session?.status !== "completed") {
      pushCode(sessionId, candidateId, { code: codeRef.current, questionId: question?.id || "_default" }).catch(() => {});
      setSubmitted(true);
    }
  }, [remaining, submitted, session?.status, sessionId, candidateId, question?.id]);

  if (submitted) {
    return (
      <div className="cs-join">
        <div className="cs-join__card">
          <h1>Session Complete</h1>
          <p>
            {endedByInterviewer
              ? "The interviewer has ended this session. Submissions are now closed."
              : "Your code has been submitted. The interviewer will review your solutions."}
          </p>
          <button className="cs-btn cs-btn--primary" onClick={() => navigate("/candidate")}>Back to Candidate Home</button>
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
              <span className={`iv-diff iv-diff--${(question.difficulty || "").toLowerCase()}`}>{question.difficulty}</span>
              <div className="cs-desc">{question.description}</div>

              {session?.settings?.showTestCases && question.testCases?.length > 0 && (
                <div className="cs-tests">
                  <h4>Test Cases</h4>
                  {question.testCases.slice(0, 3).map((tc, i) => (
                    <pre key={i} className="cs-test-case">
                      Input: {JSON.stringify(tc.input)}{"\n"}Expected: {JSON.stringify(tc.expected)}
                    </pre>
                  ))}
                </div>
              )}

              {session?.settings?.hintsEnabled && (
                <div className="cs-hints">
                  <button className="cs-btn cs-btn--sm" onClick={handleHint} disabled={hintLoading}>
                    {hintLoading ? "Getting hint..." : "Get AI Hint"}
                  </button>
                  {hint && <div className="cs-hint-box">{hint}</div>}
                </div>
              )}
            </>
          ) : (
            <p className="cs-muted">Loading problem...</p>
          )}
        </aside>

        {/* ── Center: Editor ──────────────────────────────────── */}
        <main className="cs-session__editor">
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme="vs-dark"
            value={code}
            onChange={handleCodeChange}
            options={{ minimap: { enabled: false }, fontSize: 14, readOnly: submitted || session?.status === "completed" }}
          />
        </main>
      </div>

      {/* ── Bottom bar ────────────────────────────────────────── */}
      <footer className="cs-session__footer">
        <button className="cs-btn cs-btn--primary" onClick={handleSubmit} disabled={submitted || session?.status === "completed"}>
          {session?.status === "completed"
            ? "Interview Ended"
            : currentIdx < questions.length - 1
              ? "Submit & Next"
              : "Submit Final"}
        </button>
      </footer>
    </div>
  );
}
