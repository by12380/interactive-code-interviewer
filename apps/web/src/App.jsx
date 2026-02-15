import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  assignQuestions,
  compareCandidates,
  createQuestion,
  createSession,
  evaluateCandidate,
  fetchCandidateCode,
  fetchLeaderboard,
  joinSession,
  listCandidates,
  listQuestions,
  openLiveSessionStream,
  requestHint,
  sendChat,
  sendInterviewerChat,
  syncCandidateCode,
  translateCode,
  updateCandidateHintSettings,
  updateHintSettings
} from "./api.js";
import TutorialOverlay from "./TutorialOverlay.jsx";
import VoicePanel from "./VoicePanel.jsx";
import RoadmapPanel from "./RoadmapPanel.jsx";
import FocusModeOverlay from "./FocusModeOverlay.jsx";
import PromptTemplatesModal from "./PromptTemplatesModal.jsx";
import { getCurrentUserId, getUserById, loadUsers, logIn, logOut, signUp } from "./auth.js";
import { loadUserJson, loadUserState, saveUserJson } from "./userData.js";
import { randomId } from "./storage.js";
import { analyzeCodeForInterruptions } from "./codeAnalysis.js";
import {
  buildProactivePrompt,
  canEmitLocalInterruption,
  shouldRequestProactiveInterruption
} from "./interruptionPolicy.js";
import { createReplayRecorder } from "./replay.js";
import { putReplay, pruneOldReplays } from "./replayStore.js";
import CodeReplayModal from "./CodeReplayModal.jsx";
import {
  ROADMAP_DEFAULTS,
  applySolvedProblemToRoadmap,
  evaluateRoadmapMilestones,
  normalizeRoadmapState
} from "./roadmap.js";
import {
  GAMIFICATION_DEFAULTS,
  applyPracticeDay,
  computeUnlocks,
  evaluateNewAchievements,
  getLevelInfo,
  isProblemUnlocked,
  normalizeGamificationState,
  xpForSolve
} from "./gamification.js";

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
  ,
  {
    id: "group-anagrams",
    title: "Group Anagrams",
    difficulty: "Medium",
    functionName: "groupAnagrams",
    signature: "groupAnagrams(strs)",
    description: `Given an array of strings strs, group the anagrams together. You can return the answer in any order.`,
    examples: [
      { input: { strs: ["eat", "tea", "tan", "ate", "nat", "bat"] }, output: [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]] }
    ],
    tests: [
      {
        name: "Example",
        args: [["eat", "tea", "tan", "ate", "nat", "bat"]],
        expected: [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]]
      },
      { name: "Empty", args: [[]], expected: [] },
      { name: "Single", args: [["abc"]], expected: [["abc"]] }
    ],
    hints: [
      "Anagrams share the same character counts/signature.",
      "Use a map from signature → list of strings.",
      "Signature can be sorted string or counts-based key."
    ],
    solution: `function groupAnagrams(strs) {
  const groups = new Map(); // key -> array
  for (const s of strs) {
    const key = [...s].sort().join("");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return Array.from(groups.values());
}`
  },
  {
    id: "lru-cache",
    title: "LRU Cache",
    difficulty: "Hard",
    functionName: "LRUCache",
    signature: "LRUCache(capacity)",
    description: `Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.

Implement the LRUCache class:
- LRUCache(capacity) initializes the LRU cache with positive size capacity.
- get(key) returns the value of the key if the key exists, otherwise return -1.
- put(key, value) updates the value of the key if the key exists. Otherwise, adds the key-value pair to the cache.
If the number of keys exceeds the capacity, evict the least recently used key.`,
    examples: [
      {
        input: { ops: ["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"], args: [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]] },
        output: [null, null, null, 1, null, -1, null, -1, 3, 4]
      }
    ],
    tests: [
      {
        name: "Example sequence",
        args: [
          ["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"],
          [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]
        ],
        expected: [null, null, null, 1, null, -1, null, -1, 3, 4]
      }
    ],
    hints: [
      "You need O(1) get and put.",
      "Combine a hash map with a doubly-linked list.",
      "Move keys to the front on access; evict from the back."
    ],
    solution: `function LRUCache(capacity) {
  this.capacity = capacity;
  this.map = new Map(); // key -> node
  this.head = { key: null, val: null, prev: null, next: null };
  this.tail = { key: null, val: null, prev: null, next: null };
  this.head.next = this.tail;
  this.tail.prev = this.head;
}

LRUCache.prototype._remove = function (node) {
  node.prev.next = node.next;
  node.next.prev = node.prev;
};

LRUCache.prototype._addFront = function (node) {
  node.next = this.head.next;
  node.prev = this.head;
  this.head.next.prev = node;
  this.head.next = node;
};

LRUCache.prototype.get = function (key) {
  if (!this.map.has(key)) return -1;
  const node = this.map.get(key);
  this._remove(node);
  this._addFront(node);
  return node.val;
};

LRUCache.prototype.put = function (key, value) {
  if (this.map.has(key)) {
    const node = this.map.get(key);
    node.val = value;
    this._remove(node);
    this._addFront(node);
    return;
  }
  const node = { key, val: value, prev: null, next: null };
  this.map.set(key, node);
  this._addFront(node);
  if (this.map.size > this.capacity) {
    const lru = this.tail.prev;
    this._remove(lru);
    this.map.delete(lru.key);
  }
};`
  }
];

const DEFAULT_PROBLEM_ID = PROBLEMS[0]?.id ?? "two-sum";
const buildStarterCode = (problem) =>
  problem?.id === "lru-cache"
    ? `function LRUCache(capacity) {\n  // Your constructor here\n}\n\nLRUCache.prototype.get = function (key) {\n  // return value or -1\n};\n\nLRUCache.prototype.put = function (key, value) {\n  // store key/value and evict if needed\n};\n`
    : `function ${problem.functionName}${problem.signature.replace(problem.functionName, "")} {\n  // Your solution here\n}\n`;

const BEHAVIORAL_QUESTIONS = [
  {
    id: "behav-weakness",
    prompt: "Tell me about a time you received critical feedback. What did you do?"
  },
  {
    id: "behav-conflict",
    prompt: "Tell me about a conflict you had with a teammate and how you resolved it."
  },
  {
    id: "behav-ownership",
    prompt: "Describe a project you owned end-to-end. What tradeoffs did you make?"
  },
  {
    id: "behav-failure",
    prompt: "Tell me about a time you shipped a bug. How did you respond, and what did you change?"
  }
];

const SYSTEM_DESIGN_QUESTIONS = [
  {
    id: "sd-url-shortener",
    title: "Design a URL shortener",
    prompt:
      "Design a URL shortener (like bit.ly). Cover requirements, API, data model, scaling, rate limiting, and analytics."
  },
  {
    id: "sd-notifications",
    title: "Design a notification system",
    prompt:
      "Design a notification system that supports email/SMS/push, retries, templating, and user preferences. Discuss queues and observability."
  }
];

function pickRandom(arr, rng = Math.random) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(rng() * arr.length)];
}

function normalizeDifficulty(d) {
  const x = String(d || "").toLowerCase();
  if (x === "easy") return "Easy";
  if (x === "medium") return "Medium";
  if (x === "hard") return "Hard";
  return "Medium";
}

function nextDifficulty(d) {
  const cur = normalizeDifficulty(d);
  if (cur === "Easy") return "Medium";
  if (cur === "Medium") return "Hard";
  return "Hard";
}

function computeInterviewFeedback({ rounds, totalSeconds, interruptionCount }) {
  const coding = (rounds || []).filter((r) => r.type === "coding");
  const solvedCount = coding.filter((r) => r.testsTotal > 0 && r.testsPassed === r.testsTotal).length;
  const codingCount = coding.length || 0;

  const strengths = [];
  const improvements = [];

  if (codingCount > 0 && solvedCount === codingCount) strengths.push("You got to correct, passing solutions within the time constraints.");
  if (codingCount > 0 && solvedCount === 0) improvements.push("Work on getting to a minimal correct solution earlier (then iterate).");

  if (typeof interruptionCount === "number" && interruptionCount > 4) {
    improvements.push("Try to verbalize your approach before coding; you got interrupted frequently for course-correction.");
  } else if (typeof interruptionCount === "number" && interruptionCount <= 2) {
    strengths.push("Your approach was generally clear and stayed on track (few interviewer nudges).");
  }

  if (typeof totalSeconds === "number" && totalSeconds > 0) {
    strengths.push(`You managed your time across the session (${formatClock(totalSeconds)} total).`);
  }

  if (strengths.length === 0) strengths.push("Good effort staying engaged and iterating.");
  if (improvements.length === 0) improvements.push("Add more explicit complexity analysis and edge-case discussion as you code.");

  return [
    "Summary",
    `- Coding rounds solved: ${solvedCount}/${codingCount}`,
    typeof interruptionCount === "number" ? `- Interviewer interruptions: ${interruptionCount}` : null,
    "",
    "Strengths",
    ...strengths.map((s) => `- ${s}`),
    "",
    "Areas to improve",
    ...improvements.map((s) => `- ${s}`)
  ]
    .filter(Boolean)
    .join("\n");
}

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

const UI_PREFS_KEY = "uiPrefs.v1";
const UI_PREFS_DEFAULTS = Object.freeze({
  theme: "system", // system | light | dark
  accent: "indigo", // indigo | emerald | rose | amber | cyan
  contrast: "normal", // normal | high
  keyboardNav: false,
  tourSeen: false,
  multiPractice: false, // split-screen multi-problem practice mode

  // Focus mode (distraction-free UI)
  focusMode: false,
  focusZen: true,
  focusBackdropOpacity: 0.28, // 0..0.7
  focusBackdropBlur: 14, // px
  focusBreathingPattern: "box" // box | 478
});

function normalizeUiPrefs(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const theme = ["system", "light", "dark"].includes(r.theme) ? r.theme : UI_PREFS_DEFAULTS.theme;
  const accent = ["indigo", "emerald", "rose", "amber", "cyan"].includes(r.accent)
    ? r.accent
    : UI_PREFS_DEFAULTS.accent;
  const contrast = ["normal", "high"].includes(r.contrast) ? r.contrast : UI_PREFS_DEFAULTS.contrast;
  const focusBackdropOpacity = Number(r.focusBackdropOpacity);
  const focusBackdropBlur = Number(r.focusBackdropBlur);
  return {
    theme,
    accent,
    contrast,
    keyboardNav: Boolean(r.keyboardNav),
    tourSeen: Boolean(r.tourSeen),
    multiPractice: Boolean(r.multiPractice),

    focusMode: Boolean(r.focusMode),
    focusZen: r.focusZen == null ? UI_PREFS_DEFAULTS.focusZen : Boolean(r.focusZen),
    focusBackdropOpacity: Number.isFinite(focusBackdropOpacity)
      ? Math.max(0, Math.min(0.7, focusBackdropOpacity))
      : UI_PREFS_DEFAULTS.focusBackdropOpacity,
    focusBackdropBlur: Number.isFinite(focusBackdropBlur)
      ? Math.max(0, Math.min(28, Math.round(focusBackdropBlur)))
      : UI_PREFS_DEFAULTS.focusBackdropBlur,
    focusBreathingPattern: ["box", "478"].includes(r.focusBreathingPattern)
      ? r.focusBreathingPattern
      : UI_PREFS_DEFAULTS.focusBreathingPattern
  };
}

function getSystemTheme() {
  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function getSystemContrast() {
  try {
    return window.matchMedia?.("(prefers-contrast: more)")?.matches ? "high" : "normal";
  } catch {
    return "normal";
  }
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

const MULTI_PRACTICE_MAX = 3;

function normalizeMultiPracticeSession(raw, fallbackProblemId) {
  const r = raw && typeof raw === "object" ? raw : {};
  const idsRaw = Array.isArray(r.problemIds) ? r.problemIds : [];
  const ids = Array.from(new Set(idsRaw.map((x) => String(x || "")).filter(Boolean))).slice(0, MULTI_PRACTICE_MAX);
  const fallback = String(fallbackProblemId || "");
  if (ids.length === 0 && fallback) ids.push(fallback);
  const activeIndexRaw = Number(r.activeIndex);
  const activeIndex = Number.isFinite(activeIndexRaw)
    ? Math.max(0, Math.min(ids.length - 1, Math.floor(activeIndexRaw)))
    : 0;
  return {
    problemIds: ids,
    activeIndex,
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now()
  };
}

function pickNextUnlockedProblemId({ excludeIds, unlocks, problems }) {
  const exclude = new Set((Array.isArray(excludeIds) ? excludeIds : []).map(String));
  for (const p of Array.isArray(problems) ? problems : []) {
    if (!p?.id) continue;
    if (exclude.has(p.id)) continue;
    if (isProblemUnlocked(p, unlocks)) return p.id;
  }
  return null;
}

function CodeTranslationModal({ isOpen, onClose, problem, code, onApplyCode }) {
  const [sourceLanguage, setSourceLanguage] = useState("javascript");
  const [targetLanguage, setTargetLanguage] = useState("python");
  const [includeTests, setIncludeTests] = useState(true);
  const [idiomatic, setIdiomatic] = useState(true);
  const [preserveFormatting, setPreserveFormatting] = useState(true);
  const [preserveComments, setPreserveComments] = useState(true);
  const [activeTab, setActiveTab] = useState("code"); // code | tests | notes

  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setIsWorking(false);
    setResult(null);
    setActiveTab("code");
  }, [isOpen]);

  const doTranslate = async () => {
    setError("");
    setIsWorking(true);
    try {
      const res = await translateCode({
        sourceLanguage,
        targetLanguage,
        code,
        problem,
        options: {
          includeTests,
          idiomatic,
          preserveFormatting,
          preserveComments
        }
      });
      setResult(res || null);
      setActiveTab("code");
    } catch (e) {
      setError(e?.message || "Unable to translate right now.");
    } finally {
      setIsWorking(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
    } catch {
      // If clipboard fails (non-HTTPS), fall back to selecting text manually.
    }
  };

  const canApply = Boolean(result?.code && typeof onApplyCode === "function");
  const showTests = Boolean(result?.tests) && includeTests;

  return (
    <Modal isOpen={isOpen} title="Code Translation" onClose={onClose}>
      <div className="translate">
        <div className="translate__grid">
          <label className="translate__field">
            <span className="translate__label">From</span>
            <select value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)}>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
          </label>
          <label className="translate__field">
            <span className="translate__label">To</span>
            <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
          </label>
        </div>

        <div className="translate__toggles">
          <label className="translate__toggle">
            <input
              type="checkbox"
              checked={includeTests}
              onChange={(e) => setIncludeTests(e.target.checked)}
            />
            <span>Translate tests</span>
          </label>
          <label className="translate__toggle">
            <input type="checkbox" checked={idiomatic} onChange={(e) => setIdiomatic(e.target.checked)} />
            <span>Idiomatic output</span>
          </label>
          <label className="translate__toggle">
            <input
              type="checkbox"
              checked={preserveFormatting}
              onChange={(e) => setPreserveFormatting(e.target.checked)}
            />
            <span>Preserve formatting</span>
          </label>
          <label className="translate__toggle">
            <input
              type="checkbox"
              checked={preserveComments}
              onChange={(e) => setPreserveComments(e.target.checked)}
            />
            <span>Preserve comments</span>
          </label>
        </div>

        {error ? <div className="translate__error">{error}</div> : null}

        <div className="translate__actions">
          <button type="button" className="translate__btn translate__btn--primary" onClick={doTranslate} disabled={isWorking}>
            {isWorking ? "Translating..." : "Translate"}
          </button>
          {result?.code ? (
            <>
              <button type="button" className="translate__btn" onClick={() => copyToClipboard(result.code)}>
                Copy code
              </button>
              {showTests ? (
                <button type="button" className="translate__btn" onClick={() => copyToClipboard(result.tests)}>
                  Copy tests
                </button>
              ) : null}
              {canApply ? (
                <button
                  type="button"
                  className="translate__btn"
                  onClick={() => onApplyCode(result.code)}
                  title="Replace the editor contents with the translated code"
                >
                  Apply to editor
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        {result ? (
          <>
            <div className="translate__tabs" role="tablist" aria-label="Translation output tabs">
              <button
                type="button"
                className={`translate__tab ${activeTab === "code" ? "is-active" : ""}`}
                onClick={() => setActiveTab("code")}
              >
                Code
              </button>
              <button
                type="button"
                className={`translate__tab ${activeTab === "tests" ? "is-active" : ""}`}
                onClick={() => setActiveTab("tests")}
                disabled={!showTests}
                title={!showTests ? "No tests were generated." : ""}
              >
                Tests
              </button>
              <button
                type="button"
                className={`translate__tab ${activeTab === "notes" ? "is-active" : ""}`}
                onClick={() => setActiveTab("notes")}
              >
                Notes
              </button>
            </div>

            <div className="translate__output">
              {activeTab === "code" ? (
                <pre className="translate__pre">{result.code || ""}</pre>
              ) : null}
              {activeTab === "tests" ? (
                <pre className="translate__pre">{result.tests || ""}</pre>
              ) : null}
              {activeTab === "notes" ? (
                <div className="translate__notes">
                  {Array.isArray(result.warnings) && result.warnings.length ? (
                    <div className="translate__note-block">
                      <div className="translate__note-title">Warnings</div>
                      <ul className="translate__note-list">
                        {result.warnings.map((w, i) => (
                          <li key={`w-${i}`}>{String(w)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {Array.isArray(result.notes) && result.notes.length ? (
                    <div className="translate__note-block">
                      <div className="translate__note-title">Notes</div>
                      <ul className="translate__note-list">
                        {result.notes.map((n, i) => (
                          <li key={`n-${i}`}>{String(n)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="translate__muted">No notes.</div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="translate__hint">
              Tip: This app can only run JavaScript in the built-in runner, but you can copy the translated code/tests into your language environment.
            </div>
          </>
        ) : (
          <div className="translate__muted">
            Choose source/target languages, then translate the current editor code.
          </div>
        )}
      </div>
    </Modal>
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
  gamification,
  onLogOut,
  onOpenReplay
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
  const normalizedGami = useMemo(() => normalizeGamificationState(gamification), [gamification]);
  const gamiLevel = useMemo(() => getLevelInfo(normalizedGami.xp), [normalizedGami.xp]);
  const achievements = useMemo(() => {
    const list = Object.values(normalizedGami.achievements || {});
    list.sort((a, b) => Number(b?.unlockedAt || 0) - Number(a?.unlockedAt || 0));
    return list;
  }, [normalizedGami.achievements]);

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
          <div className="profile__stat">
            <div className="profile__stat-k">Level</div>
            <div className="profile__stat-v">{gamiLevel.level}</div>
          </div>
          <div className="profile__stat">
            <div className="profile__stat-k">XP</div>
            <div className="profile__stat-v">{normalizedGami.xp}</div>
          </div>
          <div className="profile__stat">
            <div className="profile__stat-k">Streak</div>
            <div className="profile__stat-v">{normalizedGami.streak}d</div>
          </div>
        </div>

        <div className="profile__section">
          <div className="profile__section-title">Achievements</div>
          {achievements.length === 0 ? (
            <div className="profile__empty">No achievements yet. Solve problems to earn badges.</div>
          ) : (
            <div className="profile__badges">
              {achievements.map((a) => (
                <div key={a.id} className="profile__badge" title={a.description || a.name}>
                  <div className="profile__badge-name">{a.name}</div>
                  <div className="profile__badge-desc">{a.description}</div>
                </div>
              ))}
            </div>
          )}
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
              {history.slice(0, 25).map((h) => {
                const directReplayId = h?.replayId ? String(h.replayId) : "";
                const roundReplayIds = Array.isArray(h?.interview?.rounds)
                  ? h.interview.rounds
                      .filter((r) => r?.type === "coding" && r?.replayId)
                      .map((r) => String(r.replayId))
                      .filter(Boolean)
                  : [];
                const replayIds = [
                  ...(directReplayId ? [directReplayId] : []),
                  ...roundReplayIds
                ];
                const uniqueReplayIds = Array.from(new Set(replayIds));
                const hasReplay = uniqueReplayIds.length > 0;

                return (
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
                    {hasReplay ? (
                      <button
                        type="button"
                        className="profile__replay-btn"
                        onClick={() => {
                          const first = uniqueReplayIds[0] || null;
                          if (!first) return;
                          onOpenReplay?.({
                            replayId: first,
                            sessionReplayIds: uniqueReplayIds
                          });
                        }}
                      >
                        Replay
                      </button>
                    ) : null}
                  </div>
                  </div>
                );
              })}
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

function LeaderboardModal({
  isOpen,
  onClose,
  problems,
  initialProblemId,
  storageUserId,
  gamification,
  onUpdateGamification
}) {
  const [view, setView] = useState("time"); // time | xp
  const [selectedProblemId, setSelectedProblemId] = useState(initialProblemId || problems?.[0]?.id || "");
  const [xpScope, setXpScope] = useState("all"); // all | friends
  const [friendToAdd, setFriendToAdd] = useState("");
  const gami = useMemo(() => normalizeGamificationState(gamification), [gamification]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedProblemId(initialProblemId || problems?.[0]?.id || "");
  }, [isOpen, initialProblemId, problems]);

  const timeRows = useMemo(() => {
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

  const xpRows = useMemo(() => {
    if (!isOpen) return [];
    const users = loadUsers();
    const competitors = [];

    const allowedIds =
      xpScope === "friends"
        ? new Set([String(storageUserId || "guest"), ...(gami.friends || []).map(String)])
        : null;

    // Registered users
    for (const u of users) {
      if (!u?.id) continue;
      const id = String(u.id);
      if (allowedIds && !allowedIds.has(id)) continue;
      const g = normalizeGamificationState(loadUserJson(id, "gamification", GAMIFICATION_DEFAULTS));
      competitors.push({
        key: `user:${id}`,
        id,
        name: u.username || u.email || id,
        xp: Number(g.xp || 0),
        level: getLevelInfo(Number(g.xp || 0)).level,
        streak: Number(g.streak || 0)
      });
    }

    // Guest (device-local)
    const guestId = "guest";
    if (!allowedIds || allowedIds.has(guestId)) {
      const g = normalizeGamificationState(loadUserJson("guest", "gamification", GAMIFICATION_DEFAULTS));
      competitors.push({
        key: "guest",
        id: "guest",
        name: "Guest",
        xp: Number(g.xp || 0),
        level: getLevelInfo(Number(g.xp || 0)).level,
        streak: Number(g.streak || 0)
      });
    }

    competitors.sort((a, b) => {
      if (b.xp !== a.xp) return b.xp - a.xp;
      if (b.level !== a.level) return b.level - a.level;
      return b.streak - a.streak;
    });
    return competitors.map((c, idx) => ({ ...c, rank: idx + 1 })).slice(0, 30);
  }, [isOpen, xpScope, storageUserId, gami.friends]);

  const selectedProblem = problems.find((p) => p.id === selectedProblemId) || null;

  const friendCandidates = useMemo(() => {
    const self = String(storageUserId || "guest");
    return loadUsers()
      .filter((u) => u?.id && String(u.id) !== self)
      .map((u) => ({ id: String(u.id), name: u.username || u.email || String(u.id) }));
  }, [storageUserId, isOpen]);

  const addFriend = () => {
    const id = String(friendToAdd || "");
    if (!id) return;
    onUpdateGamification?.((prev) => {
      const next = normalizeGamificationState(prev);
      const set = new Set([...(next.friends || []), id]);
      return { ...next, friends: Array.from(set) };
    });
    setFriendToAdd("");
  };

  const removeFriend = (id) => {
    const removeId = String(id || "");
    if (!removeId) return;
    onUpdateGamification?.((prev) => {
      const next = normalizeGamificationState(prev);
      return { ...next, friends: (next.friends || []).filter((x) => String(x) !== removeId) };
    });
  };

  return (
    <Modal isOpen={isOpen} title="Leaderboards" onClose={onClose}>
      <div className="leaderboard">
        <div className="leaderboard__tabs" role="tablist" aria-label="Leaderboard views">
          <button
            type="button"
            className={`leaderboard__tab ${view === "time" ? "is-active" : ""}`}
            onClick={() => setView("time")}
          >
            Best time
          </button>
          <button
            type="button"
            className={`leaderboard__tab ${view === "xp" ? "is-active" : ""}`}
            onClick={() => setView("xp")}
          >
            XP
          </button>
        </div>

        {view === "time" ? (
          <>
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

              {timeRows.length === 0 ? (
                <div className="leaderboard__empty">
                  No times yet for {selectedProblem?.title || "this problem"}. Solve it to appear here.
                </div>
              ) : (
                timeRows.map((r) => (
                  <div key={r.key} className="leaderboard__row">
                    <div className="leaderboard__rank">{r.rank}</div>
                    <div className="leaderboard__user">{r.name}</div>
                    <div className="leaderboard__time">{formatClock(r.bestSeconds)}</div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="leaderboard__top">
              <div className="leaderboard__picker">
                <div className="leaderboard__label">Scope</div>
                <select
                  className="leaderboard__select"
                  value={xpScope}
                  onChange={(e) => setXpScope(e.target.value)}
                  aria-label="Select XP leaderboard scope"
                >
                  <option value="all">All local users</option>
                  <option value="friends">Friends</option>
                </select>
              </div>
              <div className="leaderboard__note">
                XP is device-only (per browser). Friends are just users you follow on this device.
              </div>
            </div>

            <div className="leaderboard__friends">
              <div className="leaderboard__friends-title">Friends</div>
              <div className="leaderboard__friends-controls">
                <select
                  className="leaderboard__select"
                  value={friendToAdd}
                  onChange={(e) => setFriendToAdd(e.target.value)}
                  aria-label="Select a friend to add"
                >
                  <option value="">Select a user</option>
                  {friendCandidates
                    .filter((u) => !(gami.friends || []).includes(u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
                <button type="button" className="leaderboard__add-friend" onClick={addFriend} disabled={!friendToAdd}>
                  Add
                </button>
              </div>
              {(gami.friends || []).length === 0 ? (
                <div className="leaderboard__empty" style={{ marginTop: 10 }}>
                  No friends yet. Add a local user to compare XP.
                </div>
              ) : (
                <div className="leaderboard__friends-list">
                  {(gami.friends || []).map((id) => {
                    const label = friendCandidates.find((u) => u.id === id)?.name || id;
                    return (
                      <div key={id} className="leaderboard__friend">
                        <div className="leaderboard__friend-name">{label}</div>
                        <button
                          type="button"
                          className="leaderboard__friend-remove"
                          onClick={() => removeFriend(id)}
                          aria-label={`Remove ${label} from friends`}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="leaderboard__table">
              <div className="leaderboard__head leaderboard__head--xp">
                <div>#</div>
                <div>User</div>
                <div>Level</div>
                <div>XP</div>
                <div>Streak</div>
              </div>

              {xpRows.length === 0 ? (
                <div className="leaderboard__empty">No users found.</div>
              ) : (
                xpRows.map((r) => (
                  <div key={r.key} className="leaderboard__row leaderboard__row--xp">
                    <div className="leaderboard__rank">{r.rank}</div>
                    <div className="leaderboard__user">{r.name}</div>
                    <div className="leaderboard__time">{r.level}</div>
                    <div className="leaderboard__time">{r.xp}</div>
                    <div className="leaderboard__time">{r.streak}d</div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
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
  const [isTranslateOpen, setIsTranslateOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [replayModal, setReplayModal] = useState({
    isOpen: false,
    replayId: null,
    sessionReplayIds: []
  });
  const [uiPrefs, setUiPrefs] = useState(() =>
    normalizeUiPrefs(loadUserJson(storageUserId, UI_PREFS_KEY, UI_PREFS_DEFAULTS))
  );
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    uiPrefs.theme === "system" ? getSystemTheme() : uiPrefs.theme
  );
  const [resolvedContrast, setResolvedContrast] = useState(() =>
    uiPrefs.contrast === "normal" ? getSystemContrast() : uiPrefs.contrast
  );

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
  const [approachNotesByProblemId, setApproachNotesByProblemId] = useState(() => {
    return loadUserState(storageUserId).approachNotesByProblemId;
  });
  const [multiPracticeSession, setMultiPracticeSession] = useState(() => {
    const raw = loadUserState(storageUserId).multiPracticeSession;
    return normalizeMultiPracticeSession(raw, DEFAULT_PROBLEM_ID);
  });
  const [history, setHistory] = useState(() => {
    return loadUserState(storageUserId).history;
  });
  const [replayIndex, setReplayIndex] = useState(() => {
    return loadUserState(storageUserId).replayIndex;
  });
  const [gamification, setGamification] = useState(() =>
    normalizeGamificationState(loadUserJson(storageUserId, "gamification", GAMIFICATION_DEFAULTS))
  );
  const [roadmap, setRoadmap] = useState(() =>
    normalizeRoadmapState(loadUserJson(storageUserId, "roadmap", ROADMAP_DEFAULTS))
  );
  const [promptTemplates, setPromptTemplates] = useState(() =>
    Array.isArray(loadUserJson(storageUserId, "promptTemplates", []))
      ? loadUserJson(storageUserId, "promptTemplates", [])
      : []
  );

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
    setApproachNotesByProblemId(next.approachNotesByProblemId);
    setMultiPracticeSession(
      normalizeMultiPracticeSession(next.multiPracticeSession, activeProblemId || DEFAULT_PROBLEM_ID)
    );
    setHistory(next.history);
    setReplayIndex(next.replayIndex);
    setRoadmap(normalizeRoadmapState(loadUserJson(storageUserId, "roadmap", ROADMAP_DEFAULTS)));
    const nextTemplates = loadUserJson(storageUserId, "promptTemplates", []);
    setPromptTemplates(Array.isArray(nextTemplates) ? nextTemplates : []);
  }, [storageUserId]);

  useEffect(() => {
    setGamification(
      normalizeGamificationState(loadUserJson(storageUserId, "gamification", GAMIFICATION_DEFAULTS))
    );
  }, [storageUserId]);

  useEffect(() => {
    saveUserJson(storageUserId, "gamification", gamification);
  }, [storageUserId, gamification]);

  useEffect(() => {
    saveUserJson(storageUserId, "roadmap", roadmap);
  }, [storageUserId, roadmap]);

  useEffect(() => {
    saveUserJson(storageUserId, "promptTemplates", Array.isArray(promptTemplates) ? promptTemplates : []);
  }, [storageUserId, promptTemplates]);

  useEffect(() => {
    setUiPrefs(normalizeUiPrefs(loadUserJson(storageUserId, UI_PREFS_KEY, UI_PREFS_DEFAULTS)));
  }, [storageUserId]);

  useEffect(() => {
    saveUserJson(storageUserId, UI_PREFS_KEY, uiPrefs);
  }, [storageUserId, uiPrefs]);

  useEffect(() => {
    const root = document.documentElement;
    const effectiveTheme = uiPrefs.theme === "system" ? getSystemTheme() : uiPrefs.theme;
    const effectiveContrast =
      uiPrefs.contrast === "normal" ? getSystemContrast() : uiPrefs.contrast;

    setResolvedTheme(effectiveTheme);
    setResolvedContrast(effectiveContrast);

    root.dataset.theme = effectiveTheme;
    root.dataset.accent = uiPrefs.accent;
    root.dataset.contrast = effectiveContrast;
    root.dataset.keyboardNav = uiPrefs.keyboardNav ? "true" : "false";
    root.dataset.input = root.dataset.input || "mouse";

    const mqlTheme = window.matchMedia?.("(prefers-color-scheme: dark)");
    const mqlContrast = window.matchMedia?.("(prefers-contrast: more)");
    const onThemeChange = () => {
      if (uiPrefs.theme !== "system") return;
      const next = getSystemTheme();
      root.dataset.theme = next;
      setResolvedTheme(next);
    };
    const onContrastChange = () => {
      if (uiPrefs.contrast !== "normal") return;
      const next = getSystemContrast();
      root.dataset.contrast = next;
      setResolvedContrast(next);
    };

    try {
      mqlTheme?.addEventListener?.("change", onThemeChange);
      mqlContrast?.addEventListener?.("change", onContrastChange);
    } catch {
      // ignore
    }
    return () => {
      try {
        mqlTheme?.removeEventListener?.("change", onThemeChange);
        mqlContrast?.removeEventListener?.("change", onContrastChange);
      } catch {
        // ignore
      }
    };
  }, [uiPrefs]);

  useEffect(() => {
    const root = document.documentElement;
    const onKeyDown = (e) => {
      if (e.key === "Tab") {
        root.dataset.input = "keyboard";
      }
    };
    const onMouseDown = () => {
      root.dataset.input = "mouse";
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("mousedown", onMouseDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
    };
  }, []);

  const isMultiPractice = Boolean(uiPrefs.multiPractice);

  // Multi-problem quick switching shortcuts.
  useEffect(() => {
    if (!isMultiPractice) return;
    const onKeyDown = (e) => {
      const useMod = Boolean(e.metaKey || e.ctrlKey);
      if (!useMod || e.altKey) return;

      const ids = (multiPracticeSession?.problemIds || []).map(String).filter(Boolean);
      if (!ids.length) return;

      // Ctrl/⌘ + 1/2/3
      const n = Number(e.key);
      if (Number.isFinite(n) && n >= 1 && n <= MULTI_PRACTICE_MAX) {
        const pid = ids[n - 1] || null;
        if (pid) {
          e.preventDefault();
          setActiveProblemId(pid);
        }
        return;
      }

      // Ctrl/⌘ + Shift + ArrowLeft/ArrowRight
      if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const idx = ids.indexOf(String(activeProblemId || ""));
        const base = idx >= 0 ? idx : 0;
        const nextIdx = (base + dir + ids.length) % ids.length;
        const pid = ids[nextIdx] || null;
        if (pid) setActiveProblemId(pid);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isMultiPractice, multiPracticeSession?.problemIds, activeProblemId]);

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
    const now = Date.now();
    lastEditAtRef.current = now;
    const pid = String(activeProblem?.id || "");
    const pending = pendingInterruptionRef.current;
    if (pending && pending.problemId === pid) {
      pending.editCount = Number(pending.editCount || 0) + 1;
      if (pending.editCount >= 3) {
        const stats = getProblemInterruptionStats(pid);
        stats.ignoredStreak = Math.min(4, Number(stats.ignoredStreak || 0) + 1);
        pendingInterruptionRef.current = null;
      }
    }
    setCodeByProblemId((prev) => {
      const next = { ...(prev || {}), [activeProblem.id]: nextCode };
      return next;
    });
  };

  const setApproachNoteForProblem = (problemId, note) => {
    const pid = String(problemId || "");
    if (!pid) return;
    setApproachNotesByProblemId((prev) => ({ ...(prev || {}), [pid]: String(note || "") }));
  };

  const [problemTab, setProblemTab] = useState("Description");
  const [revealedHintCount, setRevealedHintCount] = useState(() => ({}));
  const [aiHintByProblemId, setAiHintByProblemId] = useState(() => ({}));
  const [isSolutionVisible, setIsSolutionVisible] = useState(false);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [difficulty, setDifficulty] = useState("Medium");
  const [sidebarScreen, setSidebarScreen] = useState("session"); // session | interview | settings
  const [mode, setMode] = useState("practice"); // practice | interview
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(30 * 60);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [consoleEntries, setConsoleEntries] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [liveInterruption, setLiveInterruption] = useState(null); // { message, ts }
  const [interviewSession, setInterviewSession] = useState(null);
  const [behavioralAnswer, setBehavioralAnswer] = useState("");
  const [systemDesignAnswer, setSystemDesignAnswer] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [recordingState, setRecordingState] = useState({
    status: "idle", // idle | requesting | recording | stopped | error
    error: null,
    blobUrl: null
  });
  const [hubRole, setHubRole] = useState("interviewer"); // interviewer | candidate
  const [hubSessionTitle, setHubSessionTitle] = useState("Frontend interview session");
  const [hubShareCode, setHubShareCode] = useState("");
  const [hubSession, setHubSession] = useState(null);
  const [hubQuestions, setHubQuestions] = useState([]);
  const [hubSelectedQuestionIds, setHubSelectedQuestionIds] = useState([]);
  const [hubActiveQuestionId, setHubActiveQuestionId] = useState("");
  const [hubCandidates, setHubCandidates] = useState([]);
  const [hubSelectedCandidateId, setHubSelectedCandidateId] = useState("");
  const [hubCandidateCode, setHubCandidateCode] = useState("");
  const [hubLeaderboard, setHubLeaderboard] = useState([]);
  const [hubComparison, setHubComparison] = useState(null);
  const [hubHintsEnabled, setHubHintsEnabled] = useState(true);
  const [hubHintMode, setHubHintMode] = useState("always");
  const [hubCandidateAllowHints, setHubCandidateAllowHints] = useState(true);
  const [hubCandidateHintMode, setHubCandidateHintMode] = useState("always");
  const [hubBusy, setHubBusy] = useState(false);
  const [hubError, setHubError] = useState("");
  const [hubJoinedCandidateId, setHubJoinedCandidateId] = useState("");
  const [hubCustomTitle, setHubCustomTitle] = useState("");
  const [hubCustomDescription, setHubCustomDescription] = useState("");
  const [hubCustomDifficulty, setHubCustomDifficulty] = useState("Medium");
  const [hubAiInput, setHubAiInput] = useState("");
  const [hubAiMessages, setHubAiMessages] = useState([]);
  const hubGuestIdRef = useRef(`guest_${Date.now().toString(36)}`);
  const hubSyncTimerRef = useRef(null);
  const hubLiveSourceRef = useRef(null);
  const [isVoiceHold, setIsVoiceHold] = useState(false);
  const [toast, setToast] = useState(null); // { id, kind, title, message }
  const toastTimerRef = useRef(null);
  const liveInterruptionTimerRef = useRef(null);
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
  const lastInterruptAtRef = useRef(0);
  const lastEditAtRef = useRef(0);
  const lastUserMessageRef = useRef("");
  const interruptionStatsByProblemRef = useRef(new Map());
  const pendingInterruptionRef = useRef(null); // { problemId, ruleId, editCount }
  const hasUserExplainedApproachRef = useRef(false);
  const lastCodeSentRef = useRef("");
  const llmMessagesRef = useRef([]);
  const timerStartAtRef = useRef(Date.now());
  const elapsedSecondsRef = useRef(0);
  const runnerIframeRef = useRef(null);
  const runIdRef = useRef(0);
  const chatMessagesRef = useRef(null);
  const hasInitializedChatScrollRef = useRef(false);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const [editorReadyTick, setEditorReadyTick] = useState(0);
  const replayRecorderRef = useRef(null);
  const replayActiveKeyRef = useRef("");
  const storageUserIdRef = useRef(storageUserId);
  const solvedByProblemIdRef = useRef(solvedByProblemId);
  const attemptStartedAtByProblemIdRef = useRef(attemptStartedAtByProblemId);
  const bestTimeSecondsByProblemIdRef = useRef(bestTimeSecondsByProblemId);
  const testRunByProblemIdRef = useRef(testRunByProblemId);
  const codeByProblemIdRef = useRef(codeByProblemId);
  const historyRef = useRef(history);
  const replayIndexRef = useRef(replayIndex);
  const difficultyRef = useRef(difficulty);
  const stopOnceRef = useRef(false);
  const lastAutoAdvanceRoundIdRef = useRef("");
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordChunksRef = useRef([]);
  const feedbackRef = useRef("");

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
    replayIndexRef.current = replayIndex;
  }, [replayIndex]);
  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);
  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  useEffect(() => {
    // Auto-scroll ONLY the chat panel (avoid scrolling the whole page while typing code).
    const el = chatMessagesRef.current;
    if (!el) return;
    if (!hasInitializedChatScrollRef.current) {
      el.scrollTop = 0;
      hasInitializedChatScrollRef.current = true;
      return;
    }
    const nearTop = el.scrollTop < 120;
    if (!nearTop) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, [messages.length]);
  useEffect(() => {
    if (!isLocked) {
      stopOnceRef.current = false;
    }
  }, [isLocked]);

  useEffect(() => {
    if (!toast) return;
    try {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 4500);
    } catch {
      // ignore
    }
    return () => {
      try {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      } catch {
        // ignore
      }
    };
  }, [toast]);

  const isInterviewMode = mode === "interview";
  const isMultiPracticeEffective = !isInterviewMode && isMultiPractice;
  const remainingSeconds = Math.max(timeLimitSeconds - elapsedSeconds, 0);
  const isTimeUp = elapsedSeconds >= timeLimitSeconds;
  const levelInfo = useMemo(() => getLevelInfo(gamification.xp), [gamification.xp]);
  const hubActor = useMemo(
    () => ({
      userId: currentUser?.id || currentUserId || hubGuestIdRef.current,
      role: hubRole,
      displayName: currentUser?.username || currentUser?.email || "Guest"
    }),
    [currentUser?.id, currentUser?.username, currentUser?.email, currentUserId, hubRole]
  );
  const unlocks = useMemo(
    () => computeUnlocks({ solvedByProblemId, problems: PROBLEMS }),
    [solvedByProblemId]
  );

  useEffect(() => {
    if (isInterviewMode) return;
    const current = PROBLEMS.find((p) => p.id === activeProblemId) || null;
    if (!current) return;
    if (isProblemUnlocked(current, unlocks)) return;
    const firstUnlocked = PROBLEMS.find((p) => isProblemUnlocked(p, unlocks))?.id;
    if (firstUnlocked) setActiveProblemId(firstUnlocked);
  }, [activeProblemId, isInterviewMode, unlocks]);

  const activeInterviewRound = useMemo(() => {
    if (!interviewSession) return null;
    const idx = interviewSession.roundIndex ?? 0;
    return interviewSession.rounds?.[idx] ?? null;
  }, [interviewSession]);

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
        const prevSummary = testRunByProblemIdRef.current?.[problemId]?.summary || null;

        setTestRunByProblemId((prev) => {
          const next = { ...(prev || {}), [problemId]: payload };
          return next;
        });

        const passed = Number(payload?.summary?.passed || 0);
        const total = Number(payload?.summary?.total || 0);
        const isPassing = total > 0 && passed === total;
        const prevPassed = Number(prevSummary?.passed || 0);
        if (passed > prevPassed || isPassing) {
          const stats = getProblemInterruptionStats(problemId);
          stats.lastProgressAt = Date.now();
          stats.ignoredStreak = 0;
          if (pendingInterruptionRef.current?.problemId === problemId) {
            pendingInterruptionRef.current = null;
          }
        }

        if (isPassing) {
          const wasSolved = Boolean(solvedByProblemIdRef.current?.[problemId]);
          const now = Date.now();
          const problem = PROBLEMS.find((p) => p.id === problemId) || null;

          setSolvedByProblemId((prev) => {
            const next = { ...(prev || {}), [problemId]: true };
            return next;
          });

          // Gamification: streak always updates on a passing run (counts as practice),
          // XP only awards the first time you solve a given problem.
          try {
            const solvedMapForCounts = wasSolved
              ? (solvedByProblemIdRef.current || {})
              : { ...(solvedByProblemIdRef.current || {}), [problemId]: true };
            const counts = computeUnlocks({ solvedByProblemId: solvedMapForCounts, problems: PROBLEMS })?.counts || {
              easySolved: 0,
              mediumSolved: 0,
              hardSolved: 0
            };
            const solvedCount = (counts.easySolved || 0) + (counts.mediumSolved || 0) + (counts.hardSolved || 0);
            const hardSolvedCount = counts.hardSolved || 0;
            const rewardXp = wasSolved ? 0 : xpForSolve(problem?.difficulty);

            setGamification((prev) => {
              let next = applyPracticeDay(prev, now);
              if (rewardXp > 0) {
                next = { ...next, xp: Number(next.xp || 0) + rewardXp };
              }
              return evaluateNewAchievements({
                prevState: next,
                solvedCount,
                hardSolvedCount,
                nowTs: now
              }).nextState;
            });
          } catch {
            // ignore gamification errors
          }

          if (!wasSolved) {
            try {
              const currentSolvedCount = Object.values(solvedByProblemIdRef.current || {}).filter(Boolean).length;
              const nextSolvedCount = currentSolvedCount + 1;
              const remaining = Math.max(0, PROBLEMS.length - nextSolvedCount);
              setToast({
                id: `${now}-${problemId}`,
                kind: "success",
                title: "Problem solved",
                message: `${problem?.title || "Problem"} · ${nextSolvedCount} solved · ${remaining} left`
              });
            } catch {
              setToast({
                id: `${now}-${problemId}`,
                kind: "success",
                title: "Problem solved",
                message: `${problem?.title || "Problem"}`
              });
            }

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

            persistReplayIfAny()
              .then((meta) => {
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
                  codeSnapshot: String(codeByProblemIdRef.current?.[problemId] || ""),
                  replayId: meta?.id || null
                };
                setHistory((prev) => [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 200));
              })
              .catch(() => {
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
                  codeSnapshot: String(codeByProblemIdRef.current?.[problemId] || ""),
                  replayId: null
                };
                setHistory((prev) => [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 200));
              });

            // Roadmap: update skill/performance signals + auto-complete plan tasks tied to this problem.
            try {
              setRoadmap((prev) => {
                const p = normalizeRoadmapState(prev);
                const updated = applySolvedProblemToRoadmap({
                  prevState: p,
                  problemId,
                  problems: PROBLEMS,
                  nowTs: now
                });
                const evaluated = evaluateRoadmapMilestones({
                  prevState: p,
                  nextState: updated,
                  nowTs: now
                });
                for (const m of evaluated.unlocked || []) {
                  pushToast("success", m.name, m.description);
                }
                return evaluated.nextState;
              });
            } catch {
              // ignore roadmap errors
            }
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
      setUiPrefs((prev) => ({ ...prev, tourSeen: true }));
    }
  }, []);

  const didAutoStartTourForUserRef = useRef("");
  useEffect(() => {
    if (uiPrefs.tourSeen) return;
    if (didAutoStartTourForUserRef.current === storageUserId) return;
    didAutoStartTourForUserRef.current = storageUserId;
    setIsTutorialOpen(true);
    setTutorialStepIndex(0);
    setUiPrefs((prev) => ({ ...prev, tourSeen: true }));
  }, [storageUserId, uiPrefs.tourSeen]);

  const editorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 14,
      scrollBeyondLastLine: false,
      wordWrap: "on",
      readOnly: isLocked || isVoiceHold
    }),
    [isLocked, isVoiceHold]
  );

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const pushToast = (kind, title, message) => {
    setToast({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: kind || "info",
      title: title || "Update",
      message: message || ""
    });
  };

  const withHubBusy = async (fn) => {
    setHubBusy(true);
    setHubError("");
    try {
      await fn();
    } catch (error) {
      const msg = error?.message || "Interview hub action failed.";
      setHubError(msg);
      pushToast("error", "Interview Hub", msg);
    } finally {
      setHubBusy(false);
    }
  };

  const refreshHubCandidates = async () => {
    if (!hubSession?.id) return;
    const rows = await listCandidates(hubSession.id, { ...hubActor, role: "interviewer" });
    setHubCandidates(Array.isArray(rows) ? rows : []);
  };

  const refreshHubLeaderboard = async () => {
    if (!hubSession?.id) return;
    const result = await fetchLeaderboard(hubSession.id, { ...hubActor, role: "interviewer" });
    setHubLeaderboard(Array.isArray(result?.leaderboard) ? result.leaderboard : []);
  };

  useEffect(() => {
    listQuestions({})
      .then((rows) => {
        const next = Array.isArray(rows) ? rows : [];
        setHubQuestions(next);
        if (!hubSelectedQuestionIds.length && next.length > 0) {
          setHubSelectedQuestionIds([next[0].id]);
          setHubActiveQuestionId(next[0].id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hubLiveSourceRef.current) {
      hubLiveSourceRef.current.close();
      hubLiveSourceRef.current = null;
    }
    if (!hubSession?.id) return;
    const source = openLiveSessionStream(hubSession.id);
    hubLiveSourceRef.current = source;
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        if (payload.type === "candidate:joined" && hubRole === "interviewer") {
          refreshHubCandidates().catch(() => {});
        }
        if (payload.type === "code:update" && payload.candidateId === hubSelectedCandidateId) {
          setHubCandidateCode(String(payload.code || ""));
        }
      } catch {
        // ignore malformed payloads
      }
    };
    source.onerror = () => {};
    return () => {
      source.close();
      if (hubLiveSourceRef.current === source) hubLiveSourceRef.current = null;
    };
  }, [hubSession?.id, hubRole, hubSelectedCandidateId]);

  useEffect(() => {
    if (hubRole !== "candidate") return;
    if (!hubSession?.id || !hubJoinedCandidateId) return;
    if (hubSyncTimerRef.current) clearTimeout(hubSyncTimerRef.current);
    hubSyncTimerRef.current = setTimeout(() => {
      syncCandidateCode(
        hubSession.id,
        hubJoinedCandidateId,
        { code, questionId: activeProblemId },
        { ...hubActor, role: "candidate" }
      ).catch(() => {});
    }, 700);
    return () => {
      if (hubSyncTimerRef.current) clearTimeout(hubSyncTimerRef.current);
    };
  }, [hubRole, hubSession?.id, hubJoinedCandidateId, code, activeProblemId, hubActor]);

  useEffect(() => {
    if (hubRole !== "interviewer") return;
    if (!hubSession?.id || !hubSelectedCandidateId) return;
    const qid = hubActiveQuestionId || hubSelectedQuestionIds[0] || activeProblemId;
    if (!qid) return;
    fetchCandidateCode(hubSession.id, hubSelectedCandidateId, qid, { ...hubActor, role: "interviewer" })
      .then((payload) => setHubCandidateCode(String(payload?.code || "")))
      .catch(() => setHubCandidateCode(""));
  }, [hubRole, hubSession?.id, hubSelectedCandidateId, hubActiveQuestionId, hubSelectedQuestionIds, activeProblemId, hubActor]);

  useEffect(() => {
    if (hubRole !== "interviewer") return;
    if (!hubSession?.id) return;
    refreshHubCandidates().catch(() => {});
    refreshHubLeaderboard().catch(() => {});
  }, [hubRole, hubSession?.id]);

  const openReplay = ({ replayId, sessionReplayIds }) => {
    const rid = replayId ? String(replayId) : "";
    if (!rid) return;
    setReplayModal({
      isOpen: true,
      replayId: rid,
      sessionReplayIds: Array.isArray(sessionReplayIds) ? sessionReplayIds.map(String).filter(Boolean) : [rid]
    });
    // Avoid stacking modals.
    setIsProfileOpen(false);
  };

  const pauseInterviewTimer = (source = "manual") => {
    if (!isInterviewMode) return;
    setIsPaused((prev) => {
      if (prev) return prev;
      if (source !== "voice") {
        pushToast("info", "Interview paused", "Paused.");
      }
      return true;
    });
  };

  const resumeInterviewTimer = (source = "manual") => {
    if (!isInterviewMode) return;
    setIsPaused((prev) => {
      if (!prev) return prev;
      // Keep elapsedSeconds stable while paused by shifting the start reference.
      timerStartAtRef.current = Date.now() - elapsedSecondsRef.current * 1000;
      if (source !== "voice") {
        pushToast("success", "Interview resumed", "Resumed.");
      }
      return false;
    });
  };

  const insertIntoEditor = (snippet) => {
    const text = String(snippet || "");
    if (!text) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) {
      setCode(`${code}${text}`);
      return;
    }
    const model = editor.getModel();
    if (!model) return;
    const selection = editor.getSelection();
    const pos = editor.getPosition();
    const range =
      selection ||
      (pos
        ? new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column)
        : new monaco.Range(1, 1, 1, 1));
    editor.executeEdits("voice", [{ range, text, forceMoveMarkers: true }]);
    editor.focus();
  };

  const stopInterview = async (outcome = "stopped") => {
    if (stopOnceRef.current) return;
    stopOnceRef.current = true;

    let replayId = null;
    try {
      const meta = await persistReplayIfAny();
      replayId = meta?.id || null;
    } catch {
      // ignore replay failures
    }

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
      codeSnapshot: String(codeByProblemIdRef.current?.[problemId] || ""),
      replayId
    };

    setAttemptStartedAtByProblemId((prev) => {
      if (prev?.[problemId]) return prev;
      return { ...(prev || {}), [problemId]: startedAt };
    });
    setHistory((prev) => [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 200));
    setIsLocked(true);
  };

  const stopRecording = async () => {
    try {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    } catch {
      // ignore
    }
  };

  const teardownRecording = async () => {
    try {
      const stream = mediaStreamRef.current;
      if (stream) {
        for (const t of stream.getTracks()) t.stop();
      }
    } catch {
      // ignore
    } finally {
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
    }
  };

  const startRecording = async () => {
    setRecordingState((s) => ({ ...s, status: "requesting", error: null }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      recordChunksRef.current = [];

      const mimeTypeCandidates = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm"
      ];
      const mimeType = mimeTypeCandidates.find((t) => {
        try {
          return globalThis.MediaRecorder?.isTypeSupported?.(t);
        } catch {
          return false;
        }
      });

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e?.data && e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      recorder.onerror = (e) => {
        setRecordingState({ status: "error", error: String(e?.error?.message || "Recording error"), blobUrl: null });
      };
      recorder.onstop = () => {
        try {
          const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || "video/webm" });
          const nextUrl = URL.createObjectURL(blob);
          setRecordingState({ status: "stopped", error: null, blobUrl: nextUrl });
        } catch (e) {
          setRecordingState({ status: "error", error: e?.message || "Unable to save recording", blobUrl: null });
        }
      };

      recorder.start(1000);
      setRecordingState((s) => ({ ...s, status: "recording", error: null }));
      return true;
    } catch (e) {
      setRecordingState({ status: "error", error: e?.message || "Unable to access camera/microphone", blobUrl: null });
      await teardownRecording();
      return false;
    }
  };

  const buildInterviewRounds = ({ codingRounds = 2, includeSystemDesign = true } = {}) => {
    const rounds = [];
    let d = "Easy";
    const used = new Set();

    for (let i = 0; i < codingRounds; i++) {
      const pool = PROBLEMS.filter((p) => normalizeDifficulty(p.difficulty) === d && !used.has(p.id));
      const fallbackPool = PROBLEMS.filter((p) => normalizeDifficulty(p.difficulty) === d);
      const picked = pickRandom(pool.length ? pool : fallbackPool);
      if (picked?.id) used.add(picked.id);
      rounds.push({
        id: randomId("round"),
        type: "coding",
        difficulty: d,
        problemId: picked?.id || DEFAULT_PROBLEM_ID,
        seconds: d === "Easy" ? 12 * 60 : d === "Medium" ? 18 * 60 : 22 * 60
      });
      rounds.push({
        id: randomId("round"),
        type: "behavioral",
        questionId: pickRandom(BEHAVIORAL_QUESTIONS)?.id || BEHAVIORAL_QUESTIONS[0].id,
        seconds: 3 * 60
      });
      d = nextDifficulty(d);
    }

    if (includeSystemDesign) {
      rounds.push({
        id: randomId("round"),
        type: "system_design",
        questionId: pickRandom(SYSTEM_DESIGN_QUESTIONS)?.id || SYSTEM_DESIGN_QUESTIONS[0].id,
        seconds: 12 * 60
      });
    }

    rounds.push({ id: randomId("round"), type: "feedback", seconds: 3 * 60 });
    return rounds;
  };

  const advanceInterviewRound = async (reason = "next") => {
    let replayId = null;
    try {
      if (activeInterviewRound?.type === "coding") {
        const meta = await persistReplayIfAny();
        replayId = meta?.id || null;
      }
    } catch {
      // ignore replay failures
    }

    setInterviewSession((prev) => {
      if (!prev) return prev;
      const idx = prev.roundIndex ?? 0;
      const cur = prev.rounds?.[idx] ?? null;
      const now = Date.now();

      const nextRounds = Array.isArray(prev.rounds) ? [...prev.rounds] : [];
      if (cur) {
        const snapshot = {
          endedAt: now,
          durationSeconds: Math.max(0, Math.floor((now - (cur.startedAt || now)) / 1000)),
          reason,
          replayId: cur.type === "coding" ? replayId : cur.replayId,
          answer:
            cur.type === "behavioral"
              ? String(behavioralAnswer || "")
              : cur.type === "system_design"
                ? String(systemDesignAnswer || "")
                : cur.answer
        };
        nextRounds[idx] = { ...cur, ...snapshot };
      }

      const nextIndex = idx + 1;
      if (nextIndex >= nextRounds.length) {
        return { ...prev, rounds: nextRounds, roundIndex: nextIndex };
      }

      const nextRound = { ...nextRounds[nextIndex], startedAt: now };
      nextRounds[nextIndex] = nextRound;

      // Stage side effects:
      if (nextRound.type === "coding") {
        const pId = String(nextRound.problemId || DEFAULT_PROBLEM_ID);
        setActiveProblemId(pId);
        setDifficulty(nextRound.difficulty || "Medium");
        setBehavioralAnswer("");
        setSystemDesignAnswer("");
        setIsLocked(false);
        setTimeLimitSeconds(Number(nextRound.seconds || 15 * 60));
        timerStartAtRef.current = Date.now();
        setElapsedSeconds(0);
        setIsPaused(false);
        setIsVoiceHold(false);
        setProblemTab("Description");
      } else if (nextRound.type === "behavioral") {
        setIsLocked(true);
        setTimeLimitSeconds(Number(nextRound.seconds || 3 * 60));
        timerStartAtRef.current = Date.now();
        setElapsedSeconds(0);
        setIsPaused(false);
        setIsVoiceHold(false);
      } else if (nextRound.type === "system_design") {
        setIsLocked(true);
        setTimeLimitSeconds(Number(nextRound.seconds || 12 * 60));
        timerStartAtRef.current = Date.now();
        setElapsedSeconds(0);
        setIsPaused(false);
        setIsVoiceHold(false);
      } else if (nextRound.type === "feedback") {
        setIsLocked(true);
        setTimeLimitSeconds(Number(nextRound.seconds || 3 * 60));
        timerStartAtRef.current = Date.now();
        setElapsedSeconds(0);
        setIsPaused(false);
        setIsVoiceHold(false);

        const interruptionCount = llmMessagesRef.current.filter(
          (m) => m?.role === "assistant" && String(m?.content || "").startsWith("Wait,")
        ).length;
        const totalSeconds = Math.max(0, Math.floor((now - Number(prev.startedAt || now)) / 1000));
        const enriched = nextRounds.map((r) => {
          if (r.type !== "coding") return r;
          const pid = String(r.problemId || "");
          const summary = testRunByProblemIdRef.current?.[pid]?.summary || null;
          return {
            ...r,
            testsPassed: Number(summary?.passed || 0),
            testsTotal: Number(summary?.total || 0)
          };
        });
        const computed = computeInterviewFeedback({ rounds: enriched, totalSeconds, interruptionCount });
        setFeedbackText(computed);
        feedbackRef.current = computed;
      }

      return { ...prev, rounds: nextRounds, roundIndex: nextIndex };
    });
  };

  const endInterviewSimulation = async (outcome = "completed") => {
    const endedAt = Date.now();
    const session = interviewSession;
    if (!session) {
      setMode("practice");
      setIsLocked(false);
      setTimeLimitSeconds(30 * 60);
      timerStartAtRef.current = Date.now();
      setElapsedSeconds(0);
      setIsPaused(false);
      setIsVoiceHold(false);
      return;
    }

    const rounds = (session.rounds || []).map((r) => ({ ...r }));
    const codingRounds = rounds.filter((r) => r.type === "coding");
    const enrichedRounds = rounds.map((r) => {
      if (r.type !== "coding") return r;
      const problemId = String(r.problemId || "");
      const summary = testRunByProblemIdRef.current?.[problemId]?.summary || null;
      const passed = Number(summary?.passed || 0);
      const total = Number(summary?.total || 0);
      return { ...r, testsPassed: passed, testsTotal: total };
    });

    const interruptionCount = llmMessagesRef.current.filter((m) => m?.role === "assistant" && String(m?.content || "").startsWith("Wait,")).length;
    const totalSeconds = Math.max(0, Math.floor((endedAt - Number(session.startedAt || endedAt)) / 1000));
    const computed = computeInterviewFeedback({ rounds: enrichedRounds, totalSeconds, interruptionCount });
    setFeedbackText(computed);
    feedbackRef.current = computed;

    const entry = {
      id: randomId("interview"),
      createdAt: endedAt,
      startedAt: session.startedAt,
      endedAt,
      durationSeconds: totalSeconds,
      outcome,
      problemId: "interview-simulation",
      problemTitle: "Interview Simulation",
      difficulty: "Progressive",
      testsPassed: codingRounds.reduce((acc, r) => {
        const pid = String(r.problemId || "");
        const s = testRunByProblemIdRef.current?.[pid]?.summary;
        return acc + Number(s?.passed || 0);
      }, 0),
      testsTotal: codingRounds.reduce((acc, r) => {
        const pid = String(r.problemId || "");
        const s = testRunByProblemIdRef.current?.[pid]?.summary;
        return acc + Number(s?.total || 0);
      }, 0),
      interview: {
        rounds: enrichedRounds,
        feedback: computed,
        recordingAvailable: Boolean(recordingState?.blobUrl)
      }
    };

    setHistory((prev) => [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 200));

    await stopRecording();
    await teardownRecording();

    setInterviewSession(null);
    setMode("practice");
    setIsLocked(false);
    setTimeLimitSeconds(30 * 60);
    timerStartAtRef.current = Date.now();
    setElapsedSeconds(0);
  };

  useEffect(() => {
    if (!isTimeUp) return;

    if (isInterviewMode) {
      const rid = String(activeInterviewRound?.id || "");
      if (rid && lastAutoAdvanceRoundIdRef.current === rid) return;
      lastAutoAdvanceRoundIdRef.current = rid;
      if (activeInterviewRound?.type === "feedback") {
        endInterviewSimulation("timeout");
      } else {
        advanceInterviewRound("timeout");
      }
      return;
    }

    if (!isLocked) {
      stopInterview("timeout");
    }
  }, [isTimeUp, isLocked, isInterviewMode, activeInterviewRound?.id]);

  useEffect(() => {
    if (!isInterviewMode) return;
    if (!interviewSession) return;
    const total = interviewSession.rounds?.length ?? 0;
    const idx = interviewSession.roundIndex ?? 0;
    if (total > 0 && idx >= total) {
      endInterviewSimulation("completed");
    }
  }, [isInterviewMode, interviewSession?.roundIndex, interviewSession?.rounds?.length]);

  const buildCodeMessage = (nextCode) => ({
    role: "user",
    content: `[code update]\n${nextCode || "// No code provided"}`
  });

  const upsertReplayMeta = (meta) => {
    const m = meta && typeof meta === "object" ? meta : null;
    if (!m?.id) return;
    const MAX_REPLAYS = 50;
    setReplayIndex((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const filtered = arr.filter((r) => r?.id !== m.id);
      const next = [m, ...filtered].slice(0, MAX_REPLAYS);
      return next;
    });
  };

  const persistReplayIfAny = async () => {
    const rec = replayRecorderRef.current;
    if (!rec) return null;
    replayRecorderRef.current = null;
    replayActiveKeyRef.current = "";

    const res = rec.stop?.();
    const meta = res?.meta || null;
    const payload = res?.payload || null;
    if (!meta?.id || !payload?.id) return null;
    if (Number(meta.eventCount || 0) <= 0) return null;

    try {
      await putReplay(payload);
    } catch {
      return null;
    }
    upsertReplayMeta(meta);
    return meta;
  };

  const startReplayIfNeeded = async ({ key, mode, problemId, problemTitle, startedAt }) => {
    const k = String(key || "");
    if (!k) return;
    if (replayActiveKeyRef.current === k && replayRecorderRef.current) return;
    const editor = editorRef.current;
    if (!editor) return;

    // If switching contexts (problem/round), persist any existing replay.
    await persistReplayIfAny();

    const pid = String(problemId || "");
    if (!pid) return;
    const initialCode = String(codeByProblemIdRef.current?.[pid] || "");
    const replayId = randomId("replay");
    replayActiveKeyRef.current = k;
    replayRecorderRef.current = createReplayRecorder({
      replayId,
      mode,
      problemId: pid,
      problemTitle,
      startedAt,
      initialCode,
      editor
    });
  };

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
    saveUserJson(storageUserId, "approachNotesByProblemId", approachNotesByProblemId || {});
  }, [storageUserId, approachNotesByProblemId]);

  useEffect(() => {
    saveUserJson(storageUserId, "multiPracticeSession", multiPracticeSession || null);
  }, [storageUserId, multiPracticeSession]);

  useEffect(() => {
    saveUserJson(storageUserId, "history", history || []);
  }, [storageUserId, history]);

  useEffect(() => {
    saveUserJson(storageUserId, "replayIndex", replayIndex || []);
  }, [storageUserId, replayIndex]);

  useEffect(() => {
    setProblemTab("Description");
    setIsSolutionVisible(false);
  }, [activeProblemId]);

  useEffect(() => {
    const pid = String(activeProblemId || "");
    if (!pid) return;
    getProblemInterruptionStats(pid);
    if (pendingInterruptionRef.current && pendingInterruptionRef.current.problemId !== pid) {
      pendingInterruptionRef.current = null;
    }
  }, [activeProblemId]);

  // Keep the multi-practice session aligned to the active editor problem.
  useEffect(() => {
    if (!isMultiPracticeEffective) return;
    const pid = String(activeProblemId || "");
    if (!pid) return;
    setMultiPracticeSession((prev) => {
      const cur = normalizeMultiPracticeSession(prev, pid);
      const idx = cur.problemIds.indexOf(pid);
      if (idx !== -1) {
        if (cur.activeIndex === idx) return cur;
        return { ...cur, activeIndex: idx };
      }
      if (cur.problemIds.length < MULTI_PRACTICE_MAX) {
        const nextIds = [...cur.problemIds, pid];
        return { ...cur, problemIds: nextIds, activeIndex: nextIds.indexOf(pid) };
      }
      const nextIds = [...cur.problemIds];
      nextIds[cur.activeIndex] = pid;
      const unique = Array.from(new Set(nextIds)).slice(0, MULTI_PRACTICE_MAX);
      const nextIndex = unique.indexOf(pid);
      return { ...cur, problemIds: unique, activeIndex: Math.max(0, nextIndex) };
    });
  }, [activeProblemId, isMultiPracticeEffective]);

  // Keep IndexedDB payloads in sync with the local replay index cap.
  useEffect(() => {
    const ids = (Array.isArray(replayIndex) ? replayIndex : [])
      .map((r) => String(r?.id || ""))
      .filter(Boolean);
    if (!ids.length) return;
    pruneOldReplays(ids).catch(() => {});
  }, [replayIndex]);

  // Auto-start/stop recording based on whether the editor is writable.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const isCodingRound = !isInterviewMode || activeInterviewRound?.type === "coding";
    const problemId = String(activeProblem?.id || "");
    if (!problemId) return;

    const shouldRecord = Boolean(!isLocked && isCodingRound);
    if (!shouldRecord) {
      // Don't await; we just want best-effort persistence if the user navigates away.
      persistReplayIfAny().catch(() => {});
      return;
    }

    const mode = isInterviewMode ? "interview" : "practice";
    const key = isInterviewMode
      ? `interview:${String(activeInterviewRound?.id || "")}:${problemId}`
      : `practice:${problemId}`;
    const startedAt = isInterviewMode
      ? Number(activeInterviewRound?.startedAt || Date.now())
      : Number(attemptStartedAtByProblemIdRef.current?.[problemId] || Date.now());
    const title = String(activeProblem?.title || problemId);
    startReplayIfNeeded({ key, mode, problemId, problemTitle: title, startedAt }).catch(() => {});
  }, [
    editorReadyTick,
    isLocked,
    isInterviewMode,
    activeInterviewRound?.id,
    activeInterviewRound?.type,
    activeInterviewRound?.startedAt,
    activeProblemId
  ]);

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
    if (!isInterviewMode && isLocked) {
      return;
    }

    if (isPaused) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStartAtRef.current) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLocked, isInterviewMode, isPaused]);

  const appendCodeUpdateIfNeeded = (nextCode, messageList) => {
    if (nextCode === lastCodeSentRef.current) {
      return messageList;
    }

    lastCodeSentRef.current = nextCode;
    return [...messageList, buildCodeMessage(nextCode)];
  };

  const pushAiHintForProblem = (problemId, message) => {
    const pid = String(problemId || "");
    const text = String(message || "").trim();
    if (!pid || !text) return;
    setAiHintByProblemId((prev) => ({ ...(prev || {}), [pid]: text }));
    setProblemTab("Hints");
  };

  function getProblemInterruptionStats(problemId) {
    const pid = String(problemId || "");
    if (!pid) {
      return {
        interruptionsSent: 0,
        proactiveCalls: 0,
        ignoredStreak: 0,
        lastProgressAt: Date.now(),
        lastProactiveAt: 0
      };
    }
    const m = interruptionStatsByProblemRef.current;
    if (!m.has(pid)) {
      m.set(pid, {
        interruptionsSent: 0,
        proactiveCalls: 0,
        ignoredStreak: 0,
        lastProgressAt: Date.now(),
        lastProactiveAt: 0
      });
    }
    return m.get(pid);
  }

  // Fast, local interruptions (no API call). Runs frequently with a tight debounce.
  useEffect(() => {
    if (isLocked) return;
    if (!activeProblem) return;

    const debounceMs = 1400;
    const timeout = setTimeout(() => {
      if (liveInterruption?.message) return;

      const now = Date.now();
      const idleMs = now - lastEditAtRef.current;
      const problemId = String(activeProblem?.id || "");
      const stats = getProblemInterruptionStats(problemId);
      const suggestions = analyzeCodeForInterruptions({
        code,
        problem: activeProblem,
        hasUserExplainedApproach: hasUserExplainedApproachRef.current
      });
      if (!suggestions.length) return;

      for (const s of suggestions) {
        const lastTs = lastInterruptByIdRef.current.get(s.id) || 0;
        const okToEmit = canEmitLocalInterruption({
          now,
          idleMs,
          suggestion: s,
          lastGlobalInterruptAt: lastInterruptAtRef.current,
          lastRuleInterruptAt: lastTs,
          lastInterruptText: lastInterruptTextRef.current,
          interruptionsSentForProblem: stats.interruptionsSent,
          ignoredStreak: stats.ignoredStreak
        });
        if (!okToEmit) continue;

        lastInterruptByIdRef.current.set(s.id, now);
        lastInterruptTextRef.current = s.message;
        lastInterruptAtRef.current = now;
        stats.interruptionsSent = Number(stats.interruptionsSent || 0) + 1;

        setLiveInterruption({ message: s.message, ts: now });
        pushAiHintForProblem(problemId, s.message);
        llmMessagesRef.current = [
          ...llmMessagesRef.current,
          { role: "assistant", content: s.message }
        ];
        pendingInterruptionRef.current = { problemId, ruleId: s.id, editCount: 0 };
        break;
      }
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [code, activeProblem, isLocked, liveInterruption?.message]);

  useEffect(() => {
    if (!liveInterruption?.message) return undefined;
    if (liveInterruptionTimerRef.current) {
      clearTimeout(liveInterruptionTimerRef.current);
    }
    liveInterruptionTimerRef.current = setTimeout(() => {
      setLiveInterruption(null);
    }, 7000);
    return () => {
      if (liveInterruptionTimerRef.current) {
        clearTimeout(liveInterruptionTimerRef.current);
      }
    };
  }, [liveInterruption?.ts]);

  useEffect(() => {
    if (isLocked) return undefined;
    if (!activeProblem) return undefined;
    const delay = 16_000; // Keep proactive coach checks infrequent while typing.

    const timeout = setTimeout(async () => {
      if (proactiveInFlightRef.current) {
        return;
      }
      if (liveInterruption?.message) {
        return;
      }
      const now = Date.now();
      const problemId = String(activeProblem?.id || activeProblemId || "");
      if (!problemId) return;
      const stats = getProblemInterruptionStats(problemId);
      const localSuggestions = analyzeCodeForInterruptions({
        code,
        problem: activeProblem,
        hasUserExplainedApproach: hasUserExplainedApproachRef.current
      });
      const shouldCall = shouldRequestProactiveInterruption({
        now,
        codeChanged: code !== lastProactiveCodeRef.current,
        idleMs: now - lastEditAtRef.current,
        localSuggestions,
        ignoredStreak: stats.ignoredStreak,
        interruptionsSentForProblem: stats.interruptionsSent,
        proactiveCallsForProblem: stats.proactiveCalls,
        lastGlobalInterruptAt: lastInterruptAtRef.current,
        lastProactiveAt: stats.lastProactiveAt || lastProactiveAtRef.current,
        lastProgressAt: stats.lastProgressAt
      });
      if (!shouldCall) return;

      proactiveInFlightRef.current = true;
      stats.proactiveCalls = Number(stats.proactiveCalls || 0) + 1;
      stats.lastProactiveAt = now;
      lastProactiveCodeRef.current = code;

      try {
        const testSummary = testRunByProblemIdRef.current?.[problemId]?.summary || null;
        const prompt = buildProactivePrompt({
          problem: activeProblem,
          code,
          localSuggestions,
          testSummary,
          lastUserMessage: lastUserMessageRef.current,
          stuckForMs: now - Number(stats.lastProgressAt || now)
        });
        const data = await sendChat({
          messages: [{ role: "user", content: prompt }],
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

        const reply = String(data?.reply || "").trim();
        if (!reply) {
          return;
        }
        if (lastProactiveHintRef.current === reply) {
          return;
        }

        const emitAt = Date.now();
        if (emitAt - lastInterruptAtRef.current < 10_000) {
          return;
        }

        lastProactiveHintRef.current = reply;
        lastInterruptTextRef.current = reply;
        lastInterruptAtRef.current = emitAt;
        stats.interruptionsSent = Number(stats.interruptionsSent || 0) + 1;
        llmMessagesRef.current = [
          ...llmMessagesRef.current,
          { role: "assistant", content: reply }
        ];
        // Also surface in the editor area so it's obvious.
        setLiveInterruption({ message: reply, ts: emitAt });
        pushAiHintForProblem(problemId, reply);
        pendingInterruptionRef.current = { problemId, ruleId: "proactive", editCount: 0 };
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
  }, [code, activeProblem, activeProblemId, isLocked, liveInterruption?.message]);

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

function __ici_canonicalizeGroupAnagrams(value) {
  if (!Array.isArray(value)) return value;
  const groups = value
    .filter((g) => Array.isArray(g))
    .map((g) => g.map((x) => String(x)).sort());
  groups.sort((a, b) => a.join("\\u0000").localeCompare(b.join("\\u0000")));
  return groups;
}

function __ici_isEqual(problemId, actual, expected) {
  if (problemId === "group-anagrams") {
    return __ici_deepEqual(__ici_canonicalizeGroupAnagrams(actual), __ici_canonicalizeGroupAnagrams(expected));
  }
  return __ici_deepEqual(actual, expected);
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

  function __ici_runLRUCase(ops, argsList) {
    if (!Array.isArray(ops) || !Array.isArray(argsList)) {
      throw new Error("LRU tests must provide [ops, argsList].");
    }
    let cache = null;
    const out = [];
    for (let i = 0; i < ops.length; i++) {
      const op = String(ops[i] || "");
      const args = Array.isArray(argsList[i]) ? argsList[i] : [];
      if (op === "LRUCache") {
        cache = new (fn.bind.apply(fn, [null].concat(args)))();
        out.push(null);
        continue;
      }
      if (!cache) {
        throw new Error("LRUCache not constructed before operations.");
      }
      if (op === "put") {
        cache.put.apply(cache, args);
        out.push(null);
        continue;
      }
      if (op === "get") {
        out.push(cache.get.apply(cache, args));
        continue;
      }
      out.push(null);
    }
    return out;
  }

  for (let i = 0; i < __ici_tests.length; i++) {
    const t = __ici_tests[i];
    try {
      const actual =
        __ici_problemId === "lru-cache"
          ? __ici_runLRUCase((t.args || [])[0], (t.args || [])[1])
          : fn.apply(null, Array.isArray(t.args) ? t.args : []);
      const ok = __ici_isEqual(__ici_problemId, actual, t.expected);
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

  const handleRunTests = (problemIdOverride = null) => {
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

    const pid = String(problemIdOverride || activeProblem?.id || "");
    const problem = PROBLEMS.find((p) => p.id === pid) || activeProblem;
    if (!problem) return;
    const effectiveCode =
      pid === String(activeProblem?.id || "")
        ? String(code || "")
        : typeof codeByProblemId?.[pid] === "string"
          ? String(codeByProblemId?.[pid] || "")
          : buildStarterCode(problem);

    const nextRunId = runIdRef.current + 1;
    runIdRef.current = nextRunId;
    setConsoleEntries((prev) => [
      ...prev,
      {
        id: `system-${nextRunId}-${Date.now()}`,
        ts: Date.now(),
        runId: nextRunId,
        level: "system",
        text: `Tests: ${problem.title}`
      }
    ]);

    const testCode = `${effectiveCode}\n\n${buildTestHarness(problem, nextRunId)}`;
    iframeWindow.postMessage(
      { __ICIRunner__: true, type: "RUN", runId: nextRunId, code: testCode },
      "*"
    );
  };

  const addProblemToMultiSession = () => {
    if (!isMultiPracticeEffective) return;
    setMultiPracticeSession((prev) => {
      const cur = normalizeMultiPracticeSession(prev, activeProblemId || DEFAULT_PROBLEM_ID);
      if (cur.problemIds.length >= MULTI_PRACTICE_MAX) return cur;
      const nextId = pickNextUnlockedProblemId({ excludeIds: cur.problemIds, unlocks, problems: PROBLEMS });
      if (!nextId) {
        pushToast("info", "Multi practice", "No unlocked problems available to add.");
        return cur;
      }
      return { ...cur, problemIds: [...cur.problemIds, nextId] };
    });
  };

  const removeProblemFromMultiSession = (problemId) => {
    const pid = String(problemId || "");
    if (!pid) return;
    setMultiPracticeSession((prev) => {
      const cur = normalizeMultiPracticeSession(prev, activeProblemId || DEFAULT_PROBLEM_ID);
      if (cur.problemIds.length <= 1) return cur;
      const nextIds = cur.problemIds.filter((x) => x !== pid);
      const wasActive = pid === String(activeProblemId || "");
      const nextActiveIndex = Math.max(0, Math.min(nextIds.length - 1, cur.activeIndex));
      const next = { ...cur, problemIds: nextIds, activeIndex: nextActiveIndex };
      if (wasActive) {
        const nextPid = next.problemIds[next.activeIndex] || next.problemIds[0] || null;
        if (nextPid) setActiveProblemId(nextPid);
      }
      return next;
    });
  };

  const replaceMultiSessionSlot = (slotIndex, nextProblemId) => {
    const pid = String(nextProblemId || "");
    if (!pid) return;
    setMultiPracticeSession((prev) => {
      const cur = normalizeMultiPracticeSession(prev, activeProblemId || DEFAULT_PROBLEM_ID);
      const i = Math.max(0, Math.min(cur.problemIds.length - 1, Number(slotIndex) || 0));
      const nextIds = [...cur.problemIds];
      nextIds[i] = pid;
      const unique = Array.from(new Set(nextIds)).slice(0, MULTI_PRACTICE_MAX);
      const nextActiveIndex = Math.max(0, Math.min(unique.length - 1, cur.activeIndex));
      const next = { ...cur, problemIds: unique, activeIndex: nextActiveIndex };
      if (i === cur.activeIndex) setActiveProblemId(pid);
      return next;
    });
  };

  const [multiSummaryModal, setMultiSummaryModal] = useState({
    isOpen: false,
    isWorking: false,
    text: "",
    error: ""
  });

  const openMultiSummary = () => {
    setMultiSummaryModal({ isOpen: true, isWorking: false, text: "", error: "" });
  };

  const generateMultiSummary = async () => {
    const ids = (multiPracticeSession?.problemIds || []).map(String).filter(Boolean).slice(0, MULTI_PRACTICE_MAX);
    const problems = ids.map((pid) => PROBLEMS.find((p) => p.id === pid)).filter(Boolean);
    if (problems.length === 0) return;

    setMultiSummaryModal((prev) => ({ ...prev, isWorking: true, error: "" }));
    try {
      const payload = problems.map((p) => {
        const pid = String(p.id || "");
        const summary = testRunByProblemId?.[pid]?.summary || null;
        return {
          id: pid,
          title: p.title,
          difficulty: p.difficulty,
          signature: p.signature,
          approachNotes: String(approachNotesByProblemId?.[pid] || ""),
          testsPassed: Number(summary?.passed || 0),
          testsTotal: Number(summary?.total || 0),
          solved: Boolean(solvedByProblemId?.[pid]),
          code: String(codeByProblemId?.[pid] || buildStarterCode(p))
        };
      });

      const prompt = [
        "Create a multi-problem practice session summary and pattern analysis.",
        "",
        "Output format (use headings):",
        "## Session summary",
        "- One short paragraph",
        "## Per-problem notes",
        "- For each problem: approach + what to improve",
        "## Patterns across problems",
        "- Identify recurring techniques (e.g. hash map, two pointers, sliding window, stack, BFS/DFS, DP)",
        "- Common pitfalls you noticed and how to avoid them",
        "- A short “pattern recognition checklist” I can apply next time",
        "",
        "Here are the problems and my current work (JSON):",
        safeStringify(payload)
      ].join("\n");

      const data = await sendChat({
        mode: "summary",
        messages: [{ role: "user", content: prompt }],
        context: { title: "Multi-problem practice session summary" }
      });
      setMultiSummaryModal((prev) => ({ ...prev, text: String(data?.reply || ""), isWorking: false }));
    } catch (e) {
      setMultiSummaryModal((prev) => ({
        ...prev,
        error: e?.message || "Unable to generate summary right now.",
        isWorking: false
      }));
    }
  };

  const handleSend = async (overrideText = null) => {
    const raw = overrideText == null ? input : String(overrideText);
    const trimmed = raw.trim();
    if (!trimmed || isSending) {
      return;
    }

    // Heuristic: any meaningful user message counts as "approach explained"
    // so we don't keep interrupting with "explain first".
    if (trimmed.length >= 20) {
      hasUserExplainedApproachRef.current = true;
    }
    lastUserMessageRef.current = trimmed;
    if (activeProblem?.id) {
      const stats = getProblemInterruptionStats(activeProblem.id);
      stats.ignoredStreak = 0;
      if (pendingInterruptionRef.current?.problemId === String(activeProblem.id)) {
        pendingInterruptionRef.current = null;
      }
    }

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    if (overrideText == null) setInput("");
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

  const createInterviewHubSession = async () => withHubBusy(async () => {
    const questionIds = hubSelectedQuestionIds.length ? hubSelectedQuestionIds : [String(activeProblemId)];
    const created = await createSession(
      {
        title: hubSessionTitle || "Interview session",
        questionIds,
        settings: {
          hintsEnabled: hubHintsEnabled,
          hintMode: hubHintMode,
          aiInterviewerChatEnabled: true
        }
      },
      { ...hubActor, role: "interviewer" }
    );
    setHubSession(created);
    setHubShareCode(String(created?.shareCode || ""));
    setHubActiveQuestionId(String(created?.questionIds?.[0] || questionIds[0] || ""));
    pushToast("success", "Interview Hub", `Session created. Share code: ${created?.shareCode || "N/A"}`);
  });

  const joinInterviewHubSession = async () => withHubBusy(async () => {
    const joined = await joinSession(
      {
        shareCode: hubShareCode.trim(),
        userId: hubActor.userId,
        displayName: hubActor.displayName
      },
      { ...hubActor, role: "candidate" }
    );
    setHubSession(joined?.session || null);
    setHubJoinedCandidateId(String(joined?.candidateId || ""));
    const firstQuestion = String(joined?.session?.questionIds?.[0] || "");
    if (firstQuestion) {
      setHubActiveQuestionId(firstQuestion);
      if (PROBLEMS.some((p) => p.id === firstQuestion)) {
        setActiveProblemId(firstQuestion);
      }
    }
    setHubAiMessages([
      { role: "assistant", content: "Connected. Ask for hints or discuss your approach with AI interviewer." }
    ]);
    pushToast("success", "Interview Hub", "Joined interview session.");
  });

  const assignInterviewHubQuestions = async () => withHubBusy(async () => {
    if (!hubSession?.id) throw new Error("Create a session first.");
    const questionIds = hubSelectedQuestionIds.length ? hubSelectedQuestionIds : [String(activeProblemId)];
    await assignQuestions(
      hubSession.id,
      {
        questionIds,
        activeQuestionId: hubActiveQuestionId || questionIds[0],
        candidateIds: hubSelectedCandidateId ? [hubSelectedCandidateId] : []
      },
      { ...hubActor, role: "interviewer" }
    );
    pushToast("success", "Interview Hub", "Questions assigned.");
    await refreshHubCandidates();
  });

  const saveHubHintPolicy = async () => withHubBusy(async () => {
    if (!hubSession?.id) throw new Error("Create a session first.");
    await updateHintSettings(
      hubSession.id,
      {
        hintsEnabled: hubHintsEnabled,
        hintMode: hubHintMode,
        aiInterviewerChatEnabled: true
      },
      { ...hubActor, role: "interviewer" }
    );
    pushToast("success", "Interview Hub", "Global hint policy updated.");
  });

  const saveHubCandidateHintPolicy = async () => withHubBusy(async () => {
    if (!hubSession?.id || !hubSelectedCandidateId) throw new Error("Pick a candidate first.");
    await updateCandidateHintSettings(
      hubSession.id,
      hubSelectedCandidateId,
      {
        allowHints: hubCandidateAllowHints,
        mode: hubCandidateHintMode
      },
      { ...hubActor, role: "interviewer" }
    );
    pushToast("success", "Interview Hub", "Candidate hint policy updated.");
    await refreshHubCandidates();
  });

  const createHubCustomQuestion = async () => withHubBusy(async () => {
    const title = hubCustomTitle.trim();
    const description = hubCustomDescription.trim();
    if (!title || !description) throw new Error("Custom question title and description are required.");
    const created = await createQuestion(
      {
        title,
        description,
        difficulty: hubCustomDifficulty,
        category: "Custom",
        starterCode: "function solve(input) {\n  // TODO\n  return null;\n}",
        hints: [],
        testCases: [],
        solution: ""
      },
      { ...hubActor, role: "interviewer" }
    );
    setHubQuestions((prev) => [created, ...(Array.isArray(prev) ? prev : [])]);
    setHubSelectedQuestionIds((prev) => Array.from(new Set([created.id, ...(prev || [])])));
    setHubCustomTitle("");
    setHubCustomDescription("");
    pushToast("success", "Interview Hub", "Custom question added.");
  });

  const evaluateHubCandidate = async () => withHubBusy(async () => {
    if (!hubSession?.id || !hubSelectedCandidateId) throw new Error("Pick a candidate first.");
    await evaluateCandidate(hubSession.id, hubSelectedCandidateId, { ...hubActor, role: "interviewer" });
    await refreshHubCandidates();
    await refreshHubLeaderboard();
    pushToast("success", "Interview Hub", "Candidate evaluated.");
  });

  const compareHubCandidates = async () => withHubBusy(async () => {
    if (!hubSession?.id) throw new Error("Create a session first.");
    const comparison = await compareCandidates(hubSession.id, { ...hubActor, role: "interviewer" });
    setHubComparison(comparison || null);
    await refreshHubLeaderboard();
  });

  const requestHubHint = async () => withHubBusy(async () => {
    if (!hubSession?.id || !hubJoinedCandidateId) throw new Error("Join a session as candidate first.");
    const response = await requestHint(
      hubSession.id,
      hubJoinedCandidateId,
      {
        questionId: activeProblemId,
        code,
        activity: {
          secondsSinceLastMeaningfulEdit: 200,
          consecutiveFailedRuns: Number(activeTestRun?.summary?.passed || 0) < Number(activeTestRun?.summary?.total || 0) ? 3 : 0,
          repeatedRuntimeErrors: false
        }
      },
      { ...hubActor, role: "candidate" }
    );
    const hint = String(response?.hint || "No hint available.");
    setMessages((prev) => [...prev, { role: "assistant", content: `Interview hint: ${hint}` }]);
    setAiHintByProblemId((prev) => ({ ...(prev || {}), [String(activeProblemId)]: hint }));
  });

  const sendHubAiMessage = async () => withHubBusy(async () => {
    const text = hubAiInput.trim();
    if (!text) return;
    if (!hubSession?.id || !hubJoinedCandidateId) throw new Error("Join a session first.");
    const nextMessages = [...hubAiMessages, { role: "user", content: text }];
    setHubAiMessages(nextMessages);
    setHubAiInput("");
    const result = await sendInterviewerChat(
      hubSession.id,
      hubJoinedCandidateId,
      {
        messages: nextMessages.slice(-12),
        questionId: activeProblemId,
        code,
        isHintRequest: /\bhint\b/i.test(text)
      },
      { ...hubActor, role: "candidate" }
    );
    setHubAiMessages((prev) => [...prev, { role: "assistant", content: String(result?.reply || "No response.") }]);
  });

  const activeSolved = Boolean(solvedByProblemId?.[activeProblem?.id]);
  const activeTestRun = testRunByProblemId?.[activeProblem?.id] || null;
  const displayMessages = useMemo(() => [...messages].reverse(), [messages]);
  const revealedCount = Math.min(
    Number(revealedHintCount?.[activeProblem?.id] || 0),
    activeProblem?.hints?.length || 0
  );

  const revealNextHint = () => {
    if (!activeProblem?.id) return;
    if (!Array.isArray(activeProblem?.hints) || activeProblem.hints.length === 0) {
      // No built-in hints; ask the coach instead.
      handleSend(`Can I get a hint for "${activeProblem?.title || "this problem"}"?`);
      return;
    }
    setRevealedHintCount((prev) => ({
      ...(prev || {}),
      [activeProblem.id]: Math.min((prev?.[activeProblem.id] || 0) + 1, activeProblem.hints.length)
    }));
  };

  const resetHints = () => {
    if (!activeProblem?.id) return;
    setRevealedHintCount((prev) => ({ ...(prev || {}), [activeProblem.id]: 0 }));
  };

  const handleExplainApproach = () => {
    const title = activeProblem?.title || "this problem";
    handleSend(
      `Explain the best approach for "${title}" (high-level steps + time/space complexity), and mention common pitfalls.`
    );
  };

  const handleNextProblemOrRound = () => {
    if (isInterviewMode) {
      advanceInterviewRound("stopped");
      return;
    }

    const currentIdx = PROBLEMS.findIndex((p) => p.id === activeProblemId);
    for (let step = 1; step <= PROBLEMS.length; step++) {
      const idx = (currentIdx + step) % PROBLEMS.length;
      const candidate = PROBLEMS[idx];
      if (!candidate) continue;
      if (isProblemUnlocked(candidate, unlocks)) {
        setActiveProblemId(candidate.id);
        pushToast("success", "Next problem", candidate.title);
        return;
      }
    }
    pushToast("info", "Next problem", "No unlocked problems available.");
  };

  const handleStopOrNext = () => {
    if (isInterviewMode) {
      advanceInterviewRound("stopped");
    } else {
      stopInterview("stopped");
    }
  };

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

  const startInterviewSimulation = async ({ recordVideo = false } = {}) => {
    if (recordVideo) {
      const ok = await startRecording();
      if (!ok) return;
    }

    const rounds = buildInterviewRounds({ codingRounds: 2, includeSystemDesign: true });
    const now = Date.now();
    const first = rounds[0] ? { ...rounds[0], startedAt: now } : null;
    if (!first) return;

    setMode("interview");
    setInterviewSession({
      id: randomId("interview"),
      startedAt: now,
      rounds: [first, ...rounds.slice(1)],
      roundIndex: 0
    });

    if (first.type === "coding") {
      setActiveProblemId(String(first.problemId || DEFAULT_PROBLEM_ID));
      setDifficulty(String(first.difficulty || "Easy"));
      setIsLocked(false);
    } else {
      setIsLocked(true);
    }
    setTimeLimitSeconds(Number(first.seconds || 15 * 60));
    timerStartAtRef.current = Date.now();
    setElapsedSeconds(0);
    setIsPaused(false);
    setIsVoiceHold(false);
    setBehavioralAnswer("");
    setSystemDesignAnswer("");
    setFeedbackText("");
    setLiveInterruption(null);
    setAiHintByProblemId({});
    setConsoleEntries([]);
    setMessages([
      {
        role: "assistant",
        content:
          "Welcome to Interview Simulation. As you work, I may interrupt with quick nudges. Explain your approach first."
      }
    ]);
    llmMessagesRef.current = [];
    lastCodeSentRef.current = "";
    lastProactiveCodeRef.current = "";
    lastProactiveHintRef.current = "";
    lastInterruptByIdRef.current = new Map();
    lastInterruptTextRef.current = "";
    lastInterruptAtRef.current = 0;
    lastEditAtRef.current = 0;
    lastUserMessageRef.current = "";
    interruptionStatsByProblemRef.current = new Map();
    pendingInterruptionRef.current = null;
    hasUserExplainedApproachRef.current = false;
  };

  const templateContextVars = useMemo(() => {
    const hints = Array.isArray(activeProblem?.hints) ? activeProblem.hints : [];
    return {
      code: String(code || ""),
      problemTitle: String(activeProblem?.title || ""),
      problemDescription: String(activeProblem?.description || ""),
      problemSignature: String(activeProblem?.signature || ""),
      difficulty: String(difficulty || ""),
      hints: hints.join("\n")
    };
  }, [code, activeProblem, difficulty]);

  return (
    <div
      className={`app ${uiPrefs.focusMode ? `app--focus ${uiPrefs.focusZen ? "app--focus-zen" : ""}` : ""}`}
      style={
        uiPrefs.focusMode
          ? {
              "--focus-backdrop-opacity": String(uiPrefs.focusBackdropOpacity),
              "--focus-backdrop-blur": `${uiPrefs.focusBackdropBlur}px`
            }
          : undefined
      }
    >
      {toast ? (
        <div className={`toast toast--${toast.kind || "info"}`} role="status" aria-live="polite">
          <div className="toast__main">
            <div className="toast__title">{toast.title || "Update"}</div>
            <div className="toast__msg">{toast.message || ""}</div>
          </div>
          <button
            type="button"
            className="toast__close"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
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
      <Modal
        isOpen={multiSummaryModal.isOpen}
        title="Multi-problem session summary"
        onClose={() => setMultiSummaryModal({ isOpen: false, isWorking: false, text: "", error: "" })}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="prefs__btn"
              onClick={generateMultiSummary}
              disabled={multiSummaryModal.isWorking}
            >
              {multiSummaryModal.isWorking ? "Generating..." : "Generate summary"}
            </button>
            <div className="prefs__note" style={{ margin: 0 }}>
              Includes a cross-problem “patterns” section.
            </div>
          </div>
          {multiSummaryModal.error ? (
            <div className="templates__error">{multiSummaryModal.error}</div>
          ) : null}
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontWeight: 700 }}>
            {multiSummaryModal.text || "Click “Generate summary” to create a multi-problem session summary."}
          </pre>
        </div>
      </Modal>

      <FocusModeOverlay
        isEnabled={uiPrefs.focusMode}
        zenEnabled={uiPrefs.focusZen}
        backdropOpacity={uiPrefs.focusBackdropOpacity}
        backdropBlur={uiPrefs.focusBackdropBlur}
        onExit={() => setUiPrefs((prev) => ({ ...prev, focusMode: false }))}
        onChangePrefs={(patch) =>
          setUiPrefs((prev) => ({
            ...prev,
            ...patch
          }))
        }
      />
      <PromptTemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        storageUserId={storageUserId}
        customTemplates={promptTemplates}
        onChangeCustomTemplates={setPromptTemplates}
        contextVars={templateContextVars}
        onRunPrompt={(text) => handleSend(text)}
      />
      <CodeTranslationModal
        isOpen={isTranslateOpen}
        onClose={() => setIsTranslateOpen(false)}
        problem={
          activeProblem
            ? {
                id: activeProblem.id,
                title: activeProblem.title,
                signature: activeProblem.signature,
                functionName: activeProblem.functionName,
                difficulty: activeProblem.difficulty,
                tests: activeProblem.tests
              }
            : null
        }
        code={code}
        onApplyCode={(next) => {
          setCode(next);
          setIsTranslateOpen(false);
        }}
      />
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthed={handleAuthed}
      />
      <CodeReplayModal
        isOpen={replayModal.isOpen}
        onClose={() => setReplayModal({ isOpen: false, replayId: null, sessionReplayIds: [] })}
        initialReplayId={replayModal.replayId}
        sessionReplayIds={replayModal.sessionReplayIds}
        replayIndex={replayIndex}
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
        gamification={gamification}
        onLogOut={handleLogOut}
        onOpenReplay={openReplay}
      />
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        problems={PROBLEMS}
        initialProblemId={activeProblemId}
        storageUserId={storageUserId}
        gamification={gamification}
        onUpdateGamification={setGamification}
      />

      <div className="app__shell">
        <aside className="app__sidebar" aria-label="Interview controls and navigation">
          <div className="app__brand">
            <div className="app__brand-title">Live AI Coding Interviewer</div>
            <div className="app__brand-sub">Practice faster with focused navigation.</div>
          </div>

          <div className="app__sidebar-section" aria-label="Sidebar navigation">
            <div className="app__sidebar-nav" role="tablist" aria-label="Sidebar screens">
              <button
                type="button"
                role="tab"
                aria-selected={sidebarScreen === "session"}
                className={`app__sidebar-nav-btn ${sidebarScreen === "session" ? "is-active" : ""}`}
                onClick={() => setSidebarScreen("session")}
              >
                Workspace
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarScreen === "interview"}
                className={`app__sidebar-nav-btn ${sidebarScreen === "interview" ? "is-active" : ""}`}
                onClick={() => setSidebarScreen("interview")}
              >
                Interview
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarScreen === "settings"}
                className={`app__sidebar-nav-btn ${sidebarScreen === "settings" ? "is-active" : ""}`}
                onClick={() => setSidebarScreen("settings")}
              >
                Settings
              </button>
            </div>
          </div>

          <div className="app__sidebar-section" aria-label="Quick session info">
            <div className="time-card" data-tutorial="timer">
              <div className="time-tracker">
                <span className="time-tracker__label">Time left</span>
                <span className="time-tracker__value">{isTimeUp ? "00:00" : formatTime(remainingSeconds)}</span>
                {isTimeUp && <span className="time-tracker__status">Time is up</span>}
              </div>
            </div>
            <button
              type="button"
              className="tutorial-trigger"
              onClick={() => setUiPrefs((prev) => ({ ...prev, focusMode: !prev.focusMode }))}
              aria-label="Toggle Focus Mode"
            >
              {uiPrefs.focusMode ? "Exit Focus Mode" : "Focus Mode"}
            </button>
            <div className="prefs" style={{ marginTop: 10 }}>
              <label className="prefs__field" style={{ marginBottom: 8 }}>
                <span className="prefs__label">Interview role</span>
                <select value={hubRole} onChange={(e) => setHubRole(e.target.value)} aria-label="Interview role">
                  <option value="interviewer">Interviewer</option>
                  <option value="candidate">Candidate</option>
                </select>
              </label>
              <button
                type="button"
                className="prefs__btn prefs__btn--ghost"
                onClick={() => setSidebarScreen("interview")}
              >
                Open Interview Hub
              </button>
            </div>
          </div>

          <div className="app__sidebar-section app__sidebar-section--bottom" aria-label="Account">
            <div className="prefs__note">
              Signed in as {currentUser ? currentUser.username : "Guest"}.
              <span>Sidebar actions are now non-modal only.</span>
            </div>
            {currentUser ? (
              <button
                type="button"
                className="user-actions__btn"
                onClick={handleLogOut}
                aria-label="Log out"
              >
                Log out
              </button>
            ) : null}
          </div>
        </aside>

        <div className="app__content">
          {sidebarScreen === "session" ? (
            <main id="main-content" className={`app__main ${isRightPanelCollapsed ? "app__main--right-collapsed" : ""}`}>
        <div className="app__left">
          <section className="panel panel--editor" data-tutorial="editor">
            <div className="panel__header panel__header--editor">
              <span>Editor</span>
              <div className="panel__header-actions">
                {isMultiPracticeEffective ? (
                  <span className="multi__kbd-hint" title="Quick switching shortcuts">
                    Ctrl/⌘+1..3 · Ctrl/⌘+Shift+←/→
                  </span>
                ) : null}
                <button
                  type="button"
                  className="panel__collapse-btn"
                  onClick={() => setIsRightPanelCollapsed((prev) => !prev)}
                  aria-expanded={!isRightPanelCollapsed}
                  aria-label={isRightPanelCollapsed ? "Expand right panel" : "Collapse right panel"}
                >
                  {isRightPanelCollapsed ? "Show right panel" : "Hide right panel"}
                </button>
              </div>
            </div>

            {isMultiPracticeEffective ? (
              <div className="multi-tabs" role="tablist" aria-label="Multi-problem tabs">
                {(multiPracticeSession?.problemIds || []).map((pid) => {
                  const p = PROBLEMS.find((x) => x.id === pid) || null;
                  const isActive = pid === activeProblemId;
                  return (
                    <div key={pid} className={`multi-tabs__tabwrap ${isActive ? "is-active" : ""}`}>
                      <button
                        type="button"
                        className={`multi-tabs__tab ${isActive ? "is-active" : ""}`}
                        onClick={() => setActiveProblemId(pid)}
                        role="tab"
                        aria-selected={isActive}
                      >
                        {p?.title || pid}
                      </button>
                      <button
                        type="button"
                        className="multi-tabs__close"
                        onClick={() => removeProblemFromMultiSession(pid)}
                        aria-label={`Remove ${(p?.title || pid)} from session`}
                        title="Remove from session"
                        disabled={(multiPracticeSession?.problemIds || []).length <= 1}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="multi-tabs__add"
                  onClick={addProblemToMultiSession}
                  disabled={(multiPracticeSession?.problemIds || []).length >= MULTI_PRACTICE_MAX}
                  aria-label="Add problem to session"
                  title="Add problem"
                >
                  + Add
                </button>
              </div>
            ) : null}

            <div className="editor__body">
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
                theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
                value={code}
                onMount={(editor, monaco) => {
                  editorRef.current = editor;
                  monacoRef.current = monaco;
                  setEditorReadyTick((t) => t + 1);
                }}
                onChange={(value) => setCode(value ?? "")}
                options={editorOptions}
              />
            </div>
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

        <div className={`app__right ${isRightPanelCollapsed ? "is-collapsed" : ""}`} aria-hidden={isRightPanelCollapsed}>
          {!isRightPanelCollapsed ? (
            <>
          {isMultiPracticeEffective ? (
            <section className="panel panel--multi">
              <div className="panel__header panel__header--multi">
                <span>Multi-problem practice</span>
                <div className="multi__actions">
                  <button
                    type="button"
                    className="chat__header-btn"
                    onClick={() => {
                      openMultiSummary();
                      generateMultiSummary();
                    }}
                  >
                    Session summary
                  </button>
                </div>
              </div>
              <div className="multi">
                <div className={`multi__grid multi__grid--${(multiPracticeSession?.problemIds || []).length}`}>
                  {(multiPracticeSession?.problemIds || []).map((pid, idx) => {
                    const p = PROBLEMS.find((x) => x.id === pid) || null;
                    const summary = testRunByProblemId?.[pid]?.summary || null;
                    const passed = Number(summary?.passed || 0);
                    const total = Number(summary?.total || 0);
                    const solved = Boolean(solvedByProblemId?.[pid]);
                    const note = String(approachNotesByProblemId?.[pid] || "");
                    const snapshot =
                      typeof codeByProblemId?.[pid] === "string"
                        ? String(codeByProblemId?.[pid] || "")
                        : p
                          ? buildStarterCode(p)
                          : "";

                    return (
                      <div key={pid} className={`multi__card ${pid === activeProblemId ? "is-active" : ""}`}>
                        <div className="multi__card-top">
                          <div className="multi__title">{p?.title || pid}</div>
                          <div className="multi__meta">
                            <span className={`multi__pill ${solved ? "is-solved" : ""}`}>
                              {solved ? "Solved" : (p?.difficulty || "—")}
                            </span>
                            <span className="multi__pill">
                              Tests: {passed}/{total}
                            </span>
                          </div>
                        </div>

                        <div className="multi__controls">
                          <button
                            type="button"
                            className="multi__btn"
                            onClick={() => setActiveProblemId(pid)}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            className="multi__btn multi__btn--primary"
                            onClick={() => handleRunTests(pid)}
                            disabled={isLocked || isRunning}
                          >
                            Run tests
                          </button>
                        </div>

                        <label className="multi__field">
                          <span>Swap problem</span>
                          <select
                            value={pid}
                            onChange={(e) => replaceMultiSessionSlot(idx, e.target.value)}
                            disabled={isLocked}
                          >
                            {PROBLEMS.map((cand) => {
                              const unlocked = isProblemUnlocked(cand, unlocks);
                              const inUse = (multiPracticeSession?.problemIds || []).includes(cand.id) && cand.id !== pid;
                              const label = !unlocked
                                ? `${cand.title} (Locked)`
                                : inUse
                                  ? `${cand.title} (In session)`
                                  : cand.title;
                              return (
                                <option key={cand.id} value={cand.id} disabled={!unlocked || inUse}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        </label>

                        <label className="multi__field">
                          <span>Approach notes</span>
                          <textarea
                            value={note}
                            onChange={(e) => setApproachNoteForProblem(pid, e.target.value)}
                            placeholder="Write the approach (DS/algorithm, complexity, pitfalls)."
                            rows={6}
                            disabled={isLocked}
                          />
                        </label>

                        <div className="multi__codeblock">
                          <div className="multi__code-title">Code snapshot</div>
                          <pre className="multi__code">{snapshot || "// No code yet"}</pre>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="multi__hint">
                  Tip: keep short notes per problem, then generate a session summary to spot patterns.
                </div>
              </div>
            </section>
          ) : null}

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
                <div className="problem__picker">
                  {!isInterviewMode && (!unlocks.medium || !unlocks.hard) ? (
                    <div className="problem__unlock-note" role="note">
                      {!unlocks.medium
                        ? "Medium unlocks after you solve 2 Easy problems."
                        : !unlocks.hard
                          ? "Hard unlocks after you solve 2 Medium problems."
                          : null}
                    </div>
                  ) : null}
                  <select
                    className="problem__select"
                    value={activeProblemId}
                    onChange={(e) => setActiveProblemId(e.target.value)}
                    disabled={isLocked || isInterviewMode}
                    aria-label="Select coding problem"
                  >
                    {PROBLEMS.map((p) => {
                      const unlocked = isInterviewMode || isProblemUnlocked(p, unlocks);
                      const label = unlocked ? p.title : `${p.title} (Locked)`;
                      return (
                        <option key={p.id} value={p.id} disabled={!unlocked}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            <div className="problem">
              <div className="problem__meta">
                <div className="problem__name">
                  {isInterviewMode && activeInterviewRound
                    ? activeInterviewRound.type === "coding"
                      ? activeProblem.title
                      : activeInterviewRound.type === "behavioral"
                        ? "Behavioral question"
                        : activeInterviewRound.type === "system_design"
                          ? "System design"
                          : "Feedback"
                    : activeProblem.title}
                </div>
                <div className="problem__signature">
                  {isInterviewMode && activeInterviewRound && activeInterviewRound.type !== "coding"
                    ? "Interview Simulation"
                    : activeProblem.signature}
                </div>
              </div>

              {!(isInterviewMode && activeInterviewRound && activeInterviewRound.type !== "coding") ? (
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
              ) : null}

              <div className="problem__content">
                {isInterviewMode && activeInterviewRound && activeInterviewRound.type === "behavioral" && (
                  <div className="problem__section">
                    <div className="problem__block">
                      <div className="problem__block-title">Question</div>
                      <div className="problem__text">
                        {BEHAVIORAL_QUESTIONS.find((q) => q.id === activeInterviewRound.questionId)?.prompt ||
                          "Tell me about yourself."}
                      </div>
                    </div>
                    <div className="problem__block">
                      <div className="problem__block-title">Your answer</div>
                      <div className="problem__text">
                        <textarea
                          value={behavioralAnswer}
                          onChange={(e) => setBehavioralAnswer(e.target.value)}
                          placeholder="Write your answer (STAR format works well)."
                          rows={8}
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5f5",
                            borderRadius: 12,
                            padding: 12,
                            resize: "vertical"
                          }}
                        />
                        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="problem__run-tests"
                            onClick={() => advanceInterviewRound("answered")}
                          >
                            Continue
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isInterviewMode && activeInterviewRound && activeInterviewRound.type === "system_design" && (
                  <div className="problem__section">
                    <div className="problem__block">
                      <div className="problem__block-title">Prompt</div>
                      <div className="problem__text">
                        <div style={{ fontWeight: 900, marginBottom: 8 }}>
                          {SYSTEM_DESIGN_QUESTIONS.find((q) => q.id === activeInterviewRound.questionId)?.title ||
                            "System design"}
                        </div>
                        {SYSTEM_DESIGN_QUESTIONS.find((q) => q.id === activeInterviewRound.questionId)?.prompt ||
                          "Design a system."}
                      </div>
                    </div>
                    <div className="problem__block">
                      <div className="problem__block-title">Your design notes</div>
                      <div className="problem__text">
                        <textarea
                          value={systemDesignAnswer}
                          onChange={(e) => setSystemDesignAnswer(e.target.value)}
                          placeholder={`Suggested structure:\n- Requirements / non-goals\n- APIs\n- Data model\n- High-level architecture\n- Scaling + caching\n- Failure modes + retries\n- Tradeoffs`}
                          rows={12}
                          style={{
                            width: "100%",
                            border: "1px solid #cbd5f5",
                            borderRadius: 12,
                            padding: 12,
                            resize: "vertical"
                          }}
                        />
                        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="problem__run-tests"
                            onClick={() => advanceInterviewRound("answered")}
                          >
                            Continue
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isInterviewMode && activeInterviewRound && activeInterviewRound.type === "feedback" && (
                  <div className="problem__section">
                    <div className="problem__block">
                      <div className="problem__block-title">Feedback</div>
                      <div className="problem__text">
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                          {feedbackText || "Generating summary..."}
                        </pre>
                        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="problem__run-tests"
                            onClick={() => endInterviewSimulation("completed")}
                          >
                            Finish session
                          </button>
                          {recordingState.blobUrl ? (
                            <a
                              href={recordingState.blobUrl}
                              download={`interview_${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.webm`}
                              style={{ fontWeight: 900, color: "#312e81", alignSelf: "center" }}
                            >
                              Download recording
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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
                        {String(aiHintByProblemId?.[activeProblem?.id] || "").trim() ? (
                          <div className="problem__hint">
                            <div className="problem__hint-n">AI interviewer</div>
                            <div className="problem__text">{String(aiHintByProblemId?.[activeProblem?.id] || "")}</div>
                          </div>
                        ) : null}
                        {activeProblem.hints.slice(0, revealedCount).map((h, idx) => (
                          <div key={idx} className="problem__hint">
                            <div className="problem__hint-n">Hint {idx + 1}</div>
                            <div className="problem__text">{h}</div>
                          </div>
                        ))}
                        {revealedCount === 0 && !String(aiHintByProblemId?.[activeProblem?.id] || "").trim() && (
                          <div className="problem__text problem__text--muted">
                            No hints revealed yet.
                          </div>
                        )}
                      </div>
                      <div className="problem__hint-actions">
                        <button
                          type="button"
                          className="problem__hint-btn"
                          onClick={revealNextHint}
                          disabled={revealedCount >= activeProblem.hints.length}
                        >
                          Reveal next hint ({revealedCount}/{activeProblem.hints.length})
                        </button>
                        <button
                          type="button"
                          className="problem__hint-btn problem__hint-btn--ghost"
                          onClick={resetHints}
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

          <RoadmapPanel
            roadmap={roadmap}
            problems={PROBLEMS}
            solvedByProblemId={solvedByProblemId}
            onSelectProblem={(pid) => {
              if (isInterviewMode) {
                pushToast("info", "Roadmap", "Finish the interview simulation to switch problems.");
                return;
              }
              const nextId = String(pid || "");
              if (!nextId) return;
              setActiveProblemId(nextId);
              const label = PROBLEMS.find((p) => p.id === nextId)?.title || nextId;
              pushToast("success", "Roadmap", `Opened: ${label}`);
            }}
            onUpdateRoadmap={setRoadmap}
            onToast={(kind, title, message) => pushToast(kind, title, message)}
          />

          <VoicePanel
            isLocked={isLocked}
            isInterviewMode={isInterviewMode}
            isPaused={isPaused}
            messages={messages}
            onInsertCode={insertIntoEditor}
            onSendChatText={(text) => handleSend(text)}
            onRunCode={handleRunCode}
            onRunTests={handleRunTests}
            onNext={handleNextProblemOrRound}
            onStop={handleStopOrNext}
            onRevealHint={revealNextHint}
            onExplainApproach={handleExplainApproach}
            onPause={(source) => pauseInterviewTimer(source)}
            onResume={(source) => resumeInterviewTimer(source)}
            onSetVoiceHold={(v) => setIsVoiceHold(Boolean(v))}
            onToast={(kind, title, message) => pushToast(kind, title, message)}
          />

          <section className="panel panel--chat" data-tutorial="coach">
            <div className="panel__header panel__header--chat">
              <div>Interview Coach</div>
              <div className="chat__header-actions">
                <button
                  type="button"
                  className="chat__header-btn"
                  onClick={() => setIsTemplatesOpen(true)}
                >
                  Templates
                </button>
              </div>
            </div>
            <div className="chat">
              <div className="chat__messages" ref={chatMessagesRef}>
                {displayMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`chat__message chat__message--${message.role}`}
                  >
                    <div className="chat__role">{message.role}</div>
                    <div className="chat__content">{message.content}</div>
                  </div>
                ))}
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
            </>
          ) : null}
        </div>
            </main>
          ) : (
            <main id="main-content" className="app__main app__main--screen">
              {sidebarScreen === "interview" ? (
                <>
                  <section className="panel">
                    <div className="panel__header">Interviewer Hub</div>
                    <div className="prefs" style={{ padding: 16 }}>
                      <div className="prefs__note">
                        Interviewers can assign questions, monitor live code, control hint policy, and compare candidates.
                      </div>
                      <div className="prefs__grid">
                        <label className="prefs__field">
                          <span className="prefs__label">Role</span>
                          <select value={hubRole} onChange={(e) => setHubRole(e.target.value)}>
                            <option value="interviewer">Interviewer</option>
                            <option value="candidate">Candidate</option>
                          </select>
                        </label>
                        <label className="prefs__field">
                          <span className="prefs__label">Session title</span>
                          <input
                            value={hubSessionTitle}
                            onChange={(e) => setHubSessionTitle(e.target.value)}
                            placeholder="Frontend interview session"
                          />
                        </label>
                        <label className="prefs__field">
                          <span className="prefs__label">Share code</span>
                          <input
                            value={hubShareCode}
                            onChange={(e) => setHubShareCode(e.target.value.toUpperCase())}
                            placeholder="ABC123"
                          />
                        </label>
                      </div>
                      <div className="prefs__actions">
                        <button
                          type="button"
                          className="prefs__btn"
                          disabled={hubBusy || hubRole !== "interviewer"}
                          onClick={createInterviewHubSession}
                        >
                          Create session
                        </button>
                        <button
                          type="button"
                          className="prefs__btn"
                          disabled={hubBusy || hubRole !== "candidate"}
                          onClick={joinInterviewHubSession}
                        >
                          Join by code
                        </button>
                        {hubSession?.shareCode ? <span className="prefs__note">Live code: {hubSession.shareCode}</span> : null}
                      </div>

                      <div className="prefs__grid">
                        <label className="prefs__field">
                          <span className="prefs__label">Question bank</span>
                          <select
                            value=""
                            onChange={(e) => {
                              const qid = String(e.target.value || "");
                              if (!qid) return;
                              setHubSelectedQuestionIds((prev) => Array.from(new Set([...(prev || []), qid])));
                              if (!hubActiveQuestionId) setHubActiveQuestionId(qid);
                            }}
                          >
                            <option value="">Add question…</option>
                            {hubQuestions.map((q) => (
                              <option key={q.id} value={q.id}>
                                {q.title} ({q.difficulty || "?"})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="prefs__field">
                          <span className="prefs__label">Selected question IDs</span>
                          <input
                            value={hubSelectedQuestionIds.join(", ")}
                            onChange={(e) =>
                              setHubSelectedQuestionIds(
                                e.target.value.split(",").map((x) => x.trim()).filter(Boolean)
                              )
                            }
                            placeholder="two-sum, valid-parentheses"
                          />
                        </label>
                        <label className="prefs__field">
                          <span className="prefs__label">Active question ID</span>
                          <input
                            value={hubActiveQuestionId}
                            onChange={(e) => setHubActiveQuestionId(e.target.value)}
                            placeholder="question id"
                          />
                        </label>
                      </div>
                      <div className="prefs__actions">
                        <button
                          type="button"
                          className="prefs__btn"
                          disabled={hubBusy || hubRole !== "interviewer" || !hubSession?.id}
                          onClick={assignInterviewHubQuestions}
                        >
                          Assign questions
                        </button>
                        <button
                          type="button"
                          className="prefs__btn"
                          disabled={hubBusy || hubRole !== "interviewer" || !hubSession?.id}
                          onClick={() => withHubBusy(refreshHubCandidates)}
                        >
                          Refresh candidates
                        </button>
                      </div>

                      <div className="prefs__grid">
                        <label className="prefs__field">
                          <span className="prefs__label">Hints enabled</span>
                          <select
                            value={hubHintsEnabled ? "yes" : "no"}
                            onChange={(e) => setHubHintsEnabled(e.target.value === "yes")}
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                        <label className="prefs__field">
                          <span className="prefs__label">Hint mode</span>
                          <select value={hubHintMode} onChange={(e) => setHubHintMode(e.target.value)}>
                            <option value="always">Always</option>
                            <option value="manual">Manual approval</option>
                            <option value="auto_when_stuck">Auto when stuck</option>
                            <option value="disabled">Disabled</option>
                          </select>
                        </label>
                        <label className="prefs__field">
                          <span className="prefs__label">Selected candidate</span>
                          <input
                            value={hubSelectedCandidateId}
                            onChange={(e) => setHubSelectedCandidateId(e.target.value)}
                            placeholder="candidate id"
                          />
                        </label>
                      </div>
                      <div className="prefs__actions">
                        <button
                          type="button"
                          className="prefs__btn"
                          disabled={hubBusy || hubRole !== "interviewer" || !hubSession?.id}
                          onClick={saveHubHintPolicy}
                        >
                          Save global hint policy
                        </button>
                        <label className="prefs__field">
                          <span className="prefs__label">Candidate allow hints</span>
                          <select
                            value={hubCandidateAllowHints ? "yes" : "no"}
                            onChange={(e) => setHubCandidateAllowHints(e.target.value === "yes")}
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                        <label className="prefs__field">
                          <span className="prefs__label">Candidate mode</span>
                          <select value={hubCandidateHintMode} onChange={(e) => setHubCandidateHintMode(e.target.value)}>
                            <option value="always">Always</option>
                            <option value="manual">Manual</option>
                            <option value="auto_when_stuck">Auto when stuck</option>
                            <option value="disabled">Disabled</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          className="prefs__btn"
                          disabled={hubBusy || hubRole !== "interviewer" || !hubSession?.id || !hubSelectedCandidateId}
                          onClick={saveHubCandidateHintPolicy}
                        >
                          Save candidate policy
                        </button>
                      </div>

                      <div className="prefs__grid">
                        <label className="prefs__field">
                          <span className="prefs__label">Custom question title</span>
                          <input
                            value={hubCustomTitle}
                            onChange={(e) => setHubCustomTitle(e.target.value)}
                            placeholder="Custom question title"
                          />
                        </label>
                        <label className="prefs__field">
                          <span className="prefs__label">Custom difficulty</span>
                          <select value={hubCustomDifficulty} onChange={(e) => setHubCustomDifficulty(e.target.value)}>
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                        </label>
                        <label className="prefs__field">
                          <span className="prefs__label">Custom description</span>
                          <input
                            value={hubCustomDescription}
                            onChange={(e) => setHubCustomDescription(e.target.value)}
                            placeholder="Problem statement"
                          />
                        </label>
                      </div>
                      <div className="prefs__actions">
                        <button
                          type="button"
                          className="prefs__btn"
                          disabled={hubBusy || hubRole !== "interviewer"}
                          onClick={createHubCustomQuestion}
                        >
                          Add custom question
                        </button>
                        <button
                          type="button"
                          className="prefs__btn"
                          disabled={hubBusy || hubRole !== "interviewer" || !hubSession?.id || !hubSelectedCandidateId}
                          onClick={evaluateHubCandidate}
                        >
                          Evaluate candidate
                        </button>
                        <button
                          type="button"
                          className="prefs__btn"
                          disabled={hubBusy || hubRole !== "interviewer" || !hubSession?.id}
                          onClick={compareHubCandidates}
                        >
                          Compare candidates
                        </button>
                        <button
                          type="button"
                          className="prefs__btn"
                          disabled={hubBusy || hubRole !== "candidate" || !hubSession?.id || !hubJoinedCandidateId}
                          onClick={requestHubHint}
                        >
                          Request hint
                        </button>
                      </div>

                      {hubRole === "candidate" ? (
                        <div className="chat">
                          <div className="chat__messages" style={{ maxHeight: 180 }}>
                            {(hubAiMessages || []).map((m, i) => (
                              <div key={`${m.role}-${i}`} className={`chat__message chat__message--${m.role}`}>
                                <div className="chat__role">{m.role}</div>
                                <div className="chat__content">{m.content}</div>
                              </div>
                            ))}
                          </div>
                          <div className="chat__input">
                            <textarea
                              value={hubAiInput}
                              rows={2}
                              placeholder="Ask AI interviewer..."
                              onChange={(e) => setHubAiInput(e.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                  event.preventDefault();
                                  sendHubAiMessage();
                                }
                              }}
                            />
                            <button type="button" onClick={sendHubAiMessage} disabled={hubBusy}>
                              Send
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="prefs__note">Candidates ({hubCandidates.length})</div>
                          <div className="prefs__actions">
                            {hubCandidates.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                className={`prefs__btn ${hubSelectedCandidateId === c.id ? "prefs__btn--ghost" : ""}`}
                                onClick={() => setHubSelectedCandidateId(c.id)}
                              >
                                {c.displayName || c.id}
                              </button>
                            ))}
                          </div>
                          {hubSelectedCandidateId ? (
                            <div className="console" style={{ maxHeight: 220 }}>
                              <div className="console__line console__line--info">
                                Live code for {hubSelectedCandidateId}
                              </div>
                              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{hubCandidateCode || "// waiting for code..."}</pre>
                            </div>
                          ) : null}
                          {hubLeaderboard.length > 0 ? (
                            <div className="prefs__note">
                              Ranking:{" "}
                              {hubLeaderboard
                                .map((row, i) => `${i + 1}. ${row.displayName} (${row.totalScore})`)
                                .join("  |  ")}
                            </div>
                          ) : null}
                          {hubComparison?.summary ? (
                            <div className="prefs__note">Comparison summary: {hubComparison.summary}</div>
                          ) : null}
                        </>
                      )}

                      {hubError ? <div className="templates__error">{hubError}</div> : null}
                    </div>
                  </section>

                  <section className="panel">
                    <div className="panel__header">Interview Simulation</div>
                    <div className="prefs" style={{ padding: 16 }}>
                      <div className="prefs__note">
                        Multi-round flow: coding, behavioral, harder coding, system design, feedback.
                      </div>
                      <div className="prefs__actions">
                        <button type="button" className="prefs__btn" onClick={() => startInterviewSimulation()}>
                          Start simulation
                        </button>
                        <button
                          type="button"
                          className="prefs__btn"
                          onClick={() => startInterviewSimulation({ recordVideo: true })}
                        >
                          Start + record video
                        </button>
                        {isInterviewMode ? (
                          <button
                            type="button"
                            className="prefs__btn prefs__btn--danger"
                            onClick={() => endInterviewSimulation("ended")}
                          >
                            End session
                          </button>
                        ) : null}
                        {recordingState.status === "recording" ? (
                          <button type="button" className="prefs__btn" onClick={stopRecording}>
                            Stop recording
                          </button>
                        ) : null}
                      </div>
                      {recordingState.status === "error" ? (
                        <div className="templates__error">Recording error: {recordingState.error}</div>
                      ) : null}
                      {recordingState.blobUrl ? (
                        <a
                          href={recordingState.blobUrl}
                          download={`interview_${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.webm`}
                          className="prefs__note"
                          style={{ fontWeight: 900 }}
                        >
                          Download latest recording
                        </a>
                      ) : null}
                    </div>
                  </section>
                </>
              ) : null}

              {sidebarScreen === "settings" ? (
                <section className="panel">
                  <div className="panel__header">Settings</div>
                  <div className="prefs" style={{ padding: 16 }}>
                    <div className="prefs__grid">
                      <label className="prefs__field">
                        <span className="prefs__label">Theme</span>
                        <select
                          value={uiPrefs.theme}
                          onChange={(e) => setUiPrefs((prev) => ({ ...prev, theme: e.target.value }))}
                          aria-label="Theme"
                        >
                          <option value="system">System</option>
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                        </select>
                      </label>

                      <label className="prefs__field">
                        <span className="prefs__label">Accent color</span>
                        <select
                          value={uiPrefs.accent}
                          onChange={(e) => setUiPrefs((prev) => ({ ...prev, accent: e.target.value }))}
                          aria-label="Accent color"
                        >
                          <option value="indigo">Indigo</option>
                          <option value="emerald">Emerald</option>
                          <option value="rose">Rose</option>
                          <option value="amber">Amber</option>
                          <option value="cyan">Cyan</option>
                        </select>
                      </label>
                    </div>

                    <div className="prefs__toggles">
                      <label className="prefs__toggle">
                        <input
                          type="checkbox"
                          checked={uiPrefs.contrast === "high"}
                          onChange={(e) =>
                            setUiPrefs((prev) => ({
                              ...prev,
                              contrast: e.target.checked ? "high" : "normal"
                            }))
                          }
                        />
                        <span>High contrast</span>
                      </label>
                      <label className="prefs__toggle">
                        <input
                          type="checkbox"
                          checked={uiPrefs.keyboardNav}
                          onChange={(e) => setUiPrefs((prev) => ({ ...prev, keyboardNav: e.target.checked }))}
                        />
                        <span>Keyboard navigation mode</span>
                      </label>
                      <label className="prefs__toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(uiPrefs.multiPractice)}
                          onChange={(e) => {
                            const next = Boolean(e.target.checked);
                            setUiPrefs((prev) => ({ ...prev, multiPractice: next }));
                            if (next) {
                              setMultiPracticeSession((prev) =>
                                normalizeMultiPracticeSession(prev, activeProblemId || DEFAULT_PROBLEM_ID)
                              );
                            }
                          }}
                        />
                        <span>Multi-problem split practice (2-3 problems)</span>
                      </label>
                    </div>

                    <div className="prefs__actions">
                      <button
                        type="button"
                        className="prefs__btn prefs__btn--ghost"
                        onClick={() => {
                          setIsTutorialOpen(true);
                          setTutorialStepIndex(0);
                          setUiPrefs((prev) => ({ ...prev, tourSeen: true }));
                        }}
                      >
                        Restart onboarding tour
                      </button>
                      <button
                        type="button"
                        className="prefs__btn prefs__btn--danger"
                        onClick={() => setUiPrefs(UI_PREFS_DEFAULTS)}
                      >
                        Reset preferences
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}
            </main>
          )}
        </div>
      </div>
    </div>
  );
}
