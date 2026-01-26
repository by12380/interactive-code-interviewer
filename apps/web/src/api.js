export async function sendChat({ messages, mode = "chat", interruptContext = null }) {
  const body = { messages, mode };
  
  // Include interrupt context for AI-powered interruptions
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
