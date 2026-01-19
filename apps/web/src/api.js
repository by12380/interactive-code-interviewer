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
