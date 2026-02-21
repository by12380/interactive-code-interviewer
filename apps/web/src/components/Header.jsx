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
  elapsedSeconds = 0,
  onDifficultyChange,
  onPauseToggle,
  onStop,
  onLogout,
  user,
  currentProblemTitle,
  mode = "practice",
}) {
  const isPractice = mode === "practice";

  return (
    <header className="app__topbar" role="banner">
      <div className="topbar__problem">
        <span className="topbar__problem-label">Working on:</span>
        <span className="topbar__problem-title">{currentProblemTitle || "Select a problem"}</span>
      </div>

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

        <div className="topbar__timer" role="timer" aria-label={isPractice ? "Elapsed time" : "Interview timer"}>
          <div className="topbar__time-display">
            <span className="topbar__time-label">
              {isPractice ? "Time" : "Time Left"}
            </span>
            <span 
              className={`topbar__time-value ${!isPractice && remainingSeconds <= 300 ? 'topbar__time-value--warning' : ''} ${!isPractice && isTimeUp ? 'topbar__time-value--danger' : ''}`}
              aria-live="polite"
            >
              {isPractice
                ? formatTime(elapsedSeconds)
                : isTimeUp
                  ? "00:00"
                  : formatTime(remainingSeconds)}
            </span>
          </div>
          
          {!isPractice && isTimeUp && (
            <span className="topbar__time-status" role="alert">Time's up!</span>
          )}
        </div>

        <div className="topbar__actions">
          {!isPractice && (
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
          )}
          
          <button
            type="button"
            className="topbar__btn topbar__btn--stop"
            onClick={onStop}
            disabled={isLocked}
            aria-label={isPractice ? "Finish practice session" : "Submit and finish interview"}
          >
            <span className="topbar__btn-icon">✓</span>
            <span className="topbar__btn-text">{isPractice ? "Finish Session" : "Submit"}</span>
          </button>
        </div>
      </div>

      <div className="topbar__status">
        {isLocked ? (
          <span className="topbar__status-badge topbar__status-badge--completed">
            Completed
          </span>
        ) : isPaused ? (
          <span className="topbar__status-badge topbar__status-badge--paused">
            Paused
          </span>
        ) : (
          <span className="topbar__status-badge topbar__status-badge--active">
            {isPractice ? "Practicing" : "In Progress"}
          </span>
        )}

        {user && onLogout && (
          <button
            type="button"
            className="topbar__btn topbar__btn--logout"
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <svg
              className="topbar__logout-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="topbar__btn-text">Logout</span>
          </button>
        )}
      </div>
    </header>
  );
}

export default memo(Header);
