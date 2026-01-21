export const GAMIFICATION_DEFAULTS = {
  xp: 0,
  lastPracticeDay: null, // YYYY-MM-DD (local)
  streak: 0,
  longestStreak: 0,
  achievements: {}, // id -> { id, name, description, unlockedAt }
  friends: [] // array of userIds (device-local)
};

function clampNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export function normalizeGamificationState(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const achievements =
    r.achievements && typeof r.achievements === "object" && !Array.isArray(r.achievements)
      ? r.achievements
      : {};
  const friends = Array.isArray(r.friends) ? r.friends.map((x) => String(x)).filter(Boolean) : [];

  return {
    xp: Math.max(0, clampNumber(r.xp, 0)),
    lastPracticeDay: r.lastPracticeDay ? String(r.lastPracticeDay) : null,
    streak: Math.max(0, clampNumber(r.streak, 0)),
    longestStreak: Math.max(0, clampNumber(r.longestStreak, 0)),
    achievements,
    friends
  };
}

export function toLocalDayKey(ts = Date.now()) {
  const d = new Date(Number(ts));
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDayKey(dayKey) {
  const s = String(dayKey || "");
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const dt = new Date(y, mo, da, 0, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function dayDiff(aKey, bKey) {
  const a = parseDayKey(aKey);
  const b = parseDayKey(bKey);
  if (!a || !b) return null;
  const ms = 24 * 60 * 60 * 1000;
  return Math.round((a.getTime() - b.getTime()) / ms);
}

export function applyPracticeDay(prevState, nowTs = Date.now()) {
  const prev = normalizeGamificationState(prevState);
  const today = toLocalDayKey(nowTs);
  if (!today) return prev;

  const last = prev.lastPracticeDay;
  if (last === today) {
    return prev;
  }

  const diff = last ? dayDiff(today, last) : null;
  const nextStreak = diff === 1 ? prev.streak + 1 : 1;

  return {
    ...prev,
    lastPracticeDay: today,
    streak: nextStreak,
    longestStreak: Math.max(prev.longestStreak, nextStreak)
  };
}

export function xpForSolve(problemDifficulty) {
  const d = String(problemDifficulty || "").toLowerCase();
  if (d === "easy") return 50;
  if (d === "medium") return 100;
  if (d === "hard") return 175;
  return 75;
}

export function getLevelInfo(xp) {
  let level = 1;
  let remaining = Math.max(0, clampNumber(xp, 0));

  // Level curve: each level requires 200 + 75*(level-1) XP.
  // Level 1 starts at 0 XP.
  // Example: L1->L2:200, L2->L3:275, L3->L4:350, ...
  let need = 200;
  while (remaining >= need) {
    remaining -= need;
    level += 1;
    need = 200 + 75 * (level - 1);
    if (level > 2000) break; // safety
  }

  return { level, intoLevelXp: remaining, nextLevelXp: need };
}

export const ACHIEVEMENTS = [
  { id: "solved_10", name: "Solved 10", description: "Solve 10 coding problems.", kind: "solved", threshold: 10 },
  { id: "solved_50", name: "Solved 50", description: "Solve 50 coding problems.", kind: "solved", threshold: 50 },
  { id: "solved_100", name: "Solved 100", description: "Solve 100 coding problems.", kind: "solved", threshold: 100 },
  { id: "streak_3", name: "3-day streak", description: "Practice 3 days in a row.", kind: "streak", threshold: 3 },
  { id: "streak_7", name: "7-day streak", description: "Practice 7 days in a row.", kind: "streak", threshold: 7 },
  { id: "streak_30", name: "30-day streak", description: "Practice 30 days in a row.", kind: "streak", threshold: 30 },
  { id: "level_5", name: "Level 5", description: "Reach level 5.", kind: "level", threshold: 5 },
  { id: "level_10", name: "Level 10", description: "Reach level 10.", kind: "level", threshold: 10 },
  { id: "hard_1", name: "Hard hitter", description: "Solve a Hard problem.", kind: "hardSolved", threshold: 1 }
];

export function evaluateNewAchievements({
  prevState,
  solvedCount = 0,
  hardSolvedCount = 0,
  nowTs = Date.now()
}) {
  const prev = normalizeGamificationState(prevState);
  const next = { ...prev, achievements: { ...(prev.achievements || {}) } };
  const unlocked = [];

  const { level } = getLevelInfo(next.xp);
  const streak = next.streak;
  const solved = Math.max(0, clampNumber(solvedCount, 0));
  const hardSolved = Math.max(0, clampNumber(hardSolvedCount, 0));

  for (const a of ACHIEVEMENTS) {
    if (next.achievements?.[a.id]) continue;
    let ok = false;
    if (a.kind === "solved") ok = solved >= a.threshold;
    if (a.kind === "streak") ok = streak >= a.threshold;
    if (a.kind === "level") ok = level >= a.threshold;
    if (a.kind === "hardSolved") ok = hardSolved >= a.threshold;
    if (!ok) continue;

    const entry = { id: a.id, name: a.name, description: a.description, unlockedAt: Number(nowTs) };
    next.achievements[a.id] = entry;
    unlocked.push(entry);
  }

  return { nextState: next, unlocked };
}

export function computeUnlocks({ solvedByProblemId, problems }) {
  const solvedMap = solvedByProblemId && typeof solvedByProblemId === "object" ? solvedByProblemId : {};
  const list = Array.isArray(problems) ? problems : [];

  let easySolved = 0;
  let mediumSolved = 0;
  let hardSolved = 0;

  for (const p of list) {
    if (!p?.id) continue;
    if (!solvedMap[p.id]) continue;
    const d = String(p.difficulty || "").toLowerCase();
    if (d === "easy") easySolved += 1;
    else if (d === "medium") mediumSolved += 1;
    else if (d === "hard") hardSolved += 1;
  }

  // Unlock rules:
  // - Medium unlocks after solving 2 Easy problems.
  // - Hard unlocks after solving 2 Medium problems.
  return {
    easy: true,
    medium: easySolved >= 2,
    hard: mediumSolved >= 2,
    counts: { easySolved, mediumSolved, hardSolved }
  };
}

export function isProblemUnlocked(problem, unlocks) {
  const u = unlocks || { easy: true, medium: true, hard: true };
  const d = String(problem?.difficulty || "").toLowerCase();
  if (d === "easy") return Boolean(u.easy);
  if (d === "medium") return Boolean(u.medium);
  if (d === "hard") return Boolean(u.hard);
  return true;
}

