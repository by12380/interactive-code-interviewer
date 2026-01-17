import { memo } from "react";

function SessionMetrics({
  hintsUsed,
  testsPassed,
  efficiency,
  efficiencyNote,
  testsNote,
  isLocked,
  onEvaluateEfficiency,
  onRunTests,
  onComplete
}) {
  return (
    <section className="panel panel--metrics">
      <div className="panel__header">Session Metrics</div>
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
          <div className="metrics__value">{testsPassed} / 5</div>
          <p className="metrics__note">{testsNote}</p>
          <button
            type="button"
            className="metrics__action"
            onClick={onRunTests}
            disabled={isLocked}
          >
            Run tests
          </button>
        </div>

        <div className="metrics__field metrics__field--static">
          <span>Hints requested</span>
          <div className="metrics__value">{hintsUsed}</div>
        </div>

        <button
          type="button"
          className="metrics__complete"
          onClick={onComplete}
          disabled={isLocked}
        >
          Complete interview
        </button>
      </div>
    </section>
  );
}

export default memo(SessionMetrics);
