import { memo, useEffect, useRef } from "react";
import "../styles/ide.css";

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
      case "error": return "ide-console__log--error";
      case "warn": return "ide-console__log--warn";
      case "info": return "ide-console__log--info";
      case "result": return "ide-console__log--result";
      default: return "";
    }
  };

  const getLogPrefix = (type) => {
    switch (type) {
      case "error": return "\u2715";
      case "warn": return "\u26A0";
      case "result": return "\u2190";
      case "info": return "\u2139";
      default: return "\u203A";
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
      className={`ide-console ${isOpen ? "ide-console--open" : "ide-console--closed"}`}
      aria-labelledby="console-heading"
      role="region"
    >
      <div
        className="ide-console__bar"
        id="console-heading"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Collapse console" : "Expand console"}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      >
        <div className="ide-console__bar-left">
          <span className="ide-console__chevron">{"\u25BC"}</span>
          <span className="ide-console__title">Console</span>
          {isRunning && <span className="ide-console__running-dot" />}
          {errorCount > 0 && (
            <span className="ide-console__error-badge">
              {errorCount}
            </span>
          )}
          {!isOpen && logs.length > 0 && !isRunning && errorCount === 0 && (
            <span className="ide-console__preview">
              {logs[logs.length - 1] ? formatValue(logs[logs.length - 1].value).substring(0, 60) : ""}
            </span>
          )}
        </div>
        <div className="ide-console__bar-right" onClick={(e) => e.stopPropagation()}>
          {isOpen && (
            <button
              type="button"
              className="ide-console__action"
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
            className="ide-console__action"
            onClick={onToggle}
            aria-label={isOpen ? "Minimize console" : "Open console"}
            title={isOpen ? "Minimize" : "Open"}
          >
            {isOpen ? "\u2014" : "\u25A1"}
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          className="ide-console__output"
          role="log"
          aria-live="polite"
          tabIndex={0}
        >
          {logs.length === 0 && !isRunning ? (
            <div className="ide-console__empty">
              <span className="ide-console__prompt">$</span>
              <span>Waiting for output...</span>
            </div>
          ) : (
            <>
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`ide-console__log ${getLogClass(log.type)}`}
                  role={log.type === "error" ? "alert" : undefined}
                >
                  <span className="ide-console__log-prefix" aria-hidden="true">
                    {getLogPrefix(log.type)}
                  </span>
                  <pre className="ide-console__log-content">{formatValue(log.value)}</pre>
                </div>
              ))}
              {isRunning && (
                <div className="ide-console__log ide-console__log--running">
                  <span className="ide-console__log-prefix">{"\u27F3"}</span>
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
