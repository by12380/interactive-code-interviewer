import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { sendChat } from "./api.js";

const DEFAULT_CODE = `function twoSum(nums, target) {
  // Your solution here
}
`;

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "I can review your approach as you code. Ask questions or paste ideas here."
    }
  ]);
  const lastProactiveHintRef = useRef("");
  const proactiveInFlightRef = useRef(false);
  const lastProactiveCodeRef = useRef("");
  const lastProactiveAtRef = useRef(0);
  const lastCodeSentRef = useRef("");
  const llmMessagesRef = useRef([]);

  const editorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 14,
      scrollBeyondLastLine: false,
      wordWrap: "on"
    }),
    []
  );

  const buildCodeMessage = (nextCode) => ({
    role: "user",
    content: `[code update]\n${nextCode || "// No code provided"}`
  });

  const appendCodeUpdateIfNeeded = (nextCode, messageList) => {
    if (nextCode === lastCodeSentRef.current) {
      return messageList;
    }

    lastCodeSentRef.current = nextCode;
    return [...messageList, buildCodeMessage(nextCode)];
  };

  useEffect(() => {
    const debounceMs = 1500;
    const maxWaitMs = 3000;
    const now = Date.now();
    const timeSinceLast = now - lastProactiveAtRef.current;
    const shouldForce = timeSinceLast >= maxWaitMs;
    const delay = shouldForce ? 0 : debounceMs;

    const timeout = setTimeout(async () => {
      if (proactiveInFlightRef.current) {
        return;
      }

      if (code === lastProactiveCodeRef.current) {
        return;
      }

      proactiveInFlightRef.current = true;
      lastProactiveCodeRef.current = code;

      try {
        const nextMessages = appendCodeUpdateIfNeeded(
          code,
          llmMessagesRef.current
        );
        llmMessagesRef.current = nextMessages;

        const data = await sendChat({
          messages: nextMessages,
          mode: "proactive"
        });
        lastProactiveAtRef.current = Date.now();

        if (!data?.reply) {
          return;
        }

        if (lastProactiveHintRef.current === data.reply) {
          return;
        }

        lastProactiveHintRef.current = data.reply;
        llmMessagesRef.current = [
          ...llmMessagesRef.current,
          { role: "assistant", content: data.reply }
        ];
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply }
        ]);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: ${error.message || "Unable to reach the server."}`
          }
        ]);
      } finally {
        proactiveInFlightRef.current = false;
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [code]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) {
      return;
    }

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const withCode = appendCodeUpdateIfNeeded(
        code,
        llmMessagesRef.current
      );
      const llmMessages = [...withCode, { role: "user", content: trimmed }];
      llmMessagesRef.current = llmMessages;

      const data = await sendChat({ messages: llmMessages, mode: "chat" });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply }
      ]);
      llmMessagesRef.current = [
        ...llmMessagesRef.current,
        { role: "assistant", content: data.reply }
      ];
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error.message || "Unable to reach the server."}`
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Live AI Coding Interviewer</h1>
        <p>Prototype UI with editor + chat. Proactive guidance is next.</p>
      </header>

      <main className="app__main">
        <section className="panel panel--editor">
          <div className="panel__header">Editor</div>
          <Editor
            height="100%"
            defaultLanguage="javascript"
            value={code}
            onChange={(value) => setCode(value ?? "")}
            options={editorOptions}
          />
        </section>

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
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                rows={3}
              />
              <button type="button" onClick={handleSend} disabled={isSending}>
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
