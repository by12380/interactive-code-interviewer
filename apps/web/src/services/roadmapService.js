// Roadmap Service - AI-Generated Study Plans, Adaptive Learning, Company-Specific Prep

import { PROBLEMS, getCategories } from '../data/problems.js';

// ===== SKILL CATEGORIES & ASSESSMENT =====

export const SKILL_CATEGORIES = [
  { id: 'arrays-hashing', name: 'Arrays & Hashing', icon: '📊' },
  { id: 'two-pointers', name: 'Two Pointers', icon: '👆' },
  { id: 'sliding-window', name: 'Sliding Window', icon: '🪟' },
  { id: 'stack', name: 'Stack', icon: '📚' },
  { id: 'binary-search', name: 'Binary Search', icon: '🔍' },
  { id: 'linked-lists', name: 'Linked Lists', icon: '🔗' },
  { id: 'trees', name: 'Trees', icon: '🌳' },
  { id: 'graphs', name: 'Graphs', icon: '🕸️' },
  { id: 'dynamic-programming', name: 'Dynamic Programming', icon: '🧮' },
  { id: 'greedy', name: 'Greedy Algorithms', icon: '🎯' },
  { id: 'backtracking', name: 'Backtracking', icon: '🔄' },
  { id: 'heap', name: 'Heap / Priority Queue', icon: '⬆️' },
];

// Map problem categories to skill categories
const categoryMapping = {
  'Arrays & Hashing': 'arrays-hashing',
  'Stack': 'stack',
  'Binary Search': 'binary-search',
  'Linked Lists': 'linked-lists',
  'Arrays & Sorting': 'arrays-hashing',
  'Dynamic Programming': 'dynamic-programming',
};

// ===== SKILL ASSESSMENT QUIZ =====

export const ASSESSMENT_QUESTIONS = [
  {
    id: 'q1',
    category: 'arrays-hashing',
    question: 'What is the time complexity of accessing an element in a hash map by key?',
    options: ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'],
    correct: 2,
    difficulty: 'easy'
  },
  {
    id: 'q3',
    category: 'binary-search',
    question: 'Binary search works on which type of data?',
    options: ['Unsorted data', 'Sorted data', 'Any data', 'Only integers'],
    correct: 1,
    difficulty: 'easy'
  },
  {
    id: 'q5',
    category: 'linked-lists',
    question: 'What is the time complexity of inserting at the beginning of a linked list?',
    options: ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'],
    correct: 2,
    difficulty: 'easy'
  },
  {
    id: 'q7',
    category: 'stack',
    question: 'Which principle does a stack follow?',
    options: ['FIFO', 'LIFO', 'Random Access', 'Priority Based'],
    correct: 1,
    difficulty: 'easy'
  },
  {
    id: 'q9',
    category: 'trees',
    question: 'What is the time complexity of searching in a balanced BST?',
    options: ['O(n)', 'O(log n)', 'O(1)', 'O(n log n)'],
    correct: 1,
    difficulty: 'medium'
  },
  {
    id: 'q11',
    category: 'dynamic-programming',
    question: 'What are the two main properties for a DP problem?',
    options: [
      'Sorting and Searching',
      'Optimal Substructure and Overlapping Subproblems',
      'Recursion and Iteration',
      'Time and Space complexity'
    ],
    correct: 1,
    difficulty: 'medium'
  },
  {
    id: 'q13',
    category: 'graphs',
    question: 'Which algorithm finds the shortest path in an unweighted graph?',
    options: ['DFS', 'BFS', 'Dijkstra', 'Bellman-Ford'],
    correct: 1,
    difficulty: 'medium'
  }
];

// ===== COMPANY-SPECIFIC FOCUS AREAS =====

export const COMPANY_FOCUS = {
  google: {
    name: 'Google',
    logo: '🔵',
    focusAreas: ['dynamic-programming', 'graphs', 'trees', 'arrays-hashing', 'binary-search'],
    description: 'Google emphasizes algorithmic thinking, particularly DP and graph problems. Focus on optimization and explaining time/space tradeoffs.',
    style: 'Collaborative, focus on communication and thought process',
    difficulty: 'High emphasis on Medium to Hard problems',
    tips: [
      'Think out loud and explain your approach',
      'Consider multiple solutions before coding',
      'Focus on optimal time/space complexity',
      'Practice system design for senior roles'
    ]
  },
  meta: {
    name: 'Meta (Facebook)',
    logo: '🔷',
    focusAreas: ['arrays-hashing', 'graphs', 'trees', 'dynamic-programming', 'binary-search'],
    description: 'Meta focuses heavily on practical coding speed and clean code. Graph problems and social network-related questions are common.',
    style: 'Fast-paced, two coding problems in 45 minutes',
    difficulty: 'Mix of Medium problems, speed is crucial',
    tips: [
      'Practice coding quickly with clean code',
      'Know graph traversal inside out',
      'Be prepared for follow-up optimizations',
      'Practice explaining while coding'
    ]
  },
  amazon: {
    name: 'Amazon',
    logo: '🟠',
    focusAreas: ['arrays-hashing', 'trees', 'dynamic-programming', 'greedy', 'linked-lists'],
    description: 'Amazon combines technical with behavioral (Leadership Principles). Questions often involve real-world scenarios.',
    style: 'Technical + Behavioral mixed, focus on LP stories',
    difficulty: 'Medium problems with real-world context',
    tips: [
      'Prepare STAR format stories for Leadership Principles',
      'Connect technical solutions to customer impact',
      'Practice tree problems extensively',
      'Think about scalability in your solutions'
    ]
  },
  apple: {
    name: 'Apple',
    logo: '🍎',
    focusAreas: ['arrays-hashing', 'linked-lists', 'trees', 'stack', 'binary-search'],
    description: 'Apple values attention to detail and elegant solutions. Emphasis on code quality and handling edge cases.',
    style: 'Focus on clean, production-quality code',
    difficulty: 'Medium problems with emphasis on edge cases',
    tips: [
      'Write clean, readable code',
      'Handle all edge cases explicitly',
      'Explain your design decisions',
      'Be prepared for system-level questions'
    ]
  },
  microsoft: {
    name: 'Microsoft',
    logo: '🟦',
    focusAreas: ['arrays-hashing', 'linked-lists', 'trees', 'dynamic-programming', 'graphs'],
    description: 'Microsoft has a balanced approach covering fundamentals thoroughly. Object-oriented design questions are common.',
    style: 'Collaborative, multiple rounds with different interviewers',
    difficulty: 'Mix of Easy to Medium, some Hard for senior',
    tips: [
      'Know data structures fundamentals well',
      'Be prepared for OOD questions',
      'Practice explaining your thought process',
      'Show collaboration and communication skills'
    ]
  },
  netflix: {
    name: 'Netflix',
    logo: '🔴',
    focusAreas: ['dynamic-programming', 'graphs', 'trees', 'arrays-hashing', 'sliding-window'],
    description: 'Netflix focuses on senior candidates with strong system design and algorithmic skills.',
    style: 'High-bar, senior-focused interviews',
    difficulty: 'Medium to Hard, strong focus on trade-offs',
    tips: [
      'Be opinionated and defend your choices',
      'Focus on scalable solutions',
      'Practice system design extensively',
      'Show leadership and autonomy'
    ]
  }
};

// ===== TIME COMMITMENT OPTIONS =====

export const TIME_COMMITMENTS = [
  { id: 'light', label: 'Light (30 min/day)', dailyMinutes: 30, problemsPerDay: 1 },
  { id: 'moderate', label: 'Moderate (1 hr/day)', dailyMinutes: 60, problemsPerDay: 2 },
  { id: 'intensive', label: 'Intensive (2 hrs/day)', dailyMinutes: 120, problemsPerDay: 3 },
  { id: 'full-time', label: 'Full Time (4+ hrs/day)', dailyMinutes: 240, problemsPerDay: 5 }
];

// ===== MILESTONE DEFINITIONS =====

export const MILESTONES = [
  { day: 7, name: 'First Week', icon: '🌱', message: 'You\'ve built the habit! Keep going!' },
  { day: 14, name: 'Two Weeks Strong', icon: '💪', message: 'Consistency is key. You\'re doing great!' },
  { day: 30, name: 'One Month Milestone', icon: '🎯', message: 'A full month of practice! You\'re making real progress.' },
  { day: 45, name: 'Halfway Hero', icon: '⭐', message: 'You\'re past the halfway mark of a 90-day plan!' },
  { day: 60, name: 'Two Month Champion', icon: '🏆', message: 'Two months of dedicated practice!' },
  { day: 90, name: 'Mastery Achieved', icon: '👑', message: 'You\'ve completed a full 90-day prep journey!' }
];

// ===== ASSESSMENT FUNCTIONS =====

/**
 * Calculate skill levels based on assessment answers
 * @param {Array} answers - Array of { questionId, selectedOption }
 * @returns {Object} - { skillId: { score: 0-100, level: 'beginner'|'intermediate'|'advanced' } }
 */
export const calculateSkillLevels = (answers) => {
  const skillScores = {};
  
  // Initialize all skills
  SKILL_CATEGORIES.forEach(skill => {
    skillScores[skill.id] = { correct: 0, total: 0 };
  });
  
  // Calculate scores per category
  answers.forEach(answer => {
    const question = ASSESSMENT_QUESTIONS.find(q => q.id === answer.questionId);
    if (question) {
      skillScores[question.category].total++;
      if (answer.selectedOption === question.correct) {
        // Weight by difficulty
        const weight = question.difficulty === 'easy' ? 1 : 
                      question.difficulty === 'medium' ? 1.5 : 2;
        skillScores[question.category].correct += weight;
      }
    }
  });
  
  // Convert to skill levels
  const skills = {};
  Object.entries(skillScores).forEach(([skillId, data]) => {
    if (data.total === 0) {
      skills[skillId] = { score: 50, level: 'intermediate' }; // Default if no questions
      return;
    }
    
    const score = Math.round((data.correct / (data.total * 1.5)) * 100);
    const level = score >= 80 ? 'advanced' : score >= 50 ? 'intermediate' : 'beginner';
    skills[skillId] = { score: Math.min(100, score), level };
  });
  
  return skills;
};

/**
 * Get weak areas based on skill assessment
 * @param {Object} skills - Skill levels from calculateSkillLevels
 * @returns {Array} - Array of skill IDs sorted by weakness
 */
export const getWeakAreas = (skills) => {
  return Object.entries(skills)
    .sort((a, b) => a[1].score - b[1].score)
    .map(([skillId]) => skillId);
};

// ===== PLAN GENERATION =====

/**
 * Generate a personalized study plan
 * @param {Object} params - { skills, company, timeCommitment, planDuration, problemsCompleted }
 * @returns {Object} - Complete study plan
 */
export const generateStudyPlan = ({
  skills,
  company = null,
  timeCommitment = 'moderate',
  planDuration = 30, // 30, 60, or 90 days
  problemsCompleted = []
}) => {
  const timeConfig = TIME_COMMITMENTS.find(t => t.id === timeCommitment) || TIME_COMMITMENTS[1];
  const weakAreas = getWeakAreas(skills);
  const companyFocus = company ? COMPANY_FOCUS[company] : null;
  
  // Prioritize skills: weak areas first, then company focus areas
  const prioritizedSkills = [...new Set([
    ...weakAreas.slice(0, 4), // Top 4 weak areas
    ...(companyFocus?.focusAreas || []),
    ...weakAreas // Rest
  ])];
  
  // Calculate distribution
  const totalProblems = planDuration * timeConfig.problemsPerDay;
  const phases = getPhases(planDuration);
  
  // Generate daily tasks
  const dailyTasks = generateDailyTasks({
    planDuration,
    prioritizedSkills,
    skills,
    timeConfig,
    problemsCompleted,
    companyFocus
  });
  
  // Identify milestones for this plan
  const planMilestones = MILESTONES.filter(m => m.day <= planDuration);
  
  return {
    id: 'plan_' + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    planDuration,
    timeCommitment,
    company,
    companyFocus,
    targetProblems: totalProblems,
    phases,
    milestones: planMilestones,
    dailyTasks,
    skills: { ...skills },
    prioritizedSkills,
    adaptiveSettings: {
      lastAdjusted: null,
      paceMultiplier: 1.0, // Can increase/decrease based on performance
      focusAreas: weakAreas.slice(0, 3)
    }
  };
};

/**
 * Get plan phases based on duration
 */
const getPhases = (duration) => {
  if (duration <= 30) {
    return [
      { name: 'Foundation', days: [1, 10], focus: 'Build fundamentals', icon: '📚' },
      { name: 'Practice', days: [11, 22], focus: 'Apply concepts', icon: '💻' },
      { name: 'Polish', days: [23, 30], focus: 'Speed & accuracy', icon: '🎯' }
    ];
  } else if (duration <= 60) {
    return [
      { name: 'Foundation', days: [1, 15], focus: 'Master fundamentals', icon: '📚' },
      { name: 'Build Up', days: [16, 35], focus: 'Tackle medium problems', icon: '🔧' },
      { name: 'Challenge', days: [36, 50], focus: 'Hard problems & patterns', icon: '💪' },
      { name: 'Polish', days: [51, 60], focus: 'Mock interviews & review', icon: '🎯' }
    ];
  } else {
    return [
      { name: 'Foundation', days: [1, 20], focus: 'Deep dive into basics', icon: '📚' },
      { name: 'Build Up', days: [21, 45], focus: 'Master patterns', icon: '🔧' },
      { name: 'Advanced', days: [46, 70], focus: 'Hard problems', icon: '🚀' },
      { name: 'Company Focus', days: [71, 82], focus: 'Target company prep', icon: '🎯' },
      { name: 'Final Sprint', days: [83, 90], focus: 'Mock interviews', icon: '🏁' }
    ];
  }
};

/**
 * Generate daily tasks for the plan
 */
const generateDailyTasks = ({
  planDuration,
  prioritizedSkills,
  skills,
  timeConfig,
  problemsCompleted,
  companyFocus
}) => {
  const tasks = [];
  const problemsPerDay = timeConfig.problemsPerDay;
  
  for (let day = 1; day <= planDuration; day++) {
    const dayTasks = [];
    
    // Determine phase and focus
    const progress = day / planDuration;
    let difficulty = 'Easy';
    if (progress > 0.7) difficulty = 'Hard';
    else if (progress > 0.3) difficulty = 'Medium';
    
    // Rotate through prioritized skills
    const skillIndex = (day - 1) % prioritizedSkills.length;
    const primarySkill = prioritizedSkills[skillIndex];
    
    // Add problems for the day
    for (let p = 0; p < problemsPerDay; p++) {
      const taskSkill = p === 0 ? primarySkill : prioritizedSkills[(skillIndex + p) % prioritizedSkills.length];
      const skillCategory = SKILL_CATEGORIES.find(s => s.id === taskSkill);
      
      // Find a suitable problem (this would match against actual problems in production)
      dayTasks.push({
        id: `day${day}_task${p + 1}`,
        type: 'problem',
        skillArea: taskSkill,
        skillName: skillCategory?.name || taskSkill,
        targetDifficulty: difficulty,
        estimatedMinutes: Math.round(timeConfig.dailyMinutes / problemsPerDay),
        completed: false,
        completedAt: null,
        score: null
      });
    }
    
    // Add review session every 7 days
    if (day % 7 === 0) {
      dayTasks.push({
        id: `day${day}_review`,
        type: 'review',
        title: 'Weekly Review',
        description: 'Review mistakes and solidify concepts',
        estimatedMinutes: 30,
        completed: false
      });
    }
    
    // Add mock interview in later phases
    if (day >= planDuration * 0.7 && day % 5 === 0) {
      dayTasks.push({
        id: `day${day}_mock`,
        type: 'mock_interview',
        title: companyFocus ? `${companyFocus.name} Style Mock` : 'Mock Interview',
        estimatedMinutes: 45,
        completed: false
      });
    }
    
    tasks.push({
      day,
      date: null, // Will be set when plan is activated
      tasks: dayTasks,
      completed: false,
      notes: ''
    });
  }
  
  return tasks;
};

// ===== ADAPTIVE LEARNING =====

/**
 * Adjust plan based on performance
 * @param {Object} plan - Current study plan
 * @param {Object} performanceData - { avgScore, avgTime, completionRate, weakCategories }
 * @returns {Object} - Updated plan with adjustments
 */
export const adjustPlanForPerformance = (plan, performanceData) => {
  const { avgScore, completionRate, weakCategories } = performanceData;
  
  const adjustedPlan = { ...plan };
  adjustedPlan.adaptiveSettings = { ...plan.adaptiveSettings };
  adjustedPlan.adaptiveSettings.lastAdjusted = new Date().toISOString();
  
  // Adjust pace based on performance
  if (avgScore >= 85 && completionRate >= 0.9) {
    adjustedPlan.adaptiveSettings.paceMultiplier = Math.min(1.5, plan.adaptiveSettings.paceMultiplier + 0.1);
    adjustedPlan.adaptiveSettings.recommendation = 'increase_difficulty';
  } else if (avgScore < 60 || completionRate < 0.5) {
    adjustedPlan.adaptiveSettings.paceMultiplier = Math.max(0.5, plan.adaptiveSettings.paceMultiplier - 0.1);
    adjustedPlan.adaptiveSettings.recommendation = 'more_practice';
  }
  
  // Update focus areas based on weak categories
  if (weakCategories && weakCategories.length > 0) {
    adjustedPlan.adaptiveSettings.focusAreas = weakCategories.slice(0, 3);
  }
  
  return adjustedPlan;
};

/**
 * Update skill levels from real performance data (called after each problem attempt).
 * Blends the initial assessment baseline with live Elo-based adaptive ratings.
 *
 * @param {Object} currentSkills - Existing skill levels from assessment
 * @param {Object} adaptiveRatings - Elo ratings from adaptiveService
 * @param {number} totalAttempts - How many problems the user has attempted
 * @returns {Object} Updated skills object
 */
export const updateSkillsFromPerformance = (currentSkills, adaptiveRatings, totalAttempts) => {
  if (!adaptiveRatings || totalAttempts < 3) return currentSkills;

  const weight = Math.min(1, (totalAttempts - 3) / 15);
  const updated = {};

  SKILL_CATEGORIES.forEach((skill) => {
    const assess = currentSkills?.[skill.id] || { score: 50, level: 'intermediate' };
    const rating = adaptiveRatings[skill.id] || 1200;

    let adaptiveScore;
    if (rating >= 1600) adaptiveScore = Math.min(100, 70 + Math.round(((rating - 1600) / 400) * 30));
    else if (rating >= 1300) adaptiveScore = 40 + Math.round(((rating - 1300) / 300) * 30);
    else adaptiveScore = Math.max(5, Math.round(((rating - 800) / 500) * 40));

    const blended = Math.round(assess.score * (1 - weight) + adaptiveScore * weight);
    updated[skill.id] = {
      score: Math.min(100, Math.max(5, blended)),
      level: blended >= 70 ? 'advanced' : blended >= 40 ? 'intermediate' : 'beginner',
      rating,
    };
  });

  return updated;
};

/**
 * Get daily problem recommendations based on weak areas.
 * Now accepts an optional generatedQuestions array so AI-crafted problems
 * can be blended into recommendations when the static pool runs low.
 *
 * @param {Object} params - { skills, problemsCompleted, company, limit, generatedQuestions }
 * @returns {Array} - Recommended problems with reasons
 */
export const getDailyRecommendations = ({
  skills,
  problemsCompleted = [],
  company = null,
  limit = 3,
  generatedQuestions = [],
}) => {
  const weakAreas = getWeakAreas(skills);
  const companyFocus = company ? COMPANY_FOCUS[company] : null;
  
  const recommendations = [];
  const completedSet = new Set(problemsCompleted);
  
  // Combine static + generated questions
  const allProblems = [...PROBLEMS, ...generatedQuestions.filter(q => !PROBLEMS.some(p => p.id === q.id))];

  const relevantProblems = allProblems.filter(problem => {
    if (completedSet.has(problem.id)) return false;
    const problemSkillId = categoryMapping[problem.category];
    return weakAreas.includes(problemSkillId);
  });
  
  relevantProblems.sort((a, b) => {
    const aSkillId = categoryMapping[a.category];
    const bSkillId = categoryMapping[b.category];
    const aWeakIndex = weakAreas.indexOf(aSkillId);
    const bWeakIndex = weakAreas.indexOf(bSkillId);
    return aWeakIndex - bWeakIndex;
  });
  
  relevantProblems.slice(0, limit).forEach(problem => {
    const skillId = categoryMapping[problem.category];
    const skillScore = skills[skillId]?.score || 50;
    const isCompanyFocus = companyFocus?.focusAreas?.includes(skillId);
    
    let reason = '';
    if (problem.isGenerated) {
      reason = `AI-crafted challenge for your ${problem.category} skills`;
    } else if (skillScore < 50) {
      reason = `Strengthen your ${problem.category} skills (current: ${skillScore}%)`;
    } else if (isCompanyFocus) {
      reason = `Key topic for ${companyFocus.name} interviews`;
    } else {
      reason = `Continue practicing ${problem.category}`;
    }
    
    recommendations.push({
      problem,
      reason,
      priority: problem.isGenerated ? 'high' : skillScore < 50 ? 'high' : isCompanyFocus ? 'medium' : 'normal',
      skillArea: skillId
    });
  });
  
  if (recommendations.length < limit) {
    const remaining = allProblems
      .filter(p => !completedSet.has(p.id) && 
                   !recommendations.some(r => r.problem.id === p.id))
      .slice(0, limit - recommendations.length);
    
    remaining.forEach(problem => {
      recommendations.push({
        problem,
        reason: problem.isGenerated ? 'Fresh AI-generated problem just for you' : 'Expand your problem-solving experience',
        priority: 'normal',
        skillArea: categoryMapping[problem.category] || 'general'
      });
    });
  }
  
  return recommendations;
};

// ===== PROGRESS TRACKING =====

/**
 * Calculate overall progress and statistics
 * @param {Object} plan - Study plan
 * @param {Object} userStats - User's completion stats
 * @returns {Object} - Progress statistics
 */
export const calculateProgress = (plan, userStats) => {
  if (!plan || !plan.dailyTasks) {
    return {
      daysCompleted: 0,
      tasksCompleted: 0,
      totalTasks: 0,
      completionRate: 0,
      currentDay: 1,
      streak: 0,
      nextMilestone: MILESTONES[0],
      phase: null
    };
  }
  
  const today = new Date().toISOString().split('T')[0];
  const planStart = plan.activatedAt ? new Date(plan.activatedAt) : new Date();
  const daysSinceStart = Math.floor((new Date() - planStart) / (1000 * 60 * 60 * 24)) + 1;
  const currentDay = Math.min(daysSinceStart, plan.planDuration);
  
  let tasksCompleted = 0;
  let totalTasks = 0;
  let daysCompleted = 0;
  
  plan.dailyTasks.forEach((day, index) => {
    const dayNum = index + 1;
    if (dayNum <= currentDay) {
      day.tasks.forEach(task => {
        totalTasks++;
        if (task.completed) tasksCompleted++;
      });
      if (day.completed) daysCompleted++;
    }
  });
  
  const completionRate = totalTasks > 0 ? (tasksCompleted / totalTasks) * 100 : 0;
  
  // Find current phase
  const phase = plan.phases?.find(p => currentDay >= p.days[0] && currentDay <= p.days[1]);
  
  // Find next milestone
  const nextMilestone = plan.milestones?.find(m => m.day > daysCompleted) || null;
  
  // Calculate streak (consecutive days completed)
  let streak = 0;
  for (let i = currentDay - 1; i >= 0; i--) {
    if (plan.dailyTasks[i]?.completed) {
      streak++;
    } else {
      break;
    }
  }
  
  return {
    daysCompleted,
    tasksCompleted,
    totalTasks,
    completionRate: Math.round(completionRate),
    currentDay,
    streak,
    nextMilestone,
    phase,
    isOnTrack: completionRate >= 70,
    daysRemaining: plan.planDuration - currentDay
  };
};

/**
 * Check and return any newly reached milestones
 * @param {Object} plan - Study plan with progress
 * @param {number} previousDaysCompleted - Days completed before this session
 * @returns {Array} - Newly reached milestones
 */
export const checkMilestones = (plan, previousDaysCompleted) => {
  const progress = calculateProgress(plan);
  const newMilestones = [];
  
  plan.milestones?.forEach(milestone => {
    if (progress.daysCompleted >= milestone.day && previousDaysCompleted < milestone.day) {
      newMilestones.push(milestone);
    }
  });
  
  return newMilestones;
};

// ===== PERSISTENCE HELPERS =====

/**
 * Initialize or update roadmap data for a user
 */
export const getDefaultRoadmapState = () => ({
  assessmentComplete: false,
  skills: {},
  currentPlan: null,
  planHistory: [],
  preferences: {
    company: null,
    timeCommitment: 'moderate',
    notifications: true
  }
});

export default {
  SKILL_CATEGORIES,
  ASSESSMENT_QUESTIONS,
  COMPANY_FOCUS,
  TIME_COMMITMENTS,
  MILESTONES,
  calculateSkillLevels,
  getWeakAreas,
  generateStudyPlan,
  adjustPlanForPerformance,
  getDailyRecommendations,
  calculateProgress,
  checkMilestones,
  getDefaultRoadmapState
};
