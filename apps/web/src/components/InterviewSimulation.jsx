import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendChat } from "../api.js";
import { PROBLEMS, getProblemById, getProblemsByDifficulty } from "../data/problems.js";
import {
  INTERVIEW_CONFIG,
  BEHAVIORAL_QUESTIONS,
  SYSTEM_DESIGN_PROBLEMS,
  INTERVIEWER_PERSONAS,
  FEEDBACK_CATEGORIES,
  getRandomBehavioralQuestions,
  getRandomSystemDesignProblem
} from "../data/interviewConfig.js";
import EditorPanel from "./EditorPanel.jsx";
import ConsolePanel from "./ConsolePanel.jsx";
import ChatPanel from "./ChatPanel.jsx";
import BehavioralQuestion from "./BehavioralQuestion.jsx";
import SystemDesignPanel from "./SystemDesignPanel.jsx";
import InterviewFeedback from "./InterviewFeedback.jsx";
import VideoRecorder from "./VideoRecorder.jsx";

// Interview phases
const PHASES = {
  INTRO: "intro",
  BEHAVIORAL: "behavioral",
  CODING: "coding",
  SYSTEM_DESIGN: "system_design",
  WRAP_UP: "wrap_up",
  FEEDBACK: "feedback"
};

// Helper to run test cases
const runTestCases = (code, testCases, problem) => {
  if (!testCases || testCases.length === 0) {
    return { passed: 0, total: 0, results: [] };
  }

  const results = [];
  let passed = 0;

  const functionMatch = problem.starterCode.match(/function\s+(\w+)/);
  const functionName = functionMatch ? functionMatch[1] : null;

  if (!functionName) {
    return { passed: 0, total: testCases.length, results: [] };
  }

  for (const testCase of testCases) {
    try {
      const inputArgs = Object.values(testCase.input)
        .map(v => JSON.stringify(v))
        .join(", ");

      const testCode = `
        ${code}
        return ${functionName}(${inputArgs});
      `;

      const runTest = new Function(testCode);
      const result = runTest();

      const isCorrect = JSON.stringify(result) === JSON.stringify(testCase.expected);

      if (isCorrect) passed++;

      results.push({
        input: testCase.input,
        expected: testCase.expected,
        actual: result,
        passed: isCorrect
      });
    } catch (error) {
      results.push({
        input: testCase.input,
        expected: testCase.expected,
        actual: `Error: ${error.message}`,
        passed: false
      });
    }
  }

  return { passed, total: testCases.length, results };
};

export default function InterviewSimulation({
  mode = "standard",
  persona = "neutral",
  onComplete,
  onExit,
  enableVideoRecording = false,
  customConfig = null
}) {
  // Interview configuration - use custom config if provided
  const config = customConfig ? {
    name: "Custom Interview",
    description: "Your personalized interview",
    totalTime: customConfig.timeLimit || 60 * 60,
    codingProblems: customConfig.codingProblems || 2,
    behavioralQuestions: customConfig.behavioralQuestions || 2,
    systemDesign: customConfig.systemDesign || false,
    difficultyProgression: false
  } : INTERVIEW_CONFIG.modes[mode] || INTERVIEW_CONFIG.modes.standard;
  
  const interviewer = INTERVIEWER_PERSONAS.find(p => p.id === persona) || INTERVIEWER_PERSONAS[1];

  // Phase management
  const [currentPhase, setCurrentPhase] = useState(PHASES.INTRO);
  const [phaseIndex, setPhaseIndex] = useState(0);

  // Helper to get behavioral questions based on categories
  const getFilteredBehavioralQuestions = (count, categories = null) => {
    let filtered = BEHAVIORAL_QUESTIONS;
    if (categories && categories.length > 0) {
      filtered = BEHAVIORAL_QUESTIONS.filter(q => categories.includes(q.category));
    }
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  // Helper to select coding problems based on custom config
  const selectFilteredCodingProblems = (count, difficulties = null, categories = null) => {
    if (count === 0) return [];
    
    let filtered = PROBLEMS;
    
    // Filter by difficulties
    if (difficulties && difficulties.length > 0) {
      filtered = filtered.filter(p => difficulties.includes(p.difficulty));
    }
    
    // Filter by categories
    if (categories && categories.length > 0) {
      filtered = filtered.filter(p => categories.includes(p.category));
    }
    
    // Shuffle and select
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  };

  // Generate interview schedule
  const schedule = useMemo(() => {
    const items = [];

    // Add intro phase
    items.push({ type: PHASES.INTRO, duration: 60 });

    // Get behavioral questions (with custom categories if provided)
    const behavioralQuestions = customConfig?.behavioralCategories
      ? getFilteredBehavioralQuestions(config.behavioralQuestions, customConfig.behavioralCategories)
      : getRandomBehavioralQuestions(config.behavioralQuestions);
    
    // Get coding problems (with custom difficulties/categories if provided)
    const codingProblems = customConfig
      ? selectFilteredCodingProblems(
          config.codingProblems,
          customConfig.difficulties,
          customConfig.categories
        )
      : selectCodingProblems(config.codingProblems, config.difficultyProgression);

    let behavioralIndex = 0;
    let codingIndex = 0;

    // Start with a behavioral if we have any
    if (behavioralQuestions.length > 0) {
      items.push({
        type: PHASES.BEHAVIORAL,
        data: behavioralQuestions[behavioralIndex++],
        duration: INTERVIEW_CONFIG.timing.behavioralQuestion
      });
    }

    // Alternate coding and behavioral
    while (codingIndex < codingProblems.length) {
      items.push({
        type: PHASES.CODING,
        data: codingProblems[codingIndex],
        duration: codingProblems[codingIndex].timeLimit || 30 * 60
      });
      codingIndex++;

      if (behavioralIndex < behavioralQuestions.length) {
        items.push({
          type: PHASES.BEHAVIORAL,
          data: behavioralQuestions[behavioralIndex++],
          duration: INTERVIEW_CONFIG.timing.behavioralQuestion
        });
      }
    }

    // Add remaining behavioral questions
    while (behavioralIndex < behavioralQuestions.length) {
      items.push({
        type: PHASES.BEHAVIORAL,
        data: behavioralQuestions[behavioralIndex++],
        duration: INTERVIEW_CONFIG.timing.behavioralQuestion
      });
    }

    // Add system design if configured
    if (config.systemDesign) {
      const sdProblem = getRandomSystemDesignProblem();
      items.push({
        type: PHASES.SYSTEM_DESIGN,
        data: sdProblem,
        duration: sdProblem.timeLimit
      });
    }

    // Add wrap-up phase
    items.push({ type: PHASES.WRAP_UP, duration: 2 * 60 });

    return items;
  }, [config, customConfig]);

  // Timing state
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [phaseElapsed, setPhaseElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef(Date.now());
  const phaseStartRef = useRef(Date.now());
  const pausedDurationRef = useRef(0);
  const pauseStartRef = useRef(0);

  // Coding state
  const [code, setCode] = useState("");
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const llmMessagesRef = useRef([]);

  // Results tracking
  const [problemResults, setProblemResults] = useState([]);
  const [behavioralResponses, setBehavioralResponses] = useState([]);
  const [systemDesignNotes, setSystemDesignNotes] = useState("");

  // Video recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);

  // Current phase data
  const currentItem = schedule[phaseIndex];
  const currentProblem = currentItem?.type === PHASES.CODING ? currentItem.data : null;
  const currentBehavioral = currentItem?.type === PHASES.BEHAVIORAL ? currentItem.data : null;
  const currentSystemDesign = currentItem?.type === PHASES.SYSTEM_DESIGN ? currentItem.data : null;

  // Initialize code when problem changes
  useEffect(() => {
    if (currentProblem) {
      setCode(currentProblem.starterCode || "");
      setConsoleLogs([]);
      setMessages([{
        role: "assistant",
        content: `Alright, let's move on to a coding problem. Here's your challenge:\n\n**${currentProblem.title}** (${currentProblem.difficulty})\n\nTake a moment to read the problem, then walk me through your initial thoughts before you start coding.`
      }]);
      llmMessagesRef.current = [];
    }
  }, [currentProblem]);

  // Initialize behavioral question messages
  useEffect(() => {
    if (currentBehavioral) {
      setMessages([{
        role: "assistant",
        content: `Let's take a short break from coding for a behavioral question.\n\n**${currentBehavioral.question}**\n\nTake your time to think about a specific example from your experience.`
      }]);
      llmMessagesRef.current = [];
    }
  }, [currentBehavioral]);

  // Initialize intro messages
  useEffect(() => {
    if (currentPhase === PHASES.INTRO) {
      setMessages([{
        role: "assistant",
        content: `Hi! I'm ${interviewer.name}, and I'll be your interviewer today. Welcome to your ${config.name} interview simulation.\n\nThis session will last about ${Math.round(config.totalTime / 60)} minutes and will include ${config.codingProblems} coding problem${config.codingProblems !== 1 ? 's' : ''}${config.behavioralQuestions > 0 ? `, ${config.behavioralQuestions} behavioral question${config.behavioralQuestions !== 1 ? 's' : ''}` : ''}${config.systemDesign ? ', and a system design discussion' : ''}.\n\nBefore we begin, do you have any questions about the format? When you're ready, just say "ready" or click the Start button.`
      }]);
    }
  }, [currentPhase, interviewer, config]);

  // Timer effect
  useEffect(() => {
    if (isPaused || currentPhase === PHASES.FEEDBACK) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const total = Math.floor((now - startTimeRef.current - pausedDurationRef.current) / 1000);
      const phase = Math.floor((now - phaseStartRef.current - pausedDurationRef.current) / 1000);

      setTotalElapsed(total);
      setPhaseElapsed(phase);

      // Check if phase time is up
      if (currentItem && phase >= currentItem.duration) {
        handlePhaseComplete();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, currentPhase, phaseIndex, currentItem]);

  // Select coding problems based on difficulty progression
  function selectCodingProblems(count, useProgression) {
    if (count === 0) return [];

    const difficulties = useProgression
      ? INTERVIEW_CONFIG.difficultyProgression[count] || ["Medium"]
      : Array(count).fill("Medium");

    const selected = [];
    const usedIds = new Set();

    for (const difficulty of difficulties) {
      const available = PROBLEMS.filter(
        p => p.difficulty === difficulty && !usedIds.has(p.id)
      );

      if (available.length > 0) {
        const problem = available[Math.floor(Math.random() * available.length)];
        selected.push(problem);
        usedIds.add(problem.id);
      } else {
        // Fallback to any available problem
        const fallback = PROBLEMS.filter(p => !usedIds.has(p.id));
        if (fallback.length > 0) {
          const problem = fallback[Math.floor(Math.random() * fallback.length)];
          selected.push(problem);
          usedIds.add(problem.id);
        }
      }
    }

    return selected;
  }

  // Handle pause toggle
  const handlePauseToggle = useCallback(() => {
    if (isPaused) {
      const pausedFor = Date.now() - pauseStartRef.current;
      pausedDurationRef.current += pausedFor;
      setIsPaused(false);
    } else {
      pauseStartRef.current = Date.now();
      setIsPaused(true);
    }
  }, [isPaused]);

  // Handle phase completion
  const handlePhaseComplete = useCallback(() => {
    // Save current phase results
    if (currentItem?.type === PHASES.CODING && currentProblem) {
      const testResults = runTestCases(code, currentProblem.testCases, currentProblem);
      setProblemResults(prev => [...prev, {
        problemId: currentProblem.id,
        problemTitle: currentProblem.title,
        difficulty: currentProblem.difficulty,
        code,
        testResults,
        timeSpent: phaseElapsed
      }]);
    }

    if (currentItem?.type === PHASES.BEHAVIORAL && currentBehavioral) {
      setBehavioralResponses(prev => [...prev, {
        questionId: currentBehavioral.id,
        question: currentBehavioral.question,
        timeSpent: phaseElapsed
      }]);
    }

    // Move to next phase
    if (phaseIndex < schedule.length - 1) {
      setPhaseIndex(prev => prev + 1);
      setPhaseElapsed(0);
      phaseStartRef.current = Date.now();

      const nextItem = schedule[phaseIndex + 1];
      setCurrentPhase(nextItem.type);
    } else {
      // Interview complete
      setCurrentPhase(PHASES.FEEDBACK);
    }
  }, [currentItem, currentProblem, currentBehavioral, code, phaseElapsed, phaseIndex, schedule]);

  // Handle manual phase skip
  const handleSkipPhase = useCallback(() => {
    handlePhaseComplete();
  }, [handlePhaseComplete]);

  // Handle start (from intro)
  const handleStart = useCallback(() => {
    if (phaseIndex === 0) {
      handlePhaseComplete();
    }
  }, [phaseIndex, handlePhaseComplete]);

  // Chat handlers
  const handleSendMessage = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isSending) return;

    // Check for "ready" in intro phase
    if (currentPhase === PHASES.INTRO && /\bready\b/i.test(trimmed)) {
      handleStart();
    }

    setMessages(prev => [...prev, { role: "user", content: trimmed }]);
    setChatInput("");
    setIsSending(true);

    try {
      const contextMessages = [...llmMessagesRef.current, { role: "user", content: trimmed }];

      // Add current code context for coding phase
      if (currentPhase === PHASES.CODING && code) {
        contextMessages.push({
          role: "user",
          content: `[Current code]\n${code}`
        });
      }

      llmMessagesRef.current = contextMessages;

      const systemContext = currentPhase === PHASES.BEHAVIORAL
        ? `interview_behavioral`
        : currentPhase === PHASES.SYSTEM_DESIGN
          ? `interview_system_design`
          : `interview_coding`;

      const data = await sendChat({
        messages: contextMessages,
        mode: "chat",
        interruptContext: {
          interviewPhase: currentPhase,
          interviewerStyle: interviewer.promptModifier,
          problemTitle: currentProblem?.title || currentSystemDesign?.title || null
        }
      });

      const reply = data.reply || "I see. Please continue.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      llmMessagesRef.current.push({ role: "assistant", content: reply });
    } catch (error) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `I apologize, I'm having some technical difficulties. Please continue with your answer.`
      }]);
    } finally {
      setIsSending(false);
    }
  }, [chatInput, isSending, currentPhase, code, interviewer, currentProblem, currentSystemDesign, handleStart]);

  const handleChatInputChange = useCallback((e) => {
    setChatInput(e.target.value);
  }, []);

  const handleChatKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Code editor handlers
  const handleCodeChange = useCallback((value) => {
    setCode(value || "");
  }, []);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  }, []);

  const handleRunCode = useCallback(() => {
    if (isRunning) return;

    setIsRunning(true);
    setConsoleLogs([]);

    setTimeout(() => {
      const logs = [];
      const captureConsole = {
        log: (...args) => logs.push({ type: "log", value: args.length === 1 ? args[0] : args }),
        error: (...args) => logs.push({ type: "error", value: args.length === 1 ? args[0] : args }),
        warn: (...args) => logs.push({ type: "warn", value: args.length === 1 ? args[0] : args }),
        info: (...args) => logs.push({ type: "info", value: args.length === 1 ? args[0] : args }),
        clear: () => { logs.length = 0; }
      };

      try {
        const runCode = new Function("console", `"use strict";\n${code}`);
        const result = runCode(captureConsole);
        if (result !== undefined) {
          logs.push({ type: "result", value: result });
        }
      } catch (error) {
        logs.push({ type: "error", value: `${error.name}: ${error.message}` });
      }

      setConsoleLogs(logs);
      setIsRunning(false);
    }, 100);
  }, [code, isRunning]);

  const handleClearConsole = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  // Video recording handlers
  const handleRecordingStart = useCallback(() => {
    setIsRecording(true);
    setRecordedChunks([]);
  }, []);

  const handleRecordingStop = useCallback((chunks) => {
    setIsRecording(false);
    setRecordedChunks(chunks);
  }, []);

  // System design notes handler
  const handleSystemDesignNotesChange = useCallback((notes) => {
    setSystemDesignNotes(notes);
  }, []);

  // Calculate final results
  const finalResults = useMemo(() => {
    if (currentPhase !== PHASES.FEEDBACK) return null;

    const codingScore = problemResults.reduce((sum, result) => {
      const testScore = result.testResults.total > 0
        ? (result.testResults.passed / result.testResults.total) * 100
        : 0;
      return sum + testScore;
    }, 0) / Math.max(problemResults.length, 1);

    return {
      totalTime: totalElapsed,
      codingProblems: problemResults,
      behavioralResponses,
      systemDesignNotes,
      overallScore: Math.round(codingScore),
      recordedVideo: recordedChunks.length > 0 ? recordedChunks : null
    };
  }, [currentPhase, totalElapsed, problemResults, behavioralResponses, systemDesignNotes, recordedChunks]);

  // Handle final completion
  const handleFinish = useCallback(() => {
    if (onComplete && finalResults) {
      onComplete(finalResults);
    }
  }, [onComplete, finalResults]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const phaseTimeRemaining = currentItem ? Math.max(currentItem.duration - phaseElapsed, 0) : 0;
  const totalTimeRemaining = Math.max(config.totalTime - totalElapsed, 0);

  // Render phase content
  const renderPhaseContent = () => {
    switch (currentPhase) {
      case PHASES.INTRO:
      case PHASES.WRAP_UP:
        return (
          <div className="interview-sim__intro-content">
            <ChatPanel
              messages={messages}
              input={chatInput}
              isLocked={false}
              isPaused={isPaused}
              isSending={isSending}
              onInputChange={handleChatInputChange}
              onKeyDown={handleChatKeyDown}
              onSend={handleSendMessage}
            />
            {currentPhase === PHASES.INTRO && (
              <button
                className="interview-sim__start-btn"
                onClick={handleStart}
              >
                Start Interview
              </button>
            )}
            {currentPhase === PHASES.WRAP_UP && (
              <button
                className="interview-sim__finish-btn"
                onClick={handlePhaseComplete}
              >
                Complete Interview
              </button>
            )}
          </div>
        );

      case PHASES.BEHAVIORAL:
        return (
          <BehavioralQuestion
            question={currentBehavioral}
            messages={messages}
            chatInput={chatInput}
            isSending={isSending}
            isPaused={isPaused}
            onInputChange={handleChatInputChange}
            onKeyDown={handleChatKeyDown}
            onSend={handleSendMessage}
            onSkip={handleSkipPhase}
            timeRemaining={phaseTimeRemaining}
          />
        );

      case PHASES.CODING:
        return (
          <div className="interview-sim__coding-layout">
            <div className="interview-sim__problem-info">
              <h3>{currentProblem?.title}</h3>
              <span className={`difficulty-badge difficulty-badge--${currentProblem?.difficulty?.toLowerCase()}`}>
                {currentProblem?.difficulty}
              </span>
              <p>{currentProblem?.description}</p>
              <div className="interview-sim__examples">
                <h4>Examples:</h4>
                {currentProblem?.examples?.map((ex, i) => (
                  <div key={i} className="example-block">
                    <code>Input: {ex.input}</code>
                    <code>Output: {ex.output}</code>
                    {ex.explanation && <small>{ex.explanation}</small>}
                  </div>
                ))}
              </div>
            </div>
            <div className="interview-sim__editor-area">
              <EditorPanel
                canUndo={true}
                canRedo={true}
                isEditorDisabled={isPaused}
                isRunning={isRunning}
                onUndo={() => editorRef.current?.trigger("toolbar", "undo", null)}
                onRedo={() => editorRef.current?.trigger("toolbar", "redo", null)}
                onRun={handleRunCode}
                onEditorMount={handleEditorMount}
                onCodeChange={handleCodeChange}
                editorOptions={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  readOnly: isPaused
                }}
                code={code}
              />
              <ConsolePanel
                logs={consoleLogs}
                onClear={handleClearConsole}
                isRunning={isRunning}
              />
            </div>
            <div className="interview-sim__chat-area">
              <ChatPanel
                messages={messages}
                input={chatInput}
                isLocked={false}
                isPaused={isPaused}
                isSending={isSending}
                onInputChange={handleChatInputChange}
                onKeyDown={handleChatKeyDown}
                onSend={handleSendMessage}
              />
            </div>
          </div>
        );

      case PHASES.SYSTEM_DESIGN:
        return (
          <SystemDesignPanel
            problem={currentSystemDesign}
            messages={messages}
            chatInput={chatInput}
            isSending={isSending}
            isPaused={isPaused}
            notes={systemDesignNotes}
            onNotesChange={handleSystemDesignNotesChange}
            onInputChange={handleChatInputChange}
            onKeyDown={handleChatKeyDown}
            onSend={handleSendMessage}
            onSkip={handleSkipPhase}
            timeRemaining={phaseTimeRemaining}
          />
        );

      case PHASES.FEEDBACK:
        return (
          <InterviewFeedback
            results={finalResults}
            interviewer={interviewer}
            config={config}
            onFinish={handleFinish}
            onRetry={() => window.location.reload()}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="interview-sim">
      {/* Header */}
      <header className="interview-sim__header">
        <div className="interview-sim__header-left">
          <h2>Interview Simulation</h2>
          <span className="interview-sim__mode-badge">{config.name}</span>
        </div>

        <div className="interview-sim__header-center">
          <div className="interview-sim__phase-indicator">
            <span className="phase-label">
              {currentPhase === PHASES.INTRO && "Introduction"}
              {currentPhase === PHASES.BEHAVIORAL && `Behavioral (${behavioralResponses.length + 1}/${config.behavioralQuestions})`}
              {currentPhase === PHASES.CODING && `Coding (${problemResults.length + 1}/${config.codingProblems})`}
              {currentPhase === PHASES.SYSTEM_DESIGN && "System Design"}
              {currentPhase === PHASES.WRAP_UP && "Wrap Up"}
              {currentPhase === PHASES.FEEDBACK && "Interview Complete"}
            </span>
          </div>
        </div>

        <div className="interview-sim__header-right">
          {currentPhase !== PHASES.FEEDBACK && (
            <>
              <div className="interview-sim__timer">
                <div className="timer-section">
                  <span className="timer-label">Phase</span>
                  <span className={`timer-value ${phaseTimeRemaining < 60 ? 'timer-warning' : ''}`}>
                    {formatTime(phaseTimeRemaining)}
                  </span>
                </div>
                <div className="timer-section">
                  <span className="timer-label">Total</span>
                  <span className="timer-value">{formatTime(totalTimeRemaining)}</span>
                </div>
              </div>

              <button
                className={`interview-sim__pause-btn ${isPaused ? 'paused' : ''}`}
                onClick={handlePauseToggle}
              >
                {isPaused ? "Resume" : "Pause"}
              </button>

              {currentPhase !== PHASES.INTRO && (
                <button
                  className="interview-sim__skip-btn"
                  onClick={handleSkipPhase}
                >
                  Next Section →
                </button>
              )}
            </>
          )}

          <button
            className="interview-sim__exit-btn"
            onClick={onExit}
          >
            Exit
          </button>
        </div>
      </header>

      {/* Video Recorder - Always visible during interview */}
      {currentPhase !== PHASES.FEEDBACK && (
        <VideoRecorder
          onRecordingComplete={handleRecordingStop}
          autoStartRecording={enableVideoRecording}
          isPaused={isPaused}
        />
      )}

      {/* Main Content */}
      <main className="interview-sim__main">
        {isPaused && (
          <div className="interview-sim__paused-overlay">
            <div className="paused-message">
              <h2>Interview Paused</h2>
              <p>Click Resume to continue</p>
              <button onClick={handlePauseToggle}>Resume Interview</button>
            </div>
          </div>
        )}

        {renderPhaseContent()}
      </main>

      {/* Progress Bar */}
      {currentPhase !== PHASES.FEEDBACK && (
        <div className="interview-sim__progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(phaseIndex / (schedule.length - 1)) * 100}%` }}
            />
          </div>
          <div className="progress-steps">
            {schedule.map((item, idx) => (
              <div
                key={idx}
                className={`progress-step ${idx <= phaseIndex ? 'completed' : ''} ${idx === phaseIndex ? 'current' : ''}`}
                title={item.type}
              >
                {idx < phaseIndex ? '✓' : idx + 1}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
