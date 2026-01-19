// Heuristic, fast "interviewer interrupts" based on common patterns.
// Intentionally lightweight (regex + string checks) so it can run on every edit.

function normalizeCode(code) {
  return String(code || "");
}

function hasFunctionNamed(code, name) {
  if (!name) return false;
  const n = String(name);
  // function twoSum(...) { ... }
  if (new RegExp(`\\bfunction\\s+${escapeRegExp(n)}\\s*\\(`).test(code)) return true;
  // const twoSum = (...) => { ... }
  if (new RegExp(`\\b(const|let|var)\\s+${escapeRegExp(n)}\\s*=\\s*\\(`).test(code)) return true;
  // const twoSum = function (...) { ... }
  if (new RegExp(`\\b(const|let|var)\\s+${escapeRegExp(n)}\\s*=\\s*function\\b`).test(code)) return true;
  // export default function twoSum(...) { ... }
  if (new RegExp(`\\bexport\\s+default\\s+function\\s+${escapeRegExp(n)}\\s*\\(`).test(code))
    return true;
  return false;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMatches(code, re) {
  const m = code.match(re);
  return m ? m.length : 0;
}

function includesAny(code, parts) {
  for (const p of parts) {
    if (code.includes(p)) return true;
  }
  return false;
}

function looksLikeStartedCoding(code) {
  const trimmed = String(code || "").trim();
  if (!trimmed) return false;
  // If they've only left the starter comment, don't treat as "started".
  if (/\/\/\s*Your solution here/.test(trimmed) && trimmed.split("\n").length <= 5) return false;
  // Any structural tokens suggests starting.
  return includesAny(trimmed, ["for", "while", "if", "return", "Map", "new Map", "set(", "get(", "=>"]);
}

function detectNestedLoops(code) {
  // Very rough, but good enough for immediate nudges.
  return /for\s*\([^)]*\)\s*\{[\s\S]{0,1500}for\s*\([^)]*\)\s*\{/.test(code) ||
    /while\s*\([^)]*\)\s*\{[\s\S]{0,1500}while\s*\([^)]*\)\s*\{/.test(code) ||
    /for\s*\([^)]*\)\s*\{[\s\S]{0,1500}while\s*\([^)]*\)\s*\{/.test(code) ||
    /while\s*\([^)]*\)\s*\{[\s\S]{0,1500}for\s*\([^)]*\)\s*\{/.test(code);
}

function detectSortAnagram(code) {
  // split/sort/join (or spread+sort+join)
  return (
    /split\s*\(\s*["'`"]\s*["'`"]\s*\)\s*\.sort\s*\(\s*\)\s*\.join\s*\(/.test(code) ||
    /\[\s*\.\.\.\s*\w+\s*\]\s*\.sort\s*\(\s*\)\s*\.join\s*\(/.test(code)
  );
}

function detectInputMutationInTwoSum(code) {
  // Sorting nums breaks index semantics for Two Sum.
  return /\bnums\s*\.sort\s*\(/.test(code);
}

function detectArrayUsedAsMap(code) {
  // Common bug: using [] as a hashmap.
  // e.g. const seen = []; seen[need] = i; if (seen[target - x]) ...
  const declaresArrayMap = /\b(const|let|var)\s+\w+\s*=\s*\[\s*\]\s*;?/.test(code);
  const bracketIndexing = /\b\w+\s*\[\s*[^]\n]{1,30}\s*\]\s*=/.test(code) || /\b\w+\s*\[\s*[^]\n]{1,30}\s*\]/.test(code);
  return declaresArrayMap && bracketIndexing;
}

function detectOffByOneSlidingWindow(code) {
  // Common mistake in longest-substring: moving left incorrectly without max().
  // If they do: left = lastSeen.get(ch) + 1; (without Math.max)
  return /\bleft\s*=\s*lastSeen\.get\s*\(\s*\w+\s*\)\s*\+\s*1\s*;/.test(code) && !/Math\.max\s*\(/.test(code);
}

/**
 * @returns {Array<{id: string, message: string, priority: number}>}
 */
export function analyzeCodeForInterruptions({
  code,
  problem,
  hasUserExplainedApproach
}) {
  const c = normalizeCode(code);
  const p = problem || {};
  const problemId = String(p.id || "");
  const fnName = String(p.functionName || "");

  /** @type {Array<{id: string, message: string, priority: number}>} */
  const out = [];

  // Universal: missing function name (tests won't run)
  if (fnName && c.trim() && !hasFunctionNamed(c, fnName)) {
    out.push({
      id: `missing-fn:${problemId}:${fnName}`,
      priority: 100,
      message: `Wait—your tests expect a function named "${fnName}". Can you make sure you're defining that exact function name?`
    });
  }

  // Universal: encourage approach before coding (only early in session)
  if (!hasUserExplainedApproach && looksLikeStartedCoding(c)) {
    out.push({
      id: `explain-first:${problemId}`,
      priority: 90,
      message: "Wait, can you explain your approach (and time/space complexity) before you keep coding?"
    });
  }

  if (problemId === "two-sum") {
    if (detectNestedLoops(c) || countMatches(c, /\bfor\s*\(/g) >= 2) {
      out.push({
        id: "two-sum:nested-loops",
        priority: 80,
        message:
          "Wait, are you going for a brute-force \(O(n^2)\) approach? Have you considered a hash map / Map for a single-pass solution?"
      });
    }
    if (detectInputMutationInTwoSum(c)) {
      out.push({
        id: "two-sum:mutate-input-sort",
        priority: 75,
        message:
          "Wait—if you sort `nums`, you’ll lose the original indices. How will you return the correct indices in the unsorted array?"
      });
    }
    if (detectArrayUsedAsMap(c)) {
      out.push({
        id: "two-sum:array-as-map",
        priority: 70,
        message:
          "Wait, did you mean to use an object/Map instead of an array as a lookup table? Arrays are index-based and can behave unexpectedly for arbitrary keys."
      });
    }
    if (!/\bnew\s+Map\s*\(|\{\s*\}/.test(c) && detectNestedLoops(c)) {
      out.push({
        id: "two-sum:consider-map",
        priority: 60,
        message:
          "Wait—what data structure are you using to check complements quickly? A `Map`/object can turn the lookup into \(O(1)\) average time."
      });
    }
  }

  if (problemId === "valid-anagram") {
    if (detectSortAnagram(c)) {
      out.push({
        id: "anagram:sort",
        priority: 70,
        message:
          "Wait, sorting works, but it’s \(O(n \\log n)\). Do you want to discuss a linear-time counting approach instead?"
      });
    }
    // Common bug: forgetting early length check
    if (!/s\.length\s*!==\s*t\.length/.test(c) && looksLikeStartedCoding(c)) {
      out.push({
        id: "anagram:length-check",
        priority: 55,
        message: "Wait—did you remember to handle the quick fail case when `s.length !== t.length`?"
      });
    }
  }

  if (problemId === "longest-substring") {
    if (detectNestedLoops(c)) {
      out.push({
        id: "longest-substring:nested-loops",
        priority: 75,
        message:
          "Wait, this looks like it might be quadratic. Have you considered a sliding window with a `lastSeen` map for \(O(n)\)?"
      });
    }
    if (detectOffByOneSlidingWindow(c)) {
      out.push({
        id: "longest-substring:left-max",
        priority: 65,
        message:
          "Wait—when you update `left`, are you guarding against moving it backwards? Usually you need `left = Math.max(left, lastSeen.get(ch) + 1)`."
      });
    }
  }

  out.sort((a, b) => b.priority - a.priority);
  return out;
}

