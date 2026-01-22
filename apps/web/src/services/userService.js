// User Authentication & Profile Service using localStorage

import { getDefaultGamificationState } from './gamificationService.js';

const USERS_KEY = 'code_interviewer_users';
const CURRENT_USER_KEY = 'code_interviewer_current_user';
const LEADERBOARD_KEY = 'code_interviewer_leaderboard';

// Helper to get all users from localStorage
const getUsers = () => {
  try {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : {};
  } catch {
    return {};
  }
};

// Helper to save users to localStorage
const saveUsers = (users) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

// Helper to generate a simple hash for password (not secure, but fine for localStorage demo)
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

// Generate unique user ID
const generateUserId = () => {
  return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

/**
 * Migrate user to include gamification fields if missing
 * @param {object} user - User object to migrate
 * @returns {object} - Migrated user object
 */
const migrateUser = (user) => {
  if (!user) return user;
  
  // Add gamification if missing
  if (!user.gamification) {
    user.gamification = getDefaultGamificationState();
  } else {
    // Ensure all gamification fields exist
    const defaults = getDefaultGamificationState();
    user.gamification = {
      ...defaults,
      ...user.gamification,
      streak: {
        ...defaults.streak,
        ...(user.gamification.streak || {})
      }
    };
  }
  
  return user;
};

/**
 * Sign up a new user
 * @param {string} username 
 * @param {string} email 
 * @param {string} password 
 * @returns {{ success: boolean, user?: object, error?: string }}
 */
export const signUp = (username, email, password) => {
  const users = getUsers();
  
  // Check if email already exists
  const existingUser = Object.values(users).find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return { success: false, error: 'An account with this email already exists.' };
  }
  
  // Check if username already exists
  const existingUsername = Object.values(users).find(u => u.username.toLowerCase() === username.toLowerCase());
  if (existingUsername) {
    return { success: false, error: 'This username is already taken.' };
  }
  
  // Validate inputs
  if (username.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters.' };
  }
  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }
  if (!email.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  
  const userId = generateUserId();
  const newUser = {
    id: userId,
    username,
    email: email.toLowerCase(),
    passwordHash: simpleHash(password),
    createdAt: new Date().toISOString(),
    stats: {
      totalInterviews: 0,
      problemsAttempted: [],
      problemsCompleted: [],
      totalScore: 0,
      averageScore: 0,
      bestGrade: null,
      totalTimeSpent: 0, // in seconds
    },
    interviewHistory: [],
    personalBests: {}, // problemId -> { time, score, grade, date }
    gamification: getDefaultGamificationState(), // XP, levels, streaks, achievements, etc.
  };
  
  users[userId] = newUser;
  saveUsers(users);
  
  // Auto login after signup
  const { passwordHash, ...safeUser } = newUser;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
  
  return { success: true, user: safeUser };
};

/**
 * Log in an existing user
 * @param {string} email 
 * @param {string} password 
 * @returns {{ success: boolean, user?: object, error?: string }}
 */
export const login = (email, password) => {
  const users = getUsers();
  
  let user = Object.values(users).find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return { success: false, error: 'No account found with this email.' };
  }
  
  if (user.passwordHash !== simpleHash(password)) {
    return { success: false, error: 'Incorrect password.' };
  }
  
  // Migrate user if needed
  user = migrateUser(user);
  
  // Save migrated user back to storage
  users[user.id] = user;
  saveUsers(users);
  
  const { passwordHash, ...safeUser } = user;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
  
  return { success: true, user: safeUser };
};

/**
 * Log out the current user
 */
export const logout = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

/**
 * Get the currently logged in user
 * @returns {object|null}
 */
export const getCurrentUser = () => {
  try {
    const userJson = localStorage.getItem(CURRENT_USER_KEY);
    if (!userJson) return null;
    
    let user = JSON.parse(userJson);
    
    // Migrate user if needed
    const migratedUser = migrateUser(user);
    
    // If migration happened, save updated user
    if (!user.gamification && migratedUser.gamification) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(migratedUser));
      
      // Also update in users storage
      const users = getUsers();
      if (users[migratedUser.id]) {
        users[migratedUser.id] = { ...users[migratedUser.id], gamification: migratedUser.gamification };
        saveUsers(users);
      }
    }
    
    return migratedUser;
  } catch {
    return null;
  }
};

/**
 * Check if a user is logged in
 * @returns {boolean}
 */
export const isLoggedIn = () => {
  return getCurrentUser() !== null;
};

/**
 * Save interview result for the current user
 * @param {object} interviewData 
 * @returns {{ success: boolean, error?: string }}
 */
export const saveInterviewResult = (interviewData) => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, error: 'No user logged in.' };
  }
  
  const users = getUsers();
  const user = users[currentUser.id];
  if (!user) {
    return { success: false, error: 'User not found.' };
  }
  
  const {
    problemId,
    problemTitle,
    difficulty,
    score,
    grade,
    timeSpent, // in seconds
    testsPassed,
    testsTotal,
    hintsUsed,
    efficiency,
    code,
  } = interviewData;
  
  const interviewRecord = {
    id: 'interview_' + Date.now().toString(36),
    problemId,
    problemTitle,
    difficulty,
    score,
    grade,
    timeSpent,
    testsPassed,
    testsTotal,
    hintsUsed,
    efficiency,
    code,
    completedAt: new Date().toISOString(),
  };
  
  // Add to interview history
  user.interviewHistory.unshift(interviewRecord);
  
  // Update stats
  user.stats.totalInterviews++;
  user.stats.totalScore += score;
  user.stats.averageScore = Math.round(user.stats.totalScore / user.stats.totalInterviews);
  user.stats.totalTimeSpent += timeSpent;
  
  // Track problems attempted
  if (!user.stats.problemsAttempted.includes(problemId)) {
    user.stats.problemsAttempted.push(problemId);
  }
  
  // Track problems completed (all tests passed)
  if (testsPassed === testsTotal && testsTotal > 0) {
    if (!user.stats.problemsCompleted.includes(problemId)) {
      user.stats.problemsCompleted.push(problemId);
    }
  }
  
  // Update best grade
  const gradeRank = { 'A+': 12, 'A': 11, 'A-': 10, 'B+': 9, 'B': 8, 'B-': 7, 'C+': 6, 'C': 5, 'C-': 4, 'D': 3, 'F': 1 };
  if (!user.stats.bestGrade || gradeRank[grade] > gradeRank[user.stats.bestGrade]) {
    user.stats.bestGrade = grade;
  }
  
  // Update personal best for this problem
  const currentBest = user.personalBests[problemId];
  if (!currentBest || score > currentBest.score || (score === currentBest.score && timeSpent < currentBest.time)) {
    user.personalBests[problemId] = {
      time: timeSpent,
      score,
      grade,
      date: new Date().toISOString(),
    };
  }
  
  saveUsers(users);
  
  // Update global leaderboard
  updateLeaderboard({
    problemId,
    userId: user.id,
    username: user.username,
    score,
    time: timeSpent,
    grade,
  });
  
  // Update current user in session
  const { passwordHash, ...safeUser } = user;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
  
  return { success: true, user: safeUser };
};

/**
 * Get user's interview history
 * @param {number} limit - Optional limit on number of records
 * @returns {Array}
 */
export const getInterviewHistory = (limit = null) => {
  const user = getCurrentUser();
  if (!user) return [];
  
  const history = user.interviewHistory || [];
  return limit ? history.slice(0, limit) : history;
};

/**
 * Get user's personal best for a specific problem
 * @param {string} problemId 
 * @returns {object|null}
 */
export const getPersonalBest = (problemId) => {
  const user = getCurrentUser();
  if (!user) return null;
  
  return user.personalBests?.[problemId] || null;
};

/**
 * Get user's statistics
 * @returns {object|null}
 */
export const getUserStats = () => {
  const user = getCurrentUser();
  if (!user) return null;
  
  return user.stats;
};

/**
 * Update user profile (username only for now)
 * @param {object} updates 
 * @returns {{ success: boolean, user?: object, error?: string }}
 */
export const updateProfile = (updates) => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, error: 'No user logged in.' };
  }
  
  const users = getUsers();
  const user = users[currentUser.id];
  if (!user) {
    return { success: false, error: 'User not found.' };
  }
  
  // Check if new username is taken
  if (updates.username && updates.username !== user.username) {
    const existingUsername = Object.values(users).find(
      u => u.username.toLowerCase() === updates.username.toLowerCase() && u.id !== user.id
    );
    if (existingUsername) {
      return { success: false, error: 'This username is already taken.' };
    }
    user.username = updates.username;
  }
  
  saveUsers(users);
  
  const { passwordHash, ...safeUser } = user;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
  
  return { success: true, user: safeUser };
};

/**
 * Format time in seconds to MM:SS
 * @param {number} seconds 
 * @returns {string}
 */
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

/**
 * Format date to readable string
 * @param {string} isoString 
 * @returns {string}
 */
export const formatDate = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// ===== GAMIFICATION FUNCTIONS =====

/**
 * Update user's gamification data
 * @param {object} gamificationUpdates - Partial gamification updates
 * @returns {{ success: boolean, user?: object, error?: string }}
 */
export const updateGamification = (gamificationUpdates) => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, error: 'No user logged in.' };
  }
  
  const users = getUsers();
  const user = users[currentUser.id];
  if (!user) {
    return { success: false, error: 'User not found.' };
  }
  
  // Ensure gamification exists
  if (!user.gamification) {
    user.gamification = getDefaultGamificationState();
  }
  
  // Merge updates
  user.gamification = {
    ...user.gamification,
    ...gamificationUpdates,
    // Deep merge streak if provided
    streak: gamificationUpdates.streak 
      ? { ...user.gamification.streak, ...gamificationUpdates.streak }
      : user.gamification.streak
  };
  
  saveUsers(users);
  
  const { passwordHash, ...safeUser } = user;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
  
  return { success: true, user: safeUser };
};

/**
 * Add XP to user's gamification
 * @param {number} xpAmount - Amount of XP to add
 * @returns {{ success: boolean, user?: object, leveledUp?: boolean, newLevel?: number }}
 */
export const addXP = (xpAmount) => {
  const currentUser = getCurrentUser();
  if (!currentUser || !xpAmount || xpAmount <= 0) {
    return { success: false };
  }
  
  const currentLevel = currentUser.gamification?.level || 1;
  const newXP = (currentUser.gamification?.xp || 0) + xpAmount;
  
  // Import calculateLevel dynamically to avoid circular deps
  const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1;
  const leveledUp = newLevel > currentLevel;
  
  const result = updateGamification({ 
    xp: newXP, 
    level: newLevel 
  });
  
  return { 
    ...result, 
    leveledUp, 
    newLevel: leveledUp ? newLevel : undefined 
  };
};

/**
 * Unlock achievements for user
 * @param {string[]} achievementIds - Array of achievement IDs to add
 * @returns {{ success: boolean, user?: object }}
 */
export const unlockAchievements = (achievementIds) => {
  const currentUser = getCurrentUser();
  if (!currentUser || !achievementIds?.length) {
    return { success: false };
  }
  
  const currentAchievements = currentUser.gamification?.achievements || [];
  const newAchievements = [...new Set([...currentAchievements, ...achievementIds])];
  
  return updateGamification({ achievements: newAchievements });
};

/**
 * Unlock problems for user
 * @param {string[]} problemIds - Array of problem IDs to unlock
 * @returns {{ success: boolean, user?: object }}
 */
export const unlockProblems = (problemIds) => {
  const currentUser = getCurrentUser();
  if (!currentUser || !problemIds?.length) {
    return { success: false };
  }
  
  const currentUnlocked = currentUser.gamification?.unlockedProblems || [];
  const newUnlocked = [...new Set([...currentUnlocked, ...problemIds])];
  
  return updateGamification({ unlockedProblems: newUnlocked });
};

/**
 * Add a friend by friend code
 * @param {string} friendCode - Friend code to add
 * @returns {{ success: boolean, user?: object, error?: string, friend?: object }}
 */
export const addFriend = (friendCode) => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, error: 'No user logged in.' };
  }
  
  const normalizedCode = friendCode.toUpperCase().trim();
  
  // Can't add yourself
  if (normalizedCode === currentUser.gamification?.friendCode) {
    return { success: false, error: "You can't add yourself as a friend." };
  }
  
  // Check if already friends
  const existingFriends = currentUser.gamification?.friends || [];
  if (existingFriends.some(f => f.code === normalizedCode)) {
    return { success: false, error: 'This friend is already in your list.' };
  }
  
  // Find user by friend code
  const users = getUsers();
  const friendUser = Object.values(users).find(u => 
    u.gamification?.friendCode === normalizedCode
  );
  
  if (!friendUser) {
    return { success: false, error: 'No user found with this friend code.' };
  }
  
  const newFriend = {
    code: normalizedCode,
    username: friendUser.username,
    addedAt: new Date().toISOString()
  };
  
  const result = updateGamification({ 
    friends: [...existingFriends, newFriend] 
  });
  
  return { ...result, friend: newFriend };
};

/**
 * Remove a friend by friend code
 * @param {string} friendCode - Friend code to remove
 * @returns {{ success: boolean, user?: object }}
 */
export const removeFriend = (friendCode) => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false };
  }
  
  const existingFriends = currentUser.gamification?.friends || [];
  const newFriends = existingFriends.filter(f => f.code !== friendCode.toUpperCase());
  
  return updateGamification({ friends: newFriends });
};

// ===== LEADERBOARD FUNCTIONS =====

/**
 * Get the global leaderboard from localStorage
 * @returns {object} - { problemId: [{ userId, username, score, time, grade, date }] }
 */
const getLeaderboard = () => {
  try {
    const leaderboard = localStorage.getItem(LEADERBOARD_KEY);
    return leaderboard ? JSON.parse(leaderboard) : {};
  } catch {
    return {};
  }
};

/**
 * Save the leaderboard to localStorage
 * @param {object} leaderboard 
 */
const saveLeaderboard = (leaderboard) => {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
};

/**
 * Update the global leaderboard with a new score
 * @param {object} data - { problemId, userId, username, score, time, grade }
 */
export const updateLeaderboard = (data) => {
  const { problemId, userId, username, score, time, grade } = data;
  const leaderboard = getLeaderboard();
  
  if (!leaderboard[problemId]) {
    leaderboard[problemId] = [];
  }
  
  const problemLeaderboard = leaderboard[problemId];
  
  // Find existing entry for this user
  const existingIndex = problemLeaderboard.findIndex(entry => entry.userId === userId);
  
  const newEntry = {
    userId,
    username,
    score,
    time,
    grade,
    date: new Date().toISOString(),
  };
  
  if (existingIndex >= 0) {
    // Update only if new score is better, or same score with faster time
    const existing = problemLeaderboard[existingIndex];
    if (score > existing.score || (score === existing.score && time < existing.time)) {
      problemLeaderboard[existingIndex] = newEntry;
    }
  } else {
    // Add new entry
    problemLeaderboard.push(newEntry);
  }
  
  // Sort by score (desc), then by time (asc)
  problemLeaderboard.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.time - b.time;
  });
  
  // Keep only top 100 entries per problem
  leaderboard[problemId] = problemLeaderboard.slice(0, 100);
  
  saveLeaderboard(leaderboard);
};

/**
 * Get leaderboard for a specific problem
 * @param {string} problemId 
 * @param {number} limit - Optional limit on entries (default 10)
 * @returns {Array} - Sorted array of leaderboard entries
 */
export const getProblemLeaderboard = (problemId, limit = 10) => {
  const leaderboard = getLeaderboard();
  const problemEntries = leaderboard[problemId] || [];
  return problemEntries.slice(0, limit);
};

/**
 * Get leaderboard for all problems
 * @returns {object} - { problemId: entries[] }
 */
export const getAllLeaderboards = () => {
  return getLeaderboard();
};

/**
 * Get global rankings across all problems (aggregate scores)
 * @param {number} limit - Optional limit on entries (default 10)
 * @returns {Array} - [{ userId, username, totalScore, problemsSolved, avgScore }]
 */
export const getGlobalRankings = (limit = 10) => {
  const leaderboard = getLeaderboard();
  const userScores = {};
  
  // Aggregate scores across all problems
  Object.values(leaderboard).forEach(problemEntries => {
    problemEntries.forEach(entry => {
      if (!userScores[entry.userId]) {
        userScores[entry.userId] = {
          userId: entry.userId,
          username: entry.username,
          totalScore: 0,
          problemsSolved: 0,
          scores: [],
        };
      }
      userScores[entry.userId].totalScore += entry.score;
      userScores[entry.userId].problemsSolved++;
      userScores[entry.userId].scores.push(entry.score);
    });
  });
  
  // Calculate averages and sort
  const rankings = Object.values(userScores).map(user => ({
    userId: user.userId,
    username: user.username,
    totalScore: user.totalScore,
    problemsSolved: user.problemsSolved,
    avgScore: Math.round(user.totalScore / user.problemsSolved),
  }));
  
  // Sort by total score (desc), then by problems solved (desc)
  rankings.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return b.problemsSolved - a.problemsSolved;
  });
  
  return rankings.slice(0, limit);
};

/**
 * Get user's rank for a specific problem
 * @param {string} problemId 
 * @param {string} userId 
 * @returns {number|null} - Rank (1-indexed) or null if not on leaderboard
 */
export const getUserRankForProblem = (problemId, userId) => {
  const leaderboard = getLeaderboard();
  const problemEntries = leaderboard[problemId] || [];
  const index = problemEntries.findIndex(entry => entry.userId === userId);
  return index >= 0 ? index + 1 : null;
};

/**
 * Get user's global rank
 * @param {string} userId 
 * @returns {number|null} - Rank (1-indexed) or null if not ranked
 */
export const getUserGlobalRank = (userId) => {
  const rankings = getGlobalRankings(100);
  const index = rankings.findIndex(entry => entry.userId === userId);
  return index >= 0 ? index + 1 : null;
};

export default {
  signUp,
  login,
  logout,
  getCurrentUser,
  isLoggedIn,
  saveInterviewResult,
  getInterviewHistory,
  getPersonalBest,
  getUserStats,
  updateProfile,
  formatTime,
  formatDate,
  updateGamification,
  addXP,
  unlockAchievements,
  unlockProblems,
  addFriend,
  removeFriend,
  updateLeaderboard,
  getProblemLeaderboard,
  getAllLeaderboards,
  getGlobalRankings,
  getUserRankForProblem,
  getUserGlobalRank,
};
