import { memo, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";

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
  onDismissHint
}) {
  const editorContainerRef = useRef(null);
  const widgetRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const monacoInstanceRef = useRef(null);

  // Handle editor mount - store references
  const handleEditorMount = (editor, monaco) => {
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
  };

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
    <section className="panel panel--editor" ref={editorContainerRef}>
      <div className="panel__header panel__header--editor">
        <span>Editor</span>
        <div className="panel__actions">
          <button
            type="button"
            className="panel__action-button panel__action-button--run"
            onClick={onRun}
            disabled={isEditorDisabled || isRunning}
            aria-label="Run code"
            title="Run (⌘/Ctrl+Enter)"
          >
            {isRunning ? "Running..." : "▶ Run"}
          </button>
          <button
            type="button"
            className="panel__action-button"
            onClick={onUndo}
            disabled={isEditorDisabled || !canUndo}
            aria-label="Undo (Command+Z or Control+Z)"
            title="Undo (⌘/Ctrl+Z)"
          >
            Undo
          </button>
          <button
            type="button"
            className="panel__action-button"
            onClick={onRedo}
            disabled={isEditorDisabled || !canRedo}
            aria-label="Redo (Command+Shift+Z or Control+Y)"
            title="Redo (⌘/Ctrl+Shift+Z)"
          >
            Redo
          </button>
        </div>
      </div>
      <Editor
        height="100%"
        defaultLanguage="javascript"
        value={code}
        onChange={onCodeChange}
        onMount={handleEditorMount}
        options={editorOptions}
      />
    </section>
  );
}

export default memo(EditorPanel);
