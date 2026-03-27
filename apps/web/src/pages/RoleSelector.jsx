import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useTheme } from "../contexts/ThemeContext.jsx";

export default function RoleSelector() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setActiveMode, logOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const redirectTarget = location.state?.from || null;

  const firstName = (user?.displayName || user?.email || "there")
    .split(/[ @]/)
    .filter(Boolean)[0];

  const handleSelect = useCallback(
    (mode) => {
      setActiveMode(mode);
      if (redirectTarget) {
        navigate(redirectTarget, { replace: true });
      } else if (mode === "practice") {
        navigate("/practice");
      } else {
        navigate("/interviewer");
      }
    },
    [setActiveMode, navigate, redirectTarget]
  );

  const handleLogout = useCallback(async () => {
    await logOut();
    navigate("/", { replace: true });
  }, [logOut, navigate]);

  return (
    <div className="role-selector">
      <div className="role-selector__blob role-selector__blob--1" />
      <div className="role-selector__blob role-selector__blob--2" />
      <div className="role-selector__blob role-selector__blob--3" />

      <div className="role-selector__card">
        <div className="role-selector__header">
          <button
            type="button"
            className="role-selector__theme-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? "\u{1F319}" : "\u2600\uFE0F"}
          </button>
        </div>

        <div className="role-selector__brand">
          <div className="role-selector__logo">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
              <line x1="12" y1="2" x2="12" y2="22" opacity="0.3" />
            </svg>
          </div>
          <h1 className="role-selector__title">
            Welcome, {firstName}
          </h1>
          <p className="role-selector__subtitle">
            What brings you here today?
          </p>
        </div>

        <div className="role-selector__options">
          <button
            type="button"
            className="role-selector__option role-selector__option--practice"
            onClick={() => handleSelect("practice")}
          >
            <div className="role-selector__option-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 9l3 3-3 3" />
                <line x1="14" y1="15" x2="18" y2="15" />
              </svg>
            </div>
            <div className="role-selector__option-content">
              <h2 className="role-selector__option-title">Practice &amp; Improve</h2>
              <p className="role-selector__option-desc">
                Sharpen your coding skills with guided practice, AI-powered mock interviews, and personalized progress tracking.
              </p>
              <div className="role-selector__option-features">
                <span>Coding challenges</span>
                <span>AI mock interviews</span>
                <span>Progress tracking</span>
              </div>
            </div>
            <svg className="role-selector__option-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>

          <button
            type="button"
            className="role-selector__option role-selector__option--interviewer"
            onClick={() => handleSelect("interviewer")}
          >
            <div className="role-selector__option-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="16" y1="11" x2="22" y2="11" />
              </svg>
            </div>
            <div className="role-selector__option-content">
              <h2 className="role-selector__option-title">Conduct Interviews</h2>
              <p className="role-selector__option-desc">
                Create live coding sessions, share invite codes with candidates, and evaluate their performance in real time.
              </p>
              <div className="role-selector__option-features">
                <span>Create sessions</span>
                <span>Live monitoring</span>
                <span>Results &amp; reports</span>
              </div>
            </div>
            <svg className="role-selector__option-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>

        <div className="role-selector__footer">
          <p className="role-selector__footer-note">
            You can switch modes anytime from the dashboard header.
          </p>
          <div className="role-selector__footer-actions">
            <button
              type="button"
              className="role-selector__link-btn"
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
