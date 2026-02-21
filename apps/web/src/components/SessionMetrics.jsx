import { memo, useState } from "react";

function SessionMetrics({
  workspaceMode,
  hintsUsed,
  testsPassed,
  testsTotal,
  testResults,
  efficiency,
  efficiencyNote,
  testsNote,
  isLocked,
  onEvaluateEfficiency,
  onRunTests,
  onComplete
}) {
  const [showTestDetails, setShowTestDetails] = useState(false);
  const displayTotal = testsTotal || 5;
  const isPracticeMode = workspaceMode === "practice";

  return (
    <section className="panel panel--metrics">
      <div className="panel__header">{isPracticeMode ? "Practice Metrics" : "Interview Metrics"}</div>
      <div className="metrics">
        <div className="metrics__field">
          <span>Code efficiency</span>
          <div className="metrics__value">{efficiency}</div>
          <p className="metrics__note">{efficiencyNote}</p>
          <button
            type="button"
            className="metrics__action"
            onClick={onEvaluateEfficiency}
            disabled={isLocked}
          >
            Analyze efficiency
          </button>
        </div>

        <div className="metrics__field">
          <span>Test cases passed</span>
          <div className="metrics__value">
            {testsPassed} / {displayTotal}
            {testsPassed === displayTotal && testsPassed > 0 && (
              <span className="metrics__check"> ✓</span>
            )}
          </div>
          <p className="metrics__note">{testsNote}</p>
          <div className="metrics__test-actions">
            <button
              type="button"
              className="metrics__action"
              onClick={onRunTests}
              disabled={isLocked}
            >
              Run tests
            </button>
            {testResults && testResults.length > 0 && (
              <button
                type="button"
                className="metrics__action metrics__action--secondary"
                onClick={() => setShowTestDetails(!showTestDetails)}
              >
                {showTestDetails ? "Hide details" : "Show details"}
              </button>
            )}
          </div>
          {showTestDetails && testResults && testResults.length > 0 && (
            <div className="metrics__test-results">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`metrics__test-result ${
                    result.passed ? "metrics__test-result--pass" : "metrics__test-result--fail"
                  }`}
                >
                  <div className="metrics__test-header">
                    <span className="metrics__test-status">
                      {result.passed ? "✓" : "✗"}
                    </span>
                    <span className="metrics__test-name">Test {index + 1}</span>
                  </div>
                  <div className="metrics__test-detail">
                    <span className="metrics__test-label">Input:</span>
                    <code>{JSON.stringify(result.input)}</code>
                  </div>
                  <div className="metrics__test-detail">
                    <span className="metrics__test-label">Expected:</span>
                    <code>{JSON.stringify(result.expected)}</code>
                  </div>
                  <div className="metrics__test-detail">
                    <span className="metrics__test-label">Got:</span>
                    <code className={result.passed ? "" : "metrics__test-wrong"}>
                      {typeof result.actual === "string" && result.actual.startsWith("Error:")
                        ? result.actual
                        : JSON.stringify(result.actual)}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="metrics__field metrics__field--static">
          <span>Hints used</span>
          <div className="metrics__value">{hintsUsed}</div>
        </div>

        {!isPracticeMode && (
          <button
            type="button"
            className="metrics__complete"
            onClick={onComplete}
            disabled={isLocked}
          >
            Complete interview
          </button>
        )}
      </div>
    </section>
  );
}

export default memo(SessionMetrics);
