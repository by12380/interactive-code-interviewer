// JoinSession – Candidate enters a share code (or lands via /join/:code link).

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { joinSession } from "../services/sessionService.js";
import "../styles/candidate.css";

const ACTIVE_SCREEN_STORAGE_KEY = "activeScreen";

function extractShareCode(value = "") {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const joinIndex = parts.findIndex((part) => part.toLowerCase() === "join");
    const fromPath = joinIndex >= 0 ? parts[joinIndex + 1] : "";
    const fromQuery = url.searchParams.get("code") || "";
    const candidate = fromPath || fromQuery;
    if (candidate) {
      return candidate.toUpperCase().replace(/[^A-Z0-9]/g, "");
    }
  } catch {
    // Not a URL, continue treating as plain code.
  }

  return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function JoinSession() {
  const { code: urlCode } = useParams();
  const navigate = useNavigate();
  const { user, signUp, logIn } = useAuth();

  const [inviteInput, setInviteInput] = useState(urlCode || "");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  // Quick inline auth state
  const [authMode, setAuthMode] = useState("none"); // none | login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (user?.displayName) setDisplayName(user.displayName);
  }, [user?.displayName]);

  const handleJoin = async () => {
    const shareCode = extractShareCode(inviteInput);
    if (!shareCode) {
      setError("Paste your invite link or session code.");
      return;
    }
    setJoining(true);
    setError("");
    try {
      const { session, candidateId } = await joinSession(shareCode, {
        userId: user?.uid || null,
        displayName: displayName || "Anonymous",
      });
      localStorage.setItem(ACTIVE_SCREEN_STORAGE_KEY, "interview");
      // Navigate into the coding view
      navigate(`/session/${session.id}/${candidateId}`);
    } catch (e) {
      setError(e.message || "Could not join session.");
    }
    setJoining(false);
  };

  const handleAuth = async () => {
    setAuthError("");
    try {
      if (authMode === "signup") {
        await signUp({ email, password, displayName, role: "candidate" });
      } else {
        await logIn({ email, password });
      }
      setAuthMode("none");
    } catch (e) {
      setAuthError(e.message || "Auth failed");
    }
  };

  return (
    <div className="cs-join">
      <div className="cs-join__card">
        <h1>Join Interview</h1>
        <p className="cs-muted">Paste the invite link from your interviewer, or enter the session code.</p>

        <label className="cs-label">Invite Link or Session Code</label>
        <input
          className="cs-input cs-input--lg"
          value={inviteInput}
          onChange={(e) => setInviteInput(e.target.value)}
          placeholder="https://.../join/A3XK7P or A3XK7P"
        />

        <label className="cs-label">Your Name</label>
        <input
          className="cs-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name"
        />

        {!user && (
          <div className="cs-auth-inline">
            <p className="cs-muted">Optional: sign in to save your results.</p>
            {authMode === "none" ? (
              <div className="cs-row">
                <button className="cs-btn cs-btn--sm" onClick={() => setAuthMode("login")}>Log In</button>
                <button className="cs-btn cs-btn--sm" onClick={() => setAuthMode("signup")}>Sign Up</button>
              </div>
            ) : (
              <div className="cs-auth-form">
                <input className="cs-input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="cs-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                {authError && <p className="cs-error">{authError}</p>}
                <div className="cs-row">
                  <button className="cs-btn cs-btn--primary cs-btn--sm" onClick={handleAuth}>{authMode === "signup" ? "Sign Up" : "Log In"}</button>
                  <button className="cs-btn cs-btn--sm" onClick={() => setAuthMode("none")}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="cs-error">{error}</p>}

        <button className="cs-btn cs-btn--primary cs-btn--lg" onClick={handleJoin} disabled={joining}>
          {joining ? "Joining..." : "Join Session"}
        </button>

        <button className="cs-btn cs-btn--ghost" onClick={() => navigate("/")}>
          Back to Practice Mode
        </button>
      </div>
    </div>
  );
}
