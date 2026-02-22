import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import "../styles/candidateHome.css";

export default function CandidateHome() {
  const navigate = useNavigate();
  const { user, logOut } = useAuth();

  const firstName = useMemo(() => {
    const display = user?.displayName || user?.email || "there";
    return display.split(" ")[0];
  }, [user?.displayName, user?.email]);

  const handleLogout = async () => {
    await logOut();
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <div className="candidate-home">
      <header className="candidate-home__header">
        <div>
          <h1>Welcome, {firstName}</h1>
          <p>Choose how you want to use the platform today.</p>
        </div>
        <button className="candidate-home__logout" onClick={handleLogout}>
          Log Out
        </button>
      </header>

      <main className="candidate-home__grid">
        <section className="candidate-home__card">
          <h2>Practice With AI</h2>
          <p>
            Work on coding problems with AI coaching, hints, test execution, and progress tracking.
            This is untimed practice so you can focus on learning.
          </p>
          <button className="candidate-home__cta candidate-home__cta--primary" onClick={() => navigate("/practice")}>
            Open Practice Workspace
          </button>
        </section>

        <section className="candidate-home__card">
          <h2>Interview Sessions</h2>
          <p>
            Join a live interview session using an invite code shared by an interviewer.
            Use this when you are actively being evaluated.
          </p>
          <button className="candidate-home__cta" onClick={() => navigate("/join")}>
            Join Interview Session
          </button>
        </section>
      </main>
    </div>
  );
}
