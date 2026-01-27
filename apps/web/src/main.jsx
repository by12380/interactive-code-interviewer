import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { VoiceProvider } from "./contexts/VoiceContext.jsx";
import { FocusModeProvider } from "./contexts/FocusModeContext.jsx";
import App from "./App.jsx";
import "./App.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <VoiceProvider>
        <FocusModeProvider>
          <App />
        </FocusModeProvider>
      </VoiceProvider>
    </ThemeProvider>
  </React.StrictMode>
);
