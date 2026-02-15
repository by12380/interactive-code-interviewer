// AppRouter – maps all routes. The original App component renders at "/".
// Interviewer and candidate pages are separate routes.

import { Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import InterviewerDashboard from "./pages/InterviewerDashboard.jsx";
import SessionCreator from "./pages/SessionCreator.jsx";
import LiveMonitor from "./pages/LiveMonitor.jsx";
import JoinSession from "./pages/JoinSession.jsx";
import CandidateSession from "./pages/CandidateSession.jsx";
import SessionResults from "./pages/SessionResults.jsx";

export default function AppRouter() {
  return (
    <Routes>
      {/* Existing practice app */}
      <Route path="/" element={<App />} />

      {/* Interviewer routes */}
      <Route path="/interviewer" element={<InterviewerDashboard />} />
      <Route path="/interviewer/create" element={<SessionCreator />} />
      <Route path="/interviewer/session/:id" element={<LiveMonitor />} />
      <Route path="/interviewer/results/:id" element={<SessionResults />} />

      {/* Candidate routes */}
      <Route path="/join" element={<JoinSession />} />
      <Route path="/join/:code" element={<JoinSession />} />
      <Route path="/session/:sessionId/:candidateId" element={<CandidateSession />} />

      {/* Fallback */}
      <Route path="*" element={<App />} />
    </Routes>
  );
}
