import { useState, useMemo } from "react";
import { INTERVIEW_CONFIG, INTERVIEWER_PERSONAS, BEHAVIORAL_QUESTIONS, SYSTEM_DESIGN_PROBLEMS } from "../data/interviewConfig.js";
import { PROBLEMS } from "../data/problems.js";

// Get unique categories from problems
const PROBLEM_CATEGORIES = [...new Set(PROBLEMS.map(p => p.category))];
const BEHAVIORAL_CATEGORIES = [...new Set(BEHAVIORAL_QUESTIONS.map(q => q.category))];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

export default function InterviewLauncher({
  onStart,
  onClose,
  user
}) {
  const [selectedMode, setSelectedMode] = useState("standard");
  const [selectedPersona, setSelectedPersona] = useState("neutral");
  const [enableVideo, setEnableVideo] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Custom configuration state
  const [customCodingCount, setCustomCodingCount] = useState(2);
  const [customBehavioralCount, setCustomBehavioralCount] = useState(2);
  const [includeSystemDesign, setIncludeSystemDesign] = useState(false);
  const [selectedDifficulties, setSelectedDifficulties] = useState(["Easy", "Medium", "Hard"]);
  const [selectedCategories, setSelectedCategories] = useState([...PROBLEM_CATEGORIES]);
  const [selectedBehavioralCategories, setSelectedBehavioralCategories] = useState([...BEHAVIORAL_CATEGORIES]);
  const [customTimeLimit, setCustomTimeLimit] = useState(60); // in minutes
  const [selectedSystemDesignDifficulty, setSelectedSystemDesignDifficulty] = useState("Medium");

  // Calculate estimated time based on custom settings
  const estimatedTime = useMemo(() => {
    if (!isCustomMode) return null;
    const codingTime = customCodingCount * 25; // ~25 min per coding problem
    const behavioralTime = customBehavioralCount * 5; // ~5 min per behavioral
    const systemDesignTime = includeSystemDesign ? 40 : 0; // ~40 min for system design
    return codingTime + behavioralTime + systemDesignTime;
  }, [isCustomMode, customCodingCount, customBehavioralCount, includeSystemDesign]);

  const selectedConfig = isCustomMode ? {
    name: "Custom Interview",
    description: "Your personalized interview configuration",
    totalTime: customTimeLimit * 60,
    codingProblems: customCodingCount,
    behavioralQuestions: customBehavioralCount,
    systemDesign: includeSystemDesign,
    difficultyProgression: false
  } : (INTERVIEW_CONFIG.modes[selectedMode] || INTERVIEW_CONFIG.modes.standard);

  const selectedInterviewer = INTERVIEWER_PERSONAS.find(p => p.id === selectedPersona);

  // Format time
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} minutes`;
  };

  // Mode cards data
  const modeCards = useMemo(() => [
    {
      id: "quick",
      icon: "⚡",
      recommended: false
    },
    {
      id: "standard",
      icon: "📝",
      recommended: true
    },
    {
      id: "full",
      icon: "🎯",
      recommended: false
    },
    {
      id: "systemDesign",
      icon: "🏗️",
      recommended: false
    },
    {
      id: "comprehensive",
      icon: "🚀",
      recommended: false
    }
  ], []);

  // Toggle difficulty selection
  const toggleDifficulty = (difficulty) => {
    setSelectedDifficulties(prev => {
      if (prev.includes(difficulty)) {
        // Don't allow removing all difficulties
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== difficulty);
      }
      return [...prev, difficulty];
    });
  };

  // Toggle category selection
  const toggleCategory = (category) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        // Don't allow removing all categories
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== category);
      }
      return [...prev, category];
    });
  };

  // Toggle behavioral category selection
  const toggleBehavioralCategory = (category) => {
    setSelectedBehavioralCategories(prev => {
      if (prev.includes(category)) {
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== category);
      }
      return [...prev, category];
    });
  };

  // Handle mode selection - select and immediately start
  const handleModeSelect = (e, modeId) => {
    e.stopPropagation();
    // Start the interview immediately with this mode
    onStart({
      mode: modeId,
      persona: selectedPersona,
      enableVideo,
      customConfig: null
    });
  };

  // Handle custom mode toggle - this one just selects, doesn't auto-start
  const handleCustomModeToggle = (e) => {
    e.stopPropagation();
    setIsCustomMode(true);
    setSelectedMode(null);
  };
  
  // Handle start for custom mode (uses the Start Interview button)
  const handleStartCustom = () => {
    onStart({
      mode: "custom",
      persona: selectedPersona,
      enableVideo,
      customConfig: {
        codingProblems: customCodingCount,
        behavioralQuestions: customBehavioralCount,
        systemDesign: includeSystemDesign,
        systemDesignDifficulty: selectedSystemDesignDifficulty,
        timeLimit: customTimeLimit * 60,
        difficulties: selectedDifficulties,
        categories: selectedCategories,
        behavioralCategories: selectedBehavioralCategories
      }
    });
  };

  return (
    <div className="interview-launcher-overlay">
      <div className="interview-launcher">
        {/* Header */}
        <div className="interview-launcher__header">
          <h1>Interview Simulation</h1>
          <p>Practice like it's the real thing</p>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Mode Selection */}
        <div className="interview-launcher__section">
          <h2>Choose an Interview Type to Start</h2>
          <p className="section-subtitle">Click any option below to begin immediately</p>
          <div className="mode-grid">
            {modeCards.map(({ id, icon, recommended }) => {
              const modeConfig = INTERVIEW_CONFIG.modes[id];
              return (
                <div
                  key={id}
                  className={`mode-card mode-card--clickable ${recommended ? 'recommended' : ''}`}
                  onClick={(e) => handleModeSelect(e, id)}
                >
                  {recommended && <span className="recommended-badge">Recommended</span>}
                  <div className="mode-icon">{icon}</div>
                  <h3>{modeConfig.name}</h3>
                  <p className="mode-description">{modeConfig.description}</p>
                  <div className="mode-details">
                    <span className="mode-duration">
                      <span className="icon">⏱️</span>
                      {formatDuration(modeConfig.totalTime)}
                    </span>
                    <div className="mode-contents">
                      {modeConfig.codingProblems > 0 && (
                        <span>{modeConfig.codingProblems} coding</span>
                      )}
                      {modeConfig.behavioralQuestions > 0 && (
                        <span>{modeConfig.behavioralQuestions} behavioral</span>
                      )}
                      {modeConfig.systemDesign && (
                        <span>system design</span>
                      )}
                    </div>
                  </div>
                  <div className="mode-card__start-hint">Click to start →</div>
                </div>
              );
            })}
            {/* Custom Mode Card */}
            <div
              className={`mode-card mode-card--custom ${isCustomMode ? 'selected' : ''}`}
              onClick={(e) => handleCustomModeToggle(e)}
            >
              <div className="mode-icon">⚙️</div>
              <h3>Custom Interview</h3>
              <p className="mode-description">Build your own interview</p>
              <div className="mode-details">
                <span className="mode-duration">
                  <span className="icon">🎛️</span>
                  Fully customizable
                </span>
              </div>
              <div className="mode-card__start-hint">Click to configure →</div>
            </div>
          </div>
        </div>

        {/* Custom Configuration Section */}
        {isCustomMode && (
          <div className="interview-launcher__section interview-launcher__custom-config">
            <h2>Customize Your Interview</h2>
            
            {/* Coding Problems Configuration */}
            <div className="custom-config-group">
              <h3>Coding Problems</h3>
              <div className="config-row">
                <label className="config-label">Number of problems:</label>
                <div className="number-selector">
                  <button 
                    className="number-btn"
                    onClick={() => setCustomCodingCount(Math.max(0, customCodingCount - 1))}
                    disabled={customCodingCount <= 0}
                  >−</button>
                  <span className="number-value">{customCodingCount}</span>
                  <button 
                    className="number-btn"
                    onClick={() => setCustomCodingCount(Math.min(5, customCodingCount + 1))}
                    disabled={customCodingCount >= 5}
                  >+</button>
                </div>
              </div>

              {customCodingCount > 0 && (
                <>
                  <div className="config-row">
                    <label className="config-label">Difficulty levels:</label>
                    <div className="chip-selector">
                      {DIFFICULTIES.map(diff => (
                        <button
                          key={diff}
                          className={`chip ${selectedDifficulties.includes(diff) ? 'selected' : ''} chip--${diff.toLowerCase()}`}
                          onClick={() => toggleDifficulty(diff)}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="config-row config-row--categories">
                    <label className="config-label">Problem categories:</label>
                    <div className="chip-selector chip-selector--wrap">
                      {PROBLEM_CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          className={`chip chip--category ${selectedCategories.includes(cat) ? 'selected' : ''}`}
                          onClick={() => toggleCategory(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Behavioral Questions Configuration */}
            <div className="custom-config-group">
              <h3>Behavioral Questions</h3>
              <div className="config-row">
                <label className="config-label">Number of questions:</label>
                <div className="number-selector">
                  <button 
                    className="number-btn"
                    onClick={() => setCustomBehavioralCount(Math.max(0, customBehavioralCount - 1))}
                    disabled={customBehavioralCount <= 0}
                  >−</button>
                  <span className="number-value">{customBehavioralCount}</span>
                  <button 
                    className="number-btn"
                    onClick={() => setCustomBehavioralCount(Math.min(6, customBehavioralCount + 1))}
                    disabled={customBehavioralCount >= 6}
                  >+</button>
                </div>
              </div>

              {customBehavioralCount > 0 && (
                <div className="config-row config-row--categories">
                  <label className="config-label">Question categories:</label>
                  <div className="chip-selector chip-selector--wrap">
                    {BEHAVIORAL_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        className={`chip chip--category ${selectedBehavioralCategories.includes(cat) ? 'selected' : ''}`}
                        onClick={() => toggleBehavioralCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* System Design Configuration */}
            <div className="custom-config-group">
              <h3>System Design</h3>
              <div className="config-row">
                <label className="toggle-option">
                  <input
                    type="checkbox"
                    checked={includeSystemDesign}
                    onChange={(e) => setIncludeSystemDesign(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-label">Include system design question</span>
                </label>
              </div>

              {includeSystemDesign && (
                <div className="config-row">
                  <label className="config-label">Difficulty:</label>
                  <div className="chip-selector">
                    {["Easy", "Medium", "Hard"].map(diff => (
                      <button
                        key={diff}
                        className={`chip ${selectedSystemDesignDifficulty === diff ? 'selected' : ''} chip--${diff.toLowerCase()}`}
                        onClick={() => setSelectedSystemDesignDifficulty(diff)}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Time Limit Configuration */}
            <div className="custom-config-group">
              <h3>Time Limit</h3>
              <div className="config-row">
                <label className="config-label">Total time (minutes):</label>
                <div className="time-slider-container">
                  <input
                    type="range"
                    min="15"
                    max="180"
                    step="5"
                    value={customTimeLimit}
                    onChange={(e) => setCustomTimeLimit(Number(e.target.value))}
                    className="time-slider"
                  />
                  <span className="time-value">{customTimeLimit} min</span>
                </div>
              </div>
              {estimatedTime && (
                <p className="estimated-time">
                  Estimated time needed: ~{estimatedTime} minutes
                  {estimatedTime > customTimeLimit && (
                    <span className="time-warning"> (You may need more time)</span>
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Selected Mode Details - Only show for custom mode */}
        {isCustomMode && (
          <div className="interview-launcher__section interview-launcher__details">
            <h2>Your Custom Interview</h2>
            <div className="details-card">
              <div className="details-row">
                <span className="details-label">Duration</span>
                <span className="details-value">{formatDuration(selectedConfig.totalTime)}</span>
              </div>
              <div className="details-row">
                <span className="details-label">Coding Problems</span>
                <span className="details-value">{selectedConfig.codingProblems}</span>
              </div>
              <div className="details-row">
                <span className="details-label">Behavioral Questions</span>
                <span className="details-value">{selectedConfig.behavioralQuestions}</span>
              </div>
              <div className="details-row">
                <span className="details-label">System Design</span>
                <span className="details-value">{selectedConfig.systemDesign ? 'Yes' : 'No'}</span>
              </div>
              {selectedDifficulties.length > 0 && customCodingCount > 0 && (
                <div className="details-row">
                  <span className="details-label">Selected Difficulties</span>
                  <span className="details-value">{selectedDifficulties.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Advanced Options - Only show for custom mode */}
        {isCustomMode && (
          <>
            <button
              className="advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '▼' : '▶'} Advanced Options
            </button>

            {showAdvanced && (
              <div className="interview-launcher__section interview-launcher__advanced">
                {/* Interviewer Persona */}
                <div className="advanced-option">
                  <h3>Interviewer Style</h3>
                  <p className="option-description">Choose how your AI interviewer will interact with you</p>
                  <div className="persona-grid">
                    {INTERVIEWER_PERSONAS.map((persona) => (
                      <div
                        key={persona.id}
                        className={`persona-card ${selectedPersona === persona.id ? 'selected' : ''}`}
                        onClick={() => setSelectedPersona(persona.id)}
                      >
                        <h4>{persona.name}</h4>
                        <span className="persona-style">{persona.style}</span>
                        <p>{persona.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Video Recording */}
                <div className="advanced-option">
                  <h3>Video Recording</h3>
                  <label className="toggle-option">
                    <input
                      type="checkbox"
                      checked={enableVideo}
                      onChange={(e) => setEnableVideo(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                    <span className="toggle-label">
                      Record video of your interview session
                    </span>
                  </label>
                  <p className="option-hint">
                    Recordings are stored locally and can be downloaded after the interview.
                    Great for self-review!
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Pre-Interview Tips - Only show for custom mode */}
        {isCustomMode && (
          <div className="interview-launcher__section interview-launcher__tips">
            <h2>Before You Start</h2>
            <div className="tips-grid">
              <div className="tip">
                <span className="tip-icon">🎯</span>
                <p>Find a quiet space where you won't be interrupted</p>
              </div>
              <div className="tip">
                <span className="tip-icon">💭</span>
                <p>Think out loud - explain your reasoning as you code</p>
              </div>
              <div className="tip">
                <span className="tip-icon">❓</span>
                <p>Ask clarifying questions before diving in</p>
              </div>
              <div className="tip">
                <span className="tip-icon">⏰</span>
                <p>Keep an eye on the timer but don't rush</p>
              </div>
            </div>
          </div>
        )}

        {/* User Info */}
        {user && (
          <div className="interview-launcher__user">
            <span>Interviewing as: <strong>{user.username}</strong></span>
            <span className="user-stats">
              {user.stats?.totalInterviews || 0} previous interviews
            </span>
          </div>
        )}

        {/* Start Button */}
        <div className="interview-launcher__actions">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          {isCustomMode && (
            <button className="start-btn" onClick={handleStartCustom}>
              Start Custom Interview
              <span className="start-arrow">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
