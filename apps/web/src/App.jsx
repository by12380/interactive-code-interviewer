import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendChat } from "./api.js";
import Header from "./components/Header.jsx";
import EditorPanel from "./components/EditorPanel.jsx";
import ConsolePanel from "./components/ConsolePanel.jsx";
import ChatPanel from "./components/ChatPanel.jsx";
import SessionMetrics from "./components/SessionMetrics.jsx";
import ScoreReport from "./components/ScoreReport.jsx";
import Tutorial from "./components/Tutorial.jsx";
import ProblemPanel from "./components/ProblemPanel.jsx";
import ProblemSelector from "./components/ProblemSelector.jsx";
import AuthModal from "./components/AuthModal.jsx";
import UserProfile from "./components/UserProfile.jsx";
import Leaderboard from "./components/Leaderboard.jsx";
import InterviewLauncher from "./components/InterviewLauncher.jsx";
import InterviewSimulation from "./components/InterviewSimulation.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import OnboardingTour from "./components/OnboardingTour.jsx";
import SkipLinks from "./components/SkipLinks.jsx";
import GamificationPanel from "./components/GamificationPanel.jsx";
import UnlockToast from "./components/UnlockToast.jsx";
import PrepRoadmap from "./components/PrepRoadmap.jsx";
import { useTheme } from "./contexts/ThemeContext.jsx";
import { PROBLEMS, getProblemById } from "./data/problems.js";
import { 
  getCurrentUser, 
  logout as logoutUser, 
  saveInterviewResult,
  getPersonalBest,
  updateGamification,
  addXP,
  unlockAchievements,
  unlockProblems
} from "./services/userService.js";
import { 
  analyzeCode, 
  createAnalyzerState 
} from "./services/codeAnalyzer.js";
import {
  checkStreak,
  calculateProblemXP,
  checkAchievements,
  checkUnlockableProblems,
  calculateLevel
} from "./services/gamificationService.js";

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

const getTestsScore = (passed, total) => {
  if (total === 0) return 0;
  const percentage = passed / total;
  if (percentage === 1) return 100;
  if (percentage >= 0.8) return 80;
  if (percentage >= 0.6) return 60;
  if (percentage >= 0.4) return 40;
  if (passed > 0) return 20;
  return 0;
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

// Run test cases against user's code
const runTestCases = (code, testCases, problem) => {
  if (!testCases || testCases.length === 0) {
    return { passed: 0, total: 0, results: [], note: "No test cases available." };
  }

  const results = [];
  let passed = 0;

  // Extract function name from starter code
  const functionMatch = problem.starterCode.match(/function\s+(\w+)/);
  const functionName = functionMatch ? functionMatch[1] : null;

  if (!functionName) {
    return { passed: 0, total: testCases.length, results: [], note: "Could not identify function name." };
  }

  // Check if function is defined
  const hasFunctionDef = new RegExp(`function\\s+${functionName}|const\\s+${functionName}|let\\s+${functionName}`).test(code);
  const hasReturn = /\breturn\b/.test(code);

  if (!hasFunctionDef || !hasReturn) {
    return { 
      passed: 0, 
      total: testCases.length, 
      results: [],
      note: "Missing function definition or return statement." 
    };
  }

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    try {
      // Create function call string with inputs
      const inputArgs = Object.values(testCase.input)
        .map(v => JSON.stringify(v))
        .join(", ");
      
      const testCode = `
        ${code}
        return ${functionName}(${inputArgs});
      `;

      const runTest = new Function(testCode);
      const result = runTest();
      
      // Compare result with expected
      const isCorrect = JSON.stringify(result) === JSON.stringify(testCase.expected) ||
        (Array.isArray(result) && Array.isArray(testCase.expected) && 
         result.sort().toString() === testCase.expected.sort().toString());
      
      if (isCorrect) {
        passed++;
      }
      
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

  let note = "";
  if (passed === testCases.length) {
    note = "All test cases passed!";
  } else if (passed === 0) {
    note = "No test cases passing. Check your logic.";
  } else if (passed >= testCases.length * 0.8) {
    note = "Almost there! Check edge cases.";
  } else {
    note = "Some tests failing. Review your approach.";
  }

  return { passed, total: testCases.length, results, note };
};

export default function App() {
  const { accessibility } = useTheme();
  
  // User authentication state
  const [user, setUser] = useState(() => getCurrentUser());
  const [isAuthModalVisible, setIsAuthModalVisible] = useState(false);
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  const [isLeaderboardVisible, setIsLeaderboardVisible] = useState(false);
  const [personalBest, setPersonalBest] = useState(null);
  
  // Gamification state
  const [isGamificationVisible, setIsGamificationVisible] = useState(false);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  
  // Roadmap state
  const [isRoadmapVisible, setIsRoadmapVisible] = useState(false);
  
  // Interview simulation state
  const [isInterviewLauncherVisible, setIsInterviewLauncherVisible] = useState(false);
  const [isInterviewSimActive, setIsInterviewSimActive] = useState(false);
  const [interviewSimConfig, setInterviewSimConfig] = useState(null);
  
  // Onboarding state
  const [isOnboardingVisible, setIsOnboardingVisible] = useState(() => {
    const onboardingComplete = localStorage.getItem("onboardingComplete");
    const neverShow = localStorage.getItem("onboardingNeverShow");
    return !onboardingComplete && !neverShow;
  });
  
  // Problem management state
  const [currentProblemId, setCurrentProblemId] = useState(PROBLEMS[0].id);
  const currentProblem = useMemo(() => getProblemById(currentProblemId), [currentProblemId]);
  
  const [code, setCode] = useState(currentProblem?.starterCode || "");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [difficulty, setDifficulty] = useState("Medium");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [testsPassed, setTestsPassed] = useState(0);
  const [testsTotal, setTestsTotal] = useState(0);
  const [testResults, setTestResults] = useState([]);
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
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm your interviewer today. Before you start coding, can you walk me through your approach to this problem?"
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
  
  // Code analyzer state for real-time interruptions
  const analyzerStateRef = useRef(createAnalyzerState());
  const interruptInFlightRef = useRef(false);
  const lastAnalyzedCodeRef = useRef("");
  
  // Inline editor hint state (shows above cursor like IDE suggestions)
  const [editorHint, setEditorHint] = useState(null);

  const TOTAL_SECONDS = currentProblem?.timeLimit || 30 * 60;
  const remainingSeconds = Math.max(TOTAL_SECONDS - elapsedSeconds, 0);
  const isTimeUp = elapsedSeconds >= TOTAL_SECONDS;
  const isEditorDisabled = isLocked || isPaused;
  const isCompleted = isLocked;

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

  // Load personal best on mount and when user changes
  useEffect(() => {
    if (user) {
      const best = getPersonalBest(currentProblemId);
      setPersonalBest(best);
    }
  }, [user, currentProblemId]);

  // Toast helper function
  const addToast = useCallback((toast) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const dismissToast = useCallback((toastId) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  }, []);

  // Check daily login streak on mount and when user logs in
  useEffect(() => {
    if (!user) return;

    const streakResult = checkStreak(user.gamification || {});
    
    if (streakResult.isNewDay) {
      // Update streak in user data
      const updates = { streak: streakResult.streak };
      
      // Award daily/streak XP
      if (streakResult.xpAwarded > 0) {
        updates.xp = (user.gamification?.xp || 0) + streakResult.xpAwarded;
        updates.level = calculateLevel(updates.xp);
        
        // Show streak toast
        const toastId = ++toastIdRef.current;
        if (streakResult.streak.current > 1) {
          setToasts(prev => [...prev, {
            id: toastId,
            type: 'streak',
            title: `${streakResult.streak.current} Day Streak!`,
            message: 'Keep up the great work!',
            xp: streakResult.xpAwarded
          }]);
        } else {
          setToasts(prev => [...prev, {
            id: toastId,
            type: 'xp',
            title: 'Welcome Back!',
            message: 'Daily login bonus',
            xp: streakResult.xpAwarded
          }]);
        }
      }
      
      const result = updateGamification(updates);
      if (result.success) {
        setUser(result.user);
        
        // Check for streak achievements
        const newAchievements = checkAchievements(
          { ...user.gamification, ...updates },
          user.stats || {}
        );
        
        if (newAchievements.length > 0) {
          let totalAchievementXP = 0;
          newAchievements.forEach(achievement => {
            totalAchievementXP += achievement.xpReward;
            const achievementToastId = ++toastIdRef.current;
            setToasts(prev => [...prev, {
              id: achievementToastId,
              type: 'achievement',
              title: 'Achievement Unlocked!',
              message: achievement.name,
              icon: achievement.icon,
              rarity: achievement.rarity,
              xp: achievement.xpReward
            }]);
          });
          
          // Award achievement XP and unlock
          const achievementIds = newAchievements.map(a => a.id);
          unlockAchievements(achievementIds);
          const xpResult = addXP(totalAchievementXP);
          if (xpResult.success) {
            setUser(xpResult.user);
            
            if (xpResult.leveledUp) {
              const levelToastId = ++toastIdRef.current;
              setToasts(prev => [...prev, {
                id: levelToastId,
                type: 'level_up',
                title: 'Level Up!',
                message: `You reached Level ${xpResult.newLevel}!`
              }]);
            }
          }
        }
      }
    }
  }, [user?.id]); // Only run when user ID changes (login)

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

  // Real-time code analysis for proactive AI interruptions
  useEffect(() => {
    // Don't analyze if locked, paused, or code hasn't changed meaningfully
    if (isLocked || isPaused || !currentProblem) {
      return;
    }

    // Analyze after user stops typing for 1.5 seconds
    const analysisDelay = 1500;

    const analysisTimeout = setTimeout(async () => {
      // Skip if code hasn't changed or interrupt is already in flight
      if (code === lastAnalyzedCodeRef.current || interruptInFlightRef.current) {
        return;
      }

      lastAnalyzedCodeRef.current = code;

      // Check if user has explained their approach (sent any message in chat)
      const hasUserExplained = messages.some(m => m.role === "user");

      // Run local code analysis to detect patterns
      const analysisResult = analyzeCode(
        code,
        currentProblem.id,
        currentProblem.starterCode,
        analyzerStateRef.current,
        hasUserExplained
      );

      // If we detected an issue, send to AI for a natural interruption
      if (analysisResult) {
        interruptInFlightRef.current = true;

        try {
          const nextMessages = appendCodeUpdateIfNeeded(
            code,
            llmMessagesRef.current
          );
          llmMessagesRef.current = nextMessages;

          const data = await sendChat({
            messages: nextMessages,
            mode: "interrupt",
            interruptContext: {
              detectedIssue: analysisResult.message,
              severity: analysisResult.severity,
              problemId: currentProblem.id,
              problemTitle: currentProblem.title
            }
          });

          if (data?.reply) {
            // Show hint as inline widget in editor (like IDE suggestions)
            setEditorHint(data.reply);
            
            // Also add to chat history for reference
            const interruptMessage = {
              role: "assistant",
              content: data.reply,
              isInterruption: true
            };
            
            llmMessagesRef.current = [
              ...llmMessagesRef.current,
              interruptMessage
            ];
            setMessages((prev) => [...prev, interruptMessage]);
          }
        } catch (error) {
          // Silently fail for interruptions - don't spam error messages
          console.error("Interrupt failed:", error);
        } finally {
          interruptInFlightRef.current = false;
        }
      }
    }, analysisDelay);

    return () => clearTimeout(analysisTimeout);
  }, [code, currentProblem, isLocked, isPaused, appendCodeUpdateIfNeeded, messages]);

  // Background proactive hints (less aggressive, runs less frequently)
  useEffect(() => {
    const debounceMs = 5000;
    const maxWaitMs = 15000;
    const now = Date.now();
    const timeSinceLast = now - lastProactiveAtRef.current;
    const shouldForce = timeSinceLast >= maxWaitMs;
    const delay = shouldForce ? 0 : debounceMs;

    const timeout = setTimeout(async () => {
      if (proactiveInFlightRef.current || interruptInFlightRef.current) {
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
  }, [code, appendCodeUpdateIfNeeded]);

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
    // Dismiss editor hint when user types (handled in EditorPanel too, but this is backup)
    if (editorHint) {
      setEditorHint(null);
    }
  }, [editorHint]);

  const handleDismissEditorHint = useCallback(() => {
    setEditorHint(null);
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
    
    // If not logged in, show a prompt to sign up for gamification
    if (!user && currentProblem) {
      addToast({
        type: 'xp',
        title: 'Great work!',
        message: 'Sign in to track XP, earn achievements, and unlock problems!'
      });
    }
    
    // Save interview result if user is logged in
    if (user && currentProblem) {
      // Calculate scores for saving
      const timeScoreVal = getTimeScore(elapsedSeconds, currentProblem.timeLimit || 30 * 60);
      const efficiencyScoreVal = getEfficiencyScore(efficiency);
      const hintsScoreVal = getHintsScore(hintsUsed);
      const testsScoreVal = getTestsScore(testsPassed, testsTotal || currentProblem.testCases?.length || 5);
      const totalScoreVal = Math.round(
        timeScoreVal * 0.25 +
        efficiencyScoreVal * 0.35 +
        hintsScoreVal * 0.15 +
        testsScoreVal * 0.25
      );
      const gradeVal = getGrade(totalScoreVal);
      
      const result = saveInterviewResult({
        problemId: currentProblem.id,
        problemTitle: currentProblem.title,
        difficulty: currentProblem.difficulty,
        score: totalScoreVal,
        grade: gradeVal,
        timeSpent: elapsedSeconds,
        testsPassed,
        testsTotal: testsTotal || currentProblem.testCases?.length || 0,
        hintsUsed,
        efficiency,
        code,
      });
      
      if (result.success) {
        setUser(result.user);
        // Update personal best
        const best = getPersonalBest(currentProblem.id);
        setPersonalBest(best);
        
        // === GAMIFICATION: Award XP and check achievements ===
        const completionData = {
          timeSpent: elapsedSeconds,
          score: totalScoreVal,
          hintsUsed,
          testsPassed,
          testsTotal: testsTotal || currentProblem.testCases?.length || 0
        };
        
        // Calculate and award XP for completing the problem
        const problemXP = calculateProblemXP(currentProblem.difficulty, totalScoreVal);
        addToast({
          type: 'xp',
          title: 'Problem Completed!',
          message: `${currentProblem.title}`,
          xp: problemXP
        });
        
        const xpResult = addXP(problemXP);
        if (xpResult.success) {
          setUser(xpResult.user);
          
          // Check for level up
          if (xpResult.leveledUp) {
            addToast({
              type: 'level_up',
              title: 'Level Up!',
              message: `You reached Level ${xpResult.newLevel}!`
            });
          }
          
          // Check for new achievements
          const newAchievements = checkAchievements(
            xpResult.user.gamification,
            xpResult.user.stats,
            completionData
          );
          
          if (newAchievements.length > 0) {
            let totalAchievementXP = 0;
            newAchievements.forEach(achievement => {
              totalAchievementXP += achievement.xpReward;
              addToast({
                type: 'achievement',
                title: 'Achievement Unlocked!',
                message: achievement.name,
                icon: achievement.icon,
                rarity: achievement.rarity,
                xp: achievement.xpReward
              });
            });
            
            // Award achievement XP
            const achievementIds = newAchievements.map(a => a.id);
            unlockAchievements(achievementIds);
            const achievementXpResult = addXP(totalAchievementXP);
            if (achievementXpResult.success) {
              setUser(achievementXpResult.user);
              
              if (achievementXpResult.leveledUp) {
                addToast({
                  type: 'level_up',
                  title: 'Level Up!',
                  message: `You reached Level ${achievementXpResult.newLevel}!`
                });
              }
            }
          }
          
          // Check for new problem unlocks
          const newUnlocks = checkUnlockableProblems(
            xpResult.user.gamification,
            xpResult.user.stats?.problemsCompleted || []
          );
          
          if (newUnlocks.length > 0) {
            unlockProblems(newUnlocks);
            newUnlocks.forEach(problemId => {
              const unlockedProblem = PROBLEMS.find(p => p.id === problemId);
              if (unlockedProblem) {
                addToast({
                  type: 'problem_unlock',
                  title: 'Problem Unlocked!',
                  message: `${unlockedProblem.title} (${unlockedProblem.difficulty})`
                });
              }
            });
            
            // Refresh user to get updated unlocked problems
            const updatedUser = getCurrentUser();
            if (updatedUser) {
              setUser(updatedUser);
            }
          }
        }
      }
    }
  }, [user, currentProblem, elapsedSeconds, efficiency, hintsUsed, testsPassed, testsTotal, code, addToast]);

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
    if (!currentProblem) return;
    const result = runTestCases(code, currentProblem.testCases, currentProblem);
    setTestsPassed(result.passed);
    setTestsTotal(result.total);
    setTestResults(result.results);
    setTestsNote(result.note);
  }, [code, currentProblem]);

  const handleSelectProblem = useCallback((problemId) => {
    const problem = getProblemById(problemId);
    if (!problem || isLocked) return;
    
    setCurrentProblemId(problemId);
    setCode(problem.starterCode);
    setHintsRevealed(0);
    setHintsUsed(0);
    setTestsPassed(0);
    setTestsTotal(0);
    setTestResults([]);
    setEfficiency("Not evaluated");
    setEfficiencyNote("Run analysis to estimate runtime.");
    setTestsNote("Run tests to evaluate correctness.");
    setShowSolution(false);
    setConsoleLogs([]);
    setEditorHint(null); // Clear any editor hint
    setMessages([
      {
        role: "assistant",
        content: `Now working on: **${problem.title}**. Before you start coding, can you walk me through how you'd approach this problem?`
      }
    ]);
    
    // Reset timer
    setElapsedSeconds(0);
    startAtRef.current = Date.now();
    pausedDurationRef.current = 0;
    
    // Reset LLM context
    llmMessagesRef.current = [];
    lastCodeSentRef.current = "";
    lastProactiveCodeRef.current = "";
    
    // Reset code analyzer state for new problem
    analyzerStateRef.current = createAnalyzerState();
    lastAnalyzedCodeRef.current = "";
    
    // Update personal best for the new problem
    if (user) {
      const best = getPersonalBest(problemId);
      setPersonalBest(best);
    }
  }, [isLocked, user]);

  const handleRevealHint = useCallback((hintNumber) => {
    if (!currentProblem || hintNumber > currentProblem.hints.length) return;
    setHintsRevealed(hintNumber);
    setHintsUsed((prev) => prev + 1);
  }, [currentProblem]);

  const handleShowSolution = useCallback(() => {
    setShowSolution(true);
  }, []);

  const handleStartTutorial = useCallback(() => {
    setIsTutorialVisible(true);
  }, []);

  const handleCloseTutorial = useCallback(() => {
    setIsTutorialVisible(false);
  }, []);

  // Auth handlers
  const handleOpenAuth = useCallback(() => {
    setIsAuthModalVisible(true);
  }, []);

  const handleCloseAuth = useCallback(() => {
    setIsAuthModalVisible(false);
  }, []);

  const handleAuthSuccess = useCallback((loggedInUser) => {
    setUser(loggedInUser);
    // Update personal best for current problem
    const best = getPersonalBest(currentProblemId);
    setPersonalBest(best);
  }, [currentProblemId]);

  const handleOpenProfile = useCallback(() => {
    setIsProfileVisible(true);
  }, []);

  const handleCloseProfile = useCallback(() => {
    setIsProfileVisible(false);
  }, []);

  const handleLogout = useCallback(() => {
    logoutUser();
    setUser(null);
    setPersonalBest(null);
    setIsProfileVisible(false);
  }, []);

  // Leaderboard handlers
  const handleOpenLeaderboard = useCallback(() => {
    setIsLeaderboardVisible(true);
  }, []);

  const handleCloseLeaderboard = useCallback(() => {
    setIsLeaderboardVisible(false);
  }, []);

  // Gamification handlers
  const handleOpenGamification = useCallback(() => {
    setIsGamificationVisible(true);
  }, []);

  const handleCloseGamification = useCallback(() => {
    setIsGamificationVisible(false);
  }, []);

  const handleGamificationUserUpdate = useCallback((updatedUser) => {
    setUser(updatedUser);
  }, []);

  // Roadmap handlers
  const handleOpenRoadmap = useCallback(() => {
    setIsRoadmapVisible(true);
  }, []);

  const handleCloseRoadmap = useCallback(() => {
    setIsRoadmapVisible(false);
  }, []);

  const handleRoadmapUserUpdate = useCallback((updatedUser) => {
    setUser(updatedUser);
  }, []);

  // Interview simulation handlers
  const handleOpenInterviewLauncher = useCallback(() => {
    setIsInterviewLauncherVisible(true);
  }, []);

  const handleCloseInterviewLauncher = useCallback(() => {
    setIsInterviewLauncherVisible(false);
  }, []);

  const handleStartInterviewSim = useCallback((config) => {
    setInterviewSimConfig(config);
    setIsInterviewLauncherVisible(false);
    setIsInterviewSimActive(true);
  }, []);

  const handleExitInterviewSim = useCallback(() => {
    setIsInterviewSimActive(false);
    setInterviewSimConfig(null);
  }, []);

  const handleInterviewSimComplete = useCallback((results) => {
    // Save results if user is logged in
    if (user && results) {
      // Could save to user profile here
      console.log("Interview simulation completed:", results);
    }
    setIsInterviewSimActive(false);
    setInterviewSimConfig(null);
  }, [user]);

  // Onboarding handlers
  const handleCloseOnboarding = useCallback(() => {
    setIsOnboardingVisible(false);
  }, []);

  const handleNeverShowOnboarding = useCallback(() => {
    setIsOnboardingVisible(false);
  }, []);

  const handleStartOnboarding = useCallback(() => {
    setIsOnboardingVisible(true);
  }, []);

  const handleClearConsole = useCallback(() => {
    setConsoleLogs([]);
  }, []);

  const handleRunCode = useCallback(() => {
    if (isRunning || isEditorDisabled) return;

    setIsRunning(true);
    setConsoleLogs([]);

    // Small delay to show the running state
    setTimeout(() => {
      const logs = [];

      // Create custom console methods to capture output
      const captureConsole = {
        log: (...args) => {
          logs.push({ type: "log", value: args.length === 1 ? args[0] : args });
        },
        error: (...args) => {
          logs.push({ type: "error", value: args.length === 1 ? args[0] : args });
        },
        warn: (...args) => {
          logs.push({ type: "warn", value: args.length === 1 ? args[0] : args });
        },
        info: (...args) => {
          logs.push({ type: "info", value: args.length === 1 ? args[0] : args });
        },
        clear: () => {
          logs.length = 0;
        }
      };

      try {
        // Create a function that runs the code with our custom console
        const runCode = new Function(
          "console",
          `"use strict";
          ${code}
          `
        );

        // Execute the code
        const result = runCode(captureConsole);

        // If there's a return value, show it
        if (result !== undefined) {
          logs.push({ type: "result", value: result });
        }
      } catch (error) {
        logs.push({
          type: "error",
          value: `${error.name}: ${error.message}`
        });
      }

      setConsoleLogs(logs);
      setIsRunning(false);
    }, 100);
  }, [code, isRunning, isEditorDisabled]);

  // Add keyboard shortcut for running code
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        handleRunCode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRunCode]);

  const timeScore = useMemo(
    () => getTimeScore(elapsedSeconds, TOTAL_SECONDS),
    [elapsedSeconds]
  );
  const efficiencyScore = useMemo(
    () => getEfficiencyScore(efficiency),
    [efficiency]
  );
  const hintsScore = useMemo(() => getHintsScore(hintsUsed), [hintsUsed]);
  const testsScore = useMemo(() => getTestsScore(testsPassed, testsTotal || currentProblem?.testCases?.length || 5), [testsPassed, testsTotal, currentProblem]);
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
        userTime: `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`,
        avgTime: "18:45",
        topTime: "12:30"
      },
      history: [
        { problem: currentProblem?.title || "Current Problem", score: totalScore }
      ],
      average: totalScore
    }),
    [elapsedSeconds, currentProblem, totalScore]
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
    <div className="app" role="application" aria-label="Live AI Coding Interviewer">
      {/* Skip links for keyboard navigation */}
      <SkipLinks />
      
      {/* Screen reader announcements */}
      <div 
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        id="sr-announcements"
      />
      
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
        onOpenLeaderboard={handleOpenLeaderboard}
        onStartInterviewSim={handleOpenInterviewLauncher}
        onOpenGamification={handleOpenGamification}
        onOpenRoadmap={handleOpenRoadmap}
        user={user}
        onOpenAuth={handleOpenAuth}
        onOpenProfile={handleOpenProfile}
        problemSelector={
          <ProblemSelector
            problems={PROBLEMS}
            currentProblemId={currentProblemId}
            onSelectProblem={handleSelectProblem}
            isLocked={isLocked}
            user={user}
          />
        }
      />

      <main className="app__main" id="main-content" role="main">
        <div className="app__problem-section" id="problem-panel">
          <ProblemPanel
            problem={currentProblem}
            hintsRevealed={hintsRevealed}
            onRevealHint={handleRevealHint}
            showSolution={showSolution}
            onShowSolution={handleShowSolution}
            isCompleted={isCompleted}
          />
        </div>
        <div className="app__editor-section" id="editor-panel">
          <EditorPanel
            canUndo={canUndo}
            canRedo={canRedo}
            isEditorDisabled={isEditorDisabled}
            isRunning={isRunning}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onRun={handleRunCode}
            onEditorMount={handleEditorMount}
            onCodeChange={handleEditorChange}
            editorOptions={editorOptions}
            code={code}
            interviewerHint={editorHint}
            onDismissHint={handleDismissEditorHint}
          />
          <ConsolePanel
            logs={consoleLogs}
            onClear={handleClearConsole}
            isRunning={isRunning}
          />
        </div>
        <div className="app__sidebar" id="chat-panel">
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
            testsTotal={testsTotal}
            testResults={testResults}
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
      
      {/* Settings Panel */}
      <SettingsPanel />
      
      {/* Onboarding Tour */}
      <OnboardingTour 
        isVisible={isOnboardingVisible} 
        onClose={handleCloseOnboarding}
        onNeverShow={handleNeverShowOnboarding}
      />
      
      {/* Auth Modal */}
      {isAuthModalVisible && (
        <AuthModal
          onClose={handleCloseAuth}
          onAuthSuccess={handleAuthSuccess}
        />
      )}
      
      {/* User Profile Modal */}
      {isProfileVisible && user && (
        <UserProfile
          user={user}
          onClose={handleCloseProfile}
          problems={PROBLEMS}
          onLogout={handleLogout}
        />
      )}
      
      {/* Leaderboard Modal */}
      {isLeaderboardVisible && (
        <Leaderboard
          onClose={handleCloseLeaderboard}
          problems={PROBLEMS}
          currentUser={user}
        />
      )}
      
      {/* Interview Simulation Launcher */}
      {isInterviewLauncherVisible && (
        <InterviewLauncher
          onStart={handleStartInterviewSim}
          onClose={handleCloseInterviewLauncher}
          user={user}
        />
      )}
      
      {/* Interview Simulation Active */}
      {isInterviewSimActive && interviewSimConfig && (
        <InterviewSimulation
          mode={interviewSimConfig.mode}
          persona={interviewSimConfig.persona}
          enableVideoRecording={interviewSimConfig.enableVideo}
          customConfig={interviewSimConfig.customConfig}
          onComplete={handleInterviewSimComplete}
          onExit={handleExitInterviewSim}
        />
      )}
      
      {/* Gamification Panel */}
      {isGamificationVisible && user && (
        <GamificationPanel
          user={user}
          onClose={handleCloseGamification}
          onUserUpdate={handleGamificationUserUpdate}
        />
      )}
      
      {/* Prep Roadmap Panel */}
      {isRoadmapVisible && user && (
        <PrepRoadmap
          user={user}
          onClose={handleCloseRoadmap}
          onUserUpdate={handleRoadmapUserUpdate}
          onSelectProblem={handleSelectProblem}
          problems={PROBLEMS}
        />
      )}
      
      {/* Unlock Toasts */}
      <UnlockToast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
