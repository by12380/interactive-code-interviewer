// SessionResults – Comprehensive report view with ranked candidates, detailed breakdown,
// and email delivery for the interviewer.

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getSession,
  getCandidates,
  getReport,
  generateReport,
  sendReport,
  getEvaluation,
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
  return (
    <span className="iv-rank-badge" style={{ background: bg }}>
      #{rank}
    </span>
  );
}

export default function SessionResults() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedCid, setSelectedCid] = useState(null);

  // Email state
  const [emailTo, setEmailTo] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  useEffect(() => {
    Promise.all([
      getSession(sessionId),
      getCandidates(sessionId),
      getReport(sessionId),
    ])
      .then(([s, c, r]) => {
        setSession(s);
        setCandidates(c);
        setReport(r?.report || null);
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
      // Refresh candidates to get updated evaluations
      const c = await getCandidates(sessionId);
      setCandidates(c);
    } catch { /* ignore */ }
    setGenerating(false);
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
    const blob = new Blob([JSON.stringify({ session, candidates, report }, null, 2)], { type: "application/json" });
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
                <span className="iv-stat__number">{report.sessionSummary.overallDifficulty || "—"}</span>
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
                  onClick={() => setSelectedCid(r.candidateId)}
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
                      <span className="iv-big-score">{r.overallScore}</span>
                      <span className="iv-score-max">/100</span>
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

                  <div className="iv-ranking-card__expand">
                    {isSelected ? "Click to collapse" : "Click for details"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Per-question detail for selected candidate */}
      {selectedRanking && (
        <section className="iv-section">
          <h2>Detailed Breakdown: {selectedRanking.displayName || selectedCid}</h2>
          <div className="iv-detail-grid">
            {(selectedRanking.perQuestion || []).map((pq) => (
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

          {/* Also show evaluation from candidate doc if available */}
          {selectedCandidate?.evaluation && !selectedRanking.perQuestion?.length && (
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
                      Total: <strong>{ev.total ?? "—"}/100</strong>
                    </div>
                    {ev.feedback && <p className="iv-detail-feedback">{ev.feedback}</p>}
                  </div>
                );
              })}
            </div>
          )}
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
    </div>
  );
}
