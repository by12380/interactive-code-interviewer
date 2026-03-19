import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import EditorPanel from "./EditorPanel.jsx";
import ChatPanel from "./ChatPanel.jsx";
import { useVoice } from "../contexts/VoiceContext.jsx";
import { sendChat, getCodeHints } from "../api.js";
import { fetchTTSAudio } from "../services/sessionService.js";
import { PROBLEMS } from "../data/problems.js";
import "../styles/candidate.css";

const AI_DEBOUNCE_MS = 10000;
const MAX_AI_HINTS = 6;

export default function MockCandidateSession({ interviewPlan, onExit }) {
  const navigate = useNavigate();
  const { speak, cancelSpeech, isSupported: voiceSupported } = useVoice();

  // Derive stable config from the plan (computed once)
  const plan = interviewPlan?.interviewPlan;
  const candidateName = interviewPlan?.candidateSummary?.name || "Candidate";

  // Build questions and behavioral Qs once
  const { codingQuestions, behavioralQs, hasBehavioral, hasCoding } = useMemo(() => {
    const bqCount = plan?.behavioralQuestions?.length || 0;
    const bqs = plan?.behavioralQuestions || [];

    const codingCfg = plan?.codingConfig || {};
    const count = codingCfg.problemCount || 2;
    const diff = codingCfg.difficulty || "Medium";
    const cats = codingCfg.categories || [];

    let filtered = PROBLEMS;
    if (diff) filtered = filtered.filter((p) => p.difficulty === diff);
    if (cats.length > 0) filtered = filtered.filter((p) => cats.includes(p.category));
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    if (selected.length === 0 && count > 0) {
      const fallback = [...PROBLEMS].sort(() => Math.random() - 0.5);
      selected.push(...fallback.slice(0, count));
    }

    return {
      codingQuestions: selected,
      behavioralQs: bqs,
      hasBehavioral: bqCount > 0,
      hasCoding: selected.length > 0,
    };
  }, [plan]);

  const totalTimeSeconds = (plan?.totalTimeMinutes || 60) * 60;

  // Phase: "behavioral" | "coding" | "completed"
  const [phase, setPhase] = useState(hasBehavioral ? "behavioral" : "coding");

  // Behavioral state
  const [behavioralIdx, setBehavioralIdx] = useState(0);
  const [behavioralMessages, setBehavioralMessages] = useState([]);
  const [behavioralInput, setBehavioralInput] = useState("");
  const [isBehavioralSending, setIsBehavioralSending] = useState(false);
  const [behavioralElapsed, setBehavioralElapsed] = useState(0);
  const behavioralLlmRef = useRef([]);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [aiAudioReady, setAiAudioReady] = useState(false);
  const aiAudioRef = useRef(null);
  const [sttTranscript, setSttTranscript] = useState("");
  const [sttInterim, setSttInterim] = useState("");
  const [isSpeakingVAD, setIsSpeakingVAD] = useState(false);
  const sttManagerRef = useRef(null);
  const behavioralAnswersRef = useRef([]);

  // Coding state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [code, setCode] = useState("");
  const [codingElapsed, setCodingElapsed] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Editor refs
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  // Hint state
  const [editorHint, setEditorHint] = useState(null);
  const hintInFlightRef = useRef(false);
  const aiHintCountRef = useRef(0);
  const lastAiCodeRef = useRef("");

  // Chat state
  const [chatOpen, setChatOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content:
        "Welcome to your mock interview! I'm your AI interviewer. Feel free to ask me questions about the problem, request hints, or discuss your approach.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const llmMessagesRef = useRef([]);
  const lastCodeSentRef = useRef("");

  // Console state
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);

  // Results tracking
  const [problemResults, setProblemResults] = useState([]);

  const question = codingQuestions[currentIdx] || null;
  const currentBQ = behavioralQs[behavioralIdx] || null;
  const codingTimeLimit = totalTimeSeconds;
  const remaining = Math.max(0, codingTimeLimit - codingElapsed);
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Initialize code when question changes
  useEffect(() => {
    if (question && phase === "coding") {
      setCode(question.starterCode || "");
      setConsoleLogs([]);
      setEditorHint(null);
      aiHintCountRef.current = 0;
      lastAiCodeRef.current = "";
    }
  }, [question, phase]);

  // Initialize behavioral messages
  useEffect(() => {
    if (phase === "behavioral" && currentBQ) {
      const isFirst = behavioralIdx === 0;
      setBehavioralMessages([
        {
          role: "assistant",
          content: isFirst
            ? `Welcome to your mock interview, ${candidateName}! Let's start with some behavioral questions.\n\nHere's the first question:\n\n**${currentBQ.question}**\n\nTake your time to think about a specific example from your experience.`
            : `Great, let's move on to the next question.\n\n**${currentBQ.question}**\n\nTake your time.`,
        },
      ]);
    }
  }, [phase, behavioralIdx, currentBQ, candidateName]);

  // Behavioral timer
  useEffect(() => {
    if (phase !== "behavioral" || submitted) return;
    const t = setInterval(() => setBehavioralElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase, submitted]);

  // Coding timer
  useEffect(() => {
    if (phase !== "coding" || submitted || isPaused) return;
    const t = setInterval(() => setCodingElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase, submitted, isPaused]);

  // Time's up
  useEffect(() => {
    if (remaining <= 0 && !submitted && phase === "coding") {
      setSubmitted(true);
    }
  }, [remaining, submitted, phase]);

  // STT for behavioral phase
  useEffect(() => {
    if (phase !== "behavioral") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      if (interim) setSttInterim(interim);
      if (final) {
        setSttTranscript((prev) => (prev ? prev + " " + final : final));
        setSttInterim("");
      }
    };
    recognition.onerror = () => {};
    recognition.onend = () => {
      if (phase === "behavioral" && !submitted) {
        try { recognition.start(); } catch {}
      }
    };
    recognition.onspeechstart = () => setIsSpeakingVAD(true);
    recognition.onspeechend = () => setIsSpeakingVAD(false);

    sttManagerRef.current = recognition;
    try { recognition.start(); } catch {}

    return () => {
      try { recognition.stop(); } catch {}
      sttManagerRef.current = null;
    };
  }, [phase, submitted]);

  // TTS for behavioral questions
  useEffect(() => {
    if (phase !== "behavioral" || !currentBQ) return;
    let cancelled = false;
    setIsAiSpeaking(true);
    setAiAudioReady(false);

    const introText =
      behavioralIdx === 0
        ? `Welcome to your interview. Here's the first question: ${currentBQ.question}`
        : `Next question: ${currentBQ.question}`;

    (async () => {
      try {
        const audioUrl = await fetchTTSAudio(introText, { voice: "alloy", speed: 1.0 });
        if (cancelled) return;
        const audio = new Audio(audioUrl);
        aiAudioRef.current = audio;
        audio.onended = () => { if (!cancelled) { setIsAiSpeaking(false); setAiAudioReady(true); } };
        audio.onerror = () => { if (!cancelled) { setIsAiSpeaking(false); setAiAudioReady(true); } };
        audio.play().catch(() => { if (!cancelled) { setIsAiSpeaking(false); setAiAudioReady(true); } });
      } catch {
        if (!cancelled) { setIsAiSpeaking(false); setAiAudioReady(true); }
      }
    })();

    return () => {
      cancelled = true;
      if (aiAudioRef.current) { aiAudioRef.current.pause(); aiAudioRef.current = null; }
    };
  }, [phase, behavioralIdx, currentBQ]);

  // Behavioral handlers
  const handleBehavioralInputChange = useCallback((e) => setBehavioralInput(e.target.value), []);

  const handleBehavioralSendVoice = useCallback(async () => {
    const text = sttTranscript.trim();
    if (!text || isBehavioralSending) return;
    setBehavioralMessages((prev) => [...prev, { role: "user", content: text }]);
    setSttTranscript("");
    setSttInterim("");
    setIsBehavioralSending(true);
    try {
      const ctx = [...behavioralLlmRef.current, { role: "user", content: text }];
      behavioralLlmRef.current = ctx;
      const data = await sendChat({
        messages: ctx,
        mode: "chat",
        interruptContext: { interviewPhase: "behavioral", problemTitle: currentBQ?.question },
      });
      const reply = data.reply || "Thank you for sharing. Let's continue.";
      setBehavioralMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      behavioralLlmRef.current.push({ role: "assistant", content: reply });
      if (voiceSupported && speak) speak(reply, { skipTranscript: true, immediate: true });
    } catch {
      setBehavioralMessages((prev) => [...prev, { role: "assistant", content: "I apologize, I'm having some technical difficulties." }]);
    } finally {
      setIsBehavioralSending(false);
    }
  }, [sttTranscript, isBehavioralSending, currentBQ, voiceSupported, speak]);

  const handleBehavioralSendText = useCallback(async () => {
    const trimmed = behavioralInput.trim();
    if (!trimmed || isBehavioralSending) return;
    setBehavioralMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setBehavioralInput("");
    setIsBehavioralSending(true);
    try {
      const ctx = [...behavioralLlmRef.current, { role: "user", content: trimmed }];
      behavioralLlmRef.current = ctx;
      const data = await sendChat({
        messages: ctx,
        mode: "chat",
        interruptContext: { interviewPhase: "behavioral", problemTitle: currentBQ?.question },
      });
      const reply = data.reply || "Thank you for sharing. Let's continue.";
      setBehavioralMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      behavioralLlmRef.current.push({ role: "assistant", content: reply });
      if (voiceSupported && speak) speak(reply, { skipTranscript: true, immediate: true });
    } catch {
      setBehavioralMessages((prev) => [...prev, { role: "assistant", content: "I apologize, I'm having some technical difficulties." }]);
    } finally {
      setIsBehavioralSending(false);
    }
  }, [behavioralInput, isBehavioralSending, currentBQ, voiceSupported, speak]);

  const handleBehavioralKeyDown = useCallback(
    (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleBehavioralSendText(); } },
    [handleBehavioralSendText]
  );

  const handleNextBehavioral = useCallback(() => {
    const hasStt = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const answer = hasStt ? sttTranscript.trim() : behavioralInput.trim();
    if (currentBQ && answer) {
      behavioralAnswersRef.current.push({ question: currentBQ.question, category: currentBQ.category || "", answer });
    }

    if (aiAudioRef.current) { aiAudioRef.current.pause(); aiAudioRef.current = null; }

    const nextIdx = behavioralIdx + 1;
    if (nextIdx < behavioralQs.length) {
      setBehavioralIdx(nextIdx);
      behavioralLlmRef.current = [];
      setSttTranscript("");
      setSttInterim("");
      setBehavioralInput("");
      setAiAudioReady(false);
    } else {
      if (hasCoding) {
        setPhase("coding");
      } else {
        setPhase("completed");
      }
    }
  }, [behavioralIdx, behavioralQs, currentBQ, sttTranscript, behavioralInput, hasCoding]);

  // Coding handlers
  const handleCodeChange = useCallback((val) => setCode(val || ""), []);
  const handleEditorMount = useCallback((editor, monaco) => { editorRef.current = editor; monacoRef.current = monaco; }, []);
  const handleDismissHint = useCallback(() => setEditorHint(null), []);

  const handleChatToggle = useCallback(() => setChatOpen((p) => !p), []);
  const handleChatInputChange = useCallback((e) => setChatInput(e.target.value), []);

  const handleChatSend = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isSending) return;
    setChatMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setChatInput("");
    setIsSending(true);
    try {
      const withCode = code !== lastCodeSentRef.current
        ? [...llmMessagesRef.current, { role: "user", content: `[code update]\n${code}` }]
        : llmMessagesRef.current;
      lastCodeSentRef.current = code;
      const msgs = [...withCode, { role: "user", content: trimmed }];
      llmMessagesRef.current = msgs;
      const data = await sendChat({ messages: msgs, mode: "chat", practiceMode: false });
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      llmMessagesRef.current.push({ role: "assistant", content: data.reply });
    } catch (error) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: `Error: ${error.message || "Unable to reach the server."}` }]);
    } finally {
      setIsSending(false);
    }
  }, [chatInput, code, isSending]);

  const handleChatKeyDown = useCallback(
    (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); } },
    [handleChatSend]
  );

  const handleClearConsole = useCallback(() => setConsoleLogs([]), []);
  const handleToggleConsole = useCallback(() => setIsConsoleOpen((p) => !p), []);

  const handleRunCode = useCallback(() => {
    if (isRunning || submitted) return;
    setIsRunning(true);
    setConsoleLogs([]);
    setIsConsoleOpen(true);
    setTimeout(() => {
      const logs = [];
      const captureConsole = {
        log: (...a) => logs.push({ type: "log", value: a.length === 1 ? a[0] : a }),
        error: (...a) => logs.push({ type: "error", value: a.length === 1 ? a[0] : a }),
        warn: (...a) => logs.push({ type: "warn", value: a.length === 1 ? a[0] : a }),
        info: (...a) => logs.push({ type: "info", value: a.length === 1 ? a[0] : a }),
        clear: () => { logs.length = 0; },
      };
      try {
        const runCode = new Function("console", `"use strict";\n${code}`);
        const result = runCode(captureConsole);
        if (result !== undefined) logs.push({ type: "result", value: result });
      } catch (error) {
        logs.push({ type: "error", value: `${error.name}: ${error.message}` });
      }
      if (logs.length === 0) logs.push({ type: "info", value: "Code executed successfully (no output)." });
      setConsoleLogs(logs);
      setIsRunning(false);
    }, 100);
  }, [code, isRunning, submitted]);

  // Run test cases
  const handleRunTests = useCallback(() => {
    if (!question?.testCases?.length) return;
    setIsConsoleOpen(true);
    const logs = [];
    const fnMatch = (question.starterCode || "").match(/function\s+(\w+)/);
    const fnName = fnMatch ? fnMatch[1] : null;
    if (!fnName) {
      setConsoleLogs([{ type: "error", value: "Could not detect function name from starter code." }]);
      return;
    }
    let passed = 0;
    for (const tc of question.testCases) {
      try {
        const args = Object.values(tc.input).map((v) => JSON.stringify(v)).join(", ");
        const testCode = `${code}\nreturn ${fnName}(${args});`;
        const result = new Function(testCode)();
        const ok = JSON.stringify(result) === JSON.stringify(tc.expected);
        if (ok) passed++;
        logs.push({
          type: ok ? "log" : "error",
          value: `${ok ? "PASS" : "FAIL"} | Input: ${JSON.stringify(tc.input)} | Expected: ${JSON.stringify(tc.expected)} | Got: ${JSON.stringify(result)}`,
        });
      } catch (err) {
        logs.push({ type: "error", value: `ERROR | Input: ${JSON.stringify(tc.input)} | ${err.message}` });
      }
    }
    logs.unshift({ type: "info", value: `Test Results: ${passed}/${question.testCases.length} passed` });
    setConsoleLogs(logs);
  }, [code, question]);

  // AI hints during coding
  useEffect(() => {
    if (phase !== "coding" || isPaused || !question || submitted) return;
    const timer = setTimeout(async () => {
      if (hintInFlightRef.current) return;
      if (code === lastAiCodeRef.current) return;
      if (aiHintCountRef.current >= MAX_AI_HINTS) return;
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
          setEditorHint({ hints: data.hints, message: data.hints[0].message });
          const msg = data.hints.map((h) => h.message).join(" ");
          setChatMessages((prev) => [...prev, { role: "assistant", content: msg, isInterruption: true }]);
        }
      } catch {} finally {
        hintInFlightRef.current = false;
      }
    }, AI_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [code, phase, isPaused, question, submitted]);

  const handlePauseToggle = useCallback(() => setIsPaused((p) => !p), []);

  const handleNext = useCallback(() => {
    if (question) {
      const fnMatch = (question.starterCode || "").match(/function\s+(\w+)/);
      const fnName = fnMatch ? fnMatch[1] : null;
      let passed = 0, total = 0;
      if (fnName && question.testCases?.length) {
        total = question.testCases.length;
        for (const tc of question.testCases) {
          try {
            const args = Object.values(tc.input).map((v) => JSON.stringify(v)).join(", ");
            const result = new Function(`${code}\nreturn ${fnName}(${args});`)();
            if (JSON.stringify(result) === JSON.stringify(tc.expected)) passed++;
          } catch {}
        }
      }
      setProblemResults((prev) => [
        ...prev,
        { problemId: question.id, problemTitle: question.title, difficulty: question.difficulty, code, testResults: { passed, total }, timeSpent: codingElapsed },
      ]);
    }

    if (currentIdx < codingQuestions.length - 1) {
      setCurrentIdx((i) => i + 1);
      setEditorHint(null);
      aiHintCountRef.current = 0;
      lastAiCodeRef.current = "";
      llmMessagesRef.current = [];
      lastCodeSentRef.current = "";
      setChatMessages([{ role: "assistant", content: "New question loaded. Take your time and start whenever you're ready." }]);
    } else {
      setSubmitted(true);
      setPhase("completed");
    }
  }, [currentIdx, codingQuestions, question, code, codingElapsed]);

  // Completed screen
  if (phase === "completed" || submitted) {
    const totalScore = problemResults.length > 0
      ? Math.round(problemResults.reduce((s, r) => s + (r.testResults.total > 0 ? (r.testResults.passed / r.testResults.total) * 100 : 0), 0) / problemResults.length)
      : 0;

    return (
      <div className="cs-join">
        <div className="cs-join__card" style={{ maxWidth: 560 }}>
          <h1>Mock Interview Complete</h1>
          <p style={{ color: "#64748b", marginBottom: 20 }}>
            Great job completing your mock interview! Here's a summary of your performance.
          </p>

          {problemResults.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Coding Results</h3>
              {problemResults.map((r, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 14px",
                    background: "#f8fafc",
                    borderRadius: 10,
                    marginBottom: 8,
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>{r.problemTitle}</strong>
                    <span style={{ marginLeft: 8, fontSize: "0.8rem", color: "#64748b" }}>({r.difficulty})</span>
                  </div>
                  <span style={{ fontWeight: 700, color: r.testResults.passed === r.testResults.total ? "#16a34a" : "#dc2626" }}>
                    {r.testResults.passed}/{r.testResults.total} tests
                  </span>
                </div>
              ))}
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <span style={{ fontSize: "2rem", fontWeight: 800, color: totalScore >= 70 ? "#16a34a" : totalScore >= 40 ? "#f59e0b" : "#dc2626" }}>
                  {totalScore}%
                </span>
                <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "4px 0 0" }}>Overall Score</p>
              </div>
            </div>
          )}

          {behavioralAnswersRef.current.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "1rem" }}>Behavioral Questions Completed</h3>
              <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                You answered {behavioralAnswersRef.current.length} behavioral question{behavioralAnswersRef.current.length !== 1 ? "s" : ""}.
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="cs-btn cs-btn--primary" onClick={() => navigate("/home")} style={{ flex: 1 }}>
              Back to Home
            </button>
            <button className="cs-btn" onClick={onExit} style={{ flex: 1, background: "#f1f5f9", color: "#475569" }}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Behavioral phase — same immersive UI as CandidateSession
  if (phase === "behavioral" && currentBQ) {
    const hasSttSupport = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const latestAiMsg = [...behavioralMessages].reverse().find((m) => m.role === "assistant");
    const subtitleText = latestAiMsg?.content?.replace(/\*\*/g, "") || "";

    return (
      <div className="cs-interview">
        <div className="cs-interview__topbar">
          <div className="cs-interview__topbar-left">
            <span className="cs-phase-badge" style={{ background: "rgba(139,92,246,0.15)", color: "#7c3aed", fontSize: "0.75rem", padding: "3px 10px", borderRadius: 6 }}>
              Mock Interview
            </span>
          </div>
          <div className="cs-interview__topbar-center">
            {plan?.title || "Mock Interview"} &middot; Q{behavioralIdx + 1}/{behavioralQs.length}
          </div>
          <div className="cs-interview__topbar-right">
            <button
              className="cs-toolbar-btn"
              onClick={onExit}
              title="Exit interview"
              style={{ fontSize: "0.8rem", padding: "4px 12px" }}
            >
              Exit
            </button>
          </div>
        </div>

        <div className="cs-interview__stage">
          <div className={`cs-spirograph ${isAiSpeaking ? "cs-spirograph--active" : ""}`}>
            <div className="cs-spirograph__ring" />
            <div className="cs-spirograph__ring" />
            <div className="cs-spirograph__ring" />
            <div className="cs-spirograph__ring" />
            <div className="cs-spirograph__ring" />
            <div className="cs-spirograph__ring" />
            <div className="cs-spirograph__ring" />
            <div className="cs-spirograph__ring" />
          </div>

          <div className="cs-subtitles">
            {isAiSpeaking && subtitleText && <p className="cs-subtitles__text">{subtitleText}</p>}
            {!isAiSpeaking && aiAudioReady && (
              <p className="cs-subtitles__status">
                Listening to your answer{isSpeakingVAD ? "" : " — speak when ready"}
              </p>
            )}
            {!isAiSpeaking && !aiAudioReady && (
              <p className="cs-subtitles__status">
                Preparing question
                <span className="cs-subtitles__dots"><span /><span /><span /></span>
              </p>
            )}
          </div>
        </div>

        {(sttTranscript || sttInterim) && (
          <div className="cs-interview__transcript-overlay">
            <p className="cs-interview__transcript-label">
              {isSpeakingVAD && <span className="cs-listening-dot" />}
              Your Answer
            </p>
            {sttTranscript && <p className="cs-interview__transcript-text">{sttTranscript}</p>}
            {sttInterim && <p className="cs-interview__transcript-interim">{sttInterim}</p>}
          </div>
        )}

        {!hasSttSupport && (
          <div className="cs-interview__fallback-input">
            <textarea
              placeholder="Type your answer here (speech recognition unavailable)..."
              value={behavioralInput}
              onChange={handleBehavioralInputChange}
              onKeyDown={handleBehavioralKeyDown}
              rows={2}
            />
          </div>
        )}

        <div className="cs-interview__toolbar">
          <div className="cs-interview__toolbar-info">{fmtTime(behavioralElapsed)}</div>

          <button className="cs-toolbar-btn cs-toolbar-btn--active" title="Microphone on">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          {hasSttSupport && sttTranscript.trim() && (
            <button
              className="cs-toolbar-btn cs-toolbar-btn--active"
              onClick={handleBehavioralSendVoice}
              disabled={isBehavioralSending}
              title="Submit spoken answer"
              style={{ fontSize: "0.8rem", padding: "6px 14px" }}
            >
              Send Answer
            </button>
          )}

          <button
            className="cs-toolbar-btn cs-toolbar-btn--leave"
            onClick={handleNextBehavioral}
            disabled={isAiSpeaking}
          >
            {behavioralIdx < behavioralQs.length - 1
              ? "Next Question"
              : hasCoding
                ? "Proceed to Coding"
                : "Complete Interview"}
          </button>
        </div>
      </div>
    );
  }

  // Coding phase — same 3-panel layout as CandidateSession
  return (
    <div className="cs-session">
      <header className="cs-session__header">
        <h2>{plan?.title || "Mock Interview"}</h2>
        <div className="cs-session__meta">
          {hasBehavioral && (
            <span className="cs-phase-badge cs-phase-badge--coding">Coding Phase</span>
          )}
          <span>
            Question {currentIdx + 1}/{codingQuestions.length}
          </span>
          <span className={remaining < 300 ? "cs-timer--warn" : ""}>
            {fmtTime(remaining)}
          </span>

          <button
            type="button"
            className={`cs-btn ${isPaused ? "cs-btn--primary" : ""}`}
            onClick={handlePauseToggle}
            style={{ padding: "4px 14px", fontSize: "0.82rem" }}
          >
            {isPaused ? "Resume" : "Pause"}
          </button>

          <button
            type="button"
            className={`cs-chat-toggle ${chatOpen ? "cs-chat-toggle--active" : ""}`}
            onClick={handleChatToggle}
          >
            &#x1F4AC; {chatOpen ? "Hide Chat" : "AI Chat"}
          </button>

          <button
            type="button"
            className="cs-btn"
            onClick={onExit}
            style={{ padding: "4px 14px", fontSize: "0.82rem", background: "#fee2e2", color: "#dc2626" }}
          >
            Exit
          </button>
        </div>
      </header>

      {isPaused && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "32px 48px", textAlign: "center" }}>
            <h2 style={{ margin: "0 0 8px" }}>Interview Paused</h2>
            <p style={{ color: "#64748b", margin: "0 0 16px" }}>Timer is paused. Click Resume to continue.</p>
            <button className="cs-btn cs-btn--primary" onClick={handlePauseToggle}>Resume Interview</button>
          </div>
        </div>
      )}

      <div className="cs-session__body">
        <aside className="cs-session__problem">
          {question ? (
            <>
              <h3>{question.title}</h3>
              <span className={`iv-diff iv-diff--${(question.difficulty || "").toLowerCase()}`}>
                {question.difficulty}
              </span>
              <div className="cs-desc">{question.description}</div>

              {question.examples?.length > 0 && (
                <div className="cs-tests">
                  <h4>Examples</h4>
                  {question.examples.map((ex, i) => (
                    <pre key={i} className="cs-test-case">
                      Input: {ex.input}{"\n"}Output: {ex.output}
                      {ex.explanation ? `\n${ex.explanation}` : ""}
                    </pre>
                  ))}
                </div>
              )}

              {question.testCases?.length > 0 && (
                <div className="cs-tests">
                  <h4>Test Cases</h4>
                  {question.testCases.slice(0, 3).map((tc, i) => (
                    <pre key={i} className="cs-test-case">
                      Input: {JSON.stringify(tc.input)}{"\n"}Expected: {JSON.stringify(tc.expected)}
                    </pre>
                  ))}
                  <button
                    type="button"
                    className="cs-btn"
                    onClick={handleRunTests}
                    style={{ marginTop: 8, fontSize: "0.82rem", padding: "6px 14px", width: "100%" }}
                  >
                    Run All Tests
                  </button>
                </div>
              )}

              {question.hints?.length > 0 && (
                <details style={{ marginTop: 12 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.88rem", color: "#6366f1" }}>
                    Hints ({question.hints.length})
                  </summary>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: "0.85rem", color: "#475569" }}>
                    {question.hints.map((h, i) => <li key={i} style={{ marginBottom: 4 }}>{h}</li>)}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <p className="cs-muted">Loading problem...</p>
          )}
        </aside>

        <main className={`cs-session__editor ${chatOpen ? "cs-session__editor--with-chat" : ""}`}>
          <EditorPanel
            canUndo={true}
            canRedo={true}
            isEditorDisabled={submitted || isPaused}
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
              readOnly: submitted || isPaused,
            }}
            code={code}
            interviewerHint={editorHint}
            onDismissHint={handleDismissHint}
            consoleLogs={consoleLogs}
            onClearConsole={handleClearConsole}
            isConsoleOpen={isConsoleOpen}
            onToggleConsole={handleToggleConsole}
          />
        </main>

        {chatOpen && (
          <aside className="cs-session__chat">
            <ChatPanel
              messages={chatMessages}
              input={chatInput}
              isLocked={submitted}
              isPaused={isPaused}
              isSending={isSending}
              onInputChange={handleChatInputChange}
              onKeyDown={handleChatKeyDown}
              onSend={handleChatSend}
              showVoiceControls={false}
            />
          </aside>
        )}
      </div>

      <footer className="cs-session__footer">
        <button className="cs-btn cs-btn--primary" onClick={handleNext}>
          {currentIdx < codingQuestions.length - 1 ? "Submit & Next" : "Submit Final"}
        </button>
      </footer>
    </div>
  );
}
