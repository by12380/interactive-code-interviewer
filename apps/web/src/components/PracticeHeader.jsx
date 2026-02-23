import { memo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { calculateLevel } from "../services/gamificationService.js";

const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

function PracticeHeader({
  currentProblemTitle,
  elapsedSeconds = 0,
  isLocked,
  onStop,
  user,
  onLogout,
  onOpenProfile,
  onOpenAchievements,
}) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const level = calculateLevel(user?.gamification?.xp || 0);

  const handleBack = useCallback(() => {
    navigate("/practice");
  }, [navigate]);

  const toggleUserMenu = useCallback(() => {
    setIsUserMenuOpen((prev) => !prev);
  }, []);

  return (
    <header className="practice-header" role="banner">
      {/* Left: Back + problem name */}
      <div className="practice-header__left">
        <button
          type="button"
          className="practice-header__back"
          onClick={handleBack}
          aria-label="Back to practice dashboard"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div className="practice-header__problem">
          <span className="practice-header__problem-label">Solving</span>
          <span className="practice-header__problem-title">{currentProblemTitle || "Select a problem"}</span>
        </div>
      </div>

      {/* Center: Timer + Finish */}
      <div className="practice-header__center">
        <div className="practice-header__timer" role="timer" aria-label="Elapsed time">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="practice-header__time">{formatTime(elapsedSeconds)}</span>
        </div>
        <button
          type="button"
          className="practice-header__finish-btn"
          onClick={onStop}
          disabled={isLocked}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {isLocked ? "Completed" : "Finish"}
        </button>
      </div>

      {/* Right: Theme, Achievements, Profile */}
      <div className="practice-header__right">
        <button
          type="button"
          className="practice-header__icon-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? "\u{1F319}" : "\u2600\uFE0F"}
        </button>

        <button
          type="button"
          className="practice-header__icon-btn practice-header__achievements-btn"
          onClick={onOpenAchievements}
          aria-label="Achievements"
        >
          &#x1F3C6;
        </button>

        {user && (
          <div className="practice-header__user-wrap">
            <button
              type="button"
              className="practice-header__avatar-btn"
              onClick={toggleUserMenu}
              aria-expanded={isUserMenuOpen}
              aria-label="User menu"
            >
              <span className="practice-header__avatar">
                {(user.username || user.displayName || user.email || "U").charAt(0).toUpperCase()}
              </span>
            </button>

            {isUserMenuOpen && (
              <>
                <div className="practice-header__user-menu">
                  <div className="practice-header__user-menu-header">
                    <span className="practice-header__user-menu-name">
                      {user.username || user.displayName || user.email}
                    </span>
                    <span className="practice-header__user-menu-level">Level {level}</span>
                  </div>
                  <button
                    type="button"
                    className="practice-header__user-menu-item"
                    onClick={() => { setIsUserMenuOpen(false); onOpenProfile(); }}
                  >
                    <span>&#x1F464;</span> View Profile
                  </button>
                  <button
                    type="button"
                    className="practice-header__user-menu-item"
                    onClick={() => { setIsUserMenuOpen(false); onOpenAchievements(); }}
                  >
                    <span>&#x1F3C6;</span> Achievements
                  </button>
                  <hr className="practice-header__user-menu-divider" />
                  <button
                    type="button"
                    className="practice-header__user-menu-item practice-header__user-menu-item--danger"
                    onClick={() => { setIsUserMenuOpen(false); onLogout(); }}
                  >
                    <span>&#x1F6AA;</span> Sign Out
                  </button>
                </div>
                <div
                  className="practice-header__user-menu-backdrop"
                  onClick={() => setIsUserMenuOpen(false)}
                />
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default memo(PracticeHeader);
