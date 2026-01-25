export async function sendChat({ messages, mode = "chat", context = null }) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, mode, context })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Request failed");
  }

  return response.json();
}

export async function translateCode({
  sourceLanguage,
  targetLanguage,
  code,
  problem = null,
  options = null
}) {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceLanguage,
      targetLanguage,
      code,
      problem,
      options
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Translation request failed");
  }

  return response.json();
}
