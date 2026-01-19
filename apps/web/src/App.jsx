import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { sendChat } from "./api.js";
import TutorialOverlay from "./TutorialOverlay.jsx";
import { getCurrentUserId, getUserById, loadUsers, logIn, logOut, signUp } from "./auth.js";
import { loadUserState, saveUserJson } from "./userData.js";
import { randomId } from "./storage.js";
import { analyzeCodeForInterruptions } from "./codeAnalysis.js";

const PROBLEMS = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    functionName: "twoSum",
    signature: "twoSum(nums, target)",
    description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input has exactly one solution, and you may not use the same element twice.

Return the answer in any order.`,
    examples: [
      {
        input: { nums: [2, 7, 11, 15], target: 9 },
        output: [0, 1],
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
      },
      {
        input: { nums: [3, 2, 4], target: 6 },
        output: [1, 2]
      }
    ],
    tests: [
      { name: "Example #1", args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { name: "Example #2", args: [[3, 2, 4], 6], expected: [1, 2] },
      { name: "Negatives", args: [[-3, 4, 3, 90], 0], expected: [0, 2] }
    ],
    hints: [
      "Brute force is O(n^2): check all pairs.",
      "Use a hash map from value → index as you scan once.",
      "For each x, look for (target - x) in the map before inserting x."
    ],
    solution: `function twoSum(nums, target) {
  const seen = new Map(); // value -> index
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}`
  },
  {
    id: "valid-anagram",
    title: "Valid Anagram",
    difficulty: "Easy",
    functionName: "isAnagram",
    signature: "isAnagram(s, t)",
    description: `Given two strings s and t, return true if t is an anagram of s, and false otherwise.

An anagram is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.`,
    examples: [
      { input: { s: "anagram", t: "nagaram" }, output: true },
      { input: { s: "rat", t: "car" }, output: false }
    ],
    tests: [
      { name: "True case", args: ["anagram", "nagaram"], expected: true },
      { name: "False case", args: ["rat", "car"], expected: false },
      { name: "Unicode-ish", args: ["aá", "áa"], expected: true }
    ],
    hints: [
      "If lengths differ, it can't be an anagram.",
      "Count character frequencies for s, decrement for t.",
      "All counts must end at zero."
    ],
    solution: `function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) || 0) + 1);
  for (const ch of t) {
    const next = (counts.get(ch) || 0) - 1;
    if (next < 0) return false;
    counts.set(ch, next);
  }
  return true;
}`
  },
  {
    id: "longest-substring",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    functionName: "lengthOfLongestSubstring",
    signature: "lengthOfLongestSubstring(s)",
    description: `Given a string s, find the length of the longest substring without repeating characters.`,
    examples: [
      { input: { s: "abcabcbb" }, output: 3, explanation: 'The answer is "abc", with the length of 3.' },
      { input: { s: "bbbbb" }, output: 1 },
      { input: { s: "pwwkew" }, output: 3, explanation: 'The answer is "wke", with the length of 3.' }
    ],
    tests: [
      { name: "Example #1", args: ["abcabcbb"], expected: 3 },
      { name: "All same", args: ["bbbbb"], expected: 1 },
      { name: "Mixed", args: ["pwwkew"], expected: 3 },
      { name: "Empty", args: [""], expected: 0 }
    ],
    hints: [
      "Use a sliding window with two pointers.",
      "Track the last seen index of each character.",
      "When you see a repeat, move the left pointer to lastSeen + 1."
    ],
    solution: `function lengthOfLongestSubstring(s) {
  let left = 0;
  let best = 0;
  const lastSeen = new Map(); // char -> index
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (lastSeen.has(ch)) {
      left = Math.max(left, lastSeen.get(ch) + 1);
    }
    lastSeen.set(ch, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}`
  }
];

const DEFAULT_PROBLEM_ID = PROBLEMS[0]?.id ?? "two-sum";
const buildStarterCode = (problem) =>
  `function ${problem.functionName}${problem.signature.replace(problem.functionName, "")} {\n  // Your solution here\n}\n`;

function safeStringify(value) {
  try {
    const seen = new WeakSet();
    return JSON.stringify(
      value,
      (key, val) => {
        if (typeof val === "function") return "[Function]";
        if (typeof val === "symbol") return String(val);
        if (val && typeof val === "object") {
          if (seen.has(val)) return "[Circular]";
          seen.add(val);
        }
        return val;
      },
      2
    );
  } catch (e) {
    try {
      return String(value);
    } catch (e2) {
      return "[Unserializable]";
    }
  }
}

function prettyValue(value) {
  if (typeof value === "string") return value;
  return safeStringify(value);
}

function formatClock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function Modal({ isOpen, title, children, onClose }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="ici-modal" role="dialog" aria-modal="true">
      <div className="ici-modal__backdrop" onClick={() => onClose?.()} />
      <div className="ici-modal__panel">
        <div className="ici-modal__header">
          <div className="ici-modal__title">{title}</div>
          <button
            type="button"
            className="ici-modal__close"
            onClick={() => onClose?.()}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="ici-modal__body">{children}</div>
      </div>
    </div>
  );
}

function AuthModal({ isOpen, onClose, onAuthed }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setIsWorking(false);
  }, [isOpen]);

  const submit = async () => {
    setError("");
    setIsWorking(true);
    try {
      const res =
        mode === "signup"
          ? await signUp({ email, username, password })
          : await logIn({ email, password });
      if (!res?.ok || !res?.user) {
        setError(res?.error || "Unable to authenticate.");
        return;
      }
      onAuthed?.(res.user);
      onClose?.();
    } catch (e) {
      setError(e?.message || "Unable to authenticate.");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={mode === "signup" ? "Create account" : "Log in"}
      onClose={onClose}
    >
      <div className="auth">
        <div className="auth__tabs" role="tablist" aria-label="Authentication">
          <button
            type="button"
            className={`auth__tab ${mode === "login" ? "is-active" : ""}`}
            onClick={() => setMode("login")}
          >
            Log in
          </button>
          <button
            type="button"
            className={`auth__tab ${mode === "signup" ? "is-active" : ""}`}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>

        {error && <div className="auth__error">{error}</div>}

        <label className="auth__field">
          <span>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        {mode === "signup" && (
          <label className="auth__field">
            <span>Display name</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Austin"
              autoComplete="nickname"
            />
          </label>
        )}

        <label className="auth__field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </label>

        <div className="auth__actions">
          <button
            type="button"
            className="auth__primary"
            onClick={submit}
            disabled={isWorking}
          >
            {isWorking ? "Working..." : mode === "signup" ? "Create account" : "Log in"}
          </button>
          <button type="button" className="auth__ghost" onClick={onClose} disabled={isWorking}>
            Cancel
          </button>
        </div>

        <div className="auth__note">
          This is a prototype: accounts are stored in <code>localStorage</code> on this device only.
        </div>
      </div>
    </Modal>
  );
}

function ProfileModal({
  isOpen,
  onClose,
  user,
  storageUserId,
  problems,
  solvedByProblemId,
  attemptStartedAtByProblemId,
  bestTimeSecondsByProblemId,
  history,
  onLogOut
}) {
  const attemptedSet = useMemo(() => {
    const out = new Set();
    for (const k of Object.keys(attemptStartedAtByProblemId || {})) out.add(k);
    for (const k of Object.keys(solvedByProblemId || {})) out.add(k);
    return out;
  }, [attemptStartedAtByProblemId, solvedByProblemId]);

  const attemptedCount = attemptedSet.size;
  const completedCount = Object.values(solvedByProblemId || {}).filter(Boolean).length;
  const rate = attemptedCount > 0 ? Math.round((completedCount / attemptedCount) * 100) : 0;

  return (
    <Modal isOpen={isOpen} title="Profile" onClose={onClose}>
      <div className="profile">
        <div className="profile__top">
          <div>
            <div className="profile__name">{user ? user.username : "Guest"}</div>
            <div className="profile__sub">
              {user?.email ? user.email : `Local-only progress (${storageUserId})`}
            </div>
          </div>
          <div className="profile__actions">
            {user ? (
              <button type="button" className="profile__btn profile__btn--danger" onClick={onLogOut}>
                Log out
              </button>
            ) : null}
          </div>
        </div>

        <div className="profile__stats">
          <div className="profile__stat">
            <div className="profile__stat-k">Attempted</div>
            <div className="profile__stat-v">{attemptedCount}</div>
          </div>
          <div className="profile__stat">
            <div className="profile__stat-k">Completed</div>
            <div className="profile__stat-v">{completedCount}</div>
          </div>
          <div className="profile__stat">
            <div className="profile__stat-k">Completion</div>
            <div className="profile__stat-v">{rate}%</div>
          </div>
        </div>

        <div className="profile__section">
          <div className="profile__section-title">Problems</div>
          <div className="profile__problems">
            {problems.map((p) => {
              const attempted = attemptedSet.has(p.id);
              const solved = Boolean(solvedByProblemId?.[p.id]);
              const best = bestTimeSecondsByProblemId?.[p.id];
              return (
                <div key={p.id} className="profile__problem">
                  <div className="profile__problem-left">
                    <div className="profile__problem-title">{p.title}</div>
                    <div className="profile__problem-meta">
                      {attempted ? "Attempted" : "Not attempted"} · {solved ? "Completed" : "Not completed"}
                    </div>
                  </div>
                  <div className="profile__problem-right">
                    <div className={`profile__pill ${solved ? "profile__pill--ok" : ""}`}>
                      {solved ? "Solved" : "—"}
                    </div>
                    <div className="profile__best">
                      Best: {typeof best === "number" ? formatClock(best) : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="profile__section">
          <div className="profile__section-title">Interview history</div>
          {history.length === 0 ? (
            <div className="profile__empty">No sessions yet.</div>
          ) : (
            <div className="profile__history">
              {history.slice(0, 25).map((h) => (
                <div key={h.id} className="profile__history-row">
                  <div className="profile__history-main">
                    <div className="profile__history-title">{h.problemTitle || h.problemId}</div>
                    <div className="profile__history-meta">
                      {h.outcome || "session"} · {typeof h.durationSeconds === "number" ? formatClock(h.durationSeconds) : "—"} ·{" "}
                      {h.testsTotal ? `${h.testsPassed}/${h.testsTotal} tests` : "no tests"}
                    </div>
                  </div>
                  <div className="profile__history-side">
                    <div className="profile__pill">{h.difficulty || "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {history.length > 25 && (
            <div className="profile__note">Showing latest 25 entries.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function LeaderboardModal({ isOpen, onClose, problems, initialProblemId }) {
  const [selectedProblemId, setSelectedProblemId] = useState(
    initialProblemId || problems?.[0]?.id || ""
  );

  useEffect(() => {
    if (!isOpen) return;
    setSelectedProblemId(initialProblemId || problems?.[0]?.id || "");
  }, [isOpen, initialProblemId, problems]);

  const rows = useMemo(() => {
    const problemId = String(selectedProblemId || "");
    if (!problemId) return [];

    const users = loadUsers();
    const competitors = [];

    // Registered users
    for (const u of users) {
      if (!u?.id) continue;
      const state = loadUserState(String(u.id));
      const t = state?.bestTimeSecondsByProblemId?.[problemId];
      if (typeof t !== "number") continue;
      competitors.push({
        key: `user:${u.id}`,
        name: u.username || u.email || String(u.id),
        bestSeconds: t
      });
    }

    // Guest (device-local)
    const guestState = loadUserState("guest");
    const guestT = guestState?.bestTimeSecondsByProblemId?.[problemId];
    if (typeof guestT === "number") {
      competitors.push({
        key: "guest",
        name: "Guest",
        bestSeconds: guestT
      });
    }

    competitors.sort((a, b) => a.bestSeconds - b.bestSeconds);
    return competitors.map((c, idx) => ({ ...c, rank: idx + 1 })).slice(0, 20);
  }, [selectedProblemId, isOpen]);

  const selectedProblem = problems.find((p) => p.id === selectedProblemId) || null;

  return (
    <Modal isOpen={isOpen} title="Leaderboards" onClose={onClose}>
      <div className="leaderboard">
        <div className="leaderboard__top">
          <div className="leaderboard__picker">
            <div className="leaderboard__label">Problem</div>
            <select
              className="leaderboard__select"
              value={selectedProblemId}
              onChange={(e) => setSelectedProblemId(e.target.value)}
              aria-label="Select problem leaderboard"
            >
              {problems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="leaderboard__note">
            Device-only: compares users stored in <code>localStorage</code> on this browser.
          </div>
        </div>

        <div className="leaderboard__table">
          <div className="leaderboard__head">
            <div>#</div>
            <div>User</div>
            <div>Best time</div>
          </div>

          {rows.length === 0 ? (
            <div className="leaderboard__empty">
              No times yet for {selectedProblem?.title || "this problem"}. Solve it to appear here.
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.key} className="leaderboard__row">
                <div className="leaderboard__rank">{r.rank}</div>
                <div className="leaderboard__user">{r.name}</div>
                <div className="leaderboard__time">{formatClock(r.bestSeconds)}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function App() {
  const [currentUserId, setCurrentUserIdState] = useState(() => getCurrentUserId());
  const [currentUser, setCurrentUser] = useState(() => getUserById(getCurrentUserId()));
  const storageUserId = currentUserId || "guest";
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  const [activeProblemId, setActiveProblemId] = useState(() => {
    try {
      const saved = localStorage.getItem("ici.activeProblemId");
      return saved || DEFAULT_PROBLEM_ID;
    } catch {
      return DEFAULT_PROBLEM_ID;
    }
  });
  const [codeByProblemId, setCodeByProblemId] = useState(() => {
    return loadUserState(storageUserId).codeByProblemId;
  });
  const [solvedByProblemId, setSolvedByProblemId] = useState(() => {
    return loadUserState(storageUserId).solvedByProblemId;
  });
  const [testRunByProblemId, setTestRunByProblemId] = useState(() => {
    return loadUserState(storageUserId).testRunByProblemId;
  });
  const [attemptStartedAtByProblemId, setAttemptStartedAtByProblemId] = useState(() => {
    return loadUserState(storageUserId).attemptStartedAtByProblemId;
  });
  const [bestTimeSecondsByProblemId, setBestTimeSecondsByProblemId] = useState(() => {
    return loadUserState(storageUserId).bestTimeSecondsByProblemId;
  });
  const [history, setHistory] = useState(() => {
    return loadUserState(storageUserId).history;
  });

  useEffect(() => {
    setCurrentUser(currentUserId ? getUserById(currentUserId) : null);
  }, [currentUserId]);

  useEffect(() => {
    const next = loadUserState(storageUserId);
    setCodeByProblemId(next.codeByProblemId);
    setSolvedByProblemId(next.solvedByProblemId);
    setTestRunByProblemId(next.testRunByProblemId);
    setAttemptStartedAtByProblemId(next.attemptStartedAtByProblemId);
    setBestTimeSecondsByProblemId(next.bestTimeSecondsByProblemId);
    setHistory(next.history);
  }, [storageUserId]);

  useEffect(() => {
    // Backwards compat: migrate old non-user-scoped keys into the guest profile once.
    if (storageUserId !== "guest") return;

    const guest = loadUserState("guest");
    const isGuestEmpty =
      Object.keys(guest.codeByProblemId || {}).length === 0 &&
      Object.keys(guest.solvedByProblemId || {}).length === 0 &&
      Object.keys(guest.testRunByProblemId || {}).length === 0;
    if (!isGuestEmpty) return;

    const readLegacy = (key) => {
      try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch {
        return null;
      }
    };

    const legacyCode = readLegacy("ici.codeByProblemId");
    const legacySolved = readLegacy("ici.solvedByProblemId");
    const legacyTestRun = readLegacy("ici.testRunByProblemId");

    if (legacyCode) {
      setCodeByProblemId(legacyCode);
      saveUserJson("guest", "codeByProblemId", legacyCode);
    }
    if (legacySolved) {
      setSolvedByProblemId(legacySolved);
      saveUserJson("guest", "solvedByProblemId", legacySolved);
    }
    if (legacyTestRun) {
      setTestRunByProblemId(legacyTestRun);
      saveUserJson("guest", "testRunByProblemId", legacyTestRun);
    }
  }, [storageUserId]);

  const activeProblem = useMemo(() => {
    const found = PROBLEMS.find((p) => p.id === activeProblemId);
    return found || PROBLEMS[0];
  }, [activeProblemId]);

  const code = useMemo(() => {
    const stored = codeByProblemId?.[activeProblem?.id];
    if (typeof stored === "string") return stored;
    if (activeProblem) return buildStarterCode(activeProblem);
    return "";
  }, [activeProblem, codeByProblemId]);
  const setCode = (nextCode) => {
    setCodeByProblemId((prev) => {
      const next = { ...(prev || {}), [activeProblem.id]: nextCode };
      return next;
    });
  };

  const [problemTab, setProblemTab] = useState("Description");
  const [revealedHintCount, setRevealedHintCount] = useState(() => ({}));
  const [isSolutionVisible, setIsSolutionVisible] = useState(false);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [difficulty, setDifficulty] = useState("Medium");
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [consoleEntries, setConsoleEntries] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [liveInterruption, setLiveInterruption] = useState(null); // { message, ts }
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "I can review your approach as you code. Ask questions or paste ideas here."
    }
  ]);
  const lastProactiveHintRef = useRef("");
  const proactiveInFlightRef = useRef(false);
  const lastProactiveCodeRef = useRef("");
  const lastProactiveAtRef = useRef(0);
  const lastInterruptByIdRef = useRef(new Map()); // id -> last timestamp
  const lastInterruptTextRef = useRef("");
  const hasUserExplainedApproachRef = useRef(false);
  const lastCodeSentRef = useRef("");
  const llmMessagesRef = useRef([]);
  const startAtRef = useRef(Date.now());
  const runnerIframeRef = useRef(null);
  const runIdRef = useRef(0);
  const chatEndRef = useRef(null);
  const storageUserIdRef = useRef(storageUserId);
  const solvedByProblemIdRef = useRef(solvedByProblemId);
  const attemptStartedAtByProblemIdRef = useRef(attemptStartedAtByProblemId);
  const bestTimeSecondsByProblemIdRef = useRef(bestTimeSecondsByProblemId);
  const testRunByProblemIdRef = useRef(testRunByProblemId);
  const codeByProblemIdRef = useRef(codeByProblemId);
  const historyRef = useRef(history);
  const difficultyRef = useRef(difficulty);
  const stopOnceRef = useRef(false);

  useEffect(() => {
    storageUserIdRef.current = storageUserId;
  }, [storageUserId]);
  useEffect(() => {
    solvedByProblemIdRef.current = solvedByProblemId;
  }, [solvedByProblemId]);
  useEffect(() => {
    attemptStartedAtByProblemIdRef.current = attemptStartedAtByProblemId;
  }, [attemptStartedAtByProblemId]);
  useEffect(() => {
    bestTimeSecondsByProblemIdRef.current = bestTimeSecondsByProblemId;
  }, [bestTimeSecondsByProblemId]);
  useEffect(() => {
    testRunByProblemIdRef.current = testRunByProblemId;
  }, [testRunByProblemId]);
  useEffect(() => {
    codeByProblemIdRef.current = codeByProblemId;
  }, [codeByProblemId]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  useEffect(() => {
    // Auto-scroll chat to the latest message (especially important for interruptions).
    // If the user scrolls up manually this is still fairly gentle since it only scrolls to the end node.
    chatEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length]);
  useEffect(() => {
    if (!isLocked) {
      stopOnceRef.current = false;
    }
  }, [isLocked]);

  const TOTAL_SECONDS = 30 * 60;
  const remainingSeconds = Math.max(TOTAL_SECONDS - elapsedSeconds, 0);
  const isTimeUp = elapsedSeconds >= TOTAL_SECONDS;

  const runnerSrcDoc = useMemo(
    () => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>JS Runner</title>
  </head>
  <body>
    <script>
      (function () {
        var MARKER = "__ICIRunner__";
        var currentRunId = 0;

        function safeStringify(value) {
          try {
            var seen = new WeakSet();
            return JSON.stringify(
              value,
              function (key, val) {
                if (typeof val === "function") return "[Function]";
                if (typeof val === "symbol") return String(val);
                if (val && typeof val === "object") {
                  if (seen.has(val)) return "[Circular]";
                  seen.add(val);
                }
                return val;
              },
              2
            );
          } catch (e) {
            try {
              return String(value);
            } catch (e2) {
              return "[Unserializable]";
            }
          }
        }

        function formatArg(arg) {
          if (typeof arg === "string") return arg;
          if (arg instanceof Error) return arg.stack || arg.message || String(arg);
          if (arg === undefined) return "undefined";
          if (arg === null) return "null";
          return safeStringify(arg);
        }

        function postToParent(payload) {
          try {
            window.parent.postMessage(Object.assign({ [MARKER]: true }, payload), "*");
          } catch (e) {
            // ignore
          }
        }

        function emitConsole(level, args) {
          postToParent({
            type: "CONSOLE",
            level: level,
            runId: currentRunId,
            text: Array.prototype.map.call(args, formatArg).join(" ")
          });
        }

        var originalConsole = window.console || {};
        ["log", "info", "warn", "error", "debug"].forEach(function (level) {
          var original = originalConsole[level] ? originalConsole[level].bind(originalConsole) : null;
          window.console[level] = function () {
            emitConsole(level, arguments);
            try {
              if (original) original.apply(null, arguments);
            } catch (e) {
              // ignore
            }
          };
        });

        window.onerror = function (message, source, lineno, colno, error) {
          postToParent({
            type: "CONSOLE",
            level: "error",
            runId: currentRunId,
            text: (error && (error.stack || error.message)) ? String(error.stack || error.message) : String(message)
          });
        };

        window.onunhandledrejection = function (event) {
          var reason = event && event.reason;
          postToParent({
            type: "CONSOLE",
            level: "error",
            runId: currentRunId,
            text: (reason && reason.stack) ? String(reason.stack) : formatArg(reason)
          });
        };

        window.addEventListener("message", async function (event) {
          var data = event && event.data;
          if (!data || data[MARKER] !== true) return;

          if (data.type === "RUN") {
            currentRunId = data.runId || 0;
            postToParent({ type: "STATUS", status: "START", runId: currentRunId });
            try {
              var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
              var fn = new AsyncFunction('"use strict";\\n' + String(data.code || ""));
              await fn();
            } catch (err) {
              emitConsole("error", [err]);
            } finally {
              postToParent({ type: "STATUS", status: "DONE", runId: currentRunId });
            }
          }
        });
      })();
    </script>
  </body>
</html>`,
    []
  );

  useEffect(() => {
    const handleMessage = (event) => {
      const iframeWindow = runnerIframeRef.current?.contentWindow;
      if (!iframeWindow || event.source !== iframeWindow) {
        return;
      }

      const data = event.data;
      if (!data || data.__ICIRunner__ !== true) {
        return;
      }

      if (data.type === "CONSOLE") {
        setConsoleEntries((prev) => [
          ...prev,
          {
            id: `${data.runId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            ts: Date.now(),
            runId: data.runId,
            level: data.level || "log",
            text: String(data.text ?? "")
          }
        ]);
        return;
      }

      if (data.type === "STATUS") {
        if (data.status === "START") {
          setIsRunning(true);
        }
        if (data.status === "DONE") {
          setIsRunning(false);
        }
      }

      if (data.type === "TEST_RESULTS") {
        const payload = data.payload || {};
        const problemId = String(payload.problemId || "");
        if (!problemId) return;

        setTestRunByProblemId((prev) => {
          const next = { ...(prev || {}), [problemId]: payload };
          return next;
        });

        const passed = Number(payload?.summary?.passed || 0);
        const total = Number(payload?.summary?.total || 0);
        const isPassing = total > 0 && passed === total;

        if (isPassing) {
          const wasSolved = Boolean(solvedByProblemIdRef.current?.[problemId]);

          setSolvedByProblemId((prev) => {
            const next = { ...(prev || {}), [problemId]: true };
            return next;
          });

          if (!wasSolved) {
            const endedAt = Date.now();
            const startedAtRaw = attemptStartedAtByProblemIdRef.current?.[problemId];
            const startedAt =
              typeof startedAtRaw === "number" && Number.isFinite(startedAtRaw)
                ? startedAtRaw
                : endedAt;
            const durationSeconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));

            setAttemptStartedAtByProblemId((prev) => {
              if (prev?.[problemId]) return prev;
              return { ...(prev || {}), [problemId]: startedAt };
            });

            setBestTimeSecondsByProblemId((prev) => {
              const currentBest = prev?.[problemId];
              const nextBest =
                typeof currentBest === "number" ? Math.min(currentBest, durationSeconds) : durationSeconds;
              return { ...(prev || {}), [problemId]: nextBest };
            });

            const problem = PROBLEMS.find((p) => p.id === problemId);
            const entry = {
              id: randomId("session"),
              createdAt: endedAt,
              startedAt,
              endedAt,
              durationSeconds,
              outcome: "solved",
              problemId,
              problemTitle: problem?.title || problemId,
              difficulty: difficultyRef.current,
              testsPassed: passed,
              testsTotal: total,
              codeSnapshot: String(codeByProblemIdRef.current?.[problemId] || "")
            };
            setHistory((prev) => [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 200));
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const tutorialSteps = useMemo(
    () => [
      {
        targetSelector: '[data-tutorial="difficulty"]',
        title: "Difficulty",
        body:
          "Use this to set the interview difficulty. You can lock it once the interview starts so requirements stay consistent.",
        highlightPadding: 10,
        highlightRadius: 16
      },
      {
        targetSelector: '[data-tutorial="timer"]',
        title: "Timer + Stop",
        body:
          "This tracks how much time is left. When you hit Stop (or time runs out), the interview can be locked to simulate a real session.",
        highlightPadding: 10,
        highlightRadius: 16
      },
      {
        targetSelector: '[data-tutorial="editor"]',
        title: "Code editor",
        body:
          "This is where you solve the problem. Your code can be shared with the AI coach for feedback while you type.",
        highlightPadding: 10,
        highlightRadius: 18
      },
      {
        targetSelector: '[data-tutorial="coach"]',
        title: "AI Interview Coach",
        body:
          "Ask questions, explain your approach, or request hints. The coach can also send proactive feedback based on your latest code changes.",
        highlightPadding: 10,
        highlightRadius: 18
      }
    ],
    []
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldAutoStart = params.get("tutorial") === "1";
    if (shouldAutoStart) {
      setIsTutorialOpen(true);
      setTutorialStepIndex(0);
    }
  }, []);

  const editorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 14,
      scrollBeyondLastLine: false,
      wordWrap: "on",
      readOnly: isLocked
    }),
    [isLocked]
  );

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const stopInterview = (outcome = "stopped") => {
    if (stopOnceRef.current) return;
    stopOnceRef.current = true;

    const endedAt = Date.now();
    const problemId = String(activeProblem?.id || "");
    const problemTitle = String(activeProblem?.title || problemId);
    if (!problemId) {
      setIsLocked(true);
      return;
    }

    const startedAtRaw = attemptStartedAtByProblemIdRef.current?.[problemId];
    const startedAt =
      typeof startedAtRaw === "number" && Number.isFinite(startedAtRaw)
        ? startedAtRaw
        : endedAt;
    const durationSeconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));

    const summary = testRunByProblemIdRef.current?.[problemId]?.summary || null;
    const testsPassed = Number(summary?.passed || 0);
    const testsTotal = Number(summary?.total || 0);

    const entry = {
      id: randomId("session"),
      createdAt: endedAt,
      startedAt,
      endedAt,
      durationSeconds,
      outcome: String(outcome || "stopped"),
      problemId,
      problemTitle,
      difficulty: difficultyRef.current,
      testsPassed: testsTotal ? testsPassed : 0,
      testsTotal: testsTotal || 0,
      codeSnapshot: String(codeByProblemIdRef.current?.[problemId] || "")
    };

    setAttemptStartedAtByProblemId((prev) => {
      if (prev?.[problemId]) return prev;
      return { ...(prev || {}), [problemId]: startedAt };
    });
    setHistory((prev) => [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 200));
    setIsLocked(true);
  };

  useEffect(() => {
    if (isTimeUp && !isLocked) {
      stopInterview("timeout");
    }
  }, [isTimeUp, isLocked]);

  const buildCodeMessage = (nextCode) => ({
    role: "user",
    content: `[code update]\n${nextCode || "// No code provided"}`
  });

  useEffect(() => {
    try {
      localStorage.setItem("ici.activeProblemId", activeProblemId);
    } catch {
      // ignore
    }
  }, [activeProblemId]);

  useEffect(() => {
    saveUserJson(storageUserId, "codeByProblemId", codeByProblemId || {});
  }, [storageUserId, codeByProblemId]);

  useEffect(() => {
    saveUserJson(storageUserId, "solvedByProblemId", solvedByProblemId || {});
  }, [storageUserId, solvedByProblemId]);

  useEffect(() => {
    saveUserJson(storageUserId, "testRunByProblemId", testRunByProblemId || {});
  }, [storageUserId, testRunByProblemId]);

  useEffect(() => {
    saveUserJson(storageUserId, "attemptStartedAtByProblemId", attemptStartedAtByProblemId || {});
  }, [storageUserId, attemptStartedAtByProblemId]);

  useEffect(() => {
    saveUserJson(storageUserId, "bestTimeSecondsByProblemId", bestTimeSecondsByProblemId || {});
  }, [storageUserId, bestTimeSecondsByProblemId]);

  useEffect(() => {
    saveUserJson(storageUserId, "history", history || []);
  }, [storageUserId, history]);

  useEffect(() => {
    setProblemTab("Description");
    setIsSolutionVisible(false);
  }, [activeProblemId]);

  useEffect(() => {
    if (isLocked) return;
    if (!activeProblemId) return;
    setAttemptStartedAtByProblemId((prev) => {
      const existing = prev?.[activeProblemId];
      if (existing) return prev;
      return { ...(prev || {}), [activeProblemId]: Date.now() };
    });
  }, [activeProblemId, isLocked]);

  useEffect(() => {
    if (isLocked) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startAtRef.current) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLocked]);

  const appendCodeUpdateIfNeeded = (nextCode, messageList) => {
    if (nextCode === lastCodeSentRef.current) {
      return messageList;
    }

    lastCodeSentRef.current = nextCode;
    return [...messageList, buildCodeMessage(nextCode)];
  };

  // Fast, local interruptions (no API call). Runs frequently with a tight debounce.
  useEffect(() => {
    if (isLocked) return;
    if (!activeProblem) return;

    const debounceMs = 450;
    const timeout = setTimeout(() => {
      const suggestions = analyzeCodeForInterruptions({
        code,
        problem: activeProblem,
        hasUserExplainedApproach: hasUserExplainedApproachRef.current
      });
      if (!suggestions.length) return;

      const now = Date.now();
      const COOLDOWN_PER_RULE_MS = 12_000;

      for (const s of suggestions) {
        const lastTs = lastInterruptByIdRef.current.get(s.id) || 0;
        if (now - lastTs < COOLDOWN_PER_RULE_MS) continue;
        if (lastInterruptTextRef.current === s.message) continue;

        lastInterruptByIdRef.current.set(s.id, now);
        lastInterruptTextRef.current = s.message;

        setMessages((prev) => [...prev, { role: "assistant", content: s.message }]);
        setLiveInterruption({ message: s.message, ts: now });
        llmMessagesRef.current = [
          ...llmMessagesRef.current,
          { role: "assistant", content: s.message }
        ];
        break;
      }
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [code, activeProblem, isLocked]);

  useEffect(() => {
    const debounceMs = 1500;
    const maxWaitMs = 3000;
    const now = Date.now();
    const timeSinceLast = now - lastProactiveAtRef.current;
    const shouldForce = timeSinceLast >= maxWaitMs;
    const delay = shouldForce ? 0 : debounceMs;

    const timeout = setTimeout(async () => {
      if (proactiveInFlightRef.current) {
        return;
      }

      if (code === lastProactiveCodeRef.current) {
        return;
      }

      proactiveInFlightRef.current = true;
      lastProactiveCodeRef.current = code;

      try {
        const nextMessages = appendCodeUpdateIfNeeded(
          code,
          llmMessagesRef.current
        );
        llmMessagesRef.current = nextMessages;

        const data = await sendChat({
          messages: nextMessages,
          mode: "proactive",
          context: {
            problemId: activeProblem?.id,
            title: activeProblem?.title,
            signature: activeProblem?.signature,
            description: activeProblem?.description,
            hints: activeProblem?.hints,
            difficulty: difficultyRef.current
          }
        });
        lastProactiveAtRef.current = Date.now();

        if (!data?.reply) {
          return;
        }

        if (lastProactiveHintRef.current === data.reply) {
          return;
        }

        lastProactiveHintRef.current = data.reply;
        llmMessagesRef.current = [
          ...llmMessagesRef.current,
          { role: "assistant", content: data.reply }
        ];
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply }
        ]);
        // Also surface in the editor area so it's obvious.
        setLiveInterruption({ message: data.reply, ts: Date.now() });
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: ${error.message || "Unable to reach the server."}`
          }
        ]);
      } finally {
        proactiveInFlightRef.current = false;
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [code, activeProblemId]);

  const handleRunCode = () => {
    const iframeWindow = runnerIframeRef.current?.contentWindow;
    if (!iframeWindow) {
      setConsoleEntries((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          ts: Date.now(),
          runId: 0,
          level: "error",
          text: "Runner not ready yet. Please try again in a moment."
        }
      ]);
      return;
    }

    const nextRunId = runIdRef.current + 1;
    runIdRef.current = nextRunId;
    setConsoleEntries((prev) => [
      ...prev,
      {
        id: `system-${nextRunId}-${Date.now()}`,
        ts: Date.now(),
        runId: nextRunId,
        level: "system",
        text: `▶ Run #${nextRunId}`
      }
    ]);

    iframeWindow.postMessage(
      { __ICIRunner__: true, type: "RUN", runId: nextRunId, code },
      "*"
    );
  };

  const handleClearConsole = () => setConsoleEntries([]);

  const buildTestHarness = (problem, runId) => {
    const tests = Array.isArray(problem?.tests) ? problem.tests : [];
    const payload = safeStringify(
      tests.map((t) => ({
        name: String(t.name || ""),
        args: Array.isArray(t.args) ? t.args : [],
        expected: t.expected
      }))
    );

    return `
// --- test harness (generated) ---
function __ici_deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (a === null || b === null) return a === b;
  const ta = typeof a;
  const tb = typeof b;
  if (ta !== tb) return false;
  if (ta !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!__ici_deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  aKeys.sort();
  bKeys.sort();
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
  }
  for (const k of aKeys) {
    if (!__ici_deepEqual(a[k], b[k])) return false;
  }
  return true;
}

(function __ici_runTests() {
  const __ici_problemId = ${JSON.stringify(problem.id)};
  const __ici_functionName = ${JSON.stringify(problem.functionName)};
  const __ici_tests = ${payload};

  const fn = (typeof globalThis !== "undefined" ? globalThis[__ici_functionName] : undefined);
  const results = [];
  let passed = 0;

  if (typeof fn !== "function") {
    console.error(\`Expected a function named "\${__ici_functionName}" to be defined.\`);
    const out = {
      problemId: __ici_problemId,
      functionName: __ici_functionName,
      summary: { passed: 0, total: __ici_tests.length },
      results: __ici_tests.map((t, i) => ({
        index: i,
        name: t.name || \`Test #\${i + 1}\`,
        pass: false,
        error: \`Missing function "\${__ici_functionName}"\`,
        args: t.args,
        expected: t.expected,
        actual: undefined
      }))
    };
    window.parent.postMessage({ __ICIRunner__: true, type: "TEST_RESULTS", runId: ${runId}, payload: out }, "*");
    return;
  }

  for (let i = 0; i < __ici_tests.length; i++) {
    const t = __ici_tests[i];
    try {
      const actual = fn.apply(null, Array.isArray(t.args) ? t.args : []);
      const ok = __ici_deepEqual(actual, t.expected);
      if (ok) passed++;
      results.push({
        index: i,
        name: t.name || \`Test #\${i + 1}\`,
        pass: ok,
        args: t.args,
        expected: t.expected,
        actual
      });
      console.log(\`\${ok ? "PASS" : "FAIL"}: \${t.name || \`Test #\${i + 1}\`}\`);
      if (!ok) {
        console.log("  expected:", t.expected);
        console.log("  received:", actual);
      }
    } catch (err) {
      results.push({
        index: i,
        name: t.name || \`Test #\${i + 1}\`,
        pass: false,
        error: (err && (err.stack || err.message)) ? String(err.stack || err.message) : String(err),
        args: t.args,
        expected: t.expected,
        actual: undefined
      });
      console.log(\`FAIL: \${t.name || \`Test #\${i + 1}\`}\`);
      console.log("  error:", err);
    }
  }

  const out = {
    problemId: __ici_problemId,
    functionName: __ici_functionName,
    summary: { passed, total: __ici_tests.length },
    results
  };
  window.parent.postMessage({ __ICIRunner__: true, type: "TEST_RESULTS", runId: ${runId}, payload: out }, "*");
})();
// --- end test harness ---
`;
  };

  const handleRunTests = () => {
    const iframeWindow = runnerIframeRef.current?.contentWindow;
    if (!iframeWindow) {
      setConsoleEntries((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          ts: Date.now(),
          runId: 0,
          level: "error",
          text: "Runner not ready yet. Please try again in a moment."
        }
      ]);
      return;
    }

    const nextRunId = runIdRef.current + 1;
    runIdRef.current = nextRunId;
    setConsoleEntries((prev) => [
      ...prev,
      {
        id: `system-${nextRunId}-${Date.now()}`,
        ts: Date.now(),
        runId: nextRunId,
        level: "system",
        text: `Tests: ${activeProblem.title}`
      }
    ]);

    const testCode = `${code}\n\n${buildTestHarness(activeProblem, nextRunId)}`;
    iframeWindow.postMessage(
      { __ICIRunner__: true, type: "RUN", runId: nextRunId, code: testCode },
      "*"
    );
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) {
      return;
    }

    // Heuristic: any meaningful user message counts as "approach explained"
    // so we don't keep interrupting with "explain first".
    if (trimmed.length >= 20) {
      hasUserExplainedApproachRef.current = true;
    }

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const withCode = appendCodeUpdateIfNeeded(
        code,
        llmMessagesRef.current
      );
      const llmMessages = [...withCode, { role: "user", content: trimmed }];
      llmMessagesRef.current = llmMessages;

      const data = await sendChat({ messages: llmMessages, mode: "chat" });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply }
      ]);
      llmMessagesRef.current = [
        ...llmMessagesRef.current,
        { role: "assistant", content: data.reply }
      ];
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error.message || "Unable to reach the server."}`
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const activeSolved = Boolean(solvedByProblemId?.[activeProblem?.id]);
  const activeTestRun = testRunByProblemId?.[activeProblem?.id] || null;
  const revealedCount = Math.min(
    Number(revealedHintCount?.[activeProblem?.id] || 0),
    activeProblem?.hints?.length || 0
  );

  const handleAuthed = (user) => {
    setCurrentUserIdState(user?.id || null);
    setCurrentUser(user || null);
  };

  const handleLogOut = () => {
    logOut();
    setCurrentUserIdState(null);
    setCurrentUser(null);
    setIsProfileOpen(false);
  };

  return (
    <div className="app">
      <TutorialOverlay
        isOpen={isTutorialOpen}
        steps={tutorialSteps}
        stepIndex={tutorialStepIndex}
        onStepChange={setTutorialStepIndex}
        onClose={() => {
          setIsTutorialOpen(false);
          setTutorialStepIndex(0);
        }}
      />
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthed={handleAuthed}
      />
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={currentUser}
        storageUserId={storageUserId}
        problems={PROBLEMS}
        solvedByProblemId={solvedByProblemId}
        attemptStartedAtByProblemId={attemptStartedAtByProblemId}
        bestTimeSecondsByProblemId={bestTimeSecondsByProblemId}
        history={history}
        onLogOut={handleLogOut}
      />
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        problems={PROBLEMS}
        initialProblemId={activeProblemId}
      />
      <header className="app__header">
        <div className="app__header-text">
          <h1>Live AI Coding Interviewer</h1>
          <p>Prototype UI with editor + chat. Proactive guidance is next.</p>
        </div>
        <div className="app__header-actions">
          <div className="difficulty-card" data-tutorial="difficulty">
            <span className="difficulty-card__label">Difficulty</span>
            <select
              className="difficulty-card__select"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              disabled={isLocked}
              aria-label="Select interview difficulty"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
          <div className="time-card" data-tutorial="timer">
            <div className="time-tracker">
              <span className="time-tracker__label">Time left</span>
              <span className="time-tracker__value">
                {isTimeUp ? "00:00" : formatTime(remainingSeconds)}
              </span>
              {isTimeUp && (
                <span className="time-tracker__status">Time is up</span>
              )}
            </div>
            <button
              type="button"
              className="time-tracker__action"
              onClick={() => stopInterview("stopped")}
              disabled={isLocked}
              aria-label="Stop interview"
            >
              <span className="time-tracker__icon" aria-hidden="true">
                ■
              </span>
              Stop
            </button>
          </div>
          <button
            type="button"
            className="tutorial-trigger"
            onClick={() => {
              setIsTutorialOpen(true);
              setTutorialStepIndex(0);
            }}
            aria-label="Start tutorial"
          >
            Tutorial
          </button>
          <button
            type="button"
            className="tutorial-trigger"
            onClick={() => setIsLeaderboardOpen(true)}
            aria-label="Open leaderboards"
          >
            Leaderboards
          </button>
          <div className="user-actions">
            <button
              type="button"
              className="user-actions__btn user-actions__btn--primary"
              onClick={() => setIsProfileOpen(true)}
              aria-label="Open profile"
            >
              {currentUser ? currentUser.username : "Guest"} · Profile
            </button>
            {currentUser ? (
              <button
                type="button"
                className="user-actions__btn"
                onClick={handleLogOut}
                aria-label="Log out"
              >
                Log out
              </button>
            ) : (
              <button
                type="button"
                className="user-actions__btn"
                onClick={() => setIsAuthOpen(true)}
                aria-label="Log in or sign up"
              >
                Log in / Sign up
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app__main">
        <div className="app__left">
          <section className="panel panel--editor" data-tutorial="editor">
            <div className="panel__header">Editor</div>
            {liveInterruption?.message ? (
              <div
                className="ici-interrupt"
                role="status"
                aria-live="polite"
                onClick={() => {
                  // Clicking it just clears it for now (simple UX).
                  setLiveInterruption(null);
                }}
                title="Click to dismiss"
              >
                <div className="ici-interrupt__label">Interviewer interruption</div>
                <div className="ici-interrupt__text">{liveInterruption.message}</div>
                <button
                  type="button"
                  className="ici-interrupt__close"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLiveInterruption(null);
                  }}
                  aria-label="Dismiss interruption"
                >
                  ×
                </button>
              </div>
            ) : null}
            <Editor
              height="100%"
              defaultLanguage="javascript"
              value={code}
              onChange={(value) => setCode(value ?? "")}
              options={editorOptions}
            />
          </section>

          <section className="panel panel--console">
            <div className="panel__header panel__header--console">
              <span>Console</span>
              <div className="console__toolbar">
                <button
                  type="button"
                  className="console__btn console__btn--run"
                  onClick={handleRunCode}
                  disabled={isLocked || isRunning}
                  aria-label="Run code"
                >
                  {isRunning ? "Running..." : "Run"}
                </button>
                <button
                  type="button"
                  className="console__btn console__btn--tests"
                  onClick={handleRunTests}
                  disabled={isLocked || isRunning}
                  aria-label="Run tests"
                >
                  Run tests
                </button>
                <button
                  type="button"
                  className="console__btn"
                  onClick={handleClearConsole}
                  disabled={consoleEntries.length === 0}
                  aria-label="Clear console"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="console">
              <div className="console__output" role="log" aria-label="Console output">
                {consoleEntries.length === 0 ? (
                  <div className="console__empty">
                    Run your code to see output from <code>console.log</code> and errors.
                  </div>
                ) : (
                  consoleEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`console__line console__line--${entry.level}`}
                    >
                      <span className="console__prefix">
                        #{entry.runId}
                      </span>
                      <span className="console__text">{entry.text}</span>
                    </div>
                  ))
                )}
              </div>

              <iframe
                ref={runnerIframeRef}
                title="JavaScript runner"
                sandbox="allow-scripts"
                srcDoc={runnerSrcDoc}
                className="console__runner"
              />
            </div>
          </section>
        </div>

        <div className="app__right">
          <section className="panel panel--problem">
            <div className="panel__header panel__header--problem">
              <div className="problem__title">
                <span>Problem</span>
                {activeSolved ? (
                  <span className="problem__badge problem__badge--solved">Solved</span>
                ) : (
                  <span className="problem__badge">{activeProblem?.difficulty || "—"}</span>
                )}
              </div>
              <div className="problem__controls">
                <select
                  className="problem__select"
                  value={activeProblemId}
                  onChange={(e) => setActiveProblemId(e.target.value)}
                  disabled={isLocked}
                  aria-label="Select coding problem"
                >
                  {PROBLEMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="problem">
              <div className="problem__meta">
                <div className="problem__name">{activeProblem.title}</div>
                <div className="problem__signature">{activeProblem.signature}</div>
              </div>

              <div className="problem__tabs" role="tablist" aria-label="Problem sections">
                {["Description", "Examples", "Test cases", "Hints", "Solution"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`problem__tab ${problemTab === tab ? "is-active" : ""}`}
                    onClick={() => setProblemTab(tab)}
                    disabled={tab === "Solution" && !activeSolved}
                    aria-label={`Open ${tab}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="problem__content">
                {problemTab === "Description" && (
                  <div className="problem__section">
                    <div className="problem__block">
                      <div className="problem__block-title">Description</div>
                      <div className="problem__text">{activeProblem.description}</div>
                    </div>
                  </div>
                )}

                {problemTab === "Examples" && (
                  <div className="problem__section">
                    <div className="problem__block">
                      <div className="problem__block-title">Examples</div>
                      <div className="problem__examples">
                        {(activeProblem.examples || []).map((ex, idx) => (
                          <div key={idx} className="problem__example">
                            <div className="problem__example-title">Example {idx + 1}</div>
                            <div className="problem__kv">
                              <div className="problem__k">Input</div>
                              <pre className="problem__v">{prettyValue(ex.input)}</pre>
                            </div>
                            <div className="problem__kv">
                              <div className="problem__k">Output</div>
                              <pre className="problem__v">{prettyValue(ex.output)}</pre>
                            </div>
                            {ex.explanation && (
                              <div className="problem__kv">
                                <div className="problem__k">Explanation</div>
                                <div className="problem__text">{ex.explanation}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {problemTab === "Test cases" && (
                  <div className="problem__section">
                    <div className="problem__block">
                      <div className="problem__block-title">Test cases</div>
                      <div className="problem__tests-header">
                        <div className="problem__tests-summary">
                          {activeTestRun?.summary ? (
                            <span>
                              Last run: {activeTestRun.summary.passed}/{activeTestRun.summary.total} passed
                            </span>
                          ) : (
                            <span>No test run yet</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="problem__run-tests"
                          onClick={handleRunTests}
                          disabled={isLocked || isRunning}
                        >
                          Run tests
                        </button>
                      </div>
                      <div className="problem__tests">
                        {(activeProblem.tests || []).map((t, idx) => {
                          const r = activeTestRun?.results?.find((x) => x.index === idx);
                          const status = r ? (r.pass ? "pass" : "fail") : "unknown";
                          return (
                            <div key={idx} className={`problem__test problem__test--${status}`}>
                              <div className="problem__test-top">
                                <div className="problem__test-name">
                                  {r ? (r.pass ? "PASS" : "FAIL") : "—"} {t.name || `Test #${idx + 1}`}
                                </div>
                                <div className="problem__test-status">
                                  {r ? (r.pass ? "Passed" : "Failed") : "Not run"}
                                </div>
                              </div>
                              <div className="problem__test-body">
                                <div className="problem__kv">
                                  <div className="problem__k">Args</div>
                                  <pre className="problem__v">{prettyValue(t.args)}</pre>
                                </div>
                                <div className="problem__kv">
                                  <div className="problem__k">Expected</div>
                                  <pre className="problem__v">{prettyValue(t.expected)}</pre>
                                </div>
                                {r && !r.pass && (
                                  <>
                                    {"actual" in r && (
                                      <div className="problem__kv">
                                        <div className="problem__k">Actual</div>
                                        <pre className="problem__v">{prettyValue(r.actual)}</pre>
                                      </div>
                                    )}
                                    {r.error && (
                                      <div className="problem__kv">
                                        <div className="problem__k">Error</div>
                                        <pre className="problem__v">{String(r.error)}</pre>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {problemTab === "Hints" && (
                  <div className="problem__section">
                    <div className="problem__block">
                      <div className="problem__block-title">Hints</div>
                      <div className="problem__hints">
                        {activeProblem.hints.slice(0, revealedCount).map((h, idx) => (
                          <div key={idx} className="problem__hint">
                            <div className="problem__hint-n">Hint {idx + 1}</div>
                            <div className="problem__text">{h}</div>
                          </div>
                        ))}
                        {revealedCount === 0 && (
                          <div className="problem__text problem__text--muted">
                            No hints revealed yet.
                          </div>
                        )}
                      </div>
                      <div className="problem__hint-actions">
                        <button
                          type="button"
                          className="problem__hint-btn"
                          onClick={() =>
                            setRevealedHintCount((prev) => ({
                              ...(prev || {}),
                              [activeProblem.id]: Math.min(
                                (prev?.[activeProblem.id] || 0) + 1,
                                activeProblem.hints.length
                              )
                            }))
                          }
                          disabled={revealedCount >= activeProblem.hints.length}
                        >
                          Reveal next hint ({revealedCount}/{activeProblem.hints.length})
                        </button>
                        <button
                          type="button"
                          className="problem__hint-btn problem__hint-btn--ghost"
                          onClick={() =>
                            setRevealedHintCount((prev) => ({
                              ...(prev || {}),
                              [activeProblem.id]: 0
                            }))
                          }
                          disabled={revealedCount === 0}
                        >
                          Reset hints
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {problemTab === "Solution" && (
                  <div className="problem__section">
                    {!activeSolved ? (
                      <div className="problem__text problem__text--muted">
                        Pass all tests to unlock the solution.
                      </div>
                    ) : (
                      <div className="problem__block">
                        <div className="problem__block-title">Solution</div>
                        <div className="problem__solution-actions">
                          <button
                            type="button"
                            className="problem__hint-btn"
                            onClick={() => setIsSolutionVisible((v) => !v)}
                          >
                            {isSolutionVisible ? "Hide solution" : "Reveal solution"}
                          </button>
                        </div>
                        {isSolutionVisible && (
                          <pre className="problem__solution">
{activeProblem.solution}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="panel panel--chat" data-tutorial="coach">
            <div className="panel__header">Interview Coach</div>
            <div className="chat">
              <div className="chat__messages">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`chat__message chat__message--${message.role}`}
                  >
                    <div className="chat__role">{message.role}</div>
                    <div className="chat__content">{message.content}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="chat__input">
                <textarea
                  placeholder="Ask for guidance or explain your approach..."
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={isLocked}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={3}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending || isLocked}
                >
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
