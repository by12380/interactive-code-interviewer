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

function actorHeaders(actor = null) {
  const headers = { "Content-Type": "application/json" };
  if (!actor || typeof actor !== "object") return headers;
  if (actor.userId) headers["x-user-id"] = String(actor.userId);
  if (actor.role) headers["x-user-role"] = String(actor.role);
  if (actor.displayName) headers["x-display-name"] = String(actor.displayName);
  return headers;
}

async function interviewRequest(path, { method = "GET", body = null, actor = null } = {}) {
  const response = await fetch(path, {
    method,
    headers: actorHeaders(actor),
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed (${response.status})`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function openLiveSessionStream(sessionId) {
  const sid = encodeURIComponent(String(sessionId || ""));
  return new EventSource(`/api/sessions/${sid}/live`);
}

export async function listQuestions(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value) !== "") {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return interviewRequest(`/api/questions${query ? `?${query}` : ""}`);
}

export async function createQuestion(payload, actor) {
  return interviewRequest("/api/questions", { method: "POST", body: payload, actor });
}

export async function createSession(payload, actor) {
  return interviewRequest("/api/sessions", { method: "POST", body: payload, actor });
}

export async function joinSession(payload, actor) {
  return interviewRequest("/api/sessions/join", { method: "POST", body: payload, actor });
}

export async function listCandidates(sessionId, actor) {
  return interviewRequest(`/api/sessions/${encodeURIComponent(String(sessionId))}/candidates`, { actor });
}

export async function assignQuestions(sessionId, payload, actor) {
  return interviewRequest(`/api/sessions/${encodeURIComponent(String(sessionId))}/assign`, {
    method: "PUT",
    body: payload,
    actor
  });
}

export async function updateHintSettings(sessionId, payload, actor) {
  return interviewRequest(`/api/sessions/${encodeURIComponent(String(sessionId))}/settings/hints`, {
    method: "PUT",
    body: payload,
    actor
  });
}

export async function updateCandidateHintSettings(sessionId, candidateId, payload, actor) {
  return interviewRequest(
    `/api/sessions/${encodeURIComponent(String(sessionId))}/candidates/${encodeURIComponent(String(candidateId))}/hints`,
    { method: "PUT", body: payload, actor }
  );
}

export async function syncCandidateCode(sessionId, candidateId, payload, actor) {
  return interviewRequest(
    `/api/sessions/${encodeURIComponent(String(sessionId))}/candidates/${encodeURIComponent(String(candidateId))}/code`,
    { method: "POST", body: payload, actor }
  );
}

export async function fetchCandidateCode(sessionId, candidateId, questionId, actor) {
  const q = encodeURIComponent(String(questionId || "_default"));
  return interviewRequest(
    `/api/sessions/${encodeURIComponent(String(sessionId))}/candidates/${encodeURIComponent(String(candidateId))}/code?questionId=${q}`,
    { actor }
  );
}

export async function requestHint(sessionId, candidateId, payload, actor) {
  return interviewRequest(
    `/api/sessions/${encodeURIComponent(String(sessionId))}/candidates/${encodeURIComponent(String(candidateId))}/hint`,
    { method: "POST", body: payload, actor }
  );
}

export async function sendInterviewerChat(sessionId, candidateId, payload, actor) {
  return interviewRequest(
    `/api/sessions/${encodeURIComponent(String(sessionId))}/candidates/${encodeURIComponent(String(candidateId))}/ai-chat`,
    { method: "POST", body: payload, actor }
  );
}

export async function evaluateCandidate(sessionId, candidateId, actor) {
  return interviewRequest(`/api/sessions/${encodeURIComponent(String(sessionId))}/evaluate`, {
    method: "POST",
    body: { candidateId },
    actor
  });
}

export async function compareCandidates(sessionId, actor) {
  return interviewRequest(`/api/sessions/${encodeURIComponent(String(sessionId))}/compare`, {
    method: "POST",
    body: {},
    actor
  });
}

export async function fetchLeaderboard(sessionId, actor) {
  return interviewRequest(`/api/sessions/${encodeURIComponent(String(sessionId))}/leaderboard`, { actor });
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
