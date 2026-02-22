// AppRouter – maps all candidate/interviewer routes.
// /candidate is the post-login candidate hub.
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
import CandidateHome from "./pages/CandidateHome.jsx";

export default function AppRouter() {
  const { user, isAuthenticated, loading } = useAuth();
  const defaultAuthedRoute = user?.role === "interviewer" ? "/interviewer" : "/candidate";

  return (
    <Routes>
      <Route
        path="/"
        element={loading ? null : <Navigate to={isAuthenticated ? defaultAuthedRoute : "/login"} replace />}
      />

      {/* Auth page – redirect away if already logged in */}
      <Route
        path="/login"
        element={
          loading ? null : isAuthenticated ? <Navigate to={defaultAuthedRoute} replace /> : <LoginPage />
        }
      />

      {/* Candidate hub – requires auth, interviewer users redirected to dashboard */}
      <Route
        path="/candidate"
        element={
          <ProtectedRoute requiredRole="candidate">
            <CandidateHome />
          </ProtectedRoute>
        }
      />

      {/* Practice workspace – isolated from live interview flow */}
      <Route
        path="/practice"
        element={
          <ProtectedRoute requiredRole="candidate">
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

      {/* Candidate routes – public so invite links work without prior auth */}
      <Route
        path="/join"
        element={<JoinSession />}
      />
      <Route
        path="/join/:code"
        element={<JoinSession />}
      />
      <Route
        path="/session/:sessionId/:candidateId"
        element={<CandidateSession />}
      />

      {/* Fallback – send unknown routes to login if not authed */}
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? defaultAuthedRoute : "/login"} replace />}
      />
    </Routes>
  );
}
