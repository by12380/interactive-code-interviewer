import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function ModeSwitcher() {
  const navigate = useNavigate();
  const { activeMode, setActiveMode } = useAuth();

  const handleSwitch = useCallback(() => {
    setActiveMode(null);
    navigate("/select-role", { replace: true });
  }, [setActiveMode, navigate]);

  if (!activeMode) return null;

  return (
    <button
      type="button"
      className="mode-switcher"
      onClick={handleSwitch}
      title="Switch mode"
    >
      <span className={`mode-switcher__dot mode-switcher__dot--${activeMode}`} />
      <span className="mode-switcher__label">
        {activeMode === "practice" ? "Practice" : "Interviewer"}
      </span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="7 10 12 15 17 10" />
      </svg>
    </button>
  );
}
