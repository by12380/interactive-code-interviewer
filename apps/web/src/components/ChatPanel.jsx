import { memo } from "react";

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
  return (
    <section className="panel panel--chat">
      <div className="panel__header">Interview Coach</div>
      <div className="chat">
        <div className="chat__messages">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`chat__message chat__message--${message.role}`}
            >
              <div className="chat__role">{message.role}</div>
              <div className="chat__content">{message.content}</div>
            </div>
          ))}
        </div>
        <div className="chat__input">
          <textarea
            placeholder="Ask for guidance or explain your approach..."
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
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default memo(ChatPanel);
