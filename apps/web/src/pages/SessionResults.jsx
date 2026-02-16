// SessionResults – Comparative ranking dashboard after a session ends.
// Shows ranked candidates, per-question breakdown, and export option.

import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getSession,
  getCandidates,
  getEvaluation,
  evaluateCandidate,
  compareAllCandidates,
} from "../services/sessionService.js";
import { QUESTION_BANK } from "../data/questionBank.js";
import "../styles/interviewer.css";

export default function SessionResults() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  const { logOut } = useAuth();

  const [session, setSession] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedCid, setSelectedCid] = useState(null);
  const handleLogout = useCallback(async () => {
    await logOut();
    localStorage.clear();
    navigate("/login", { replace: true });
  }, [logOut, navigate]);

  useEffect(() => {
    Promise.all([
      getSession(sessionId),
      getCandidates(sessionId),
      getEvaluation(sessionId),
    ])
      .then(([s, c, e]) => {
        setSession(s);
        setCandidates(c);
        setEvaluation(e?.comparison || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // Evaluate each candidate first
      for (const c of candidates) {
        await evaluateCandidate(sessionId, c.id).catch(() => {});
      }
      // Then compare
      const comp = await compareAllCandidates(sessionId);
      setEvaluation(comp);
    } catch { /* ignore */ }
    setGenerating(false);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify({ session, candidates, evaluation }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionId}-results.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const rankings = evaluation?.rankings || [];
    const rows = [["Rank", "Candidate", "Total Score", "Strengths", "Weaknesses"]];
    rankings.forEach((r, i) => {
      rows.push([i + 1, r.displayName || r.candidateId, r.totalScore || "", r.strengths || "", r.weaknesses || ""]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${sessionId}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="iv-dashboard"><p className="iv-muted">Loading results...</p></div>;

  const rankings = evaluation?.rankings || [];
  const selectedCandidate = candidates.find((c) => c.id === selectedCid);

  return (
    <div className="iv-dashboard">
      <header className="iv-header">
        <h1>Results: {session?.title || "Session"}</h1>
        <div className="iv-header__actions">
          <button className="iv-btn iv-btn--sm" onClick={() => navigate("/interviewer")}>Dashboard</button>
          <button className="iv-btn iv-btn--sm iv-btn--danger" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* ── Generate / Export ──────────────────────────────────── */}
      <section className="iv-section">
        <div className="iv-row">
          {!evaluation && (
            <button className="iv-btn iv-btn--primary" onClick={handleGenerate} disabled={generating}>
              {generating ? "Evaluating..." : "Generate AI Comparison"}
            </button>
          )}
          {evaluation && (
            <>
              <button className="iv-btn iv-btn--sm" onClick={handleExportJSON}>Export JSON</button>
              <button className="iv-btn iv-btn--sm" onClick={handleExportCSV}>Export CSV</button>
              <button className="iv-btn iv-btn--sm iv-btn--primary" onClick={handleGenerate} disabled={generating}>
                {generating ? "Re-evaluating..." : "Re-evaluate"}
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── Summary ──────────────────────────────────────────── */}
      {evaluation?.summary && (
        <section className="iv-section">
          <h2>Summary</h2>
          <div className="iv-summary-box">{evaluation.summary}</div>
        </section>
      )}

      {evaluation?.bestApproach && (
        <section className="iv-section">
          <h2>Best Approach</h2>
          <div className="iv-summary-box">{evaluation.bestApproach}</div>
        </section>
      )}

      {/* ── Rankings table ────────────────────────────────────── */}
      {rankings.length > 0 && (
        <section className="iv-section">
          <h2>Rankings</h2>
          <table className="iv-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Candidate</th>
                <th>Score</th>
                <th>Strengths</th>
                <th>Weaknesses</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((r, i) => (
                <tr key={r.candidateId || i} className={r.candidateId === selectedCid ? "iv-row--active" : ""}>
                  <td>{i + 1}</td>
                  <td>{r.displayName || r.candidateId}</td>
                  <td><strong>{r.totalScore ?? "—"}</strong></td>
                  <td>{r.strengths || "—"}</td>
                  <td>{r.weaknesses || "—"}</td>
                  <td>
                    <button className="iv-btn iv-btn--sm" onClick={() => setSelectedCid(r.candidateId)}>
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Per-candidate detail ──────────────────────────────── */}
      {selectedCandidate && (
        <section className="iv-section">
          <h2>Detail: {selectedCandidate.displayName || selectedCid}</h2>
          {selectedCandidate.evaluation ? (
            <div className="iv-eval-detail">
              {Object.entries(selectedCandidate.evaluation).map(([qid, ev]) => {
                const q = QUESTION_BANK.find((x) => x.id === qid);
                return (
                  <div key={qid} className="iv-eval-card">
                    <h4>{q?.title || qid}</h4>
                    <div className="iv-eval-scores">
                      <span>Correctness: {ev.correctness ?? "—"}/40</span>
                      <span>Efficiency: {ev.efficiency ?? "—"}/25</span>
                      <span>Code Quality: {ev.codeQuality ?? "—"}/20</span>
                      <span>Communication: {ev.communication ?? "—"}/15</span>
                      <span><strong>Total: {ev.total ?? "—"}/100</strong></span>
                    </div>
                    {ev.feedback && <p className="iv-eval-feedback">{ev.feedback}</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="iv-muted">No per-question evaluation yet. Click "Generate AI Comparison" first.</p>
          )}
        </section>
      )}
    </div>
  );
}
