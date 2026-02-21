import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useTheme } from "../contexts/ThemeContext.jsx";

export default function HomePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = useCallback(async () => {
    await logOut();
    navigate("/", { replace: true });
  }, [logOut, navigate]);

  const handlePracticeClick = useCallback(() => {
    if (isAuthenticated) {
      navigate("/practice");
    } else {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="home-page">
      <div className="home-page__blob home-page__blob--1" />
      <div className="home-page__blob home-page__blob--2" />

      <header className="home-page__header">
        <div className="home-page__brand">
          <span className="home-page__logo-icon">&#x1F4BB;</span>
          <span className="home-page__logo-text">CodePractice</span>
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
              <button
                type="button"
                className="home-page__logout-btn"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="home-page__login-btn"
              onClick={() => navigate("/login")}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="home-page__main">
        <div className="home-page__hero">
          <h1 className="home-page__title">What would you like to do?</h1>
          <p className="home-page__subtitle">
            Choose your path — sharpen your skills at your own pace, or put them to the test in a real interview setting.
          </p>
        </div>

        <div className="home-page__cards">
          <button
            type="button"
            className="home-page__card home-page__card--practice"
            onClick={handlePracticeClick}
          >
            <div className="home-page__card-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 9l3 3-3 3" />
                <line x1="14" y1="15" x2="18" y2="15" />
              </svg>
            </div>
            <h2 className="home-page__card-title">Practice</h2>
            <p className="home-page__card-desc">
              Solve coding problems at your own pace with an AI tutor by your side. No timer pressure — just learn, experiment, and improve.
            </p>
            <ul className="home-page__card-features">
              <li>Pick any problem, any difficulty</li>
              <li>AI hints and feedback as you code</li>
              <li>Track XP, streaks, and achievements</li>
              <li>Code replay and translation tools</li>
            </ul>
            {!isAuthenticated && (
              <span className="home-page__card-note">Requires a free account to track your progress</span>
            )}
            <span className="home-page__card-cta">
              {isAuthenticated ? "Start Practicing \u2192" : "Sign In to Practice \u2192"}
            </span>
          </button>

          <button
            type="button"
            className="home-page__card home-page__card--interview"
            onClick={() => navigate("/interview")}
          >
            <div className="home-page__card-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2 className="home-page__card-title">Interviews</h2>
            <p className="home-page__card-desc">
              Simulate real interviews with AI or join a live session with a human interviewer. Timed, structured, and scored.
            </p>
            <ul className="home-page__card-features">
              <li>Full mock interviews with AI</li>
              <li>Choose interviewer persona and difficulty</li>
              <li>Join live sessions with real interviewers</li>
              <li>No account required — just enter your name</li>
            </ul>
            <span className="home-page__card-cta">Go to Interviews &rarr;</span>
          </button>
        </div>
      </main>
    </div>
  );
}
