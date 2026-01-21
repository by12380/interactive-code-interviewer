import { memo, useEffect, useRef } from "react";

function ChatPanel({
  messages,
  input,
  isLocked,
  isPaused,
  isSending,
  onInputChange,
  onKeyDown,
  onSend
}) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);

  // Scroll to bottom only within the chat panel (not the whole page)
  useEffect(() => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      // Scroll only the chat messages container, not the page
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
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
          {messages.map((message, index) => {
            const isInterruption = message.isInterruption;
            const messageClasses = [
              "chat__message",
              `chat__message--${message.role}`,
              isInterruption ? "chat__message--interruption" : ""
            ].filter(Boolean).join(" ");

            return (
              <article
                key={`${message.role}-${index}`}
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
                      </span>
                    )
                  ) : (
                    <span className="chat__user-label">
                      <span className="chat__user-icon" aria-hidden="true">💻</span>
                      <span>You</span>
                    </span>
                  )}
                </div>
                <div className="chat__content">{message.content}</div>
              </article>
            );
          })}
          <div ref={messagesEndRef} aria-hidden="true" />
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
