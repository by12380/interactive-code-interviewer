// SessionResults – Comprehensive report view with ranked candidates, detailed breakdown,
// leaderboard for multi-candidate sessions, and email delivery for the interviewer.

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getSession,
  getCandidates,
  getReport,
  generateReport,
  sendReport,
  getLeaderboard,
  generateLeaderboard,
} from "../services/sessionService.js";
import { QUESTION_BANK } from "../data/questionBank.js";
import "../styles/interviewer.css";

const REC_COLORS = {
  "Strong Hire": "#059669",
  "Hire": "#10b981",
  "Lean Hire": "#f59e0b",
  "Lean No Hire": "#f97316",
  "No Hire": "#dc2626",
};

function ScoreBar({ value, max, label }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const color = pct >= 70 ? "#059669" : pct >= 40 ? "#f59e0b" : "#dc2626";
  return (
    <div className="iv-score-bar">
      <div className="iv-score-bar__label">
        <span>{label}</span>
        <span>{value}/{max}</span>
      </div>
      <div className="iv-score-bar__track">
        <div className="iv-score-bar__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function RankBadge({ rank }) {
  const colors = ["#4f46e5", "#7c3aed", "#8b5cf6"];
  const bg = colors[rank - 1] || "#64748b";
  const medals = { 1: "\u{1F947}", 2: "\u{1F948}", 3: "\u{1F949}" };
  return (
    <span className="iv-rank-badge" style={{ background: bg }}>
      {medals[rank] || `#${rank}`}
    </span>
  );
}

function ScoreCircle({ score, size = 80 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score, 100) / 100;
  const offset = circumference * (1 - pct);
  const color = score >= 70 ? "#059669" : score >= 40 ? "#f59e0b" : "#dc2626";

  return (
    <div className="iv-score-circle" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <span className="iv-score-circle__value">{score}</span>
    </div>
  );
}

export default function SessionResults() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [report, setReport] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingLb, setGeneratingLb] = useState(false);
  const [selectedCid, setSelectedCid] = useState(null);
  const [activeTab, setActiveTab] = useState("report");

  // Email state
  const [emailTo, setEmailTo] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  useEffect(() => {
    Promise.all([
      getSession(sessionId),
      getCandidates(sessionId),
      getReport(sessionId),
      getLeaderboard(sessionId).catch(() => null),
    ])
      .then(([s, c, r, lb]) => {
        setSession(s);
        setCandidates(c);
        setReport(r?.report || null);
        if (lb?.leaderboard) setLeaderboard(lb);
        if (s?.interviewerEmail) setEmailTo(s.interviewerEmail);

        // If session is completed but no report yet, poll for it
        if (s?.status === "completed" && !r?.report) {
          const poller = setInterval(async () => {
            try {
              const fresh = await getReport(sessionId);
              if (fresh?.report) {
                setReport(fresh.report);
                const freshCandidates = await getCandidates(sessionId);
                setCandidates(freshCandidates);
                clearInterval(poller);
                // Also try to fetch leaderboard
                try {
                  const freshLb = await getLeaderboard(sessionId);
                  if (freshLb?.leaderboard) setLeaderboard(freshLb);
                } catch { /* ignore */ }
              }
            } catch { /* ignore */ }
          }, 5000);
          return () => clearInterval(poller);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await generateReport(sessionId);
      setReport(data.report);
      const c = await getCandidates(sessionId);
      setCandidates(c);
      // Auto-generate leaderboard if multiple candidates
      if (c.length >= 2) {
        try {
          const lb = await generateLeaderboard(sessionId);
          setLeaderboard(lb);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    setGenerating(false);
  };

  const handleGenerateLeaderboard = async () => {
    setGeneratingLb(true);
    try {
      const lb = await generateLeaderboard(sessionId);
      setLeaderboard(lb);
    } catch { /* ignore */ }
    setGeneratingLb(false);
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      await sendReport(sessionId, emailTo);
      setSendResult({ ok: true, msg: `Report sent to ${emailTo}` });
    } catch (e) {
      setSendResult({ ok: false, msg: e.message || "Failed to send email" });
    }
    setSending(false);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify({ session, candidates, report, leaderboard }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionId}-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const rankings = report?.rankings || [];
    const rows = [["Rank", "Candidate", "Overall Score", "Recommendation", "Strengths", "Weaknesses"]];
    rankings.forEach((r) => {
      const strengths = Array.isArray(r.strengths) ? r.strengths.join("; ") : r.strengths;
      const weaknesses = Array.isArray(r.weaknesses) ? r.weaknesses.join("; ") : r.weaknesses;
      rows.push([r.rank, r.displayName || r.candidateId, r.overallScore || "", r.recommendation || "", strengths || "", weaknesses || ""]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionId}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="iv-dashboard"><p className="iv-muted">Loading results...</p></div>;

  const rankings = report?.rankings || [];
  const lbEntries = leaderboard?.leaderboard || [];
  const hasMultipleCandidates = candidates.length >= 2;
  const selectedRanking = rankings.find((r) => r.candidateId === selectedCid);
  const selectedCandidate = candidates.find((c) => c.id === selectedCid);

  return (
    <div className="iv-dashboard">
      <header className="iv-header">
        <h1>Results: {session?.title || "Session"}</h1>
        <div className="iv-header__actions">
          <button className="iv-btn iv-btn--sm" onClick={() => navigate("/interviewer")}>Dashboard</button>
        </div>
      </header>

      {/* Auto-generating indicator */}
      {!report && !generating && session?.status === "completed" && (
        <section className="iv-section">
          <div className="iv-generating-box">
            <div className="iv-spinner" />
            <p>AI report is being generated in the background. This page will update automatically...</p>
          </div>
        </section>
      )}

      {/* Tab Navigation — only show when report exists */}
      {report && (
        <section className="iv-section">
          <div className="iv-results-tabs">
            <button
              className={`iv-results-tab ${activeTab === "report" ? "iv-results-tab--active" : ""}`}
              onClick={() => setActiveTab("report")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Full Report
            </button>
            {hasMultipleCandidates && (
              <button
                className={`iv-results-tab ${activeTab === "leaderboard" ? "iv-results-tab--active" : ""}`}
                onClick={() => setActiveTab("leaderboard")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
                </svg>
                Leaderboard
              </button>
            )}
            <button
              className={`iv-results-tab ${activeTab === "details" ? "iv-results-tab--active" : ""}`}
              onClick={() => setActiveTab("details")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Candidate Details
            </button>
          </div>
        </section>
      )}

      {/* Generate / Export / Email */}
      <section className="iv-section">
        <div className="iv-row" style={{ alignItems: "flex-end", gap: 12 }}>
          {!report ? (
            <button className="iv-btn iv-btn--primary" onClick={handleGenerate} disabled={generating}>
              {generating ? "Generating Report..." : "Generate AI Report"}
            </button>
          ) : (
            <>
              <button className="iv-btn iv-btn--sm" onClick={handleExportJSON}>Export JSON</button>
              <button className="iv-btn iv-btn--sm" onClick={handleExportCSV}>Export CSV</button>
              <button className="iv-btn iv-btn--sm iv-btn--primary" onClick={handleGenerate} disabled={generating}>
                {generating ? "Re-generating..." : "Re-generate Report"}
              </button>
            </>
          )}
        </div>
      </section>

      {generating && (
        <section className="iv-section">
          <div className="iv-generating-box">
            <div className="iv-spinner" />
            <p>AI is evaluating all candidates and generating a comprehensive report. This may take a moment...</p>
          </div>
        </section>
      )}

      {/* Email Section */}
      {report && (
        <section className="iv-section">
          <div className="iv-email-box">
            <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Send Report via Email</h3>
            <div className="iv-row" style={{ alignItems: "center", gap: 8 }}>
              <input
                className="iv-input"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="interviewer@company.com"
                style={{ marginBottom: 0, maxWidth: 320 }}
              />
              <button className="iv-btn iv-btn--primary iv-btn--sm" onClick={handleSendEmail} disabled={sending || !emailTo.trim()}>
                {sending ? "Sending..." : "Send Report"}
              </button>
            </div>
            {sendResult && (
              <p style={{ marginTop: 8, fontSize: "0.85rem", color: sendResult.ok ? "#059669" : "#dc2626" }}>
                {sendResult.msg}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         TAB: Full Report
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "report" && (
        <>
          {/* Session Summary */}
          {report?.sessionSummary && (
            <section className="iv-section">
              <div className="iv-report-summary">
                <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>{report.reportTitle || "Interview Report"}</h2>
                <p className="iv-muted" style={{ margin: "0 0 8px", fontSize: "0.82rem" }}>
                  Generated on {new Date(report.generatedAt).toLocaleString()}
                </p>
                <div className="iv-summary-stats">
                  <div className="iv-stat">
                    <span className="iv-stat__number">{report.sessionSummary.totalCandidates || 0}</span>
                    <span className="iv-stat__label">Candidates</span>
                  </div>
                  <div className="iv-stat">
                    <span className="iv-stat__number">{(report.sessionSummary.questionsUsed || []).length}</span>
                    <span className="iv-stat__label">Questions</span>
                  </div>
                  <div className="iv-stat">
                    <span className="iv-stat__number">{report.sessionSummary.overallDifficulty || "\u2014"}</span>
                    <span className="iv-stat__label">Difficulty</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Rankings */}
          {rankings.length > 0 && (
            <section className="iv-section">
              <h2>Candidate Rankings</h2>
              <div className="iv-rankings-grid">
                {rankings.map((r) => {
                  const recColor = REC_COLORS[r.recommendation] || "#64748b";
                  const isSelected = r.candidateId === selectedCid;
                  return (
                    <div
                      key={r.candidateId || r.rank}
                      className={`iv-ranking-card ${isSelected ? "iv-ranking-card--selected" : ""}`}
                      onClick={() => setSelectedCid(isSelected ? null : r.candidateId)}
                    >
                      <div className="iv-ranking-card__header">
                        <RankBadge rank={r.rank} />
                        <div className="iv-ranking-card__name">
                          <h3>{r.displayName || r.candidateId}</h3>
                          <span className="iv-rec-badge" style={{ background: recColor }}>
                            {r.recommendation}
                          </span>
                        </div>
                        <div className="iv-ranking-card__score">
                          <ScoreCircle score={r.overallScore || 0} />
                        </div>
                      </div>

                      <div className="iv-ranking-card__body">
                        <div className="iv-ranking-card__col">
                          <h4 className="iv-strengths-title">Strengths</h4>
                          <ul className="iv-trait-list iv-trait-list--green">
                            {(Array.isArray(r.strengths) ? r.strengths : [r.strengths]).map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="iv-ranking-card__col">
                          <h4 className="iv-weaknesses-title">Areas to Improve</h4>
                          <ul className="iv-trait-list iv-trait-list--red">
                            {(Array.isArray(r.weaknesses) ? r.weaknesses : [r.weaknesses]).map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Per-question detail (expandable) */}
                      {isSelected && r.perQuestion?.length > 0 && (
                        <div className="iv-ranking-card__detail">
                          <h4 style={{ margin: "12px 0 8px", fontSize: "0.85rem", color: "#64748b", textTransform: "uppercase" }}>
                            Per-Question Breakdown
                          </h4>
                          <div className="iv-detail-grid">
                            {r.perQuestion.map((pq) => (
                              <div key={pq.questionId} className="iv-detail-card">
                                <h4>{pq.questionTitle || pq.questionId}</h4>
                                <div className="iv-detail-scores">
                                  <ScoreBar value={pq.correctness} max={40} label="Correctness" />
                                  <ScoreBar value={pq.efficiency} max={25} label="Efficiency" />
                                  <ScoreBar value={pq.codeQuality} max={20} label="Code Quality" />
                                  <ScoreBar value={pq.communication} max={15} label="Communication" />
                                </div>
                                <div className="iv-detail-total">
                                  Total: <strong>{pq.total}/100</strong>
                                </div>
                                {pq.feedback && <p className="iv-detail-feedback">{pq.feedback}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="iv-ranking-card__expand">
                        {isSelected ? "Click to collapse" : "Click for details"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Comparative Analysis */}
          {report?.comparativeAnalysis && (
            <section className="iv-section">
              <h2>Comparative Analysis</h2>
              <div className="iv-summary-box">{report.comparativeAnalysis}</div>
            </section>
          )}

          {report?.bestApproach && (
            <section className="iv-section">
              <h2>Best Approach</h2>
              <div className="iv-best-approach-box">{report.bestApproach}</div>
            </section>
          )}

          {/* Hiring Recommendation */}
          {report?.hiringRecommendation && (
            <section className="iv-section">
              <div className="iv-hiring-rec">
                <h2>Hiring Recommendation</h2>
                <p>{report.hiringRecommendation}</p>
              </div>
            </section>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         TAB: Leaderboard (multi-candidate)
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "leaderboard" && hasMultipleCandidates && (
        <>
          {!lbEntries.length && !generatingLb && (
            <section className="iv-section">
              <div className="iv-lb-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c7d2fe" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
                </svg>
                <h3>Leaderboard Not Generated Yet</h3>
                <p>Generate an AI-powered leaderboard to rank all {candidates.length} candidates with detailed reasoning.</p>
                <button className="iv-btn iv-btn--primary" onClick={handleGenerateLeaderboard} disabled={generatingLb}>
                  Generate Leaderboard
                </button>
              </div>
            </section>
          )}

          {generatingLb && (
            <section className="iv-section">
              <div className="iv-generating-box">
                <div className="iv-spinner" />
                <p>AI is ranking candidates and generating detailed reasoning. This may take a moment...</p>
              </div>
            </section>
          )}

          {lbEntries.length > 0 && (
            <>
              {/* Ranking Rationale */}
              {leaderboard?.rankingRationale && (
                <section className="iv-section">
                  <div className="iv-lb-rationale">
                    <div className="iv-lb-rationale__icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ margin: "0 0 6px", fontSize: "0.95rem", color: "#3730a3" }}>AI Ranking Rationale</h3>
                      <p style={{ margin: 0, fontSize: "0.9rem", color: "#334155", lineHeight: 1.6 }}>
                        {leaderboard.rankingRationale}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* Podium for top 3 */}
              {lbEntries.length >= 2 && (
                <section className="iv-section">
                  <div className="iv-lb-podium">
                    {lbEntries.length >= 2 && (
                      <div className="iv-lb-podium__place iv-lb-podium__place--2">
                        <div className="iv-lb-podium__avatar">
                          {(lbEntries[1].displayName || "?").charAt(0).toUpperCase()}
                        </div>
                        <span className="iv-lb-podium__name">{lbEntries[1].displayName}</span>
                        <span className="iv-lb-podium__score">{lbEntries[1].overallScore}/100</span>
                        <div className="iv-lb-podium__bar iv-lb-podium__bar--2">
                          <span className="iv-lb-podium__medal">{"\u{1F948}"}</span>
                        </div>
                      </div>
                    )}
                    <div className="iv-lb-podium__place iv-lb-podium__place--1">
                      <div className="iv-lb-podium__crown">{"\u{1F451}"}</div>
                      <div className="iv-lb-podium__avatar iv-lb-podium__avatar--gold">
                        {(lbEntries[0].displayName || "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="iv-lb-podium__name">{lbEntries[0].displayName}</span>
                      <span className="iv-lb-podium__score">{lbEntries[0].overallScore}/100</span>
                      <div className="iv-lb-podium__bar iv-lb-podium__bar--1">
                        <span className="iv-lb-podium__medal">{"\u{1F947}"}</span>
                      </div>
                    </div>
                    {lbEntries.length >= 3 && (
                      <div className="iv-lb-podium__place iv-lb-podium__place--3">
                        <div className="iv-lb-podium__avatar">
                          {(lbEntries[2].displayName || "?").charAt(0).toUpperCase()}
                        </div>
                        <span className="iv-lb-podium__name">{lbEntries[2].displayName}</span>
                        <span className="iv-lb-podium__score">{lbEntries[2].overallScore}/100</span>
                        <div className="iv-lb-podium__bar iv-lb-podium__bar--3">
                          <span className="iv-lb-podium__medal">{"\u{1F949}"}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Full leaderboard table with reasoning */}
              <section className="iv-section">
                <h2>Detailed Rankings</h2>
                <div className="iv-lb-list">
                  {lbEntries.map((entry) => {
                    const recColor = REC_COLORS[entry.recommendation] || "#64748b";
                    const isExpanded = entry.candidateId === selectedCid;
                    return (
                      <div
                        key={entry.candidateId || entry.rank}
                        className={`iv-lb-card ${isExpanded ? "iv-lb-card--expanded" : ""}`}
                        onClick={() => setSelectedCid(isExpanded ? null : entry.candidateId)}
                      >
                        <div className="iv-lb-card__header">
                          <RankBadge rank={entry.rank} />
                          <div className="iv-lb-card__info">
                            <h3>{entry.displayName || entry.candidateId}</h3>
                            <span className="iv-rec-badge" style={{ background: recColor }}>
                              {entry.recommendation}
                            </span>
                          </div>
                          <ScoreCircle score={entry.overallScore || 0} size={64} />
                        </div>

                        {/* AI Reasoning for this rank */}
                        {entry.rankReason && (
                          <div className="iv-lb-card__reason">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            <p>{entry.rankReason}</p>
                          </div>
                        )}

                        {entry.codeHighlights && (
                          <div className="iv-lb-card__highlights">
                            <strong>Code Highlights:</strong> {entry.codeHighlights}
                          </div>
                        )}

                        <div className="iv-lb-card__traits">
                          <div className="iv-lb-card__trait-col">
                            <h4 className="iv-strengths-title">Strengths</h4>
                            <ul className="iv-trait-list iv-trait-list--green">
                              {(Array.isArray(entry.strengths) ? entry.strengths : [entry.strengths]).map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="iv-lb-card__trait-col">
                            <h4 className="iv-weaknesses-title">Areas to Improve</h4>
                            <ul className="iv-trait-list iv-trait-list--red">
                              {(Array.isArray(entry.weaknesses) ? entry.weaknesses : [entry.weaknesses]).map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Expandable per-question breakdown */}
                        {isExpanded && entry.perQuestion?.length > 0 && (
                          <div className="iv-lb-card__questions">
                            <h4 style={{ margin: "12px 0 8px", fontSize: "0.85rem", color: "#64748b", textTransform: "uppercase" }}>
                              Per-Question Breakdown
                            </h4>
                            {entry.perQuestion.map((pq) => (
                              <div key={pq.questionId} className="iv-detail-card">
                                <h4>{pq.questionTitle || pq.questionId}</h4>
                                <div className="iv-detail-scores">
                                  <ScoreBar value={pq.correctness} max={40} label="Correctness" />
                                  <ScoreBar value={pq.efficiency} max={25} label="Efficiency" />
                                  <ScoreBar value={pq.codeQuality} max={20} label="Code Quality" />
                                  <ScoreBar value={pq.communication} max={15} label="Communication" />
                                </div>
                                <div className="iv-detail-total">
                                  Total: <strong>{pq.total}/100</strong>
                                </div>
                                {pq.feedback && <p className="iv-detail-feedback">{pq.feedback}</p>}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="iv-ranking-card__expand">
                          {isExpanded ? "Click to collapse" : "Click for question breakdown"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Comparative Analysis */}
              {leaderboard?.comparativeAnalysis && (
                <section className="iv-section">
                  <h2>Comparative Analysis</h2>
                  <div className="iv-summary-box">{leaderboard.comparativeAnalysis}</div>
                </section>
              )}

              {leaderboard?.bestApproach && (
                <section className="iv-section">
                  <h2>Best Approach</h2>
                  <div className="iv-best-approach-box">{leaderboard.bestApproach}</div>
                </section>
              )}

              {leaderboard?.hiringRecommendation && (
                <section className="iv-section">
                  <div className="iv-hiring-rec">
                    <h2>Hiring Recommendation</h2>
                    <p>{leaderboard.hiringRecommendation}</p>
                  </div>
                </section>
              )}

              <section className="iv-section">
                <div style={{ textAlign: "center" }}>
                  <button className="iv-btn iv-btn--sm" onClick={handleGenerateLeaderboard} disabled={generatingLb}>
                    {generatingLb ? "Re-generating..." : "Re-generate Leaderboard"}
                  </button>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         TAB: Candidate Details
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "details" && (
        <>
          <section className="iv-section">
            <h2>Select a Candidate</h2>
            <div className="iv-rankings-grid">
              {candidates.map((c) => {
                const ranking = rankings.find((r) => r.candidateId === c.id);
                const isSelected = c.id === selectedCid;
                return (
                  <div
                    key={c.id}
                    className={`iv-ranking-card ${isSelected ? "iv-ranking-card--selected" : ""}`}
                    onClick={() => setSelectedCid(isSelected ? null : c.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="iv-ranking-card__header">
                      {ranking && <RankBadge rank={ranking.rank} />}
                      <div className="iv-ranking-card__name">
                        <h3>{c.displayName || c.id}</h3>
                        <span className="iv-muted" style={{ fontSize: "0.78rem" }}>
                          Joined: {c.joinedAt ? new Date(c.joinedAt).toLocaleString() : "—"}
                        </span>
                      </div>
                      {ranking && (
                        <div className="iv-ranking-card__score">
                          <ScoreCircle score={ranking.overallScore || 0} size={56} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Detailed breakdown for selected candidate */}
          {selectedCid && (
            <section className="iv-section">
              <h2>Detailed Breakdown: {selectedRanking?.displayName || selectedCandidate?.displayName || selectedCid}</h2>

              {selectedRanking?.perQuestion?.length > 0 && (
                <div className="iv-detail-grid">
                  {selectedRanking.perQuestion.map((pq) => (
                    <div key={pq.questionId} className="iv-detail-card">
                      <h4>{pq.questionTitle || pq.questionId}</h4>
                      <div className="iv-detail-scores">
                        <ScoreBar value={pq.correctness} max={40} label="Correctness" />
                        <ScoreBar value={pq.efficiency} max={25} label="Efficiency" />
                        <ScoreBar value={pq.codeQuality} max={20} label="Code Quality" />
                        <ScoreBar value={pq.communication} max={15} label="Communication" />
                      </div>
                      <div className="iv-detail-total">
                        Total: <strong>{pq.total}/100</strong>
                      </div>
                      {pq.feedback && <p className="iv-detail-feedback">{pq.feedback}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Fallback: evaluation from candidate doc */}
              {selectedCandidate?.evaluation && !selectedRanking?.perQuestion?.length && (
                <div className="iv-eval-detail">
                  {Object.entries(selectedCandidate.evaluation).map(([qid, ev]) => {
                    const q = QUESTION_BANK.find((x) => x.id === qid);
                    return (
                      <div key={qid} className="iv-eval-card">
                        <h4>{q?.title || qid}</h4>
                        <div className="iv-detail-scores">
                          <ScoreBar value={ev.correctness ?? 0} max={40} label="Correctness" />
                          <ScoreBar value={ev.efficiency ?? 0} max={25} label="Efficiency" />
                          <ScoreBar value={ev.codeQuality ?? 0} max={20} label="Code Quality" />
                          <ScoreBar value={ev.communication ?? 0} max={15} label="Communication" />
                        </div>
                        <div className="iv-detail-total">
                          Total: <strong>{ev.total ?? "\u2014"}/100</strong>
                        </div>
                        {ev.feedback && <p className="iv-detail-feedback">{ev.feedback}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Behavioral evaluation */}
              {selectedCandidate?.behavioralEvaluation && (
                <div style={{ marginTop: 20 }}>
                  <h3>Behavioral Interview Evaluation</h3>
                  {selectedCandidate.behavioralEvaluation.summary && (
                    <div className="iv-summary-box" style={{ marginBottom: 12 }}>
                      {selectedCandidate.behavioralEvaluation.summary}
                    </div>
                  )}
                  {selectedCandidate.behavioralEvaluation.overallScore != null && (
                    <p style={{ fontSize: "0.9rem", marginBottom: 12 }}>
                      Behavioral Score: <strong>{selectedCandidate.behavioralEvaluation.overallScore}/100</strong>
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
