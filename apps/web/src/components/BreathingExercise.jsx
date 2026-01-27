import { memo, useMemo } from "react";
import { useFocusMode } from "../contexts/FocusModeContext.jsx";

function BreathingExercise({ isActive, onStart, onStop, pattern }) {
  const { breathingPhase, breathingProgress, breathingCycles } = useFocusMode();

  // Calculate the circle animation based on phase
  const circleScale = useMemo(() => {
    if (!isActive) return 1;
    
    switch (breathingPhase) {
      case "inhale":
        return 1 + (breathingProgress / 100) * 0.5; // Grow from 1 to 1.5
      case "hold1":
        return 1.5; // Stay at max
      case "exhale":
        return 1.5 - (breathingProgress / 100) * 0.5; // Shrink from 1.5 to 1
      case "hold2":
        return 1; // Stay at min
      default:
        return 1;
    }
  }, [isActive, breathingPhase, breathingProgress]);

  // Get phase display text
  const phaseText = useMemo(() => {
    switch (breathingPhase) {
      case "inhale":
        return "Breathe In";
      case "hold1":
        return "Hold";
      case "exhale":
        return "Breathe Out";
      case "hold2":
        return "Hold";
      default:
        return "Ready";
    }
  }, [breathingPhase]);

  // Get phase duration for countdown
  const phaseDuration = useMemo(() => {
    if (!isActive || !pattern) return 0;
    
    switch (breathingPhase) {
      case "inhale":
        return pattern.inhale;
      case "hold1":
        return pattern.hold1;
      case "exhale":
        return pattern.exhale;
      case "hold2":
        return pattern.hold2;
      default:
        return 0;
    }
  }, [isActive, breathingPhase, pattern]);

  // Calculate remaining seconds in phase
  const remainingSeconds = useMemo(() => {
    if (!isActive || phaseDuration === 0) return 0;
    return Math.ceil(phaseDuration * (1 - breathingProgress / 100));
  }, [isActive, phaseDuration, breathingProgress]);

  // Get phase color
  const phaseColor = useMemo(() => {
    switch (breathingPhase) {
      case "inhale":
        return "#4f46e5"; // Primary purple
      case "hold1":
        return "#16a34a"; // Green
      case "exhale":
        return "#0ea5e9"; // Sky blue
      case "hold2":
        return "#f59e0b"; // Amber
      default:
        return "#94a3b8"; // Gray
    }
  }, [breathingPhase]);

  return (
    <div className="breathing-exercise">
      <div className="breathing-exercise__visual">
        {/* Background rings */}
        <div className="breathing-exercise__rings">
          <div className="breathing-exercise__ring breathing-exercise__ring--outer" />
          <div className="breathing-exercise__ring breathing-exercise__ring--middle" />
          <div className="breathing-exercise__ring breathing-exercise__ring--inner" />
        </div>
        
        {/* Animated circle */}
        <div
          className={`breathing-exercise__circle ${isActive ? "breathing-exercise__circle--active" : ""}`}
          style={{
            transform: `scale(${circleScale})`,
            backgroundColor: phaseColor,
            boxShadow: `0 0 ${isActive ? 40 : 20}px ${phaseColor}40`,
          }}
        >
          <div className="breathing-exercise__content">
            {isActive ? (
              <>
                <span className="breathing-exercise__phase">{phaseText}</span>
                <span className="breathing-exercise__countdown">{remainingSeconds}</span>
              </>
            ) : (
              <span className="breathing-exercise__ready">Start</span>
            )}
          </div>
        </div>

        {/* Progress arc */}
        {isActive && (
          <svg className="breathing-exercise__progress" viewBox="0 0 100 100">
            <circle
              className="breathing-exercise__progress-bg"
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.2"
            />
            <circle
              className="breathing-exercise__progress-fill"
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={phaseColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${breathingProgress * 2.83} 283`}
              transform="rotate(-90 50 50)"
            />
          </svg>
        )}
      </div>

      {/* Controls */}
      <div className="breathing-exercise__controls">
        {isActive ? (
          <>
            <div className="breathing-exercise__stats">
              <span className="breathing-exercise__cycles">
                <span className="breathing-exercise__cycles-icon">🔄</span>
                {breathingCycles} cycles completed
              </span>
            </div>
            <button
              type="button"
              className="breathing-exercise__stop-btn"
              onClick={onStop}
            >
              Stop Exercise
            </button>
          </>
        ) : (
          <>
            <div className="breathing-exercise__pattern-info">
              <span className="breathing-exercise__pattern-name">{pattern?.name}</span>
              <span className="breathing-exercise__pattern-timing">
                {pattern?.inhale}s in - {pattern?.hold1}s hold - {pattern?.exhale}s out
                {pattern?.hold2 > 0 && ` - ${pattern.hold2}s hold`}
              </span>
            </div>
            <button
              type="button"
              className="breathing-exercise__start-btn"
              onClick={onStart}
            >
              <span className="breathing-exercise__start-icon">🌬️</span>
              Begin Breathing Exercise
            </button>
          </>
        )}
      </div>

      {/* Phase indicators */}
      {isActive && (
        <div className="breathing-exercise__phases">
          <div className={`breathing-exercise__phase-indicator ${breathingPhase === "inhale" ? "active" : ""}`}>
            <span className="breathing-exercise__phase-dot" style={{ backgroundColor: "#4f46e5" }} />
            <span>Inhale</span>
          </div>
          {pattern?.hold1 > 0 && (
            <div className={`breathing-exercise__phase-indicator ${breathingPhase === "hold1" ? "active" : ""}`}>
              <span className="breathing-exercise__phase-dot" style={{ backgroundColor: "#16a34a" }} />
              <span>Hold</span>
            </div>
          )}
          <div className={`breathing-exercise__phase-indicator ${breathingPhase === "exhale" ? "active" : ""}`}>
            <span className="breathing-exercise__phase-dot" style={{ backgroundColor: "#0ea5e9" }} />
            <span>Exhale</span>
          </div>
          {pattern?.hold2 > 0 && (
            <div className={`breathing-exercise__phase-indicator ${breathingPhase === "hold2" ? "active" : ""}`}>
              <span className="breathing-exercise__phase-dot" style={{ backgroundColor: "#f59e0b" }} />
              <span>Hold</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(BreathingExercise);
