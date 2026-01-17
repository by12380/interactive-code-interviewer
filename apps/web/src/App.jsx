import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { sendChat } from "./api.js";
import TutorialOverlay from "./TutorialOverlay.jsx";

const DEFAULT_CODE = `function twoSum(nums, target) {
  // Your solution here
}
`;

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [difficulty, setDifficulty] = useState("Medium");
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
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
  const startAtRef = useRef(Date.now());

  const TOTAL_SECONDS = 30 * 60;
  const remainingSeconds = Math.max(TOTAL_SECONDS - elapsedSeconds, 0);
  const isTimeUp = elapsedSeconds >= TOTAL_SECONDS;

  const tutorialSteps = useMemo(
    () => [
      {
        targetSelector: '[data-tutorial="difficulty"]',
        title: "Difficulty",
        body:
          "Use this to set the interview difficulty. You can lock it once the interview starts so requirements stay consistent.",
        highlightPadding: 10,
        highlightRadius: 16
      },
      {
        targetSelector: '[data-tutorial="timer"]',
        title: "Timer + Stop",
        body:
          "This tracks how much time is left. When you hit Stop (or time runs out), the interview can be locked to simulate a real session.",
        highlightPadding: 10,
        highlightRadius: 16
      },
      {
        targetSelector: '[data-tutorial="editor"]',
        title: "Code editor",
        body:
          "This is where you solve the problem. Your code can be shared with the AI coach for feedback while you type.",
        highlightPadding: 10,
        highlightRadius: 18
      },
      {
        targetSelector: '[data-tutorial="coach"]',
        title: "AI Interview Coach",
        body:
          "Ask questions, explain your approach, or request hints. The coach can also send proactive feedback based on your latest code changes.",
        highlightPadding: 10,
        highlightRadius: 18
      }
    ],
    []
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldAutoStart = params.get("tutorial") === "1";
    if (shouldAutoStart) {
      setIsTutorialOpen(true);
      setTutorialStepIndex(0);
    }
  }, []);

  const editorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 14,
      scrollBeyondLastLine: false,
      wordWrap: "on",
      readOnly: isLocked
    }),
    [isLocked]
  );

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const buildCodeMessage = (nextCode) => ({
    role: "user",
    content: `[code update]\n${nextCode || "// No code provided"}`
  });

  useEffect(() => {
    if (isLocked) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startAtRef.current) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLocked]);

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
      <TutorialOverlay
        isOpen={isTutorialOpen}
        steps={tutorialSteps}
        stepIndex={tutorialStepIndex}
        onStepChange={setTutorialStepIndex}
        onClose={() => {
          setIsTutorialOpen(false);
          setTutorialStepIndex(0);
        }}
      />
      <header className="app__header">
        <div className="app__header-text">
          <h1>Live AI Coding Interviewer</h1>
          <p>Prototype UI with editor + chat. Proactive guidance is next.</p>
        </div>
        <div className="app__header-actions">
          <div className="difficulty-card" data-tutorial="difficulty">
            <span className="difficulty-card__label">Difficulty</span>
            <select
              className="difficulty-card__select"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              disabled={isLocked}
              aria-label="Select interview difficulty"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
          <div className="time-card" data-tutorial="timer">
            <div className="time-tracker">
              <span className="time-tracker__label">Time left</span>
              <span className="time-tracker__value">
                {isTimeUp ? "00:00" : formatTime(remainingSeconds)}
              </span>
              {isTimeUp && (
                <span className="time-tracker__status">Time is up</span>
              )}
            </div>
            <button
              type="button"
              className="time-tracker__action"
              onClick={() => setIsLocked(true)}
              disabled={isLocked}
              aria-label="Stop interview"
            >
              <span className="time-tracker__icon" aria-hidden="true">
                ■
              </span>
              Stop
            </button>
          </div>
          <button
            type="button"
            className="tutorial-trigger"
            onClick={() => {
              setIsTutorialOpen(true);
              setTutorialStepIndex(0);
            }}
            aria-label="Start tutorial"
          >
            Tutorial
          </button>
        </div>
      </header>

      <main className="app__main">
        <section className="panel panel--editor" data-tutorial="editor">
          <div className="panel__header">Editor</div>
          <Editor
            height="100%"
            defaultLanguage="javascript"
            value={code}
            onChange={(value) => setCode(value ?? "")}
            options={editorOptions}
          />
        </section>

        <section className="panel panel--chat" data-tutorial="coach">
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
                disabled={isLocked}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                rows={3}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending || isLocked}
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
