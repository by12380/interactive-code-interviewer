const INTERRUPTION_POLICY = {
  LOCAL_MIN_IDLE_MS: 1100,
  LOCAL_ADVISORY_MIN_IDLE_MS: 4500,
  GLOBAL_COOLDOWN_MS: 30_000,
  PER_RULE_COOLDOWN_MS: 15_000,
  IGNORE_PENALTY_MS: 15_000,
  MAX_INTERRUPTS_PER_PROBLEM: 8,
  MAX_PROACTIVE_CALLS_PER_PROBLEM: 5,
  PROACTIVE_MIN_INTERVAL_MS: 45_000,
  STUCK_AFTER_MS: 55_000,
  MAX_CODE_CHARS_FOR_PROACTIVE: 2200,
  MAX_LOCAL_SIGNALS_IN_PROMPT: 3
};

export function classifyPriority(priority) {
  const p = Number(priority || 0);
  if (p >= 85) return "critical";
  if (p >= 70) return "high";
  if (p >= 55) return "medium";
  return "low";
}

export function computeAdaptiveCooldownMs(ignoredStreak = 0) {
  const base = INTERRUPTION_POLICY.GLOBAL_COOLDOWN_MS;
  const penalty = INTERRUPTION_POLICY.IGNORE_PENALTY_MS * Math.max(0, Number(ignoredStreak || 0));
  return base + penalty;
}

export function canEmitLocalInterruption({
  now,
  idleMs,
  suggestion,
  lastGlobalInterruptAt,
  lastRuleInterruptAt,
  lastInterruptText,
  interruptionsSentForProblem,
  ignoredStreak
}) {
  const severity = classifyPriority(suggestion?.priority);
  const minIdleMs =
    severity === "critical" || severity === "high"
      ? INTERRUPTION_POLICY.LOCAL_MIN_IDLE_MS
      : INTERRUPTION_POLICY.LOCAL_ADVISORY_MIN_IDLE_MS;
  if (idleMs < minIdleMs) return false;
  if (Number(interruptionsSentForProblem || 0) >= INTERRUPTION_POLICY.MAX_INTERRUPTS_PER_PROBLEM) return false;
  if (now - Number(lastRuleInterruptAt || 0) < INTERRUPTION_POLICY.PER_RULE_COOLDOWN_MS) return false;
  if (String(lastInterruptText || "") === String(suggestion?.message || "")) return false;
  // Let truly critical correction cues through sooner so we don't miss obvious off-track code.
  const globalCooldownMs =
    severity === "critical" ? Math.min(8000, computeAdaptiveCooldownMs(ignoredStreak)) : computeAdaptiveCooldownMs(ignoredStreak);
  if (now - Number(lastGlobalInterruptAt || 0) < globalCooldownMs) return false;
  return true;
}

export function shouldRequestProactiveInterruption({
  now,
  codeChanged,
  idleMs,
  localSuggestions,
  ignoredStreak,
  interruptionsSentForProblem,
  proactiveCallsForProblem,
  lastGlobalInterruptAt,
  lastProactiveAt,
  lastProgressAt
}) {
  if (!codeChanged) return false;
  if (idleMs < 2200) return false;
  if (Number(interruptionsSentForProblem || 0) >= INTERRUPTION_POLICY.MAX_INTERRUPTS_PER_PROBLEM) return false;
  if (Number(proactiveCallsForProblem || 0) >= INTERRUPTION_POLICY.MAX_PROACTIVE_CALLS_PER_PROBLEM) return false;
  if (now - Number(lastProactiveAt || 0) < INTERRUPTION_POLICY.PROACTIVE_MIN_INTERVAL_MS) return false;
  if (now - Number(lastGlobalInterruptAt || 0) < computeAdaptiveCooldownMs(ignoredStreak)) return false;

  const cues = Array.isArray(localSuggestions) ? localSuggestions : [];
  const topPriority = cues.length ? Number(cues[0]?.priority || 0) : 0;
  const sinceProgressMs = now - Number(lastProgressAt || 0);
  const looksStuck = sinceProgressMs >= INTERRUPTION_POLICY.STUCK_AFTER_MS;
  const hasMediumCue = topPriority >= 55 && topPriority < 85;

  // Critical/high cues should be handled locally to avoid spending API budget.
  if (topPriority >= 85) return false;
  if (!hasMediumCue && !looksStuck) return false;
  return true;
}

export function buildProactivePrompt({
  problem,
  code,
  localSuggestions,
  testSummary,
  lastUserMessage,
  stuckForMs
}) {
  const p = problem || {};
  const cues = (Array.isArray(localSuggestions) ? localSuggestions : [])
    .slice(0, INTERRUPTION_POLICY.MAX_LOCAL_SIGNALS_IN_PROMPT)
    .map((s) => `- ${String(s.message || "").trim()}`)
    .join("\n");
  const summary = testSummary
    ? `${Number(testSummary.passed || 0)}/${Number(testSummary.total || 0)} passed`
    : "no recent test run";
  const clippedCode = clip(String(code || ""), INTERRUPTION_POLICY.MAX_CODE_CHARS_FOR_PROACTIVE);
  const userMsg = String(lastUserMessage || "").trim();
  const stuckSeconds = Math.max(0, Math.floor(Number(stuckForMs || 0) / 1000));

  return [
    "Candidate status snapshot for proactive interrupt:",
    `- Problem: ${String(p.title || p.id || "unknown")}`,
    p.signature ? `- Expected signature: ${String(p.signature)}` : null,
    `- Tests: ${summary}`,
    `- Stuck estimate: ${stuckSeconds}s`,
    userMsg ? `- Last user message: ${userMsg}` : "- Last user message: (none)",
    cues ? `- Local risk cues:\n${cues}` : "- Local risk cues: none",
    "",
    "Code:",
    clippedCode || "// No code",
    "",
    "If you interrupt, output exactly one short message that starts with 'Wait,'.",
    "If no interruption is needed, return an empty string."
  ]
    .filter(Boolean)
    .join("\n");
}

function clip(text, maxChars) {
  const s = String(text || "");
  const n = Number(maxChars || 0);
  if (!n || s.length <= n) return s;
  return `${s.slice(0, n)}\n// ... truncated for cost control ...`;
}

