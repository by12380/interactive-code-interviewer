import { useMemo } from "react";
import ChatPanel from "./ChatPanel.jsx";

export default function BehavioralQuestion({
  question,
  messages,
  chatInput,
  isSending,
  isPaused,
  onInputChange,
  onKeyDown,
  onSend,
  onSkip,
  timeRemaining
}) {
  // Format time remaining
  const formattedTime = useMemo(() => {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, [timeRemaining]);

  if (!question) {
    return <div className="behavioral-question">Loading question...</div>;
  }

  return (
    <div className="behavioral-question">
      <div className="behavioral-question__content">
        {/* Question Card */}
        <div className="behavioral-question__card">
          <div className="behavioral-question__header">
            <span className="behavioral-question__category">{question.category}</span>
            <span className={`behavioral-question__timer ${timeRemaining < 60 ? 'warning' : ''}`}>
              {formattedTime} remaining
            </span>
          </div>

          <h2 className="behavioral-question__text">
            {question.question}
          </h2>

          {/* Tips Section */}
          <div className="behavioral-question__tips">
            <h4>Tips:</h4>
            <p>{question.tips}</p>
          </div>

          {/* Follow-up Questions Preview */}
          {question.followUps && question.followUps.length > 0 && (
            <div className="behavioral-question__followups">
              <h4>Possible follow-up questions:</h4>
              <ul>
                {question.followUps.map((followUp, idx) => (
                  <li key={idx}>{followUp}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* STAR Method Guide */}
        <div className="behavioral-question__star-guide">
          <h3>Structure your answer using STAR:</h3>
          <div className="star-items">
            <div className="star-item">
              <span className="star-letter">S</span>
              <div className="star-content">
                <strong>Situation</strong>
                <p>Set the scene and context</p>
              </div>
            </div>
            <div className="star-item">
              <span className="star-letter">T</span>
              <div className="star-content">
                <strong>Task</strong>
                <p>Describe your responsibility</p>
              </div>
            </div>
            <div className="star-item">
              <span className="star-letter">A</span>
              <div className="star-content">
                <strong>Action</strong>
                <p>Explain what you did</p>
              </div>
            </div>
            <div className="star-item">
              <span className="star-letter">R</span>
              <div className="star-content">
                <strong>Result</strong>
                <p>Share the outcome</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="behavioral-question__chat">
        <div className="behavioral-question__chat-header">
          <h3>Discuss with your interviewer</h3>
          <p>Share your response verbally and through chat. The interviewer may ask follow-up questions.</p>
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
        <div className="behavioral-question__actions">
          <button
            className="behavioral-question__skip-btn"
            onClick={onSkip}
          >
            Move to Next Section →
          </button>
        </div>
      </div>
    </div>
  );
}
