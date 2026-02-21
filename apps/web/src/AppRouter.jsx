import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext.jsx";
import App from "./App.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import InterviewHub from "./pages/InterviewHub.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import InterviewerDashboard from "./pages/InterviewerDashboard.jsx";
import SessionCreator from "./pages/SessionCreator.jsx";
import LiveMonitor from "./pages/LiveMonitor.jsx";
import JoinSession from "./pages/JoinSession.jsx";
import CandidateSession from "./pages/CandidateSession.jsx";
import SessionResults from "./pages/SessionResults.jsx";

export default function AppRouter() {
  const { isAuthenticated, loading, user } = useAuth();

  const homeRoute = user?.role === "interviewer" ? "/interviewer" : "/";

  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? null : isAuthenticated ? <Navigate to={homeRoute} replace /> : <LoginPage />
        }
      />

      {/* Home dashboard – public, anyone can see it */}
      <Route path="/" element={<HomePage />} />

      {/* Practice workspace – requires account (we track XP, streaks, etc.) */}
      <Route
        path="/practice"
        element={
          <ProtectedRoute>
            <App mode="practice" />
          </ProtectedRoute>
        }
      />

      {/* Interview hub – public, no account needed to take an interview */}
      <Route path="/interview" element={<InterviewHub />} />

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

      {/* Candidate live session routes – public, guests enter name + code */}
      <Route path="/join" element={<JoinSession />} />
      <Route path="/join/:code" element={<JoinSession />} />
      <Route path="/session/:sessionId/:candidateId" element={<CandidateSession />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
