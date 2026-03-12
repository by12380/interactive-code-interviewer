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

export async function createSession({
  title, questionIds, settings, createdBy, interviewerEmail, candidateEmail, scheduledAt,
  sessionFormat, candidateProfile, aiGeneratedQuestions,
}) {
  return json(
    await fetch(`${API}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, questionIds, settings, createdBy, interviewerEmail, candidateEmail, scheduledAt,
        sessionFormat, candidateProfile, aiGeneratedQuestions,
      }),
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

export async function lookupSessionByCode(shareCode) {
  return json(
    await fetch(`${API}/sessions/lookup/${encodeURIComponent(shareCode)}`)
  );
}

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

export async function saveBehavioralResponse(sessionId, candidateId, payload) {
  return json(
    await fetch(
      `${API}/sessions/${sessionId}/candidates/${candidateId}/behavioral-response`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

// ─── Reports ─────────────────────────────────────────────────────────

export async function generateReport(sessionId) {
  return json(
    await fetch(`${API}/sessions/${sessionId}/report/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
  );
}

export async function getReport(sessionId) {
  return json(await fetch(`${API}/sessions/${sessionId}/report`));
}

export async function sendReport(sessionId, email) {
  return json(
    await fetch(`${API}/sessions/${sessionId}/report/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
  );
}

export async function endSession(sessionId) {
  return json(
    await fetch(`${API}/sessions/${sessionId}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
  );
}

// ─── Adaptive Learning ─────────────────────────────────────────────

export async function generateQuestion({ skillId, targetDifficulty, userRating, completedProblemTitles, language }) {
  return json(
    await fetch(`${API}/generate-question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillId, targetDifficulty, userRating, completedProblemTitles, language }),
    })
  );
}

export async function analyzeSkills({ ratings, attemptHistory, categorySuccessRate }) {
  return json(
    await fetch(`${API}/analyze-skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ratings, attemptHistory, categorySuccessRate }),
    })
  );
}

// ─── Recording Upload ────────────────────────────────────────────

export async function uploadRecording(sessionId, candidateId, blob) {
  const formData = new FormData();
  formData.append("recording", blob, `recording-${Date.now()}.webm`);
  formData.append("candidateId", candidateId);

  const res = await fetch(`${API}/sessions/${sessionId}/recording`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Upload failed");
    throw new Error(text);
  }
  return res.json();
}

// ─── Candidate Analysis (AI-powered session recommendation) ─────

export async function analyzeCandidate({ candidateInfo, resumeFile }) {
  const formData = new FormData();
  if (candidateInfo) formData.append("candidateInfo", candidateInfo);
  if (resumeFile) formData.append("resume", resumeFile);

  const res = await fetch(`${API}/analyze-candidate`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Request failed");
    throw new Error(text);
  }
  return res.json();
}
