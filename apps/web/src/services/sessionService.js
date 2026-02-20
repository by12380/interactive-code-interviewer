// Session CRUD helpers – talks to the Express API (which talks to Firestore).
// This keeps the Firebase SDK usage on the server side for security.

const API = "/api";

async function json(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => "Request failed");
    throw new Error(text);
  }
  return res.json();
}

// ─── Sessions ───────────────────────────────────────────────────────

export async function createSession({ title, questionIds, settings, createdBy, createdByEmail }) {
  return json(
    await fetch(`${API}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, questionIds, settings, createdBy, createdByEmail }),
    })
  );
}

export async function getSessions(createdBy) {
  const params = createdBy ? `?createdBy=${encodeURIComponent(createdBy)}` : "";
  return json(await fetch(`${API}/sessions${params}`));
}

export async function getSession(sessionId) {
  return json(await fetch(`${API}/sessions/${sessionId}`));
}

export async function updateSession(sessionId, updates) {
  return json(
    await fetch(`${API}/sessions/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
  );
}

export async function deleteSession(sessionId) {
  return json(
    await fetch(`${API}/sessions/${sessionId}`, { method: "DELETE" })
  );
}

// ─── Candidates (join / list) ───────────────────────────────────────

export async function joinSession(shareCode, { userId, displayName }) {
  return json(
    await fetch(`${API}/sessions/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareCode, userId, displayName }),
    })
  );
}

export async function getCandidates(sessionId) {
  return json(await fetch(`${API}/sessions/${sessionId}/candidates`));
}

// ─── Code sync ──────────────────────────────────────────────────────

export async function pushCode(sessionId, candidateId, { code, questionId }) {
  return json(
    await fetch(
      `${API}/sessions/${sessionId}/candidates/${candidateId}/code`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, questionId }),
      }
    )
  );
}

export async function pullCode(sessionId, candidateId, questionId) {
  const params = questionId
    ? `?questionId=${encodeURIComponent(questionId)}`
    : "";
  return json(
    await fetch(
      `${API}/sessions/${sessionId}/candidates/${candidateId}/code${params}`
    )
  );
}

// ─── Questions (bank + custom) ──────────────────────────────────────

export async function getQuestionBank({ category, difficulty, search } = {}) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (difficulty) params.set("difficulty", difficulty);
  if (search) params.set("search", search);
  const qs = params.toString();
  return json(await fetch(`${API}/questions${qs ? `?${qs}` : ""}`));
}

export async function getQuestion(questionId) {
  return json(await fetch(`${API}/questions/${questionId}`));
}

export async function createQuestion(question) {
  return json(
    await fetch(`${API}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(question),
    })
  );
}

// ─── Hints (permission-gated) ───────────────────────────────────────

export async function requestHint(sessionId, candidateId, { questionId, code }) {
  return json(
    await fetch(
      `${API}/sessions/${sessionId}/candidates/${candidateId}/hint`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, code }),
      }
    )
  );
}

// ─── AI evaluation ──────────────────────────────────────────────────

export async function evaluateCandidate(sessionId, candidateId) {
  return json(
    await fetch(`${API}/sessions/${sessionId}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId }),
    })
  );
}

export async function compareAllCandidates(sessionId) {
  return json(
    await fetch(`${API}/sessions/${sessionId}/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
  );
}

export async function getEvaluation(sessionId) {
  return json(await fetch(`${API}/sessions/${sessionId}/evaluation`));
}

export async function finalizeSessionReport(sessionId, generatedBy = "interviewer") {
  return json(
    await fetch(`${API}/sessions/${sessionId}/finalize-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generatedBy }),
    })
  );
}
