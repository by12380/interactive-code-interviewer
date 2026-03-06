// Adaptive Learning Engine
// Evolves the user's skill model from actual coding performance and determines
// when/what AI-generated questions should be served.

import { PROBLEMS } from '../data/problems.js';
import { QUESTION_BANK } from '../data/questionBank.js';
import { SKILL_CATEGORIES } from './roadmapService.js';

const ALL_PROBLEMS = [...PROBLEMS, ...QUESTION_BANK];
const uniqueById = (arr) => {
  const seen = new Set();
  return arr.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
};
const FULL_POOL = uniqueById(ALL_PROBLEMS);

const CATEGORY_TO_SKILL = {
  'Arrays & Hashing': 'arrays-hashing',
  'Two Pointers': 'two-pointers',
  'Sliding Window': 'sliding-window',
  'Stack': 'stack',
  'Binary Search': 'binary-search',
  'Linked Lists': 'linked-lists',
  'Trees': 'trees',
  'Graphs': 'graphs',
  'Dynamic Programming': 'dynamic-programming',
  'Backtracking': 'backtracking',
  'Arrays & Sorting': 'arrays-hashing',
  'Greedy': 'greedy',
  'Heap / Priority Queue': 'heap',
};

const DIFFICULTY_WEIGHT = { Easy: 1, Medium: 2, Hard: 3 };

// ─── Elo-like Skill Rating ──────────────────────────────────────────────

const DEFAULT_RATING = 1200;
const K_FACTOR = 40;

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function difficultyRating(difficulty) {
  return { Easy: 1000, Medium: 1400, Hard: 1800 }[difficulty] || 1200;
}

/**
 * Update a single skill's Elo rating based on problem performance.
 * @param {number} currentRating - User's current rating in this category
 * @param {string} difficulty - Problem difficulty
 * @param {number} score - 0-100 score on the problem
 * @returns {number} New rating
 */
export function updateRating(currentRating, difficulty, score) {
  const problemRating = difficultyRating(difficulty);
  const expected = expectedScore(currentRating, problemRating);
  const actual = score / 100;
  return Math.round(currentRating + K_FACTOR * (actual - expected));
}

// ─── Adaptive Skill State ───────────────────────────────────────────────

export function getDefaultAdaptiveState() {
  const ratings = {};
  SKILL_CATEGORIES.forEach((s) => {
    ratings[s.id] = DEFAULT_RATING;
  });
  return {
    ratings,
    attemptHistory: [],
    generatedQuestions: [],
    lastModelUpdate: null,
    totalAttempts: 0,
    categoryAttempts: {},
    categorySuccessRate: {},
    currentDifficultyTarget: {},
  };
}

/**
 * Record a problem attempt and evolve the skill model.
 * This is the core function that makes the AI "mature" alongside the user.
 *
 * @param {object} adaptiveState - Current adaptive state
 * @param {object} attempt - { problemId, category, difficulty, score, timeSpent, testsPassed, testsTotal, hintsUsed }
 * @returns {object} Updated adaptive state with evolved ratings
 */
export function recordAttempt(adaptiveState, attempt) {
  const state = {
    ...adaptiveState,
    ratings: { ...adaptiveState.ratings },
    categoryAttempts: { ...adaptiveState.categoryAttempts },
    categorySuccessRate: { ...adaptiveState.categorySuccessRate },
    currentDifficultyTarget: { ...adaptiveState.currentDifficultyTarget },
  };

  const skillId = CATEGORY_TO_SKILL[attempt.category] || 'arrays-hashing';
  const prevRating = state.ratings[skillId] || DEFAULT_RATING;

  // Penalize heavy hint usage and reward fast, clean solves
  let adjustedScore = attempt.score;
  if (attempt.hintsUsed > 2) adjustedScore *= 0.85;
  else if (attempt.hintsUsed > 0) adjustedScore *= 0.92;
  if (attempt.testsPassed === attempt.testsTotal && attempt.testsTotal > 0) {
    adjustedScore = Math.min(100, adjustedScore * 1.05);
  }

  state.ratings[skillId] = updateRating(prevRating, attempt.difficulty, adjustedScore);

  // Track per-category attempt counts and success rate
  if (!state.categoryAttempts[skillId]) state.categoryAttempts[skillId] = 0;
  state.categoryAttempts[skillId]++;

  const prevRate = state.categorySuccessRate[skillId] || { successes: 0, total: 0 };
  const isSuccess = attempt.score >= 70;
  state.categorySuccessRate[skillId] = {
    successes: prevRate.successes + (isSuccess ? 1 : 0),
    total: prevRate.total + 1,
  };

  // Calibrate target difficulty per category
  const successRate =
    state.categorySuccessRate[skillId].successes /
    state.categorySuccessRate[skillId].total;
  const rating = state.ratings[skillId];

  if (rating >= 1600 && successRate >= 0.7) {
    state.currentDifficultyTarget[skillId] = 'Hard';
  } else if (rating >= 1300 && successRate >= 0.6) {
    state.currentDifficultyTarget[skillId] = 'Medium';
  } else {
    state.currentDifficultyTarget[skillId] = 'Easy';
  }

  // Keep a rolling history (cap at 200 entries)
  state.attemptHistory = [
    { ...attempt, timestamp: new Date().toISOString(), ratingAfter: state.ratings[skillId] },
    ...(state.attemptHistory || []),
  ].slice(0, 200);

  state.totalAttempts = (state.totalAttempts || 0) + 1;
  state.lastModelUpdate = new Date().toISOString();

  return state;
}

// ─── Pool Exhaustion Detection ──────────────────────────────────────────

/**
 * Determine how much of the static question pool has been consumed per category.
 */
export function getPoolCoverage(problemsCompleted = []) {
  const completedSet = new Set(problemsCompleted);
  const coverage = {};

  SKILL_CATEGORIES.forEach((skill) => {
    const matching = FULL_POOL.filter(
      (p) => CATEGORY_TO_SKILL[p.category] === skill.id
    );
    const solved = matching.filter((p) => completedSet.has(p.id));
    coverage[skill.id] = {
      total: matching.length,
      solved: solved.length,
      remaining: matching.length - solved.length,
      exhaustionRate: matching.length > 0 ? solved.length / matching.length : 0,
    };
  });

  return coverage;
}

/**
 * Decide whether AI-generated questions are needed and in which categories.
 */
export function shouldGenerateQuestions(adaptiveState, problemsCompleted = []) {
  const coverage = getPoolCoverage(problemsCompleted);
  const needs = [];

  Object.entries(coverage).forEach(([skillId, data]) => {
    const rating = adaptiveState.ratings?.[skillId] || DEFAULT_RATING;
    const targetDiff = adaptiveState.currentDifficultyTarget?.[skillId] || 'Medium';

    // Remaining problems of the target difficulty for this category
    const completedSet = new Set(problemsCompleted);
    const remainingAtDifficulty = FULL_POOL.filter(
      (p) =>
        CATEGORY_TO_SKILL[p.category] === skillId &&
        p.difficulty === targetDiff &&
        !completedSet.has(p.id)
    ).length;

    const needsGeneration =
      data.exhaustionRate >= 0.75 || remainingAtDifficulty <= 1;

    if (needsGeneration) {
      needs.push({
        skillId,
        rating,
        targetDifficulty: targetDiff,
        poolExhaustion: data.exhaustionRate,
        remainingStatic: data.remaining,
      });
    }
  });

  // Sort by exhaustion (most exhausted first)
  needs.sort((a, b) => b.poolExhaustion - a.poolExhaustion);
  return needs;
}

// ─── Smart Recommendations ──────────────────────────────────────────────

/**
 * Build an adaptive recommendation list that blends static + generated questions.
 *
 * @param {object} adaptiveState
 * @param {string[]} problemsCompleted
 * @param {object[]} generatedQuestions - Previously AI-generated questions cached on the user
 * @param {number} limit
 * @returns {{ staticRecs: object[], generationNeeds: object[] }}
 */
export function getAdaptiveRecommendations(
  adaptiveState,
  problemsCompleted = [],
  generatedQuestions = [],
  limit = 6
) {
  const completedSet = new Set(problemsCompleted);
  const ratings = adaptiveState.ratings || {};

  // Find weakest categories (lowest Elo)
  const rankedSkills = Object.entries(ratings)
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);

  const staticRecs = [];
  const usedIds = new Set();

  // 1. Prioritize weak-area problems at the right difficulty
  for (const skillId of rankedSkills) {
    if (staticRecs.length >= limit) break;
    const targetDiff = adaptiveState.currentDifficultyTarget?.[skillId] || 'Medium';
    const rating = ratings[skillId];

    const candidates = FULL_POOL.filter(
      (p) =>
        CATEGORY_TO_SKILL[p.category] === skillId &&
        !completedSet.has(p.id) &&
        !usedIds.has(p.id)
    );

    // Prefer problems at target difficulty, then one step easier, then one step harder
    const diffOrder = [targetDiff];
    if (targetDiff === 'Hard') diffOrder.push('Medium', 'Easy');
    else if (targetDiff === 'Medium') diffOrder.push('Easy', 'Hard');
    else diffOrder.push('Medium', 'Hard');

    for (const diff of diffOrder) {
      const pick = candidates.find((p) => p.difficulty === diff);
      if (pick) {
        const skillInfo = SKILL_CATEGORIES.find((s) => s.id === skillId);
        staticRecs.push({
          problem: pick,
          reason: buildReasonString(skillId, rating, skillInfo, diff),
          priority: rating < 1200 ? 'high' : rating < 1400 ? 'medium' : 'normal',
          skillArea: skillId,
          isGenerated: false,
        });
        usedIds.add(pick.id);
        break;
      }
    }
  }

  // 2. Fill remaining slots with uncompleted generated questions
  const unsolvedGenerated = generatedQuestions.filter(
    (q) => !completedSet.has(q.id) && !usedIds.has(q.id)
  );
  for (const q of unsolvedGenerated) {
    if (staticRecs.length >= limit) break;
    staticRecs.push({
      problem: q,
      reason: 'AI-crafted challenge tailored to your skill level',
      priority: 'high',
      skillArea: CATEGORY_TO_SKILL[q.category] || 'arrays-hashing',
      isGenerated: true,
    });
    usedIds.add(q.id);
  }

  // 3. Backfill with any remaining static problems
  if (staticRecs.length < limit) {
    const remaining = FULL_POOL.filter(
      (p) => !completedSet.has(p.id) && !usedIds.has(p.id)
    );
    for (const p of remaining) {
      if (staticRecs.length >= limit) break;
      staticRecs.push({
        problem: p,
        reason: 'Expand your problem-solving experience',
        priority: 'normal',
        skillArea: CATEGORY_TO_SKILL[p.category] || 'arrays-hashing',
        isGenerated: false,
      });
    }
  }

  // 4. Determine if we need to ask the server for AI-generated questions
  const generationNeeds = shouldGenerateQuestions(adaptiveState, problemsCompleted);

  return { staticRecs, generationNeeds };
}

function buildReasonString(skillId, rating, skillInfo, difficulty) {
  const name = skillInfo?.name || skillId;
  if (rating < 1200) return `Strengthen your ${name} fundamentals (rating: ${rating})`;
  if (rating < 1400) return `Level up your ${name} skills with a ${difficulty} challenge`;
  return `Push your ${name} mastery further (rating: ${rating})`;
}

// ─── Skill Summary (for display) ────────────────────────────────────────

/**
 * Convert Elo ratings to display-friendly skill levels.
 * Returns the same shape as the existing roadmap skills for drop-in compatibility.
 */
export function ratingsToSkillLevels(ratings) {
  const skills = {};
  Object.entries(ratings || {}).forEach(([skillId, rating]) => {
    let level, score;
    if (rating >= 1600) {
      level = 'advanced';
      score = Math.min(100, 70 + Math.round(((rating - 1600) / 400) * 30));
    } else if (rating >= 1300) {
      level = 'intermediate';
      score = 40 + Math.round(((rating - 1300) / 300) * 30);
    } else {
      level = 'beginner';
      score = Math.max(5, Math.round(((rating - 800) / 500) * 40));
    }
    skills[skillId] = { score: Math.min(100, Math.max(5, score)), level, rating };
  });
  return skills;
}

/**
 * Merge initial assessment skills with adaptive ratings.
 * Adaptive ratings take precedence once the user has enough attempts.
 */
export function mergeSkills(assessmentSkills, adaptiveState) {
  if (!adaptiveState || (adaptiveState.totalAttempts || 0) < 3) {
    return assessmentSkills;
  }

  const adaptiveSkills = ratingsToSkillLevels(adaptiveState.ratings);

  // Weighted blend: as attempts grow, trust adaptive more
  const weight = Math.min(1, (adaptiveState.totalAttempts - 3) / 15);
  const merged = {};

  SKILL_CATEGORIES.forEach((skill) => {
    const assess = assessmentSkills?.[skill.id] || { score: 50, level: 'intermediate' };
    const adaptive = adaptiveSkills[skill.id] || { score: 50, level: 'intermediate', rating: DEFAULT_RATING };

    const blendedScore = Math.round(assess.score * (1 - weight) + adaptive.score * weight);
    const blendedLevel =
      blendedScore >= 70 ? 'advanced' : blendedScore >= 40 ? 'intermediate' : 'beginner';

    merged[skill.id] = {
      score: blendedScore,
      level: blendedLevel,
      rating: adaptive.rating,
    };
  });

  return merged;
}

export default {
  getDefaultAdaptiveState,
  recordAttempt,
  updateRating,
  getPoolCoverage,
  shouldGenerateQuestions,
  getAdaptiveRecommendations,
  ratingsToSkillLevels,
  mergeSkills,
};
