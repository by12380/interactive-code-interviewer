import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext.jsx";
import App from "./App.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import PracticeDashboard from "./pages/PracticeDashboard.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import InterviewerDashboard from "./pages/InterviewerDashboard.jsx";
import SessionCreator from "./pages/SessionCreator.jsx";
import LiveMonitor from "./pages/LiveMonitor.jsx";
import JoinSession from "./pages/JoinSession.jsx";
import CandidateSession from "./pages/CandidateSession.jsx";
import SessionResults from "./pages/SessionResults.jsx";
import MockInterviewSetup from "./pages/MockInterviewSetup.jsx";

export default function AppRouter() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? null : isAuthenticated ? <Navigate to="/home" replace /> : <LoginPage />
        }
      />

      {/* Landing page — public marketing page */}
      <Route path="/" element={<LandingPage />} />

      {/* Home — interview-first hub with quick join, create, mock, and practice */}
      <Route path="/home" element={<HomePage />} />

      {/* Mock AI Interview — personalized interview from CV / details */}
      <Route path="/mock-interview" element={<MockInterviewSetup />} />

      {/* Legacy /interview route redirects to home hub (all actions live there now) */}
      <Route path="/interview" element={<Navigate to="/home" replace />} />

      {/* Practice hub — personalized dashboard with onboarding & roadmap */}
      <Route
        path="/practice"
        element={
          <ProtectedRoute>
            <PracticeDashboard />
          </ProtectedRoute>
        }
      />

      {/* Practice IDE — full-screen coding workspace */}
      <Route
        path="/practice/solve/:problemId"
        element={
          <ProtectedRoute>
            <App mode="practice" />
          </ProtectedRoute>
        }
      />

      {/* Interviewer routes — require auth (any user can host sessions) */}
      <Route
        path="/interviewer"
        element={
          <ProtectedRoute>
            <InterviewerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interviewer/create"
        element={
          <ProtectedRoute>
            <SessionCreator />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interviewer/session/:id"
        element={
          <ProtectedRoute>
            <LiveMonitor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interviewer/results/:id"
        element={
          <ProtectedRoute>
            <SessionResults />
          </ProtectedRoute>
        }
      />

      {/* Candidate live session routes — public, guests enter name + code */}
      <Route path="/join" element={<JoinSession />} />
      <Route path="/join/:code" element={<JoinSession />} />
      <Route path="/session/:sessionId/:candidateId" element={<CandidateSession />} />

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
