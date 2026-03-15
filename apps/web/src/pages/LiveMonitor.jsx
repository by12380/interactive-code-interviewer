// LiveMonitor – Interviewer watches candidates code in real-time.
// Left: candidate list. Center: read-only Monaco editor. Right: AI analysis + controls.

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import {
  getSession,
  getCandidates,
  pullCode,
  endSession,
} from "../services/sessionService.js";
import { QUESTION_BANK } from "../data/questionBank.js";
import { sendChat } from "../api.js";
import "../styles/interviewer.css";

const POLL_MS = 2000;
const CANDIDATE_POLL_MS = 3000;

const LANGUAGE_LABELS = {
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
};

function getSelectedPhase(sessionFormat, candidate) {
  const phase = candidate?.liveInterviewState?.phase;
  if (phase === "behavioral" || phase === "coding") return phase;
  if (sessionFormat === "mock_interview" || sessionFormat === "both") return "behavioral";
  return "coding";
}

function getCandidateProgress(candidate, sessionFormat) {
  const live = candidate?.liveInterviewState;
  const phase = getSelectedPhase(sessionFormat, candidate);
  if (phase === "behavioral") {
    const currentQuestion = Number.isFinite(live?.behavioralQuestionIndex)
      ? live.behavioralQuestionIndex + 1
      : null;
    const totalQuestions = Number.isFinite(live?.behavioralTotalQuestions)
      ? live.behavioralTotalQuestions
      : null;
    if (currentQuestion && totalQuestions) return `Behavioral Q${currentQuestion}/${totalQuestions}`;
    if (totalQuestions) return `Behavioral 0/${totalQuestions}`;
    return "Behavioral";
  }
  if (live?.codingQuestionTitle) return `Coding: ${live.codingQuestionTitle}`;
  return "Coding";
}

function getStatusTone(candidate, sessionFormat) {
  const live = candidate?.liveInterviewState;
  if (live?.statusLabel === "completed" || candidate?.status === "submitted") return "done";
  if (getSelectedPhase(sessionFormat, candidate) === "behavioral") return "behavioral";
  return "coding";
}

export default function LiveMonitor() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCid, setSelectedCid] = useState(null);
  const [currentQid, setCurrentQid] = useState(null);
  const [code, setCode] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const pollerRef = useRef(null);
  const candidatePollerRef = useRef(null);
  const selectedCandidate = candidates.find((c) => c.id === selectedCid) || null;
  const selectedLiveState = selectedCandidate?.liveInterviewState || null;
  const selectedPhase = getSelectedPhase(session?.sessionFormat, selectedCandidate);
  const selectedQid = selectedLiveState?.codingQuestionId || currentQid;
  const question = QUESTION_BANK.find((q) => q.id === selectedQid);
  const selectedResponses = Array.isArray(selectedCandidate?.behavioralResponses)
    ? [...selectedCandidate.behavioralResponses].sort((a, b) => (a.questionIndex ?? 999) - (b.questionIndex ?? 999))
    : [];
  const behavioralProgressLabel = selectedLiveState?.behavioralTotalQuestions
    ? `Question ${(selectedLiveState?.behavioralQuestionIndex ?? 0) + 1}/${selectedLiveState.behavioralTotalQuestions}`
    : "Behavioral interview";

  // Load session
  useEffect(() => {
    getSession(sessionId).then((s) => {
      setSession(s);
      if (s.questionIds?.length) setCurrentQid(s.questionIds[0]);
    }).catch(() => {});
  }, [sessionId]);

  // Poll candidate list every 5s
  useEffect(() => {
    const poll = () => {
      getCandidates(sessionId).then((list) => {
        setCandidates(list);
        if (!selectedCid && list.length > 0) setSelectedCid(list[0].id);
      }).catch(() => {});
    };
    poll();
    candidatePollerRef.current = setInterval(poll, CANDIDATE_POLL_MS);
    return () => clearInterval(candidatePollerRef.current);
  }, [sessionId, selectedCid]);

  useEffect(() => {
    if (selectedLiveState?.phase === "coding" && selectedLiveState?.codingQuestionId) {
      setCurrentQid(selectedLiveState.codingQuestionId);
    }
  }, [selectedLiveState?.phase, selectedLiveState?.codingQuestionId]);

  // Poll selected candidate's code every 2s
  useEffect(() => {
    if (pollerRef.current) clearInterval(pollerRef.current);
    if (selectedPhase !== "coding") {
      setCode("");
      return;
    }
    if (!selectedCid || !selectedQid) return;
    const poll = () => {
      pullCode(sessionId, selectedCid, selectedQid).then((data) => {
        if (data?.code != null) setCode(data.code);
      }).catch(() => {});
    };
    poll();
    pollerRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollerRef.current);
  }, [sessionId, selectedCid, selectedQid, selectedPhase]);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const sessionLanguage = session?.settings?.language || "javascript";
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // AI analysis (on-demand)
  const handleAnalyze = useCallback(async () => {
    if (!code.trim()) return;
    setAnalyzing(true);
    setAiAnalysis("");
    try {
      const prompt = `Analyze this candidate's code for "${question?.title || currentQid}".
Evaluate: approach, correctness, time/space complexity, code quality. Be concise (3-5 bullet points).`;
      const data = await sendChat({
        messages: [{ role: "user", content: `Problem: ${question?.title}\n\nCode:\n${code}` }],
        mode: "chat",
      });
      setAiAnalysis(data.reply || "No analysis available.");
    } catch (e) {
      setAiAnalysis("Error: " + (e.message || "Analysis failed"));
    }
    setAnalyzing(false);
  }, [code, question, currentQid]);

  const handleEndSession = async () => {
    if (!confirm("End this session for all candidates? An AI report will be generated automatically.")) return;
    await endSession(sessionId).catch(() => {});
    navigate(`/interviewer/results/${sessionId}`);
  };

  const handleEvalAll = async () => {
    if (!confirm("End session and generate AI report for all candidates?")) return;
    await endSession(sessionId).catch(() => {});
    navigate(`/interviewer/results/${sessionId}`);
  };

  return (
    <div className="iv-monitor">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="iv-monitor__header">
        <h2>{session?.title || "Session"}</h2>
        <div className="iv-monitor__meta">
          <span>Code: <strong>{session?.shareCode}</strong></span>
          <span>{candidates.length} candidate(s)</span>
          <span>{LANGUAGE_LABELS[sessionLanguage] || "JavaScript"}</span>
          <span>Elapsed: {fmtTime(elapsed)}</span>
        </div>
        <div className="iv-monitor__header-actions">
          <button className="iv-btn iv-btn--sm iv-btn--primary" onClick={handleEvalAll}>End & Generate Report</button>
          <button className="iv-btn iv-btn--sm iv-btn--danger" onClick={handleEndSession}>End Session</button>
          <button className="iv-btn iv-btn--sm" onClick={() => navigate("/interviewer")}>Dashboard</button>
        </div>
      </header>

      <div className="iv-monitor__body">
        {/* ── Left: candidate list ────────────────────────────────── */}
        <aside className="iv-monitor__sidebar">
          <h3>Candidates</h3>
          {candidates.length === 0 ? (
            <p className="iv-muted">Waiting for candidates to join...</p>
          ) : (
            <ul className="iv-cand-list">
              {candidates.map((c) => (
                <li
                  key={c.id}
                  className={`iv-cand-item ${c.id === selectedCid ? "iv-cand-item--active" : ""}`}
                  onClick={() => setSelectedCid(c.id)}
                >
                  <div className="iv-cand-item__content">
                    <div className="iv-cand-item__info">
                      <span className="iv-cand-name">{c.displayName || c.id}</span>
                      <span className={`iv-monitor-phase-pill iv-monitor-phase-pill--${getStatusTone(c, session?.sessionFormat)}`}>
                        {getSelectedPhase(session?.sessionFormat, c) === "behavioral" ? "Behavioral" : "Coding"}
                      </span>
                    </div>
                    <div className="iv-cand-item__meta">
                      <span>{getCandidateProgress(c, session?.sessionFormat)}</span>
                    </div>
                    <div className="iv-cand-item__badges">
                      <span className={`iv-monitor-status-pill iv-monitor-status-pill--${getStatusTone(c, session?.sessionFormat)}`}>
                        {c.liveInterviewState?.statusLabel || c.status || "joined"}
                      </span>
                      {c.recordingUrl && (
                        <span className="iv-badge iv-badge--recording" title="Session recorded">
                          <span className="iv-rec-dot" />
                          Recorded
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {(session?.questionIds || []).length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>Coding Questions</h3>
              <ul className="iv-question-list">
                {(session?.questionIds || []).map((qid) => {
                  const q = QUESTION_BANK.find((x) => x.id === qid);
                  return (
                    <li key={qid} className={`iv-q-item ${qid === selectedQid ? "iv-q-item--active" : ""}`} onClick={() => setCurrentQid(qid)}>
                      {q?.title || qid}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </aside>

        {/* ── Center: phase-aware monitor view ────────────────────── */}
        <main className="iv-monitor__editor">
          <div className="iv-monitor__editor-bar">
            <span>Viewing: <strong>{selectedCandidate?.displayName || "—"}</strong></span>
            <span>
              {selectedPhase === "behavioral"
                ? behavioralProgressLabel
                : (question?.title || selectedQid || "Coding Session")}
            </span>
          </div>
          {selectedPhase === "behavioral" ? (
            <div className="iv-monitor__behavioral-view">
              <section className="iv-monitor__behavioral-card">
                <div className="iv-monitor__behavioral-card-top">
                  <span className="iv-monitor__behavioral-label">Current Question</span>
                  {selectedLiveState?.behavioralTotalQuestions ? (
                    <span className="iv-monitor__behavioral-step">
                      {(selectedLiveState?.behavioralQuestionIndex ?? 0) + 1}/{selectedLiveState.behavioralTotalQuestions}
                    </span>
                  ) : null}
                </div>
                <p className="iv-monitor__behavioral-question">
                  {selectedLiveState?.behavioralQuestionText || "Waiting for the next behavioral question..."}
                </p>
                <p className="iv-monitor__behavioral-note">
                  Finalized answers appear here after the candidate completes each question.
                </p>
              </section>

              <section className="iv-monitor__answers-card">
                <div className="iv-monitor__answers-card-top">
                  <h3>Finalized Answers</h3>
                  <span>{selectedResponses.length} saved</span>
                </div>
                {selectedResponses.length === 0 ? (
                  <p className="iv-muted">No finalized answers yet.</p>
                ) : (
                  <div className="iv-monitor__answer-list">
                    {selectedResponses.map((response, index) => (
                      <article key={response.questionId || `${selectedCandidate?.id || "candidate"}-${index}`} className="iv-monitor__answer-item">
                        <div className="iv-monitor__answer-header">
                          <span className="iv-monitor__answer-index">Q{(response.questionIndex ?? index) + 1}</span>
                          {response.category ? (
                            <span className="iv-monitor__answer-category">{response.category}</span>
                          ) : null}
                        </div>
                        <p className="iv-monitor__answer-question">{response.question || `Behavioral Question ${index + 1}`}</p>
                        <p className="iv-monitor__answer-text">{response.answer || "No answer saved."}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <Editor
              height="100%"
              defaultLanguage={sessionLanguage === "cpp" ? "cpp" : sessionLanguage}
              language={sessionLanguage === "cpp" ? "cpp" : sessionLanguage}
              theme="playcode-dark"
              value={code}
              beforeMount={(monaco) => {
                monaco.editor.defineTheme("playcode-dark", {
                  base: "vs-dark",
                  inherit: true,
                  rules: [
                    { token: "", foreground: "cdd6f4", background: "1e1e2e" },
                    { token: "comment", foreground: "6c7086", fontStyle: "italic" },
                    { token: "keyword", foreground: "cba6f7" },
                    { token: "string", foreground: "a6e3a1" },
                    { token: "number", foreground: "fab387" },
                    { token: "function", foreground: "89b4fa" },
                    { token: "operator", foreground: "89dceb" },
                  ],
                  colors: {
                    "editor.background": "#1e1e2e",
                    "editor.foreground": "#cdd6f4",
                    "editor.lineHighlightBackground": "#2a2b3d",
                    "editor.lineHighlightBorder": "#00000000",
                    "editorCursor.foreground": "#cba6f7",
                    "editorLineNumber.foreground": "#585b70",
                    "scrollbar.shadow": "#00000000",
                  },
                });
              }}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
                padding: { top: 12, bottom: 12 },
                lineHeight: 22,
                smoothScrolling: true,
                overviewRulerBorder: false,
                scrollbar: { verticalScrollbarSize: 8, useShadows: false },
              }}
            />
          )}
        </main>

        {/* ── Right: AI analysis ──────────────────────────────────── */}
        <aside className="iv-monitor__analysis">
          <h3>{selectedPhase === "behavioral" ? "Behavioral Progress" : "AI Analysis"}</h3>
          {selectedPhase === "coding" ? (
            <>
              <button className="iv-btn iv-btn--primary iv-btn--sm" onClick={handleAnalyze} disabled={analyzing || !code.trim()}>
                {analyzing ? "Analyzing..." : "Analyze Code"}
              </button>
              {aiAnalysis && (
                <div className="iv-analysis-box">
                  <pre>{aiAnalysis}</pre>
                </div>
              )}
            </>
          ) : (
            <div className="iv-behavioral-summary">
              <h3>Live Mock Interview</h3>
              <p>
                {selectedCandidate
                  ? `${selectedCandidate.displayName || selectedCandidate.id} is currently in the behavioral phase.`
                  : "Select a candidate to see live behavioral progress."}
              </p>
              {selectedLiveState?.statusLabel ? (
                <p>Current status: <strong>{selectedLiveState.statusLabel}</strong></p>
              ) : null}
            </div>
          )}

          {/* Recording playback */}
          {(() => {
            if (!selectedCandidate?.recordingUrl) return null;
            return (
              <div className="iv-recording-box">
                <h4>
                  <span className="iv-rec-dot" />
                  Interview Recording
                </h4>
                <video
                  src={selectedCandidate.recordingUrl}
                  controls
                  className="iv-recording-box__video"
                />
                <a
                  href={selectedCandidate.recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="iv-btn iv-btn--sm"
                  download
                >
                  Download Recording
                </a>
              </div>
            );
          })()}

          {selectedPhase === "coding" && question && (
            <div className="iv-solution-box">
              <h4>Expected Solution</h4>
              <pre>{question.solution}</pre>
              <p className="iv-muted">Optimal: {question.optimalComplexity}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
