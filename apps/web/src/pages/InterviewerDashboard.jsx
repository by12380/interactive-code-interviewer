// Interviewer Dashboard – main hub for creating / managing sessions.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getSessions, deleteSession, updateSession } from "../services/sessionService.js";
import "../styles/interviewer.css";

export default function InterviewerDashboard() {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    getSessions(user.uid)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.uid]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this session?")) return;
    await deleteSession(id).catch(() => {});
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleActivate = async (id) => {
    await updateSession(id, { status: "active" }).catch(() => {});
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status: "active" } : s)));
  };

  const statusBadge = (status) => {
    const colors = { draft: "#6b7280", active: "#059669", completed: "#7c3aed" };
    return (
      <span className="iv-badge" style={{ background: colors[status] || "#6b7280" }}>
        {status}
      </span>
    );
  };

  return (
    <div className="iv-dashboard">
      <header className="iv-header">
        <h1>Interviewer Dashboard</h1>
        <div className="iv-header__actions">
          <button className="iv-btn iv-btn--primary" onClick={() => navigate("/interviewer/create")}>
            + New Session
          </button>
          <button className="iv-btn" onClick={() => navigate("/")}>
            Back to Practice
          </button>
          <button
            className="iv-btn iv-btn--danger"
            onClick={async () => {
              await logOut();
              navigate("/login", { replace: true });
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <section className="iv-section">
        <h2>Your Sessions</h2>
        {loading ? (
          <p className="iv-muted">Loading...</p>
        ) : sessions.length === 0 ? (
          <p className="iv-muted">No sessions yet. Create one to get started.</p>
        ) : (
          <div className="iv-sessions-grid">
            {sessions.map((s) => (
              <div key={s.id} className="iv-session-card">
                <div className="iv-session-card__top">
                  <h3>{s.title}</h3>
                  {statusBadge(s.status)}
                </div>
                <div className="iv-session-card__meta">
                  <span>{(s.questionIds || []).length} question(s)</span>
                  <span>Code: <strong>{s.shareCode}</strong></span>
                </div>
                <div className="iv-session-card__actions">
                  {s.status === "draft" && (
                    <button className="iv-btn iv-btn--sm iv-btn--primary" onClick={() => handleActivate(s.id)}>
                      Activate
                    </button>
                  )}
                  {(s.status === "active" || s.status === "draft") && (
                    <button className="iv-btn iv-btn--sm" onClick={() => navigate(`/interviewer/session/${s.id}`)}>
                      {s.status === "active" ? "Monitor" : "Edit"}
                    </button>
                  )}
                  {s.status === "completed" && (
                    <button className="iv-btn iv-btn--sm" onClick={() => navigate(`/interviewer/results/${s.id}`)}>
                      Results
                    </button>
                  )}
                  <button className="iv-btn iv-btn--sm iv-btn--danger" onClick={() => handleDelete(s.id)}>
                    Delete
                  </button>
                </div>
                <div className="iv-session-card__link">
                  Share link: <code>{window.location.origin}/join/{s.shareCode}</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
