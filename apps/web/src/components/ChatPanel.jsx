import { useState } from "react";
import { sendChatMessage } from "../lib/api.js";

export default function ChatPanel({ code }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Welcome! Start coding and I'll guide you." }
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const userMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const response = await sendChatMessage({ messages: [...messages, userMessage], code });
      const assistantMessage = {
        role: "assistant",
        content: response.reply || "No response received."
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error contacting the server." }
      ]);
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="chat">
      <div className="panel__title">Interviewer</div>
      <div className="chat__messages">
        {messages.map((message, index) => (
          <div key={index} className={`chat__message chat__message--${message.role}`}>
            <strong>{message.role === "assistant" ? "AI" : "You"}:</strong>{" "}
            {message.content}
          </div>
        ))}
      </div>
      <div className="chat__input">
        <input
          type="text"
          placeholder="Ask a question..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSend();
          }}
          disabled={isSending}
        />
        <button type="button" onClick={handleSend} disabled={isSending}>
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
