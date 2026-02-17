// LiveMonitor – Interviewer watches candidates code in real-time.
// Left: candidate list. Center: read-only Monaco editor. Right: AI analysis + controls.

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import {
  getSession,
  getCandidates,
  pullCode,
  updateSession,
  evaluateCandidate,
  compareAllCandidates,
} from "../services/sessionService.js";
import { QUESTION_BANK } from "../data/questionBank.js";
import { sendChat } from "../api.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import "../styles/interviewer.css";

const POLL_MS = 2000;

export default function LiveMonitor() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  const { logOut } = useAuth();

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
    candidatePollerRef.current = setInterval(poll, 5000);
    return () => clearInterval(candidatePollerRef.current);
  }, [sessionId]);

  // Poll selected candidate's code every 2s
  useEffect(() => {
    if (pollerRef.current) clearInterval(pollerRef.current);
    if (!selectedCid || !currentQid) return;
    const poll = () => {
      pullCode(sessionId, selectedCid, currentQid).then((data) => {
        if (data?.code != null) setCode(data.code);
      }).catch(() => {});
    };
    poll();
    pollerRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollerRef.current);
  }, [sessionId, selectedCid, currentQid]);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const question = QUESTION_BANK.find((q) => q.id === currentQid);
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
    if (!confirm("End this session for all candidates?")) return;
    await updateSession(sessionId, { status: "completed" }).catch(() => {});
    navigate(`/interviewer/results/${sessionId}`);
  };

  const handleEvalAll = async () => {
    await updateSession(sessionId, { status: "completed" }).catch(() => {});
    for (const c of candidates) {
      await evaluateCandidate(sessionId, c.id).catch(() => {});
    }
    await compareAllCandidates(sessionId).catch(() => {});
    navigate(`/interviewer/results/${sessionId}`);
  };

  const handleLogout = useCallback(async () => {
    await logOut();
    localStorage.clear();
    navigate("/login", { replace: true });
  }, [logOut, navigate]);

  return (
    <div className="iv-monitor">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="iv-monitor__header">
        <h2>{session?.title || "Session"}</h2>
        <div className="iv-monitor__meta">
          <span>Code: <strong>{session?.shareCode}</strong></span>
          <span>{candidates.length} candidate(s)</span>
          <span>Elapsed: {fmtTime(elapsed)}</span>
        </div>
        <div className="iv-monitor__header-actions">
          <button className="iv-btn iv-btn--sm iv-btn--primary" onClick={handleEvalAll}>Evaluate All</button>
          <button className="iv-btn iv-btn--sm iv-btn--danger" onClick={handleEndSession}>End Session</button>
          <button className="iv-btn iv-btn--sm" onClick={() => navigate("/interviewer")}>Dashboard</button>
          <button className="iv-btn iv-btn--sm iv-btn--danger" onClick={handleLogout}>Logout</button>
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
                  <span className="iv-cand-name">{c.displayName || c.id}</span>
                  <span className={`iv-badge iv-badge--${c.status || "joined"}`}>{c.status || "joined"}</span>
                </li>
              ))}
            </ul>
          )}

          <h3 style={{ marginTop: 16 }}>Questions</h3>
          <ul className="iv-question-list">
            {(session?.questionIds || []).map((qid) => {
              const q = QUESTION_BANK.find((x) => x.id === qid);
              return (
                <li key={qid} className={`iv-q-item ${qid === currentQid ? "iv-q-item--active" : ""}`} onClick={() => setCurrentQid(qid)}>
                  {q?.title || qid}
                </li>
              );
            })}
          </ul>
        </aside>

        {/* ── Center: read-only editor ────────────────────────────── */}
        <main className="iv-monitor__editor">
          <div className="iv-monitor__editor-bar">
            <span>Viewing: <strong>{candidates.find((c) => c.id === selectedCid)?.displayName || "—"}</strong></span>
            <span>{question?.title || currentQid}</span>
          </div>
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme="vs-dark"
            value={code}
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 14 }}
          />
        </main>

        {/* ── Right: AI analysis ──────────────────────────────────── */}
        <aside className="iv-monitor__analysis">
          <h3>AI Analysis</h3>
          <button className="iv-btn iv-btn--primary iv-btn--sm" onClick={handleAnalyze} disabled={analyzing || !code.trim()}>
            {analyzing ? "Analyzing..." : "Analyze Code"}
          </button>
          {aiAnalysis && (
            <div className="iv-analysis-box">
              <pre>{aiAnalysis}</pre>
            </div>
          )}

          {question && (
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
