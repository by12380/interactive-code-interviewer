import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

/**
 * ProtectedRoute - wraps a route that requires authentication.
 *
 * Props:
 *   requiredRole  – optional "interviewer" | "candidate". When set, users
 *                   without that role are redirected to "/" instead.
 *   children      – the page element to render when authorised.
 */
export default function ProtectedRoute({ children, requiredRole }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-page__loader">
          <div className="login-page__spinner" />
          <p>Loading&hellip;</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}
