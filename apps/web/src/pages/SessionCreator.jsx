import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { createSession, getQuestionBank, createQuestion, analyzeCandidate } from "../services/sessionService.js";
import "../styles/interviewer.css";

const FORMAT_OPTIONS = [
  {
    id: "mock_interview",
    label: "Mock AI Interview",
    desc: "Behavioral questions only — AI conducts a conversational interview based on the candidate's background.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    id: "coding_only",
    label: "Coding Session",
    desc: "Jump straight into coding problems — no behavioral questions.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 9l3 3-3 3" />
        <line x1="14" y1="15" x2="18" y2="15" />
      </svg>
    ),
  },
  {
    id: "both",
    label: "Both (Mock + Coding)",
    desc: "Start with a behavioral AI interview, then move to coding challenges.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="16" y1="11" x2="22" y2="11" />
      </svg>
    ),
  },
];

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
  const [interviewerEmail, setInterviewerEmail] = useState(user?.email || "");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [language, setLanguage] = useState("javascript");
  const [settings, setSettings] = useState({
    hintsEnabled: true,
    aiInterruptionsEnabled: true,
    showTestCases: true,
    timeLimitSeconds: 30 * 60,
  });

  // Session format
  const [sessionFormat, setSessionFormat] = useState("coding_only");

  // Candidate profile / AI recommendation
  const [candidateInfo, setCandidateInfo] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [recommendation, setRecommendation] = useState(null);
  const [aiQuestions, setAiQuestions] = useState([]);
  const [aiQuestionSelection, setAiQuestionSelection] = useState({});
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const LANGUAGE_OPTIONS = [
    { value: "javascript", label: "JavaScript" },
    { value: "python",     label: "Python" },
    { value: "java",       label: "Java" },
    { value: "cpp",        label: "C++" },
  ];

  // Custom question form
  const [showCustom, setShowCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customDiff, setCustomDiff] = useState("Medium");
  const [customCat, setCustomCat] = useState("Custom");
  const [customStarter, setCustomStarter] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const [createError, setCreateError] = useState("");

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

  // ── Candidate Analysis ──────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    if (!candidateInfo.trim() && !resumeFile) {
      setAnalyzeError("Please provide candidate info or upload a resume.");
      return;
    }
    setAnalyzing(true);
    setAnalyzeError("");
    setRecommendation(null);

    try {
      const result = await analyzeCandidate({ candidateInfo, resumeFile });
      setRecommendation(result);
      setSessionFormat(result.recommendedFormat || "both");

      const questions = (result.suggestedBehavioralQuestions || []).map((q, i) => ({
        ...q,
        _id: `ai-bq-${i}`,
      }));
      setAiQuestions(questions);
      const sel = {};
      questions.forEach((q) => { sel[q._id] = true; });
      setAiQuestionSelection(sel);

      // Pre-select coding questions matching AI suggestions
      if (result.suggestedCodingConfig) {
        const cfg = result.suggestedCodingConfig;
        const matching = bank.filter((q) => {
          const diffMatch = !cfg.difficulty || q.difficulty === cfg.difficulty;
          const catMatch = !cfg.categories?.length || cfg.categories.some((c) =>
            q.category?.toLowerCase().includes(c.toLowerCase())
          );
          return diffMatch && catMatch;
        });
        const count = cfg.problemCount || 2;
        const toSelect = matching.slice(0, count).map((q) => q.id);
        setSelectedIds((prev) => [...new Set([...prev, ...toSelect])]);
      }
    } catch (e) {
      setAnalyzeError(e.message || "Analysis failed. You can still configure the session manually.");
    }
    setAnalyzing(false);
  }, [candidateInfo, resumeFile, bank]);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove("iv-dropzone--dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type === "application/pdf") {
      setResumeFile(file);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.add("iv-dropzone--dragover");
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove("iv-dropzone--dragover");
  }, []);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) setResumeFile(file);
  }, []);

  const toggleAiQuestion = (id) => {
    setAiQuestionSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Create Session ──────────────────────────────────────────────
  const needsCodingQuestions = sessionFormat === "coding_only" || sessionFormat === "both";

  const handleCreate = async () => {
    if (!title.trim()) return;
    if (needsCodingQuestions && selectedIds.length === 0) return;

    setSubmitting(true);
    setCreateError("");
    try {
      const scheduledAt =
        scheduledDate && scheduledTime
          ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
          : null;

      const selectedAiQuestions = aiQuestions.filter((q) => aiQuestionSelection[q._id]);

      const session = await createSession({
        title,
        questionIds: needsCodingQuestions ? selectedIds : [],
        settings: { ...settings, language },
        createdBy: user?.uid || null,
        interviewerEmail: interviewerEmail || null,
        candidateEmail: candidateEmail || null,
        scheduledAt,
        sessionFormat,
        candidateProfile: candidateInfo || recommendation?.candidateSummary
          ? {
              bio: candidateInfo || null,
              ...(recommendation?.candidateSummary || {}),
            }
          : null,
        aiGeneratedQuestions: selectedAiQuestions.map(({ _id, ...rest }) => rest),
      });
      setCreated(session);
    } catch (e) {
      console.error("Create session failed:", e);
      setCreateError(e.message || "Failed to create session. Check the console for details.");
    }
    setSubmitting(false);
  };

  // ── Success Screen ──────────────────────────────────────────────
  if (created) {
    const formatLabel = FORMAT_OPTIONS.find((f) => f.id === sessionFormat)?.label || sessionFormat;
    return (
      <div className="iv-dashboard">
        <div className="iv-success-card">
          <h2>Session Created!</h2>
          <p>Share this link with candidates:</p>
          <code className="iv-share-code">{window.location.origin}/join/{created.shareCode}</code>
          <p>Session code: <strong>{created.shareCode}</strong></p>
          <p>Format: <strong>{formatLabel}</strong></p>
          <p>Language: <strong>{LANGUAGE_OPTIONS.find(l => l.value === language)?.label || language}</strong></p>
          <div className="iv-success-card__actions">
            <button className="iv-btn iv-btn--primary" onClick={() => navigate(`/interviewer/session/${created.id}`)}>
              Go to Monitor
            </button>
            <button className="iv-btn" onClick={() => navigate("/interviewer")}>
              Back to My Sessions
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Form ───────────────────────────────────────────────────
  return (
    <div className="iv-dashboard">
      <header className="iv-header">
        <h1>Create Interview Session</h1>
        <button className="iv-btn" onClick={() => navigate("/interviewer")}>Back to My Sessions</button>
      </header>

      {/* ── Basic Info ─────────────────────────────────────────── */}
      <section className="iv-section">
        <label className="iv-label">Session Title</label>
        <input className="iv-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Frontend Eng Round 1" />
        <label className="iv-label" style={{ marginTop: 12 }}>Your Email (for receiving the AI report)</label>
        <input className="iv-input" type="email" value={interviewerEmail} onChange={(e) => setInterviewerEmail(e.target.value)} placeholder="interviewer@company.com" />

        <label className="iv-label" style={{ marginTop: 12 }}>Candidate Email (invitation will be sent)</label>
        <input className="iv-input" type="email" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} placeholder="candidate@example.com" />

        <label className="iv-label" style={{ marginTop: 12 }}>Scheduled Date &amp; Time</label>
        <div className="iv-row" style={{ gap: 8 }}>
          <input className="iv-input" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
          <input className="iv-input" type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
        </div>

        <label className="iv-label" style={{ marginTop: 12 }}>Programming Language</label>
        <div className="iv-lang-picker">
          {LANGUAGE_OPTIONS.map((lang) => (
            <button
              key={lang.value}
              type="button"
              className={`iv-lang-option ${language === lang.value ? "iv-lang-option--selected" : ""}`}
              onClick={() => setLanguage(lang.value)}
            >
              <span className="iv-lang-option__icon">{lang.value === "javascript" ? "JS" : lang.value === "python" ? "PY" : lang.value === "java" ? "JV" : "C+"}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Candidate Profile & AI Recommendation ─────────────── */}
      <section className="iv-section">
        <h2>Candidate Profile</h2>
        <p className="iv-muted" style={{ marginBottom: 12 }}>
          Provide candidate info so the AI can recommend an interview format and generate tailored questions.
        </p>

        <label className="iv-label">Brief Candidate Info</label>
        <textarea
          className="iv-textarea"
          rows={4}
          value={candidateInfo}
          onChange={(e) => setCandidateInfo(e.target.value)}
          placeholder="e.g. Jane Smith, 3 years experience, React/Node.js developer, applying for Senior Frontend role..."
        />

        <label className="iv-label" style={{ marginTop: 12 }}>Or Upload Resume (PDF)</label>
        <div
          ref={dropZoneRef}
          className={`iv-dropzone ${resumeFile ? "iv-dropzone--has-file" : ""}`}
          onDrop={handleFileDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />
          {resumeFile ? (
            <div className="iv-dropzone__file">
              <span className="iv-dropzone__file-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
              <span className="iv-dropzone__file-name">{resumeFile.name}</span>
              <button
                type="button"
                className="iv-dropzone__remove"
                onClick={(e) => { e.stopPropagation(); setResumeFile(null); }}
              >
                &times;
              </button>
            </div>
          ) : (
            <div className="iv-dropzone__placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Drag &amp; drop a PDF here, or click to browse</span>
            </div>
          )}
        </div>

        <button
          type="button"
          className="iv-btn iv-btn--primary"
          style={{ marginTop: 16 }}
          disabled={analyzing || (!candidateInfo.trim() && !resumeFile)}
          onClick={handleAnalyze}
        >
          {analyzing ? (
            <>
              <span className="iv-spinner" />
              Analyzing...
            </>
          ) : (
            "Analyze & Get Recommendations"
          )}
        </button>
        {analyzeError && <p style={{ color: "#dc2626", marginTop: 8, fontSize: "0.9rem" }}>{analyzeError}</p>}
      </section>

      {/* ── AI Recommendation Results ─────────────────────────── */}
      {recommendation && (
        <section className="iv-section iv-recommendation">
          <h2>AI Recommendation</h2>

          {/* Candidate Summary */}
          {recommendation.candidateSummary && (
            <div className="iv-candidate-summary">
              <div className="iv-candidate-summary__row">
                {recommendation.candidateSummary.name && (
                  <span className="iv-candidate-summary__item">
                    <strong>Name:</strong> {recommendation.candidateSummary.name}
                  </span>
                )}
                {recommendation.candidateSummary.experienceLevel && (
                  <span className="iv-candidate-summary__item">
                    <strong>Level:</strong>
                    <span className={`iv-level-badge iv-level-badge--${recommendation.candidateSummary.experienceLevel}`}>
                      {recommendation.candidateSummary.experienceLevel}
                    </span>
                  </span>
                )}
                {recommendation.candidateSummary.yearsOfExperience != null && (
                  <span className="iv-candidate-summary__item">
                    <strong>Experience:</strong> {recommendation.candidateSummary.yearsOfExperience} years
                  </span>
                )}
              </div>
              {recommendation.candidateSummary.primaryTechStack?.length > 0 && (
                <div className="iv-candidate-summary__tech">
                  {recommendation.candidateSummary.primaryTechStack.map((t) => (
                    <span key={t} className="iv-tech-chip">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reasoning */}
          {recommendation.reasoning && (
            <div className="iv-reasoning">
              <p>{recommendation.reasoning}</p>
            </div>
          )}

          {/* Format Selector */}
          <h3 style={{ marginTop: 20, marginBottom: 12 }}>Interview Format</h3>
          <div className="iv-format-grid">
            {FORMAT_OPTIONS.map((fmt) => {
              const isRecommended = recommendation.recommendedFormat === fmt.id;
              const isSelected = sessionFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  className={`iv-format-card ${isSelected ? "iv-format-card--selected" : ""}`}
                  onClick={() => setSessionFormat(fmt.id)}
                >
                  {isRecommended && <span className="iv-format-card__badge">Recommended</span>}
                  <div className="iv-format-card__icon">{fmt.icon}</div>
                  <h4 className="iv-format-card__title">{fmt.label}</h4>
                  <p className="iv-format-card__desc">{fmt.desc}</p>
                </button>
              );
            })}
          </div>

          {/* AI-Generated Behavioral Questions */}
          {aiQuestions.length > 0 && (sessionFormat === "mock_interview" || sessionFormat === "both") && (
            <div className="iv-ai-questions">
              <h3>AI-Generated Behavioral Questions</h3>
              <p className="iv-muted">These questions are tailored to the candidate's background. Toggle to include or exclude.</p>
              <div className="iv-ai-questions__list">
                {aiQuestions.map((q) => (
                  <label key={q._id} className={`iv-ai-question ${aiQuestionSelection[q._id] ? "iv-ai-question--selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={!!aiQuestionSelection[q._id]}
                      onChange={() => toggleAiQuestion(q._id)}
                    />
                    <div className="iv-ai-question__content">
                      <span className="iv-ai-question__category">{q.category}</span>
                      <p className="iv-ai-question__text">{q.question}</p>
                      {q.rationale && <small className="iv-ai-question__rationale">{q.rationale}</small>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* AI Coding Suggestions */}
          {recommendation.suggestedCodingConfig && (sessionFormat === "coding_only" || sessionFormat === "both") && (
            <div className="iv-ai-coding-config">
              <h3>AI Coding Suggestions</h3>
              <div className="iv-ai-coding-config__details">
                <span><strong>Difficulty:</strong> {recommendation.suggestedCodingConfig.difficulty}</span>
                <span><strong>Problems:</strong> {recommendation.suggestedCodingConfig.problemCount}</span>
                {recommendation.suggestedCodingConfig.categories?.length > 0 && (
                  <span>
                    <strong>Categories:</strong>{" "}
                    {recommendation.suggestedCodingConfig.categories.join(", ")}
                  </span>
                )}
                {recommendation.suggestedCodingConfig.focusAreas?.length > 0 && (
                  <span>
                    <strong>Focus:</strong>{" "}
                    {recommendation.suggestedCodingConfig.focusAreas.join(", ")}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Format Selector (no recommendation yet) ──────────── */}
      {!recommendation && (
        <section className="iv-section">
          <h2>Interview Format</h2>
          <p className="iv-muted" style={{ marginBottom: 12 }}>
            Choose a format, or provide candidate info above to get an AI recommendation.
          </p>
          <div className="iv-format-grid">
            {FORMAT_OPTIONS.map((fmt) => {
              const isSelected = sessionFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  className={`iv-format-card ${isSelected ? "iv-format-card--selected" : ""}`}
                  onClick={() => setSessionFormat(fmt.id)}
                >
                  <div className="iv-format-card__icon">{fmt.icon}</div>
                  <h4 className="iv-format-card__title">{fmt.label}</h4>
                  <p className="iv-format-card__desc">{fmt.desc}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

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

      {/* ── Question Bank (only for coding formats) ────────────── */}
      {needsCodingQuestions && (
        <section className="iv-section">
          <h2>Select Coding Questions ({selectedIds.length} selected)</h2>
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
                <button className="iv-btn iv-btn--primary iv-btn--sm" onClick={handleAddCustom}>Add &amp; Select</button>
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
                const isSuggested = recommendation?.suggestedCodingConfig?.categories?.some(
                  (c) => q.category?.toLowerCase().includes(c.toLowerCase())
                );
                return (
                  <div
                    key={q.id}
                    className={`iv-question-card ${selected ? "iv-question-card--selected" : ""}`}
                    onClick={() => toggleQuestion(q.id)}
                  >
                    <div className="iv-question-card__top">
                      <span className={`iv-diff iv-diff--${(q.difficulty || "").toLowerCase()}`}>{q.difficulty}</span>
                      <span className="iv-cat">{q.category}</span>
                      {isSuggested && <span className="iv-ai-badge">AI Suggested</span>}
                    </div>
                    <h4>{q.title}</h4>
                    {selected && <span className="iv-check">&#10003;</span>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Create Button ──────────────────────────────────────── */}
      <section className="iv-section iv-section--sticky">
        {createError && <p style={{ color: "#dc2626", marginBottom: 8, fontSize: "0.9rem" }}>{createError}</p>}
        {!title.trim() && (
          <p className="iv-create-hint">Enter a session title above to enable creation.</p>
        )}
        {title.trim() && needsCodingQuestions && selectedIds.length === 0 && (
          <p className="iv-create-hint">Select at least one coding question below.</p>
        )}
        <button
          className="iv-btn iv-btn--primary iv-btn--lg"
          disabled={submitting || !title.trim() || (needsCodingQuestions && selectedIds.length === 0)}
          onClick={handleCreate}
        >
          {submitting ? "Creating..." : (() => {
            const behavioralCount = aiQuestions.filter((q) => aiQuestionSelection[q._id]).length;
            if (needsCodingQuestions) {
              const parts = [`${selectedIds.length} coding`];
              if (behavioralCount > 0) parts.push(`${behavioralCount} behavioral`);
              return `Create Session (${parts.join(" + ")})`;
            }
            return `Create Session (${behavioralCount} behavioral question${behavioralCount !== 1 ? "s" : ""})`;
          })()}
        </button>
      </section>
    </div>
  );
}
