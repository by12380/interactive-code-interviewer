// Interview Preparation Roadmap + Personalization
// Pure functions + normalized state to keep App.jsx integration small.

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function toLocalDayKey(ts = Date.now()) {
  const d = new Date(Number(ts));
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const SKILLS = [
  { id: "arrays_hashmaps", label: "Arrays + Hash Maps" },
  { id: "strings", label: "Strings" },
  { id: "two_pointers", label: "Two pointers / Sliding window" },
  { id: "sorting_grouping", label: "Sorting / Grouping" },
  { id: "linked_list_cache", label: "Linked list / Cache patterns" },
  { id: "behavioral", label: "Behavioral (STAR)" },
  { id: "system_design", label: "System design fundamentals" }
];

export const COMPANY_FOCUS = {
  General: {
    label: "General",
    weights: {
      arrays_hashmaps: 1.0,
      strings: 1.0,
      two_pointers: 1.0,
      sorting_grouping: 1.0,
      linked_list_cache: 1.0,
      behavioral: 0.7,
      system_design: 0.8
    }
  },
  Google: {
    label: "Google",
    weights: {
      arrays_hashmaps: 1.15,
      strings: 1.05,
      two_pointers: 1.15,
      sorting_grouping: 1.05,
      linked_list_cache: 1.1,
      behavioral: 0.6,
      system_design: 0.95
    }
  },
  Meta: {
    label: "Meta",
    weights: {
      arrays_hashmaps: 1.1,
      strings: 1.05,
      two_pointers: 1.15,
      sorting_grouping: 1.1,
      linked_list_cache: 1.05,
      behavioral: 0.9,
      system_design: 0.9
    }
  },
  Amazon: {
    label: "Amazon",
    weights: {
      arrays_hashmaps: 1.05,
      strings: 1.0,
      two_pointers: 1.05,
      sorting_grouping: 1.0,
      linked_list_cache: 1.0,
      behavioral: 1.2,
      system_design: 1.05
    }
  }
};

export const ROADMAP_DEFAULTS = Object.freeze({
  version: 1,
  createdAt: null,
  settings: {
    targetCompany: "General", // General | Google | Meta | Amazon
    planDays: 30, // 30 | 60 | 90
    minutesPerDay: 60, // 30 | 45 | 60 | 90 | 120
    startDayKey: null
  },
  quiz: {
    completedAt: null,
    answers: {}, // skillId -> 1..5
    scores: {} // skillId -> 0..100
  },
  performance: {
    // skillId -> { attempts, solved }
    bySkill: {},
    // dayKey -> { tasksCompleted, problemsSolved }
    byDay: {}
  },
  plan: {
    generatedAt: null,
    days: [] // { dayKey, tasks: [{id, type, title, minutes, skillId?, problemId?, completedAt?}] }
  },
  progress: {
    completedTaskIds: {}, // id -> { completedAt }
    milestones: {} // id -> { id, name, description, unlockedAt }
  }
});

export function normalizeRoadmapState(raw) {
  const r = isPlainObject(raw) ? raw : {};
  const settings = isPlainObject(r.settings) ? r.settings : {};
  const quiz = isPlainObject(r.quiz) ? r.quiz : {};
  const performance = isPlainObject(r.performance) ? r.performance : {};
  const plan = isPlainObject(r.plan) ? r.plan : {};
  const progress = isPlainObject(r.progress) ? r.progress : {};

  const targetCompany = COMPANY_FOCUS[String(settings.targetCompany)] ? String(settings.targetCompany) : "General";
  const planDays = [30, 60, 90].includes(Number(settings.planDays)) ? Number(settings.planDays) : 30;
  const minutesPerDay = [30, 45, 60, 90, 120].includes(Number(settings.minutesPerDay))
    ? Number(settings.minutesPerDay)
    : 60;
  const startDayKey = settings.startDayKey ? String(settings.startDayKey) : null;

  const answers = isPlainObject(quiz.answers) ? quiz.answers : {};
  const scores = isPlainObject(quiz.scores) ? quiz.scores : {};
  const bySkill = isPlainObject(performance.bySkill) ? performance.bySkill : {};
  const byDay = isPlainObject(performance.byDay) ? performance.byDay : {};
  const completedTaskIds =
    isPlainObject(progress.completedTaskIds) ? progress.completedTaskIds : {};
  const milestones = isPlainObject(progress.milestones) ? progress.milestones : {};

  const days = Array.isArray(plan.days) ? plan.days : [];

  return {
    version: 1,
    createdAt: typeof r.createdAt === "number" ? r.createdAt : null,
    settings: { targetCompany, planDays, minutesPerDay, startDayKey },
    quiz: {
      completedAt: typeof quiz.completedAt === "number" ? quiz.completedAt : null,
      answers: normalizeSkillMap(answers, 1, 5),
      scores: normalizeSkillMap(scores, 0, 100)
    },
    performance: {
      bySkill: normalizePerformanceBySkill(bySkill),
      byDay: normalizePerformanceByDay(byDay)
    },
    plan: {
      generatedAt: typeof plan.generatedAt === "number" ? plan.generatedAt : null,
      days: normalizePlanDays(days)
    },
    progress: {
      completedTaskIds: normalizeCompletedTaskIds(completedTaskIds),
      milestones: normalizeMilestones(milestones)
    }
  };
}

function normalizeSkillMap(map, lo, hi) {
  const out = {};
  const skills = new Set(SKILLS.map((s) => s.id));
  for (const [k, v] of Object.entries(isPlainObject(map) ? map : {})) {
    const id = String(k);
    if (!skills.has(id)) continue;
    out[id] = clamp(v, lo, hi);
  }
  return out;
}

function normalizePerformanceBySkill(raw) {
  const out = {};
  const skills = new Set(SKILLS.map((s) => s.id));
  for (const [k, v] of Object.entries(isPlainObject(raw) ? raw : {})) {
    const id = String(k);
    if (!skills.has(id)) continue;
    const r = isPlainObject(v) ? v : {};
    out[id] = {
      attempts: Math.max(0, Math.floor(Number(r.attempts) || 0)),
      solved: Math.max(0, Math.floor(Number(r.solved) || 0))
    };
  }
  return out;
}

function normalizePerformanceByDay(raw) {
  const out = {};
  for (const [k, v] of Object.entries(isPlainObject(raw) ? raw : {})) {
    const dayKey = String(k || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) continue;
    const r = isPlainObject(v) ? v : {};
    out[dayKey] = {
      tasksCompleted: Math.max(0, Math.floor(Number(r.tasksCompleted) || 0)),
      problemsSolved: Math.max(0, Math.floor(Number(r.problemsSolved) || 0))
    };
  }
  return out;
}

function normalizePlanDays(days) {
  const out = [];
  for (const d of Array.isArray(days) ? days : []) {
    if (!isPlainObject(d)) continue;
    const dayKey = String(d.dayKey || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) continue;
    const tasks = Array.isArray(d.tasks) ? d.tasks : [];
    out.push({
      dayKey,
      tasks: tasks
        .filter((t) => isPlainObject(t) && t.id)
        .map((t) => ({
          id: String(t.id),
          type: String(t.type || "task"),
          title: String(t.title || "Task"),
          minutes: Math.max(5, Math.floor(Number(t.minutes) || 15)),
          skillId: t.skillId ? String(t.skillId) : null,
          problemId: t.problemId ? String(t.problemId) : null,
          completedAt: typeof t.completedAt === "number" ? t.completedAt : null
        }))
    });
  }
  return out;
}

function normalizeCompletedTaskIds(raw) {
  const out = {};
  for (const [k, v] of Object.entries(isPlainObject(raw) ? raw : {})) {
    const id = String(k || "");
    if (!id) continue;
    const r = isPlainObject(v) ? v : {};
    out[id] = { completedAt: typeof r.completedAt === "number" ? r.completedAt : Date.now() };
  }
  return out;
}

function normalizeMilestones(raw) {
  const out = {};
  for (const [k, v] of Object.entries(isPlainObject(raw) ? raw : {})) {
    const id = String(k || "");
    if (!id) continue;
    const r = isPlainObject(v) ? v : {};
    out[id] = {
      id,
      name: String(r.name || id),
      description: String(r.description || ""),
      unlockedAt: typeof r.unlockedAt === "number" ? r.unlockedAt : Date.now()
    };
  }
  return out;
}

export function getSkillLabel(skillId) {
  return SKILLS.find((s) => s.id === skillId)?.label || skillId;
}

export function defaultQuizAnswers() {
  const out = {};
  for (const s of SKILLS) {
    if (s.id === "behavioral" || s.id === "system_design") continue;
    out[s.id] = 3;
  }
  out.behavioral = 3;
  out.system_design = 3;
  return out;
}

export function scoreQuizAnswers(answers) {
  const ans = normalizeSkillMap(answers, 1, 5);
  const scores = {};
  for (const s of SKILLS) {
    const a = ans[s.id] ?? 3;
    // 1..5 -> 20..100
    scores[s.id] = clamp(Math.round((Number(a) / 5) * 100), 0, 100);
  }
  return scores;
}

export function getProblemSkills(problemId) {
  const pid = String(problemId || "");
  // Keep this mapping lightweight; expand as you add more problems.
  const map = {
    "two-sum": ["arrays_hashmaps"],
    "valid-anagram": ["strings", "sorting_grouping"],
    "longest-substring": ["two_pointers", "strings"],
    "group-anagrams": ["sorting_grouping", "strings", "arrays_hashmaps"],
    "lru-cache": ["linked_list_cache", "arrays_hashmaps"]
  };
  return map[pid] || [];
}

function choosePlanCadence(minutesPerDay) {
  const m = Number(minutesPerDay) || 60;
  if (m <= 30) return { dailyTasks: 1, codingPerWeek: 4 };
  if (m <= 45) return { dailyTasks: 2, codingPerWeek: 5 };
  if (m <= 60) return { dailyTasks: 2, codingPerWeek: 6 };
  if (m <= 90) return { dailyTasks: 3, codingPerWeek: 7 };
  return { dailyTasks: 3, codingPerWeek: 8 };
}

function buildBehavioralTask(company, dayKey, idx) {
  const common = [
    "Write a STAR story: conflict / disagreement",
    "Write a STAR story: failure & learning",
    "Write a STAR story: ownership & impact",
    "Practice: tell me about yourself (2 min) + 1 follow-up",
    "Review: strengths/weaknesses + concise examples"
  ];
  const amazonLP = [
    "Amazon LP: Customer Obsession STAR story",
    "Amazon LP: Ownership STAR story",
    "Amazon LP: Dive Deep STAR story",
    "Amazon LP: Bias for Action STAR story",
    "Amazon LP: Earn Trust STAR story"
  ];
  const pick = company === "Amazon" ? amazonLP : common;
  const title = pick[idx % pick.length];
  return {
    type: "behavioral",
    title,
    minutes: 20,
    skillId: "behavioral"
  };
}

function buildSystemDesignTask(company, dayKey, idx) {
  const set = [
    "System design: requirements + APIs for URL shortener",
    "System design: data model + indexing for notifications",
    "System design: caching strategy (what/where/eviction)",
    "System design: scaling reads vs writes (bottlenecks)",
    "System design: failure modes + retries + idempotency"
  ];
  const title = set[idx % set.length];
  return {
    type: "system_design",
    title,
    minutes: company === "Google" ? 25 : 20,
    skillId: "system_design"
  };
}

function computeWeakSkillOrder(state) {
  const s = normalizeRoadmapState(state);
  const weights = COMPANY_FOCUS[s.settings.targetCompany]?.weights || COMPANY_FOCUS.General.weights;
  const bySkill = s.performance.bySkill || {};

  // Lower quiz score + lower solve rate => weaker.
  const scored = SKILLS.map((sk) => {
    const base = Number(s.quiz.scores?.[sk.id] ?? 60);
    const perf = bySkill[sk.id] || { attempts: 0, solved: 0 };
    const attempts = Math.max(0, perf.attempts || 0);
    const solved = Math.max(0, perf.solved || 0);
    const solveRate = attempts > 0 ? solved / attempts : 0.5;
    // weakness in [0..1] roughly
    const weakness = clamp((1 - base / 100) * 0.7 + (1 - solveRate) * 0.3, 0, 1);
    const w = Number(weights[sk.id] ?? 1);
    return { id: sk.id, score: weakness * w };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((x) => x.id);
}

export function generatePersonalizedPlan({
  prevState,
  problems,
  solvedByProblemId,
  nowTs = Date.now()
}) {
  const prev = normalizeRoadmapState(prevState);
  const startDayKey = prev.settings.startDayKey || toLocalDayKey(nowTs) || null;
  if (!startDayKey) return prev;

  const { dailyTasks, codingPerWeek } = choosePlanCadence(prev.settings.minutesPerDay);
  const company = prev.settings.targetCompany;
  const weakOrder = computeWeakSkillOrder(prev);

  const list = Array.isArray(problems) ? problems : [];
  const solved = isPlainObject(solvedByProblemId) ? solvedByProblemId : {};
  const unsolvedProblems = list.filter((p) => p?.id && !solved[p.id]);

  const planDays = [];
  for (let i = 0; i < prev.settings.planDays; i++) {
    const dayKey = addDaysToDayKey(startDayKey, i);
    if (!dayKey) continue;

    const tasks = [];

    // Ensure a steady cadence of coding tasks across the week.
    const isCodingDay = (i % 7) < Math.min(7, codingPerWeek);
    const primarySkill = weakOrder[i % weakOrder.length] || "arrays_hashmaps";

    if (isCodingDay) {
      const recProblem = pickProblemForSkill({
        problems: unsolvedProblems.length ? unsolvedProblems : list,
        skillId: primarySkill
      });
      if (recProblem?.id) {
        tasks.push({
          id: `${dayKey}:solve:${recProblem.id}`,
          type: "solve",
          title: `Solve: ${recProblem.title}`,
          minutes: Math.max(25, Math.floor(prev.settings.minutesPerDay * 0.55)),
          skillId: primarySkill,
          problemId: recProblem.id,
          completedAt: null
        });
      } else {
        tasks.push({
          id: `${dayKey}:coding:${i}`,
          type: "coding",
          title: `Coding practice: focus on ${getSkillLabel(primarySkill)}`,
          minutes: Math.max(25, Math.floor(prev.settings.minutesPerDay * 0.55)),
          skillId: primarySkill,
          problemId: null,
          completedAt: null
        });
      }
    }

    // Fill remaining tasks with review / behavioral / system design.
    while (tasks.length < dailyTasks) {
      const slot = tasks.length;
      const kind = pickSupportTaskKind(company, i, slot);
      if (kind === "behavioral") {
        const t = buildBehavioralTask(company, dayKey, i + slot);
        tasks.push({
          id: `${dayKey}:beh:${slot}`,
          ...t,
          completedAt: null,
          problemId: null
        });
        continue;
      }
      if (kind === "system_design") {
        const t = buildSystemDesignTask(company, dayKey, i + slot);
        tasks.push({
          id: `${dayKey}:sd:${slot}`,
          ...t,
          completedAt: null,
          problemId: null
        });
        continue;
      }
      const reviewSkill = weakOrder[(i + slot + 1) % weakOrder.length] || primarySkill;
      tasks.push({
        id: `${dayKey}:review:${slot}`,
        type: "review",
        title: `Review: patterns for ${getSkillLabel(reviewSkill)} (notes + pitfalls)`,
        minutes: Math.max(10, Math.floor(prev.settings.minutesPerDay * 0.25)),
        skillId: reviewSkill,
        problemId: null,
        completedAt: null
      });
    }

    planDays.push({ dayKey, tasks });
  }

  return {
    ...prev,
    createdAt: prev.createdAt ?? nowTs,
    settings: { ...prev.settings, startDayKey },
    plan: { generatedAt: nowTs, days: planDays }
  };
}

function pickSupportTaskKind(company, dayIndex, slotIndex) {
  // Lightly bias based on company.
  if (company === "Amazon" && (dayIndex % 3 === 0) && slotIndex > 0) return "behavioral";
  if (company === "Google" && (dayIndex % 4 === 0) && slotIndex > 0) return "system_design";
  if (company === "Meta" && (dayIndex % 4 === 2) && slotIndex > 0) return "behavioral";
  // General: mix in system design once per week, behavioral once per week.
  if (dayIndex % 7 === 4 && slotIndex > 0) return "system_design";
  if (dayIndex % 7 === 2 && slotIndex > 0) return "behavioral";
  return "review";
}

function addDaysToDayKey(dayKey, addDays) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || ""));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d, 12, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setDate(dt.getDate() + Number(addDays || 0));
  return toLocalDayKey(dt.getTime());
}

function pickProblemForSkill({ problems, skillId }) {
  const list = Array.isArray(problems) ? problems : [];
  const candidates = [];
  for (const p of list) {
    if (!p?.id) continue;
    const skills = getProblemSkills(p.id);
    if (skills.includes(skillId)) candidates.push(p);
  }
  if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
  // fallback
  return list.find((p) => p?.id) || null;
}

export function getDailyProblemRecommendations({
  state,
  problems,
  solvedByProblemId,
  limit = 3
}) {
  const s = normalizeRoadmapState(state);
  const list = Array.isArray(problems) ? problems : [];
  const solved = isPlainObject(solvedByProblemId) ? solvedByProblemId : {};
  const weakOrder = computeWeakSkillOrder(s);

  const recs = [];
  const used = new Set();

  for (const skillId of weakOrder) {
    const pool = list.filter((p) => p?.id && !solved[p.id] && getProblemSkills(p.id).includes(skillId));
    for (const p of pool) {
      if (used.has(p.id)) continue;
      recs.push({
        problemId: p.id,
        title: p.title || p.id,
        skillId
      });
      used.add(p.id);
      if (recs.length >= limit) return recs;
    }
  }

  // fallback: unsolved in any area
  for (const p of list) {
    if (!p?.id || solved[p.id] || used.has(p.id)) continue;
    recs.push({ problemId: p.id, title: p.title || p.id, skillId: null });
    if (recs.length >= limit) break;
  }
  return recs;
}

export function toggleTaskCompletion({ prevState, taskId, completed, nowTs = Date.now() }) {
  const prev = normalizeRoadmapState(prevState);
  const id = String(taskId || "");
  if (!id) return prev;

  const nextCompletedTaskIds = { ...(prev.progress.completedTaskIds || {}) };
  if (completed) {
    nextCompletedTaskIds[id] = { completedAt: nowTs };
  } else {
    delete nextCompletedTaskIds[id];
  }

  const dayKey = id.slice(0, 10);
  const nextByDay = { ...(prev.performance.byDay || {}) };
  if (/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    const cur = nextByDay[dayKey] || { tasksCompleted: 0, problemsSolved: 0 };
    const delta = completed ? 1 : -1;
    nextByDay[dayKey] = {
      ...cur,
      tasksCompleted: Math.max(0, (cur.tasksCompleted || 0) + delta)
    };
  }

  return {
    ...prev,
    performance: { ...prev.performance, byDay: nextByDay },
    progress: { ...prev.progress, completedTaskIds: nextCompletedTaskIds }
  };
}

export function applySolvedProblemToRoadmap({
  prevState,
  problemId,
  problems,
  nowTs = Date.now()
}) {
  const prev = normalizeRoadmapState(prevState);
  const pid = String(problemId || "");
  if (!pid) return prev;

  const skills = getProblemSkills(pid);
  const nextBySkill = { ...(prev.performance.bySkill || {}) };
  for (const skillId of skills) {
    const cur = nextBySkill[skillId] || { attempts: 0, solved: 0 };
    nextBySkill[skillId] = {
      attempts: (cur.attempts || 0) + 1,
      solved: (cur.solved || 0) + 1
    };
  }

  // Auto-complete any tasks that reference this problem.
  const nextCompleted = { ...(prev.progress.completedTaskIds || {}) };
  const nextPlanDays = (prev.plan.days || []).map((d) => {
    const nextTasks = (d.tasks || []).map((t) => {
      if (t.problemId === pid && !nextCompleted[t.id]) {
        nextCompleted[t.id] = { completedAt: nowTs };
        return { ...t, completedAt: nowTs };
      }
      return t;
    });
    return { ...d, tasks: nextTasks };
  });

  // Track solved count by day.
  const dayKey = toLocalDayKey(nowTs);
  const nextByDay = { ...(prev.performance.byDay || {}) };
  if (dayKey) {
    const cur = nextByDay[dayKey] || { tasksCompleted: 0, problemsSolved: 0 };
    nextByDay[dayKey] = { ...cur, problemsSolved: (cur.problemsSolved || 0) + 1 };
  }

  const next = {
    ...prev,
    performance: { ...prev.performance, bySkill: nextBySkill, byDay: nextByDay },
    plan: { ...prev.plan, days: nextPlanDays },
    progress: { ...prev.progress, completedTaskIds: nextCompleted }
  };

  return adaptPlanPace({ state: next, problems, nowTs });
}

export function evaluateRoadmapMilestones({ prevState, nextState, nowTs = Date.now() }) {
  const prev = normalizeRoadmapState(prevState);
  const next = normalizeRoadmapState(nextState);
  const unlocked = [];
  const nextMilestones = { ...(next.progress.milestones || {}) };

  const milestoneDefs = [
    {
      id: "quiz_complete",
      name: "Assessment complete",
      description: "Completed the skill assessment quiz.",
      ok: (s) => Boolean(s.quiz.completedAt)
    },
    {
      id: "first_solve",
      name: "First solve",
      description: "Solved your first coding problem on the roadmap.",
      ok: (s) => totalSolvedFromRoadmap(s) >= 1
    },
    {
      id: "tasks_5",
      name: "Momentum",
      description: "Completed 5 roadmap tasks.",
      ok: (s) => Object.keys(s.progress.completedTaskIds || {}).length >= 5
    },
    {
      id: "tasks_20",
      name: "Consistency",
      description: "Completed 20 roadmap tasks.",
      ok: (s) => Object.keys(s.progress.completedTaskIds || {}).length >= 20
    }
  ];

  for (const m of milestoneDefs) {
    if (nextMilestones[m.id]) continue;
    if (!m.ok(next)) continue;
    const entry = { id: m.id, name: m.name, description: m.description, unlockedAt: nowTs };
    nextMilestones[m.id] = entry;
    // Only report as newly unlocked if it wasn't present before.
    if (!prev.progress.milestones?.[m.id]) unlocked.push(entry);
  }

  return {
    nextState: { ...next, progress: { ...next.progress, milestones: nextMilestones } },
    unlocked
  };
}

function totalSolvedFromRoadmap(state) {
  const s = normalizeRoadmapState(state);
  const byDay = s.performance.byDay || {};
  let total = 0;
  for (const v of Object.values(byDay)) {
    total += Math.max(0, Number(v?.problemsSolved || 0));
  }
  return total;
}

function adaptPlanPace({ state, problems, nowTs }) {
  const s = normalizeRoadmapState(state);
  const todayKey = toLocalDayKey(nowTs);
  if (!todayKey) return s;
  if (!Array.isArray(s.plan.days) || s.plan.days.length === 0) return s;

  // Expected: how many "solve" tasks should have happened by now (inclusive).
  let expectedSolved = 0;
  for (const d of s.plan.days) {
    if (!d?.dayKey || d.dayKey > todayKey) continue;
    for (const t of d.tasks || []) {
      if (t?.type === "solve") expectedSolved += 1;
    }
  }

  // Actual: how many problems were solved (from roadmap tracking) by now (inclusive).
  let actualSolved = 0;
  for (const [dayKey, v] of Object.entries(s.performance.byDay || {})) {
    if (dayKey > todayKey) continue;
    actualSolved += Math.max(0, Number(v?.problemsSolved || 0));
  }

  const delta = actualSolved - expectedSolved;
  const isFaster = delta >= 2;
  const isSlower = delta <= -2;
  if (!isFaster && !isSlower) return s;

  const weakOrder = computeWeakSkillOrder(s);
  const list = Array.isArray(problems) ? problems : [];

  const nextDays = s.plan.days.map((d) => ({ ...d, tasks: (d.tasks || []).map((t) => ({ ...t })) }));
  const idxToday = nextDays.findIndex((d) => d.dayKey === todayKey);
  if (idxToday < 0) return s;

  // Look ahead a week.
  const start = Math.max(0, idxToday + 1);
  const end = Math.min(nextDays.length, start + 7);

  if (isFaster) {
    // If user is ahead, increase challenge a bit:
    // - add an extra solve task on up to 3 upcoming days if time/day is high enough
    // - otherwise: keep as-is (recommendations already adapt via weak skills)
    if (s.settings.minutesPerDay >= 90) {
      let added = 0;
      for (let i = start; i < end && added < 3; i++) {
        const day = nextDays[i];
        const solveCount = (day.tasks || []).filter((t) => t.type === "solve").length;
        if (solveCount >= 2) continue;
        const skillId = weakOrder[(i + added) % weakOrder.length] || "arrays_hashmaps";
        const rec = pickProblemForSkill({ problems: list, skillId });
        if (!rec?.id) continue;
        day.tasks.push({
          id: `${day.dayKey}:solve_extra:${rec.id}`,
          type: "solve",
          title: `Extra (ahead of schedule): ${rec.title}`,
          minutes: Math.max(20, Math.floor(s.settings.minutesPerDay * 0.35)),
          skillId,
          problemId: rec.id,
          completedAt: null
        });
        added += 1;
      }
    }
    return { ...s, plan: { ...s.plan, days: nextDays } };
  }

  // Slower: lighten next week by swapping one solve task into a review task on up to 3 days.
  let swapped = 0;
  for (let i = start; i < end && swapped < 3; i++) {
    const day = nextDays[i];
    const solveIdx = (day.tasks || []).findIndex((t) => t.type === "solve" && !t.completedAt);
    if (solveIdx < 0) continue;
    const old = day.tasks[solveIdx];
    const skillId = old.skillId || weakOrder[i % weakOrder.length] || "arrays_hashmaps";
    day.tasks[solveIdx] = {
      ...old,
      type: "review",
      title: `Catch up: review ${getSkillLabel(skillId)} (notes + 3 pitfalls)`,
      minutes: Math.max(10, Math.floor(s.settings.minutesPerDay * 0.25)),
      skillId,
      problemId: null,
      completedAt: null
    };
    swapped += 1;
  }

  return { ...s, plan: { ...s.plan, days: nextDays } };
}

