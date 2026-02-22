import { memo, useEffect, useRef, useCallback, useState } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "../contexts/ThemeContext.jsx";

const HINT_AUTO_DISMISS_MS = 12000;
const HINT_FADE_IN_MS = 300;

function EditorPanel({
  canUndo,
  canRedo,
  isEditorDisabled,
  isRunning,
  onUndo,
  onRedo,
  onRun,
  onEditorMount,
  onCodeChange,
  editorOptions,
  code,
  interviewerHint,
  onDismissHint,
  onRecordCursorMove,
  onRecordSelection,
  isRecording = false,
}) {
  const { theme } = useTheme();
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

  const handleEditorMount = useCallback((editor, monaco) => {
    editorInstanceRef.current = editor;
    monacoInstanceRef.current = monaco;

    onEditorMount(editor, monaco);

    if (onRecordCursorMove) {
      cursorListenerRef.current = editor.onDidChangeCursorPosition((e) => {
        if (isRecording && onRecordCursorMove) {
          onRecordCursorMove({
            lineNumber: e.position.lineNumber,
            column: e.position.column,
          });
        }
      });
    }

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

  // Clear all Monaco decorations and widgets
  const clearHintDecorations = useCallback(() => {
    const editor = editorInstanceRef.current;
    const monaco = monacoInstanceRef.current;
    if (!editor || !monaco) return;

    // Remove line decorations (squiggly underlines, gutter icons)
    if (decorationIdsRef.current.length > 0) {
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
    }

    // Remove content widget
    if (contentWidgetRef.current) {
      try {
        editor.removeContentWidget(contentWidgetRef.current);
      } catch { /* widget may already be removed */ }
      contentWidgetRef.current = null;
    }

    // Remove view zone
    if (zoneIdRef.current !== null) {
      editor.changeViewZones((accessor) => {
        accessor.removeZone(zoneIdRef.current);
      });
      zoneIdRef.current = null;
    }

    // Clear markers
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelMarkers(model, "ai-interviewer", []);
    }
  }, []);

  // Apply Monaco decorations for a structured hint
  const applyHintDecorations = useCallback((hints) => {
    const editor = editorInstanceRef.current;
    const monaco = monacoInstanceRef.current;
    if (!editor || !monaco || !hints || hints.length === 0) return;

    const model = editor.getModel();
    if (!model) return;

    const totalLines = model.getLineCount();

    // Build markers (squiggly underlines with hover messages)
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

    // Build line decorations (gutter icons + line highlight)
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
            color: sev === "error" ? "#ef4444" : sev === "warning" ? "#f59e0b" : "#3b82f6",
            position: monaco.editor.OverviewRulerLane.Right,
          },
        },
      };
    });

    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, decorations);

    // Create an inline content widget for the primary hint (first one)
    const primaryHint = hints[0];
    if (primaryHint) {
      const targetLine = Math.min(Math.max(primaryHint.lineNumber || 1, 1), totalLines);

      // Use a view zone to inject the hint box below the target line
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
              sev === "error" ? "✕" : sev === "warning" ? "⚠" : "💡"
            }</span>
            <span class="ai-hint-zone__label">AI Interviewer</span>
            <span class="ai-hint-zone__text">${escapeHtml(primaryHint.message)}</span>
            <button class="ai-hint-zone__dismiss" title="Dismiss (Esc)">×</button>
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

        // Prevent clicks on the zone from stealing editor focus
        domNode.addEventListener("mousedown", (e) => {
          e.preventDefault();
        });

        zoneIdRef.current = accessor.addZone({
          afterLineNumber: targetLine,
          heightInLines: 2,
          domNode,
        });
      });

      // Scroll to make the hint visible (only if it's off-screen)
      const visibleRange = editor.getVisibleRanges();
      if (visibleRange.length > 0) {
        const visible = visibleRange[0];
        if (targetLine < visible.startLineNumber || targetLine > visible.endLineNumber) {
          editor.revealLineInCenter(targetLine);
        }
      }
    }
  }, [onDismissHint]);

  // Handle escape key to dismiss hints
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && activeHints.length > 0) {
        if (onDismissHint) onDismissHint();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeHints, onDismissHint]);

  // Process interviewerHint changes
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
        // Structured hint from the AI code-hints endpoint
        hints = interviewerHint.hints;
      } else if (typeof interviewerHint === "object" && interviewerHint.message) {
        // Single structured hint from codeAnalyzer
        hints = [{
          lineNumber: interviewerHint.lineNumber || 1,
          endLineNumber: interviewerHint.endLineNumber || interviewerHint.lineNumber || 1,
          severity: interviewerHint.displaySeverity || "info",
          message: interviewerHint.message,
        }];
      } else if (typeof interviewerHint === "string") {
        // Legacy string hint — show as a floating widget (fallback)
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

      // Trigger fade-in
      hintFadeTimerRef.current = setTimeout(() => {
        setHintFadingIn(false);
        setHintVisible(true);
      }, HINT_FADE_IN_MS);

      // Apply Monaco decorations for hints that have line numbers
      const lineHints = hints.filter((h) => h.lineNumber != null);
      if (lineHints.length > 0) {
        applyHintDecorations(lineHints);
      }

      // Auto-dismiss
      autoDismissTimerRef.current = setTimeout(() => {
        if (onDismissHint) onDismissHint();
      }, HINT_AUTO_DISMISS_MS);
    } else {
      // Clear everything
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cursorListenerRef.current) cursorListenerRef.current.dispose();
      if (selectionListenerRef.current) selectionListenerRef.current.dispose();
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      if (hintFadeTimerRef.current) clearTimeout(hintFadeTimerRef.current);
      clearHintDecorations();
    };
  }, [clearHintDecorations]);

  // Determine if there are non-line hints (need floating fallback)
  const floatingHints = activeHints.filter((h) => h.lineNumber == null);
  const showFloating = floatingHints.length > 0 && (hintVisible || hintFadingIn);

  return (
    <section
      className="panel panel--editor"
      ref={editorContainerRef}
      aria-labelledby="editor-heading"
      role="region"
    >
      <div className="panel__header panel__header--editor" id="editor-heading">
        <span>Code Editor</span>
        <div className="panel__actions" role="toolbar" aria-label="Editor actions">
          <button
            type="button"
            className="panel__action-button panel__action-button--run"
            onClick={onRun}
            disabled={isEditorDisabled || isRunning}
            aria-label={isRunning ? "Code is running" : "Run code (Ctrl+Enter)"}
            title="Run (⌘/Ctrl+Enter)"
            aria-busy={isRunning}
          >
            <span aria-hidden="true">{isRunning ? "⏳" : "▶"}</span>
            <span>{isRunning ? "Running..." : "Run"}</span>
          </button>
          <button
            type="button"
            className="panel__action-button"
            onClick={onUndo}
            disabled={isEditorDisabled || !canUndo}
            aria-label="Undo last change (Ctrl+Z)"
            title="Undo (⌘/Ctrl+Z)"
          >
            Undo
          </button>
          <button
            type="button"
            className="panel__action-button"
            onClick={onRedo}
            disabled={isEditorDisabled || !canRedo}
            aria-label="Redo last change (Ctrl+Shift+Z)"
            title="Redo (⌘/Ctrl+Shift+Z)"
          >
            Redo
          </button>
        </div>
      </div>

      {/* Floating fallback for hints without line numbers (e.g. API-generated) */}
      {showFloating && (
        <div
          className={`interviewer-hint-widget ${hintFadingIn ? "interviewer-hint-widget--entering" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          role="status"
          aria-live="polite"
        >
          <div className="interviewer-hint-widget__header">
            <span className="interviewer-hint-widget__icon">💡</span>
            <span className="interviewer-hint-widget__title">AI Interviewer</span>
            <button
              className="interviewer-hint-widget__close"
              title="Dismiss (Esc)"
              onClick={(e) => {
                e.stopPropagation();
                if (onDismissHint) onDismissHint();
              }}
            >
              ×
            </button>
          </div>
          <div className="interviewer-hint-widget__content">
            {floatingHints.map((h, i) => (
              <p key={i}>{h.message}</p>
            ))}
          </div>
          <div className="interviewer-hint-widget__footer">
            Press Esc to dismiss
          </div>
        </div>
      )}

      <Editor
        height="100%"
        defaultLanguage="javascript"
        theme={theme === "dark" ? "vs-dark" : "light"}
        value={code}
        onChange={onCodeChange}
        onMount={handleEditorMount}
        options={{
          ...editorOptions,
          glyphMargin: true,
        }}
        aria-label="JavaScript code editor"
      />
    </section>
  );
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default memo(EditorPanel);
