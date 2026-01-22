import { memo, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { calculateLevel, getLevelProgress } from "../services/gamificationService.js";

const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

function Header({
  difficulty,
  isLocked,
  isPaused,
  isTimeUp,
  remainingSeconds,
  onDifficultyChange,
  onPauseToggle,
  onStop,
  onStartTutorial,
  onOpenLeaderboard,
  onStartInterviewSim,
  onOpenGamification,
  problemSelector,
  user,
  onOpenAuth,
  onOpenProfile
}) {
  const { theme, toggleTheme, openSettings } = useTheme();

  // Gamification data
  const gamification = user?.gamification;
  const xp = gamification?.xp || 0;
  const level = useMemo(() => calculateLevel(xp), [xp]);
  const levelProgress = useMemo(() => getLevelProgress(xp), [xp]);
  const streak = gamification?.streak?.current || 0;

  return (
    <header className="app__header" role="banner">
      <div className="app__header-text">
        <h1>Live AI Coding Interviewer</h1>
        <p>Practice coding problems with AI guidance.</p>
      </div>
      <div className="app__header-actions">
        {problemSelector}
        <button
          type="button"
          className="interview-sim-trigger"
          onClick={onStartInterviewSim}
          aria-label="Start interview simulation"
        >
          <span className="interview-sim-trigger__icon" aria-hidden="true">🎯</span>
          <span className="button-text">Mock Interview</span>
        </button>
        <button
          type="button"
          className="tutorial-trigger"
          onClick={onStartTutorial}
          aria-label="Start tutorial"
        >
          <span className="button-text">How it works?</span>
        </button>
        <button
          type="button"
          className="leaderboard-trigger"
          onClick={onOpenLeaderboard}
          aria-label="View leaderboard"
        >
          <span className="leaderboard-trigger__icon" aria-hidden="true">🏆</span>
          <span className="button-text">Leaderboard</span>
        </button>
        
        {/* Theme Toggle */}
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          <span className="theme-toggle__icon" aria-hidden="true">
            {theme === "light" ? "🌙" : "☀️"}
          </span>
        </button>

        {/* Settings Button */}
        <button
          type="button"
          className="settings-trigger"
          onClick={openSettings}
          aria-label="Open settings"
          title="Settings"
        >
          <span className="settings-trigger__icon" aria-hidden="true">⚙️</span>
        </button>

        <div className="difficulty-card">
          <span className="difficulty-card__label" id="difficulty-label">Difficulty</span>
          <select
            className="difficulty-card__select"
            value={difficulty}
            onChange={(event) => onDifficultyChange(event.target.value)}
            disabled={isLocked || isPaused}
            aria-labelledby="difficulty-label"
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>
        <div className="time-card" role="timer" aria-label="Interview timer">
          <div className="time-tracker">
            <span className="time-tracker__label" id="time-label">Time left</span>
            <span 
              className="time-tracker__value"
              aria-labelledby="time-label"
              aria-live="polite"
            >
              {isTimeUp ? "00:00" : formatTime(remainingSeconds)}
            </span>
            {isTimeUp && (
              <span className="time-tracker__status" role="alert">
                Time is up
              </span>
            )}
          </div>
          <button
            type="button"
            className="time-tracker__action time-tracker__action--pause"
            onClick={onPauseToggle}
            disabled={isLocked || isTimeUp}
            aria-label={isPaused ? "Resume interview" : "Pause interview"}
            aria-pressed={isPaused}
          >
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            className="time-tracker__action"
            onClick={onStop}
            disabled={isLocked}
            aria-label="Stop interview"
          >
            <span className="time-tracker__icon" aria-hidden="true">
              ■
            </span>
            Stop
          </button>
        </div>
        
        {/* User Authentication Section */}
        <div className="user-section">
          {user ? (
            <>
              {/* Gamification Stats */}
              <div className="user-section__gamification">
                {/* Streak Counter */}
                <button
                  type="button"
                  className={`streak-counter ${streak > 0 ? "streak-counter--active" : ""}`}
                  onClick={onOpenGamification}
                  aria-label={`${streak} day streak. Click to view progress`}
                  title={`${streak} day streak`}
                >
                  <span className="streak-counter__icon" aria-hidden="true">🔥</span>
                  <span className="streak-counter__value">{streak}</span>
                </button>

                {/* XP/Level Display */}
                <button
                  type="button"
                  className="xp-display"
                  onClick={onOpenGamification}
                  aria-label={`Level ${level}, ${xp} XP. Click to view progress`}
                  title={`Level ${level} • ${xp} XP`}
                >
                  <span className="xp-display__level">Lv.{level}</span>
                  <div className="xp-display__bar">
                    <div 
                      className="xp-display__fill"
                      style={{ width: `${levelProgress}%` }}
                    />
                  </div>
                </button>
              </div>

              <button
                type="button"
                className="user-section__profile-btn"
                onClick={onOpenProfile}
                aria-label={`Open profile for ${user.username}`}
              >
                <span className="user-section__avatar" aria-hidden="true">
                  {user.username?.charAt(0).toUpperCase() || "U"}
                </span>
                <span className="user-section__name">{user.username}</span>
              </button>
            </>
          ) : (
            <div className="user-section__guest">
              <span className="user-section__guest-hint">Sign in to track XP &amp; achievements</span>
              <button
                type="button"
                className="user-section__login-btn"
                onClick={onOpenAuth}
                aria-label="Sign in"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default memo(Header);
