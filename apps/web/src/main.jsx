import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { VoiceProvider } from "./contexts/VoiceContext.jsx";
import { FocusModeProvider } from "./contexts/FocusModeContext.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { SessionProvider } from "./contexts/SessionContext.jsx";
import AppRouter from "./AppRouter.jsx";
import "./App.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SessionProvider>
          <ThemeProvider>
            <VoiceProvider>
              <FocusModeProvider>
                <AppRouter />
              </FocusModeProvider>
            </VoiceProvider>
          </ThemeProvider>
        </SessionProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
