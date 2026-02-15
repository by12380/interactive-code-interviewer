// AppRouter – maps all routes. The original App component renders at "/".
// Interviewer and candidate pages are separate routes.
// /login is the dedicated authentication page.

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext.jsx";
import App from "./App.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import InterviewerDashboard from "./pages/InterviewerDashboard.jsx";
import SessionCreator from "./pages/SessionCreator.jsx";
import LiveMonitor from "./pages/LiveMonitor.jsx";
import JoinSession from "./pages/JoinSession.jsx";
import CandidateSession from "./pages/CandidateSession.jsx";
import SessionResults from "./pages/SessionResults.jsx";

export default function AppRouter() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Routes>
      {/* Auth page – redirect away if already logged in */}
      <Route
        path="/login"
        element={
          loading ? null : isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
        }
      />

      {/* Home / practice app – requires auth, redirects to /login otherwise */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        }
      />

      {/* Interviewer routes – require auth + interviewer role */}
      <Route
        path="/interviewer"
        element={
          <ProtectedRoute requiredRole="interviewer">
            <InterviewerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interviewer/create"
        element={
          <ProtectedRoute requiredRole="interviewer">
            <SessionCreator />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interviewer/session/:id"
        element={
          <ProtectedRoute requiredRole="interviewer">
            <LiveMonitor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interviewer/results/:id"
        element={
          <ProtectedRoute requiredRole="interviewer">
            <SessionResults />
          </ProtectedRoute>
        }
      />

      {/* Candidate routes – require auth (any role can join a session) */}
      <Route
        path="/join"
        element={
          <ProtectedRoute>
            <JoinSession />
          </ProtectedRoute>
        }
      />
      <Route
        path="/join/:code"
        element={
          <ProtectedRoute>
            <JoinSession />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId/:candidateId"
        element={
          <ProtectedRoute>
            <CandidateSession />
          </ProtectedRoute>
        }
      />

      {/* Fallback – send unknown routes to login if not authed */}
      <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
    </Routes>
  );
}
