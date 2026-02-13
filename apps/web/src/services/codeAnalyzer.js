// Real-time code analysis for detecting common mistakes and inefficient patterns
// Returns interruption messages when issues are detected

// Pattern definitions for different problem types
const PROBLEM_PATTERNS = {
  "two-sum": {
    inefficientPatterns: [
      {
        // Nested for loops - brute force approach
        pattern: /for\s*\([^)]*\)\s*\{[^}]*for\s*\([^)]*\)/s,
        message: "Hold on - I see you're writing nested loops. That would be O(n²). Have you considered using a hash map to achieve O(n)?",
        severity: "approach"
      },
      {
        // Using indexOf inside a loop
        pattern: /for[\s\S]*\.indexOf\s*\(/,
        message: "Wait - using indexOf inside a loop gives you O(n²) complexity. A hash map would let you look up values in O(1).",
        severity: "approach"
      },
      {
        // Using includes inside a loop
        pattern: /for[\s\S]*\.includes\s*\(/,
        message: "Pause - I notice you're using .includes() inside a loop. That's O(n) for each check. Would a Set or Map be more efficient?",
        severity: "approach"
      },
      {
        // Using filter inside a loop
        pattern: /for[\s\S]*\.filter\s*\(/,
        message: "Quick question - you're using filter inside a loop which is O(n²). Can you think of a single-pass solution?",
        severity: "approach"
      },
      {
        // Sorting the array (not optimal for two-sum indices)
        pattern: /\.sort\s*\(/,
        message: "I see you're sorting the array. Remember, you need to return the original indices. How will you track them after sorting?",
        severity: "correctness"
      }
    ],
    missingPatterns: [
      {
        // No Map or object for lookup
        check: (code) => !code.includes("Map") && !code.includes("{}") && !/\{\s*\}/.test(code) && !code.includes("= {}"),
        afterLines: 3,
        message: "Before you continue - what data structure are you planning to use for lookups? Have you thought about a hash map?",
        severity: "approach"
      }
    ],
    goodPatterns: [
      /new Map\s*\(/,
      /\.has\s*\(/,
      /\.get\s*\(/,
      /const\s+\w+\s*=\s*\{\}/
    ]
  },
  "valid-parentheses": {
    inefficientPatterns: [
      {
        // Using replace in a loop (iterative removal approach)
        pattern: /while[\s\S]*\.replace\s*\(/,
        message: "I notice you're using string replacement in a loop. That's O(n²). A stack-based approach would be O(n) - have you considered that?",
        severity: "approach"
      },
      {
        // Counting brackets without stack
        pattern: /let\s+\w*count|let\s+\w*open|let\s+\w*close/i,
        message: "Wait - are you counting brackets? That won't handle cases like '([)]'. You need to track the order. What data structure maintains order?",
        severity: "correctness"
      }
    ],
    missingPatterns: [
      {
        check: (code) => !code.includes("[]") && !code.includes("push") && !code.includes("pop") && !code.includes("stack"),
        afterLines: 3,
        message: "Before you go further - this problem needs a specific data structure to track bracket order. Which one comes to mind?",
        severity: "approach"
      }
    ],
    goodPatterns: [
      /\[\s*\]/,
      /\.push\s*\(/,
      /\.pop\s*\(/,
      /stack/i
    ]
  },
  "merge-intervals": {
    inefficientPatterns: [
      {
        // Not sorting first
        pattern: /function\s+merge[\s\S]{20,}for[\s\S]*(?!\.sort)/,
        message: "Hold on - are you iterating without sorting first? Merging intervals is much easier if they're sorted by start time.",
        severity: "approach"
      }
    ],
    missingPatterns: [
      {
        check: (code) => code.length > 100 && !code.includes(".sort"),
        afterLines: 5,
        message: "Quick check - what's your first step? For interval problems, sorting often simplifies the logic significantly.",
        severity: "approach"
      }
    ],
    goodPatterns: [
      /\.sort\s*\(\s*\(a,\s*b\)/
    ]
  },
  "reverse-linked-list": {
    inefficientPatterns: [
      {
        // Using an array to store values
        pattern: /\[\s*\][\s\S]*\.push[\s\S]*while[\s\S]*\.pop|while[\s\S]*\.push[\s\S]*\[\s*\]/,
        message: "I see you're using an array. While that works, can you do it in O(1) space by just manipulating pointers?",
        severity: "optimization"
      }
    ],
    missingPatterns: [
      {
        check: (code) => code.length > 80 && !code.includes("prev") && !code.includes("next") && !code.includes("current"),
        afterLines: 4,
        message: "For reversing a linked list, you typically need three pointers. What are they tracking?",
        severity: "approach"
      }
    ],
    goodPatterns: [
      /prev\s*=\s*null/,
      /current\s*=\s*head/,
      /\.next/
    ]
  },
  "maximum-subarray": {
    inefficientPatterns: [
      {
        // Nested loops for subarray sum
        pattern: /for\s*\([^)]*\)\s*\{[^}]*for\s*\([^)]*\)/s,
        message: "Wait - nested loops will give O(n²) or O(n³). This problem has a famous O(n) solution. Have you heard of Kadane's algorithm?",
        severity: "approach"
      },
      {
        // Using slice inside a loop
        pattern: /for[\s\S]*\.slice\s*\(/,
        message: "Using slice inside a loop creates unnecessary copies. Can you track the sum incrementally instead?",
        severity: "optimization"
      }
    ],
    missingPatterns: [
      {
        check: (code) => code.length > 100 && !code.includes("currentSum") && !code.includes("maxSum") && !code.includes("current") && !code.includes("max"),
        afterLines: 4,
        message: "Think about this: at each position, you have two choices. What are they? This leads to the key insight.",
        severity: "approach"
      }
    ],
    goodPatterns: [
      /Math\.max/,
      /currentSum|current_sum|localMax/i,
      /maxSum|max_sum|globalMax/i
    ]
  },
  "binary-search": {
    inefficientPatterns: [
      {
        // Linear search
        pattern: /for\s*\([^)]*\)\s*\{[^}]*if\s*\([^)]*===?\s*target/,
        message: "Hold on - that's a linear search O(n). The problem specifically asks for O(log n). What search algorithm achieves that?",
        severity: "requirement"
      },
      {
        // Using indexOf or includes
        pattern: /\.indexOf\s*\(|\.includes\s*\(/,
        message: "Wait - indexOf and includes are O(n). You need to implement binary search yourself for O(log n).",
        severity: "requirement"
      }
    ],
    missingPatterns: [
      {
        check: (code) => code.length > 50 && !code.includes("left") && !code.includes("right") && !code.includes("mid") && !code.includes("low") && !code.includes("high"),
        afterLines: 3,
        message: "For binary search, what pointers do you need to track? Think about the search space.",
        severity: "approach"
      }
    ],
    goodPatterns: [
      /left|low/i,
      /right|high/i,
      /mid/i,
      /Math\.floor/
    ]
  },
  "climbing-stairs": {
    inefficientPatterns: [
      {
        // Pure recursion without memoization
        pattern: /function\s+climbStairs[\s\S]*return\s+climbStairs\s*\([^)]*-\s*1\)\s*\+\s*climbStairs\s*\([^)]*-\s*2\)/,
        message: "I see recursive calls. Without memoization, this is O(2^n)! Are you planning to add caching?",
        severity: "approach"
      }
    ],
    missingPatterns: [
      {
        check: (code) => code.length > 60 && !code.includes("dp") && !code.includes("memo") && !code.includes("prev") && !code.includes("cache"),
        afterLines: 3,
        message: "This is a classic DP problem. Do you recognize the pattern? What famous sequence does it relate to?",
        severity: "approach"
      }
    ],
    goodPatterns: [
      /dp|memo|cache/i,
      /prev|fibonacci/i
    ]
  },
  "contains-duplicate": {
    inefficientPatterns: [
      {
        // Nested loops
        pattern: /for\s*\([^)]*\)\s*\{[^}]*for\s*\([^)]*\)/s,
        message: "Nested loops give O(n²). There's a much simpler O(n) solution using a specific data structure. Which one?",
        severity: "approach"
      },
      {
        // Sorting to find duplicates
        pattern: /\.sort\s*\(\s*\)/,
        message: "Sorting works but it's O(n log n). Can you think of an O(n) approach using extra space?",
        severity: "optimization"
      }
    ],
    missingPatterns: [
      {
        check: (code) => code.length > 50 && !code.includes("Set") && !code.includes("Map") && !code.includes("{}"),
        afterLines: 2,
        message: "What data structure automatically handles uniqueness? That's the key insight here.",
        severity: "approach"
      }
    ],
    goodPatterns: [
      /new Set/,
      /\.has\s*\(/,
      /\.add\s*\(/
    ]
  }
};

// Generic patterns that apply to all problems
const GENERIC_PATTERNS = {
  syntaxIssues: [
    {
      pattern: /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*\}\s*\}(?!\s*$)/,
      message: "I notice your curly braces might not be balanced. Double-check your function structure.",
      severity: "syntax"
    }
  ],
  // Detect when user starts coding immediately without explaining approach
  codingWithoutApproach: [
    {
      // User starts writing actual code (variables, loops, etc.) immediately
      check: (code, starterCode, timeCoding, hasUserExplained) => {
        if (hasUserExplained) return false;
        const userCode = code.replace(starterCode, "").trim();
        // Check if they've written actual implementation code
        const hasImplementationCode = /\b(let|const|var)\s+\w+\s*=|for\s*\(|while\s*\(|if\s*\(|\.push\(|\.pop\(|new Map|new Set|\[\s*\]|{\s*}/.test(userCode);
        const meaningfulCode = userCode.replace(/\/\/.*$/gm, "").replace(/\s/g, "").length;
        return hasImplementationCode && meaningfulCode > 15;
      },
      message: "Wait - I see you're jumping straight into coding. Can you first walk me through your approach? What's your thought process here?",
      severity: "process"
    }
  ],
  noProgress: [
    {
      // Empty function body after some time
      check: (code, starterCode, timeCoding) => {
        const userCode = code.replace(starterCode, "").replace(/\/\/.*$/gm, "").trim();
        return timeCoding > 90 && userCode.length < 10;
      },
      message: "I notice you're taking your time. Would you like to talk through the problem together? What's your initial thinking?",
      severity: "process"
    }
  ]
};

// Tracks analysis state to avoid spamming the same messages
// Uses progressive cooldowns and an API budget to balance helpfulness vs. cost
class CodeAnalyzerState {
  constructor() {
    this.lastInterruptionTime = 0;
    this.triggeredMessages = new Set();
    this.codeSnapshots = [];
    this.typingStartTime = null;
    this.hasExplainedApproach = false;
    this.lineCountAtLastCheck = 0;
    // Interrupt budget: limits AI-powered (API) interrupts per session
    this.aiInterruptCount = 0;
    this.localInterruptCount = 0;
    this.maxAIInterrupts = 5;
    // Test tracking for regression detection
    this.lastTestResults = null;
    this.codeAtLastTestRun = null;
  }

  reset() {
    this.lastInterruptionTime = 0;
    this.triggeredMessages.clear();
    this.codeSnapshots = [];
    this.typingStartTime = null;
    this.hasExplainedApproach = false;
    this.lineCountAtLastCheck = 0;
    this.aiInterruptCount = 0;
    this.localInterruptCount = 0;
    this.lastTestResults = null;
    this.codeAtLastTestRun = null;
  }

  // Progressive cooldown: increases after each interrupt to avoid overwhelming
  // the user. Starts at 45s and escalates to 3 minutes.
  getProgressiveCooldown() {
    const totalInterrupts = this.aiInterruptCount + this.localInterruptCount;
    if (totalInterrupts <= 1) return 45000;   // 45s
    if (totalInterrupts <= 3) return 60000;   // 1 min
    if (totalInterrupts <= 5) return 90000;   // 1.5 min
    if (totalInterrupts <= 7) return 120000;  // 2 min
    return 180000;                             // 3 min
  }

  canInterrupt() {
    const now = Date.now();
    return now - this.lastInterruptionTime >= this.getProgressiveCooldown();
  }

  // Check if we still have API budget remaining
  canAffordAPICall() {
    return this.aiInterruptCount < this.maxAIInterrupts;
  }

  // Mark an AI-powered interrupt (costs an API call)
  markInterrupted(messageKey) {
    this.lastInterruptionTime = Date.now();
    this.triggeredMessages.add(messageKey);
    this.aiInterruptCount++;
  }

  // Mark a local-only interrupt (free, no API call)
  markLocalInterrupt(messageKey) {
    this.lastInterruptionTime = Date.now();
    this.triggeredMessages.add(messageKey);
    this.localInterruptCount++;
  }

  hasTriggered(messageKey) {
    return this.triggeredMessages.has(messageKey);
  }

  recordSnapshot(code) {
    this.codeSnapshots.push({
      code,
      timestamp: Date.now()
    });
    // Keep only last 10 snapshots
    if (this.codeSnapshots.length > 10) {
      this.codeSnapshots.shift();
    }
  }

  getTimeSinceFirstCode() {
    if (this.codeSnapshots.length === 0) return 0;
    return Date.now() - this.codeSnapshots[0].timestamp;
  }

  // Detect when user is writing and deleting code repeatedly (going in circles).
  // Looks at recent code snapshots for oscillating length patterns with minimal
  // net progress — a strong signal the user is stuck.
  detectSpinningWheels() {
    if (this.codeSnapshots.length < 5) return false;

    const recent = this.codeSnapshots.slice(-5);
    let directionChanges = 0;
    let lastDirection = 0;

    for (let i = 1; i < recent.length; i++) {
      const delta = recent[i].code.length - recent[i - 1].code.length;
      const direction = Math.sign(delta);
      if (direction !== 0 && lastDirection !== 0 && direction !== lastDirection) {
        directionChanges++;
      }
      if (direction !== 0) lastDirection = direction;
    }

    // Net progress is minimal — they're not actually advancing
    const netChange = Math.abs(
      recent[recent.length - 1].code.length - recent[0].code.length
    );

    return directionChanges >= 2 && netChange < 30;
  }

  // Update test results for regression tracking
  updateTestResults(results, code) {
    const previous = this.lastTestResults;
    this.lastTestResults = results
      ? { passed: results.passed, total: results.total }
      : null;
    this.codeAtLastTestRun = code;
    return previous;
  }
}

// Main analysis function
export function analyzeCode(code, problemId, starterCode, analyzerState, hasUserExplained = false) {
  if (!analyzerState.canInterrupt()) {
    return null;
  }

  // problemPatterns may be null for problems not in the predefined list —
  // that's fine, generic checks (approach, progress, spinning wheels) still run.
  const problemPatterns = PROBLEM_PATTERNS[problemId];

  // Calculate meaningful code written
  const userCode = code.replace(starterCode, "").trim();
  const meaningfulLines = userCode.split("\n").filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("//");
  }).length;

  // Record snapshot for timing analysis
  analyzerState.recordSnapshot(code);
  const timeCoding = analyzerState.getTimeSinceFirstCode();

  // ── GENERIC CHECKS (run for ALL problems) ──────────────────────────

  // PRIORITY 1: Check if user is coding without explaining approach first
  // This is the most important check - real interviewers always ask for approach first
  for (const warning of GENERIC_PATTERNS.codingWithoutApproach) {
    if (warning.check && !analyzerState.hasTriggered("coding-without-approach")) {
      if (warning.check(code, starterCode, timeCoding / 1000, hasUserExplained)) {
        analyzerState.markLocalInterrupt("coding-without-approach");
        return {
          message: warning.message,
          severity: warning.severity,
          type: "interruption",
          tier: "local"
        };
      }
    }
  }

  // Check for no progress (user hasn't started after a while)
  for (const warning of GENERIC_PATTERNS.noProgress) {
    if (warning.check && !analyzerState.hasTriggered("no-progress")) {
      if (warning.check(code, starterCode, timeCoding / 1000)) {
        analyzerState.markLocalInterrupt("no-progress");
        return {
          message: warning.message,
          severity: warning.severity,
          type: "interruption",
          tier: "local"
        };
      }
    }
  }

  // ── PROBLEM-SPECIFIC CHECKS (only for problems with predefined patterns) ─

  if (problemPatterns) {
    // Check for inefficient patterns
    for (let i = 0; i < problemPatterns.inefficientPatterns.length; i++) {
      const pattern = problemPatterns.inefficientPatterns[i];
      const patternKey = `inefficient-${i}`;
      
      if (!analyzerState.hasTriggered(patternKey) && pattern.pattern.test(code)) {
        analyzerState.markLocalInterrupt(patternKey);
        return {
          message: pattern.message,
          severity: pattern.severity,
          type: "interruption",
          tier: "local"
        };
      }
    }

    // Check for missing patterns (only after enough code is written)
    for (let i = 0; i < problemPatterns.missingPatterns.length; i++) {
      const pattern = problemPatterns.missingPatterns[i];
      const patternKey = `missing-${i}`;
      
      if (!analyzerState.hasTriggered(patternKey) && 
          meaningfulLines >= (pattern.afterLines || 3) &&
          pattern.check(code)) {
        
        // Don't trigger if they're already on the right track
        const hasGoodPattern = problemPatterns.goodPatterns?.some(gp => gp.test(code));
        if (!hasGoodPattern) {
          analyzerState.markLocalInterrupt(patternKey);
          return {
            message: pattern.message,
            severity: pattern.severity,
            type: "interruption",
            tier: "local"
          };
        }
      }
    }
  }

  // ── STUCK DETECTION (runs for ALL problems) ────────────────────────

  // Check for spinning wheels (user writing and deleting code repeatedly)
  // This is the only pattern that uses an API call because we need the AI
  // to look at the full code context and give targeted guidance.
  if (!analyzerState.hasTriggered("spinning-wheels") && analyzerState.detectSpinningWheels()) {
    if (analyzerState.canAffordAPICall()) {
      analyzerState.markInterrupted("spinning-wheels");
      return {
        message: "The user seems to be going back and forth with their code — writing, deleting, rewriting. They appear stuck and may need help identifying what specific part they're struggling with.",
        severity: "process",
        type: "interruption",
        tier: "api"
      };
    }
  }

  // Update line count for next check
  analyzerState.lineCountAtLastCheck = meaningfulLines;

  return null;
}

// Create a new analyzer state instance
export function createAnalyzerState() {
  return new CodeAnalyzerState();
}

// Check if the user seems to be going for a good approach
export function isUsingGoodApproach(code, problemId) {
  const problemPatterns = PROBLEM_PATTERNS[problemId];
  if (!problemPatterns?.goodPatterns) return false;
  
  return problemPatterns.goodPatterns.some(pattern => pattern.test(code));
}

// Get a quick assessment of code quality
export function assessCodeQuality(code, problemId) {
  const problemPatterns = PROBLEM_PATTERNS[problemId];
  if (!problemPatterns) return { quality: "unknown", issues: [] };

  const issues = [];
  
  // Check inefficient patterns
  for (const pattern of problemPatterns.inefficientPatterns) {
    if (pattern.pattern.test(code)) {
      issues.push({
        type: pattern.severity,
        description: pattern.message
      });
    }
  }

  // Check for good patterns
  const hasGoodApproach = problemPatterns.goodPatterns?.some(gp => gp.test(code));

  return {
    quality: issues.length === 0 && hasGoodApproach ? "good" : 
             issues.length === 0 ? "neutral" : "needs_improvement",
    issues,
    hasGoodApproach
  };
}

// Analyze test results for regression or stalling.
// Called after the user runs tests. Compares against previous results
// to detect when code changes broke passing tests or made no improvement.
export function analyzeTestResults(currentResults, analyzerState, currentCode) {
  if (!currentResults || !analyzerState.lastTestResults) return null;

  // Only analyze if code changed since the last test run
  if (analyzerState.codeAtLastTestRun === currentCode) return null;

  const previous = analyzerState.lastTestResults;

  // Detect regression: tests that were passing are now failing
  if (previous.passed > currentResults.passed && previous.passed > 0) {
    const regressionCount = previous.passed - currentResults.passed;
    return {
      message: `Hmm, ${regressionCount} test${regressionCount > 1 ? "s that were" : " that was"} passing before ${regressionCount > 1 ? "are" : "is"} now failing. Your recent changes might have introduced a bug. Want to walk through what you changed?`,
      severity: "correctness",
      tier: "local",
      type: "test-regression"
    };
  }

  // Detect no improvement: user changed code but same tests still fail
  if (
    currentResults.passed === previous.passed &&
    currentResults.passed < currentResults.total &&
    currentResults.total > 0
  ) {
    return {
      message: "Same tests are still failing after your changes. Would it help to think about what specific input case is causing the failure?",
      severity: "process",
      tier: "local",
      type: "no-test-improvement"
    };
  }

  return null;
}

export default {
  analyzeCode,
  analyzeTestResults,
  createAnalyzerState,
  isUsingGoodApproach,
  assessCodeQuality
};
