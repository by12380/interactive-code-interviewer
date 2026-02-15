import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
// Default to 3002 to avoid common collisions (e.g. other local APIs on 3001).
const PORT = process.env.PORT || 3002;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const SUPPORTED_LANGUAGES = ["python", "javascript", "java", "cpp"];
const SESSION_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const interviewStore = {
  questions: [],
  sessions: new Map(), // sid -> session
  comparisons: new Map() // sid -> comparison payload
};
const liveClientsBySession = new Map(); // sid -> Set(res)

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function randomCode(len = 6) {
  let out = "";
  for (let i = 0; i < len; i++) out += SESSION_CODE_CHARS[Math.floor(Math.random() * SESSION_CODE_CHARS.length)];
  return out;
}

function buildActor(req) {
  const userId = String(req.header("x-user-id") || req.body?.actorUserId || "").trim();
  const role = String(req.header("x-user-role") || req.body?.actorRole || "candidate").trim().toLowerCase();
  const displayName = String(req.header("x-display-name") || req.body?.actorDisplayName || "").trim();
  return {
    userId: userId || `anon_${Math.random().toString(36).slice(2, 7)}`,
    role: role || "candidate",
    displayName: displayName || "Anonymous"
  };
}

function publishLive(sessionId, event) {
  const sid = String(sessionId || "");
  if (!sid) return;
  const clients = liveClientsBySession.get(sid);
  if (!clients || clients.size === 0) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      // Ignore dead connections.
    }
  }
}

function toSafeScore(n, min = 0, max = 100) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function isInterviewer(session, actor) {
  if (!session || !actor) return false;
  if (actor.role === "admin") return true;
  if (actor.role !== "interviewer") return false;
  return String(session.createdBy || "") === String(actor.userId || "");
}

function resolveHintPolicy(session, candidate, payload) {
  const settings = session?.settings || {};
  const override = candidate?.hintPolicyOverride || {};
  const hintsEnabled = override.allowHints ?? settings.hintsEnabled ?? true;
  const hintMode = String(override.mode || settings.hintMode || "always");
  if (!hintsEnabled || hintMode === "disabled") {
    return { allowed: false, reason: "Hints are disabled by interviewer policy." };
  }
  if (hintMode === "manual" && !payload?.approvedByInterviewer) {
    return { allowed: false, reason: "Interviewer approval is required for hints." };
  }
  if (hintMode === "auto_when_stuck") {
    const activity = payload?.activity || {};
    const stuck =
      Number(activity.secondsSinceLastMeaningfulEdit || 0) >= 180 ||
      Number(activity.consecutiveFailedRuns || 0) >= 3 ||
      Boolean(activity.repeatedRuntimeErrors);
    if (!stuck) {
      return { allowed: false, reason: "Candidate is not considered stuck yet." };
    }
  }
  return { allowed: true, hintMode };
}

function scoreSubmissionLocally(code) {
  const src = String(code || "");
  const correctness = src.includes("return") ? 30 : 10;
  const complexity = /\bfor\b[\s\S]*\bfor\b/.test(src) ? 12 : 22;
  const quality = src.length > 120 ? 15 : 10;
  const communication = /\/\/|\/\*/.test(src) ? 12 : 8;
  const total = correctness + complexity + quality + communication;
  return {
    correctness: toSafeScore(correctness, 0, 40),
    efficiency: toSafeScore(complexity, 0, 25),
    codeQuality: toSafeScore(quality, 0, 20),
    communication: toSafeScore(communication, 0, 15),
    total: toSafeScore(total, 0, 100),
    feedback: "Local rubric fallback applied because model output was unavailable."
  };
}

async function llmJsonResponse({ systemPrompt, userContent, maxTokens = 700, temperature = 0.2 }) {
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY on the server.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      temperature,
      max_tokens: maxTokens
    })
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  const parsed = safeJsonParse(raw);
  if (parsed.ok) return parsed.value;
  const extracted = extractFirstJsonObject(raw);
  if (!extracted) throw new Error("Model returned invalid JSON.");
  return extracted;
}

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

function extractFirstJsonObject(text) {
  const s = String(text || "");
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const candidate = s.slice(first, last + 1);
  const parsed = safeJsonParse(candidate);
  if (!parsed.ok) return null;
  return parsed.value;
}

app.post("/api/chat", async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).send("Missing OPENAI_API_KEY on the server.");
  }

  const { messages, mode = "chat", context } = req.body || {};

  if (!Array.isArray(messages)) {
    return res.status(400).send("messages must be an array.");
  }

  const ctx = context && typeof context === "object" ? context : null;
  const ctxText = ctx
    ? [
        "Interview context:",
        ctx.problemId ? `- problemId: ${String(ctx.problemId)}` : null,
        ctx.title ? `- title: ${String(ctx.title)}` : null,
        ctx.signature ? `- signature: ${String(ctx.signature)}` : null,
        ctx.difficulty ? `- difficulty: ${String(ctx.difficulty)}` : null,
        ctx.description ? `- description: ${String(ctx.description)}` : null,
        Array.isArray(ctx.hints) && ctx.hints.length
          ? `- hints: ${ctx.hints.map((h) => String(h)).join(" | ")}`
          : null
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const systemPrompt =
    mode === "proactive"
      ? [
          "You are a live coding interviewer watching the candidate type in real time.",
          "Your job is to INTERRUPT proactively when you see a mistake, a risky approach, or an inefficient pattern.",
          "Rules:",
          "- If an interruption is warranted, output exactly ONE short message (1–2 sentences) that starts with 'Wait,'.",
          "- Prefer questions + gentle nudges (e.g. ask to explain approach, point out brute force, suggest better DS).",
          "- Ground feedback in the current code and expected signature/output; call out off-track or irrelevant code explicitly.",
          "- Do NOT ask generic 'what is your approach?' unless the code is essentially empty.",
          "- Do NOT give a full solution or final code.",
          "- If no interruption is needed, output an empty string.",
          ctxText ? `\n${ctxText}\n` : ""
        ].join("\n")
      : mode === "summary"
        ? [
            "You are a coding interview coach generating concise multi-problem session summaries.",
            "Prioritize: patterns, tradeoffs, and actionable next steps.",
            "Use clear headings and bullet points when helpful.",
            "Do not output full solutions unless asked.",
            ctxText ? `\n${ctxText}\n` : ""
          ].join("\n")
        : [
            "You are a coding interview coach. Focus on guiding the candidate.",
            "Be concise, point out likely mistakes, and ask clarifying questions.",
            "Do not solve the problem end-to-end unless asked.",
            ctxText ? `\n${ctxText}\n` : ""
          ].join("\n");

  const payload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages
    ],
    temperature: 0.3,
    max_tokens: mode === "summary" ? 900 : 300
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).send(errorText);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "";
    if (mode === "proactive" && !reply) {
      return res.json({ reply: null });
    }
    return res.json({ reply: reply || "No response from model." });
  } catch (error) {
    return res.status(500).send(error.message || "LLM request failed.");
  }
});

app.post("/api/translate", async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).send("Missing OPENAI_API_KEY on the server.");
  }

  const {
    sourceLanguage,
    targetLanguage,
    code,
    problem,
    options
  } = req.body || {};

  const src = String(sourceLanguage || "").toLowerCase().trim();
  const dst = String(targetLanguage || "").toLowerCase().trim();
  const inputCode = String(code || "");

  if (!SUPPORTED_LANGUAGES.includes(src)) {
    return res.status(400).send(`Unsupported sourceLanguage. Use one of: ${SUPPORTED_LANGUAGES.join(", ")}`);
  }
  if (!SUPPORTED_LANGUAGES.includes(dst)) {
    return res.status(400).send(`Unsupported targetLanguage. Use one of: ${SUPPORTED_LANGUAGES.join(", ")}`);
  }
  if (!inputCode.trim()) {
    return res.status(400).send("code must be a non-empty string.");
  }

  const p = problem && typeof problem === "object" ? problem : null;
  const translateTests = options?.includeTests !== false;
  const idiomatic = options?.idiomatic !== false;
  const preserveFormatting = options?.preserveFormatting !== false;
  const preserveComments = options?.preserveComments !== false;

  const tests = Array.isArray(p?.tests) ? p.tests : [];
  const ctx = {
    problemId: p?.id ?? null,
    title: p?.title ?? null,
    signature: p?.signature ?? null,
    functionName: p?.functionName ?? null,
    difficulty: p?.difficulty ?? null,
    tests
  };

  const systemPrompt = [
    "You are a senior polyglot software engineer and technical writer.",
    "You translate code between languages while preserving meaning, comments, and formatting when feasible, and producing idiomatic output in the target language.",
    "",
    "Return STRICT JSON only (no markdown, no backticks, no commentary outside JSON).",
    "The JSON schema MUST be:",
    "{",
    '  "targetLanguage": "python|javascript|java|cpp",',
    '  "code": "string - translated solution code",',
    '  "tests": "string - translated tests/harness (may be empty if tests not requested)",',
    '  "notes": ["string", "..."],',
    '  "warnings": ["string", "..."]',
    "}",
    "",
    "Hard requirements:",
    preserveComments ? "- Preserve all developer comments (translate syntax, not meaning). Keep relative placement where possible." : "- Comments may be omitted if necessary.",
    preserveFormatting ? "- Preserve formatting/blank lines/structure where reasonable; do not minify." : "- Formatting may change.",
    idiomatic ? "- Generate idiomatic target-language code (standard library, naming conventions, best practices)." : "- Keep structure close to source, even if not idiomatic.",
    "- Handle language-specific features intelligently (e.g., JS Map vs Python dict, Java generics, C++ references, etc.).",
    "- Ensure the translated solution matches the provided function/class name and signature intent.",
    translateTests
      ? "- Also translate tests into a runnable, self-contained harness for the target language."
      : "- Do not include tests; set tests to an empty string.",
    "",
    "Test translation requirements (when included):",
    "- Use ONLY the provided test cases; do not invent new ones.",
    "- Keep test names if possible.",
    "- Prefer minimal, dependency-free harnesses:",
    "  - python: use plain asserts (or unittest style without external deps)",
    "  - javascript: use a simple runner with throw/assert (no jest)",
    "  - java: use a public class with main(), basic assertions/prints (no junit)",
    "  - cpp: use a main() with assert/iostream (no gtest)",
    "- For problems where the solution is a class (e.g., LRUCache), generate an appropriate harness that executes the ops/args sequence and checks outputs.",
    "",
    "Output tips:",
    "- If something is ambiguous, put the assumption in warnings and choose the most reasonable option.",
    "- Keep code and tests in separate strings; do not embed JSON inside them."
  ].join("\n");

  const userPayload = {
    sourceLanguage: src,
    targetLanguage: dst,
    context: ctx,
    sourceCode: inputCode,
    options: {
      includeTests: translateTests,
      idiomatic,
      preserveFormatting,
      preserveComments
    }
  };

  const payload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(userPayload) }
    ],
    temperature: 0.2,
    max_tokens: 1400
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).send(errorText);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "";

    const parsed = safeJsonParse(reply);
    const obj = parsed.ok ? parsed.value : extractFirstJsonObject(reply);
    if (!obj || typeof obj !== "object") {
      return res.status(502).json({
        error: "Model did not return valid JSON.",
        raw: reply
      });
    }

    // Normalize & validate minimal fields
    const out = {
      targetLanguage: String(obj.targetLanguage || dst).toLowerCase(),
      code: typeof obj.code === "string" ? obj.code : "",
      tests: typeof obj.tests === "string" ? obj.tests : "",
      notes: Array.isArray(obj.notes) ? obj.notes.map((x) => String(x)) : [],
      warnings: Array.isArray(obj.warnings) ? obj.warnings.map((x) => String(x)) : []
    };

    if (!SUPPORTED_LANGUAGES.includes(out.targetLanguage)) out.targetLanguage = dst;
    return res.json(out);
  } catch (error) {
    return res.status(500).send(error.message || "LLM translation request failed.");
  }
});

// ------------------------------------------------------------------
// Interview dashboard APIs (interviewer + candidate workflows)
// ------------------------------------------------------------------

if (!interviewStore.questions.length) {
  interviewStore.questions = [
    {
      id: "two-sum",
      title: "Two Sum",
      difficulty: "Easy",
      category: "Array",
      description: "Find two indices that sum to target.",
      starterCode: "function twoSum(nums, target) {\n  return [];\n}",
      hints: ["Use a map of seen values."],
      testCases: []
    },
    {
      id: "valid-parentheses",
      title: "Valid Parentheses",
      difficulty: "Easy",
      category: "Stack",
      description: "Validate bracket order and pairing.",
      starterCode: "function isValid(s) {\n  return true;\n}",
      hints: ["A stack helps track opening brackets."],
      testCases: []
    },
    {
      id: "lru-cache",
      title: "LRU Cache",
      difficulty: "Hard",
      category: "Design",
      description: "Implement an LRU cache with O(1) operations.",
      starterCode: "function LRUCache(capacity) {\n  // implement class\n}",
      hints: ["Combine hashmap with doubly linked list."],
      testCases: []
    }
  ];
}

app.get("/api/questions", (req, res) => {
  const { category, difficulty, search } = req.query;
  let rows = [...interviewStore.questions];
  if (category) rows = rows.filter((q) => String(q.category || "") === String(category));
  if (difficulty) rows = rows.filter((q) => String(q.difficulty || "") === String(difficulty));
  if (search) {
    const s = String(search).toLowerCase();
    rows = rows.filter(
      (q) =>
        String(q.id || "").toLowerCase().includes(s) ||
        String(q.title || "").toLowerCase().includes(s) ||
        String(q.description || "").toLowerCase().includes(s)
    );
  }
  return res.json(rows);
});

app.get("/api/questions/:id", (req, res) => {
  const row = interviewStore.questions.find((q) => q.id === req.params.id);
  if (!row) return res.status(404).send("Question not found.");
  return res.json(row);
});

app.post("/api/questions", (req, res) => {
  const actor = buildActor(req);
  if (!["interviewer", "admin"].includes(actor.role)) {
    return res.status(403).send("Only interviewers can create questions.");
  }
  const payload = req.body || {};
  if (!payload.title || !payload.description) return res.status(400).send("title and description required.");
  const question = {
    id: payload.id || newId("customq"),
    title: String(payload.title),
    description: String(payload.description),
    difficulty: String(payload.difficulty || "Medium"),
    category: String(payload.category || "Custom"),
    starterCode: String(payload.starterCode || ""),
    testCases: Array.isArray(payload.testCases) ? payload.testCases : [],
    hints: Array.isArray(payload.hints) ? payload.hints : [],
    solution: String(payload.solution || ""),
    createdBy: actor.userId,
    createdAt: new Date().toISOString()
  };
  interviewStore.questions.unshift(question);
  return res.json(question);
});

app.post("/api/sessions", (req, res) => {
  const actor = buildActor(req);
  if (!["interviewer", "admin"].includes(actor.role)) {
    return res.status(403).send("Only interviewers can create sessions.");
  }
  const payload = req.body || {};
  const title = String(payload.title || "").trim();
  if (!title) return res.status(400).send("title required.");
  const questionIds = Array.isArray(payload.questionIds) ? payload.questionIds.map((x) => String(x)) : [];
  const session = {
    id: newId("session"),
    title,
    createdBy: actor.userId,
    shareCode: randomCode(),
    questionIds,
    status: "draft",
    settings: {
      hintsEnabled: true,
      hintMode: "always", // always | manual | auto_when_stuck | disabled
      aiInterviewerChatEnabled: true,
      ...(payload.settings || {})
    },
    candidates: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  interviewStore.sessions.set(session.id, session);
  return res.json(session);
});

app.get("/api/sessions/:id", (req, res) => {
  const actor = buildActor(req);
  const session = interviewStore.sessions.get(req.params.id);
  if (!session) return res.status(404).send("Session not found.");
  if (["interviewer", "admin"].includes(actor.role) && !isInterviewer(session, actor)) {
    return res.status(403).send("You do not have access to this session.");
  }
  return res.json(session);
});

app.post("/api/sessions/join", (req, res) => {
  const actor = buildActor(req);
  const payload = req.body || {};
  const code = String(payload.shareCode || "").toUpperCase();
  if (!code) return res.status(400).send("shareCode required.");
  const session = [...interviewStore.sessions.values()].find((s) => String(s.shareCode) === code);
  if (!session) return res.status(404).send("Session not found for that code.");
  const candidateId = String(payload.userId || actor.userId || newId("cand"));
  session.candidates[candidateId] = {
    id: candidateId,
    userId: candidateId,
    displayName: String(payload.displayName || actor.displayName || "Anonymous"),
    joinedAt: session.candidates[candidateId]?.joinedAt || new Date().toISOString(),
    status: "joined",
    activeQuestionId: session.questionIds[0] || null,
    assignedQuestionIds: session.questionIds.slice(),
    codeByQuestionId: session.candidates[candidateId]?.codeByQuestionId || {},
    evaluation: session.candidates[candidateId]?.evaluation || null,
    hintPolicyOverride: session.candidates[candidateId]?.hintPolicyOverride || null
  };
  session.updatedAt = new Date().toISOString();
  publishLive(session.id, {
    type: "candidate:joined",
    candidateId,
    displayName: session.candidates[candidateId].displayName,
    at: Date.now()
  });
  return res.json({ session, candidateId });
});

app.get("/api/sessions/:id/candidates", (req, res) => {
  const actor = buildActor(req);
  const session = interviewStore.sessions.get(req.params.id);
  if (!session) return res.status(404).send("Session not found.");
  if (!isInterviewer(session, actor)) return res.status(403).send("Only interviewers can view candidates.");
  const rows = Object.values(session.candidates || {}).map((c) => ({
    id: c.id,
    displayName: c.displayName,
    status: c.status,
    joinedAt: c.joinedAt,
    activeQuestionId: c.activeQuestionId,
    assignedQuestionIds: c.assignedQuestionIds || [],
    hintPolicyOverride: c.hintPolicyOverride || null,
    evaluation: c.evaluation || null
  }));
  return res.json(rows);
});

app.put("/api/sessions/:id/settings/hints", (req, res) => {
  const actor = buildActor(req);
  const session = interviewStore.sessions.get(req.params.id);
  if (!session) return res.status(404).send("Session not found.");
  if (!isInterviewer(session, actor)) return res.status(403).send("Only interviewers can update policy.");
  const payload = req.body || {};
  session.settings = {
    ...session.settings,
    ...(typeof payload.hintsEnabled === "boolean" ? { hintsEnabled: payload.hintsEnabled } : {}),
    ...(payload.hintMode ? { hintMode: String(payload.hintMode) } : {}),
    ...(typeof payload.aiInterviewerChatEnabled === "boolean"
      ? { aiInterviewerChatEnabled: payload.aiInterviewerChatEnabled }
      : {})
  };
  session.updatedAt = new Date().toISOString();
  publishLive(session.id, { type: "session:settings-updated", settings: session.settings, at: Date.now() });
  return res.json({ ok: true, settings: session.settings });
});

app.put("/api/sessions/:sid/candidates/:cid/hints", (req, res) => {
  const actor = buildActor(req);
  const session = interviewStore.sessions.get(req.params.sid);
  if (!session) return res.status(404).send("Session not found.");
  if (!isInterviewer(session, actor)) return res.status(403).send("Only interviewers can update candidate policy.");
  const candidate = session.candidates[req.params.cid];
  if (!candidate) return res.status(404).send("Candidate not found.");
  const payload = req.body || {};
  candidate.hintPolicyOverride = {
    ...(candidate.hintPolicyOverride || {}),
    ...(typeof payload.allowHints === "boolean" ? { allowHints: payload.allowHints } : {}),
    ...(payload.mode ? { mode: String(payload.mode) } : {})
  };
  session.updatedAt = new Date().toISOString();
  publishLive(session.id, {
    type: "candidate:hint-policy-updated",
    candidateId: candidate.id,
    hintPolicyOverride: candidate.hintPolicyOverride,
    at: Date.now()
  });
  return res.json({ ok: true, candidateId: candidate.id, hintPolicyOverride: candidate.hintPolicyOverride });
});

app.put("/api/sessions/:sid/assign", (req, res) => {
  const actor = buildActor(req);
  const session = interviewStore.sessions.get(req.params.sid);
  if (!session) return res.status(404).send("Session not found.");
  if (!isInterviewer(session, actor)) return res.status(403).send("Only interviewers can assign questions.");
  const payload = req.body || {};
  const questionIds = Array.isArray(payload.questionIds) ? payload.questionIds.map((x) => String(x)) : [];
  if (!questionIds.length) return res.status(400).send("questionIds must be non-empty.");
  session.questionIds = questionIds;
  const activeQuestionId = String(payload.activeQuestionId || questionIds[0] || "");
  const candidateIds = Array.isArray(payload.candidateIds) ? payload.candidateIds.map((x) => String(x)) : [];
  const targets = candidateIds.length ? candidateIds : Object.keys(session.candidates || {});
  for (const cid of targets) {
    if (!session.candidates[cid]) continue;
    session.candidates[cid].assignedQuestionIds = questionIds.slice();
    session.candidates[cid].activeQuestionId = activeQuestionId;
  }
  session.updatedAt = new Date().toISOString();
  publishLive(session.id, {
    type: "session:questions-assigned",
    questionIds,
    activeQuestionId,
    candidateIds: targets,
    at: Date.now()
  });
  return res.json({ ok: true });
});

app.get("/api/sessions/:sid/live", (req, res) => {
  const session = interviewStore.sessions.get(req.params.sid);
  if (!session) return res.status(404).send("Session not found.");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const set = liveClientsBySession.get(session.id) || new Set();
  set.add(res);
  liveClientsBySession.set(session.id, set);
  res.write(`data: ${JSON.stringify({ type: "connected", at: Date.now() })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
    } catch {
      // ignore
    }
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    const clients = liveClientsBySession.get(session.id);
    if (!clients) return;
    clients.delete(res);
    if (!clients.size) liveClientsBySession.delete(session.id);
  });
});

app.post("/api/sessions/:sid/candidates/:cid/code", (req, res) => {
  const actor = buildActor(req);
  const session = interviewStore.sessions.get(req.params.sid);
  if (!session) return res.status(404).send("Session not found.");
  const candidate = session.candidates[req.params.cid];
  if (!candidate) return res.status(404).send("Candidate not found.");
  if (!isInterviewer(session, actor) && String(actor.userId) !== String(candidate.userId)) {
    return res.status(403).send("Not allowed to write candidate code.");
  }
  const payload = req.body || {};
  const qid = String(payload.questionId || candidate.activeQuestionId || "_default");
  candidate.codeByQuestionId = candidate.codeByQuestionId || {};
  candidate.codeByQuestionId[qid] = {
    code: String(payload.code || ""),
    updatedAt: new Date().toISOString()
  };
  candidate.lastActiveAt = new Date().toISOString();
  publishLive(session.id, {
    type: "code:update",
    candidateId: candidate.id,
    questionId: qid,
    code: candidate.codeByQuestionId[qid].code,
    at: Date.now()
  });
  return res.json({ ok: true });
});

app.get("/api/sessions/:sid/candidates/:cid/code", (req, res) => {
  const actor = buildActor(req);
  const session = interviewStore.sessions.get(req.params.sid);
  if (!session) return res.status(404).send("Session not found.");
  const candidate = session.candidates[req.params.cid];
  if (!candidate) return res.status(404).send("Candidate not found.");
  if (!isInterviewer(session, actor) && String(actor.userId) !== String(candidate.userId)) {
    return res.status(403).send("Not allowed to read candidate code.");
  }
  const qid = String(req.query.questionId || candidate.activeQuestionId || "_default");
  const payload = candidate.codeByQuestionId?.[qid] || { code: "", updatedAt: null };
  return res.json(payload);
});

app.post("/api/sessions/:sid/candidates/:cid/hint", async (req, res) => {
  const actor = buildActor(req);
  const session = interviewStore.sessions.get(req.params.sid);
  if (!session) return res.status(404).send("Session not found.");
  const candidate = session.candidates[req.params.cid];
  if (!candidate) return res.status(404).send("Candidate not found.");
  if (!isInterviewer(session, actor) && String(actor.userId) !== String(candidate.userId)) {
    return res.status(403).send("Not allowed to request hint.");
  }
  const payload = req.body || {};
  const policy = resolveHintPolicy(session, candidate, payload);
  if (!policy.allowed) return res.status(403).json({ error: policy.reason });

  const qid = String(payload.questionId || candidate.activeQuestionId || "");
  const question = interviewStore.questions.find((q) => q.id === qid);
  try {
    const result = await llmJsonResponse({
      systemPrompt: [
        "You are a coding interviewer.",
        "Give exactly one concise hint (1-2 sentences), no full solution.",
        "Return JSON: {\"hint\":\"...\"}"
      ].join("\n"),
      userContent: JSON.stringify({
        question: { id: qid, title: question?.title || qid, description: question?.description || "" },
        code: String(payload.code || ""),
        policy: policy.hintMode || "always"
      }),
      maxTokens: 180,
      temperature: 0.25
    });
    const hint = String(result?.hint || "Try validating assumptions with a small edge-case first.");
    publishLive(session.id, { type: "hint:generated", candidateId: candidate.id, questionId: qid, at: Date.now() });
    return res.json({ hint });
  } catch (error) {
    return res.status(500).send(error.message || "Hint generation failed.");
  }
});

app.post("/api/sessions/:sid/candidates/:cid/ai-chat", async (req, res) => {
  const actor = buildActor(req);
  const session = interviewStore.sessions.get(req.params.sid);
  if (!session) return res.status(404).send("Session not found.");
  const candidate = session.candidates[req.params.cid];
  if (!candidate) return res.status(404).send("Candidate not found.");
  if (!session.settings?.aiInterviewerChatEnabled) return res.status(403).send("AI interviewer chat is disabled.");
  if (!isInterviewer(session, actor) && String(actor.userId) !== String(candidate.userId)) {
    return res.status(403).send("Not allowed.");
  }
  const payload = req.body || {};
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (!messages.length) return res.status(400).send("messages must be an array.");
  const qid = String(payload.questionId || candidate.activeQuestionId || "");
  const question = interviewStore.questions.find((q) => q.id === qid);

  const systemPrompt = [
    "You are a concise technical interviewer in a live coding session.",
    "Give hints and guidance, not full final solutions.",
    "If candidate is stuck, ask one clarifying question plus one hint.",
    `Question: ${question?.title || qid}`
  ].join("\n");

  if (!OPENAI_API_KEY) {
    return res.json({ reply: "AI chat unavailable: missing OPENAI_API_KEY on server." });
  }
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-12),
          payload.code ? { role: "user", content: `Current code:\n${String(payload.code).slice(0, 6000)}` } : null
        ].filter(Boolean),
        temperature: 0.3,
        max_tokens: 300
      })
    });
    if (!response.ok) return res.status(response.status).send(await response.text());
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || "No response from model.";
    return res.json({ reply });
  } catch (error) {
    return res.status(500).send(error.message || "AI chat failed.");
  }
});

app.post("/api/sessions/:sid/evaluate", async (req, res) => {
  const actor = buildActor(req);
  const session = interviewStore.sessions.get(req.params.sid);
  if (!session) return res.status(404).send("Session not found.");
  if (!isInterviewer(session, actor)) return res.status(403).send("Only interviewers can evaluate.");
  const candidateId = String(req.body?.candidateId || "");
  if (!candidateId) return res.status(400).send("candidateId required.");
  const candidate = session.candidates[candidateId];
  if (!candidate) return res.status(404).send("Candidate not found.");

  const evaluations = {};
  const questionIds = candidate.assignedQuestionIds?.length ? candidate.assignedQuestionIds : session.questionIds;
  for (const qid of questionIds) {
    const code = candidate.codeByQuestionId?.[qid]?.code || "";
    const fallback = scoreSubmissionLocally(code);
    if (!OPENAI_API_KEY) {
      evaluations[qid] = fallback;
      continue;
    }
    try {
      const result = await llmJsonResponse({
        systemPrompt: [
          "Evaluate the candidate solution with strict rubric.",
          "Return JSON:",
          "{\"correctness\":0-40,\"efficiency\":0-25,\"codeQuality\":0-20,\"communication\":0-15,\"total\":0-100,\"feedback\":\"...\"}"
        ].join("\n"),
        userContent: JSON.stringify({
          questionId: qid,
          question: interviewStore.questions.find((q) => q.id === qid) || null,
          code
        }),
        maxTokens: 320,
        temperature: 0.2
      });
      evaluations[qid] = {
        correctness: toSafeScore(result?.correctness, 0, 40),
        efficiency: toSafeScore(result?.efficiency, 0, 25),
        codeQuality: toSafeScore(result?.codeQuality, 0, 20),
        communication: toSafeScore(result?.communication, 0, 15),
        total: toSafeScore(result?.total, 0, 100),
        feedback: String(result?.feedback || "")
      };
    } catch {
      evaluations[qid] = fallback;
    }
  }
  candidate.evaluation = evaluations;
  candidate.evaluatedAt = new Date().toISOString();
  publishLive(session.id, { type: "candidate:evaluated", candidateId, at: Date.now() });
  return res.json({ candidateId, evaluations });
});

app.post("/api/sessions/:sid/compare", async (req, res) => {
  const actor = buildActor(req);
  const session = interviewStore.sessions.get(req.params.sid);
  if (!session) return res.status(404).send("Session not found.");
  if (!isInterviewer(session, actor)) return res.status(403).send("Only interviewers can compare.");

  const candidates = Object.values(session.candidates || {});
  const rankings = candidates.map((c) => {
    const totals = Object.values(c.evaluation || {}).map((x) => Number(x?.total || 0));
    const totalScore = totals.reduce((acc, n) => acc + n, 0);
    return {
      candidateId: c.id,
      displayName: c.displayName,
      totalScore,
      strengths: totalScore >= 150 ? "Strong correctness and consistency." : "Promising but needs more consistency.",
      weaknesses: totalScore >= 150 ? "Could improve communication clarity." : "Needs stronger correctness and complexity choices."
    };
  }).sort((a, b) => b.totalScore - a.totalScore);

  let comparison = {
    rankings,
    bestApproach: rankings[0]
      ? `${rankings[0].displayName} had the highest combined score across assigned questions.`
      : "No ranked candidates yet.",
    summary: "Local comparison generated from rubric totals."
  };

  if (OPENAI_API_KEY && rankings.length > 0) {
    try {
      const result = await llmJsonResponse({
        systemPrompt: [
          "You are a senior interviewer comparing candidates.",
          "Return JSON:",
          "{\"rankings\":[{\"candidateId\":\"...\",\"displayName\":\"...\",\"totalScore\":0,\"strengths\":\"...\",\"weaknesses\":\"...\"}],\"bestApproach\":\"...\",\"summary\":\"...\"}"
        ].join("\n"),
        userContent: JSON.stringify({
          sessionId: session.id,
          title: session.title,
          candidates: rankings
        }),
        maxTokens: 700,
        temperature: 0.2
      });
      if (result && Array.isArray(result.rankings)) comparison = result;
    } catch {
      // Keep local comparison fallback.
    }
  }

  interviewStore.comparisons.set(session.id, {
    comparison,
    updatedAt: new Date().toISOString()
  });
  return res.json(comparison);
});

app.get("/api/sessions/:sid/evaluation", (req, res) => {
  const actor = buildActor(req);
  const session = interviewStore.sessions.get(req.params.sid);
  if (!session) return res.status(404).send("Session not found.");
  if (!isInterviewer(session, actor)) return res.status(403).send("Only interviewers can view comparison.");
  return res.json(interviewStore.comparisons.get(session.id) || { comparison: null });
});

app.get("/api/sessions/:sid/leaderboard", (req, res) => {
  const actor = buildActor(req);
  const session = interviewStore.sessions.get(req.params.sid);
  if (!session) return res.status(404).send("Session not found.");
  if (!isInterviewer(session, actor)) return res.status(403).send("Only interviewers can view leaderboard.");
  const leaderboard = Object.values(session.candidates || {})
    .map((c) => {
      const totals = Object.values(c.evaluation || {}).map((x) => Number(x?.total || 0));
      return {
        candidateId: c.id,
        displayName: c.displayName,
        totalScore: totals.reduce((a, b) => a + b, 0),
        evaluatedAt: c.evaluatedAt || null
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
  return res.json({ leaderboard });
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
