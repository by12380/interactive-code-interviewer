import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { generateMockInterview } from "../services/sessionService.js";
import MockCandidateSession from "../components/MockCandidateSession.jsx";
import "../styles/mock-interview-setup.css";

const EXPERIENCE_LEVELS = [
  { id: "junior", label: "Junior (0-2 yrs)", icon: "🌱" },
  { id: "mid", label: "Mid-Level (2-5 yrs)", icon: "🚀" },
  { id: "senior", label: "Senior (5-10 yrs)", icon: "⭐" },
  { id: "staff", label: "Staff+ (10+ yrs)", icon: "👑" },
];

const FOCUS_AREAS = [
  "Frontend", "Backend", "Full-Stack", "Data Structures & Algorithms",
  "System Design", "DevOps / Cloud", "Machine Learning", "Mobile",
  "Databases", "Security", "API Design", "Concurrency",
];

export default function MockInterviewSetup() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef(null);

  // Form state
  const [step, setStep] = useState("input"); // input | generating | review | interview
  const [inputMode, setInputMode] = useState("details"); // details | cv
  const [targetRole, setTargetRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [selectedFocusAreas, setSelectedFocusAreas] = useState([]);
  const [candidateInfo, setCandidateInfo] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeFileName, setResumeFileName] = useState("");

  // Guest name (for non-authenticated users)
  const [guestName, setGuestName] = useState("");

  // AI generation state
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [interviewPlan, setInterviewPlan] = useState(null);

  // Interview active state
  const [interviewActive, setInterviewActive] = useState(false);

  const toggleFocusArea = useCallback((area) => {
    setSelectedFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        setGenError("Please upload a PDF file.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setGenError("File size must be under 10MB.");
        return;
      }
      setResumeFile(file);
      setResumeFileName(file.name);
      setGenError("");
    }
  }, []);

  const handleRemoveFile = useCallback(() => {
    setResumeFile(null);
    setResumeFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleGenerate = useCallback(async () => {
    setGenError("");

    const hasDetails = targetRole.trim() || candidateInfo.trim() || experienceLevel;
    const hasCV = !!resumeFile;

    if (!hasDetails && !hasCV) {
      setGenError("Please provide some information — enter details or upload your CV.");
      return;
    }

    setStep("generating");
    setGenerating(true);

    try {
      const result = await generateMockInterview({
        candidateInfo: candidateInfo.trim(),
        resumeFile,
        targetRole: targetRole.trim(),
        experienceLevel,
        focusAreas: selectedFocusAreas.join(", "),
      });

      setInterviewPlan(result);
      setStep("review");
    } catch (e) {
      setGenError(e.message || "Failed to generate interview. Please try again.");
      setStep("input");
    } finally {
      setGenerating(false);
    }
  }, [targetRole, candidateInfo, experienceLevel, selectedFocusAreas, resumeFile]);

  const handleStartInterview = useCallback(() => {
    if (!interviewPlan?.interviewPlan) return;
    setInterviewActive(true);
    setStep("interview");
  }, [interviewPlan]);

  const handleExitInterview = useCallback(() => {
    setInterviewActive(false);
    setStep("review");
  }, []);

  const displayName = user?.displayName || guestName || "Candidate";

  // Full-screen interview — uses the same UI as CandidateSession
  if (step === "interview" && interviewActive && interviewPlan) {
    return (
      <MockCandidateSession
        interviewPlan={interviewPlan}
        onExit={handleExitInterview}
      />
    );
  }

  return (
    <div className="mock-setup">
      <div className="mock-setup__blob mock-setup__blob--1" />
      <div className="mock-setup__blob mock-setup__blob--2" />

      {/* Header */}
      <header className="mock-setup__header">
        <div className="mock-setup__header-left">
          <button
            type="button"
            className="mock-setup__back-btn"
            onClick={() => navigate("/home")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Home
          </button>
        </div>
        <div className="mock-setup__header-center">
          <h1 className="mock-setup__logo">Mock AI Interview</h1>
        </div>
        <div className="mock-setup__header-right">
          <button
            type="button"
            className="mock-setup__theme-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? "\u{1F319}" : "\u2600\uFE0F"}
          </button>
          {isAuthenticated && user ? (
            <span className="mock-setup__user-badge">
              {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
            </span>
          ) : (
            <button
              type="button"
              className="mock-setup__signin-btn"
              onClick={() => navigate("/login")}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="mock-setup__main">
        {/* ===== STEP: INPUT ===== */}
        {step === "input" && (
          <div className="mock-setup__input-step">
            <div className="mock-setup__hero">
              <div className="mock-setup__hero-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <h2 className="mock-setup__hero-title">
                Create Your Personalized Interview
              </h2>
              <p className="mock-setup__hero-subtitle">
                Tell us about yourself and AI will generate a tailored mock interview
                with behavioral questions and coding challenges matched to your profile.
              </p>
            </div>

            {/* Guest name prompt */}
            {!isAuthenticated && (
              <div className="mock-setup__guest-name">
                <label htmlFor="guest-name">Your Name</label>
                <input
                  id="guest-name"
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
            )}

            {/* Input mode tabs */}
            <div className="mock-setup__tabs">
              <button
                type="button"
                className={`mock-setup__tab ${inputMode === "details" ? "mock-setup__tab--active" : ""}`}
                onClick={() => setInputMode("details")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Enter Details
              </button>
              <button
                type="button"
                className={`mock-setup__tab ${inputMode === "cv" ? "mock-setup__tab--active" : ""}`}
                onClick={() => setInputMode("cv")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                Upload CV / Resume
              </button>
            </div>

            {/* Details form */}
            {inputMode === "details" && (
              <div className="mock-setup__form">
                <div className="mock-setup__field">
                  <label htmlFor="target-role">Target Role</label>
                  <input
                    id="target-role"
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g. Senior Frontend Engineer, Backend Developer, Full-Stack SWE"
                  />
                </div>

                <div className="mock-setup__field">
                  <label>Experience Level</label>
                  <div className="mock-setup__exp-grid">
                    {EXPERIENCE_LEVELS.map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        className={`mock-setup__exp-card ${experienceLevel === lvl.id ? "mock-setup__exp-card--active" : ""}`}
                        onClick={() => setExperienceLevel(lvl.id)}
                      >
                        <span className="mock-setup__exp-icon">{lvl.icon}</span>
                        <span className="mock-setup__exp-label">{lvl.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mock-setup__field">
                  <label>Focus Areas <span className="mock-setup__optional">(optional)</span></label>
                  <div className="mock-setup__focus-grid">
                    {FOCUS_AREAS.map((area) => (
                      <button
                        key={area}
                        type="button"
                        className={`mock-setup__focus-chip ${selectedFocusAreas.includes(area) ? "mock-setup__focus-chip--active" : ""}`}
                        onClick={() => toggleFocusArea(area)}
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mock-setup__field">
                  <label htmlFor="candidate-info">
                    Additional Info <span className="mock-setup__optional">(optional)</span>
                  </label>
                  <textarea
                    id="candidate-info"
                    value={candidateInfo}
                    onChange={(e) => setCandidateInfo(e.target.value)}
                    placeholder="Paste your resume text, describe your background, list technologies you know, mention specific areas you want to practice..."
                    rows={5}
                  />
                </div>
              </div>
            )}

            {/* CV upload */}
            {inputMode === "cv" && (
              <div className="mock-setup__cv-section">
                <div
                  className={`mock-setup__dropzone ${resumeFile ? "mock-setup__dropzone--has-file" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("mock-setup__dropzone--dragover"); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove("mock-setup__dropzone--dragover"); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("mock-setup__dropzone--dragover");
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      if (file.type !== "application/pdf") {
                        setGenError("Please upload a PDF file.");
                        return;
                      }
                      setResumeFile(file);
                      setResumeFileName(file.name);
                      setGenError("");
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                  {resumeFile ? (
                    <div className="mock-setup__file-info">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="mock-setup__file-name">{resumeFileName}</span>
                      <button
                        type="button"
                        className="mock-setup__file-remove"
                        onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="mock-setup__dropzone-content">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <p className="mock-setup__dropzone-text">
                        <strong>Click to upload</strong> or drag and drop
                      </p>
                      <p className="mock-setup__dropzone-hint">PDF files up to 10MB</p>
                    </div>
                  )}
                </div>

                <div className="mock-setup__cv-extras">
                  <div className="mock-setup__field">
                    <label htmlFor="cv-target-role">Target Role <span className="mock-setup__optional">(optional)</span></label>
                    <input
                      id="cv-target-role"
                      type="text"
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      placeholder="e.g. Senior Frontend Engineer"
                    />
                  </div>
                  <div className="mock-setup__field">
                    <label>Experience Level <span className="mock-setup__optional">(optional)</span></label>
                    <div className="mock-setup__exp-grid">
                      {EXPERIENCE_LEVELS.map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          className={`mock-setup__exp-card ${experienceLevel === lvl.id ? "mock-setup__exp-card--active" : ""}`}
                          onClick={() => setExperienceLevel(lvl.id)}
                        >
                          <span className="mock-setup__exp-icon">{lvl.icon}</span>
                          <span className="mock-setup__exp-label">{lvl.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {genError && <p className="mock-setup__error">{genError}</p>}

            <button
              type="button"
              className="mock-setup__generate-btn"
              onClick={handleGenerate}
              disabled={generating}
            >
              Generate My Interview
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </button>
          </div>
        )}

        {/* ===== STEP: GENERATING ===== */}
        {step === "generating" && (
          <div className="mock-setup__generating">
            <div className="mock-setup__generating-spinner" />
            <h2>Generating Your Interview...</h2>
            <p>AI is analyzing your profile and creating a personalized interview plan.</p>
            <div className="mock-setup__generating-steps">
              <div className="mock-setup__gen-step mock-setup__gen-step--active">
                <span className="mock-setup__gen-dot" />
                Analyzing your background
              </div>
              <div className="mock-setup__gen-step">
                <span className="mock-setup__gen-dot" />
                Selecting behavioral questions
              </div>
              <div className="mock-setup__gen-step">
                <span className="mock-setup__gen-dot" />
                Configuring coding challenges
              </div>
              <div className="mock-setup__gen-step">
                <span className="mock-setup__gen-dot" />
                Finalizing interview plan
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP: REVIEW ===== */}
        {step === "review" && interviewPlan && (
          <div className="mock-setup__review">
            <div className="mock-setup__review-header">
              <h2>{interviewPlan.interviewPlan?.title || "Your Mock Interview"}</h2>
              <p className="mock-setup__review-reasoning">{interviewPlan.reasoning}</p>
            </div>

            {/* Candidate Summary */}
            {interviewPlan.candidateSummary && (
              <div className="mock-setup__summary-card">
                <h3>Candidate Profile</h3>
                <div className="mock-setup__summary-grid">
                  <div className="mock-setup__summary-item">
                    <span className="mock-setup__summary-label">Name</span>
                    <span className="mock-setup__summary-value">
                      {interviewPlan.candidateSummary.name || displayName}
                    </span>
                  </div>
                  <div className="mock-setup__summary-item">
                    <span className="mock-setup__summary-label">Level</span>
                    <span className="mock-setup__summary-value mock-setup__summary-value--badge">
                      {interviewPlan.candidateSummary.experienceLevel}
                    </span>
                  </div>
                  <div className="mock-setup__summary-item">
                    <span className="mock-setup__summary-label">Target Role</span>
                    <span className="mock-setup__summary-value">
                      {interviewPlan.candidateSummary.targetRole || targetRole || "Software Engineer"}
                    </span>
                  </div>
                  {interviewPlan.candidateSummary.primaryTechStack?.length > 0 && (
                    <div className="mock-setup__summary-item mock-setup__summary-item--full">
                      <span className="mock-setup__summary-label">Tech Stack</span>
                      <div className="mock-setup__tech-chips">
                        {interviewPlan.candidateSummary.primaryTechStack.map((tech) => (
                          <span key={tech} className="mock-setup__tech-chip">{tech}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Interview Plan Details */}
            <div className="mock-setup__plan-cards">
              {/* Overview */}
              <div className="mock-setup__plan-card">
                <div className="mock-setup__plan-card-header">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <h3>Interview Overview</h3>
                </div>
                <div className="mock-setup__plan-stats">
                  <div className="mock-setup__plan-stat">
                    <span className="mock-setup__plan-stat-value">
                      {interviewPlan.interviewPlan?.totalTimeMinutes || 60} min
                    </span>
                    <span className="mock-setup__plan-stat-label">Duration</span>
                  </div>
                  <div className="mock-setup__plan-stat">
                    <span className="mock-setup__plan-stat-value">
                      {interviewPlan.interviewPlan?.difficulty || "Medium"}
                    </span>
                    <span className="mock-setup__plan-stat-label">Difficulty</span>
                  </div>
                  <div className="mock-setup__plan-stat">
                    <span className="mock-setup__plan-stat-value">
                      {interviewPlan.interviewPlan?.behavioralQuestions?.length || 0}
                    </span>
                    <span className="mock-setup__plan-stat-label">Behavioral</span>
                  </div>
                  <div className="mock-setup__plan-stat">
                    <span className="mock-setup__plan-stat-value">
                      {interviewPlan.interviewPlan?.codingConfig?.problemCount || 0}
                    </span>
                    <span className="mock-setup__plan-stat-label">Coding</span>
                  </div>
                  {interviewPlan.interviewPlan?.includeSystemDesign && (
                    <div className="mock-setup__plan-stat">
                      <span className="mock-setup__plan-stat-value">1</span>
                      <span className="mock-setup__plan-stat-label">System Design</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Behavioral Questions Preview */}
              {interviewPlan.interviewPlan?.behavioralQuestions?.length > 0 && (
                <div className="mock-setup__plan-card">
                  <div className="mock-setup__plan-card-header">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <h3>Behavioral Questions</h3>
                  </div>
                  <ul className="mock-setup__bq-list">
                    {interviewPlan.interviewPlan.behavioralQuestions.map((q, i) => (
                      <li key={q.id || i} className="mock-setup__bq-item">
                        <span className="mock-setup__bq-category">{q.category}</span>
                        <span className="mock-setup__bq-question">{q.question}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Coding Config */}
              {interviewPlan.interviewPlan?.codingConfig && (
                <div className="mock-setup__plan-card">
                  <div className="mock-setup__plan-card-header">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                    <h3>Coding Challenges</h3>
                  </div>
                  <div className="mock-setup__coding-details">
                    <p>
                      <strong>{interviewPlan.interviewPlan.codingConfig.problemCount}</strong> problem{interviewPlan.interviewPlan.codingConfig.problemCount !== 1 ? "s" : ""} at{" "}
                      <strong>{interviewPlan.interviewPlan.codingConfig.difficulty}</strong> difficulty
                    </p>
                    {interviewPlan.interviewPlan.codingConfig.focusAreas?.length > 0 && (
                      <div className="mock-setup__coding-focus">
                        <span>Focus areas:</span>
                        <div className="mock-setup__tech-chips">
                          {interviewPlan.interviewPlan.codingConfig.focusAreas.map((area) => (
                            <span key={area} className="mock-setup__tech-chip">{area}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {interviewPlan.interviewPlan.codingConfig.categories?.length > 0 && (
                      <div className="mock-setup__coding-focus">
                        <span>Categories:</span>
                        <div className="mock-setup__tech-chips">
                          {interviewPlan.interviewPlan.codingConfig.categories.map((cat) => (
                            <span key={cat} className="mock-setup__tech-chip">{cat}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mock-setup__review-actions">
              <button
                type="button"
                className="mock-setup__review-btn mock-setup__review-btn--secondary"
                onClick={() => { setStep("input"); setInterviewPlan(null); }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Modify Details
              </button>
              <button
                type="button"
                className="mock-setup__review-btn mock-setup__review-btn--regenerate"
                onClick={handleGenerate}
                disabled={generating}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Regenerate
              </button>
              <button
                type="button"
                className="mock-setup__review-btn mock-setup__review-btn--primary"
                onClick={handleStartInterview}
              >
                Start Interview
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
