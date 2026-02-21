import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useTheme } from "../contexts/ThemeContext.jsx";
import InterviewLauncher from "../components/InterviewLauncher.jsx";
import InterviewSimulation from "../components/InterviewSimulation.jsx";

export default function InterviewHub() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [isSimActive, setIsSimActive] = useState(false);
  const [simConfig, setSimConfig] = useState(null);

  // Guest name collection for mock interview
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [nameError, setNameError] = useState("");

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

  const handleGuestKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleGuestContinue();
    }
  }, [handleGuestContinue]);

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

  const handleLogout = useCallback(async () => {
    await logOut();
    navigate("/", { replace: true });
  }, [logOut, navigate]);

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
    <div className="interview-hub">
      <div className="interview-hub__blob interview-hub__blob--1" />
      <div className="interview-hub__blob interview-hub__blob--2" />

      <header className="interview-hub__header">
        <div className="interview-hub__header-left">
          <button
            type="button"
            className="interview-hub__back-btn"
            onClick={() => navigate("/")}
            aria-label="Back to home"
          >
            <span>&larr;</span>
            Home
          </button>
        </div>
        <div className="interview-hub__header-right">
          <button
            type="button"
            className="interview-hub__theme-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? "\u{1F319}" : "\u2600\uFE0F"}
          </button>
          {isAuthenticated && user ? (
            <div className="interview-hub__user">
              <span className="interview-hub__avatar">
                {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
              </span>
              <button
                type="button"
                className="interview-hub__logout-btn"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="interview-hub__signin-btn"
              onClick={() => navigate("/login")}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="interview-hub__main">
        <div className="interview-hub__hero">
          <h1 className="interview-hub__title">Interview Center</h1>
          <p className="interview-hub__subtitle">
            Practice under real interview conditions or join a live session with a human interviewer. No account required.
          </p>
        </div>

        <div className="interview-hub__cards">
          <button
            type="button"
            className="interview-hub__card interview-hub__card--mock"
            onClick={handleMockClick}
          >
            <div className="interview-hub__card-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <h2 className="interview-hub__card-title">Mock AI Interview</h2>
            <p className="interview-hub__card-desc">
              A full structured interview simulation — behavioral questions, timed coding challenges, and optional system design. Get scored and graded.
            </p>
            <ul className="interview-hub__card-features">
              <li>Choose interviewer persona (friendly, strict, neutral)</li>
              <li>Behavioral + coding + system design rounds</li>
              <li>Timed with countdown enforcement</li>
              <li>Detailed feedback and scoring at the end</li>
            </ul>
            <span className="interview-hub__card-cta">Configure &amp; Start &rarr;</span>
          </button>

          <button
            type="button"
            className="interview-hub__card interview-hub__card--live"
            onClick={() => navigate("/join")}
          >
            <div className="interview-hub__card-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 10l5-5" />
                <path d="M20 5v4h-4" />
                <path d="M9 14l-5 5" />
                <path d="M4 19v-4h4" />
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            </div>
            <h2 className="interview-hub__card-title">Join Live Session</h2>
            <p className="interview-hub__card-desc">
              Enter a session code from your interviewer to join a live, monitored coding interview in real time.
            </p>
            <ul className="interview-hub__card-features">
              <li>Real-time code syncing with interviewer</li>
              <li>Live monitoring and chat</li>
              <li>Interviewer-assigned problems</li>
              <li>Just enter your name and session code</li>
            </ul>
            <span className="interview-hub__card-cta">Join Session &rarr;</span>
          </button>
        </div>
      </main>

      {/* Guest name prompt overlay */}
      {showNamePrompt && (
        <div className="interview-hub__name-overlay">
          <div className="interview-hub__name-card">
            <h2 className="interview-hub__name-title">Before we begin</h2>
            <p className="interview-hub__name-desc">
              Enter your name so the interviewer can address you. No account needed.
            </p>
            <label className="interview-hub__name-label" htmlFor="guest-name">
              Your Name
            </label>
            <input
              id="guest-name"
              type="text"
              className="interview-hub__name-input"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={handleGuestKeyDown}
              placeholder="e.g. Jane Smith"
              autoFocus
            />
            {nameError && <p className="interview-hub__name-error">{nameError}</p>}
            <div className="interview-hub__name-actions">
              <button
                type="button"
                className="interview-hub__name-btn interview-hub__name-btn--primary"
                onClick={handleGuestContinue}
              >
                Continue
              </button>
              <button
                type="button"
                className="interview-hub__name-btn interview-hub__name-btn--ghost"
                onClick={() => { setShowNamePrompt(false); setNameError(""); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
