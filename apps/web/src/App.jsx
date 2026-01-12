import { useState } from "react";
import Editor from "./components/Editor.jsx";
import ChatPanel from "./components/ChatPanel.jsx";

export default function App() {
  const [code, setCode] = useState("// Start coding...");

  return (
    <div className="app">
      <header className="app__header">
        <h1>Interactive Code Interviewer</h1>
      </header>
      <main className="app__main">
        <section className="panel panel--editor">
          <Editor value={code} onChange={setCode} />
        </section>
        <section className="panel panel--chat">
          <ChatPanel code={code} />
        </section>
      </main>
    </div>
  );
}
