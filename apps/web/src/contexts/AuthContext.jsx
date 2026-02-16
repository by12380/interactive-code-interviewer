// AuthContext – provides current user + auth actions to the whole app.
// Uses Firebase Auth with session-only persistence so the login page
// is always shown on fresh browser/tab opens.

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  firebaseSignUp,
  firebaseLogin,
  firebaseLogout,
  onAuthChange,
} from "../services/firebaseAuthService.js";

const AuthContext = createContext(null);

// Key used to detect a fresh browser session vs. an in-session reload.
const SESSION_KEY = "ci_auth_session_active";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);        // { uid, email, displayName, role }
  const [loading, setLoading] = useState(true);   // true while checking initial auth state
  const [error, setError] = useState(null);
  const didCleanup = useRef(false);

  // Listen for Firebase auth changes on mount.
  // On a fresh tab/browser open (no sessionStorage flag), sign out any
  // stale persisted session so the user always lands on the login page.
  useEffect(() => {
    const isExistingSession = sessionStorage.getItem(SESSION_KEY);

    const unsub = onAuthChange(async (u) => {
      if (u && !isExistingSession && !didCleanup.current) {
        // Stale session from a previous browser window – clear it once.
        didCleanup.current = true;
        await firebaseLogout();
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signUp = useCallback(async ({ email, password, displayName, role }) => {
    setError(null);
    try {
      const u = await firebaseSignUp({ email, password, displayName, role });
      sessionStorage.setItem(SESSION_KEY, "1"); // mark session active
      setUser(u);
      return u;
    } catch (e) {
      setError(e.message || "Sign-up failed");
      throw e;
    }
  }, []);

  const logIn = useCallback(async ({ email, password }) => {
    setError(null);
    try {
      const u = await firebaseLogin({ email, password });
      sessionStorage.setItem(SESSION_KEY, "1"); // mark session active
      setUser(u);
      return u;
    } catch (e) {
      setError(e.message || "Login failed");
      throw e;
    }
  }, []);

  const logOut = useCallback(async () => {
    setError(null);
    try {
      sessionStorage.removeItem(SESSION_KEY); // clear session flag

      // Clear all app-related localStorage keys
      const appKeys = [
        "code_interviewer_current_user",
        "code_interviewer_users",
        "code_interviewer_leaderboard",
        "onboardingComplete",
        "onboardingNeverShow",
      ];
      appKeys.forEach((key) => localStorage.removeItem(key));

      await firebaseLogout();
      setUser(null);
    } catch (e) {
      setError(e.message || "Logout failed");
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signUp,
        logIn,
        logOut,
        isInterviewer: user?.role === "interviewer",
        isCandidate: user?.role === "candidate",
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export default AuthContext;
