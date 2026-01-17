import { memo } from "react";
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
  code
}) {
  return (
    <section className="panel panel--editor">
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
        onMount={onEditorMount}
        options={editorOptions}
      />
    </section>
  );
}

export default memo(EditorPanel);
