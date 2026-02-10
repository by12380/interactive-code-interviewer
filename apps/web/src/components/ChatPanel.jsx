import { memo, useEffect, useRef, useCallback, useState } from "react";
import { useVoice } from "../contexts/VoiceContext.jsx";

function ChatPanel({
  messages,
  input,
  isLocked,
  isPaused,
  isSending,
  onInputChange,
  onKeyDown,
  onSend,
  showVoiceControls = true
}) {
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  
  // Voice integration
  const {
    isSupported: voiceSupported,
    voiceSettings,
    speak,
    cancelSpeech,
    isSpeaking,
    currentSpokenText
  } = useVoice();
  
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState(null);
  
  // Handle speak button click for a specific message
  const handleSpeakMessage = useCallback((content, index) => {
    if (isSpeaking && speakingMessageIndex === index) {
      // Cancel if already speaking this message
      cancelSpeech();
      setSpeakingMessageIndex(null);
    } else {
      // Speak the message
      cancelSpeech(); // Cancel any current speech first
      speak(content, { skipTranscript: true });
      setSpeakingMessageIndex(index);
    }
  }, [isSpeaking, speakingMessageIndex, speak, cancelSpeech]);
  
  // Reset speaking index when speech ends
  useEffect(() => {
    if (!isSpeaking) {
      setSpeakingMessageIndex(null);
    }
  }, [isSpeaking]);

  // Scroll to top so the newest message (displayed first) is always visible
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 0;
    }
  }, [messages]);

  // Announce new messages to screen readers
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        const announcer = document.getElementById("sr-announcements");
        if (announcer) {
          announcer.textContent = `Interviewer says: ${lastMessage.content.substring(0, 100)}${lastMessage.content.length > 100 ? "..." : ""}`;
        }
      }
    }
  }, [messages]);

  return (
    <section 
      className="panel panel--chat" 
      aria-labelledby="chat-heading"
      role="region"
    >
      <div className="panel__header" id="chat-heading">
        <span className="panel__header-icon" aria-hidden="true">🎙️</span>
        Interviewer
      </div>
      <div className="chat">
        <div 
          className="chat__messages" 
          ref={messagesContainerRef}
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
          tabIndex={0}
        >
          {[...messages].reverse().map((message, reversedIndex) => {
            const originalIndex = messages.length - 1 - reversedIndex;
            const isInterruption = message.isInterruption;
            const isCurrentlySpeaking = isSpeaking && speakingMessageIndex === originalIndex;
            const isLatest = reversedIndex === 0;
            const messageClasses = [
              "chat__message",
              `chat__message--${message.role}`,
              isInterruption ? "chat__message--interruption" : "",
              isCurrentlySpeaking ? "chat__message--speaking" : "",
              isLatest ? "chat__message--latest" : ""
            ].filter(Boolean).join(" ");

            return (
              <article
                key={`${message.role}-${originalIndex}`}
                className={messageClasses}
                aria-label={`${message.role === "assistant" ? "Interviewer" : "You"}: ${message.content.substring(0, 50)}...`}
              >
                <div className="chat__role">
                  {message.role === "assistant" ? (
                    isInterruption ? (
                      <span className="chat__interviewer-label">
                        <span className="chat__interrupt-icon" aria-hidden="true">⚡</span>
                        <span>Interviewer</span>
                        <span className="sr-only">(proactive suggestion)</span>
                      </span>
                    ) : (
                      <span className="chat__interviewer-label">
                        <span className="chat__interviewer-icon" aria-hidden="true">👤</span>
                        <span>Interviewer</span>
                        {isCurrentlySpeaking && (
                          <span className="chat__speaking-indicator" aria-hidden="true">🔊</span>
                        )}
                      </span>
                    )
                  ) : (
                    <span className="chat__user-label">
                      <span className="chat__user-icon" aria-hidden="true">💻</span>
                      <span>You</span>
                    </span>
                  )}
                </div>
                <div className="chat__content">
                  {message.content}
                  
                  {/* Speak button for assistant messages */}
                  {message.role === "assistant" && showVoiceControls && voiceSupported && voiceSettings.voiceEnabled && (
                    <button
                      type="button"
                      className={`chat__speak-btn ${isCurrentlySpeaking ? 'chat__speak-btn--speaking' : ''}`}
                      onClick={() => handleSpeakMessage(message.content, originalIndex)}
                      aria-label={isCurrentlySpeaking ? "Stop speaking" : "Speak this message"}
                      title={isCurrentlySpeaking ? "Stop" : "Speak"}
                    >
                      {isCurrentlySpeaking ? '⏹️' : '🔊'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <div className="chat__input" role="form" aria-label="Send a message">
          <label htmlFor="chat-textarea" className="sr-only">
            Type your message to the interviewer
          </label>
          <textarea
            id="chat-textarea"
            ref={textareaRef}
            placeholder="Explain your approach or ask questions..."
            value={input}
            onChange={onInputChange}
            disabled={isLocked || isPaused}
            onKeyDown={onKeyDown}
            rows={3}
            aria-describedby="chat-hint"
          />
          <span id="chat-hint" className="sr-only">
            Press Enter to send, Shift+Enter for new line
          </span>
          <button
            type="button"
            onClick={onSend}
            disabled={isSending || isLocked || isPaused}
            aria-label={isSending ? "Sending message..." : "Send message"}
          >
            {isSending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default memo(ChatPanel);
