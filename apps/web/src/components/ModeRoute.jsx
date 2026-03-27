import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

/**
 * ModeRoute — gates child routes behind the user's active mode.
 *
 * If the user hasn't chosen a mode yet, they're sent to /select-role.
 * If their active mode doesn't match `allowedMode`, they're sent to their
 * mode's default dashboard so they never accidentally land on an unrelated module.
 */
export default function ModeRoute({ allowedMode, children }) {
  const { activeMode } = useAuth();

  if (!activeMode) {
    return <Navigate to="/select-role" replace />;
  }

  if (activeMode !== allowedMode) {
    const fallback = activeMode === "practice" ? "/practice" : "/interviewer";
    return <Navigate to={fallback} replace />;
  }

  return children;
}
