/**
 * Code Translation Service
 * Handles code translation between Python, JavaScript, Java, and C++
 * with intelligent handling of language-specific features
 */

// Supported languages with their configurations
export const SUPPORTED_LANGUAGES = {
  javascript: {
    id: 'javascript',
    name: 'JavaScript',
    icon: '🟨',
    extension: '.js',
    monacoLanguage: 'javascript',
    commentSingle: '//',
    commentMultiStart: '/*',
    commentMultiEnd: '*/',
    features: ['async/await', 'arrow functions', 'destructuring', 'spread operator', 'template literals'],
  },
  python: {
    id: 'python',
    name: 'Python',
    icon: '🐍',
    extension: '.py',
    monacoLanguage: 'python',
    commentSingle: '#',
    commentMultiStart: '"""',
    commentMultiEnd: '"""',
    features: ['list comprehensions', 'generators', 'decorators', 'context managers', 'f-strings'],
  },
  java: {
    id: 'java',
    name: 'Java',
    icon: '☕',
    extension: '.java',
    monacoLanguage: 'java',
    commentSingle: '//',
    commentMultiStart: '/*',
    commentMultiEnd: '*/',
    features: ['generics', 'streams', 'lambdas', 'optional', 'records'],
  },
  cpp: {
    id: 'cpp',
    name: 'C++',
    icon: '⚡',
    extension: '.cpp',
    monacoLanguage: 'cpp',
    commentSingle: '//',
    commentMultiStart: '/*',
    commentMultiEnd: '*/',
    features: ['templates', 'smart pointers', 'RAII', 'STL containers', 'auto keyword'],
  },
};

// Language-specific type mappings for intelligent translation
export const TYPE_MAPPINGS = {
  javascript: {
    'int': 'number',
    'float': 'number',
    'double': 'number',
    'string': 'string',
    'boolean': 'boolean',
    'list': 'Array',
    'dict': 'Object',
    'set': 'Set',
    'map': 'Map',
    'void': 'void',
    'null': 'null',
    'undefined': 'undefined',
  },
  python: {
    'int': 'int',
    'float': 'float',
    'double': 'float',
    'string': 'str',
    'boolean': 'bool',
    'list': 'list',
    'dict': 'dict',
    'set': 'set',
    'map': 'dict',
    'void': 'None',
    'null': 'None',
    'undefined': 'None',
  },
  java: {
    'int': 'int',
    'float': 'float',
    'double': 'double',
    'string': 'String',
    'boolean': 'boolean',
    'list': 'List',
    'dict': 'Map',
    'set': 'Set',
    'map': 'Map',
    'void': 'void',
    'null': 'null',
    'undefined': 'null',
  },
  cpp: {
    'int': 'int',
    'float': 'float',
    'double': 'double',
    'string': 'std::string',
    'boolean': 'bool',
    'list': 'std::vector',
    'dict': 'std::unordered_map',
    'set': 'std::unordered_set',
    'map': 'std::map',
    'void': 'void',
    'null': 'nullptr',
    'undefined': 'nullptr',
  },
};

// Common data structure translations
export const DATA_STRUCTURE_MAPPINGS = {
  // Array/List operations
  arrayPush: {
    javascript: '.push(item)',
    python: '.append(item)',
    java: '.add(item)',
    cpp: '.push_back(item)',
  },
  arrayPop: {
    javascript: '.pop()',
    python: '.pop()',
    java: '.remove(list.size() - 1)',
    cpp: '.pop_back()',
  },
  arrayLength: {
    javascript: '.length',
    python: 'len(arr)',
    java: '.size()',
    cpp: '.size()',
  },
  arraySlice: {
    javascript: '.slice(start, end)',
    python: '[start:end]',
    java: '.subList(start, end)',
    cpp: 'std::vector(arr.begin() + start, arr.begin() + end)',
  },
  // Map/Dict operations
  mapGet: {
    javascript: '.get(key)',
    python: '.get(key)',
    java: '.get(key)',
    cpp: '[key]',
  },
  mapSet: {
    javascript: '.set(key, value)',
    python: '[key] = value',
    java: '.put(key, value)',
    cpp: '[key] = value',
  },
  mapHas: {
    javascript: '.has(key)',
    python: 'key in dict',
    java: '.containsKey(key)',
    cpp: '.find(key) != .end()',
  },
  // String operations
  stringLength: {
    javascript: '.length',
    python: 'len(str)',
    java: '.length()',
    cpp: '.length()',
  },
  stringSubstring: {
    javascript: '.substring(start, end)',
    python: '[start:end]',
    java: '.substring(start, end)',
    cpp: '.substr(start, length)',
  },
  stringSplit: {
    javascript: '.split(delimiter)',
    python: '.split(delimiter)',
    java: '.split(delimiter)',
    cpp: '// Use std::stringstream or boost::split',
  },
};

// Loop pattern translations
export const LOOP_PATTERNS = {
  forRange: {
    javascript: 'for (let i = 0; i < n; i++)',
    python: 'for i in range(n):',
    java: 'for (int i = 0; i < n; i++)',
    cpp: 'for (int i = 0; i < n; i++)',
  },
  forEach: {
    javascript: 'arr.forEach(item => { })',
    python: 'for item in arr:',
    java: 'for (Type item : arr)',
    cpp: 'for (const auto& item : arr)',
  },
  whileLoop: {
    javascript: 'while (condition)',
    python: 'while condition:',
    java: 'while (condition)',
    cpp: 'while (condition)',
  },
};

// Function signature patterns
export const FUNCTION_PATTERNS = {
  javascript: {
    declaration: 'function name(params) { }',
    arrow: 'const name = (params) => { }',
    async: 'async function name(params) { }',
  },
  python: {
    declaration: 'def name(params):',
    async: 'async def name(params):',
    lambda: 'lambda params: expression',
  },
  java: {
    declaration: 'public ReturnType name(params) { }',
    static: 'public static ReturnType name(params) { }',
    lambda: '(params) -> expression',
  },
  cpp: {
    declaration: 'ReturnType name(params) { }',
    lambda: '[capture](params) -> ReturnType { }',
    template: 'template<typename T> ReturnType name(params) { }',
  },
};

// Extract comments from code
export function extractComments(code, sourceLanguage) {
  const lang = SUPPORTED_LANGUAGES[sourceLanguage];
  if (!lang) return { code, comments: [] };

  const comments = [];
  let cleanCode = code;

  // Extract single-line comments
  const singleLineRegex = new RegExp(`${escapeRegex(lang.commentSingle)}.*$`, 'gm');
  const singleMatches = code.match(singleLineRegex) || [];
  singleMatches.forEach((match, index) => {
    comments.push({
      type: 'single',
      content: match.replace(lang.commentSingle, '').trim(),
      original: match,
      index,
    });
  });

  // Extract multi-line comments
  const multiLineRegex = new RegExp(
    `${escapeRegex(lang.commentMultiStart)}[\\s\\S]*?${escapeRegex(lang.commentMultiEnd)}`,
    'g'
  );
  const multiMatches = code.match(multiLineRegex) || [];
  multiMatches.forEach((match, index) => {
    const content = match
      .replace(lang.commentMultiStart, '')
      .replace(lang.commentMultiEnd, '')
      .trim();
    comments.push({
      type: 'multi',
      content,
      original: match,
      index: singleMatches.length + index,
    });
  });

  return { code: cleanCode, comments };
}

// Convert comments to target language format
export function convertComments(comments, targetLanguage) {
  const lang = SUPPORTED_LANGUAGES[targetLanguage];
  if (!lang) return comments;

  return comments.map(comment => {
    if (comment.type === 'single') {
      return `${lang.commentSingle} ${comment.content}`;
    } else {
      return `${lang.commentMultiStart}\n${comment.content}\n${lang.commentMultiEnd}`;
    }
  });
}

// Detect the source language from code
export function detectLanguage(code) {
  const indicators = {
    python: [
      /^def\s+\w+\s*\(/m,
      /^import\s+\w+/m,
      /^from\s+\w+\s+import/m,
      /:\s*$/m,
      /^\s+pass\s*$/m,
      /print\s*\(/,
      /^class\s+\w+:/m,
      /\bself\./,
      /\bTrue\b|\bFalse\b|\bNone\b/,
    ],
    javascript: [
      /^const\s+\w+\s*=/m,
      /^let\s+\w+\s*=/m,
      /^var\s+\w+\s*=/m,
      /=>\s*{/,
      /function\s+\w+\s*\(/,
      /console\.log\(/,
      /^import\s+.*from\s+['"]/m,
      /^export\s+(default\s+)?/m,
      /\bawait\s+/,
      /\basync\s+function/,
    ],
    java: [
      /^public\s+(static\s+)?class\s+\w+/m,
      /^public\s+(static\s+)?\w+\s+\w+\s*\(/m,
      /^private\s+\w+\s+\w+/m,
      /System\.out\.print/,
      /^import\s+java\./m,
      /\bnew\s+\w+\s*\(/,
      /\bextends\s+\w+/,
      /\bimplements\s+\w+/,
      /@Override/,
    ],
    cpp: [
      /^#include\s*</m,
      /^using\s+namespace\s+std/m,
      /std::/,
      /cout\s*<</,
      /cin\s*>>/,
      /^int\s+main\s*\(/m,
      /\bvector\s*</,
      /\btemplate\s*</,
      /\bauto\s+\w+\s*=/,
      /->(?!\s*{)/,
    ],
  };

  const scores = {};
  
  for (const [lang, patterns] of Object.entries(indicators)) {
    scores[lang] = patterns.reduce((score, pattern) => {
      return score + (pattern.test(code) ? 1 : 0);
    }, 0);
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'javascript'; // Default

  return Object.entries(scores).find(([, score]) => score === maxScore)?.[0] || 'javascript';
}

// Parse test cases from code
export function parseTestCases(code, language) {
  const testCases = [];
  
  const patterns = {
    javascript: [
      // console.log assertions
      /console\.log\(\s*(\w+)\s*\(\s*([^)]+)\s*\)\s*\)/g,
      // Jest/Mocha style
      /expect\(\s*(\w+)\s*\(\s*([^)]+)\s*\)\s*\)\.toBe\(\s*([^)]+)\s*\)/g,
      // Simple function calls
      /(\w+)\s*\(\s*([^)]+)\s*\)\s*(?:===?|==)\s*([^;]+)/g,
    ],
    python: [
      // assert statements
      /assert\s+(\w+)\s*\(\s*([^)]+)\s*\)\s*==\s*([^\n]+)/g,
      // print statements
      /print\(\s*(\w+)\s*\(\s*([^)]+)\s*\)\s*\)/g,
    ],
    java: [
      // JUnit assertions
      /assertEquals\(\s*([^,]+),\s*(\w+)\s*\(\s*([^)]+)\s*\)\s*\)/g,
      // System.out.println
      /System\.out\.println\(\s*(\w+)\s*\(\s*([^)]+)\s*\)\s*\)/g,
    ],
    cpp: [
      // assert macro
      /assert\(\s*(\w+)\s*\(\s*([^)]+)\s*\)\s*==\s*([^)]+)\s*\)/g,
      // cout statements
      /cout\s*<<\s*(\w+)\s*\(\s*([^)]+)\s*\)/g,
    ],
  };

  const langPatterns = patterns[language] || [];
  
  for (const pattern of langPatterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      testCases.push({
        functionName: match[1],
        input: match[2],
        expected: match[3] || null,
      });
    }
  }

  return testCases;
}

// Convert test cases to target language
export function convertTestCases(testCases, targetLanguage) {
  return testCases.map(testCase => {
    const { functionName, input, expected } = testCase;
    
    switch (targetLanguage) {
      case 'javascript':
        return expected
          ? `console.log(${functionName}(${input}) === ${expected}); // Expected: ${expected}`
          : `console.log(${functionName}(${input}));`;
      
      case 'python':
        return expected
          ? `assert ${functionName}(${input}) == ${expected}  # Expected: ${expected}`
          : `print(${functionName}(${input}))`;
      
      case 'java':
        return expected
          ? `System.out.println(${functionName}(${input}).equals(${expected})); // Expected: ${expected}`
          : `System.out.println(${functionName}(${input}));`;
      
      case 'cpp':
        return expected
          ? `assert(${functionName}(${input}) == ${expected}); // Expected: ${expected}`
          : `cout << ${functionName}(${input}) << endl;`;
      
      default:
        return `// Test: ${functionName}(${input})`;
    }
  });
}

// Generate idiomatic code suggestions
export function getIdiomaticSuggestions(code, targetLanguage) {
  const suggestions = [];
  
  switch (targetLanguage) {
    case 'python':
      // Suggest list comprehensions
      if (/for\s+\w+\s+in\s+.*:\s*\n\s+\w+\.append/.test(code)) {
        suggestions.push({
          type: 'idiom',
          message: 'Consider using a list comprehension instead of append in a loop',
          example: '[expression for item in iterable]',
        });
      }
      // Suggest f-strings
      if (/['"].*%s.*['"]|['"].*\+.*['"]/.test(code)) {
        suggestions.push({
          type: 'idiom',
          message: 'Consider using f-strings for string formatting',
          example: 'f"Hello, {name}!"',
        });
      }
      break;
    
    case 'javascript':
      // Suggest array methods
      if (/for\s*\(.*\)\s*{[\s\S]*?\.push/.test(code)) {
        suggestions.push({
          type: 'idiom',
          message: 'Consider using map/filter/reduce instead of for loops with push',
          example: 'arr.map(item => transform(item))',
        });
      }
      // Suggest template literals
      if (/['"].*\+.*['"]/.test(code)) {
        suggestions.push({
          type: 'idiom',
          message: 'Consider using template literals for string concatenation',
          example: '`Hello, ${name}!`',
        });
      }
      break;
    
    case 'java':
      // Suggest streams
      if (/for\s*\(.*:\s*\w+\)\s*{[\s\S]*?\.add/.test(code)) {
        suggestions.push({
          type: 'idiom',
          message: 'Consider using Java Streams for collection transformations',
          example: 'list.stream().map(x -> transform(x)).collect(Collectors.toList())',
        });
      }
      break;
    
    case 'cpp':
      // Suggest range-based for
      if (/for\s*\(\s*int\s+\w+\s*=\s*0\s*;.*<.*\.size\(\)/.test(code)) {
        suggestions.push({
          type: 'idiom',
          message: 'Consider using range-based for loops',
          example: 'for (const auto& item : container)',
        });
      }
      // Suggest auto keyword
      if (/std::\w+<[^>]+>\s+\w+\s*=/.test(code)) {
        suggestions.push({
          type: 'idiom',
          message: 'Consider using auto for complex type declarations',
          example: 'auto result = someFunction();',
        });
      }
      break;
  }
  
  return suggestions;
}

// Format code with proper indentation
export function formatCode(code, language) {
  const lines = code.split('\n');
  let indentLevel = 0;
  const indentChar = language === 'python' ? '    ' : '  ';
  
  const increaseIndent = language === 'python'
    ? /:\s*$/
    : /{\s*$/;
  
  const decreaseIndent = language === 'python'
    ? /^(return|pass|break|continue|raise)\b/
    : /^\s*}/;

  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    
    // Decrease indent for closing braces/keywords
    if (decreaseIndent.test(trimmed) && indentLevel > 0) {
      indentLevel--;
    }
    
    const formattedLine = indentChar.repeat(indentLevel) + trimmed;
    
    // Increase indent after opening braces/colons
    if (increaseIndent.test(trimmed)) {
      indentLevel++;
    }
    
    return formattedLine;
  }).join('\n');
}

// Create translation request payload
export function createTranslationPayload(code, sourceLanguage, targetLanguage, options = {}) {
  const { comments } = extractComments(code, sourceLanguage);
  const testCases = parseTestCases(code, sourceLanguage);
  const detectedLang = detectLanguage(code);
  
  return {
    code,
    sourceLanguage: sourceLanguage || detectedLang,
    targetLanguage,
    preserveComments: options.preserveComments !== false,
    preserveFormatting: options.preserveFormatting !== false,
    generateIdiomatic: options.generateIdiomatic !== false,
    includeTestCases: options.includeTestCases !== false,
    metadata: {
      detectedLanguage: detectedLang,
      commentCount: comments.length,
      testCaseCount: testCases.length,
      sourceFeatures: SUPPORTED_LANGUAGES[sourceLanguage || detectedLang]?.features || [],
      targetFeatures: SUPPORTED_LANGUAGES[targetLanguage]?.features || [],
    },
  };
}

// Validate translation result
export function validateTranslation(originalCode, translatedCode, targetLanguage) {
  const issues = [];
  
  // Check if translation is empty
  if (!translatedCode || translatedCode.trim().length === 0) {
    issues.push({
      type: 'error',
      message: 'Translation resulted in empty code',
    });
    return { isValid: false, issues };
  }
  
  // Check for untranslated code markers
  if (/\[UNTRANSLATED\]|\[TODO\]|\[MANUAL\]/.test(translatedCode)) {
    issues.push({
      type: 'warning',
      message: 'Some code sections could not be automatically translated',
    });
  }
  
  // Language-specific validation
  switch (targetLanguage) {
    case 'java':
      if (!/class\s+\w+/.test(translatedCode) && !/public\s+\w+/.test(translatedCode)) {
        issues.push({
          type: 'info',
          message: 'Java code may need to be wrapped in a class',
        });
      }
      break;
    
    case 'cpp':
      if (!/^#include/.test(translatedCode)) {
        issues.push({
          type: 'info',
          message: 'C++ code may need #include directives',
        });
      }
      break;
  }
  
  return {
    isValid: issues.filter(i => i.type === 'error').length === 0,
    issues,
  };
}

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Get language pair compatibility info
export function getLanguagePairInfo(sourceLanguage, targetLanguage) {
  const compatibilityNotes = {
    'python-javascript': [
      'List comprehensions will be converted to map/filter',
      'Generators become async iterators or arrays',
      'Type hints are removed (JS is dynamically typed)',
    ],
    'javascript-python': [
      'Arrow functions become regular functions or lambdas',
      'Promises/async-await translate to asyncio',
      'Object destructuring becomes multiple assignments',
    ],
    'python-java': [
      'Dynamic typing requires explicit type annotations',
      'Duck typing patterns need interface definitions',
      'Multiple inheritance needs redesign',
    ],
    'java-python': [
      'Explicit types become optional type hints',
      'Interfaces become abstract classes or protocols',
      'Streams become generators or comprehensions',
    ],
    'javascript-cpp': [
      'Dynamic typing requires explicit types',
      'Closures need careful capture handling',
      'Memory management must be considered',
    ],
    'cpp-javascript': [
      'Pointers become references or values',
      'Templates become generic functions',
      'RAII patterns need manual cleanup or try-finally',
    ],
    'python-cpp': [
      'Dynamic typing requires explicit types',
      'Memory management must be added',
      'List operations map to STL containers',
    ],
    'cpp-python': [
      'Manual memory management is removed',
      'Templates become duck-typed functions',
      'STL containers become Python built-ins',
    ],
    'java-javascript': [
      'Static types are removed',
      'Classes can become plain objects or ES6 classes',
      'Streams become array methods',
    ],
    'javascript-java': [
      'Dynamic objects need class definitions',
      'Prototype inheritance becomes class inheritance',
      'Callbacks become functional interfaces',
    ],
    'java-cpp': [
      'Garbage collection needs manual memory management',
      'Generics become templates',
      'Interfaces become abstract classes',
    ],
    'cpp-java': [
      'Manual memory management is removed',
      'Templates become generics (with limitations)',
      'Multiple inheritance needs interfaces',
    ],
  };

  const key = `${sourceLanguage}-${targetLanguage}`;
  return {
    notes: compatibilityNotes[key] || [],
    sourceInfo: SUPPORTED_LANGUAGES[sourceLanguage],
    targetInfo: SUPPORTED_LANGUAGES[targetLanguage],
  };
}

export default {
  SUPPORTED_LANGUAGES,
  TYPE_MAPPINGS,
  DATA_STRUCTURE_MAPPINGS,
  LOOP_PATTERNS,
  FUNCTION_PATTERNS,
  extractComments,
  convertComments,
  detectLanguage,
  parseTestCases,
  convertTestCases,
  getIdiomaticSuggestions,
  formatCode,
  createTranslationPayload,
  validateTranslation,
  getLanguagePairInfo,
};
