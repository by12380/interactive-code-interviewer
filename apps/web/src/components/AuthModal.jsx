import { memo, useState, useCallback } from "react";
import { signUp, login } from "../services/userService";

function AuthModal({ onClose, onAuthSuccess }) {
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (mode === "signup") {
        // Validate confirm password
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setIsLoading(false);
          return;
        }

        const result = signUp(username, email, password);
        if (result.success) {
          onAuthSuccess(result.user);
          onClose();
        } else {
          setError(result.error);
        }
      } else {
        const result = login(email, password);
        if (result.success) {
          onAuthSuccess(result.user);
          onClose();
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [mode, username, email, password, confirmPassword, onAuthSuccess, onClose]);

  const switchMode = useCallback(() => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setPassword("");
    setConfirmPassword("");
  }, [mode]);

  return (
    <div className="auth-modal">
      <div className="auth-modal__backdrop" onClick={onClose} />
      <div className="auth-modal__content">
        <button 
          className="auth-modal__close" 
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="auth-modal__header">
          <h2 className="auth-modal__title">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="auth-modal__subtitle">
            {mode === "login" 
              ? "Sign in to track your progress and save your interview history." 
              : "Join to track your coding interview progress."}
          </p>
        </div>

        <form className="auth-modal__form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="auth-modal__field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required
                minLength={3}
                autoComplete="username"
              />
            </div>
          )}

          <div className="auth-modal__field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-modal__field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "login" ? "Enter your password" : "Create a password"}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {mode === "signup" && (
            <div className="auth-modal__field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <div className="auth-modal__error">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="auth-modal__submit"
            disabled={isLoading}
          >
            {isLoading 
              ? "Please wait..." 
              : mode === "login" 
                ? "Sign In" 
                : "Create Account"}
          </button>
        </form>

        <div className="auth-modal__footer">
          <p>
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}
            <button 
              type="button"
              className="auth-modal__switch"
              onClick={switchMode}
            >
              {mode === "login" ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>

        <div className="auth-modal__note">
          <p>Your data is stored locally in your browser.</p>
        </div>
      </div>
    </div>
  );
}

export default memo(AuthModal);
