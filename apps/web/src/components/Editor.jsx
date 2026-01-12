export default function Editor({ value, onChange }) {
  return (
    <div className="editor">
      <div className="panel__title">Editor</div>
      <textarea
        className="editor__textarea"
        spellCheck="false"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
