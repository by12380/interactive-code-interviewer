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

  // Scroll to bottom only within the chat panel (not the whole page)
  useEffect(() => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      // Scroll only the chat messages container, not the page
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section className="panel panel--chat">
      <div className="panel__header">
        <span className="panel__header-icon">🎙️</span>
        Interviewer
      </div>
      <div className="chat">
        <div className="chat__messages" ref={messagesContainerRef}>
          {messages.map((message, index) => {
            const isInterruption = message.isInterruption;
            const messageClasses = [
              "chat__message",
              `chat__message--${message.role}`,
              isInterruption ? "chat__message--interruption" : ""
            ].filter(Boolean).join(" ");

            return (
              <div
                key={`${message.role}-${index}`}
                className={messageClasses}
              >
                <div className="chat__role">
                  {message.role === "assistant" ? (
                    isInterruption ? (
                      <span className="chat__interviewer-label">
                        <span className="chat__interrupt-icon">⚡</span>
                        Interviewer
                      </span>
                    ) : (
                      <span className="chat__interviewer-label">
                        <span className="chat__interviewer-icon">👤</span>
                        Interviewer
                      </span>
                    )
                  ) : (
                    <span className="chat__user-label">
                      <span className="chat__user-icon">💻</span>
                      You
                    </span>
                  )}
                </div>
                <div className="chat__content">{message.content}</div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat__input">
          <textarea
            placeholder="Explain your approach or ask questions..."
            value={input}
            onChange={onInputChange}
            disabled={isLocked || isPaused}
            onKeyDown={onKeyDown}
            rows={3}
          />
          <button
            type="button"
            onClick={onSend}
            disabled={isSending || isLocked || isPaused}
          >
            {isSending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default memo(ChatPanel);
