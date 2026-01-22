// Gamification Service - XP, Levels, Streaks, Achievements, Problem Unlocks, Friends

import { PROBLEMS } from '../data/problems.js';

// ===== ACHIEVEMENTS DEFINITIONS =====
export const ACHIEVEMENTS = [
  {
    id: 'first-steps',
    name: 'First Steps',
    description: 'Complete your first problem',
    icon: '🎯',
    requirement: { type: 'problems_completed', count: 1 },
    xpReward: 50,
    rarity: 'common'
  },
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Complete 5 problems',
    icon: '📚',
    requirement: { type: 'problems_completed', count: 5 },
    xpReward: 100,
    rarity: 'common'
  },
  {
    id: 'problem-solver',
    name: 'Problem Solver',
    description: 'Complete 10 problems',
    icon: '🧩',
    requirement: { type: 'problems_completed', count: 10 },
    xpReward: 150,
    rarity: 'uncommon'
  },
  {
    id: 'expert',
    name: 'Expert',
    description: 'Complete 25 problems',
    icon: '🏅',
    requirement: { type: 'problems_completed', count: 25 },
    xpReward: 200,
    rarity: 'rare'
  },
  {
    id: 'master',
    name: 'Master',
    description: 'Complete 50 problems',
    icon: '👑',
    requirement: { type: 'problems_completed', count: 50 },
    xpReward: 300,
    rarity: 'legendary'
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    description: 'Complete a problem in under 5 minutes',
    icon: '⚡',
    requirement: { type: 'fast_completion', timeSeconds: 300 },
    xpReward: 100,
    rarity: 'uncommon'
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Score 100 on any problem',
    icon: '💯',
    requirement: { type: 'perfect_score' },
    xpReward: 150,
    rarity: 'rare'
  },
  {
    id: 'streak-starter',
    name: 'Streak Starter',
    description: 'Maintain a 3-day practice streak',
    icon: '🔥',
    requirement: { type: 'streak', days: 3 },
    xpReward: 75,
    rarity: 'common'
  },
  {
    id: 'week-warrior',
    name: 'Week Warrior',
    description: 'Maintain a 7-day practice streak',
    icon: '🗓️',
    requirement: { type: 'streak', days: 7 },
    xpReward: 150,
    rarity: 'uncommon'
  },
  {
    id: 'dedicated',
    name: 'Dedicated',
    description: 'Maintain a 30-day practice streak',
    icon: '💪',
    requirement: { type: 'streak', days: 30 },
    xpReward: 500,
    rarity: 'legendary'
  },
  {
    id: 'no-hints',
    name: 'Self Reliant',
    description: 'Complete a problem without using any hints',
    icon: '🧠',
    requirement: { type: 'no_hints' },
    xpReward: 100,
    rarity: 'uncommon'
  },
  {
    id: 'all-tests',
    name: 'Test Master',
    description: 'Pass all tests on first submission',
    icon: '✅',
    requirement: { type: 'all_tests_first_try' },
    xpReward: 100,
    rarity: 'uncommon'
  },
  {
    id: 'easy-champion',
    name: 'Easy Champion',
    description: 'Complete all Easy problems',
    icon: '🌟',
    requirement: { type: 'difficulty_complete', difficulty: 'Easy' },
    xpReward: 200,
    rarity: 'rare'
  },
  {
    id: 'medium-master',
    name: 'Medium Master',
    description: 'Complete all Medium problems',
    icon: '⭐',
    requirement: { type: 'difficulty_complete', difficulty: 'Medium' },
    xpReward: 300,
    rarity: 'rare'
  },
  {
    id: 'level-5',
    name: 'Rising Star',
    description: 'Reach Level 5',
    icon: '🌠',
    requirement: { type: 'level', level: 5 },
    xpReward: 100,
    rarity: 'uncommon'
  },
  {
    id: 'level-10',
    name: 'Coding Hero',
    description: 'Reach Level 10',
    icon: '🦸',
    requirement: { type: 'level', level: 10 },
    xpReward: 250,
    rarity: 'rare'
  }
];

// ===== XP & LEVELING =====

/**
 * Calculate level from XP
 * Formula: level = floor(sqrt(xp / 100)) + 1
 * Level 1: 0 XP, Level 2: 100 XP, Level 5: 1600 XP, Level 10: 8100 XP
 */
export const calculateLevel = (xp) => {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
};

/**
 * Calculate XP required for a specific level
 */
export const xpForLevel = (level) => {
  return Math.pow(level - 1, 2) * 100;
};

/**
 * Get XP progress within current level (0-100%)
 */
export const getLevelProgress = (xp) => {
  const currentLevel = calculateLevel(xp);
  const currentLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  const xpIntoLevel = xp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  return Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100));
};

/**
 * Calculate XP reward for completing a problem
 */
export const calculateProblemXP = (difficulty, score) => {
  const baseXP = {
    'Easy': 50,
    'Medium': 100,
    'Hard': 200
  };
  
  const base = baseXP[difficulty] || 50;
  // Score multiplier: 0.5x for score 0, 1x for score 50, 1.5x for score 100
  const multiplier = 0.5 + (score / 100);
  return Math.round(base * multiplier);
};

// ===== STREAK SYSTEM =====

/**
 * Get today's date as YYYY-MM-DD string
 */
const getToday = () => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Get yesterday's date as YYYY-MM-DD string
 */
const getYesterday = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
};

/**
 * Check and update streak based on last active date
 * Returns { streak, xpAwarded, isNewDay }
 */
export const checkStreak = (gamification) => {
  const today = getToday();
  const { streak } = gamification;
  const lastActive = streak?.lastActiveDate;
  
  // Already active today
  if (lastActive === today) {
    return { 
      streak: streak, 
      xpAwarded: 0, 
      isNewDay: false 
    };
  }
  
  let newStreak = { ...streak };
  let xpAwarded = 0;
  
  if (lastActive === getYesterday()) {
    // Consecutive day - increment streak
    newStreak.current = (streak.current || 0) + 1;
    newStreak.longest = Math.max(newStreak.longest || 0, newStreak.current);
    // Streak bonus: 10 XP per consecutive day
    xpAwarded = 10 * newStreak.current;
  } else if (!lastActive) {
    // First day ever
    newStreak.current = 1;
    newStreak.longest = 1;
    xpAwarded = 25; // Daily login bonus
  } else {
    // Streak broken - reset to 1
    newStreak.current = 1;
    xpAwarded = 25; // Daily login bonus
  }
  
  newStreak.lastActiveDate = today;
  
  return {
    streak: newStreak,
    xpAwarded,
    isNewDay: true
  };
};

// ===== PROBLEM UNLOCKING =====

/**
 * Get default unlocked problems (all Easy problems)
 */
export const getDefaultUnlockedProblems = () => {
  return PROBLEMS
    .filter(p => p.difficulty === 'Easy')
    .map(p => p.id);
};

/**
 * Check which problems should be unlocked based on user progress
 */
export const checkUnlockableProblems = (gamification, problemsCompleted) => {
  const currentlyUnlocked = gamification.unlockedProblems || getDefaultUnlockedProblems();
  const newUnlocks = [];
  
  // Count completed problems by difficulty
  const completedByDifficulty = {
    'Easy': 0,
    'Medium': 0,
    'Hard': 0
  };
  
  problemsCompleted.forEach(problemId => {
    const problem = PROBLEMS.find(p => p.id === problemId);
    if (problem) {
      completedByDifficulty[problem.difficulty]++;
    }
  });
  
  const userLevel = calculateLevel(gamification.xp || 0);
  
  PROBLEMS.forEach(problem => {
    if (currentlyUnlocked.includes(problem.id)) return;
    
    let shouldUnlock = false;
    
    if (problem.difficulty === 'Easy') {
      // Easy problems are always unlocked
      shouldUnlock = true;
    } else if (problem.difficulty === 'Medium') {
      // Medium: Unlocked after completing 3 Easy problems
      shouldUnlock = completedByDifficulty['Easy'] >= 3;
    } else if (problem.difficulty === 'Hard') {
      // Hard: Unlocked after completing 2 Medium problems OR reaching Level 5
      shouldUnlock = completedByDifficulty['Medium'] >= 2 || userLevel >= 5;
    }
    
    if (shouldUnlock) {
      newUnlocks.push(problem.id);
    }
  });
  
  return newUnlocks;
};

/**
 * Get unlock requirement description for a locked problem
 */
export const getUnlockRequirement = (problemId, gamification, problemsCompleted) => {
  const problem = PROBLEMS.find(p => p.id === problemId);
  if (!problem) return null;
  
  const completedByDifficulty = {
    'Easy': 0,
    'Medium': 0,
    'Hard': 0
  };
  
  problemsCompleted.forEach(pid => {
    const p = PROBLEMS.find(pr => pr.id === pid);
    if (p) completedByDifficulty[p.difficulty]++;
  });
  
  const userLevel = calculateLevel(gamification?.xp || 0);
  
  if (problem.difficulty === 'Medium') {
    const needed = 3 - completedByDifficulty['Easy'];
    return `Complete ${needed} more Easy problem${needed !== 1 ? 's' : ''} to unlock`;
  } else if (problem.difficulty === 'Hard') {
    const mediumNeeded = 2 - completedByDifficulty['Medium'];
    const levelNeeded = 5 - userLevel;
    if (mediumNeeded > 0 && levelNeeded > 0) {
      return `Complete ${mediumNeeded} more Medium problem${mediumNeeded !== 1 ? 's' : ''} OR reach Level 5`;
    }
    return null; // Should already be unlocked
  }
  
  return null;
};

// ===== ACHIEVEMENTS =====

/**
 * Check which achievements should be unlocked based on current state
 */
export const checkAchievements = (gamification, stats, lastCompletion = null) => {
  const earnedIds = gamification.achievements || [];
  const newAchievements = [];
  
  const problemsCompletedCount = stats.problemsCompleted?.length || 0;
  const userLevel = calculateLevel(gamification.xp || 0);
  const currentStreak = gamification.streak?.current || 0;
  
  ACHIEVEMENTS.forEach(achievement => {
    if (earnedIds.includes(achievement.id)) return;
    
    const req = achievement.requirement;
    let earned = false;
    
    switch (req.type) {
      case 'problems_completed':
        earned = problemsCompletedCount >= req.count;
        break;
        
      case 'fast_completion':
        if (lastCompletion && lastCompletion.timeSpent < req.timeSeconds) {
          earned = true;
        }
        break;
        
      case 'perfect_score':
        if (lastCompletion && lastCompletion.score >= 100) {
          earned = true;
        }
        break;
        
      case 'streak':
        earned = currentStreak >= req.days;
        break;
        
      case 'no_hints':
        if (lastCompletion && lastCompletion.hintsUsed === 0) {
          earned = true;
        }
        break;
        
      case 'all_tests_first_try':
        if (lastCompletion && 
            lastCompletion.testsPassed === lastCompletion.testsTotal && 
            lastCompletion.testsTotal > 0) {
          earned = true;
        }
        break;
        
      case 'difficulty_complete':
        const problemsOfDifficulty = PROBLEMS.filter(p => p.difficulty === req.difficulty);
        const completedOfDifficulty = problemsOfDifficulty.filter(p => 
          stats.problemsCompleted?.includes(p.id)
        );
        earned = completedOfDifficulty.length === problemsOfDifficulty.length && 
                 problemsOfDifficulty.length > 0;
        break;
        
      case 'level':
        earned = userLevel >= req.level;
        break;
    }
    
    if (earned) {
      newAchievements.push(achievement);
    }
  });
  
  return newAchievements;
};

/**
 * Get achievement by ID
 */
export const getAchievementById = (id) => {
  return ACHIEVEMENTS.find(a => a.id === id);
};

/**
 * Get all achievements with earned status
 */
export const getAchievementsWithStatus = (earnedIds = []) => {
  return ACHIEVEMENTS.map(achievement => ({
    ...achievement,
    earned: earnedIds.includes(achievement.id)
  }));
};

// ===== FRIENDS SYSTEM =====

/**
 * Generate a unique friend code
 */
export const generateFriendCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Get friend data from localStorage by friend code
 */
export const findUserByFriendCode = (friendCode) => {
  try {
    const usersJson = localStorage.getItem('code_interviewer_users');
    if (!usersJson) return null;
    
    const users = JSON.parse(usersJson);
    const user = Object.values(users).find(u => 
      u.gamification?.friendCode === friendCode.toUpperCase()
    );
    
    if (!user) return null;
    
    return {
      id: user.id,
      username: user.username,
      friendCode: user.gamification.friendCode,
      xp: user.gamification?.xp || 0,
      level: calculateLevel(user.gamification?.xp || 0),
      problemsCompleted: user.stats?.problemsCompleted?.length || 0
    };
  } catch {
    return null;
  }
};

/**
 * Get friends list with their current stats
 */
export const getFriendsWithStats = (friends = []) => {
  return friends.map(friend => {
    const userData = findUserByFriendCode(friend.code);
    if (userData) {
      return {
        ...friend,
        xp: userData.xp,
        level: userData.level,
        problemsCompleted: userData.problemsCompleted,
        found: true
      };
    }
    return {
      ...friend,
      xp: 0,
      level: 1,
      problemsCompleted: 0,
      found: false
    };
  }).sort((a, b) => b.xp - a.xp);
};

// ===== DEFAULT GAMIFICATION STATE =====

export const getDefaultGamificationState = () => ({
  xp: 0,
  level: 1,
  streak: {
    current: 0,
    longest: 0,
    lastActiveDate: null
  },
  achievements: [],
  unlockedProblems: getDefaultUnlockedProblems(),
  friendCode: generateFriendCode(),
  friends: []
});

export default {
  ACHIEVEMENTS,
  calculateLevel,
  xpForLevel,
  getLevelProgress,
  calculateProblemXP,
  checkStreak,
  getDefaultUnlockedProblems,
  checkUnlockableProblems,
  getUnlockRequirement,
  checkAchievements,
  getAchievementById,
  getAchievementsWithStatus,
  generateFriendCode,
  findUserByFriendCode,
  getFriendsWithStats,
  getDefaultGamificationState
};
