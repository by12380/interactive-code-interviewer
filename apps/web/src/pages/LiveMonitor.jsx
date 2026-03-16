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
import "../styles/live-monitor.css";

const POLL_MS = 2000;
const CANDIDATE_POLL_MS = 3000;

const LANGUAGE_LABELS = {
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
};

const LANGUAGE_ICONS = {
  javascript: "JS",
  python: "PY",
  java: "JA",
  cpp: "C+",
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
    const cur = Number.isFinite(live?.behavioralQuestionIndex) ? live.behavioralQuestionIndex + 1 : null;
    const total = Number.isFinite(live?.behavioralTotalQuestions) ? live.behavioralTotalQuestions : null;
    if (cur && total) return { label: `Q${cur}/${total}`, percent: (cur / total) * 100 };
    return { label: "Starting", percent: 0 };
  }
  if (live?.codingQuestionTitle) return { label: live.codingQuestionTitle, percent: 50 };
  return { label: "Coding", percent: 25 };
}

function getStatusInfo(candidate, sessionFormat) {
  const live = candidate?.liveInterviewState;
  const status = live?.statusLabel || candidate?.status || "joined";
  const phase = getSelectedPhase(sessionFormat, candidate);

  if (status === "completed" || candidate?.status === "submitted")
    return { label: "Completed", color: "emerald", icon: "check" };
  if (status === "asking")
    return { label: "AI Asking", color: "amber", icon: "mic" };
  if (status === "answering")
    return { label: "Answering", color: "blue", icon: "voice" };
  if (phase === "behavioral")
    return { label: "Behavioral", color: "orange", icon: "chat" };
  if (status === "coding")
    return { label: "Coding", color: "indigo", icon: "code" };
  return { label: "Joined", color: "slate", icon: "user" };
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function getAvatarColor(name) {
  if (!name) return "#6366f1";
  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
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
  const [viewMode, setViewMode] = useState("detail"); // "grid" | "detail"
  const [showEndModal, setShowEndModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  useEffect(() => {
    getSession(sessionId).then((s) => {
      setSession(s);
      if (s.questionIds?.length) setCurrentQid(s.questionIds[0]);
    }).catch(() => {});
  }, [sessionId]);

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

  useEffect(() => {
    if (pollerRef.current) clearInterval(pollerRef.current);
    if (selectedPhase !== "coding") { setCode(""); return; }
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

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const sessionLanguage = session?.settings?.language || "javascript";
  const fmtTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const handleAnalyze = useCallback(async () => {
    if (!code.trim()) return;
    setAnalyzing(true);
    setAiAnalysis("");
    try {
      const data = await sendChat({
        messages: [{ role: "user", content: `Problem: ${question?.title}\n\nCode:\n${code}` }],
        mode: "chat",
      });
      setAiAnalysis(data.reply || "No analysis available.");
    } catch (e) {
      setAiAnalysis("Error: " + (e.message || "Analysis failed"));
    }
    setAnalyzing(false);
  }, [code, question]);

  const handleEndSession = async () => {
    await endSession(sessionId).catch(() => {});
    navigate(`/interviewer/results/${sessionId}`);
  };

  const activeCandidates = candidates.filter(c => {
    const s = c.liveInterviewState?.statusLabel || c.status;
    return s !== "completed" && s !== "submitted";
  });
  const completedCandidates = candidates.filter(c => {
    const s = c.liveInterviewState?.statusLabel || c.status;
    return s === "completed" || s === "submitted";
  });

  return (
    <div className="lm">
      {/* ── Top Command Bar ──────────────────────────────────── */}
      <header className="lm-topbar">
        <div className="lm-topbar__left">
          <button className="lm-topbar__back" onClick={() => navigate("/interviewer")} title="Back to Dashboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          </button>
          <div className="lm-topbar__title-group">
            <h1 className="lm-topbar__title">{session?.title || "Live Session"}</h1>
            <div className="lm-topbar__badges">
              <span className="lm-badge lm-badge--live">
                <span className="lm-badge__dot" />
                LIVE
              </span>
              <span className="lm-badge lm-badge--lang">{LANGUAGE_ICONS[sessionLanguage] || "JS"}</span>
            </div>
          </div>
        </div>

        <div className="lm-topbar__center">
          <div className="lm-stat-row">
            <div className="lm-stat">
              <span className="lm-stat__value">{candidates.length}</span>
              <span className="lm-stat__label">Candidates</span>
            </div>
            <div className="lm-stat-divider" />
            <div className="lm-stat">
              <span className="lm-stat__value">{activeCandidates.length}</span>
              <span className="lm-stat__label">Active</span>
            </div>
            <div className="lm-stat-divider" />
            <div className="lm-stat">
              <span className="lm-stat__value">{completedCandidates.length}</span>
              <span className="lm-stat__label">Done</span>
            </div>
            <div className="lm-stat-divider" />
            <div className="lm-stat">
              <span className="lm-stat__value lm-stat__value--time">{fmtTime(elapsed)}</span>
              <span className="lm-stat__label">Elapsed</span>
            </div>
          </div>
        </div>

        <div className="lm-topbar__right">
          <div className="lm-topbar__code-share">
            <span className="lm-topbar__code-label">Session Code</span>
            <span className="lm-topbar__code-value">{session?.shareCode || "..."}</span>
          </div>
          <div className="lm-topbar__view-toggle">
            <button
              className={`lm-view-btn ${viewMode === "detail" ? "lm-view-btn--active" : ""}`}
              onClick={() => setViewMode("detail")}
              title="Detail View"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            </button>
            <button
              className={`lm-view-btn ${viewMode === "grid" ? "lm-view-btn--active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Grid View"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
          </div>
          <button className="lm-btn lm-btn--end" onClick={() => setShowEndModal(true)}>
            End Session
          </button>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────── */}
      <div className="lm-body">
        {viewMode === "grid" ? (
          <GridView
            candidates={candidates}
            session={session}
            sessionId={sessionId}
            sessionLanguage={sessionLanguage}
            selectedCid={selectedCid}
            onSelectCandidate={(cid) => { setSelectedCid(cid); setViewMode("detail"); }}
          />
        ) : (
          <DetailView
            candidates={candidates}
            session={session}
            sessionId={sessionId}
            sessionLanguage={sessionLanguage}
            selectedCid={selectedCid}
            selectedCandidate={selectedCandidate}
            selectedPhase={selectedPhase}
            selectedLiveState={selectedLiveState}
            selectedQid={selectedQid}
            question={question}
            code={code}
            selectedResponses={selectedResponses}
            aiAnalysis={aiAnalysis}
            analyzing={analyzing}
            sidebarCollapsed={sidebarCollapsed}
            onSelectCandidate={setSelectedCid}
            onToggleSidebar={() => setSidebarCollapsed(p => !p)}
            onAnalyze={handleAnalyze}
            onSelectQuestion={setCurrentQid}
            fmtTime={fmtTime}
          />
        )}
      </div>

      {/* ── End Session Modal ────────────────────────────────── */}
      {showEndModal && (
        <div className="lm-modal-overlay" onClick={() => setShowEndModal(false)}>
          <div className="lm-modal" onClick={e => e.stopPropagation()}>
            <div className="lm-modal__icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <h2 className="lm-modal__title">End This Session?</h2>
            <p className="lm-modal__desc">
              This will end the session for all {candidates.length} candidate(s). An AI evaluation report will be generated automatically.
            </p>
            <div className="lm-modal__actions">
              <button className="lm-btn lm-btn--ghost" onClick={() => setShowEndModal(false)}>Cancel</button>
              <button className="lm-btn lm-btn--danger" onClick={handleEndSession}>End & Generate Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Grid View — Overview of all candidates at a glance
   ═══════════════════════════════════════════════════════════════════ */

function GridView({ candidates, session, sessionId, sessionLanguage, selectedCid, onSelectCandidate }) {
  if (candidates.length === 0) {
    return (
      <div className="lm-empty">
        <div className="lm-empty__icon">

          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h2>Waiting for Candidates</h2>
        <p>Share the session code with candidates to get started.</p>
        <div className="lm-empty__code">{session?.shareCode || "..."}</div>
      </div>
    );
  }

  return (
    <div className="lm-grid">
      {candidates.map(c => (
        <GridCard
          key={c.id}
          candidate={c}
          session={session}
          sessionId={sessionId}
          sessionLanguage={sessionLanguage}
          onClick={() => onSelectCandidate(c.id)}
        />
      ))}
    </div>
  );
}

function GridCard({ candidate, session, sessionId, sessionLanguage, onClick }) {
  const [code, setCode] = useState("");
  const phase = getSelectedPhase(session?.sessionFormat, candidate);
  const status = getStatusInfo(candidate, session?.sessionFormat);
  const progress = getCandidateProgress(candidate, session?.sessionFormat);
  const live = candidate?.liveInterviewState;

  useEffect(() => {
    if (phase !== "coding") return;
    const qid = live?.codingQuestionId || session?.questionIds?.[0];
    if (!qid) return;
    pullCode(sessionId, candidate.id, qid).then(d => {
      if (d?.code != null) setCode(d.code);
    }).catch(() => {});
    const t = setInterval(() => {
      pullCode(sessionId, candidate.id, qid).then(d => {
        if (d?.code != null) setCode(d.code);
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [sessionId, candidate.id, phase, live?.codingQuestionId, session?.questionIds]);

  return (
    <button className="lm-grid-card" onClick={onClick} type="button">
      <div className="lm-grid-card__header">
        <div className="lm-avatar lm-avatar--sm" style={{ background: getAvatarColor(candidate.displayName) }}>
          {getInitials(candidate.displayName)}
        </div>
        <div className="lm-grid-card__info">
          <span className="lm-grid-card__name">{candidate.displayName || candidate.id}</span>
          <span className={`lm-status-dot lm-status-dot--${status.color}`} />
        </div>
        <span className={`lm-phase-chip lm-phase-chip--${status.color}`}>{status.label}</span>
      </div>

      <div className="lm-grid-card__progress">
        <div className="lm-progress-bar">
          <div className="lm-progress-bar__fill" style={{ width: `${progress.percent}%` }} />
        </div>
        <span className="lm-grid-card__progress-label">{progress.label}</span>
      </div>

      {phase === "coding" && code ? (
        <div className="lm-grid-card__code-preview">
          <pre>{code.slice(0, 300)}</pre>
        </div>
      ) : phase === "behavioral" ? (
        <div className="lm-grid-card__behavioral-preview">
          <p>{live?.behavioralQuestionText?.slice(0, 120) || "Behavioral interview in progress..."}</p>
        </div>
      ) : (
        <div className="lm-grid-card__waiting">
          <span>Waiting for activity...</span>
        </div>
      )}

      {candidate.recordingUrl && (
        <div className="lm-grid-card__rec-badge">
          <span className="lm-rec-dot" /> REC
        </div>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Detail View — Deep dive into a single candidate
   ═══════════════════════════════════════════════════════════════════ */

function DetailView({
  candidates, session, sessionId, sessionLanguage,
  selectedCid, selectedCandidate, selectedPhase, selectedLiveState,
  selectedQid, question, code, selectedResponses,
  aiAnalysis, analyzing, sidebarCollapsed,
  onSelectCandidate, onToggleSidebar, onAnalyze, onSelectQuestion, fmtTime,
}) {
  if (candidates.length === 0) {
    return (
      <div className="lm-empty">
        <div className="lm-empty__icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <h2>Waiting for Candidates</h2>
        <p>Share the session code with candidates to get started.</p>
        <div className="lm-empty__code">{session?.shareCode || "..."}</div>
      </div>
    );
  }

  return (
    <div className="lm-detail">
      {/* Candidate Sidebar */}
      <aside className={`lm-sidebar ${sidebarCollapsed ? "lm-sidebar--collapsed" : ""}`}>
        <div className="lm-sidebar__header">
          {!sidebarCollapsed && <h3 className="lm-sidebar__title">Candidates</h3>}
          <button className="lm-sidebar__toggle" onClick={onToggleSidebar} title={sidebarCollapsed ? "Expand" : "Collapse"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {sidebarCollapsed
                ? <><path d="M9 18l6-6-6-6"/></>
                : <><path d="M15 18l-6-6 6-6"/></>
              }
            </svg>
          </button>
        </div>

        <div className="lm-sidebar__list">
          {candidates.map(c => {
            const status = getStatusInfo(c, session?.sessionFormat);
            const progress = getCandidateProgress(c, session?.sessionFormat);
            const isActive = c.id === selectedCid;

            return (
              <button
                key={c.id}
                className={`lm-cand-card ${isActive ? "lm-cand-card--active" : ""}`}
                onClick={() => onSelectCandidate(c.id)}
                type="button"
              >
                <div className="lm-avatar lm-avatar--xs" style={{ background: getAvatarColor(c.displayName) }}>
                  {getInitials(c.displayName)}
                </div>
                {!sidebarCollapsed && (
                  <div className="lm-cand-card__body">
                    <div className="lm-cand-card__row">
                      <span className="lm-cand-card__name">{c.displayName || c.id}</span>
                      <span className={`lm-status-dot lm-status-dot--${status.color}`} />
                    </div>
                    <div className="lm-cand-card__row">
                      <span className={`lm-phase-chip lm-phase-chip--sm lm-phase-chip--${status.color}`}>{status.label}</span>
                    </div>
                    <div className="lm-cand-card__progress-bar">
                      <div className="lm-progress-bar lm-progress-bar--thin">
                        <div className="lm-progress-bar__fill" style={{ width: `${progress.percent}%` }} />
                      </div>
                    </div>
                    {c.recordingUrl && (
                      <span className="lm-cand-card__rec">
                        <span className="lm-rec-dot" /> Recorded
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Question List */}
        {!sidebarCollapsed && (session?.questionIds || []).length > 0 && (
          <div className="lm-sidebar__questions">
            <h4 className="lm-sidebar__section-title">Questions</h4>
            {(session?.questionIds || []).map(qid => {
              const q = QUESTION_BANK.find(x => x.id === qid);
              return (
                <button
                  key={qid}
                  className={`lm-q-chip ${qid === selectedQid ? "lm-q-chip--active" : ""}`}
                  onClick={() => onSelectQuestion(qid)}
                  type="button"
                >
                  {q?.title || qid}
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="lm-main">
        {/* Candidate Header Strip */}
        {selectedCandidate && (
          <div className="lm-candidate-strip">
            <div className="lm-candidate-strip__left">
              <div className="lm-avatar lm-avatar--md" style={{ background: getAvatarColor(selectedCandidate.displayName) }}>
                {getInitials(selectedCandidate.displayName)}
              </div>
              <div className="lm-candidate-strip__info">
                <h2 className="lm-candidate-strip__name">{selectedCandidate.displayName || selectedCandidate.id}</h2>
                <div className="lm-candidate-strip__meta">
                  <span className={`lm-phase-chip lm-phase-chip--${getStatusInfo(selectedCandidate, session?.sessionFormat).color}`}>
                    {getStatusInfo(selectedCandidate, session?.sessionFormat).label}
                  </span>
                  <span className="lm-candidate-strip__detail">
                    {selectedPhase === "behavioral"
                      ? `Behavioral Q${(selectedLiveState?.behavioralQuestionIndex ?? 0) + 1}/${selectedLiveState?.behavioralTotalQuestions || "?"}`
                      : question?.title || selectedQid || "Coding Session"
                    }
                  </span>
                </div>
              </div>
            </div>
            <div className="lm-candidate-strip__right">
              {selectedCandidate.recordingUrl && (
                <a href={selectedCandidate.recordingUrl} target="_blank" rel="noopener noreferrer" className="lm-btn lm-btn--sm lm-btn--ghost" download>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Recording
                </a>
              )}
            </div>
          </div>
        )}

        {/* Phase Content */}
        <div className="lm-content">
          {selectedPhase === "behavioral" ? (
            <BehavioralView
              selectedLiveState={selectedLiveState}
              selectedResponses={selectedResponses}
              selectedCandidate={selectedCandidate}
            />
          ) : (
            <CodingView
              code={code}
              sessionLanguage={sessionLanguage}
              question={question}
              selectedQid={selectedQid}
              aiAnalysis={aiAnalysis}
              analyzing={analyzing}
              onAnalyze={onAnalyze}
              selectedCandidate={selectedCandidate}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Behavioral Phase View ─────────────────────────────────────── */

function BehavioralView({ selectedLiveState, selectedResponses, selectedCandidate }) {
  return (
    <div className="lm-behavioral">
      <div className="lm-behavioral__current">
        <div className="lm-card">
          <div className="lm-card__header">
            <div className="lm-card__header-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Current Question</span>
            </div>
            {selectedLiveState?.behavioralTotalQuestions && (
              <span className="lm-card__counter">
                {(selectedLiveState?.behavioralQuestionIndex ?? 0) + 1} of {selectedLiveState.behavioralTotalQuestions}
              </span>
            )}
          </div>
          <p className="lm-behavioral__question-text">
            {selectedLiveState?.behavioralQuestionText || "Waiting for the next question..."}
          </p>
          <div className="lm-behavioral__status-row">
            {selectedLiveState?.statusLabel === "asking" && (
              <span className="lm-activity-indicator lm-activity-indicator--amber">
                <span className="lm-activity-indicator__pulse" />
                AI is speaking
              </span>
            )}
            {selectedLiveState?.statusLabel === "answering" && (
              <span className="lm-activity-indicator lm-activity-indicator--blue">
                <span className="lm-activity-indicator__pulse" />
                Candidate is answering
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="lm-behavioral__answers">
        <div className="lm-card">
          <div className="lm-card__header">
            <div className="lm-card__header-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>Completed Answers</span>
            </div>
            <span className="lm-card__counter">{selectedResponses.length}</span>
          </div>
          {selectedResponses.length === 0 ? (
            <div className="lm-behavioral__empty">
              <p>No finalized answers yet. They will appear here as the candidate completes each question.</p>
            </div>
          ) : (
            <div className="lm-behavioral__answer-list">
              {selectedResponses.map((r, i) => (
                <div key={r.questionId || `${selectedCandidate?.id}-${i}`} className="lm-answer-card">
                  <div className="lm-answer-card__header">
                    <span className="lm-answer-card__index">Q{(r.questionIndex ?? i) + 1}</span>
                    {r.category && <span className="lm-answer-card__category">{r.category}</span>}
                  </div>
                  <p className="lm-answer-card__question">{r.question || `Question ${i + 1}`}</p>
                  <p className="lm-answer-card__text">{r.answer || "No answer recorded."}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Coding Phase View ─────────────────────────────────────────── */

function CodingView({ code, sessionLanguage, question, selectedQid, aiAnalysis, analyzing, onAnalyze, selectedCandidate }) {
  return (
    <div className="lm-coding">
      <div className="lm-coding__editor-area">
        <div className="lm-coding__editor-header">
          <div className="lm-coding__editor-header-left">
            <span className="lm-coding__file-tab">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              {question?.title || selectedQid || "Code Editor"}
            </span>
            {question?.difficulty && (
              <span className={`lm-diff-badge lm-diff-badge--${question.difficulty.toLowerCase()}`}>
                {question.difficulty}
              </span>
            )}
          </div>
          <span className="lm-coding__readonly-badge">READ ONLY</span>
        </div>
        <div className="lm-coding__editor-body">
          <Editor
            height="100%"
            defaultLanguage={sessionLanguage === "cpp" ? "cpp" : sessionLanguage}
            language={sessionLanguage === "cpp" ? "cpp" : sessionLanguage}
            theme="monitor-dark"
            value={code}
            beforeMount={(monaco) => {
              monaco.editor.defineTheme("monitor-dark", {
                base: "vs-dark",
                inherit: true,
                rules: [
                  { token: "", foreground: "e2e8f0", background: "0f172a" },
                  { token: "comment", foreground: "64748b", fontStyle: "italic" },
                  { token: "keyword", foreground: "c084fc" },
                  { token: "string", foreground: "86efac" },
                  { token: "number", foreground: "fdba74" },
                  { token: "function", foreground: "93c5fd" },
                  { token: "operator", foreground: "67e8f9" },
                  { token: "type", foreground: "fca5a5" },
                ],
                colors: {
                  "editor.background": "#0f172a",
                  "editor.foreground": "#e2e8f0",
                  "editor.lineHighlightBackground": "#1e293b",
                  "editor.lineHighlightBorder": "#00000000",
                  "editorCursor.foreground": "#c084fc",
                  "editorLineNumber.foreground": "#475569",
                  "editorLineNumber.activeForeground": "#94a3b8",
                  "scrollbar.shadow": "#00000000",
                  "editor.selectionBackground": "#334155",
                },
              });
            }}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
              fontLigatures: true,
              padding: { top: 16, bottom: 16 },
              lineHeight: 22,
              smoothScrolling: true,
              overviewRulerBorder: false,
              scrollbar: { verticalScrollbarSize: 6, useShadows: false },
              renderLineHighlight: "gutter",
            }}
          />
        </div>
      </div>

      <div className="lm-coding__panel">
        <div className="lm-card lm-card--dark">
          <div className="lm-card__header">
            <div className="lm-card__header-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>AI Analysis</span>
            </div>
          </div>
          <button
            className="lm-btn lm-btn--primary lm-btn--full"
            onClick={onAnalyze}
            disabled={analyzing || !code.trim()}
          >
            {analyzing ? (
              <>
                <span className="lm-spinner" />
                Analyzing...
              </>
            ) : "Analyze Code"}
          </button>
          {aiAnalysis && (
            <div className="lm-analysis-result">
              <pre>{aiAnalysis}</pre>
            </div>
          )}
        </div>

        {question?.solution && (
          <div className="lm-card lm-card--dark">
            <div className="lm-card__header">
              <div className="lm-card__header-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Expected Solution</span>
              </div>
            </div>
            <div className="lm-solution-preview">
              <pre>{question.solution}</pre>
            </div>
            {question.optimalComplexity && (
              <div className="lm-complexity-badge">
                Optimal: {question.optimalComplexity}
              </div>
            )}
          </div>
        )}

        {selectedCandidate?.recordingUrl && (
          <div className="lm-card lm-card--dark">
            <div className="lm-card__header">
              <div className="lm-card__header-left">
                <span className="lm-rec-dot" />
                <span>Recording</span>
              </div>
            </div>
            <video
              src={selectedCandidate.recordingUrl}
              controls
              className="lm-recording-video"
            />
          </div>
        )}
      </div>
    </div>
  );
}
