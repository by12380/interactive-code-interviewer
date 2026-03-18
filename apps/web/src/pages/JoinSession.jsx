// JoinSession – Candidate enters a share code, pastes a link, or lands via /join/:code.

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { joinSession, lookupSessionByCode } from "../services/sessionService.js";
import "../styles/candidate.css";

function formatCountdown(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

/**
 * Extract a share code from user input. Handles:
 *   - Plain code: "A3XK7P"
 *   - Full URL:   "http://localhost:5173/join/A3XK7P"
 *   - Partial:    "/join/A3XK7P"
 */
function extractShareCode(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";

  // Try to match /join/<CODE> in a URL or path
  const urlMatch = trimmed.match(/\/join\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1].toUpperCase();

  // Otherwise treat the whole input as a code (strip non-alphanumeric)
  return trimmed.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export default function JoinSession() {
  const { code: urlCode } = useParams();
  const navigate = useNavigate();
  const { user, signUp, logIn } = useAuth();

  const [rawInput, setRawInput] = useState(urlCode || "");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  // Schedule gating
  const [sessionMeta, setSessionMeta] = useState(null);
  const [scheduleChecked, setScheduleChecked] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const timerRef = useRef(null);

  // Quick inline auth state
  const [authMode, setAuthMode] = useState("none"); // none | login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Derived share code (extracted from URL or raw input)
  const shareCode = extractShareCode(rawInput);

  useEffect(() => {
    if (user?.displayName) setDisplayName(user.displayName);
  }, [user?.displayName]);

  // Look up session metadata when share code is valid (6 chars)
  useEffect(() => {
    if (shareCode.length < 4) {
      setSessionMeta(null);
      setScheduleChecked(false);
      return;
    }
    let cancelled = false;
    lookupSessionByCode(shareCode)
      .then((meta) => {
        if (!cancelled) {
          setSessionMeta(meta);
          setScheduleChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessionMeta(null);
          setScheduleChecked(true);
        }
      });
    return () => { cancelled = true; };
  }, [shareCode]);

  // Countdown timer for scheduled sessions
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!sessionMeta?.scheduledAt) {
      setTimeRemaining(null);
      return;
    }
    const target = new Date(sessionMeta.scheduledAt).getTime();
    const EARLY_BUFFER_MS = 5 * 60 * 1000; // allow joining 5 min early

    const tick = () => {
      const diff = target - EARLY_BUFFER_MS - Date.now();
      setTimeRemaining(diff > 0 ? diff : 0);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [sessionMeta?.scheduledAt]);

  const isScheduled = !!sessionMeta?.scheduledAt;
  const canJoinNow = !isScheduled || timeRemaining === 0;

  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    // If user pastes a full URL, extract code immediately for display
    if (val.includes("/join/")) {
      const code = extractShareCode(val);
      setRawInput(code);
    } else {
      setRawInput(val.toUpperCase());
    }
  }, []);

  const handlePaste = useCallback((e) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted.includes("/join/")) {
      e.preventDefault();
      const code = extractShareCode(pasted);
      setRawInput(code);
    }
  }, []);

  const handleJoin = async () => {
    if (!shareCode) { setError("Enter a session code or paste the invite link."); return; }
    setJoining(true);
    setError("");
    try {
      const { session, candidateId } = await joinSession(shareCode, {
        userId: user?.uid || null,
        displayName: displayName || "Anonymous",
      });
      navigate(`/session/${session.id}/${candidateId}`);
    } catch (e) {
      setError(e.message || "Could not join session.");
    }
    setJoining(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleJoin();
    }
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
        <div className="cs-join__header">
          <div className="cs-join__icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </div>
          <h1>Join Interview</h1>
          <p className="cs-muted">
            Paste the invite link or enter the session code from your interviewer.
          </p>
        </div>

        <label className="cs-label">Invite Link or Session Code</label>
        <input
          className="cs-input cs-input--lg"
          value={rawInput}
          onChange={handleInputChange}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder="Paste link or code"
          autoFocus
        />
        {shareCode && rawInput !== shareCode && (
          <p className="cs-extracted-code">
            Detected code: <strong>{shareCode}</strong>
          </p>
        )}

        <label className="cs-label">Your Name</label>
        <input
          className="cs-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={handleKeyDown}
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

        {scheduleChecked && isScheduled && (
          <div className="cs-schedule-banner" style={{
            background: canJoinNow ? "#f0fdf4" : "#fef3c7",
            border: `1px solid ${canJoinNow ? "#bbf7d0" : "#fde68a"}`,
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 12,
            textAlign: "center",
          }}>
            <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 14, color: canJoinNow ? "#166534" : "#92400e" }}>
              {canJoinNow ? "The interview is ready — you may join now!" : "This interview is scheduled for:"}
            </p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
              {new Date(sessionMeta.scheduledAt).toLocaleString(undefined, {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
                hour: "numeric", minute: "2-digit", hour12: true,
              })}
            </p>
            {!canJoinNow && timeRemaining != null && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#92400e" }}>
                Opens in {formatCountdown(timeRemaining)}
              </p>
            )}
          </div>
        )}

        <button
          className="cs-btn cs-btn--primary cs-btn--lg"
          onClick={handleJoin}
          disabled={joining || !shareCode || (scheduleChecked && isScheduled && !canJoinNow)}
        >
          {joining
            ? "Joining..."
            : scheduleChecked && isScheduled && !canJoinNow
              ? "Not Yet Available"
              : "Join Session"}
        </button>

        <button className="cs-btn cs-btn--ghost" onClick={() => navigate("/home")}>
          &larr; Back to Home
        </button>
      </div>
    </div>
  );
}
