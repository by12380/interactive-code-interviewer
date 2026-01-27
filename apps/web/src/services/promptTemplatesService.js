/**
 * AI Prompt Templates Service
 * 
 * Provides pre-built prompts for common AI requests with variable substitution,
 * categorization, and custom template management.
 */

// Template categories
export const TEMPLATE_CATEGORIES = {
  debugging: {
    id: "debugging",
    name: "Debugging",
    icon: "🐛",
    description: "Find and fix bugs in your code"
  },
  optimization: {
    id: "optimization",
    name: "Optimization",
    icon: "⚡",
    description: "Improve code performance and efficiency"
  },
  explanation: {
    id: "explanation",
    name: "Explanation",
    icon: "📖",
    description: "Understand how code works"
  },
  refactoring: {
    id: "refactoring",
    name: "Refactoring",
    icon: "🔧",
    description: "Restructure and clean up code"
  },
  testing: {
    id: "testing",
    name: "Testing",
    icon: "🧪",
    description: "Generate tests and test cases"
  },
  documentation: {
    id: "documentation",
    name: "Documentation",
    icon: "📝",
    description: "Add comments and documentation"
  },
  interview: {
    id: "interview",
    name: "Interview Prep",
    icon: "🎯",
    description: "Prepare for coding interviews"
  },
  custom: {
    id: "custom",
    name: "My Templates",
    icon: "⭐",
    description: "Your saved custom templates"
  }
};

// Pre-built prompt templates
export const DEFAULT_TEMPLATES = [
  // Debugging Templates
  {
    id: "debug-explain-error",
    name: "Explain This Error",
    category: "debugging",
    description: "Get help understanding an error message",
    prompt: "I'm getting this error: {{errorMessage}}\n\nHere's my code:\n```\n{{code}}\n```\n\nCan you explain what this error means and how to fix it?",
    variables: [
      { name: "errorMessage", label: "Error Message", placeholder: "Paste the error message here", required: true },
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: false, autoFill: "code" }
    ],
    tags: ["error", "debug", "help"]
  },
  {
    id: "debug-find-bugs",
    name: "Find Bugs",
    category: "debugging",
    description: "Scan code for potential bugs and issues",
    prompt: "Please review this code and identify any bugs, edge cases I might have missed, or potential issues:\n\n```\n{{code}}\n```\n\nFocus on:\n1. Logic errors\n2. Edge cases\n3. Null/undefined handling\n4. Off-by-one errors\n5. Infinite loops or recursion issues",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["bugs", "review", "edge-cases"]
  },
  {
    id: "debug-why-not-working",
    name: "Why Isn't This Working?",
    category: "debugging",
    description: "Debug code that's not producing expected results",
    prompt: "My code isn't working as expected.\n\nCode:\n```\n{{code}}\n```\n\nExpected behavior: {{expected}}\n\nActual behavior: {{actual}}\n\nCan you help me figure out why?",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" },
      { name: "expected", label: "Expected Behavior", placeholder: "What should happen?", required: true },
      { name: "actual", label: "Actual Behavior", placeholder: "What's actually happening?", required: true }
    ],
    tags: ["debug", "behavior", "troubleshoot"]
  },
  {
    id: "debug-trace-execution",
    name: "Trace Execution",
    category: "debugging",
    description: "Walk through code execution step by step",
    prompt: "Can you trace through this code step by step and explain what happens at each line?\n\n```\n{{code}}\n```\n\nInput: {{input}}\n\nShow me the values of variables at each step.",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" },
      { name: "input", label: "Test Input", placeholder: "Example input values", required: false }
    ],
    tags: ["trace", "step-by-step", "debug"]
  },

  // Optimization Templates
  {
    id: "optimize-performance",
    name: "Optimize This Code",
    category: "optimization",
    description: "Get suggestions for improving code performance",
    prompt: "Please analyze this code and suggest optimizations to improve its performance:\n\n```\n{{code}}\n```\n\nConsider:\n1. Time complexity improvements\n2. Space complexity improvements\n3. Better data structures\n4. Algorithm improvements\n5. Any other performance gains",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["performance", "optimize", "speed"]
  },
  {
    id: "optimize-big-o",
    name: "Analyze Time/Space Complexity",
    category: "optimization",
    description: "Get Big O analysis of your code",
    prompt: "Please analyze the time and space complexity of this code:\n\n```\n{{code}}\n```\n\nProvide:\n1. Time complexity (Big O)\n2. Space complexity (Big O)\n3. Explanation of how you derived these\n4. Any potential optimizations to improve complexity",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["big-o", "complexity", "analysis"]
  },
  {
    id: "optimize-memory",
    name: "Reduce Memory Usage",
    category: "optimization",
    description: "Find ways to use less memory",
    prompt: "How can I reduce the memory usage of this code?\n\n```\n{{code}}\n```\n\nSuggest ways to:\n1. Use less memory overall\n2. Avoid memory leaks\n3. Use more efficient data structures\n4. Process data in chunks if applicable",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["memory", "space", "optimize"]
  },
  {
    id: "optimize-alternative",
    name: "Suggest Better Approach",
    category: "optimization",
    description: "Get alternative implementations",
    prompt: "Is there a better way to solve this problem?\n\nMy current approach:\n```\n{{code}}\n```\n\nProblem description: {{problem}}\n\nPlease suggest alternative approaches that might be:\n1. More efficient\n2. Cleaner/more readable\n3. More maintainable",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" },
      { name: "problem", label: "Problem Description", placeholder: "What problem are you solving?", required: false }
    ],
    tags: ["alternative", "approach", "better"]
  },

  // Explanation Templates
  {
    id: "explain-code",
    name: "Explain This Code",
    category: "explanation",
    description: "Get a clear explanation of how code works",
    prompt: "Please explain this code in simple terms:\n\n```\n{{code}}\n```\n\nExplain:\n1. What does this code do overall?\n2. How does it work step by step?\n3. What are the key concepts used?\n4. Any important details to note?",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["explain", "understand", "learn"]
  },
  {
    id: "explain-concept",
    name: "Explain Concept",
    category: "explanation",
    description: "Learn about a programming concept",
    prompt: "Can you explain {{concept}} in simple terms?\n\nPlease include:\n1. What is it?\n2. Why is it useful?\n3. A simple code example\n4. Common use cases\n5. Common mistakes to avoid",
    variables: [
      { name: "concept", label: "Concept", placeholder: "e.g., recursion, closures, Big O notation", required: true }
    ],
    tags: ["concept", "learn", "fundamentals"]
  },
  {
    id: "explain-algorithm",
    name: "Explain Algorithm",
    category: "explanation",
    description: "Understand how an algorithm works",
    prompt: "Please explain the {{algorithm}} algorithm:\n\n1. How does it work (step by step)?\n2. What is its time/space complexity?\n3. When should I use it?\n4. Can you show a simple implementation?\n5. What are common variations?",
    variables: [
      { name: "algorithm", label: "Algorithm Name", placeholder: "e.g., binary search, quicksort, BFS", required: true }
    ],
    tags: ["algorithm", "learn", "theory"]
  },
  {
    id: "explain-line-by-line",
    name: "Line by Line Explanation",
    category: "explanation",
    description: "Get detailed line-by-line code walkthrough",
    prompt: "Please explain this code line by line:\n\n```\n{{code}}\n```\n\nFor each line, explain:\n- What it does\n- Why it's needed\n- Any important details",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["line-by-line", "detailed", "walkthrough"]
  },

  // Refactoring Templates
  {
    id: "refactor-clean",
    name: "Clean Up Code",
    category: "refactoring",
    description: "Make code cleaner and more readable",
    prompt: "Please help me clean up this code:\n\n```\n{{code}}\n```\n\nFocus on:\n1. Improving readability\n2. Better variable/function names\n3. Removing duplication\n4. Following best practices\n5. Simplifying complex logic",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["clean", "readable", "best-practices"]
  },
  {
    id: "refactor-functions",
    name: "Extract Functions",
    category: "refactoring",
    description: "Break code into smaller functions",
    prompt: "Help me break this code into smaller, reusable functions:\n\n```\n{{code}}\n```\n\nIdentify:\n1. Code that can be extracted into functions\n2. Appropriate function names\n3. What parameters each function needs\n4. What each function should return",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["functions", "modular", "reusable"]
  },
  {
    id: "refactor-dry",
    name: "Remove Duplication (DRY)",
    category: "refactoring",
    description: "Eliminate repeated code",
    prompt: "Help me remove duplication from this code (DRY principle):\n\n```\n{{code}}\n```\n\nIdentify:\n1. Repeated code patterns\n2. How to consolidate them\n3. Reusable abstractions",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["dry", "duplication", "refactor"]
  },
  {
    id: "refactor-modern",
    name: "Modernize Code",
    category: "refactoring",
    description: "Update code to use modern syntax",
    prompt: "Please modernize this code using current best practices and syntax:\n\n```\n{{code}}\n```\n\nConsider:\n1. Modern JavaScript features (ES6+)\n2. Cleaner syntax options\n3. Better patterns for this use case\n4. Deprecations to avoid",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["modern", "es6", "update"]
  },

  // Testing Templates
  {
    id: "test-generate",
    name: "Generate Test Cases",
    category: "testing",
    description: "Create test cases for your code",
    prompt: "Please generate comprehensive test cases for this code:\n\n```\n{{code}}\n```\n\nInclude:\n1. Normal cases\n2. Edge cases\n3. Error cases\n4. Boundary conditions\n5. Explain why each test is important",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["test", "cases", "coverage"]
  },
  {
    id: "test-edge-cases",
    name: "Find Edge Cases",
    category: "testing",
    description: "Identify edge cases you might have missed",
    prompt: "What edge cases should I consider for this code?\n\n```\n{{code}}\n```\n\nProblem context: {{context}}\n\nList edge cases including:\n1. Empty/null inputs\n2. Boundary values\n3. Invalid inputs\n4. Large inputs\n5. Special characters or formats",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" },
      { name: "context", label: "Problem Context", placeholder: "Describe what the code should do", required: false }
    ],
    tags: ["edge-cases", "test", "boundaries"]
  },
  {
    id: "test-unit",
    name: "Write Unit Tests",
    category: "testing",
    description: "Generate unit test code",
    prompt: "Please write unit tests for this function:\n\n```\n{{code}}\n```\n\nUse {{framework}} testing framework and include:\n1. Test for normal inputs\n2. Test for edge cases\n3. Test for error handling\n4. Clear test descriptions",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" },
      { name: "framework", label: "Testing Framework", placeholder: "e.g., Jest, Mocha, pytest", required: false, default: "Jest" }
    ],
    tags: ["unit-test", "jest", "testing"]
  },

  // Documentation Templates
  {
    id: "doc-comments",
    name: "Add Comments",
    category: "documentation",
    description: "Add helpful comments to code",
    prompt: "Please add clear, helpful comments to this code:\n\n```\n{{code}}\n```\n\nInclude:\n1. Function/class documentation\n2. Explain complex logic\n3. Note any assumptions\n4. Don't over-comment obvious code",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["comments", "document", "explain"]
  },
  {
    id: "doc-jsdoc",
    name: "Generate JSDoc",
    category: "documentation",
    description: "Create JSDoc documentation",
    prompt: "Please add JSDoc documentation to this code:\n\n```\n{{code}}\n```\n\nInclude:\n1. @param tags with types\n2. @returns documentation\n3. @throws if applicable\n4. @example usage\n5. Function descriptions",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["jsdoc", "documentation", "types"]
  },
  {
    id: "doc-readme",
    name: "Write README Section",
    category: "documentation",
    description: "Generate documentation for a feature",
    prompt: "Please write documentation for this code that could go in a README:\n\n```\n{{code}}\n```\n\nInclude:\n1. What it does\n2. How to use it\n3. Parameters/options\n4. Example usage\n5. Any caveats or notes",
    variables: [
      { name: "code", label: "Code", placeholder: "Your code (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["readme", "documentation", "usage"]
  },

  // Interview Prep Templates
  {
    id: "interview-approach",
    name: "Explain My Approach",
    category: "interview",
    description: "Help articulate your problem-solving approach",
    prompt: "I'm working on this interview problem: {{problem}}\n\nMy current code:\n```\n{{code}}\n```\n\nHelp me explain my approach clearly for an interviewer:\n1. What's my high-level strategy?\n2. Why did I choose this approach?\n3. What's the time/space complexity?\n4. What trade-offs did I make?",
    variables: [
      { name: "problem", label: "Problem Description", placeholder: "Describe the interview problem", required: true },
      { name: "code", label: "Code", placeholder: "Your solution (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["interview", "approach", "explain"]
  },
  {
    id: "interview-followup",
    name: "Prepare for Follow-ups",
    category: "interview",
    description: "Anticipate interviewer follow-up questions",
    prompt: "For this solution:\n```\n{{code}}\n```\n\nWhat follow-up questions might an interviewer ask? Help me prepare for:\n1. Questions about complexity\n2. Alternative approaches\n3. Scale/optimization questions\n4. Edge case questions\n5. How to extend the solution",
    variables: [
      { name: "code", label: "Code", placeholder: "Your solution (auto-filled from editor)", required: true, autoFill: "code" }
    ],
    tags: ["interview", "followup", "prepare"]
  },
  {
    id: "interview-hints",
    name: "Give Me a Hint",
    category: "interview",
    description: "Get a hint without the full solution",
    prompt: "I'm stuck on this problem: {{problem}}\n\nMy current thinking:\n```\n{{code}}\n```\n\nCan you give me a hint WITHOUT giving the full solution? Just point me in the right direction.",
    variables: [
      { name: "problem", label: "Problem Description", placeholder: "Describe the problem you're stuck on", required: true },
      { name: "code", label: "Current Code", placeholder: "Your current attempt (auto-filled from editor)", required: false, autoFill: "code" }
    ],
    tags: ["hint", "stuck", "guidance"]
  },
  {
    id: "interview-compare",
    name: "Compare Approaches",
    category: "interview",
    description: "Compare different solution approaches",
    prompt: "For this problem: {{problem}}\n\nI know these approaches exist:\n{{approaches}}\n\nCan you compare them in terms of:\n1. Time complexity\n2. Space complexity\n3. When to use each\n4. Trade-offs\n5. Which would you recommend in an interview?",
    variables: [
      { name: "problem", label: "Problem Description", placeholder: "Describe the problem", required: true },
      { name: "approaches", label: "Approaches", placeholder: "e.g., brute force, hash map, two pointers", required: true }
    ],
    tags: ["compare", "approaches", "trade-offs"]
  }
];

// Storage key for custom templates
const CUSTOM_TEMPLATES_KEY = "customPromptTemplates";
const FAVORITE_TEMPLATES_KEY = "favoritePromptTemplates";
const RECENT_TEMPLATES_KEY = "recentPromptTemplates";

/**
 * Get all templates (default + custom)
 */
export function getAllTemplates() {
  const customTemplates = getCustomTemplates();
  return [...DEFAULT_TEMPLATES, ...customTemplates];
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(categoryId) {
  const allTemplates = getAllTemplates();
  return allTemplates.filter(t => t.category === categoryId);
}

/**
 * Get a template by ID
 */
export function getTemplateById(templateId) {
  const allTemplates = getAllTemplates();
  return allTemplates.find(t => t.id === templateId);
}

/**
 * Search templates by name, description, or tags
 */
export function searchTemplates(query) {
  if (!query || query.trim().length === 0) {
    return getAllTemplates();
  }
  
  const lowerQuery = query.toLowerCase().trim();
  const allTemplates = getAllTemplates();
  
  return allTemplates.filter(template => {
    const nameMatch = template.name.toLowerCase().includes(lowerQuery);
    const descMatch = template.description.toLowerCase().includes(lowerQuery);
    const tagMatch = template.tags?.some(tag => tag.toLowerCase().includes(lowerQuery));
    const categoryMatch = TEMPLATE_CATEGORIES[template.category]?.name.toLowerCase().includes(lowerQuery);
    
    return nameMatch || descMatch || tagMatch || categoryMatch;
  });
}

/**
 * Get custom templates from localStorage
 */
export function getCustomTemplates() {
  try {
    const stored = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save a custom template
 */
export function saveCustomTemplate(template) {
  const customTemplates = getCustomTemplates();
  
  const newTemplate = {
    ...template,
    id: template.id || `custom-${Date.now()}`,
    category: "custom",
    isCustom: true,
    createdAt: template.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Check if updating existing
  const existingIndex = customTemplates.findIndex(t => t.id === newTemplate.id);
  
  if (existingIndex >= 0) {
    customTemplates[existingIndex] = newTemplate;
  } else {
    customTemplates.push(newTemplate);
  }
  
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(customTemplates));
  return newTemplate;
}

/**
 * Delete a custom template
 */
export function deleteCustomTemplate(templateId) {
  const customTemplates = getCustomTemplates();
  const filtered = customTemplates.filter(t => t.id !== templateId);
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(filtered));
  
  // Also remove from favorites and recents
  removeFavorite(templateId);
  removeFromRecent(templateId);
  
  return true;
}

/**
 * Get favorite template IDs
 */
export function getFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITE_TEMPLATES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Toggle favorite status
 */
export function toggleFavorite(templateId) {
  const favorites = getFavorites();
  const index = favorites.indexOf(templateId);
  
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push(templateId);
  }
  
  localStorage.setItem(FAVORITE_TEMPLATES_KEY, JSON.stringify(favorites));
  return favorites;
}

/**
 * Remove from favorites
 */
export function removeFavorite(templateId) {
  const favorites = getFavorites();
  const filtered = favorites.filter(id => id !== templateId);
  localStorage.setItem(FAVORITE_TEMPLATES_KEY, JSON.stringify(filtered));
  return filtered;
}

/**
 * Get favorite templates
 */
export function getFavoriteTemplates() {
  const favorites = getFavorites();
  const allTemplates = getAllTemplates();
  return allTemplates.filter(t => favorites.includes(t.id));
}

/**
 * Get recent template IDs
 */
export function getRecentTemplateIds() {
  try {
    const stored = localStorage.getItem(RECENT_TEMPLATES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Add to recent templates
 */
export function addToRecent(templateId) {
  const recents = getRecentTemplateIds();
  
  // Remove if already exists (to re-add at front)
  const filtered = recents.filter(id => id !== templateId);
  
  // Add to front, keep only last 10
  const updated = [templateId, ...filtered].slice(0, 10);
  
  localStorage.setItem(RECENT_TEMPLATES_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Remove from recent templates
 */
export function removeFromRecent(templateId) {
  const recents = getRecentTemplateIds();
  const filtered = recents.filter(id => id !== templateId);
  localStorage.setItem(RECENT_TEMPLATES_KEY, JSON.stringify(filtered));
  return filtered;
}

/**
 * Get recent templates
 */
export function getRecentTemplates() {
  const recentIds = getRecentTemplateIds();
  const allTemplates = getAllTemplates();
  
  // Return in order of recency
  return recentIds
    .map(id => allTemplates.find(t => t.id === id))
    .filter(Boolean);
}

/**
 * Substitute variables in a template prompt
 */
export function substituteVariables(prompt, variables) {
  let result = prompt;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value || '');
  }
  
  return result;
}

/**
 * Validate that all required variables are filled
 */
export function validateVariables(template, values) {
  const errors = [];
  
  for (const variable of template.variables || []) {
    if (variable.required && (!values[variable.name] || values[variable.name].trim() === '')) {
      errors.push({
        variable: variable.name,
        message: `${variable.label} is required`
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get a prompt ready for execution (with variables substituted)
 */
export function preparePrompt(template, variableValues) {
  const validation = validateVariables(template, variableValues);
  
  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors,
      prompt: null
    };
  }
  
  const prompt = substituteVariables(template.prompt, variableValues);
  
  return {
    success: true,
    errors: [],
    prompt
  };
}

/**
 * Clone a template for customization
 */
export function cloneTemplate(templateId) {
  const template = getTemplateById(templateId);
  if (!template) return null;
  
  return {
    ...template,
    id: `custom-${Date.now()}`,
    name: `${template.name} (Copy)`,
    category: "custom",
    isCustom: true,
    clonedFrom: templateId,
    createdAt: new Date().toISOString()
  };
}

/**
 * Export templates as JSON
 */
export function exportTemplates(templateIds = null) {
  const customTemplates = getCustomTemplates();
  const favorites = getFavorites();
  
  const templatesToExport = templateIds
    ? customTemplates.filter(t => templateIds.includes(t.id))
    : customTemplates;
  
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: templatesToExport,
    favorites: favorites.filter(id => templatesToExport.some(t => t.id === id))
  };
}

/**
 * Import templates from JSON
 */
export function importTemplates(data) {
  try {
    const { templates, favorites = [] } = data;
    
    if (!Array.isArray(templates)) {
      return { success: false, error: "Invalid import format" };
    }
    
    const customTemplates = getCustomTemplates();
    let imported = 0;
    
    for (const template of templates) {
      // Generate new ID to avoid conflicts
      const newTemplate = {
        ...template,
        id: `imported-${Date.now()}-${imported}`,
        category: "custom",
        isCustom: true,
        importedAt: new Date().toISOString()
      };
      
      customTemplates.push(newTemplate);
      imported++;
    }
    
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(customTemplates));
    
    // Import favorites for the new templates
    if (favorites.length > 0) {
      const currentFavorites = getFavorites();
      localStorage.setItem(FAVORITE_TEMPLATES_KEY, JSON.stringify([...currentFavorites, ...favorites]));
    }
    
    return { success: true, imported };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
