import { memo } from "react";

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
  onLogout,
  currentProblemTitle,
  showTimer = true,
}) {
  return (
    <header className="app__topbar" role="banner">
      {/* Current Problem Title */}
      <div className="topbar__problem">
        <span className="topbar__problem-label">Working on:</span>
        <span className="topbar__problem-title">{currentProblemTitle || "Select a problem"}</span>
      </div>

      {/* Center: Controls */}
      <div className="topbar__center">
        <div className="topbar__difficulty">
          <label htmlFor="difficulty-select" className="topbar__label">Difficulty</label>
          <select
            id="difficulty-select"
            className="topbar__select"
            value={difficulty}
            onChange={(event) => onDifficultyChange(event.target.value)}
            disabled={isLocked || isPaused}
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>

        {showTimer && (
          <div className="topbar__timer" role="timer" aria-label="Practice timer">
            <div className="topbar__time-display">
              <span className="topbar__time-label">Time Left</span>
              <span 
                className={`topbar__time-value ${remainingSeconds <= 300 ? 'topbar__time-value--warning' : ''} ${isTimeUp ? 'topbar__time-value--danger' : ''}`}
                aria-live="polite"
              >
                {isTimeUp ? "00:00" : formatTime(remainingSeconds)}
              </span>
            </div>
            
            {isTimeUp && (
              <span className="topbar__time-status" role="alert">Time's up!</span>
            )}
          </div>
        )}

        <div className="topbar__actions">
          {showTimer && (
            <button
              type="button"
              className={`topbar__btn topbar__btn--pause ${isPaused ? 'topbar__btn--resume' : ''}`}
              onClick={onPauseToggle}
              disabled={isLocked || isTimeUp}
              aria-label={isPaused ? "Resume practice" : "Pause practice"}
              aria-pressed={isPaused}
            >
              <span className="topbar__btn-icon">{isPaused ? '▶' : '⏸'}</span>
              <span className="topbar__btn-text">{isPaused ? "Resume" : "Pause"}</span>
            </button>
          )}
          
          <button
            type="button"
            className="topbar__btn topbar__btn--stop"
            onClick={onStop}
            disabled={isLocked}
            aria-label={showTimer ? "Submit and finish practice session" : "Complete practice session"}
          >
            <span className="topbar__btn-icon">✓</span>
            <span className="topbar__btn-text">{showTimer ? "Submit" : "Complete"}</span>
          </button>

          <button
            type="button"
            className="topbar__btn topbar__btn--logout"
            onClick={onLogout}
            aria-label="Log out"
          >
            <span className="topbar__btn-icon">↪</span>
            <span className="topbar__btn-text">Logout</span>
          </button>
        </div>
      </div>

      {/* Right: Status Indicator */}
      <div className="topbar__status">
        {isLocked ? (
          <span className="topbar__status-badge topbar__status-badge--completed">
            Completed
          </span>
        ) : showTimer && isPaused ? (
          <span className="topbar__status-badge topbar__status-badge--paused">
            Paused
          </span>
        ) : (
          <span className="topbar__status-badge topbar__status-badge--active">
            Practicing
          </span>
        )}
      </div>
    </header>
  );
}

export default memo(Header);
