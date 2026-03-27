import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  firebaseSignUp,
  firebaseLogin,
  firebaseLogout,
  onAuthChange,
} from "../services/firebaseAuthService.js";

const ACTIVE_MODE_KEY = "code_interviewer_active_mode";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // "practice" | "interviewer" | null (null = not yet chosen)
  const [activeMode, setActiveModeState] = useState(() => {
    return localStorage.getItem(ACTIVE_MODE_KEY) || null;
  });

  const setActiveMode = useCallback((mode) => {
    setActiveModeState(mode);
    if (mode) {
      localStorage.setItem(ACTIVE_MODE_KEY, mode);
    } else {
      localStorage.removeItem(ACTIVE_MODE_KEY);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signUp = useCallback(async ({ email, password, displayName }) => {
    setError(null);
    try {
      const u = await firebaseSignUp({ email, password, displayName });
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
      localStorage.removeItem("code_interviewer_current_user");
      localStorage.removeItem("onboardingComplete");
      localStorage.removeItem("onboardingNeverShow");

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
        activeMode,
        setActiveMode,
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
