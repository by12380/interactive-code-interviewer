import { memo, useEffect, useRef, useCallback, useState } from "react";
import Editor from "@monaco-editor/react";
import "../styles/ide.css";

const HINT_AUTO_DISMISS_MS = 12000;
const HINT_FADE_IN_MS = 300;

const LANGUAGE_META = {
  javascript: { icon: "JS", iconClass: "ide__tab-icon--js", label: "JavaScript", ext: ".js" },
  typescript: { icon: "TS", iconClass: "ide__tab-icon--ts", label: "TypeScript", ext: ".ts" },
  python:     { icon: "PY", iconClass: "ide__tab-icon--py", label: "Python", ext: ".py" },
};

function definePlaycodeTheme(monaco) {
  monaco.editor.defineTheme("playcode-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "cdd6f4", background: "1e1e2e" },
      { token: "comment", foreground: "6c7086", fontStyle: "italic" },
      { token: "keyword", foreground: "cba6f7" },
      { token: "keyword.control", foreground: "cba6f7" },
      { token: "storage", foreground: "cba6f7" },
      { token: "storage.type", foreground: "cba6f7" },
      { token: "string", foreground: "a6e3a1" },
      { token: "string.escape", foreground: "f5c2e7" },
      { token: "number", foreground: "fab387" },
      { token: "constant", foreground: "fab387" },
      { token: "type", foreground: "f9e2af" },
      { token: "type.identifier", foreground: "f9e2af" },
      { token: "identifier", foreground: "cdd6f4" },
      { token: "variable", foreground: "cdd6f4" },
      { token: "variable.predefined", foreground: "f38ba8" },
      { token: "function", foreground: "89b4fa" },
      { token: "delimiter", foreground: "9399b2" },
      { token: "delimiter.bracket", foreground: "9399b2" },
      { token: "operator", foreground: "89dceb" },
      { token: "tag", foreground: "cba6f7" },
      { token: "attribute.name", foreground: "f9e2af" },
      { token: "attribute.value", foreground: "a6e3a1" },
      { token: "regexp", foreground: "f5c2e7" },
      { token: "annotation", foreground: "f9e2af" },
    ],
    colors: {
      "editor.background": "#1e1e2e",
      "editor.foreground": "#cdd6f4",
      "editor.lineHighlightBackground": "#2a2b3d",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#45475a80",
      "editor.selectionHighlightBackground": "#45475a40",
      "editor.inactiveSelectionBackground": "#45475a40",
      "editor.findMatchBackground": "#f9e2af30",
      "editor.findMatchHighlightBackground": "#f9e2af20",
      "editorCursor.foreground": "#cba6f7",
      "editorLineNumber.foreground": "#585b70",
      "editorLineNumber.activeForeground": "#cba6f7",
      "editorIndentGuide.background": "#313244",
      "editorIndentGuide.activeBackground": "#45475a",
      "editorBracketMatch.background": "#cba6f720",
      "editorBracketMatch.border": "#cba6f760",
      "editorWhitespace.foreground": "#313244",
      "editorWidget.background": "#1e1e2e",
      "editorWidget.border": "#313244",
      "editorSuggestWidget.background": "#1e1e2e",
      "editorSuggestWidget.border": "#313244",
      "editorSuggestWidget.foreground": "#cdd6f4",
      "editorSuggestWidget.highlightForeground": "#cba6f7",
      "editorSuggestWidget.selectedBackground": "#313244",
      "editorHoverWidget.background": "#1e1e2e",
      "editorHoverWidget.border": "#313244",
      "editorOverviewRuler.border": "#00000000",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#585b7040",
      "scrollbarSlider.hoverBackground": "#585b7060",
      "scrollbarSlider.activeBackground": "#585b7080",
      "minimap.background": "#181825",
    },
  });
}

function EditorPanel({
  canUndo,
  canRedo,
  isEditorDisabled,
  isRunning,
  onUndo,
  onRedo,
  onRun,
  onSave,
  saveStatus,
  onEditorMount,
  onCodeChange,
  editorOptions,
  code,
  language = "javascript",
  fileName,
  interviewerHint,
  onDismissHint,
  onRecordCursorMove,
  onRecordSelection,
  isRecording = false,
  consoleLogs = [],
  onClearConsole,
  isConsoleOpen = false,
  onToggleConsole,
}) {
  const editorContainerRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const monacoInstanceRef = useRef(null);
  const cursorListenerRef = useRef(null);
  const selectionListenerRef = useRef(null);
  const autoDismissTimerRef = useRef(null);
  const decorationIdsRef = useRef([]);
  const contentWidgetRef = useRef(null);
  const zoneIdRef = useRef(null);
  const hintFadeTimerRef = useRef(null);

  const [activeHints, setActiveHints] = useState([]);
  const [hintVisible, setHintVisible] = useState(false);
  const [hintFadingIn, setHintFadingIn] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const langMeta = LANGUAGE_META[language] || LANGUAGE_META.javascript;
  const displayName = fileName || `solution${langMeta.ext}`;

  const handleEditorMount = useCallback((editor, monaco) => {
    editorInstanceRef.current = editor;
    monacoInstanceRef.current = monaco;

    definePlaycodeTheme(monaco);
    monaco.editor.setTheme("playcode-dark");

    onEditorMount(editor, monaco);

    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
      if (isRecording && onRecordCursorMove) {
        onRecordCursorMove({
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        });
      }
    });

    if (onRecordSelection) {
      selectionListenerRef.current = editor.onDidChangeCursorSelection((e) => {
        if (isRecording && onRecordSelection && e.selection) {
          onRecordSelection({
            startLineNumber: e.selection.startLineNumber,
            startColumn: e.selection.startColumn,
            endLineNumber: e.selection.endLineNumber,
            endColumn: e.selection.endColumn,
          });
        }
      });
    }
  }, [onEditorMount, onRecordCursorMove, onRecordSelection, isRecording]);

  const clearHintDecorations = useCallback(() => {
    const editor = editorInstanceRef.current;
    const monaco = monacoInstanceRef.current;
    if (!editor || !monaco) return;

    if (decorationIdsRef.current.length > 0) {
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
    }

    if (contentWidgetRef.current) {
      try { editor.removeContentWidget(contentWidgetRef.current); }
      catch { /* already removed */ }
      contentWidgetRef.current = null;
    }

    if (zoneIdRef.current !== null) {
      editor.changeViewZones((accessor) => {
        accessor.removeZone(zoneIdRef.current);
      });
      zoneIdRef.current = null;
    }

    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelMarkers(model, "ai-interviewer", []);
    }
  }, []);

  const applyHintDecorations = useCallback((hints) => {
    const editor = editorInstanceRef.current;
    const monaco = monacoInstanceRef.current;
    if (!editor || !monaco || !hints || hints.length === 0) return;

    const model = editor.getModel();
    if (!model) return;

    const totalLines = model.getLineCount();

    const markers = hints.map((hint) => {
      const line = Math.min(Math.max(hint.lineNumber || 1, 1), totalLines);
      const endLine = Math.min(Math.max(hint.endLineNumber || line, line), totalLines);
      const sev = hint.severity || hint.displaySeverity || "info";

      let markerSeverity;
      if (sev === "error") markerSeverity = monaco.MarkerSeverity.Error;
      else if (sev === "warning") markerSeverity = monaco.MarkerSeverity.Warning;
      else markerSeverity = monaco.MarkerSeverity.Info;

      return {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: endLine,
        endColumn: model.getLineMaxColumn(endLine),
        message: hint.message,
        severity: markerSeverity,
        source: "AI Interviewer",
      };
    });

    monaco.editor.setModelMarkers(model, "ai-interviewer", markers);

    const decorations = hints.map((hint) => {
      const line = Math.min(Math.max(hint.lineNumber || 1, 1), totalLines);
      const endLine = Math.min(Math.max(hint.endLineNumber || line, line), totalLines);
      const sev = hint.severity || hint.displaySeverity || "info";

      return {
        range: new monaco.Range(line, 1, endLine, model.getLineMaxColumn(endLine)),
        options: {
          isWholeLine: true,
          className: `ai-hint-line ai-hint-line--${sev}`,
          glyphMarginClassName: `ai-hint-glyph ai-hint-glyph--${sev}`,
          glyphMarginHoverMessage: { value: `**AI Interviewer:** ${hint.message}` },
          overviewRuler: {
            color: sev === "error" ? "#f38ba8" : sev === "warning" ? "#f9e2af" : "#89b4fa",
            position: monaco.editor.OverviewRulerLane.Right,
          },
        },
      };
    });

    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, decorations);

    const primaryHint = hints[0];
    if (primaryHint) {
      const targetLine = Math.min(Math.max(primaryHint.lineNumber || 1, 1), totalLines);

      editor.changeViewZones((accessor) => {
        if (zoneIdRef.current !== null) {
          accessor.removeZone(zoneIdRef.current);
        }

        const domNode = document.createElement("div");
        domNode.className = "ai-hint-zone";
        domNode.setAttribute("role", "status");
        domNode.setAttribute("aria-live", "polite");

        const sev = primaryHint.severity || primaryHint.displaySeverity || "info";
        domNode.innerHTML = `
          <div class="ai-hint-zone__inner ai-hint-zone__inner--${sev}">
            <span class="ai-hint-zone__icon">${
              sev === "error" ? "\u2715" : sev === "warning" ? "\u26A0" : "\uD83D\uDCA1"
            }</span>
            <span class="ai-hint-zone__label">AI Interviewer</span>
            <span class="ai-hint-zone__text">${escapeHtml(primaryHint.message)}</span>
            <button class="ai-hint-zone__dismiss" title="Dismiss (Esc)">\u00D7</button>
          </div>
        `;

        const dismissBtn = domNode.querySelector(".ai-hint-zone__dismiss");
        if (dismissBtn) {
          dismissBtn.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onDismissHint) onDismissHint();
          });
        }

        domNode.addEventListener("mousedown", (e) => {
          e.preventDefault();
        });

        zoneIdRef.current = accessor.addZone({
          afterLineNumber: targetLine,
          heightInLines: 2,
          domNode,
        });
      });

      const visibleRange = editor.getVisibleRanges();
      if (visibleRange.length > 0) {
        const visible = visibleRange[0];
        if (targetLine < visible.startLineNumber || targetLine > visible.endLineNumber) {
          editor.revealLineInCenter(targetLine);
        }
      }
    }
  }, [onDismissHint]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && activeHints.length > 0) {
        if (onDismissHint) onDismissHint();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeHints, onDismissHint]);

  useEffect(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    if (hintFadeTimerRef.current) {
      clearTimeout(hintFadeTimerRef.current);
      hintFadeTimerRef.current = null;
    }

    if (interviewerHint) {
      let hints;

      if (typeof interviewerHint === "object" && interviewerHint.hints) {
        hints = interviewerHint.hints;
      } else if (typeof interviewerHint === "object" && interviewerHint.message) {
        hints = [{
          lineNumber: interviewerHint.lineNumber || 1,
          endLineNumber: interviewerHint.endLineNumber || interviewerHint.lineNumber || 1,
          severity: interviewerHint.displaySeverity || "info",
          message: interviewerHint.message,
        }];
      } else if (typeof interviewerHint === "string") {
        hints = [{
          lineNumber: null,
          endLineNumber: null,
          severity: "info",
          message: interviewerHint,
        }];
      } else {
        hints = [];
      }

      setActiveHints(hints);
      setHintFadingIn(true);

      hintFadeTimerRef.current = setTimeout(() => {
        setHintFadingIn(false);
        setHintVisible(true);
      }, HINT_FADE_IN_MS);

      const lineHints = hints.filter((h) => h.lineNumber != null);
      if (lineHints.length > 0) {
        applyHintDecorations(lineHints);
      }

      autoDismissTimerRef.current = setTimeout(() => {
        if (onDismissHint) onDismissHint();
      }, HINT_AUTO_DISMISS_MS);
    } else {
      setActiveHints([]);
      setHintVisible(false);
      setHintFadingIn(false);
      clearHintDecorations();
    }

    return () => {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
      if (hintFadeTimerRef.current) {
        clearTimeout(hintFadeTimerRef.current);
        hintFadeTimerRef.current = null;
      }
    };
  }, [interviewerHint, onDismissHint, applyHintDecorations, clearHintDecorations]);

  useEffect(() => {
    return () => {
      if (cursorListenerRef.current) cursorListenerRef.current.dispose();
      if (selectionListenerRef.current) selectionListenerRef.current.dispose();
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      if (hintFadeTimerRef.current) clearTimeout(hintFadeTimerRef.current);
      clearHintDecorations();
    };
  }, [clearHintDecorations]);

  const floatingHints = activeHints.filter((h) => h.lineNumber == null);
  const showFloating = floatingHints.length > 0 && (hintVisible || hintFadingIn);
  const lineCount = code ? code.split("\n").length : 0;
  const logsEndRef = useRef(null);
  const hasConsole = Boolean(onToggleConsole);
  const errorCount = consoleLogs.filter(l => l.type === "error").length;

  useEffect(() => {
    if (isConsoleOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs, isConsoleOpen]);

  const mergedOptions = {
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
    fontLigatures: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: "on",
    padding: { top: 12, bottom: 12 },
    lineHeight: 22,
    renderLineHighlight: "all",
    renderLineHighlightOnlyWhenFocus: false,
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    smoothScrolling: true,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
      useShadows: false,
    },
    glyphMargin: true,
    ...(editorOptions || {}),
  };

  return (
    <section
      className="ide"
      ref={editorContainerRef}
      aria-labelledby="ide-heading"
      role="region"
    >
      {/* ── Top Bar ──────────────────────────────────────────────── */}
      <div className="ide__topbar" id="ide-heading">
        <div className="ide__tab-group">
          <div className="ide__tab">
            <span className={`ide__tab-icon ${langMeta.iconClass}`}>
              {langMeta.icon}
            </span>
            <span className="ide__tab-name">{displayName}</span>
          </div>
          <span className="ide__lang-badge">{langMeta.label}</span>
        </div>

        <div className="ide__actions" role="toolbar" aria-label="Editor actions">
          {onSave && (
            <button
              type="button"
              className={`ide__action-btn ${saveStatus === "saved" ? "ide__action-btn--save-ok" : ""}`}
              onClick={onSave}
              disabled={isEditorDisabled || saveStatus === "saving"}
              aria-label={saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save (Ctrl+S)"}
              title="Save (\u2318/Ctrl+S)"
            >
              <span className="ide__action-icon">
                {saveStatus === "saving" ? "\u23F3" : saveStatus === "saved" ? "\u2713" : "\uD83D\uDCBE"}
              </span>
              <span>{saveStatus === "saving" ? "Saving" : saveStatus === "saved" ? "Saved" : "Save"}</span>
            </button>
          )}

          <button
            type="button"
            className="ide__action-btn"
            onClick={onUndo}
            disabled={isEditorDisabled || !canUndo}
            aria-label="Undo (Ctrl+Z)"
            title="Undo (\u2318/Ctrl+Z)"
          >
            <span className="ide__action-icon">\u21A9</span>
          </button>
          <button
            type="button"
            className="ide__action-btn"
            onClick={onRedo}
            disabled={isEditorDisabled || !canRedo}
            aria-label="Redo (Ctrl+Shift+Z)"
            title="Redo (\u2318/Ctrl+Shift+Z)"
          >
            <span className="ide__action-icon">\u21AA</span>
          </button>

          <span className="ide__separator" />

          <button
            type="button"
            className="ide__action-btn ide__action-btn--run"
            onClick={onRun}
            disabled={isEditorDisabled || isRunning}
            aria-label={isRunning ? "Running..." : "Run code (Ctrl+Enter)"}
            title="Run (\u2318/Ctrl+Enter)"
            aria-busy={isRunning}
          >
            <span className="ide__action-icon">{isRunning ? "\u23F3" : "\u25B6"}</span>
            <span>{isRunning ? "Running" : "Run"}</span>
          </button>
        </div>
      </div>

      {/* ── Editor ───────────────────────────────────────────────── */}
      <div className="ide__editor-wrap">
        {showFloating && (
          <div
            className={`ide__hint-overlay ${hintFadingIn ? "ide__hint-overlay--entering" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            role="status"
            aria-live="polite"
          >
            <div className="ide__hint-card">
              <div className="ide__hint-header">
                <span className="ide__hint-icon">{"\uD83D\uDCA1"}</span>
                <span className="ide__hint-title">AI Interviewer</span>
                <button
                  className="ide__hint-close"
                  title="Dismiss (Esc)"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDismissHint) onDismissHint();
                  }}
                >
                  \u00D7
                </button>
              </div>
              <div className="ide__hint-body">
                {floatingHints.map((h, i) => (
                  <p key={i}>{h.message}</p>
                ))}
              </div>
              <div className="ide__hint-footer">
                Press Esc to dismiss
              </div>
            </div>
          </div>
        )}

        <Editor
          height="100%"
          defaultLanguage={language}
          theme="playcode-dark"
          value={code}
          onChange={onCodeChange}
          onMount={handleEditorMount}
          options={mergedOptions}
          aria-label="Code editor"
          beforeMount={(monaco) => {
            definePlaycodeTheme(monaco);
          }}
        />
      </div>

      {/* ── Console Drawer (VS Code-style overlay from bottom) ──── */}
      {hasConsole && (
        <div className={`ide-console ${isConsoleOpen ? "ide-console--open" : "ide-console--closed"}`}>
          <div
            className="ide-console__bar"
            onClick={onToggleConsole}
            role="button"
            tabIndex={0}
            aria-expanded={isConsoleOpen}
            aria-label={isConsoleOpen ? "Collapse console" : "Expand console"}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleConsole(); } }}
          >
            <div className="ide-console__bar-left">
              <span className="ide-console__chevron">{"\u25BC"}</span>
              <span className="ide-console__title">Console</span>
              {isRunning && <span className="ide-console__running-dot" />}
              {errorCount > 0 && (
                <span className="ide-console__error-badge">{errorCount}</span>
              )}
              {!isConsoleOpen && consoleLogs.length > 0 && !isRunning && errorCount === 0 && (
                <span className="ide-console__preview">
                  {consoleLogs[consoleLogs.length - 1]
                    ? formatLogValue(consoleLogs[consoleLogs.length - 1].value).substring(0, 60)
                    : ""}
                </span>
              )}
            </div>
            <div className="ide-console__bar-right" onClick={(e) => e.stopPropagation()}>
              {isConsoleOpen && onClearConsole && (
                <button
                  type="button"
                  className="ide-console__action"
                  onClick={onClearConsole}
                  disabled={consoleLogs.length === 0}
                  aria-label="Clear console"
                  title="Clear"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                className="ide-console__action"
                onClick={onToggleConsole}
                aria-label={isConsoleOpen ? "Minimize console" : "Open console"}
                title={isConsoleOpen ? "Minimize" : "Open"}
              >
                {isConsoleOpen ? "\u2014" : "\u25A1"}
              </button>
            </div>
          </div>

          {isConsoleOpen && (
            <div className="ide-console__output" role="log" aria-live="polite" tabIndex={0}>
              {consoleLogs.length === 0 && !isRunning ? (
                <div className="ide-console__empty">
                  <span className="ide-console__prompt">$</span>
                  <span>Waiting for output...</span>
                </div>
              ) : (
                <>
                  {consoleLogs.map((log, index) => (
                    <div
                      key={index}
                      className={`ide-console__log ${getConsoleLogClass(log.type)}`}
                      role={log.type === "error" ? "alert" : undefined}
                    >
                      <span className="ide-console__log-prefix" aria-hidden="true">
                        {getConsoleLogPrefix(log.type)}
                      </span>
                      <pre className="ide-console__log-content">{formatLogValue(log.value)}</pre>
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
        </div>
      )}

      {/* ── Status Bar ───────────────────────────────────────────── */}
      <div className="ide__statusbar">
        <div className="ide__statusbar-left">
          <div className="ide__statusbar-item">
            <span className={`ide__statusbar-dot ${activeHints.some(h => h.severity === "error") ? "ide__statusbar-dot--error" : ""}`} />
            <span>{isRunning ? "Running..." : "Ready"}</span>
          </div>
        </div>
        <div className="ide__statusbar-right">
          <span className="ide__statusbar-item">Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span className="ide__statusbar-item">{lineCount} lines</span>
          <span className="ide__statusbar-item">{langMeta.label}</span>
        </div>
      </div>
    </section>
  );
}

function getConsoleLogClass(type) {
  switch (type) {
    case "error": return "ide-console__log--error";
    case "warn": return "ide-console__log--warn";
    case "info": return "ide-console__log--info";
    case "result": return "ide-console__log--result";
    default: return "";
  }
}

function getConsoleLogPrefix(type) {
  switch (type) {
    case "error": return "\u2715";
    case "warn": return "\u26A0";
    case "result": return "\u2190";
    case "info": return "\u2139";
    default: return "\u203A";
  }
}

function formatLogValue(value) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "object") {
    try { return JSON.stringify(value, null, 2); }
    catch { return String(value); }
  }
  return String(value);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default memo(EditorPanel);
