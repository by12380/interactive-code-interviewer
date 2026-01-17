import { memo } from "react";
import Editor from "@monaco-editor/react";

function EditorPanel({
  canUndo,
  canRedo,
  isEditorDisabled,
  onUndo,
  onRedo,
  onEditorMount,
  onCodeChange,
  editorOptions,
  defaultCode
}) {
  return (
    <section className="panel panel--editor">
      <div className="panel__header panel__header--editor">
        <span>Editor</span>
        <div className="panel__actions">
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
        defaultValue={defaultCode}
        onChange={onCodeChange}
        onMount={onEditorMount}
        options={editorOptions}
      />
    </section>
  );
}

export default memo(EditorPanel);
