import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext.jsx";
import App from "./App.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import PracticeDashboard from "./pages/PracticeDashboard.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ModeRoute from "./components/ModeRoute.jsx";
import InterviewerDashboard from "./pages/InterviewerDashboard.jsx";
import SessionCreator from "./pages/SessionCreator.jsx";
import LiveMonitor from "./pages/LiveMonitor.jsx";
import JoinSession from "./pages/JoinSession.jsx";
import CandidateSession from "./pages/CandidateSession.jsx";
import SessionResults from "./pages/SessionResults.jsx";
import MockInterviewSetup from "./pages/MockInterviewSetup.jsx";
import RoleSelector from "./pages/RoleSelector.jsx";

export default function AppRouter() {
  const { loading, isAuthenticated, activeMode } = useAuth();

  const defaultHome = !isAuthenticated
    ? "/home"
    : !activeMode
    ? "/select-role"
    : activeMode === "practice"
    ? "/practice"
    : "/interviewer";

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? null : <LoginPage />}
      />

      <Route path="/" element={<LandingPage />} />

      <Route
        path="/select-role"
        element={
          <ProtectedRoute>
            <RoleSelector />
          </ProtectedRoute>
        }
      />

      <Route path="/home" element={<HomePage />} />
      <Route path="/interview" element={<Navigate to="/home" replace />} />

      {/* Practice routes — require auth + practice mode */}
      <Route
        path="/mock-interview"
        element={
          <ProtectedRoute>
            <ModeRoute allowedMode="practice">
              <MockInterviewSetup />
            </ModeRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/practice"
        element={
          <ProtectedRoute>
            <ModeRoute allowedMode="practice">
              <PracticeDashboard />
            </ModeRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/practice/solve/:problemId"
        element={
          <ProtectedRoute>
            <ModeRoute allowedMode="practice">
              <App mode="practice" />
            </ModeRoute>
          </ProtectedRoute>
        }
      />

      {/* Interviewer routes — require auth + interviewer mode */}
      <Route
        path="/interviewer"
        element={
          <ProtectedRoute>
            <ModeRoute allowedMode="interviewer">
              <InterviewerDashboard />
            </ModeRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/interviewer/create"
        element={
          <ProtectedRoute>
            <ModeRoute allowedMode="interviewer">
              <SessionCreator />
            </ModeRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/interviewer/session/:id"
        element={
          <ProtectedRoute>
            <ModeRoute allowedMode="interviewer">
              <LiveMonitor />
            </ModeRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/interviewer/results/:id"
        element={
          <ProtectedRoute>
            <ModeRoute allowedMode="interviewer">
              <SessionResults />
            </ModeRoute>
          </ProtectedRoute>
        }
      />

      {/* Candidate live session — fully public, no login required */}
      <Route path="/join" element={<JoinSession />} />
      <Route path="/join/:code" element={<JoinSession />} />
      <Route path="/session/:sessionId/:candidateId" element={<CandidateSession />} />

      <Route path="*" element={<Navigate to={defaultHome} replace />} />
    </Routes>
  );
}
