// SessionCreator – wizard to build a new interview session.
// Interviewer picks questions, sets permissions, then generates a share link.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { createSession, getQuestionBank, createQuestion } from "../services/sessionService.js";
import "../styles/interviewer.css";

export default function SessionCreator() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Question bank
  const [bank, setBank] = useState([]);
  const [bankLoading, setBankLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("");
  const [filterDiff, setFilterDiff] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Session config
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [settings, setSettings] = useState({
    hintsEnabled: true,
    aiInterruptionsEnabled: true,
    showTestCases: true,
    timeLimitSeconds: 30 * 60,
  });

  // Custom question form
  const [showCustom, setShowCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customDiff, setCustomDiff] = useState("Medium");
  const [customCat, setCustomCat] = useState("Custom");
  const [customStarter, setCustomStarter] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    getQuestionBank({ category: filterCat, difficulty: filterDiff, search: searchTerm })
      .then(setBank)
      .catch(() => {})
      .finally(() => setBankLoading(false));
  }, [filterCat, filterDiff, searchTerm]);

  const categories = [...new Set(bank.map((q) => q.category))].sort();
  const difficulties = ["Easy", "Medium", "Hard"];

  const toggleQuestion = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAddCustom = async () => {
    if (!customTitle.trim() || !customDesc.trim()) return;
    try {
      const q = await createQuestion({
        title: customTitle,
        description: customDesc,
        difficulty: customDiff,
        category: customCat,
        starterCode: customStarter,
        createdBy: user?.uid || null,
      });
      setBank((prev) => [...prev, q]);
      setSelectedIds((prev) => [...prev, q.id]);
      setShowCustom(false);
      setCustomTitle("");
      setCustomDesc("");
      setCustomStarter("");
    } catch { /* ignore */ }
  };

  const [createError, setCreateError] = useState("");

  const handleCreate = async () => {
    if (!title.trim() || selectedIds.length === 0) return;
    setSubmitting(true);
    setCreateError("");
    try {
      const session = await createSession({
        title,
        questionIds: selectedIds,
        settings,
        createdBy: user?.uid || null,
      });
      setCreated(session);
    } catch (e) {
      console.error("Create session failed:", e);
      setCreateError(e.message || "Failed to create session. Check the console for details.");
    }
    setSubmitting(false);
  };

  if (created) {
    return (
      <div className="iv-dashboard">
        <div className="iv-success-card">
          <h2>Session Created!</h2>
          <p>Share this link with candidates:</p>
          <code className="iv-share-code">{window.location.origin}/join/{created.shareCode}</code>
          <p>Session code: <strong>{created.shareCode}</strong></p>
          <div className="iv-success-card__actions">
            <button className="iv-btn iv-btn--primary" onClick={() => navigate(`/interviewer/session/${created.id}`)}>
              Go to Monitor
            </button>
            <button className="iv-btn" onClick={() => navigate("/interviewer")}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="iv-dashboard">
      <header className="iv-header">
        <h1>Create Interview Session</h1>
        <button className="iv-btn" onClick={() => navigate("/interviewer")}>Cancel</button>
      </header>

      <section className="iv-section">
        <label className="iv-label">Session Title</label>
        <input className="iv-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Frontend Eng Round 1" />
      </section>

      {/* ── Permissions ─────────────────────────────────────────── */}
      <section className="iv-section">
        <h2>Permissions</h2>
        <div className="iv-permissions">
          <label className="iv-toggle">
            <input type="checkbox" checked={settings.hintsEnabled} onChange={(e) => setSettings((p) => ({ ...p, hintsEnabled: e.target.checked }))} />
            Allow AI hints for candidates
          </label>
          <label className="iv-toggle">
            <input type="checkbox" checked={settings.aiInterruptionsEnabled} onChange={(e) => setSettings((p) => ({ ...p, aiInterruptionsEnabled: e.target.checked }))} />
            AI proactive interruptions
          </label>
          <label className="iv-toggle">
            <input type="checkbox" checked={settings.showTestCases} onChange={(e) => setSettings((p) => ({ ...p, showTestCases: e.target.checked }))} />
            Show test cases to candidates
          </label>
          <label className="iv-label">
            Time limit (minutes)
            <input className="iv-input iv-input--sm" type="number" min={5} max={180} value={Math.round(settings.timeLimitSeconds / 60)}
              onChange={(e) => setSettings((p) => ({ ...p, timeLimitSeconds: Number(e.target.value) * 60 }))} />
          </label>
        </div>
      </section>

      {/* ── Question Bank ───────────────────────────────────────── */}
      <section className="iv-section">
        <h2>Select Questions ({selectedIds.length} selected)</h2>
        <div className="iv-filters">
          <select className="iv-select" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="iv-select" value={filterDiff} onChange={(e) => setFilterDiff(e.target.value)}>
            <option value="">All difficulties</option>
            {difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input className="iv-input" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <button className="iv-btn iv-btn--sm" onClick={() => setShowCustom(true)}>+ Custom Question</button>
        </div>

        {showCustom && (
          <div className="iv-custom-form">
            <h3>Add Custom Question</h3>
            <input className="iv-input" placeholder="Title" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
            <textarea className="iv-textarea" placeholder="Description (markdown supported)" value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} rows={4} />
            <div className="iv-row">
              <select className="iv-select" value={customDiff} onChange={(e) => setCustomDiff(e.target.value)}>
                {difficulties.map((d) => <option key={d}>{d}</option>)}
              </select>
              <input className="iv-input" placeholder="Category" value={customCat} onChange={(e) => setCustomCat(e.target.value)} />
            </div>
            <textarea className="iv-textarea" placeholder="Starter code (optional)" value={customStarter} onChange={(e) => setCustomStarter(e.target.value)} rows={3} />
            <div className="iv-row">
              <button className="iv-btn iv-btn--primary iv-btn--sm" onClick={handleAddCustom}>Add & Select</button>
              <button className="iv-btn iv-btn--sm" onClick={() => setShowCustom(false)}>Cancel</button>
            </div>
          </div>
        )}

        {bankLoading ? (
          <p className="iv-muted">Loading question bank...</p>
        ) : (
          <div className="iv-question-grid">
            {bank.map((q) => {
              const selected = selectedIds.includes(q.id);
              return (
                <div key={q.id} className={`iv-question-card ${selected ? "iv-question-card--selected" : ""}`} onClick={() => toggleQuestion(q.id)}>
                  <div className="iv-question-card__top">
                    <span className={`iv-diff iv-diff--${(q.difficulty || "").toLowerCase()}`}>{q.difficulty}</span>
                    <span className="iv-cat">{q.category}</span>
                  </div>
                  <h4>{q.title}</h4>
                  {selected && <span className="iv-check">&#10003;</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="iv-section iv-section--sticky">
        {createError && <p style={{ color: "#dc2626", marginBottom: 8, fontSize: "0.9rem" }}>{createError}</p>}
        <button className="iv-btn iv-btn--primary iv-btn--lg" disabled={submitting || !title.trim() || selectedIds.length === 0} onClick={handleCreate}>
          {submitting ? "Creating..." : `Create Session (${selectedIds.length} questions)`}
        </button>
      </section>
    </div>
  );
}
