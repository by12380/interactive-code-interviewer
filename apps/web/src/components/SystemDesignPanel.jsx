import { useMemo, useState } from "react";
import ChatPanel from "./ChatPanel.jsx";

export default function SystemDesignPanel({
  problem,
  messages,
  chatInput,
  isSending,
  isPaused,
  notes,
  onNotesChange,
  onInputChange,
  onKeyDown,
  onSend,
  onSkip,
  timeRemaining
}) {
  const [activeTab, setActiveTab] = useState("problem");
  const [showHints, setShowHints] = useState(false);
  const [revealedHints, setRevealedHints] = useState(0);
  const [showSampleAnswer, setShowSampleAnswer] = useState(false);

  // Format time remaining
  const formattedTime = useMemo(() => {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, [timeRemaining]);

  const handleRevealHint = () => {
    if (revealedHints < (problem?.hints?.length || 0)) {
      setRevealedHints(prev => prev + 1);
    }
  };

  if (!problem) {
    return <div className="system-design-panel">Loading problem...</div>;
  }

  return (
    <div className="system-design-panel">
      {/* Problem Section */}
      <div className="system-design-panel__problem">
        <div className="system-design-panel__header">
          <div className="system-design-panel__title-row">
            <h2>{problem.title}</h2>
            <span className={`difficulty-badge difficulty-badge--${problem.difficulty?.toLowerCase()}`}>
              {problem.difficulty}
            </span>
          </div>
          <span className={`system-design-panel__timer ${timeRemaining < 300 ? 'warning' : ''}`}>
            {formattedTime} remaining
          </span>
        </div>

        {/* Tabs */}
        <div className="system-design-panel__tabs">
          <button
            className={`tab ${activeTab === 'problem' ? 'active' : ''}`}
            onClick={() => setActiveTab('problem')}
          >
            Problem
          </button>
          <button
            className={`tab ${activeTab === 'topics' ? 'active' : ''}`}
            onClick={() => setActiveTab('topics')}
          >
            Key Topics
          </button>
          <button
            className={`tab ${activeTab === 'hints' ? 'active' : ''}`}
            onClick={() => { setActiveTab('hints'); setShowHints(true); }}
          >
            Hints ({revealedHints}/{problem.hints?.length || 0})
          </button>
        </div>

        {/* Tab Content */}
        <div className="system-design-panel__tab-content">
          {activeTab === 'problem' && (
            <div className="system-design-panel__description">
              <div className="description-text" style={{ whiteSpace: 'pre-wrap' }}>
                {problem.description}
              </div>
            </div>
          )}

          {activeTab === 'topics' && (
            <div className="system-design-panel__topics">
              <h4>Consider these key areas:</h4>
              <ul>
                {problem.keyTopics?.map((topic, idx) => (
                  <li key={idx}>
                    <span className="topic-bullet">•</span>
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'hints' && (
            <div className="system-design-panel__hints">
              {problem.hints?.slice(0, revealedHints).map((hint, idx) => (
                <div key={idx} className="hint-item">
                  <span className="hint-number">Hint {idx + 1}</span>
                  <p>{hint}</p>
                </div>
              ))}

              {revealedHints < (problem.hints?.length || 0) && (
                <button
                  className="reveal-hint-btn"
                  onClick={handleRevealHint}
                >
                  Reveal Hint {revealedHints + 1}
                </button>
              )}

              {revealedHints === 0 && (
                <p className="hints-info">
                  Click the button above to reveal hints. Try to work through the problem first!
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sample Answer (for review after completion) */}
        <div className="system-design-panel__sample">
          <button
            className="toggle-sample-btn"
            onClick={() => setShowSampleAnswer(!showSampleAnswer)}
          >
            {showSampleAnswer ? 'Hide' : 'Show'} Sample Answer
          </button>
          {showSampleAnswer && (
            <div className="sample-answer">
              <div className="sample-warning">
                ⚠️ Only view this after attempting your own design!
              </div>
              <pre>{problem.sampleAnswer}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Notes Section */}
      <div className="system-design-panel__notes">
        <h3>Your Design Notes</h3>
        <p className="notes-hint">
          Use this space to sketch out your design, list components, or write pseudo-code.
        </p>
        <textarea
          className="notes-textarea"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={`Suggested structure:

1. Requirements Clarification
   - Functional requirements
   - Non-functional requirements
   - Scale estimates

2. High-Level Design
   - System components
   - Data flow

3. Database Design
   - Schema
   - Choice of database

4. API Design
   - Endpoints
   - Request/response formats

5. Scaling Considerations
   - Caching
   - Load balancing
   - Database sharding

6. Trade-offs & Alternatives`}
          disabled={isPaused}
        />
      </div>

      {/* Chat Section */}
      <div className="system-design-panel__chat">
        <div className="system-design-panel__chat-header">
          <h3>Discuss your design</h3>
          <p>Walk the interviewer through your thinking. They may ask questions or provide constraints.</p>
        </div>
        <ChatPanel
          messages={messages}
          input={chatInput}
          isLocked={false}
          isPaused={isPaused}
          isSending={isSending}
          onInputChange={onInputChange}
          onKeyDown={onKeyDown}
          onSend={onSend}
        />
        <div className="system-design-panel__actions">
          <button
            className="system-design-panel__skip-btn"
            onClick={onSkip}
          >
            Complete System Design →
          </button>
        </div>
      </div>
    </div>
  );
}
