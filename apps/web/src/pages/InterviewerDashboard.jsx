// Interviewer Dashboard – main hub for creating / managing sessions.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getSessions, deleteSession, updateSession, getReport } from "../services/sessionService.js";
import "../styles/interviewer.css";

export default function InterviewerDashboard() {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [reportStatusBySession, setReportStatusBySession] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;

    getSessions(user.uid)
      .then(async (list) => {
        if (cancelled) return;
        setSessions(list);

        const completedSessions = list.filter((session) => session.status === "completed");
        const reportEntries = await Promise.all(completedSessions.map(async (session) => {
          try {
            const data = await getReport(session.id);
            const rankings = Array.isArray(data?.report?.rankings) ? data.report.rankings : [];
            return [session.id, {
              hasReport: Boolean(data?.report),
              updatedAt: data?.updatedAt || null,
              lastSentAt: data?.lastSentAt || null,
              leader: rankings[0] || null,
              candidateCount: rankings.length,
            }];
          } catch {
            return [session.id, { hasReport: false }];
          }
        }));

        if (!cancelled) {
          setReportStatusBySession(Object.fromEntries(reportEntries));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
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
        <h1>My Sessions</h1>
        <div className="iv-header__actions">
          <button className="iv-btn iv-btn--primary" onClick={() => navigate("/interviewer/create")}>
            + New Session
          </button>
          <button className="iv-btn" onClick={() => navigate("/")}>
            Back to Home
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
                {s.status === "completed" && reportStatusBySession[s.id]?.hasReport && (
                  <div className="iv-session-card__report-pill">Web report ready</div>
                )}
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
                      {reportStatusBySession[s.id]?.hasReport ? "View Report" : "Results"}
                    </button>
                  )}
                  <button className="iv-btn iv-btn--sm iv-btn--danger" onClick={() => handleDelete(s.id)}>
                    Delete
                  </button>
                </div>
                {s.status === "completed" && (
                  <div className="iv-session-card__report-summary">
                    {reportStatusBySession[s.id]?.hasReport ? (
                      <>
                        <p className="iv-session-card__report-text">
                          {reportStatusBySession[s.id]?.candidateCount > 1
                            ? `AI leaderboard leader: ${reportStatusBySession[s.id]?.leader?.displayName || reportStatusBySession[s.id]?.leader?.candidateId || "Top candidate"}`
                            : "AI report is available in the web app for this session."}
                        </p>
                        {reportStatusBySession[s.id]?.leader?.leaderboardReason && (
                          <p className="iv-session-card__report-note">
                            {reportStatusBySession[s.id].leader.leaderboardReason}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="iv-session-card__report-text">
                        The session is complete. The AI report will appear here as soon as generation finishes.
                      </p>
                    )}
                  </div>
                )}
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
