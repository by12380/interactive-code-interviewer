import { memo, useEffect, useRef } from "react";

function ConsolePanel({ logs, onClear, isRunning }) {
  const logsEndRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Announce errors to screen readers
  useEffect(() => {
    const errorLogs = logs.filter(log => log.type === "error");
    if (errorLogs.length > 0) {
      const announcer = document.getElementById("sr-announcements");
      if (announcer) {
        const lastError = errorLogs[errorLogs.length - 1];
        announcer.textContent = `Error: ${lastError.value}`;
      }
    }
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

  const getLogAriaLabel = (type) => {
    switch (type) {
      case "error":
        return "Error";
      case "warn":
        return "Warning";
      case "info":
        return "Info";
      case "result":
        return "Return value";
      default:
        return "Log";
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

  const errorCount = logs.filter(l => l.type === "error").length;
  const warnCount = logs.filter(l => l.type === "warn").length;

  return (
    <section 
      className="panel panel--console"
      aria-labelledby="console-heading"
      role="region"
    >
      <div className="panel__header panel__header--console" id="console-heading">
        <span>
          Console
          {errorCount > 0 && (
            <span className="console__error-count" aria-label={`${errorCount} error${errorCount > 1 ? "s" : ""}`}>
              {" "}({errorCount} {errorCount === 1 ? "error" : "errors"})
            </span>
          )}
        </span>
        <div className="panel__actions">
          <button
            type="button"
            className="panel__action-button"
            onClick={onClear}
            disabled={logs.length === 0}
            aria-label="Clear console output"
          >
            Clear
          </button>
        </div>
      </div>
      <div 
        className="console__output"
        role="log"
        aria-live="polite"
        aria-label={`Console output. ${logs.length} ${logs.length === 1 ? "entry" : "entries"}${errorCount > 0 ? `, ${errorCount} ${errorCount === 1 ? "error" : "errors"}` : ""}${warnCount > 0 ? `, ${warnCount} ${warnCount === 1 ? "warning" : "warnings"}` : ""}`}
        tabIndex={0}
      >
        {logs.length === 0 ? (
          <div className="console__empty" aria-label="Console is empty">
            Run your code to see output here
          </div>
        ) : (
          logs.map((log, index) => (
            <div 
              key={index} 
              className={`console__log ${getLogClass(log.type)}`}
              role={log.type === "error" ? "alert" : undefined}
              aria-label={`${getLogAriaLabel(log.type)}: ${formatValue(log.value).substring(0, 100)}`}
            >
              <span className="console__prefix" aria-hidden="true">
                {log.type === "error" ? "✕" : log.type === "warn" ? "⚠" : log.type === "result" ? "→" : "›"}
              </span>
              <pre className="console__content">{formatValue(log.value)}</pre>
            </div>
          ))
        )}
        {isRunning && (
          <div 
            className="console__log console__log--running"
            role="status"
            aria-live="polite"
          >
            <span className="console__prefix" aria-hidden="true">⟳</span>
            <span>Running...</span>
          </div>
        )}
        <div ref={logsEndRef} aria-hidden="true" />
      </div>
    </section>
  );
}

export default memo(ConsolePanel);
