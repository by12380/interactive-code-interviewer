import { useState, useCallback } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp, logIn, loading: authLoading, isAuthenticated, activeMode } = useAuth();

  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const redirectLocation = location.state?.from;

  const getRedirectTarget = () => {
    if (redirectLocation?.pathname) {
      return `${redirectLocation.pathname}${redirectLocation.search || ""}${redirectLocation.hash || ""}`;
    }
    if (!activeMode) return "/select-role";
    return activeMode === "practice" ? "/practice" : "/interviewer";
  };

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");

      if (mode === "signup") {
        if (!displayName.trim()) {
          setError("Please enter your name.");
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }
      }

      setBusy(true);
      try {
        if (mode === "signup") {
          await signUp({
            email,
            password,
            displayName: displayName.trim(),
          });
        } else {
          await logIn({ email, password });
        }
        navigate(getRedirectTarget(), {
          replace: true,
          state: redirectLocation?.state,
        });
      } catch (err) {
        const msg = err?.message || "Something went wrong.";
        if (msg.includes("auth/email-already-in-use")) {
          setError("An account with this email already exists.");
        } else if (msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password") || msg.includes("auth/user-not-found")) {
          setError("Invalid email or password.");
        } else if (msg.includes("auth/weak-password")) {
          setError("Password must be at least 6 characters.");
        } else if (msg.includes("auth/invalid-email")) {
          setError("Please enter a valid email address.");
        } else if (msg.includes("auth/too-many-requests")) {
          setError("Too many attempts. Please try again later.");
        } else {
          setError(msg);
        }
      } finally {
        setBusy(false);
      }
    },
    [mode, email, password, confirmPassword, displayName, signUp, logIn, navigate, activeMode, redirectLocation]
  );

  const switchMode = useCallback(() => {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setError("");
    setPassword("");
    setConfirmPassword("");
  }, []);

  if (authLoading) {
    return (
      <div className="login-page">
        <div className="login-page__loader">
          <div className="login-page__spinner" />
          <p>Loading&hellip;</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={getRedirectTarget()} replace state={redirectLocation?.state} />;
  }

  return (
    <div className="login-page">
      {/* Decorative blobs */}
      <div className="login-page__blob login-page__blob--1" />
      <div className="login-page__blob login-page__blob--2" />

      <div className="login-page__card">
        {/* Logo / Brand */}
        <div className="login-page__brand">
          <div className="login-page__logo">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
              <line x1="12" y1="2" x2="12" y2="22" opacity="0.3" />
            </svg>
          </div>
          <h1 className="login-page__title">CodePractice</h1>
          <p className="login-page__subtitle">
            {mode === "login"
              ? "Sign in to continue your practice"
              : "Create an account to track your progress"}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="login-page__tabs">
          <button
            type="button"
            className={`login-page__tab ${mode === "login" ? "login-page__tab--active" : ""}`}
            onClick={() => { setMode("login"); setError(""); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`login-page__tab ${mode === "signup" ? "login-page__tab--active" : ""}`}
            onClick={() => { setMode("signup"); setError(""); }}
          >
            Sign Up
          </button>
        </div>

        <form className="login-page__form" onSubmit={handleSubmit} noValidate>
          {/* Name field (signup only) */}
          {mode === "signup" && (
            <div className="login-page__field">
              <label htmlFor="lp-name" className="login-page__label">
                Full Name
              </label>
              <input
                id="lp-name"
                type="text"
                className="login-page__input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Smith"
                required
                autoComplete="name"
              />
            </div>
          )}

          {/* Email */}
          <div className="login-page__field">
            <label htmlFor="lp-email" className="login-page__label">
              Email
            </label>
            <input
              id="lp-email"
              type="email"
              className="login-page__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          {/* Password */}
          <div className="login-page__field">
            <label htmlFor="lp-password" className="login-page__label">
              Password
            </label>
            <input
              id="lp-password"
              type="password"
              className="login-page__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "login" ? "Enter password" : "Min. 6 characters"}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {/* Confirm password (signup only) */}
          {mode === "signup" && (
            <div className="login-page__field">
              <label htmlFor="lp-confirm" className="login-page__label">
                Confirm Password
              </label>
              <input
                id="lp-confirm"
                type="password"
                className="login-page__input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          )}

          {/* Error */}
          {error && <div className="login-page__error">{error}</div>}

          {/* Submit */}
          <button
            type="submit"
            className="login-page__submit"
            disabled={busy}
          >
            {busy
              ? "Please wait\u2026"
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        {/* Footer toggle */}
        <p className="login-page__footer">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button type="button" className="login-page__switch" onClick={switchMode}>
            {mode === "login" ? "Sign Up" : "Sign In"}
          </button>
        </p>

        <div className="login-page__guest-notice">
          <p>Just here for an interview? No account needed.</p>
          <button
            type="button"
            className="login-page__switch"
            onClick={() => navigate("/home")}
          >
            Go to Home &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
