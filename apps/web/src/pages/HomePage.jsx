import { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { joinSession } from "../services/sessionService.js";
import InterviewLauncher from "../components/InterviewLauncher.jsx";
import InterviewSimulation from "../components/InterviewSimulation.jsx";

function extractShareCode(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  const urlMatch = trimmed.match(/\/join\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1].toUpperCase();
  return trimmed.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Quick-join state
  const [rawInput, setRawInput] = useState("");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const shareCode = extractShareCode(rawInput);

  // Mock interview launcher state
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [isSimActive, setIsSimActive] = useState(false);
  const [simConfig, setSimConfig] = useState(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    if (user?.displayName) setDisplayName(user.displayName);
  }, [user?.displayName]);

  const handleLogout = useCallback(async () => {
    await logOut();
  }, [logOut]);

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

  // --- Mock Interview Handlers ---
  const handleMockClick = useCallback(() => {
    if (isAuthenticated) {
      setIsLauncherOpen(true);
    } else {
      setShowNamePrompt(true);
    }
  }, [isAuthenticated]);

  const handleGuestContinue = useCallback(() => {
    if (!guestName.trim()) {
      setNameError("Please enter your name to continue.");
      return;
    }
    setNameError("");
    setShowNamePrompt(false);
    setIsLauncherOpen(true);
  }, [guestName]);

  const handleGuestKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleGuestContinue();
      }
    },
    [handleGuestContinue]
  );

  const handleStartSim = useCallback((config) => {
    setSimConfig(config);
    setIsLauncherOpen(false);
    setIsSimActive(true);
  }, []);

  const handleExitSim = useCallback(() => {
    setIsSimActive(false);
    setSimConfig(null);
  }, []);

  const handleSimComplete = useCallback(() => {
    setIsSimActive(false);
    setSimConfig(null);
  }, []);

  // --- Practice ---
  const handlePracticeClick = useCallback(() => {
    if (isAuthenticated) {
      navigate("/practice");
    } else {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // If mock sim is active, render it full-screen
  if (isSimActive && simConfig) {
    return (
      <InterviewSimulation
        mode={simConfig.mode}
        persona={simConfig.persona}
        enableVideoRecording={simConfig.enableVideo}
        customConfig={simConfig.customConfig}
        onComplete={handleSimComplete}
        onExit={handleExitSim}
      />
    );
  }

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
        {/* Hero */}
        <div className="home-page__hero">
          <h1 className="home-page__title">
            Your Interview Hub
          </h1>
          <p className="home-page__subtitle">
            Join a live session, host your own interview, or practice coding problems — all in one place.
          </p>
        </div>

        {/* ====== PRIMARY: Quick Join ====== */}
        <section className="home-page__quick-join">
          <div className="home-page__quick-join-inner">
            <div className="home-page__quick-join-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Join a Live Session
            </div>
            <p className="home-page__quick-join-desc">
              Have a session code? Enter it below to join an interview instantly. No account needed.
            </p>
            <div className="home-page__quick-join-form">
              <div className="home-page__quick-join-row">
                <input
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
        </section>

        {/* ====== SECONDARY: Action Cards ====== */}
        <section className="home-page__actions">
          <div className="home-page__actions-grid">
            {/* Create & Host */}
            <button
              type="button"
              className="home-page__action-card home-page__action-card--create"
              onClick={() => {
                if (isAuthenticated) {
                  navigate("/interviewer");
                } else {
                  navigate("/login");
                }
              }}
            >
              <div className="home-page__action-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="16" y1="11" x2="22" y2="11" />
                </svg>
              </div>
              <div className="home-page__action-text">
                <h3 className="home-page__action-title">Create &amp; Host Session</h3>
                <p className="home-page__action-desc">
                  Set up a live interview, pick questions, and share a code with candidates.
                </p>
                <ul className="home-page__action-features">
                  <li>Pick from question bank or add custom</li>
                  <li>Monitor code in real time</li>
                  <li>Share invite code or link</li>
                </ul>
              </div>
              {!isAuthenticated && (
                <span className="home-page__action-note">Requires a free account</span>
              )}
              <span className="home-page__action-cta">
                {isAuthenticated ? "Create Session \u2192" : "Sign In to Host \u2192"}
              </span>
            </button>

            {/* Mock AI Interview */}
            <button
              type="button"
              className="home-page__action-card home-page__action-card--mock"
              onClick={handleMockClick}
            >
              <div className="home-page__action-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div className="home-page__action-text">
                <h3 className="home-page__action-title">Mock AI Interview</h3>
                <p className="home-page__action-desc">
                  Full structured interview simulation with behavioral questions, timed coding, and scoring.
                </p>
                <ul className="home-page__action-features">
                  <li>Choose interviewer persona</li>
                  <li>Behavioral + coding rounds</li>
                  <li>Detailed feedback &amp; grading</li>
                </ul>
              </div>
              <span className="home-page__action-cta">Configure &amp; Start &rarr;</span>
            </button>
          </div>
        </section>

        {/* ====== TERTIARY: Practice ====== */}
        <section className="home-page__practice-section">
          <button
            type="button"
            className="home-page__practice-card"
            onClick={handlePracticeClick}
          >
            <div className="home-page__practice-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 9l3 3-3 3" />
                <line x1="14" y1="15" x2="18" y2="15" />
              </svg>
            </div>
            <div className="home-page__practice-text">
              <h3 className="home-page__practice-title">Practice Problems</h3>
              <p className="home-page__practice-desc">
                Solve coding problems at your own pace with AI hints, track XP, and build your skills.
              </p>
            </div>
            <span className="home-page__practice-cta">
              {isAuthenticated ? "Start Practicing \u2192" : "Sign In to Practice \u2192"}
            </span>
          </button>
        </section>
      </main>

      {/* Guest name prompt for mock interview */}
      {showNamePrompt && (
        <div className="home-page__overlay" onClick={() => { setShowNamePrompt(false); setNameError(""); }}>
          <div className="home-page__name-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="home-page__name-title">Before we begin</h2>
            <p className="home-page__name-desc">
              Enter your name so the AI interviewer can address you. No account needed.
            </p>
            <label className="home-page__name-label" htmlFor="guest-name-home">
              Your Name
            </label>
            <input
              id="guest-name-home"
              type="text"
              className="home-page__name-input"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={handleGuestKeyDown}
              placeholder="e.g. Jane Smith"
              autoFocus
            />
            {nameError && <p className="home-page__name-error">{nameError}</p>}
            <div className="home-page__name-actions">
              <button
                type="button"
                className="home-page__name-btn home-page__name-btn--primary"
                onClick={handleGuestContinue}
              >
                Continue
              </button>
              <button
                type="button"
                className="home-page__name-btn home-page__name-btn--ghost"
                onClick={() => { setShowNamePrompt(false); setNameError(""); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mock Interview Launcher */}
      {isLauncherOpen && (
        <InterviewLauncher
          onStart={handleStartSim}
          onClose={() => setIsLauncherOpen(false)}
          user={user || { displayName: guestName, username: guestName }}
        />
      )}
    </div>
  );
}
