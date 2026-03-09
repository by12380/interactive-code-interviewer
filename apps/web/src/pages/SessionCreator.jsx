import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { createSession, getQuestionBank, createQuestion, analyzeCandidate } from "../services/sessionService.js";
import "../styles/session-creator.css";

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

const LANGUAGE_OPTIONS = [
  { value: "javascript", label: "JavaScript", short: "JS" },
  { value: "python", label: "Python", short: "PY" },
  { value: "java", label: "Java", short: "JV" },
  { value: "cpp", label: "C++", short: "C+" },
];

const STEPS = [
  { id: "basics", label: "Basics" },
  { id: "format", label: "Format" },
  { id: "candidate", label: "Candidate" },
  { id: "questions", label: "Questions" },
  { id: "settings", label: "Settings" },
];

export default function SessionCreator() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);

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

  const needsCodingQuestions = sessionFormat === "coding_only" || sessionFormat === "both";

  const visibleSteps = STEPS.filter((s) => {
    if (s.id === "questions") return needsCodingQuestions;
    return true;
  });

  const currentStepId = visibleSteps[step]?.id;

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
    dropZoneRef.current?.classList.remove("sc-dropzone--dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type === "application/pdf") {
      setResumeFile(file);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.add("sc-dropzone--dragover");
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove("sc-dropzone--dragover");
  }, []);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) setResumeFile(file);
  }, []);

  const toggleAiQuestion = (id) => {
    setAiQuestionSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const canProceed = () => {
    switch (currentStepId) {
      case "basics":
        return title.trim().length > 0;
      case "format":
        return true;
      case "candidate":
        return true;
      case "questions":
        return selectedIds.length > 0;
      case "settings":
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (step < visibleSteps.length - 1 && canProceed()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

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
      setCreateError(e.message || "Failed to create session.");
    }
    setSubmitting(false);
  };

  // ── Success Screen ──────────────────────────────────────────────
  if (created) {
    const formatLabel = FORMAT_OPTIONS.find((f) => f.id === sessionFormat)?.label || sessionFormat;
    return (
      <div className="sc-page">
        <div className="sc-page__blob sc-page__blob--1" />
        <div className="sc-page__blob sc-page__blob--2" />

        <div className="sc-success">
          <div className="sc-success__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1 className="sc-success__title">Session Created!</h1>
          <p className="sc-success__subtitle">Share the link or code below with your candidate to get started.</p>

          <div className="sc-success__code-block">
            <label className="sc-success__code-label">Invite Link</label>
            <div className="sc-success__code-value">
              <code>{window.location.origin}/join/{created.shareCode}</code>
              <button
                type="button"
                className="sc-success__copy-btn"
                onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/join/${created.shareCode}`)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>

          <div className="sc-success__details">
            <div className="sc-success__detail">
              <span className="sc-success__detail-label">Session Code</span>
              <span className="sc-success__detail-value">{created.shareCode}</span>
            </div>
            <div className="sc-success__detail">
              <span className="sc-success__detail-label">Format</span>
              <span className="sc-success__detail-value">{formatLabel}</span>
            </div>
            <div className="sc-success__detail">
              <span className="sc-success__detail-label">Language</span>
              <span className="sc-success__detail-value">{LANGUAGE_OPTIONS.find(l => l.value === language)?.label || language}</span>
            </div>
          </div>

          <div className="sc-success__actions">
            <button className="sc-btn sc-btn--primary sc-btn--lg" onClick={() => navigate(`/interviewer/session/${created.id}`)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Go to Monitor
            </button>
            <button className="sc-btn sc-btn--ghost" onClick={() => navigate("/interviewer")}>
              Back to My Sessions
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render step content ─────────────────────────────────────────
  const renderStepContent = () => {
    switch (currentStepId) {
      case "basics":
        return (
          <div className="sc-step-content">
            <div className="sc-step-header">
              <h2 className="sc-step-title">Session Details</h2>
              <p className="sc-step-desc">Set up the basic info for your interview session.</p>
            </div>

            <div className="sc-form-group">
              <label className="sc-label">Session Title</label>
              <input
                className="sc-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Frontend Eng Round 1"
                autoFocus
              />
            </div>

            <div className="sc-form-row">
              <div className="sc-form-group">
                <label className="sc-label">Your Email</label>
                <input
                  className="sc-input"
                  type="email"
                  value={interviewerEmail}
                  onChange={(e) => setInterviewerEmail(e.target.value)}
                  placeholder="interviewer@company.com"
                />
                <span className="sc-hint">For receiving the AI report</span>
              </div>
              <div className="sc-form-group">
                <label className="sc-label">Candidate Email</label>
                <input
                  className="sc-input"
                  type="email"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  placeholder="candidate@example.com"
                />
                <span className="sc-hint">Invitation will be sent</span>
              </div>
            </div>

            <div className="sc-form-row">
              <div className="sc-form-group">
                <label className="sc-label">Scheduled Date</label>
                <input
                  className="sc-input"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="sc-form-group">
                <label className="sc-label">Scheduled Time</label>
                <input
                  className="sc-input"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </div>

            <div className="sc-form-group">
              <label className="sc-label">Programming Language</label>
              <div className="sc-lang-grid">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang.value}
                    type="button"
                    className={`sc-lang-card ${language === lang.value ? "sc-lang-card--active" : ""}`}
                    onClick={() => setLanguage(lang.value)}
                  >
                    <span className="sc-lang-card__badge">{lang.short}</span>
                    <span className="sc-lang-card__name">{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "format":
        return (
          <div className="sc-step-content">
            <div className="sc-step-header">
              <h2 className="sc-step-title">Interview Format</h2>
              <p className="sc-step-desc">
                {recommendation
                  ? "AI has analyzed the candidate and recommends a format below."
                  : "Choose the type of interview you'd like to conduct."}
              </p>
            </div>

            <div className="sc-format-grid">
              {FORMAT_OPTIONS.map((fmt) => {
                const isRecommended = recommendation?.recommendedFormat === fmt.id;
                const isSelected = sessionFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    className={`sc-format-card ${isSelected ? "sc-format-card--active" : ""}`}
                    onClick={() => setSessionFormat(fmt.id)}
                  >
                    {isRecommended && <span className="sc-format-card__rec">AI Recommended</span>}
                    <div className="sc-format-card__icon">{fmt.icon}</div>
                    <h3 className="sc-format-card__title">{fmt.label}</h3>
                    <p className="sc-format-card__desc">{fmt.desc}</p>
                    {isSelected && (
                      <div className="sc-format-card__check">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {recommendation?.reasoning && (
              <div className="sc-ai-insight">
                <div className="sc-ai-insight__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div>
                  <strong className="sc-ai-insight__label">AI Insight</strong>
                  <p className="sc-ai-insight__text">{recommendation.reasoning}</p>
                </div>
              </div>
            )}
          </div>
        );

      case "candidate":
        return (
          <div className="sc-step-content">
            <div className="sc-step-header">
              <h2 className="sc-step-title">Candidate Profile</h2>
              <p className="sc-step-desc">Provide candidate info so the AI can recommend tailored questions and interview format.</p>
            </div>

            <div className="sc-form-group">
              <label className="sc-label">Brief Candidate Info</label>
              <textarea
                className="sc-textarea"
                rows={4}
                value={candidateInfo}
                onChange={(e) => setCandidateInfo(e.target.value)}
                placeholder="e.g. Jane Smith, 3 years experience, React/Node.js developer, applying for Senior Frontend role..."
              />
            </div>

            <div className="sc-form-group">
              <label className="sc-label">Or Upload Resume (PDF)</label>
              <div
                ref={dropZoneRef}
                className={`sc-dropzone ${resumeFile ? "sc-dropzone--has-file" : ""}`}
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
                  <div className="sc-dropzone__file">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="sc-dropzone__file-name">{resumeFile.name}</span>
                    <button
                      type="button"
                      className="sc-dropzone__remove"
                      onClick={(e) => { e.stopPropagation(); setResumeFile(null); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="sc-dropzone__empty">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>Drag & drop a PDF here, or click to browse</span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              className="sc-btn sc-btn--primary"
              disabled={analyzing || (!candidateInfo.trim() && !resumeFile)}
              onClick={handleAnalyze}
            >
              {analyzing ? (
                <>
                  <span className="sc-spinner" />
                  Analyzing...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Analyze & Get Recommendations
                </>
              )}
            </button>
            {analyzeError && <p className="sc-error">{analyzeError}</p>}

            {recommendation?.candidateSummary && (
              <div className="sc-candidate-card">
                <h3 className="sc-candidate-card__title">Candidate Summary</h3>
                <div className="sc-candidate-card__row">
                  {recommendation.candidateSummary.name && (
                    <div className="sc-candidate-card__item">
                      <span className="sc-candidate-card__item-label">Name</span>
                      <span className="sc-candidate-card__item-value">{recommendation.candidateSummary.name}</span>
                    </div>
                  )}
                  {recommendation.candidateSummary.experienceLevel && (
                    <div className="sc-candidate-card__item">
                      <span className="sc-candidate-card__item-label">Level</span>
                      <span className={`sc-level-badge sc-level-badge--${recommendation.candidateSummary.experienceLevel}`}>
                        {recommendation.candidateSummary.experienceLevel}
                      </span>
                    </div>
                  )}
                  {recommendation.candidateSummary.yearsOfExperience != null && (
                    <div className="sc-candidate-card__item">
                      <span className="sc-candidate-card__item-label">Experience</span>
                      <span className="sc-candidate-card__item-value">{recommendation.candidateSummary.yearsOfExperience} years</span>
                    </div>
                  )}
                </div>
                {recommendation.candidateSummary.primaryTechStack?.length > 0 && (
                  <div className="sc-candidate-card__tech">
                    {recommendation.candidateSummary.primaryTechStack.map((t) => (
                      <span key={t} className="sc-tech-chip">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI-Generated Behavioral Questions */}
            {aiQuestions.length > 0 && (sessionFormat === "mock_interview" || sessionFormat === "both") && (
              <div className="sc-ai-questions">
                <h3 className="sc-ai-questions__title">AI-Generated Behavioral Questions</h3>
                <p className="sc-ai-questions__desc">These questions are tailored to the candidate's background.</p>
                <div className="sc-ai-questions__list">
                  {aiQuestions.map((q) => (
                    <label key={q._id} className={`sc-ai-q ${aiQuestionSelection[q._id] ? "sc-ai-q--selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={!!aiQuestionSelection[q._id]}
                        onChange={() => toggleAiQuestion(q._id)}
                      />
                      <div className="sc-ai-q__body">
                        <span className="sc-ai-q__cat">{q.category}</span>
                        <p className="sc-ai-q__text">{q.question}</p>
                        {q.rationale && <small className="sc-ai-q__rationale">{q.rationale}</small>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {recommendation?.suggestedCodingConfig && needsCodingQuestions && (
              <div className="sc-ai-coding-hint">
                <h3>AI Coding Suggestions</h3>
                <div className="sc-ai-coding-hint__details">
                  <span><strong>Difficulty:</strong> {recommendation.suggestedCodingConfig.difficulty}</span>
                  <span><strong>Problems:</strong> {recommendation.suggestedCodingConfig.problemCount}</span>
                  {recommendation.suggestedCodingConfig.categories?.length > 0 && (
                    <span><strong>Categories:</strong> {recommendation.suggestedCodingConfig.categories.join(", ")}</span>
                  )}
                  {recommendation.suggestedCodingConfig.focusAreas?.length > 0 && (
                    <span><strong>Focus:</strong> {recommendation.suggestedCodingConfig.focusAreas.join(", ")}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case "questions":
        return (
          <div className="sc-step-content">
            <div className="sc-step-header">
              <h2 className="sc-step-title">Select Coding Questions</h2>
              <p className="sc-step-desc">
                Pick problems from the question bank or add your own.
                <span className="sc-step-desc__count">{selectedIds.length} selected</span>
              </p>
            </div>

            <div className="sc-filters">
              <div className="sc-filters__selects">
                <select className="sc-select" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="sc-select" value={filterDiff} onChange={(e) => setFilterDiff(e.target.value)}>
                  <option value="">All difficulties</option>
                  {difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="sc-filters__right">
                <div className="sc-search-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    className="sc-search-wrap__input"
                    placeholder="Search questions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button className="sc-btn sc-btn--outline sc-btn--sm" onClick={() => setShowCustom(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Custom
                </button>
              </div>
            </div>

            {showCustom && (
              <div className="sc-custom-form">
                <div className="sc-custom-form__header">
                  <h3>Add Custom Question</h3>
                  <button type="button" className="sc-custom-form__close" onClick={() => setShowCustom(false)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <input className="sc-input" placeholder="Title" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
                <textarea className="sc-textarea" placeholder="Description (markdown supported)" value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} rows={3} />
                <div className="sc-form-row">
                  <select className="sc-select" value={customDiff} onChange={(e) => setCustomDiff(e.target.value)}>
                    {difficulties.map((d) => <option key={d}>{d}</option>)}
                  </select>
                  <input className="sc-input" placeholder="Category" value={customCat} onChange={(e) => setCustomCat(e.target.value)} />
                </div>
                <textarea className="sc-textarea" placeholder="Starter code (optional)" value={customStarter} onChange={(e) => setCustomStarter(e.target.value)} rows={2} />
                <div className="sc-custom-form__actions">
                  <button className="sc-btn sc-btn--primary sc-btn--sm" onClick={handleAddCustom}>Add & Select</button>
                  <button className="sc-btn sc-btn--ghost sc-btn--sm" onClick={() => setShowCustom(false)}>Cancel</button>
                </div>
              </div>
            )}

            {bankLoading ? (
              <div className="sc-loading">
                <span className="sc-spinner" />
                <span>Loading question bank...</span>
              </div>
            ) : bank.length === 0 ? (
              <div className="sc-empty">No questions found. Try adjusting your filters or add a custom question.</div>
            ) : (
              <div className="sc-question-grid">
                {bank.map((q) => {
                  const selected = selectedIds.includes(q.id);
                  const isSuggested = recommendation?.suggestedCodingConfig?.categories?.some(
                    (c) => q.category?.toLowerCase().includes(c.toLowerCase())
                  );
                  return (
                    <button
                      key={q.id}
                      type="button"
                      className={`sc-q-card ${selected ? "sc-q-card--selected" : ""}`}
                      onClick={() => toggleQuestion(q.id)}
                    >
                      <div className="sc-q-card__top">
                        <span className={`sc-diff sc-diff--${(q.difficulty || "").toLowerCase()}`}>{q.difficulty}</span>
                        <span className="sc-q-card__cat">{q.category}</span>
                        {isSuggested && <span className="sc-q-card__ai">AI Pick</span>}
                      </div>
                      <h4 className="sc-q-card__title">{q.title}</h4>
                      {selected && (
                        <div className="sc-q-card__check">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );

      case "settings":
        return (
          <div className="sc-step-content">
            <div className="sc-step-header">
              <h2 className="sc-step-title">Session Settings</h2>
              <p className="sc-step-desc">Configure permissions and time limits for your interview.</p>
            </div>

            <div className="sc-settings-grid">
              <label className="sc-toggle-card">
                <div className="sc-toggle-card__info">
                  <span className="sc-toggle-card__label">AI Hints</span>
                  <span className="sc-toggle-card__desc">Allow candidates to request AI hints during coding</span>
                </div>
                <div className={`sc-toggle ${settings.hintsEnabled ? "sc-toggle--on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={settings.hintsEnabled}
                    onChange={(e) => setSettings((p) => ({ ...p, hintsEnabled: e.target.checked }))}
                  />
                  <span className="sc-toggle__track" />
                </div>
              </label>

              <label className="sc-toggle-card">
                <div className="sc-toggle-card__info">
                  <span className="sc-toggle-card__label">AI Interruptions</span>
                  <span className="sc-toggle-card__desc">AI proactively offers guidance when candidates are stuck</span>
                </div>
                <div className={`sc-toggle ${settings.aiInterruptionsEnabled ? "sc-toggle--on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={settings.aiInterruptionsEnabled}
                    onChange={(e) => setSettings((p) => ({ ...p, aiInterruptionsEnabled: e.target.checked }))}
                  />
                  <span className="sc-toggle__track" />
                </div>
              </label>

              <label className="sc-toggle-card">
                <div className="sc-toggle-card__info">
                  <span className="sc-toggle-card__label">Show Test Cases</span>
                  <span className="sc-toggle-card__desc">Display test cases to candidates during the session</span>
                </div>
                <div className={`sc-toggle ${settings.showTestCases ? "sc-toggle--on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={settings.showTestCases}
                    onChange={(e) => setSettings((p) => ({ ...p, showTestCases: e.target.checked }))}
                  />
                  <span className="sc-toggle__track" />
                </div>
              </label>

              <div className="sc-time-card">
                <div className="sc-time-card__info">
                  <span className="sc-toggle-card__label">Time Limit</span>
                  <span className="sc-toggle-card__desc">Maximum duration for the interview</span>
                </div>
                <div className="sc-time-card__control">
                  <button
                    type="button"
                    className="sc-time-card__btn"
                    onClick={() => setSettings((p) => ({ ...p, timeLimitSeconds: Math.max(300, p.timeLimitSeconds - 300) }))}
                  >-</button>
                  <span className="sc-time-card__value">{Math.round(settings.timeLimitSeconds / 60)} min</span>
                  <button
                    type="button"
                    className="sc-time-card__btn"
                    onClick={() => setSettings((p) => ({ ...p, timeLimitSeconds: Math.min(10800, p.timeLimitSeconds + 300) }))}
                  >+</button>
                </div>
              </div>
            </div>

            {/* Summary before creating */}
            <div className="sc-review">
              <h3 className="sc-review__title">Review</h3>
              <div className="sc-review__grid">
                <div className="sc-review__item">
                  <span className="sc-review__item-label">Title</span>
                  <span className="sc-review__item-value">{title || "—"}</span>
                </div>
                <div className="sc-review__item">
                  <span className="sc-review__item-label">Format</span>
                  <span className="sc-review__item-value">{FORMAT_OPTIONS.find(f => f.id === sessionFormat)?.label || sessionFormat}</span>
                </div>
                <div className="sc-review__item">
                  <span className="sc-review__item-label">Language</span>
                  <span className="sc-review__item-value">{LANGUAGE_OPTIONS.find(l => l.value === language)?.label || language}</span>
                </div>
                {needsCodingQuestions && (
                  <div className="sc-review__item">
                    <span className="sc-review__item-label">Questions</span>
                    <span className="sc-review__item-value">{selectedIds.length} selected</span>
                  </div>
                )}
                {scheduledDate && (
                  <div className="sc-review__item">
                    <span className="sc-review__item-label">Scheduled</span>
                    <span className="sc-review__item-value">{scheduledDate} {scheduledTime}</span>
                  </div>
                )}
              </div>
            </div>

            {createError && <p className="sc-error">{createError}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  const isLastStep = step === visibleSteps.length - 1;

  return (
    <div className="sc-page">
      <div className="sc-page__blob sc-page__blob--1" />
      <div className="sc-page__blob sc-page__blob--2" />
      <div className="sc-page__blob sc-page__blob--3" />

      {/* Header */}
      <header className="sc-header">
        <div className="sc-header__left">
          <button type="button" className="sc-header__back" onClick={() => navigate("/interviewer")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <h1 className="sc-header__title">Create Session</h1>
        </div>
        <button
          type="button"
          className="sc-header__theme"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? "\u{1F319}" : "\u2600\uFE0F"}
        </button>
      </header>

      {/* Stepper */}
      <nav className="sc-stepper">
        {visibleSteps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`sc-stepper__step ${i === step ? "sc-stepper__step--active" : ""} ${i < step ? "sc-stepper__step--done" : ""}`}
            onClick={() => { if (i < step) setStep(i); }}
            disabled={i > step}
          >
            <span className="sc-stepper__dot">
              {i < step ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className="sc-stepper__label">{s.label}</span>
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="sc-main">
        <div className="sc-card">
          {renderStepContent()}
        </div>
      </main>

      {/* Footer Nav */}
      <footer className="sc-footer">
        <div className="sc-footer__inner">
          <button
            type="button"
            className="sc-btn sc-btn--ghost"
            onClick={handleBack}
            disabled={step === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back
          </button>

          {isLastStep ? (
            <button
              type="button"
              className="sc-btn sc-btn--primary sc-btn--lg"
              disabled={submitting || !title.trim() || (needsCodingQuestions && selectedIds.length === 0)}
              onClick={handleCreate}
            >
              {submitting ? (
                <>
                  <span className="sc-spinner" />
                  Creating...
                </>
              ) : (
                <>
                  Create Session
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="sc-btn sc-btn--primary"
              disabled={!canProceed()}
              onClick={handleNext}
            >
              Continue
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
