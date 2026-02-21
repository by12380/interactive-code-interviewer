import { memo } from "react";

const formatTime = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

function Header({
  workspaceMode,
  difficulty,
  isLocked,
  isPaused,
  isTimeUp,
  elapsedSeconds,
  remainingSeconds,
  onDifficultyChange,
  onPauseToggle,
  onStop,
  onLogout,
  currentProblemTitle,
}) {
  const isPracticeMode = workspaceMode === "practice";

  return (
    <header className="app__topbar" role="banner">
      {/* Current Problem Title */}
      <div className="topbar__problem">
        <span className="topbar__problem-label">Working on:</span>
        <span className="topbar__problem-title">{currentProblemTitle || "Select a problem"}</span>
      </div>

      {/* Center: Mode-specific controls */}
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

        {isPracticeMode ? (
          <div className="topbar__timer" role="timer" aria-label="Practice time">
            <div className="topbar__time-display">
              <span className="topbar__time-label">Practice Time</span>
              <span className="topbar__time-value" aria-live="polite">
                {formatTime(elapsedSeconds)}
              </span>
            </div>
          </div>
        ) : (
          <div className="topbar__timer" role="timer" aria-label="Interview timer">
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
          {!isPracticeMode && (
            <>
              <button
                type="button"
                className={`topbar__btn topbar__btn--pause ${isPaused ? 'topbar__btn--resume' : ''}`}
                onClick={onPauseToggle}
                disabled={isLocked || isTimeUp}
                aria-label={isPaused ? "Resume interview" : "Pause interview"}
                aria-pressed={isPaused}
              >
                <span className="topbar__btn-icon">{isPaused ? '▶' : '⏸'}</span>
                <span className="topbar__btn-text">{isPaused ? "Resume" : "Pause"}</span>
              </button>
              
              <button
                type="button"
                className="topbar__btn topbar__btn--stop"
                onClick={onStop}
                disabled={isLocked}
                aria-label="Submit and finish interview"
              >
                <span className="topbar__btn-icon">✓</span>
                <span className="topbar__btn-text">Submit</span>
              </button>
            </>
          )}

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
        {isPracticeMode ? (
          <span className="topbar__status-badge topbar__status-badge--active">
            Practice Mode
          </span>
        ) : isLocked ? (
          <span className="topbar__status-badge topbar__status-badge--completed">
            Completed
          </span>
        ) : isPaused ? (
          <span className="topbar__status-badge topbar__status-badge--paused">
            Paused
          </span>
        ) : (
          <span className="topbar__status-badge topbar__status-badge--active">
            In Progress
          </span>
        )}
      </div>
    </header>
  );
}

export default memo(Header);
