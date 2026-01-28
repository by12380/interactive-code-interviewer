import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { PROBLEMS, getProblemById } from "../data/problems.js";
import {
  createMultiProblemSession,
  addProblemToSession,
  removeProblemFromSession,
  updateProblemCode,
  updateProblemMetrics,
  switchActiveSlot,
  analyzeCodePatterns,
  compareApproaches,
  generateSessionSummary,
  getSimilarProblems,
  suggestProblemSwap,
} from "../services/multiProblemService.js";

// Run test cases against user's code
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

  const hasFunctionDef = new RegExp(
    `function\\s+${functionName}|const\\s+${functionName}|let\\s+${functionName}`
  ).test(code);
  const hasReturn = /\breturn\b/.test(code);

  if (!hasFunctionDef || !hasReturn) {
    return { passed: 0, total: testCases.length, results: [] };
  }

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    try {
      const inputArgs = Object.values(testCase.input)
        .map((v) => JSON.stringify(v))
        .join(", ");

      const testCode = `
        ${code}
        return ${functionName}(${inputArgs});
      `;

      const runTest = new Function(testCode);
      const result = runTest();

      const isCorrect =
        JSON.stringify(result) === JSON.stringify(testCase.expected) ||
        (Array.isArray(result) &&
          Array.isArray(testCase.expected) &&
          result.sort().toString() === testCase.expected.sort().toString());

      if (isCorrect) {
        passed++;
      }

      results.push({
        input: testCase.input,
        expected: testCase.expected,
        actual: result,
        passed: isCorrect,
      });
    } catch (error) {
      results.push({
        input: testCase.input,
        expected: testCase.expected,
        actual: `Error: ${error.message}`,
        passed: false,
      });
    }
  }

  return { passed, total: testCases.length, results };
};

// Estimate efficiency from code
const estimateEfficiency = (code) => {
  const loopMatches = code.match(/\b(for|while)\b/g) || [];
  if (loopMatches.length <= 1) return "O(n)";
  if (loopMatches.length === 2) return "O(n^2)";
  return "O(n^3)";
};

export default function SplitScreenPanel({
  onClose,
  problems = PROBLEMS,
  user,
  onSelectProblem,
}) {
  const { theme } = useTheme();
  const [session, setSession] = useState(() =>
    createMultiProblemSession([problems[0]?.id])
  );
  const [viewMode, setViewMode] = useState("split"); // 'split', 'tabs', 'summary'
  const [showProblemPicker, setShowProblemPicker] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(null);
  const [showSwapSuggestions, setShowSwapSuggestions] = useState(false);
  const [swapSlot, setSwapSlot] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef(Date.now());
  const pausedTimeRef = useRef(0);

  // Timer effect
  useEffect(() => {
    if (isPaused || viewMode === "summary") return;

    const interval = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000
      );
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, viewMode]);

  // Update session total time
  useEffect(() => {
    setSession((prev) => ({ ...prev, totalTimeSpent: elapsedTime }));
  }, [elapsedTime]);

  // Get active problem details
  const activeProblem = useMemo(() => {
    const slot = session.problems[session.activeSlot];
    if (!slot) return null;
    return {
      ...slot,
      details: getProblemById(slot.problemId),
    };
  }, [session]);

  // Get patterns for active problem
  const activePatterns = useMemo(() => {
    if (!activeProblem) return [];
    return analyzeCodePatterns(activeProblem.code);
  }, [activeProblem?.code]);

  // Get comparisons
  const comparisons = useMemo(() => {
    if (session.problems.length < 2) return [];
    return compareApproaches(session);
  }, [session]);

  // Get session summary
  const sessionSummary = useMemo(() => {
    return generateSessionSummary(session);
  }, [session]);

  // Get swap suggestions
  const swapSuggestions = useMemo(() => {
    if (swapSlot === null) return [];
    return suggestProblemSwap(session, swapSlot) || [];
  }, [session, swapSlot]);

  // Similar problems for current active
  const similarProblems = useMemo(() => {
    if (!activeProblem) return [];
    return getSimilarProblems(activeProblem.problemId);
  }, [activeProblem?.problemId]);

  const handleCodeChange = useCallback(
    (slotIndex, code) => {
      setSession((prev) => updateProblemCode(prev, slotIndex, code));
    },
    []
  );

  const handleSwitchSlot = useCallback((slotIndex) => {
    setSession((prev) => switchActiveSlot(prev, slotIndex));
  }, []);

  const handleAddProblem = useCallback((problemId) => {
    setSession((prev) => {
      const result = addProblemToSession(prev, problemId);
      return result.success ? result.session : prev;
    });
    setShowProblemPicker(false);
    setPickerSlot(null);
  }, []);

  const handleRemoveProblem = useCallback((slotIndex) => {
    setSession((prev) => {
      const result = removeProblemFromSession(prev, slotIndex);
      return result.success ? result.session : prev;
    });
  }, []);

  const handleSwapProblem = useCallback((slotIndex, newProblemId) => {
    setSession((prev) => {
      // Remove old problem
      const removeResult = removeProblemFromSession(prev, slotIndex);
      if (!removeResult.success) return prev;

      // Add new problem at same position
      const problem = getProblemById(newProblemId);
      if (!problem) return prev;

      const newProblems = [...removeResult.session.problems];
      newProblems.splice(slotIndex, 0, {
        problemId: newProblemId,
        slotIndex,
        code: problem.starterCode,
        startedAt: null,
        completedAt: null,
        timeSpent: 0,
        testsPassed: 0,
        testsTotal: 0,
        efficiency: "Not evaluated",
        notes: "",
        approach: "",
      });

      // Re-index slots
      const reindexed = newProblems.map((p, i) => ({ ...p, slotIndex: i }));

      return {
        ...removeResult.session,
        problems: reindexed,
        activeSlot: slotIndex,
      };
    });
    setShowSwapSuggestions(false);
    setSwapSlot(null);
  }, []);

  const handleRunTests = useCallback((slotIndex) => {
    setSession((prev) => {
      const slot = prev.problems[slotIndex];
      if (!slot) return prev;

      const problem = getProblemById(slot.problemId);
      if (!problem) return prev;

      const result = runTestCases(slot.code, problem.testCases, problem);
      const efficiency = estimateEfficiency(slot.code);

      return updateProblemMetrics(prev, slotIndex, {
        testsPassed: result.passed,
        testsTotal: result.total,
        efficiency,
        timeSpent: elapsedTime,
      });
    });
  }, [elapsedTime]);

  const handleMarkComplete = useCallback((slotIndex) => {
    setSession((prev) => {
      return updateProblemMetrics(prev, slotIndex, {
        completedAt: Date.now(),
        timeSpent: elapsedTime,
      });
    });
  }, [elapsedTime]);

  const handlePauseToggle = useCallback(() => {
    if (isPaused) {
      pausedTimeRef.current += Date.now() - pausedTimeRef.current;
      setIsPaused(false);
    } else {
      pausedTimeRef.current = Date.now();
      setIsPaused(true);
    }
  }, [isPaused]);

  const handleViewSummary = useCallback(() => {
    setViewMode("summary");
  }, []);

  const handleExitSummary = useCallback(() => {
    setViewMode("split");
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Render problem picker modal
  const renderProblemPicker = () => (
    <div className="split-screen__picker-overlay">
      <div className="split-screen__picker">
        <div className="split-screen__picker-header">
          <h3>Select a Problem</h3>
          <button
            type="button"
            className="split-screen__picker-close"
            onClick={() => {
              setShowProblemPicker(false);
              setPickerSlot(null);
            }}
          >
            ×
          </button>
        </div>
        <div className="split-screen__picker-list">
          {problems
            .filter(
              (p) => !session.problems.some((sp) => sp.problemId === p.id)
            )
            .map((problem) => (
              <button
                key={problem.id}
                type="button"
                className="split-screen__picker-item"
                onClick={() => {
                  if (pickerSlot !== null) {
                    handleSwapProblem(pickerSlot, problem.id);
                  } else {
                    handleAddProblem(problem.id);
                  }
                }}
              >
                <span
                  className={`split-screen__picker-dot split-screen__picker-dot--${problem.difficulty.toLowerCase()}`}
                />
                <span className="split-screen__picker-title">
                  {problem.title}
                </span>
                <span
                  className={`split-screen__picker-difficulty split-screen__picker-difficulty--${problem.difficulty.toLowerCase()}`}
                >
                  {problem.difficulty}
                </span>
                <span className="split-screen__picker-category">
                  {problem.category}
                </span>
              </button>
            ))}
        </div>
        {similarProblems.length > 0 && (
          <div className="split-screen__picker-similar">
            <h4>Similar to Current Problem</h4>
            {similarProblems.slice(0, 3).map((p) => (
              <button
                key={p.id}
                type="button"
                className="split-screen__picker-item split-screen__picker-item--similar"
                onClick={() => {
                  if (pickerSlot !== null) {
                    handleSwapProblem(pickerSlot, p.id);
                  } else {
                    handleAddProblem(p.id);
                  }
                }}
              >
                <span
                  className={`split-screen__picker-dot split-screen__picker-dot--${p.difficulty.toLowerCase()}`}
                />
                <span className="split-screen__picker-title">{p.title}</span>
                <span className="split-screen__picker-patterns">
                  {p.sharedPatterns.join(", ")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Render swap suggestions
  const renderSwapSuggestions = () => (
    <div className="split-screen__swap-overlay">
      <div className="split-screen__swap">
        <div className="split-screen__swap-header">
          <h3>Quick Swap Suggestions</h3>
          <button
            type="button"
            className="split-screen__swap-close"
            onClick={() => {
              setShowSwapSuggestions(false);
              setSwapSlot(null);
            }}
          >
            ×
          </button>
        </div>
        <p className="split-screen__swap-description">
          Problems that share patterns with your other selected problems:
        </p>
        <div className="split-screen__swap-list">
          {swapSuggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              className="split-screen__swap-item"
              onClick={() => handleSwapProblem(swapSlot, suggestion.id)}
            >
              <div className="split-screen__swap-item-main">
                <span
                  className={`split-screen__picker-dot split-screen__picker-dot--${suggestion.difficulty.toLowerCase()}`}
                />
                <span className="split-screen__swap-title">
                  {suggestion.title}
                </span>
                <span
                  className={`split-screen__picker-difficulty split-screen__picker-difficulty--${suggestion.difficulty.toLowerCase()}`}
                >
                  {suggestion.difficulty}
                </span>
              </div>
              <span className="split-screen__swap-reason">
                {suggestion.reason}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="split-screen__swap-browse"
          onClick={() => {
            setShowSwapSuggestions(false);
            setPickerSlot(swapSlot);
            setShowProblemPicker(true);
          }}
        >
          Browse All Problems
        </button>
      </div>
    </div>
  );

  // Render session summary
  const renderSummary = () => (
    <div className="split-screen__summary">
      <div className="split-screen__summary-header">
        <h2>Multi-Problem Session Summary</h2>
        <button
          type="button"
          className="split-screen__summary-back"
          onClick={handleExitSummary}
        >
          ← Back to Practice
        </button>
      </div>

      <div className="split-screen__summary-stats">
        <div className="split-screen__summary-stat">
          <span className="split-screen__summary-stat-value">
            {sessionSummary.problemsCompleted}/{sessionSummary.problemsAttempted}
          </span>
          <span className="split-screen__summary-stat-label">
            Problems Completed
          </span>
        </div>
        <div className="split-screen__summary-stat">
          <span className="split-screen__summary-stat-value">
            {sessionSummary.formattedDuration}
          </span>
          <span className="split-screen__summary-stat-label">Total Time</span>
        </div>
        <div className="split-screen__summary-stat">
          <span className="split-screen__summary-stat-value">
            {sessionSummary.totalTestsPassed}/{sessionSummary.totalTests}
          </span>
          <span className="split-screen__summary-stat-label">Tests Passed</span>
        </div>
      </div>

      <div className="split-screen__summary-section">
        <h3>Problem Breakdown</h3>
        <div className="split-screen__summary-problems">
          {sessionSummary.problems.map((p) => (
            <div key={p.id} className="split-screen__summary-problem">
              <div className="split-screen__summary-problem-header">
                <span
                  className={`split-screen__summary-dot split-screen__summary-dot--${p.difficulty.toLowerCase()}`}
                />
                <span className="split-screen__summary-problem-title">
                  {p.title}
                </span>
                {p.completed && (
                  <span className="split-screen__summary-badge split-screen__summary-badge--completed">
                    ✓ Completed
                  </span>
                )}
              </div>
              <div className="split-screen__summary-problem-stats">
                <span>Time: {p.formattedTime}</span>
                <span>
                  Tests: {p.testsPassed}/{p.testsTotal}
                </span>
                <span>
                  Efficiency: {p.efficiency}
                  {p.isOptimal && (
                    <span className="split-screen__summary-optimal">
                      ★ Optimal
                    </span>
                  )}
                </span>
              </div>
              {p.patterns.length > 0 && (
                <div className="split-screen__summary-problem-patterns">
                  <span className="split-screen__summary-patterns-label">
                    Patterns detected:
                  </span>
                  {p.patterns.slice(0, 3).map((pattern) => (
                    <span
                      key={pattern.id}
                      className="split-screen__summary-pattern"
                    >
                      {pattern.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {sessionSummary.comparisons.length > 0 && (
        <div className="split-screen__summary-section">
          <h3>Pattern Recognition & Insights</h3>
          <div className="split-screen__summary-insights">
            {sessionSummary.comparisons.map((comparison, index) => (
              <div
                key={index}
                className={`split-screen__summary-insight split-screen__summary-insight--${comparison.type}`}
              >
                <div className="split-screen__summary-insight-header">
                  {comparison.type === "shared_pattern" && (
                    <span className="split-screen__summary-insight-icon">
                      🔗
                    </span>
                  )}
                  {comparison.type === "complexity" && (
                    <span className="split-screen__summary-insight-icon">
                      ⚡
                    </span>
                  )}
                  {comparison.type === "time" && (
                    <span className="split-screen__summary-insight-icon">
                      ⏱️
                    </span>
                  )}
                  <span className="split-screen__summary-insight-title">
                    {comparison.pattern || comparison.title}
                  </span>
                </div>
                <p className="split-screen__summary-insight-text">
                  {comparison.insight || comparison.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {sessionSummary.patternsSummary.length > 0 && (
        <div className="split-screen__summary-section">
          <h3>Patterns Used</h3>
          <div className="split-screen__summary-patterns-grid">
            {sessionSummary.patternsSummary.map((pattern) => (
              <div
                key={pattern.id}
                className="split-screen__summary-pattern-card"
              >
                <span className="split-screen__summary-pattern-name">
                  {pattern.name}
                </span>
                <span className="split-screen__summary-pattern-count">
                  Used in {pattern.count} problem(s)
                </span>
                <span className="split-screen__summary-pattern-problems">
                  {pattern.problems.join(", ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sessionSummary.recommendations.length > 0 && (
        <div className="split-screen__summary-section">
          <h3>Recommendations</h3>
          <div className="split-screen__summary-recommendations">
            {sessionSummary.recommendations.map((rec, index) => (
              <div
                key={index}
                className={`split-screen__summary-rec split-screen__summary-rec--${rec.type}`}
              >
                <span className="split-screen__summary-rec-title">
                  {rec.title}
                </span>
                <p className="split-screen__summary-rec-description">
                  {rec.description}
                </p>
                {rec.problems && (
                  <div className="split-screen__summary-rec-problems">
                    {rec.problems.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="split-screen__summary-rec-problem"
                        onClick={() => {
                          if (onSelectProblem) {
                            onSelectProblem(p.id);
                            onClose();
                          }
                        }}
                      >
                        {p.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Render single problem slot
  const renderProblemSlot = (slot, index) => {
    const problem = getProblemById(slot.problemId);
    const isActive = session.activeSlot === index;
    const patterns = analyzeCodePatterns(slot.code);

    return (
      <div
        key={slot.problemId}
        className={`split-screen__slot ${
          isActive ? "split-screen__slot--active" : ""
        } ${slot.completedAt ? "split-screen__slot--completed" : ""}`}
      >
        <div className="split-screen__slot-header">
          <div className="split-screen__slot-info">
            <button
              type="button"
              className="split-screen__slot-title"
              onClick={() => handleSwitchSlot(index)}
            >
              <span
                className={`split-screen__slot-dot split-screen__slot-dot--${problem?.difficulty.toLowerCase()}`}
              />
              {problem?.title || slot.problemId}
            </button>
            <span
              className={`split-screen__slot-difficulty split-screen__slot-difficulty--${problem?.difficulty.toLowerCase()}`}
            >
              {problem?.difficulty}
            </span>
          </div>
          <div className="split-screen__slot-actions">
            <button
              type="button"
              className="split-screen__slot-action"
              onClick={() => {
                setSwapSlot(index);
                setShowSwapSuggestions(true);
              }}
              title="Quick swap"
            >
              ⇄
            </button>
            {session.problems.length > 1 && (
              <button
                type="button"
                className="split-screen__slot-action split-screen__slot-action--remove"
                onClick={() => handleRemoveProblem(index)}
                title="Remove problem"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {viewMode === "split" && (
          <>
            <div className="split-screen__slot-description">
              {problem?.description.split("\n")[0]}
            </div>

            <div className="split-screen__slot-editor">
              <Editor
                height="200px"
                defaultLanguage="javascript"
                theme={theme === "dark" ? "vs-dark" : "light"}
                value={slot.code}
                onChange={(value) => handleCodeChange(index, value || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  lineNumbers: "on",
                }}
              />
            </div>

            <div className="split-screen__slot-metrics">
              <div className="split-screen__slot-metric">
                <span className="split-screen__slot-metric-label">Tests:</span>
                <span className="split-screen__slot-metric-value">
                  {slot.testsPassed}/{slot.testsTotal || "?"}
                </span>
              </div>
              <div className="split-screen__slot-metric">
                <span className="split-screen__slot-metric-label">
                  Efficiency:
                </span>
                <span className="split-screen__slot-metric-value">
                  {slot.efficiency}
                </span>
              </div>
              <button
                type="button"
                className="split-screen__slot-run"
                onClick={() => handleRunTests(index)}
              >
                Run Tests
              </button>
              {!slot.completedAt && (
                <button
                  type="button"
                  className="split-screen__slot-complete"
                  onClick={() => handleMarkComplete(index)}
                >
                  Mark Done
                </button>
              )}
            </div>

            {patterns.length > 0 && (
              <div className="split-screen__slot-patterns">
                <span className="split-screen__slot-patterns-label">
                  Patterns:
                </span>
                {patterns.slice(0, 2).map((p) => (
                  <span key={p.id} className="split-screen__slot-pattern">
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {viewMode === "tabs" && isActive && (
          <div className="split-screen__slot-expanded">
            <div className="split-screen__slot-problem">
              <h4>Problem Description</h4>
              <div className="split-screen__slot-problem-text">
                {problem?.description.split("\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <div className="split-screen__slot-examples">
                <h5>Examples</h5>
                {problem?.examples.slice(0, 2).map((ex, i) => (
                  <div key={i} className="split-screen__slot-example">
                    <div>
                      <strong>Input:</strong> <code>{ex.input}</code>
                    </div>
                    <div>
                      <strong>Output:</strong> <code>{ex.output}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="split-screen__slot-editor-full">
              <Editor
                height="350px"
                defaultLanguage="javascript"
                theme={theme === "dark" ? "vs-dark" : "light"}
                value={slot.code}
                onChange={(value) => handleCodeChange(index, value || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                }}
              />
            </div>

            <div className="split-screen__slot-toolbar">
              <div className="split-screen__slot-metrics-full">
                <span>
                  Tests: {slot.testsPassed}/{slot.testsTotal || "?"}
                </span>
                <span>Efficiency: {slot.efficiency}</span>
              </div>
              <div className="split-screen__slot-actions-full">
                <button
                  type="button"
                  className="split-screen__slot-run"
                  onClick={() => handleRunTests(index)}
                >
                  Run Tests
                </button>
                {!slot.completedAt && (
                  <button
                    type="button"
                    className="split-screen__slot-complete"
                    onClick={() => handleMarkComplete(index)}
                  >
                    Mark Complete
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="split-screen">
      <div className="split-screen__header">
        <div className="split-screen__header-left">
          <h2 className="split-screen__title">Multi-Problem Practice</h2>
          <div className="split-screen__timer">
            <span className="split-screen__timer-value">
              {formatTime(elapsedTime)}
            </span>
            <button
              type="button"
              className={`split-screen__timer-btn ${
                isPaused ? "split-screen__timer-btn--paused" : ""
              }`}
              onClick={handlePauseToggle}
            >
              {isPaused ? "▶" : "⏸"}
            </button>
          </div>
        </div>

        <div className="split-screen__header-center">
          <div className="split-screen__view-toggle">
            <button
              type="button"
              className={`split-screen__view-btn ${
                viewMode === "split" ? "split-screen__view-btn--active" : ""
              }`}
              onClick={() => setViewMode("split")}
            >
              Split View
            </button>
            <button
              type="button"
              className={`split-screen__view-btn ${
                viewMode === "tabs" ? "split-screen__view-btn--active" : ""
              }`}
              onClick={() => setViewMode("tabs")}
            >
              Tab View
            </button>
            <button
              type="button"
              className={`split-screen__view-btn ${
                viewMode === "summary" ? "split-screen__view-btn--active" : ""
              }`}
              onClick={handleViewSummary}
            >
              Summary
            </button>
          </div>
        </div>

        <div className="split-screen__header-right">
          {session.problems.length < 3 && viewMode !== "summary" && (
            <button
              type="button"
              className="split-screen__add-btn"
              onClick={() => setShowProblemPicker(true)}
            >
              + Add Problem
            </button>
          )}
          <button
            type="button"
            className="split-screen__close-btn"
            onClick={onClose}
          >
            Exit
          </button>
        </div>
      </div>

      {viewMode === "summary" ? (
        renderSummary()
      ) : (
        <>
          <div
            className={`split-screen__content split-screen__content--${
              viewMode === "tabs" ? "tabs" : `split-${session.problems.length}`
            }`}
          >
            {viewMode === "tabs" && (
              <div className="split-screen__tabs">
                {session.problems.map((slot, index) => {
                  const problem = getProblemById(slot.problemId);
                  return (
                    <button
                      key={slot.problemId}
                      type="button"
                      className={`split-screen__tab ${
                        session.activeSlot === index
                          ? "split-screen__tab--active"
                          : ""
                      } ${slot.completedAt ? "split-screen__tab--completed" : ""}`}
                      onClick={() => handleSwitchSlot(index)}
                    >
                      <span
                        className={`split-screen__tab-dot split-screen__tab-dot--${problem?.difficulty.toLowerCase()}`}
                      />
                      <span className="split-screen__tab-title">
                        {problem?.title}
                      </span>
                      {slot.completedAt && (
                        <span className="split-screen__tab-check">✓</span>
                      )}
                    </button>
                  );
                })}
                {session.problems.length < 3 && (
                  <button
                    type="button"
                    className="split-screen__tab split-screen__tab--add"
                    onClick={() => setShowProblemPicker(true)}
                  >
                    +
                  </button>
                )}
              </div>
            )}

            <div className="split-screen__slots">
              {viewMode === "tabs"
                ? renderProblemSlot(
                    session.problems[session.activeSlot],
                    session.activeSlot
                  )
                : session.problems.map((slot, index) =>
                    renderProblemSlot(slot, index)
                  )}
            </div>
          </div>

          {comparisons.length > 0 && viewMode === "split" && (
            <div className="split-screen__comparisons">
              <h3 className="split-screen__comparisons-title">
                Pattern Insights
              </h3>
              <div className="split-screen__comparisons-list">
                {comparisons.slice(0, 3).map((c, i) => (
                  <div
                    key={i}
                    className={`split-screen__comparison split-screen__comparison--${c.type}`}
                  >
                    <span className="split-screen__comparison-icon">
                      {c.type === "shared_pattern" && "🔗"}
                      {c.type === "complexity" && "⚡"}
                      {c.type === "time" && "⏱️"}
                    </span>
                    <span className="split-screen__comparison-text">
                      {c.insight || c.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showProblemPicker && renderProblemPicker()}
      {showSwapSuggestions && swapSuggestions.length > 0 && renderSwapSuggestions()}
    </div>
  );
}
