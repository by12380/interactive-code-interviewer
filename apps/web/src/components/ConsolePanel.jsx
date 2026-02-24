import { memo, useEffect, useRef } from "react";

function ConsolePanel({ logs, onClear, isRunning, isOpen, onToggle }) {
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen]);

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
      case "error": return "console__log--error";
      case "warn": return "console__log--warn";
      case "info": return "console__log--info";
      case "result": return "console__log--result";
      default: return "";
    }
  };

  const getLogPrefix = (type) => {
    switch (type) {
      case "error": return "✕";
      case "warn": return "⚠";
      case "result": return "←";
      case "info": return "ℹ";
      default: return "›";
    }
  };

  const formatValue = (value) => {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "object") {
      try { return JSON.stringify(value, null, 2); }
      catch { return String(value); }
    }
    return String(value);
  };

  const errorCount = logs.filter(l => l.type === "error").length;

  return (
    <section
      className={`console-panel ${isOpen ? "console-panel--open" : "console-panel--closed"}`}
      aria-labelledby="console-heading"
      role="region"
    >
      <div
        className="console-panel__bar"
        id="console-heading"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Collapse console" : "Expand console"}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      >
        <div className="console-panel__bar-left">
          <span className="console-panel__chevron">{isOpen ? "▼" : "▲"}</span>
          <span className="console-panel__title">Terminal</span>
          {isRunning && <span className="console-panel__running-dot" />}
          {errorCount > 0 && (
            <span className="console-panel__error-badge">
              {errorCount}
            </span>
          )}
          {!isOpen && logs.length > 0 && !isRunning && errorCount === 0 && (
            <span className="console-panel__preview">
              {logs[logs.length - 1] ? formatValue(logs[logs.length - 1].value).substring(0, 60) : ""}
            </span>
          )}
        </div>
        <div className="console-panel__bar-right" onClick={(e) => e.stopPropagation()}>
          {isOpen && (
            <button
              type="button"
              className="console-panel__action"
              onClick={onClear}
              disabled={logs.length === 0}
              aria-label="Clear console"
              title="Clear"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            className="console-panel__action console-panel__action--toggle"
            onClick={onToggle}
            aria-label={isOpen ? "Minimize console" : "Open console"}
            title={isOpen ? "Minimize" : "Open"}
          >
            {isOpen ? "—" : "□"}
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          className="console-panel__output"
          role="log"
          aria-live="polite"
          tabIndex={0}
        >
          {logs.length === 0 && !isRunning ? (
            <div className="console-panel__empty">
              <span className="console-panel__prompt">$</span>
              <span>Waiting for output...</span>
            </div>
          ) : (
            <>
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`console-panel__log ${getLogClass(log.type)}`}
                  role={log.type === "error" ? "alert" : undefined}
                >
                  <span className="console-panel__log-prefix" aria-hidden="true">
                    {getLogPrefix(log.type)}
                  </span>
                  <pre className="console-panel__log-content">{formatValue(log.value)}</pre>
                </div>
              ))}
              {isRunning && (
                <div className="console-panel__log console-panel__log--running">
                  <span className="console-panel__log-prefix">⟳</span>
                  <span>Running...</span>
                </div>
              )}
            </>
          )}
          <div ref={logsEndRef} aria-hidden="true" />
        </div>
      )}
    </section>
  );
}

export default memo(ConsolePanel);
