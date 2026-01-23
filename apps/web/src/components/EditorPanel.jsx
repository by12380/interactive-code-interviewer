import { memo, useEffect, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "../contexts/ThemeContext.jsx";

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
  const widgetRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const monacoInstanceRef = useRef(null);
  const cursorListenerRef = useRef(null);
  const selectionListenerRef = useRef(null);

  // Handle editor mount - store references
  const handleEditorMount = useCallback((editor, monaco) => {
    editorInstanceRef.current = editor;
    monacoInstanceRef.current = monaco;
    
    // Call the parent's onEditorMount
    onEditorMount(editor, monaco);

    // Dismiss hint when user starts typing
    editor.onDidChangeModelContent(() => {
      if (onDismissHint) {
        onDismissHint();
      }
    });

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
  }, [onEditorMount, onDismissHint, onRecordCursorMove, onRecordSelection, isRecording]);

  // Cleanup cursor and selection listeners
  useEffect(() => {
    return () => {
      if (cursorListenerRef.current) {
        cursorListenerRef.current.dispose();
      }
      if (selectionListenerRef.current) {
        selectionListenerRef.current.dispose();
      }
    };
  }, []);

  // Show/hide the interviewer hint widget
  useEffect(() => {
    const editor = editorInstanceRef.current;
    const monaco = monacoInstanceRef.current;
    
    if (!editor || !monaco) return;

    // Remove existing widget if any
    if (widgetRef.current) {
      editor.removeContentWidget(widgetRef.current);
      widgetRef.current = null;
    }

    // If there's a hint to show, create the widget
    if (interviewerHint) {
      const position = editor.getPosition();
      
      const widget = {
        getId: () => "interviewer-hint-widget",
        getDomNode: () => {
          const node = document.createElement("div");
          node.className = "interviewer-hint-widget";
          node.innerHTML = `
            <div class="interviewer-hint-widget__header">
              <span class="interviewer-hint-widget__icon">💬</span>
              <span class="interviewer-hint-widget__title">Interviewer</span>
              <button class="interviewer-hint-widget__close" title="Dismiss (or just keep typing)">×</button>
            </div>
            <div class="interviewer-hint-widget__content">${interviewerHint}</div>
            <div class="interviewer-hint-widget__footer">Keep typing to dismiss</div>
          `;
          
          // Add close button handler
          const closeBtn = node.querySelector(".interviewer-hint-widget__close");
          closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (onDismissHint) onDismissHint();
          });
          
          return node;
        },
        getPosition: () => ({
          position: position || { lineNumber: 1, column: 1 },
          preference: [
            monaco.editor.ContentWidgetPositionPreference.ABOVE,
            monaco.editor.ContentWidgetPositionPreference.BELOW
          ]
        })
      };

      editor.addContentWidget(widget);
      widgetRef.current = widget;
    }

    return () => {
      if (widgetRef.current && editor) {
        try {
          editor.removeContentWidget(widgetRef.current);
        } catch (e) {
          // Editor might be disposed
        }
        widgetRef.current = null;
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
