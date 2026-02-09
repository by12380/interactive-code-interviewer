import { memo, useEffect, useRef, useCallback, useState } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "../contexts/ThemeContext.jsx";

const HINT_AUTO_DISMISS_MS = 15000; // auto-dismiss after 15 seconds

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
  // Replay recording props
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
  const [hintVisible, setHintVisible] = useState(false);

  // Handle editor mount - store references
  const handleEditorMount = useCallback((editor, monaco) => {
    editorInstanceRef.current = editor;
    monacoInstanceRef.current = monaco;
    
    // Call the parent's onEditorMount
    onEditorMount(editor, monaco);

    // Set up cursor position tracking for replay recording
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

    // Set up selection tracking for replay recording
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

  // Cleanup cursor and selection listeners
  useEffect(() => {
    return () => {
      if (cursorListenerRef.current) {
        cursorListenerRef.current.dispose();
      }
      if (selectionListenerRef.current) {
        selectionListenerRef.current.dispose();
      }
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
    };
  }, []);

  // Auto-dismiss hint after timeout
  useEffect(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }

    if (interviewerHint) {
      setHintVisible(true);
      autoDismissTimerRef.current = setTimeout(() => {
        if (onDismissHint) onDismissHint();
      }, HINT_AUTO_DISMISS_MS);
    } else {
      setHintVisible(false);
    }

    return () => {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
    };
  }, [interviewerHint, onDismissHint]);

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

      {/* Interviewer hint - absolutely positioned over the editor, top-right */}
      {hintVisible && interviewerHint && (
        <div
          className="interviewer-hint-widget"
          onMouseDown={(e) => e.preventDefault()} // Don't steal editor focus
        >
          <div className="interviewer-hint-widget__header">
            <span className="interviewer-hint-widget__icon">💬</span>
            <span className="interviewer-hint-widget__title">Interviewer</span>
            <button
              className="interviewer-hint-widget__close"
              title="Dismiss"
              onClick={(e) => {
                e.stopPropagation();
                if (onDismissHint) onDismissHint();
              }}
            >
              ×
            </button>
          </div>
          <div className="interviewer-hint-widget__content">{interviewerHint}</div>
          <div className="interviewer-hint-widget__footer">Auto-dismisses in a few seconds</div>
        </div>
      )}

      <Editor
        height="100%"
        defaultLanguage="javascript"
        theme={theme === "dark" ? "vs-dark" : "light"}
        value={code}
        onChange={onCodeChange}
        onMount={handleEditorMount}
        options={editorOptions}
        aria-label="JavaScript code editor"
      />
    </section>
  );
}

export default memo(EditorPanel);
