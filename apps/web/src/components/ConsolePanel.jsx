import { memo, useEffect, useRef } from "react";

function ConsolePanel({ logs, onClear, isRunning }) {
  const logsEndRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const getLogClass = (type) => {
    switch (type) {
      case "error":
        return "console__log--error";
      case "warn":
        return "console__log--warn";
      case "info":
        return "console__log--info";
      case "result":
        return "console__log--result";
      default:
        return "";
    }
  };

  const formatValue = (value) => {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  return (
    <section className="panel panel--console">
      <div className="panel__header panel__header--console">
        <span>Console</span>
        <div className="panel__actions">
          <button
            type="button"
            className="panel__action-button"
            onClick={onClear}
            disabled={logs.length === 0}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="console__output">
        {logs.length === 0 ? (
          <div className="console__empty">
            Run your code to see output here
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`console__log ${getLogClass(log.type)}`}>
              <span className="console__prefix">
                {log.type === "error" ? "✕" : log.type === "warn" ? "⚠" : log.type === "result" ? "→" : "›"}
              </span>
              <pre className="console__content">{formatValue(log.value)}</pre>
            </div>
          ))
        )}
        {isRunning && (
          <div className="console__log console__log--running">
            <span className="console__prefix">⟳</span>
            <span>Running...</span>
          </div>
        )}
        <div ref={logsEndRef} />
      </div>
    </section>
  );
}

export default memo(ConsolePanel);
