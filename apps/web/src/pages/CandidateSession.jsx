// CandidateSession – focused coding view for a candidate inside a live session.
// Features: Monaco editor with inline AI hints, AI chat panel, problem panel, timer, code auto-sync.
// Supports mock AI interview phase (behavioral questions) before coding when session format requires it.
// Behavioral phase requires camera + mic: candidate speaks answers (STT), session is recorded.

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EditorPanel from "../components/EditorPanel.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import CameraGate from "../components/CameraGate.jsx";
import { useVoice } from "../contexts/VoiceContext.jsx";
import { getSession, pushCode, uploadRecording, saveBehavioralAnswers, fetchTTSAudio } from "../services/sessionService.js";
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

  // Mock interview phase state
  const [phase, setPhase] = useState("loading"); // "loading" | "camera_gate" | "behavioral" | "coding"
  const [behavioralQuestions, setBehavioralQuestions] = useState([]);
  const [behavioralIdx, setBehavioralIdx] = useState(0);
  const [behavioralMessages, setBehavioralMessages] = useState([]);
  const [behavioralInput, setBehavioralInput] = useState("");
  const [isBehavioralSending, setIsBehavioralSending] = useState(false);
  const [behavioralElapsed, setBehavioralElapsed] = useState(0);
  const behavioralLlmRef = useRef([]);

  // Audio TTS state for behavioral phase
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [aiAudioReady, setAiAudioReady] = useState(false);
  const aiAudioRef = useRef(null);
  const behavioralAnswersRef = useRef([]); // collected answers: [{question, answer}]

  // Camera/recording state for behavioral phase
  const [mediaStream, setMediaStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [sttTranscript, setSttTranscript] = useState("");
  const [sttInterim, setSttInterim] = useState("");
  const [isSpeakingVAD, setIsSpeakingVAD] = useState(false);
  const videoPreviewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const sttManagerRef = useRef(null);

  const { speak, cancelSpeech, isSupported: voiceSupported } = useVoice();

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

        // Determine starting phase based on session format
        const fmt = s.sessionFormat || "coding_only";
        const hasBehavioral = fmt === "mock_interview" || fmt === "both";
        const aiQs = s.aiGeneratedQuestions || [];

        if (hasBehavioral && aiQs.length > 0) {
          setBehavioralQuestions(aiQs);
          setBehavioralIdx(0);
          setBehavioralMessages([{
            role: "assistant",
            content: `Welcome to your interview! I'd like to ask you a few behavioral questions. Please speak your answers clearly.\n\nHere's the first question:\n\n**${aiQs[0].question}**\n\nTake your time to think about a specific example from your experience.`,
          }]);
          // Route through camera gate first if camera is required
          const cameraRequired = s.settings?.cameraRequired !== false;
          setPhase(cameraRequired ? "camera_gate" : "behavioral");
        } else {
          setPhase("coding");
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

  const question = questions[currentIdx] || null;
  const sessionLanguage = session?.settings?.language || "javascript";
  const timeLimit = session?.settings?.timeLimitSeconds || 1800;
  const isCodingPhase = phase === "coding";
  const remaining = Math.max(0, timeLimit - elapsed);
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Timer — only counts during the coding phase so behavioral time doesn't eat into it
  useEffect(() => {
    if (submitted || !isCodingPhase) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [submitted, isCodingPhase]);

  // Behavioral phase elapsed timer (informational only, no countdown)
  useEffect(() => {
    if (submitted || phase !== "behavioral") return;
    const t = setInterval(() => setBehavioralElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [submitted, phase]);

  // Code push loop — only active during coding phase
  useEffect(() => {
    if (!isCodingPhase) return;
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
  }, [sessionId, candidateId, currentIdx, questions, isCodingPhase]);

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

  // ── Camera Gate Handler ────────────────────────────────────────────
  const handleCameraReady = useCallback((stream) => {
    setMediaStream(stream);
    setPhase("behavioral");
  }, []);

  const handleCameraSkip = useCallback(() => {
    setPhase("behavioral");
  }, []);

  // ── Recording Helpers ─────────────────────────────────────────────
  const startRecordingSession = useCallback(() => {
    if (!mediaStream) return;

    recordingChunksRef.current = [];
    try {
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";

      const recorder = new MediaRecorder(mediaStream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      recorder.onstop = () => setIsRecording(false);
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error("Recording start error:", err);
    }
  }, [mediaStream]);

  const stopRecordingSession = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const downloadRecording = useCallback(() => {
    if (recordingChunksRef.current.length === 0) return;
    const blob = new Blob(recordingChunksRef.current, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-recording-${new Date().toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleUploadRecording = useCallback(async () => {
    if (recordingChunksRef.current.length === 0 || !sessionId || !candidateId) return;
    setIsUploading(true);
    try {
      const blob = new Blob(recordingChunksRef.current, { type: "video/webm" });
      await uploadRecording(sessionId, candidateId, blob);
      setUploadDone(true);
    } catch (err) {
      console.error("Upload failed:", err);
    }
    setIsUploading(false);
  }, [sessionId, candidateId]);

  // Auto-start recording when entering behavioral phase with a stream
  useEffect(() => {
    if (phase === "behavioral" && mediaStream && !isRecording) {
      startRecordingSession();
    }
  }, [phase, mediaStream, isRecording, startRecordingSession]);

  // Attach the stream to the video preview when it changes
  useEffect(() => {
    if (videoPreviewRef.current && mediaStream) {
      videoPreviewRef.current.srcObject = mediaStream;
    }
  }, [mediaStream, phase]);

  // ── STT (Speech-to-Text) for behavioral phase ────────────────────
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
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (interim) setSttInterim(interim);
      if (final) {
        setSttTranscript((prev) => (prev ? prev + " " + final : final));
        setSttInterim("");
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.error("STT error:", event.error);
      }
    };

    recognition.onend = () => {
      if (phase === "behavioral" && !submitted) {
        try { recognition.start(); } catch { /* already started */ }
      }
    };

    recognition.onspeechstart = () => setIsSpeakingVAD(true);
    recognition.onspeechend = () => setIsSpeakingVAD(false);

    sttManagerRef.current = recognition;
    try { recognition.start(); } catch { /* ignore */ }

    return () => {
      try { recognition.stop(); } catch { /* ignore */ }
      sttManagerRef.current = null;
    };
  }, [phase, submitted]);

  // ── Behavioral Phase Handlers (audio-based) ───────────────────────
  const handleBehavioralInputChange = useCallback((e) => {
    setBehavioralInput(e.target.value);
  }, []);

  // Send transcribed speech as the candidate's response
  const handleBehavioralSendVoice = useCallback(async () => {
    const text = sttTranscript.trim();
    if (!text || isBehavioralSending) return;

    setBehavioralMessages((prev) => [...prev, { role: "user", content: text }]);
    setSttTranscript("");
    setSttInterim("");
    setIsBehavioralSending(true);

    try {
      const currentQ = behavioralQuestions[behavioralIdx];
      const contextMessages = [
        ...behavioralLlmRef.current,
        { role: "user", content: text },
      ];
      behavioralLlmRef.current = contextMessages;

      const data = await sendChat({
        messages: contextMessages,
        mode: "chat",
        practiceMode: false,
        interruptContext: {
          interviewPhase: "behavioral",
          problemTitle: currentQ?.question || "Behavioral Question",
        },
      });

      const reply = data.reply || "Thank you for sharing. Let's continue.";
      setBehavioralMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      behavioralLlmRef.current = [...behavioralLlmRef.current, { role: "assistant", content: reply }];

      if (voiceSupported && speak) {
        speak(reply, { skipTranscript: true, immediate: true });
      }
    } catch {
      const fallback = "I apologize, I'm having some technical difficulties. Please continue.";
      setBehavioralMessages((prev) => [...prev, { role: "assistant", content: fallback }]);
    } finally {
      setIsBehavioralSending(false);
    }
  }, [sttTranscript, isBehavioralSending, behavioralQuestions, behavioralIdx, voiceSupported, speak]);

  // Fallback: send typed text if STT is unavailable
  const handleBehavioralSendText = useCallback(async () => {
    const trimmed = behavioralInput.trim();
    if (!trimmed || isBehavioralSending) return;

    setBehavioralMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setBehavioralInput("");
    setIsBehavioralSending(true);

    try {
      const currentQ = behavioralQuestions[behavioralIdx];
      const contextMessages = [
        ...behavioralLlmRef.current,
        { role: "user", content: trimmed },
      ];
      behavioralLlmRef.current = contextMessages;

      const data = await sendChat({
        messages: contextMessages,
        mode: "chat",
        practiceMode: false,
        interruptContext: {
          interviewPhase: "behavioral",
          problemTitle: currentQ?.question || "Behavioral Question",
        },
      });

      const reply = data.reply || "Thank you for sharing. Let's continue.";
      setBehavioralMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      behavioralLlmRef.current = [...behavioralLlmRef.current, { role: "assistant", content: reply }];

      if (voiceSupported && speak) {
        speak(reply, { skipTranscript: true, immediate: true });
      }
    } catch {
      setBehavioralMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I apologize, I'm having some technical difficulties. Please continue." },
      ]);
    } finally {
      setIsBehavioralSending(false);
    }
  }, [behavioralInput, isBehavioralSending, behavioralQuestions, behavioralIdx, voiceSupported, speak]);

  const handleBehavioralKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleBehavioralSendText();
    }
  }, [handleBehavioralSendText]);

  // Play the question via OpenAI TTS when behavioral phase starts or question changes
  useEffect(() => {
    if (phase !== "behavioral" || behavioralQuestions.length === 0) return;

    const q = behavioralQuestions[behavioralIdx];
    if (!q) return;

    let cancelled = false;
    setIsAiSpeaking(true);
    setAiAudioReady(false);

    const introText = behavioralIdx === 0
      ? `Welcome to your interview. Here's the first question: ${q.question}`
      : `Next question: ${q.question}`;

    (async () => {
      try {
        const audioUrl = await fetchTTSAudio(introText, { voice: "alloy", speed: 1.0 });
        if (cancelled) return;

        const audio = new Audio(audioUrl);
        aiAudioRef.current = audio;

        audio.onended = () => {
          if (!cancelled) {
            setIsAiSpeaking(false);
            setAiAudioReady(true);
          }
        };
        audio.onerror = () => {
          if (!cancelled) {
            setIsAiSpeaking(false);
            setAiAudioReady(true);
          }
        };

        audio.play().catch(() => {
          if (!cancelled) {
            setIsAiSpeaking(false);
            setAiAudioReady(true);
          }
        });
      } catch {
        if (!cancelled) {
          setIsAiSpeaking(false);
          setAiAudioReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (aiAudioRef.current) {
        aiAudioRef.current.pause();
        aiAudioRef.current = null;
      }
    };
  }, [phase, behavioralIdx, behavioralQuestions]);

  const handleNextBehavioral = useCallback(() => {
    // Collect the spoken or typed answer for the current question
    const currentQ = behavioralQuestions[behavioralIdx];
    const hasStt = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const candidateAnswer = hasStt ? sttTranscript.trim() : behavioralInput.trim();
    if (currentQ && candidateAnswer) {
      behavioralAnswersRef.current = [
        ...behavioralAnswersRef.current,
        { question: currentQ.question, category: currentQ.category || "", answer: candidateAnswer },
      ];
    }

    const nextIdx = behavioralIdx + 1;
    if (nextIdx < behavioralQuestions.length) {
      setBehavioralIdx(nextIdx);
      const nextQ = behavioralQuestions[nextIdx];
      behavioralLlmRef.current = [];
      setSttTranscript("");
      setSttInterim("");
      setBehavioralInput("");
      setAiAudioReady(false);
      setBehavioralMessages([{
        role: "assistant",
        content: `Great, let's move on to the next question.\n\n**${nextQ.question}**\n\nTake your time.`,
      }]);

      // Stop any playing audio
      if (aiAudioRef.current) {
        aiAudioRef.current.pause();
        aiAudioRef.current = null;
      }
    } else {
      // All behavioral questions done — save answers, stop recording, upload, then transition
      stopRecordingSession();

      // Stop any playing audio
      if (aiAudioRef.current) {
        aiAudioRef.current.pause();
        aiAudioRef.current = null;
      }

      // Save behavioral answers to the server for report generation
      if (behavioralAnswersRef.current.length > 0 && sessionId && candidateId) {
        saveBehavioralAnswers(sessionId, candidateId, behavioralAnswersRef.current).catch((err) =>
          console.error("Failed to save behavioral answers:", err)
        );
      }

      // Stop media stream for camera release
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop());
        setMediaStream(null);
      }

      // Upload recording in background
      if (recordingChunksRef.current.length > 0) {
        handleUploadRecording();
      }

      const fmt = session?.sessionFormat || "coding_only";
      if (fmt === "both" && questions.length > 0) {
        setPhase("coding");
        setBehavioralMessages([]);
      } else {
        setSubmitted(true);
      }
    }
  }, [behavioralIdx, behavioralQuestions, session, questions, sttTranscript, behavioralInput, sessionId, candidateId, stopRecordingSession, handleUploadRecording, mediaStream]);

  // Keep a ref to mediaStream for cleanup
  const mediaStreamRef = useRef(null);
  useEffect(() => { mediaStreamRef.current = mediaStream; }, [mediaStream]);

  // Cleanup recording and stream on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── LOCAL PATTERN ANALYSIS (4s debounce) ──────────────────────────
  useEffect(() => {
    if (submitted || !question || !isCodingPhase) return;
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
    if (submitted || !question || !isCodingPhase) return;
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
    if (submitted || !question || !isCodingPhase) return;
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

  // Time's up — only enforce during the coding phase
  useEffect(() => {
    if (remaining <= 0 && !submitted && isCodingPhase) {
      pushCode(sessionId, candidateId, {
        code: codeRef.current,
        questionId: question?.id || "_default",
      }).catch(() => {});
      setSubmitted(true);
    }
  }, [remaining, submitted, sessionId, candidateId, question, isCodingPhase]);

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

  // ── Camera Permission Gate ─────────────────────────────────────
  if (phase === "camera_gate") {
    return (
      <CameraGate
        onReady={handleCameraReady}
        onSkip={handleCameraSkip}
        required={session?.settings?.cameraRequired !== false}
      />
    );
  }

  // ── Behavioral Interview Phase (Upwork-style immersive) ──────────
  if (phase === "behavioral") {
    const currentBQ = behavioralQuestions[behavioralIdx];
    const hasSttSupport = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

    // Build the subtitle text from the latest AI message
    const latestAiMsg = [...behavioralMessages].reverse().find((m) => m.role === "assistant");
    const subtitleText = latestAiMsg?.content?.replace(/\*\*/g, "") || "";

    return (
      <div className="cs-interview">
        {/* ── Top bar ──────────────────────────────────────────── */}
        <div className="cs-interview__topbar">
          <div className="cs-interview__topbar-left">
            {isRecording && <span className="cs-interview__rec-dot" />}
          </div>
          <div className="cs-interview__topbar-center">
            Interview: {session?.title || "Session"} &middot; Q{behavioralIdx + 1}/{behavioralQuestions.length}
          </div>
          <div className="cs-interview__topbar-right">
            <button className="cs-interview__settings-btn" title="Settings">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Center stage: spirograph + subtitles ─────────────── */}
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
            {isAiSpeaking && subtitleText && (
              <p className="cs-subtitles__text">{subtitleText}</p>
            )}
            {!isAiSpeaking && aiAudioReady && (
              <p className="cs-subtitles__status">
                Listening to your answer{isSpeakingVAD ? "" : " — speak when ready"}
              </p>
            )}
            {!isAiSpeaking && !aiAudioReady && (
              <p className="cs-subtitles__status">
                Preparing question
                <span className="cs-subtitles__dots">
                  <span /><span /><span />
                </span>
              </p>
            )}
          </div>
        </div>

        {/* ── Candidate camera PIP (bottom-left) ─────────────── */}
        <div className={`cs-interview__camera-pip ${isSpeakingVAD ? "cs-interview__camera-pip--speaking" : ""}`}>
          {mediaStream ? (
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
            />
          ) : (
            <div className="cs-interview__camera-pip-placeholder">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
          )}
          <div className="cs-interview__camera-pip-name">
            {isRecording && <span className="cs-rec-dot" />}
            {candidateId || "You"}
          </div>
        </div>

        {/* ── Your spoken answer overlay (bottom-right) ──────── */}
        {(sttTranscript || sttInterim) && (
          <div className="cs-interview__transcript-overlay">
            <p className="cs-interview__transcript-label">
              {isSpeakingVAD && <span className="cs-listening-dot" />}
              Your Answer
            </p>
            {sttTranscript && (
              <p className="cs-interview__transcript-text">{sttTranscript}</p>
            )}
            {sttInterim && (
              <p className="cs-interview__transcript-interim">{sttInterim}</p>
            )}
          </div>
        )}

        {/* ── Fallback text input (no STT) ───────────────────── */}
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

        {/* ── Bottom toolbar ─────────────────────────────────── */}
        <div className="cs-interview__toolbar">
          <div className="cs-interview__toolbar-info">
            {fmtTime(behavioralElapsed)}
          </div>

          {/* Mic */}
          <button className="cs-toolbar-btn cs-toolbar-btn--active" title="Microphone on">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          {/* Camera */}
          <button className={`cs-toolbar-btn ${mediaStream ? "cs-toolbar-btn--active" : ""}`} title="Camera">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </button>

          {/* Screen share placeholder */}
          <button className="cs-toolbar-btn" title="Share screen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </button>

          {/* Leave / Next */}
          <button
            className="cs-toolbar-btn cs-toolbar-btn--leave"
            onClick={handleNextBehavioral}
            disabled={isAiSpeaking}
          >
            {behavioralIdx < behavioralQuestions.length - 1
              ? "Next Question"
              : (session?.sessionFormat === "both" && questions.length > 0)
                ? "Proceed to Coding"
                : "Complete Interview"
            }
          </button>
        </div>
      </div>
    );
  }

  // ── Loading Phase ───────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="cs-join">
        <div className="cs-join__card">
          <h1>Loading Session...</h1>
          <p>Please wait while we set up your interview.</p>
        </div>
      </div>
    );
  }

  // ── Coding Phase (original UI) ─────────────────────────────────
  return (
    <div className="cs-session">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="cs-session__header">
        <h2>{session?.title || "Interview Session"}</h2>
        <div className="cs-session__meta">
          {session?.sessionFormat === "both" && (
            <span className="cs-phase-badge cs-phase-badge--coding">Coding Phase</span>
          )}
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
