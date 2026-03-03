// CandidateSession – focused coding view for a candidate inside a live session.
// Features: Monaco editor with inline AI hints, AI chat panel, problem panel, timer, code auto-sync.

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EditorPanel from "../components/EditorPanel.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import { getSession, pushCode } from "../services/sessionService.js";
import { sendChat, getCodeHints } from "../api.js";
import { analyzeCode, createAnalyzerState } from "../services/codeAnalyzer.js";
import { convertStarterCode } from "../services/starterCodeService.js";
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

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content: "I'm here if you have any questions about the problem. Go ahead and start coding whenever you're ready."
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const llmMessagesRef = useRef([]);
  const lastCodeSentRef = useRef("");

  // Console state
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);

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
        const lang = s.settings?.language || "javascript";
        const qs = (s.questionIds || []).map((qid) => {
          const fromBank = QUESTION_BANK.find((q) => q.id === qid);
          return fromBank || { id: qid, title: qid, description: "", starterCode: "" };
        });
        setQuestions(qs);
        if (qs.length) {
          const starter = convertStarterCode(qs[0].starterCode || "", lang);
          setCode(starter);
          codeRef.current = starter;
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
  const sessionLanguage = session?.settings?.language || "javascript";
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

  // ── Chat helpers (must be declared before effects that reference them) ──
  const addInterruptionToChat = useCallback((message) => {
    setChatMessages((prev) => [...prev, { role: "assistant", content: message, isInterruption: true }]);
  }, []);

  const buildCodeMessage = useCallback(
    (nextCode) => ({ role: "user", content: `[code update]\n${nextCode || "// No code provided"}` }),
    []
  );

  const appendCodeUpdateIfNeeded = useCallback((nextCode, messageList) => {
    if (nextCode === lastCodeSentRef.current) return messageList;
    lastCodeSentRef.current = nextCode;
    return [...messageList, buildCodeMessage(nextCode)];
  }, [buildCodeMessage]);

  const handleChatToggle = useCallback(() => {
    setChatOpen((prev) => !prev);
  }, []);

  const handleChatInputChange = useCallback((e) => {
    setChatInput(e.target.value);
  }, []);

  const handleChatSend = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isSending) return;

    const nextMessages = [...chatMessages, { role: "user", content: trimmed }];
    setChatMessages(nextMessages);
    setChatInput("");
    setIsSending(true);

    try {
      const withCode = appendCodeUpdateIfNeeded(code, llmMessagesRef.current);
      const llmMessages = [...withCode, { role: "user", content: trimmed }];
      llmMessagesRef.current = llmMessages;

      const data = await sendChat({ messages: llmMessages, mode: "chat", practiceMode: false, language: sessionLanguage });
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      llmMessagesRef.current = [...llmMessagesRef.current, { role: "assistant", content: data.reply }];
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${error.message || "Unable to reach the server."}` }
      ]);
    } finally {
      setIsSending(false);
    }
  }, [appendCodeUpdateIfNeeded, chatInput, chatMessages, code, isSending]);

  const handleChatKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  }, [handleChatSend]);

  const handleClearConsole = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  const handleToggleConsole = useCallback(() => {
    setIsConsoleOpen((prev) => !prev);
  }, []);

  const handleRunCode = useCallback(() => {
    if (isRunning || submitted) return;

    setIsRunning(true);
    setConsoleLogs([]);
    setIsConsoleOpen(true);

    setTimeout(() => {
      const logs = [];

      const captureConsole = {
        log: (...args) => {
          logs.push({ type: "log", value: args.length === 1 ? args[0] : args });
        },
        error: (...args) => {
          logs.push({ type: "error", value: args.length === 1 ? args[0] : args });
        },
        warn: (...args) => {
          logs.push({ type: "warn", value: args.length === 1 ? args[0] : args });
        },
        info: (...args) => {
          logs.push({ type: "info", value: args.length === 1 ? args[0] : args });
        },
        clear: () => {
          logs.length = 0;
        },
      };

      try {
        const runCode = new Function("console", `"use strict";\n${code}`);
        const result = runCode(captureConsole);
        if (result !== undefined) {
          logs.push({ type: "result", value: result });
        }
      } catch (error) {
        logs.push({ type: "error", value: `${error.name}: ${error.message}` });
      }

      if (logs.length === 0) {
        logs.push({ type: "info", value: "Code executed successfully (no output). Use console.log() to see values." });
      }

      setConsoleLogs(logs);
      setIsRunning(false);
    }, 100);
  }, [code, isRunning, submitted]);

  // ── LOCAL PATTERN ANALYSIS (4s debounce) ──────────────────────────
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
        addInterruptionToChat(result.message);
      }
    }, LOCAL_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [code, question, submitted, session, fireHint, addInterruptionToChat]);

  // ── AI-POWERED HINTS (10s debounce) ───────────────────────────────
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
          language: sessionLanguage,
        });

        if (data?.hasIssue && data.hints?.length > 0) {
          aiHintCountRef.current++;
          analyzerStateRef.current.markInterrupted("ai-hint-" + Date.now());
          fireHint(data.hints);
          const summary = data.hints.map(h => h.message).join(" ");
          addInterruptionToChat(summary);
        }
      } catch {
        // silently ignore
      } finally {
        hintInFlightRef.current = false;
      }
    }, AI_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [code, question, submitted, session, fireHint, addInterruptionToChat]);

  // ── THROTTLE INTERVAL (every 12s, even during continuous typing) ──
  useEffect(() => {
    if (submitted || !question) return;
    if (!(session?.settings?.aiInterruptionsEnabled !== false)) return;

    const interval = setInterval(async () => {
      if (code === lastThrottleCodeRef.current) return;
      if (hintInFlightRef.current) return;
      if (!analyzerStateRef.current.canInterrupt()) return;

      const userCode = code.replace(question.starterCode || "", "").trim();
      if (userCode.length < 15) return;

      lastThrottleCodeRef.current = code;

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
        addInterruptionToChat(localResult.message);
        return;
      }

      if (aiHintCountRef.current >= MAX_AI_HINTS) return;
      if (!analyzerStateRef.current.canAffordAPICall()) return;

      hintInFlightRef.current = true;
      try {
        const data = await getCodeHints({
          code,
          problemTitle: question.title,
          problemDescription: question.description,
          starterCode: question.starterCode,
          language: sessionLanguage,
        });

        if (data?.hasIssue && data.hints?.length > 0) {
          aiHintCountRef.current++;
          analyzerStateRef.current.markInterrupted("throttle-hint-" + Date.now());
          fireHint(data.hints);
          const summary = data.hints.map(h => h.message).join(" ");
          addInterruptionToChat(summary);
        }
      } catch {
        // silently ignore
      } finally {
        hintInFlightRef.current = false;
      }
    }, THROTTLE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [code, question, submitted, session, fireHint, addInterruptionToChat]);

  // Reset hints when switching questions
  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      const nextStarter = convertStarterCode(questions[nextIdx]?.starterCode || "", sessionLanguage);
      setCode(nextStarter);
      codeRef.current = nextStarter;
      lastPushedRef.current = "";
      setEditorHint(null);
      lastLocalCodeRef.current = "";
      lastAiCodeRef.current = "";
      lastThrottleCodeRef.current = "";
      aiHintCountRef.current = 0;
      analyzerStateRef.current.reset();
      llmMessagesRef.current = [];
      lastCodeSentRef.current = "";
      setChatMessages([
        { role: "assistant", content: "New question loaded. Take your time and start whenever you're ready." }
      ]);
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
          <button
            type="button"
            className={`cs-chat-toggle ${chatOpen ? "cs-chat-toggle--active" : ""}`}
            onClick={handleChatToggle}
            aria-label={chatOpen ? "Hide AI chat" : "Show AI chat"}
          >
            &#x1F4AC; {chatOpen ? "Hide Chat" : "AI Chat"}
          </button>
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
        <main className={`cs-session__editor ${chatOpen ? "cs-session__editor--with-chat" : ""}`}>
          <EditorPanel
            canUndo={true}
            canRedo={true}
            isEditorDisabled={submitted}
            isRunning={isRunning}
            onUndo={() => editorRef.current?.trigger("toolbar", "undo", null)}
            onRedo={() => editorRef.current?.trigger("toolbar", "redo", null)}
            onRun={handleRunCode}
            onEditorMount={handleEditorMount}
            onCodeChange={handleCodeChange}
            editorOptions={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              wordWrap: "on",
            }}
            code={code}
            language={sessionLanguage}
            interviewerHint={editorHint}
            onDismissHint={handleDismissHint}
            consoleLogs={consoleLogs}
            onClearConsole={handleClearConsole}
            isConsoleOpen={isConsoleOpen}
            onToggleConsole={handleToggleConsole}
          />
        </main>

        {/* ── Right: AI Chat (interview mode) ─────────────────── */}
        {chatOpen && (
          <aside className="cs-session__chat">
            <ChatPanel
              messages={chatMessages}
              input={chatInput}
              isLocked={submitted}
              isPaused={false}
              isSending={isSending}
              onInputChange={handleChatInputChange}
              onKeyDown={handleChatKeyDown}
              onSend={handleChatSend}
              showVoiceControls={false}
            />
          </aside>
        )}
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
