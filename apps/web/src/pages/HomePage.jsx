import { useCallback, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { joinSession } from "../services/sessionService.js";

function extractShareCode(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  const urlMatch = trimmed.match(/\/join\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1].toUpperCase();
  return trimmed.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logOut, activeMode, setActiveMode } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const quickJoinRef = useRef(null);
  const modulesRef = useRef(null);
  const codeInputRef = useRef(null);

  // Quick-join state
  const [rawInput, setRawInput] = useState("");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const shareCode = extractShareCode(rawInput);

  useEffect(() => {
    if (user?.displayName) setDisplayName(user.displayName);
  }, [user?.displayName]);

  const firstName = (user?.displayName || user?.email || "there")
    .split(/[ @]/)
    .filter(Boolean)[0];

  const handleLogout = useCallback(async () => {
    await logOut();
  }, [logOut]);

  const handleHostClick = useCallback(() => {
    if (isAuthenticated) {
      navigate("/interviewer");
    } else {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  const handleMockClick = useCallback(() => {
    navigate("/mock-interview");
  }, [navigate]);

  const scrollToQuickJoin = useCallback(() => {
    quickJoinRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      codeInputRef.current?.focus();
    }, 250);
  }, []);

  const scrollToModules = useCallback(() => {
    modulesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // --- Quick Join Handlers ---
  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    if (val.includes("/join/")) {
      setRawInput(extractShareCode(val));
    } else {
      setRawInput(val.toUpperCase());
    }
  }, []);

  const handlePaste = useCallback((e) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted.includes("/join/")) {
      e.preventDefault();
      setRawInput(extractShareCode(pasted));
    }
  }, []);

  const handleJoin = useCallback(async () => {
    if (!shareCode) {
      setJoinError("Enter a session code or paste the invite link.");
      return;
    }
    setJoining(true);
    setJoinError("");
    try {
      const { session, candidateId } = await joinSession(shareCode, {
        userId: user?.uid || null,
        displayName: displayName || "Anonymous",
      });
      navigate(`/session/${session.id}/${candidateId}`);
    } catch (e) {
      setJoinError(e.message || "Could not join session. Check the code and try again.");
    }
    setJoining(false);
  }, [shareCode, user, displayName, navigate]);

  const handleJoinKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleJoin();
      }
    },
    [handleJoin]
  );

  // --- Practice ---
  const handlePracticeClick = useCallback(() => {
    if (isAuthenticated) {
      navigate("/practice");
    } else {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  const handleSwitchMode = useCallback(() => {
    setActiveMode(null);
    navigate("/select-role", { replace: true });
  }, [setActiveMode, navigate]);

  const allModuleCards = [
    {
      key: "practice",
      tone: "practice",
      modes: ["practice"],
      eyebrow: "For candidates",
      title: "Practice Mode",
      description: "Sharpen core problem-solving with guided coding, AI feedback, and progress tracking.",
      bullets: [
        "Work through curated coding challenges",
        "Get AI hints without leaving the editor",
        "Build streaks, XP, and confidence over time",
      ],
      cta: isAuthenticated ? "Open practice workspace" : "Sign in to practice",
      onClick: handlePracticeClick,
      locked: !isAuthenticated,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 9l3 3-3 3" />
          <line x1="14" y1="15" x2="18" y2="15" />
        </svg>
      ),
    },
    {
      key: "mock",
      tone: "mock",
      modes: ["practice"],
      eyebrow: "AI simulation",
      title: "Mock AI Interview",
      description: "Run a structured interview experience with tailored behavioral and coding rounds.",
      bullets: [
        "Personalize questions from your CV or profile",
        "Practice under time pressure with scoring",
        "Review interview-ready feedback afterward",
      ],
      cta: "Start a mock interview",
      onClick: handleMockClick,
      locked: false,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
    },
    {
      key: "hosting",
      tone: "hosting",
      modes: ["interviewer"],
      eyebrow: "For interviewers",
      title: "Live Interview Hosting",
      description: "Create a live coding session, share an invite, and watch candidates solve in real time.",
      bullets: [
        "Pick questions or add your own prompt",
        "Track candidate progress live",
        "Review results and playback after the session",
      ],
      cta: isAuthenticated ? "Create a live session" : "Sign in to host sessions",
      onClick: handleHostClick,
      locked: !isAuthenticated,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="16" y1="11" x2="22" y2="11" />
        </svg>
      ),
    },
    {
      key: "join",
      tone: "join",
      modes: ["practice", "interviewer"],
      eyebrow: "Instant entry",
      title: "Join a Session",
      description: "Paste a session link or code and jump into a live interview without a heavy setup flow.",
      bullets: [
        "Supports invite links and share codes",
        "Works for guests and signed-in users",
        "Fastest way to enter a scheduled interview",
      ],
      cta: "Use quick join below",
      onClick: scrollToQuickJoin,
      locked: false,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
      ),
    },
  ];

  const moduleCards = activeMode
    ? allModuleCards.filter((c) => c.modes.includes(activeMode))
    : allModuleCards;

  return (
    <div className="home-page">
      <div className="home-page__blob home-page__blob--1" />
      <div className="home-page__blob home-page__blob--2" />
      <div className="home-page__blob home-page__blob--3" />

      <header className="home-page__header">
        <div className="home-page__brand">
          <span className="home-page__logo-icon">&#x1F4BB;</span>
          <span className="home-page__logo-text">CodeInterview</span>
        </div>
        <div className="home-page__header-right">
          {isAuthenticated && activeMode && (
            <button
              type="button"
              className="home-page__mode-badge"
              onClick={handleSwitchMode}
              title="Switch mode"
            >
              <span className={`home-page__mode-dot home-page__mode-dot--${activeMode}`} />
              {activeMode === "practice" ? "Practice Mode" : "Interviewer Mode"}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="home-page__theme-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? "\u{1F319}" : "\u2600\uFE0F"}
          </button>
          {isAuthenticated && user ? (
            <div className="home-page__user">
              <span className="home-page__avatar">
                {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
              </span>
              <span className="home-page__username">
                {user.displayName || user.email}
              </span>
              <button type="button" className="home-page__logout-btn" onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          ) : (
            <button type="button" className="home-page__login-btn" onClick={() => navigate("/login")}>
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="home-page__main">
        <div className="home-page__hero">
          <div className="home-page__hero-copy">
            <span className="home-page__eyebrow">
              {activeMode === "practice"
                ? "Practice dashboard"
                : activeMode === "interviewer"
                ? "Interviewer dashboard"
                : "Platform dashboard"}
            </span>
            <h1 className="home-page__title">
              {isAuthenticated ? `Welcome back, ${firstName}.` : "Choose the interview flow you need right now."}
            </h1>
            <p className="home-page__subtitle">
              {activeMode === "practice"
                ? "Sharpen your skills with AI-guided practice, mock interviews, and personalized progress tracking."
                : activeMode === "interviewer"
                ? "Create live coding sessions, monitor candidates in real time, and review results."
                : "Practice coding, run mock interviews, host live sessions, or jump into a scheduled interview."}
            </p>
            <div className="home-page__hero-actions">
              <button type="button" className="home-page__hero-btn home-page__hero-btn--primary" onClick={scrollToModules}>
                Explore modules
              </button>
              <button type="button" className="home-page__hero-btn home-page__hero-btn--secondary" onClick={scrollToQuickJoin}>
                Join with a code
              </button>
            </div>
            <div className="home-page__hero-pills">
              <span className="home-page__hero-pill">AI-guided practice</span>
              <span className="home-page__hero-pill">Mock interview simulations</span>
              <span className="home-page__hero-pill">Live session hosting</span>
            </div>
          </div>

          <div className="home-page__hero-panel">
            <span className="home-page__hero-panel-label">At a glance</span>
            <div className="home-page__hero-stats">
              <div className="home-page__hero-stat">
                <strong>4</strong>
                <span>core modules</span>
              </div>
              <div className="home-page__hero-stat">
                <strong>2</strong>
                <span>paths: candidate + interviewer</span>
              </div>
              <div className="home-page__hero-stat">
                <strong>1</strong>
                <span>shared interview workspace</span>
              </div>
            </div>
            <div className="home-page__hero-checklist">
              <div className="home-page__hero-check">
                <span />
                <p>Practice mode for solo prep with AI support and progress tracking.</p>
              </div>
              <div className="home-page__hero-check">
                <span />
                <p>Mock interviews for realistic simulation before the real thing.</p>
              </div>
              <div className="home-page__hero-check">
                <span />
                <p>Live hosting and quick join for actual interviewer-candidate sessions.</p>
              </div>
            </div>
          </div>
        </div>

        <section className="home-page__modules" ref={modulesRef}>
          <div className="home-page__section-heading">
            <span className="home-page__section-tag">Modules</span>
            <h2 className="home-page__section-title">One platform, the same four experiences you saw on the landing page</h2>
            <p className="home-page__section-subtitle">
              Each module now matches the product story: practice, mock interviews, live hosting, and quick joining a scheduled session.
            </p>
          </div>
          <div className="home-page__modules-grid">
            {moduleCards.map((module) => (
              <button
                key={module.key}
                type="button"
                className={`home-page__module-card home-page__module-card--${module.tone}`}
                onClick={module.onClick}
              >
                <div className="home-page__module-top">
                  <span className="home-page__module-eyebrow">{module.eyebrow}</span>
                  {module.locked && <span className="home-page__module-lock">Account required</span>}
                </div>
                <div className="home-page__module-icon">{module.icon}</div>
                <h3 className="home-page__module-title">{module.title}</h3>
                <p className="home-page__module-desc">{module.description}</p>
                <ul className="home-page__module-list">
                  {module.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
                <span className="home-page__module-cta">
                  {module.cta}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="home-page__quick-join" ref={quickJoinRef}>
          <div className="home-page__quick-join-inner">
            <div className="home-page__quick-join-copy">
              <div className="home-page__quick-join-badge">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Join a live session
              </div>
              <h2 className="home-page__quick-join-title">Got an invite link or session code?</h2>
              <p className="home-page__quick-join-desc">
                Paste the invite or enter the code to jump directly into your interview. Guests can join instantly, and signed-in users keep their identity and history in sync.
              </p>
              <div className="home-page__quick-join-benefits">
                <div className="home-page__quick-join-benefit">
                  <strong>Paste a full link</strong>
                  <span>We automatically detect and extract the share code.</span>
                </div>
                <div className="home-page__quick-join-benefit">
                  <strong>No heavy setup</strong>
                  <span>Useful for scheduled interviews when you just need to get in fast.</span>
                </div>
                <div className="home-page__quick-join-benefit">
                  <strong>Works for guests</strong>
                  <span>Candidates can join even without creating an account first.</span>
                </div>
              </div>
            </div>

            <div className="home-page__quick-join-form-card">
              <div className="home-page__quick-join-form">
                <div className="home-page__quick-join-row">
                  <input
                    ref={codeInputRef}
                    className="home-page__quick-join-input home-page__quick-join-input--code"
                    value={rawInput}
                    onChange={handleInputChange}
                    onPaste={handlePaste}
                    onKeyDown={handleJoinKeyDown}
                    placeholder="Session code or invite link"
                    autoFocus
                  />
                  <input
                    className="home-page__quick-join-input home-page__quick-join-input--name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onKeyDown={handleJoinKeyDown}
                    placeholder="Your name"
                  />
                  <button
                    type="button"
                    className="home-page__quick-join-btn"
                    onClick={handleJoin}
                    disabled={joining || !shareCode}
                  >
                    {joining ? (
                      <span className="home-page__quick-join-spinner" />
                    ) : (
                      <>
                        Join
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
                {joinError && <p className="home-page__quick-join-error">{joinError}</p>}
                {shareCode && rawInput !== shareCode && (
                  <p className="home-page__quick-join-detected">
                    Detected code: <strong>{shareCode}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
