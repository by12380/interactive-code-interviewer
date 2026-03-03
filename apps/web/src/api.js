export async function sendChat({ messages, mode = "chat", interruptContext = null, practiceMode = false, language = "javascript" }) {
  const body = { messages, mode, practiceMode, language };
  
  if (interruptContext) {
    body.interruptContext = interruptContext;
  }
  
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Request failed");
  }

  return response.json();
}

/**
 * Request AI-powered inline code hints (IDE-style diagnostics)
 */
export async function getCodeHints({ code, problemTitle, problemDescription, starterCode, practiceMode = false, language = "javascript" }) {
  const response = await fetch("/api/code-hints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, problemTitle, problemDescription, starterCode, practiceMode, language })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Hint analysis failed");
  }

  return response.json();
}

/**
 * Save user code progress for a specific problem
 */
export async function saveUserCode({ userId, problemId, code, language = "javascript" }) {
  const response = await fetch("/api/saved-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, problemId, code, language })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Save failed");
  }

  return response.json();
}

/**
 * Load previously saved code for a user + problem combination.
 * Returns { code, savedAt, ... } or { code: null } if nothing saved.
 */
export async function loadUserCode({ userId, problemId }) {
  const response = await fetch(`/api/saved-code/${encodeURIComponent(userId)}/${encodeURIComponent(problemId)}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Load failed");
  }

  return response.json();
}

/**
 * List all saved code entries for a user (for the "Resume" dashboard section).
 * Returns an array of { userId, problemId, code, savedAt, language }.
 */
export async function listUserSavedCode({ userId }) {
  const response = await fetch(`/api/saved-code/${encodeURIComponent(userId)}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to load saved code list");
  }

  return response.json();
}

/**
 * Translate code between programming languages
 * @param {Object} params - Translation parameters
 * @param {string} params.code - Source code to translate
 * @param {string} params.sourceLanguage - Source language (javascript, python, java, cpp)
 * @param {string} params.targetLanguage - Target language (javascript, python, java, cpp)
 * @param {Object} params.options - Translation options
 * @param {boolean} params.options.preserveComments - Keep and convert comments
 * @param {boolean} params.options.generateIdiomatic - Use idiomatic patterns
 * @param {boolean} params.options.includeTestCases - Translate test cases
 * @returns {Promise<Object>} Translation result with translatedCode
 */
export async function translateCode({ code, sourceLanguage, targetLanguage, options = {} }) {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      sourceLanguage,
      targetLanguage,
      options
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Translation failed");
  }

  return response.json();
}
