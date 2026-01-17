import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendChat } from "./api.js";
import Header from "./components/Header.jsx";
import EditorPanel from "./components/EditorPanel.jsx";
import ChatPanel from "./components/ChatPanel.jsx";
import SessionMetrics from "./components/SessionMetrics.jsx";
import ScoreReport from "./components/ScoreReport.jsx";
import Tutorial from "./components/Tutorial.jsx";

const DEFAULT_CODE = `function twoSum(nums, target) {
  // Your solution here
}
`;

const getTimeScore = (elapsedSeconds, limitSeconds) => {
  if (elapsedSeconds <= 10 * 60) {
    return 100;
  }
  if (elapsedSeconds <= 20 * 60) {
    return 80;
  }
  if (elapsedSeconds <= limitSeconds) {
    return 60;
  }
  return 40;
};

const getEfficiencyScore = (complexity) => {
  if (complexity === "Not evaluated") {
    return 0;
  }
  if (complexity === "O(n)") {
    return 100;
  }
  if (complexity === "O(n^2)") {
    return 50;
  }
  return 20;
};

const getHintsScore = (hintsUsed) => {
  if (hintsUsed <= 0) {
    return 100;
  }
  if (hintsUsed === 1) {
    return 80;
  }
  if (hintsUsed === 2) {
    return 60;
  }
  return 40;
};

const getTestsScore = (passed) => {
  if (passed === 0) {
    return 0;
  }
  if (passed >= 5) {
    return 100;
  }
  if (passed === 4) {
    return 80;
  }
  if (passed === 3) {
    return 60;
  }
  return 40;
};

const getGrade = (score) => {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 60) return "D";
  return "F";
};

const estimateEfficiency = (code) => {
  const loopMatches = code.match(/\b(for|while)\b/g) || [];
  if (loopMatches.length <= 1) {
    return "O(n)";
  }
  if (loopMatches.length === 2) {
    return "O(n^2)";
  }
  return "O(n^3)";
};

const evaluateTests = (code) => {
  const hasFunction = /function\s+twoSum|\bconst\s+twoSum\b|\bfunction\b/.test(
    code
  );
  const hasReturn = /\breturn\b/.test(code);
  const usesMap = /\bMap\b/.test(code) || /\bObject\b/.test(code);
  if (!hasFunction || !hasReturn) {
    return { passed: 1, note: "Missing a return or function definition." };
  }
  if (usesMap) {
    return { passed: 5, note: "All sample tests passed." };
  }
  if (/\bfor\b/.test(code)) {
    return { passed: 3, note: "Core cases passed; edge cases still failing." };
  }
  return { passed: 2, note: "Logic incomplete; verify inputs and outputs." };
};

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [difficulty, setDifficulty] = useState("Medium");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [testsPassed, setTestsPassed] = useState(0);
  const [efficiency, setEfficiency] = useState("Not evaluated");
  const [efficiencyNote, setEfficiencyNote] = useState(
    "Run analysis to estimate runtime."
  );
  const [testsNote, setTestsNote] = useState(
    "Run tests to evaluate correctness."
  );
  const [isReportVisible, setIsReportVisible] = useState(false);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [isTutorialVisible, setIsTutorialVisible] = useState(false);
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
  const pauseAtRef = useRef(0);
  const pausedDurationRef = useRef(0);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const undoRedoListenerRef = useRef(null);
  const reportRef = useRef(null);

  const TOTAL_SECONDS = 30 * 60;
  const remainingSeconds = Math.max(TOTAL_SECONDS - elapsedSeconds, 0);
  const isTimeUp = elapsedSeconds >= TOTAL_SECONDS;
  const isEditorDisabled = isLocked || isPaused;

  const editorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 14,
      scrollBeyondLastLine: false,
      wordWrap: "on",
      readOnly: isEditorDisabled
    }),
    [isEditorDisabled]
  );

  const buildCodeMessage = useCallback(
    (nextCode) => ({
      role: "user",
      content: `[code update]\n${nextCode || "// No code provided"}`
    }),
    []
  );

  useEffect(() => {
    if (isLocked || isPaused) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - startAtRef.current - pausedDurationRef.current) / 1000
      );
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLocked, isPaused]);

  useEffect(() => {
    if (isTimeUp && !isLocked) {
      setIsPaused(false);
      setIsLocked(true);
      setIsReportVisible(true);
    }
  }, [isLocked, isTimeUp]);

  useEffect(() => {
    if (isReportVisible) {
      reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isReportVisible]);

  const handlePauseToggle = useCallback(() => {
    if (isPaused) {
      const pausedFor = Date.now() - pauseAtRef.current;
      pausedDurationRef.current += pausedFor;
      setIsPaused(false);
      return;
    }

    pauseAtRef.current = Date.now();
    setIsPaused(true);
  }, [isPaused]);

  const appendCodeUpdateIfNeeded = useCallback((nextCode, messageList) => {
    if (nextCode === lastCodeSentRef.current) {
      return messageList;
    }

    lastCodeSentRef.current = nextCode;
    return [...messageList, buildCodeMessage(nextCode)];
  }, [buildCodeMessage]);

  const updateUndoRedoState = useCallback(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!model) {
      setCanUndo(false);
      setCanRedo(false);
      return;
    }

    setCanUndo(model.canUndo());
    setCanRedo(model.canRedo());
  }, []);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    updateUndoRedoState();

    if (undoRedoListenerRef.current) {
      undoRedoListenerRef.current.dispose();
    }
    undoRedoListenerRef.current = editor.onDidChangeModelContent(() => {
      updateUndoRedoState();
    });

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ,
      () => editor.trigger("keyboard", "undo", null)
    );
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ,
      () => editor.trigger("keyboard", "redo", null)
    );
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY,
      () => editor.trigger("keyboard", "redo", null)
    );
  }, [updateUndoRedoState]);

  useEffect(() => {
    return () => {
      if (undoRedoListenerRef.current) {
        undoRedoListenerRef.current.dispose();
      }
    };
  }, []);

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

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) {
      return;
    }

    if (/\bhint\b/i.test(trimmed)) {
      setHintsUsed((prev) => prev + 1);
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
  }, [appendCodeUpdateIfNeeded, code, input, isSending, messages]);

  const handleEditorChange = useCallback((value) => {
    setCode(value ?? "");
  }, []);

  const handleUndo = useCallback(() => {
    editorRef.current?.trigger("toolbar", "undo", null);
  }, []);

  const handleRedo = useCallback(() => {
    editorRef.current?.trigger("toolbar", "redo", null);
  }, []);

  const handleDifficultyChange = useCallback((value) => {
    setDifficulty(value);
  }, []);

  const handleStop = useCallback(() => {
    setIsPaused(false);
    setIsLocked(true);
    setIsReportVisible(true);
  }, []);

  const handleInputChange = useCallback((event) => {
    setInput(event.target.value);
  }, []);

  const handleInputKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleEvaluateEfficiency = useCallback(() => {
    const estimate = estimateEfficiency(code);
    setEfficiency(estimate);
    setEfficiencyNote(
      estimate === "O(n)"
        ? "Looks optimal based on loop structure."
        : estimate === "O(n^2)"
        ? "Nested loops detected; consider a hash map."
        : "Multiple loops detected; optimize if possible."
    );
  }, [code]);

  const handleRunTests = useCallback(() => {
    const result = evaluateTests(code);
    setTestsPassed(result.passed);
    setTestsNote(result.note);
  }, [code]);

  const handleStartTutorial = useCallback(() => {
    setIsTutorialVisible(true);
  }, []);

  const handleCloseTutorial = useCallback(() => {
    setIsTutorialVisible(false);
  }, []);

  const timeScore = useMemo(
    () => getTimeScore(elapsedSeconds, TOTAL_SECONDS),
    [elapsedSeconds]
  );
  const efficiencyScore = useMemo(
    () => getEfficiencyScore(efficiency),
    [efficiency]
  );
  const hintsScore = useMemo(() => getHintsScore(hintsUsed), [hintsUsed]);
  const testsScore = useMemo(() => getTestsScore(testsPassed), [testsPassed]);
  const totalScore = useMemo(() => {
    const weighted =
      timeScore * 0.25 +
      efficiencyScore * 0.35 +
      hintsScore * 0.15 +
      testsScore * 0.25;
    return Math.round(weighted);
  }, [efficiencyScore, hintsScore, testsScore, timeScore]);
  const grade = useMemo(() => getGrade(totalScore), [totalScore]);

  const reportBreakdown = useMemo(
    () => [
      { label: "Time", score: timeScore, weight: 25 },
      { label: "Efficiency", score: efficiencyScore, weight: 35 },
      { label: "Hints", score: hintsScore, weight: 15 },
      { label: "Tests", score: testsScore, weight: 25 }
    ],
    [efficiencyScore, hintsScore, testsScore, timeScore]
  );

  const historyData = useMemo(
    () => [
      { session: "S1", score: 76 },
      { session: "S2", score: 84 },
      { session: "S3", score: 91 },
      { session: "S4", score: totalScore }
    ],
    [totalScore]
  );

  const detailedAnalysis = useMemo(
    () => ({
      review: [
        "Good structure and clean control flow.",
        "Consider adding edge-case handling for empty inputs.",
        "Add comments to clarify the reasoning behind the chosen approach."
      ],
      comparison: {
        userTime: "15:23",
        avgTime: "18:45",
        topTime: "12:30"
      },
      history: [
        { problem: "Two Sum", score: 89 },
        { problem: "Valid Parentheses", score: 75 },
        { problem: "Merge Intervals", score: 92 }
      ],
      average: 85
    }),
    []
  );

  const aiFeedback = useMemo(() => {
    if (efficiencyScore >= 100 && testsScore >= 80) {
      return "Strong solution quality. Keep emphasizing edge cases for robustness.";
    }
    if (testsScore < 60) {
      return "Some test cases are still failing. Revisit edge cases and input parsing.";
    }
    if (hintsScore < 80) {
      return "Nice progress. Aim to solve without hints to boost your score.";
    }
    return "Solid performance. Review runtime complexity for further gains.";
  }, [efficiencyScore, hintsScore, testsScore]);

  return (
    <div className="app">
      <Header
        difficulty={difficulty}
        isLocked={isLocked}
        isPaused={isPaused}
        isTimeUp={isTimeUp}
        remainingSeconds={remainingSeconds}
        onDifficultyChange={handleDifficultyChange}
        onPauseToggle={handlePauseToggle}
        onStop={handleStop}
        onStartTutorial={handleStartTutorial}
      />

      <main className="app__main">
        <EditorPanel
          canUndo={canUndo}
          canRedo={canRedo}
          isEditorDisabled={isEditorDisabled}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onEditorMount={handleEditorMount}
          onCodeChange={handleEditorChange}
          editorOptions={editorOptions}
          defaultCode={DEFAULT_CODE}
        />
        <div className="app__sidebar">
          <ChatPanel
            messages={messages}
            input={input}
            isLocked={isLocked}
            isPaused={isPaused}
            isSending={isSending}
            onInputChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onSend={handleSend}
          />
          <SessionMetrics
            hintsUsed={hintsUsed}
            testsPassed={testsPassed}
            efficiency={efficiency}
            efficiencyNote={efficiencyNote}
            testsNote={testsNote}
            isLocked={isLocked}
            onEvaluateEfficiency={handleEvaluateEfficiency}
            onRunTests={handleRunTests}
            onComplete={handleStop}
          />
        </div>
      </main>
      <div ref={reportRef}>
        <ScoreReport
          isVisible={isReportVisible}
          totalScore={totalScore}
          grade={grade}
          timeSummary={{
            takenSeconds: elapsedSeconds,
            limitSeconds: TOTAL_SECONDS,
            score: timeScore,
            note:
              timeScore >= 100
                ? "Completed quickly!"
                : timeScore >= 80
                ? "Nice pacing throughout."
                : timeScore >= 60
                ? "Used the full time window."
                : "Went beyond the time limit."
          }}
          efficiencySummary={{
            label: efficiency,
            score: efficiencyScore,
            note:
              efficiencyScore >= 100
                ? "Optimal solution!"
                : efficiencyScore >= 50
                ? "A solid brute-force baseline."
                : "Consider optimizing for speed."
          }}
          hintsSummary={{
            count: hintsUsed,
            score: hintsScore,
            note:
              hintsScore >= 100
                ? "Solved without hints."
                : hintsScore >= 60
                ? "Try solving with fewer hints."
                : "Leverage hints more strategically."
          }}
          testsSummary={{
            passed: testsPassed,
            score: testsScore,
            note:
              testsScore >= 100
                ? "All tests passed!"
                : testsScore >= 80
                ? "Almost there—one test failed."
                : testsScore >= 60
                ? "A few tests still need attention."
                : "Revisit the failing test cases."
          }}
          breakdown={reportBreakdown}
          history={historyData}
          onToggleDetails={() => setIsDetailsVisible((prev) => !prev)}
          isDetailsVisible={isDetailsVisible}
          aiFeedback={aiFeedback}
          detailedAnalysis={detailedAnalysis}
        />
      </div>

      <Tutorial isVisible={isTutorialVisible} onClose={handleCloseTutorial} />
    </div>
  );
}
