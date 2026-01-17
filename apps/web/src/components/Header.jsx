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
  onStartTutorial
}) {
  return (
    <header className="app__header">
      <div className="app__header-text">
        <h1>Live AI Coding Interviewer</h1>
        <p>Prototype UI with editor + chat. Proactive guidance is next.</p>
      </div>
      <div className="app__header-actions">
        <button
          type="button"
          className="tutorial-trigger"
          onClick={onStartTutorial}
          aria-label="Start tutorial"
        >
          How it works?
        </button>
        <div className="difficulty-card">
          <span className="difficulty-card__label">Difficulty</span>
          <select
            className="difficulty-card__select"
            value={difficulty}
            onChange={(event) => onDifficultyChange(event.target.value)}
            disabled={isLocked || isPaused}
            aria-label="Select interview difficulty"
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>
        <div className="time-card">
          <div className="time-tracker">
            <span className="time-tracker__label">Time left</span>
            <span className="time-tracker__value">
              {isTimeUp ? "00:00" : formatTime(remainingSeconds)}
            </span>
            {isTimeUp && <span className="time-tracker__status">Time is up</span>}
          </div>
          <button
            type="button"
            className="time-tracker__action time-tracker__action--pause"
            onClick={onPauseToggle}
            disabled={isLocked || isTimeUp}
            aria-label={isPaused ? "Resume interview" : "Pause interview"}
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
      </div>
    </header>
  );
}

export default memo(Header);
