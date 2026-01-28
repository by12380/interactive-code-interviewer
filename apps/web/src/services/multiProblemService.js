// Multi-Problem Practice Service
// Handles session management, pattern recognition, and approach comparison across multiple problems

import { PROBLEMS, getProblemById } from "../data/problems.js";

// Pattern categories for recognizing similarities across problems
const PATTERN_CATEGORIES = {
  TWO_POINTERS: {
    id: "two-pointers",
    name: "Two Pointers",
    description: "Using two pointers to traverse data from different positions",
    keywords: ["left", "right", "start", "end", "while", "pointer"],
    problems: ["two-sum", "valid-parentheses"],
  },
  HASH_MAP: {
    id: "hash-map",
    name: "Hash Map / Set",
    description: "Using hash maps or sets for O(1) lookups",
    keywords: ["Map", "Set", "hash", "lookup", "seen", "visited"],
    problems: ["two-sum", "contains-duplicate"],
  },
  STACK: {
    id: "stack",
    name: "Stack",
    description: "LIFO data structure for tracking state",
    keywords: ["stack", "push", "pop", "LIFO"],
    problems: ["valid-parentheses"],
  },
  SORTING: {
    id: "sorting",
    name: "Sorting",
    description: "Sorting data to enable efficient processing",
    keywords: ["sort", "sorted", "ascending", "descending"],
    problems: ["merge-intervals"],
  },
  DYNAMIC_PROGRAMMING: {
    id: "dp",
    name: "Dynamic Programming",
    description: "Breaking down problems into overlapping subproblems",
    keywords: ["dp", "memo", "tabulation", "subproblem", "optimal"],
    problems: ["maximum-subarray", "climbing-stairs"],
  },
  BINARY_SEARCH: {
    id: "binary-search",
    name: "Binary Search",
    description: "Divide and conquer approach for sorted data",
    keywords: ["binary", "mid", "left", "right", "log n"],
    problems: ["binary-search"],
  },
  LINKED_LIST: {
    id: "linked-list",
    name: "Linked List",
    description: "Pointer manipulation for linked structures",
    keywords: ["next", "node", "head", "tail", "linked"],
    problems: ["reverse-linked-list"],
  },
  GREEDY: {
    id: "greedy",
    name: "Greedy",
    description: "Making locally optimal choices",
    keywords: ["greedy", "optimal", "max", "min", "best"],
    problems: ["maximum-subarray"],
  },
};

// Create a new multi-problem session
export function createMultiProblemSession(problemIds = []) {
  const session = {
    id: `mps-${Date.now()}`,
    createdAt: Date.now(),
    problems: problemIds.map((id, index) => ({
      problemId: id,
      slotIndex: index,
      code: getProblemById(id)?.starterCode || "",
      startedAt: null,
      completedAt: null,
      timeSpent: 0,
      testsPassed: 0,
      testsTotal: 0,
      efficiency: "Not evaluated",
      notes: "",
      approach: "",
    })),
    activeSlot: 0,
    totalTimeSpent: 0,
    patternInsights: [],
    comparisonNotes: "",
    status: "active", // active, completed, paused
  };

  return session;
}

// Add a problem to an existing session
export function addProblemToSession(session, problemId) {
  if (session.problems.length >= 3) {
    return { success: false, error: "Maximum 3 problems allowed" };
  }

  if (session.problems.some((p) => p.problemId === problemId)) {
    return { success: false, error: "Problem already in session" };
  }

  const problem = getProblemById(problemId);
  if (!problem) {
    return { success: false, error: "Problem not found" };
  }

  const newProblem = {
    problemId,
    slotIndex: session.problems.length,
    code: problem.starterCode,
    startedAt: null,
    completedAt: null,
    timeSpent: 0,
    testsPassed: 0,
    testsTotal: 0,
    efficiency: "Not evaluated",
    notes: "",
    approach: "",
  };

  return {
    success: true,
    session: {
      ...session,
      problems: [...session.problems, newProblem],
    },
  };
}

// Remove a problem from session
export function removeProblemFromSession(session, slotIndex) {
  if (session.problems.length <= 1) {
    return { success: false, error: "At least one problem required" };
  }

  const newProblems = session.problems
    .filter((p) => p.slotIndex !== slotIndex)
    .map((p, index) => ({ ...p, slotIndex: index }));

  let newActiveSlot = session.activeSlot;
  if (slotIndex === session.activeSlot) {
    newActiveSlot = Math.max(0, slotIndex - 1);
  } else if (slotIndex < session.activeSlot) {
    newActiveSlot = session.activeSlot - 1;
  }

  return {
    success: true,
    session: {
      ...session,
      problems: newProblems,
      activeSlot: newActiveSlot,
    },
  };
}

// Update code for a specific problem in the session
export function updateProblemCode(session, slotIndex, code) {
  const newProblems = session.problems.map((p) => {
    if (p.slotIndex === slotIndex) {
      return {
        ...p,
        code,
        startedAt: p.startedAt || Date.now(),
      };
    }
    return p;
  });

  return { ...session, problems: newProblems };
}

// Update problem metrics (tests, efficiency, etc.)
export function updateProblemMetrics(session, slotIndex, metrics) {
  const newProblems = session.problems.map((p) => {
    if (p.slotIndex === slotIndex) {
      return { ...p, ...metrics };
    }
    return p;
  });

  return { ...session, problems: newProblems };
}

// Switch active problem slot
export function switchActiveSlot(session, slotIndex) {
  if (slotIndex < 0 || slotIndex >= session.problems.length) {
    return session;
  }
  return { ...session, activeSlot: slotIndex };
}

// Analyze code for patterns
export function analyzeCodePatterns(code) {
  const patterns = [];

  for (const [key, pattern] of Object.entries(PATTERN_CATEGORIES)) {
    const hasKeyword = pattern.keywords.some((keyword) =>
      code.toLowerCase().includes(keyword.toLowerCase())
    );
    if (hasKeyword) {
      patterns.push({
        id: pattern.id,
        name: pattern.name,
        description: pattern.description,
        confidence: calculatePatternConfidence(code, pattern.keywords),
      });
    }
  }

  return patterns.sort((a, b) => b.confidence - a.confidence);
}

// Calculate pattern confidence based on keyword frequency
function calculatePatternConfidence(code, keywords) {
  const lowerCode = code.toLowerCase();
  let matches = 0;
  let totalKeywords = keywords.length;

  for (const keyword of keywords) {
    const regex = new RegExp(keyword.toLowerCase(), "gi");
    const count = (lowerCode.match(regex) || []).length;
    if (count > 0) {
      matches += Math.min(count, 3); // Cap at 3 to avoid over-weighting
    }
  }

  return Math.min(Math.round((matches / totalKeywords) * 100), 100);
}

// Compare approaches across problems in a session
export function compareApproaches(session) {
  const comparisons = [];

  // Get all patterns from all problems
  const problemPatterns = session.problems.map((p) => ({
    problemId: p.problemId,
    problem: getProblemById(p.problemId),
    patterns: analyzeCodePatterns(p.code),
    code: p.code,
  }));

  // Find common patterns
  const allPatterns = new Map();
  problemPatterns.forEach((pp) => {
    pp.patterns.forEach((pattern) => {
      if (!allPatterns.has(pattern.id)) {
        allPatterns.set(pattern.id, []);
      }
      allPatterns.get(pattern.id).push({
        problemId: pp.problemId,
        problemTitle: pp.problem?.title || pp.problemId,
        confidence: pattern.confidence,
      });
    });
  });

  // Generate insights for patterns used in multiple problems
  allPatterns.forEach((problems, patternId) => {
    if (problems.length > 1) {
      const pattern = Object.values(PATTERN_CATEGORIES).find(
        (p) => p.id === patternId
      );
      if (pattern) {
        comparisons.push({
          type: "shared_pattern",
          pattern: pattern.name,
          description: pattern.description,
          problems: problems.map((p) => ({
            id: p.problemId,
            title: p.problemTitle,
            confidence: p.confidence,
          })),
          insight: `Both ${problems
            .map((p) => p.problemTitle)
            .join(" and ")} use the ${pattern.name} pattern. Consider how the implementation differs between them.`,
        });
      }
    }
  });

  // Compare complexity
  const complexities = session.problems.map((p) => ({
    problemId: p.problemId,
    title: getProblemById(p.problemId)?.title || p.problemId,
    efficiency: p.efficiency,
    optimal: getProblemById(p.problemId)?.optimalComplexity,
  }));

  const optimalCount = complexities.filter(
    (c) => c.efficiency === c.optimal
  ).length;
  if (optimalCount > 0) {
    comparisons.push({
      type: "complexity",
      title: "Complexity Analysis",
      description: `${optimalCount} of ${session.problems.length} solutions achieve optimal complexity`,
      problems: complexities,
      insight:
        optimalCount === session.problems.length
          ? "All solutions are optimal! Great job recognizing the best approach for each problem."
          : `Consider optimizing: ${complexities
              .filter((c) => c.efficiency !== c.optimal)
              .map((c) => c.title)
              .join(", ")}`,
    });
  }

  // Time comparison
  const timeComparison = session.problems
    .filter((p) => p.timeSpent > 0)
    .map((p) => ({
      problemId: p.problemId,
      title: getProblemById(p.problemId)?.title || p.problemId,
      timeSpent: p.timeSpent,
      difficulty: getProblemById(p.problemId)?.difficulty,
    }));

  if (timeComparison.length > 1) {
    const avgTime =
      timeComparison.reduce((sum, t) => sum + t.timeSpent, 0) /
      timeComparison.length;
    comparisons.push({
      type: "time",
      title: "Time Analysis",
      description: `Average time: ${formatTime(avgTime)}`,
      problems: timeComparison.map((t) => ({
        ...t,
        formattedTime: formatTime(t.timeSpent),
      })),
      insight:
        timeComparison.length > 0
          ? `Fastest: ${
              timeComparison.sort((a, b) => a.timeSpent - b.timeSpent)[0].title
            }`
          : null,
    });
  }

  return comparisons;
}

// Format time in minutes and seconds
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Generate session summary
export function generateSessionSummary(session) {
  const summary = {
    sessionId: session.id,
    duration: session.totalTimeSpent,
    formattedDuration: formatTime(session.totalTimeSpent),
    problemsAttempted: session.problems.length,
    problemsCompleted: session.problems.filter((p) => p.completedAt).length,
    totalTestsPassed: session.problems.reduce(
      (sum, p) => sum + p.testsPassed,
      0
    ),
    totalTests: session.problems.reduce((sum, p) => sum + p.testsTotal, 0),
    problems: session.problems.map((p) => {
      const problem = getProblemById(p.problemId);
      return {
        id: p.problemId,
        title: problem?.title || p.problemId,
        difficulty: problem?.difficulty || "Unknown",
        category: problem?.category || "Unknown",
        timeSpent: p.timeSpent,
        formattedTime: formatTime(p.timeSpent),
        testsPassed: p.testsPassed,
        testsTotal: p.testsTotal,
        efficiency: p.efficiency,
        isOptimal: p.efficiency === problem?.optimalComplexity,
        completed: !!p.completedAt,
        patterns: analyzeCodePatterns(p.code),
      };
    }),
    comparisons: compareApproaches(session),
    patternsSummary: getPatternsSummary(session),
    recommendations: generateRecommendations(session),
  };

  return summary;
}

// Get summary of patterns used across all problems
function getPatternsSummary(session) {
  const patternCounts = new Map();

  session.problems.forEach((p) => {
    const patterns = analyzeCodePatterns(p.code);
    patterns.forEach((pattern) => {
      if (!patternCounts.has(pattern.id)) {
        patternCounts.set(pattern.id, {
          ...pattern,
          count: 0,
          problems: [],
        });
      }
      const entry = patternCounts.get(pattern.id);
      entry.count++;
      entry.problems.push(getProblemById(p.problemId)?.title || p.problemId);
    });
  });

  return Array.from(patternCounts.values()).sort((a, b) => b.count - a.count);
}

// Generate recommendations based on session performance
function generateRecommendations(session) {
  const recommendations = [];
  const problems = session.problems;

  // Check for pattern variety
  const allPatterns = new Set();
  problems.forEach((p) => {
    analyzeCodePatterns(p.code).forEach((pattern) => allPatterns.add(pattern.id));
  });

  if (allPatterns.size < 2 && problems.length > 1) {
    recommendations.push({
      type: "variety",
      title: "Explore Different Patterns",
      description:
        "Try selecting problems that use different algorithmic patterns to broaden your skills.",
    });
  }

  // Check for incomplete problems
  const incompleteCount = problems.filter((p) => !p.completedAt).length;
  if (incompleteCount > 0) {
    recommendations.push({
      type: "completion",
      title: "Complete All Problems",
      description: `You have ${incompleteCount} incomplete problem(s). Consider finishing them to get a complete comparison.`,
    });
  }

  // Check for suboptimal solutions
  const suboptimalCount = problems.filter((p) => {
    const problem = getProblemById(p.problemId);
    return p.efficiency !== "Not evaluated" && p.efficiency !== problem?.optimalComplexity;
  }).length;

  if (suboptimalCount > 0) {
    recommendations.push({
      type: "optimization",
      title: "Optimize Your Solutions",
      description: `${suboptimalCount} solution(s) could be improved. Review the optimal approaches after completing.`,
    });
  }

  // Suggest related problems
  const categories = [...new Set(problems.map((p) => getProblemById(p.problemId)?.category))];
  const relatedProblems = PROBLEMS.filter(
    (p) =>
      categories.includes(p.category) &&
      !problems.some((sp) => sp.problemId === p.id)
  ).slice(0, 3);

  if (relatedProblems.length > 0) {
    recommendations.push({
      type: "related",
      title: "Try Related Problems",
      description: `Based on your practice, consider: ${relatedProblems.map((p) => p.title).join(", ")}`,
      problems: relatedProblems.map((p) => ({ id: p.id, title: p.title })),
    });
  }

  return recommendations;
}

// Get problems grouped by pattern
export function getProblemsByPattern() {
  const grouped = {};

  for (const [key, pattern] of Object.entries(PATTERN_CATEGORIES)) {
    grouped[pattern.id] = {
      name: pattern.name,
      description: pattern.description,
      problems: pattern.problems
        .map((id) => getProblemById(id))
        .filter(Boolean),
    };
  }

  return grouped;
}

// Suggest problems that share patterns with a given problem
export function getSimilarProblems(problemId) {
  const targetProblem = getProblemById(problemId);
  if (!targetProblem) return [];

  const targetPatterns = new Set();
  for (const [key, pattern] of Object.entries(PATTERN_CATEGORIES)) {
    if (pattern.problems.includes(problemId)) {
      targetPatterns.add(pattern.id);
      pattern.problems.forEach((p) => {
        if (p !== problemId) {
          targetPatterns.add(p);
        }
      });
    }
  }

  const similar = PROBLEMS.filter(
    (p) =>
      p.id !== problemId &&
      Object.values(PATTERN_CATEGORIES).some(
        (pattern) =>
          pattern.problems.includes(p.id) &&
          pattern.problems.includes(problemId)
      )
  );

  return similar.map((p) => ({
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    category: p.category,
    sharedPatterns: Object.values(PATTERN_CATEGORIES)
      .filter(
        (pattern) =>
          pattern.problems.includes(p.id) && pattern.problems.includes(problemId)
      )
      .map((pattern) => pattern.name),
  }));
}

// Quick swap suggestion - find a problem that complements current selection
export function suggestProblemSwap(session, slotIndex) {
  const currentProblem = session.problems[slotIndex];
  if (!currentProblem) return null;

  const otherProblemIds = session.problems
    .filter((p) => p.slotIndex !== slotIndex)
    .map((p) => p.problemId);

  // Get patterns from other problems
  const otherPatterns = new Set();
  otherProblemIds.forEach((id) => {
    Object.values(PATTERN_CATEGORIES).forEach((pattern) => {
      if (pattern.problems.includes(id)) {
        otherPatterns.add(pattern.id);
      }
    });
  });

  // Find problems that share at least one pattern with other problems
  const suggestions = PROBLEMS.filter((p) => {
    if (session.problems.some((sp) => sp.problemId === p.id)) return false;

    return Object.values(PATTERN_CATEGORIES).some(
      (pattern) =>
        pattern.problems.includes(p.id) &&
        Array.from(otherPatterns).some((op) =>
          Object.values(PATTERN_CATEGORIES).find(
            (pat) => pat.id === op && pat.problems.includes(p.id)
          )
        )
    );
  });

  return suggestions.slice(0, 5).map((p) => ({
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    category: p.category,
    reason: `Shares patterns with ${otherProblemIds
      .map((id) => getProblemById(id)?.title)
      .filter(Boolean)
      .join(", ")}`,
  }));
}

export default {
  createMultiProblemSession,
  addProblemToSession,
  removeProblemFromSession,
  updateProblemCode,
  updateProblemMetrics,
  switchActiveSlot,
  analyzeCodePatterns,
  compareApproaches,
  generateSessionSummary,
  getProblemsByPattern,
  getSimilarProblems,
  suggestProblemSwap,
};
