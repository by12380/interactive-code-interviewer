import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";

dotenv.config();

// ─── Firebase Client SDK init ───────────────────────────────────────

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyC6-DxTHKbdLzo70CwX3ieKn_dF6Mpyd_4",
  authDomain: "ai-interviewer-app-6ce20.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "ai-interviewer-app-6ce20",
  storageBucket: "ai-interviewer-app-6ce20.firebasestorage.app",
  messagingSenderId: "487765501995",
  appId: "1:487765501995:web:2739ffc99144bcc2f5e26e",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const app = express();
const PORT = process.env.PORT || 3002;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5173";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ─── Helpers ────────────────────────────────────────────────────────

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Firestore client SDK queues writes when offline and never rejects.
// This wrapper adds a timeout so API calls don't hang forever.
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Firestore request timed out. Make sure Firestore is enabled in your Firebase Console (Firestore Database → Create database → Test mode).")), ms)
    ),
  ]);
}

async function llm(systemPrompt, messages, { maxTokens = 300, temperature = 0.3 } = {}) {
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

function safeJsonParse(raw, fallback = null) {
  if (!raw || typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function numeric(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + numeric(n), 0) / values.length;
}

function deterministicSort(rankings) {
  return [...rankings].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.correctness !== a.correctness) return b.correctness - a.correctness;
    if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
    return (a.displayName || a.candidateId || "").localeCompare(b.displayName || b.candidateId || "");
  });
}

function recommendationBand(totalScore) {
  if (totalScore >= 85) return "Strong Hire";
  if (totalScore >= 70) return "Hire";
  if (totalScore >= 55) return "Leaning No Hire";
  return "No Hire";
}

function buildFallbackComparison(candidates) {
  const rankings = candidates.map((candidate) => {
    const rows = Object.values(candidate.evaluation || {});
    const totals = rows.map((row) => numeric(row?.total));
    const correctness = rows.map((row) => numeric(row?.correctness));
    const efficiency = rows.map((row) => numeric(row?.efficiency));
    const totalScore = clamp(Math.round(average(totals)), 0, 100);
    return {
      candidateId: candidate.id,
      displayName: candidate.displayName || candidate.id,
      totalScore,
      correctness: clamp(Math.round(average(correctness)), 0, 40),
      efficiency: clamp(Math.round(average(efficiency)), 0, 25),
      strengths: "Consistent progress across submitted questions.",
      weaknesses: "Needs deeper optimization and clearer communication on tradeoffs.",
      recommendation: recommendationBand(totalScore),
    };
  });

  const sorted = deterministicSort(rankings).map((row, idx) => ({ ...row, rank: idx + 1 }));
  const top = sorted[0];
  const summary = top
    ? `Top performer is ${top.displayName} with ${top.totalScore}/100. Rankings use deterministic tie-breaks: correctness then efficiency.`
    : "No candidate submissions found for this session.";
  return {
    rankings: sorted,
    bestApproach: top ? `${top.displayName} currently has the strongest overall approach.` : "",
    summary,
  };
}

async function evaluateCandidateInternal(sid, candidateId) {
  const subSnap = await withTimeout(getDocs(collection(db, "sessions", sid, "candidates", candidateId, "submissions")));
  const submissions = {};
  subSnap.forEach((d) => {
    submissions[d.id] = d.data();
  });

  const evaluations = {};
  for (const [qid, sub] of Object.entries(submissions)) {
    const question = questionBank.find((q) => q.id === qid);
    const prompt = `Evaluate this candidate's solution for "${question?.title || qid}".
Score on: correctness (0-40), efficiency (0-25), code quality (0-20), communication (0-15).
Return JSON: { "correctness": N, "efficiency": N, "codeQuality": N, "communication": N, "total": N, "feedback": "..." }`;
    const reply = await llm(prompt, [{ role: "user", content: sub.code || "// no code" }], { maxTokens: 500 });
    const parsed = safeJsonParse(reply, null);
    if (parsed) {
      const correctness = clamp(Math.round(numeric(parsed.correctness)), 0, 40);
      const efficiency = clamp(Math.round(numeric(parsed.efficiency)), 0, 25);
      const codeQuality = clamp(Math.round(numeric(parsed.codeQuality)), 0, 20);
      const communication = clamp(Math.round(numeric(parsed.communication)), 0, 15);
      const computedTotal = correctness + efficiency + codeQuality + communication;
      evaluations[qid] = {
        correctness,
        efficiency,
        codeQuality,
        communication,
        total: clamp(Math.round(numeric(parsed.total, computedTotal)), 0, 100),
        feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
      };
      continue;
    }
    evaluations[qid] = { raw: reply, total: 0 };
  }

  await withTimeout(updateDoc(doc(db, "sessions", sid, "candidates", candidateId), { evaluation: evaluations }));
  return evaluations;
}

async function collectCandidatesWithSubmissions(sid) {
  const candSnap = await withTimeout(getDocs(collection(db, "sessions", sid, "candidates")));
  const candidates = [];
  for (const cdoc of candSnap.docs) {
    const data = cdoc.data();
    const subSnap = await withTimeout(getDocs(collection(db, "sessions", sid, "candidates", cdoc.id, "submissions")));
    const submissions = {};
    subSnap.forEach((s) => {
      submissions[s.id] = s.data();
    });
    candidates.push({
      id: cdoc.id,
      displayName: data.displayName || cdoc.id,
      evaluation: data.evaluation || {},
      submissions,
    });
  }
  return candidates;
}

async function compareCandidatesInternal(candidates) {
  if (!candidates.length) return buildFallbackComparison([]);

  const fallback = buildFallbackComparison(candidates);
  const candidateSummary = candidates.map((candidate) => ({
    candidateId: candidate.id,
    displayName: candidate.displayName,
    deterministicScore: fallback.rankings.find((row) => row.candidateId === candidate.id)?.totalScore || 0,
    evaluation: candidate.evaluation || {},
    codeSnippets: Object.fromEntries(
      Object.entries(candidate.submissions || {}).map(([qid, submission]) => [qid, (submission.code || "").slice(0, 900)])
    ),
  }));

  const summaryPrompt = `You are a senior technical interviewer writing a final report.
Use the provided deterministic scores as the source of truth for ranking order and scores.
Return strict JSON:
{
  "rankings": [
    {
      "candidateId": "...",
      "displayName": "...",
      "totalScore": N,
      "strengths": "...",
      "weaknesses": "...",
      "recommendation": "Strong Hire|Hire|Leaning No Hire|No Hire"
    }
  ],
  "bestApproach": "...",
  "summary": "..."
}
Keep rankings sorted by totalScore descending and preserve candidate IDs exactly.`;

  const reply = await llm(summaryPrompt, [{ role: "user", content: JSON.stringify(candidateSummary) }], {
    maxTokens: 1400,
    temperature: 0.2,
  });
  const parsed = safeJsonParse(reply, null);
  if (!parsed || !Array.isArray(parsed.rankings)) {
    return fallback;
  }

  const byId = new Map(fallback.rankings.map((row) => [row.candidateId, row]));
  const mergedRankings = parsed.rankings
    .map((row) => {
      const id = row?.candidateId;
      if (!id || !byId.has(id)) return null;
      const base = byId.get(id);
      return {
        ...base,
        displayName: row.displayName || base.displayName,
        strengths: typeof row.strengths === "string" ? row.strengths : base.strengths,
        weaknesses: typeof row.weaknesses === "string" ? row.weaknesses : base.weaknesses,
        recommendation: typeof row.recommendation === "string" ? row.recommendation : base.recommendation,
      };
    })
    .filter(Boolean);

  const completedRankings = fallback.rankings.map((row) => mergedRankings.find((x) => x.candidateId === row.candidateId) || row);
  const sorted = deterministicSort(completedRankings).map((row, idx) => ({ ...row, rank: idx + 1 }));
  return {
    rankings: sorted,
    bestApproach: typeof parsed.bestApproach === "string" ? parsed.bestApproach : fallback.bestApproach,
    summary: typeof parsed.summary === "string" ? parsed.summary : fallback.summary,
  };
}

async function sendReportEmail({ to, sid, sessionTitle, comparison }) {
  if (!to) return { ok: false, skipped: true, error: "Missing recipient email." };
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    return { ok: false, skipped: true, error: "SMTP configuration is missing." };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const rankings = comparison?.rankings || [];
  const lines = rankings.slice(0, 10).map((row, index) => {
    return `${index + 1}. ${row.displayName || row.candidateId} - ${row.totalScore}/100 (${row.recommendation || "N/A"})`;
  });
  const resultsUrl = `${APP_BASE_URL}/interviewer/results/${sid}`;
  const text = [
    `Final interview report for "${sessionTitle || sid}"`,
    "",
    "Candidate ranking:",
    ...(lines.length ? lines : ["No candidate submissions were available."]),
    "",
    `Summary: ${comparison?.summary || "No summary available."}`,
    comparison?.bestApproach ? `Best approach: ${comparison.bestApproach}` : "",
    "",
    `View full results: ${resultsUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: `Interview Report: ${sessionTitle || sid}`,
    text,
  });
  return { ok: true, skipped: false };
}

// ─── Health ─────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ═══════════════════════════════════════════════════════════════════
//  CHAT (existing – kept for solo practice mode)
// ═══════════════════════════════════════════════════════════════════

app.post("/api/chat", async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(500).send("Missing OPENAI_API_KEY on the server.");

  const { messages, mode = "chat", interruptContext = null } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).send("messages must be an array.");

  let systemPrompt;
  if (mode === "interrupt") {
    systemPrompt = `You are an experienced coding coach helping a learner in a practice session.
You've just noticed something in the learner's code that warrants an interruption.
CONTEXT: ${interruptContext?.detectedIssue || "General observation"}
Severity: ${interruptContext?.severity || "approach"}
Rules:
- Interrupt naturally: "Wait...", "Hold on...", "Before you continue..."
- Be direct but helpful – 2-3 sentences max
- Don't give the full solution
- Ground feedback in the current code
- Do NOT ask generic "what is your approach?" unless the code is essentially empty`;
  } else if (mode === "proactive") {
    systemPrompt = `You are a coding practice coach observing code in real-time.
Look for inefficient approaches, wrong data structures, common mistakes, signs of being stuck.
If something is worth mentioning: start with "I notice..." or "Quick thought..." (1-2 sentences).
Ground feedback in the current code and expected signature/output; call out off-track or irrelevant code explicitly.
Do NOT ask generic "what is your approach?" unless the code is essentially empty.
If no feedback is needed respond with EXACTLY an empty string "".`;
  } else {
    systemPrompt = `You are a coding practice coach. Be concise, point out mistakes, ask clarifying questions, and guide learning without giving full end-to-end solutions unless asked.`;
  }

  try {
    const reply = await llm(systemPrompt, messages, {
      maxTokens: mode === "summary" ? 900 : 300,
    });
    if (mode === "proactive" && !reply) return res.json({ reply: null });
    return res.json({ reply: reply || "No response from model." });
  } catch (error) {
    return res.status(500).send(error.message || "LLM request failed.");
  }
});

// ═══════════════════════════════════════════════════════════════════
//  QUESTION BANK
// ═══════════════════════════════════════════════════════════════════

let questionBank = [];

async function loadQuestionBank() {
  try {
    const mod = await import("../web/src/data/questionBank.js");
    questionBank = mod.QUESTION_BANK || mod.default || [];
    console.log(`Loaded ${questionBank.length} questions into memory.`);
  } catch (e) {
    console.warn("Could not load questionBank.js:", e.message);
  }
}
loadQuestionBank();

app.get("/api/questions", async (req, res) => {
  const { category, difficulty, search } = req.query;
  let results = [...questionBank];

  // Append custom questions from Firestore
  try {
    const snap = await getDocs(collection(db, "customQuestions"));
    snap.forEach((d) => results.push({ id: d.id, ...d.data(), _custom: true }));
  } catch { /* Firestore may not have this collection yet */ }

  if (category) results = results.filter((q) => q.category === category);
  if (difficulty) results = results.filter((q) => q.difficulty === difficulty);
  if (search) {
    const s = search.toLowerCase();
    results = results.filter(
      (q) =>
        q.title?.toLowerCase().includes(s) ||
        q.id?.toLowerCase().includes(s) ||
        q.category?.toLowerCase().includes(s)
    );
  }
  res.json(results);
});

app.get("/api/questions/:id", async (req, res) => {
  const q = questionBank.find((q) => q.id === req.params.id);
  if (q) return res.json(q);
  try {
    const snap = await getDoc(doc(db, "customQuestions", req.params.id));
    if (snap.exists()) return res.json({ id: snap.id, ...snap.data() });
  } catch { /* ignore */ }
  res.status(404).send("Question not found.");
});

app.post("/api/questions", async (req, res) => {
  const { title, description, difficulty, category, starterCode, testCases, hints, solution, createdBy } = req.body || {};
  if (!title || !description) return res.status(400).send("title and description required.");
  const id = "custom-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const q = {
    title, description, difficulty: difficulty || "Medium", category: category || "Custom",
    starterCode: starterCode || "", testCases: testCases || [], hints: hints || [],
    solution: solution || "", createdBy: createdBy || null, createdAt: new Date().toISOString(),
  };
  try {
    await withTimeout(setDoc(doc(db, "customQuestions", id), q));
    res.json({ id, ...q });
  } catch (e) {
    console.error("POST /api/questions error:", e);
    res.status(500).send(e.message);
  }
});

// ═══════════════════════════════════════════════════════════════════
//  SESSIONS
// ═══════════════════════════════════════════════════════════════════

app.post("/api/sessions", async (req, res) => {
  const { title, questionIds, settings, createdBy, createdByEmail } = req.body || {};
  if (!title) return res.status(400).send("title required.");
  const shareCode = randomCode();
  const session = {
    title,
    questionIds: questionIds || [],
    settings: {
      hintsEnabled: true,
      aiInterruptionsEnabled: true,
      showTestCases: true,
      timeLimitSeconds: 30 * 60,
      ...(settings || {}),
    },
    createdBy: createdBy || null,
    createdByEmail: createdByEmail || null,
    shareCode,
    status: "draft",
    reportStatus: "idle",
    createdAt: new Date().toISOString(),
  };
  try {
    const ref = await withTimeout(addDoc(collection(db, "sessions"), session));
    console.log("Session created:", ref.id);
    res.json({ id: ref.id, ...session });
  } catch (e) {
    console.error("POST /api/sessions error:", e);
    res.status(500).send(e.message);
  }
});

app.get("/api/sessions", async (req, res) => {
  try {
    let q;
    if (req.query.createdBy) {
      q = query(collection(db, "sessions"), where("createdBy", "==", req.query.createdBy), orderBy("createdAt", "desc"), limit(50));
    } else {
      q = query(collection(db, "sessions"), orderBy("createdAt", "desc"), limit(50));
    }
    const snap = await withTimeout(getDocs(q));
    const sessions = [];
    snap.forEach((d) => sessions.push({ id: d.id, ...d.data() }));
    res.json(sessions);
  } catch (e) {
    console.error("GET /api/sessions error:", e);
    // If index not ready or timeout, return all without ordering
    try {
      const snap = await withTimeout(getDocs(collection(db, "sessions")));
      const sessions = [];
      snap.forEach((d) => sessions.push({ id: d.id, ...d.data() }));
      if (req.query.createdBy) {
        res.json(sessions.filter((s) => s.createdBy === req.query.createdBy));
      } else {
        res.json(sessions);
      }
    } catch (e2) {
      res.status(500).send(e2.message);
    }
  }
});

app.get("/api/sessions/:id", async (req, res) => {
  try {
    const snap = await withTimeout(getDoc(doc(db, "sessions", req.params.id)));
    if (!snap.exists()) return res.status(404).send("Session not found.");
    res.json({ id: snap.id, ...snap.data() });
  } catch (e) {
    console.error("GET /api/sessions/:id error:", e);
    res.status(500).send(e.message);
  }
});

app.put("/api/sessions/:id", async (req, res) => {
  try {
    const updates = req.body || {};
    delete updates.id;
    delete updates.createdAt;
    await withTimeout(updateDoc(doc(db, "sessions", req.params.id), updates));
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/sessions/:id error:", e);
    res.status(500).send(e.message);
  }
});

app.delete("/api/sessions/:id", async (req, res) => {
  try {
    await withTimeout(deleteDoc(doc(db, "sessions", req.params.id)));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// ═══════════════════════════════════════════════════════════════════
//  SESSION CANDIDATES
// ═══════════════════════════════════════════════════════════════════

app.post("/api/sessions/join", async (req, res) => {
  const { shareCode, userId, displayName } = req.body || {};
  if (!shareCode) return res.status(400).send("shareCode required.");
  try {
    const q = query(collection(db, "sessions"), where("shareCode", "==", shareCode.toUpperCase()), limit(1));
    const snap = await withTimeout(getDocs(q));
    if (snap.empty) return res.status(404).send("Session not found for that code.");
    const sessionDoc = snap.docs[0];
    const sessionId = sessionDoc.id;

    const candidateId = userId || "anon-" + Date.now().toString(36);
    const ref = doc(db, "sessions", sessionId, "candidates", candidateId);
    await withTimeout(setDoc(ref, {
      userId: userId || null,
      displayName: displayName || "Anonymous",
      joinedAt: new Date().toISOString(),
      status: "joined",
    }, { merge: true }));

    const session = { id: sessionId, ...sessionDoc.data() };
    res.json({ session, candidateId });
  } catch (e) {
    console.error("POST /api/sessions/join error:", e);
    res.status(500).send(e.message);
  }
});

app.get("/api/sessions/:id/candidates", async (req, res) => {
  try {
    const snap = await withTimeout(getDocs(collection(db, "sessions", req.params.id, "candidates")));
    const candidates = [];
    snap.forEach((d) => candidates.push({ id: d.id, ...d.data() }));
    res.json(candidates);
  } catch (e) {
    console.error("GET /api/sessions/:id/candidates error:", e);
    res.status(500).send(e.message);
  }
});

// ═══════════════════════════════════════════════════════════════════
//  CODE SYNC
// ═══════════════════════════════════════════════════════════════════

app.post("/api/sessions/:sid/candidates/:cid/code", async (req, res) => {
  const { code, questionId } = req.body || {};
  const { sid, cid } = req.params;
  const qid = questionId || "_default";
  try {
    const sessionSnap = await withTimeout(getDoc(doc(db, "sessions", sid)));
    if (!sessionSnap.exists()) return res.status(404).send("Session not found.");
    if (sessionSnap.data()?.status === "completed") {
      return res.status(409).send("Session has ended. Submissions are closed.");
    }

    const ref = doc(db, "sessions", sid, "candidates", cid, "submissions", qid);
    await withTimeout(setDoc(ref, { code: code || "", lastUpdatedAt: new Date().toISOString() }, { merge: true }));
    res.json({ ok: true });
  } catch (e) {
    console.error("POST code sync error:", e);
    res.status(500).send(e.message);
  }
});

app.get("/api/sessions/:sid/candidates/:cid/code", async (req, res) => {
  const { sid, cid } = req.params;
  const qid = req.query.questionId || "_default";
  try {
    const ref = doc(db, "sessions", sid, "candidates", cid, "submissions", qid);
    const snap = await withTimeout(getDoc(ref));
    if (!snap.exists()) return res.json({ code: "", lastUpdatedAt: null });
    res.json(snap.data());
  } catch (e) {
    console.error("GET code sync error:", e);
    res.status(500).send(e.message);
  }
});

// ═══════════════════════════════════════════════════════════════════
//  HINTS (permission-gated)
// ═══════════════════════════════════════════════════════════════════

app.post("/api/sessions/:sid/candidates/:cid/hint", async (req, res) => {
  const { sid } = req.params;
  const { questionId, code } = req.body || {};
  try {
    const sessionSnap = await withTimeout(getDoc(doc(db, "sessions", sid)));
    if (!sessionSnap.exists()) return res.status(404).send("Session not found.");
    const session = sessionSnap.data();
    if (!session.settings?.hintsEnabled) return res.status(403).json({ error: "Hints are disabled for this session." });

    const question = questionBank.find((q) => q.id === questionId);
    const prompt = `You are a coding interview coach. The candidate is working on "${question?.title || questionId}".
Give ONE helpful hint (1-2 sentences) based on their code so far. Don't give the answer.`;
    const reply = await llm(prompt, [{ role: "user", content: `Current code:\n${code || "// empty"}` }]);
    res.json({ hint: reply });
  } catch (e) {
    console.error("POST hint error:", e);
    res.status(500).send(e.message);
  }
});

// ═══════════════════════════════════════════════════════════════════
//  AI EVALUATION
// ═══════════════════════════════════════════════════════════════════

app.post("/api/sessions/:sid/evaluate", async (req, res) => {
  const { sid } = req.params;
  const { candidateId } = req.body || {};
  if (!candidateId) return res.status(400).send("candidateId required.");

  try {
    const evaluations = await evaluateCandidateInternal(sid, candidateId);
    res.json({ candidateId, evaluations });
  } catch (e) {
    console.error("POST evaluate error:", e);
    res.status(500).send(e.message);
  }
});

app.post("/api/sessions/:sid/compare", async (req, res) => {
  const { sid } = req.params;
  try {
    const candidates = await collectCandidatesWithSubmissions(sid);
    const comparison = await compareCandidatesInternal(candidates);
    await withTimeout(
      setDoc(
        doc(db, "evaluations", sid),
        {
          comparison,
          updatedAt: new Date().toISOString(),
          meta: {
            generatedAt: new Date().toISOString(),
            generatedBy: "manual-compare",
          },
        },
        { merge: true }
      )
    );
    res.json(comparison);
  } catch (e) {
    console.error("POST compare error:", e);
    res.status(500).send(e.message);
  }
});

app.get("/api/sessions/:sid/evaluation", async (req, res) => {
  try {
    const snap = await withTimeout(getDoc(doc(db, "evaluations", req.params.sid)));
    if (!snap.exists()) return res.json({ comparison: null });
    res.json(snap.data());
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.post("/api/sessions/:sid/finalize-report", async (req, res) => {
  const { sid } = req.params;
  const generatedBy = req.body?.generatedBy || "system";
  let sessionRef = null;

  try {
    sessionRef = doc(db, "sessions", sid);
    const sessionSnap = await withTimeout(getDoc(sessionRef));
    if (!sessionSnap.exists()) return res.status(404).send("Session not found.");
    const session = sessionSnap.data();
    if (session.reportStatus === "generating") {
      return res.status(409).send("Report generation is already in progress.");
    }

    await withTimeout(
      updateDoc(sessionRef, {
        status: "completed",
        reportStatus: "generating",
        reportError: null,
      })
    );

    const candidates = await getDocs(collection(db, "sessions", sid, "candidates"));
    for (const candidateDoc of candidates.docs) {
      await evaluateCandidateInternal(sid, candidateDoc.id);
    }

    const refreshedCandidates = await collectCandidatesWithSubmissions(sid);
    const comparison = await compareCandidatesInternal(refreshedCandidates);
    const evalRef = doc(db, "evaluations", sid);
    const existingEvalSnap = await withTimeout(getDoc(evalRef));
    const previousVersion = numeric(existingEvalSnap.data()?.meta?.version, 0);
    const generatedAt = new Date().toISOString();

    let emailStatus = "skipped";
    let emailSentAt = null;
    let emailError = null;
    try {
      const emailResult = await sendReportEmail({
        to: session.createdByEmail,
        sid,
        sessionTitle: session.title,
        comparison,
      });
      emailStatus = emailResult.ok ? "sent" : emailResult.skipped ? "skipped" : "failed";
      emailSentAt = emailResult.ok ? generatedAt : null;
      emailError = emailResult.ok ? null : emailResult.error || null;
    } catch (emailFailure) {
      emailStatus = "failed";
      emailSentAt = null;
      emailError = emailFailure.message || "Email send failed.";
    }

    const meta = {
      generatedAt,
      generatedBy,
      version: previousVersion + 1,
      emailStatus,
      emailSentAt,
      error: emailError,
    };

    await withTimeout(
      setDoc(
        evalRef,
        {
          comparison,
          updatedAt: generatedAt,
          meta,
        },
        { merge: true }
      )
    );

    await withTimeout(
      updateDoc(sessionRef, {
        status: "completed",
        reportStatus: "ready",
        reportError: null,
        lastReportGeneratedAt: generatedAt,
      })
    );

    res.json({ comparison, meta });
  } catch (e) {
    if (sessionRef) {
      await withTimeout(
        updateDoc(sessionRef, {
          reportStatus: "failed",
          reportError: e.message || "Failed to finalize report.",
        })
      ).catch(() => {});
    }
    console.error("POST finalize-report error:", e);
    res.status(500).send(e.message);
  }
});

// ═══════════════════════════════════════════════════════════════════
//  CODE TRANSLATION (existing)
// ═══════════════════════════════════════════════════════════════════

app.post("/api/translate", async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(500).send("Missing OPENAI_API_KEY on the server.");
  const { code, sourceLanguage, targetLanguage } = req.body || {};
  if (!code || typeof code !== "string") return res.status(400).send("code must be a non-empty string.");
  if (!sourceLanguage || !targetLanguage) return res.status(400).send("sourceLanguage and targetLanguage required.");
  const validLanguages = ["javascript", "python", "java", "cpp"];
  if (!validLanguages.includes(sourceLanguage) || !validLanguages.includes(targetLanguage))
    return res.status(400).send(`Languages must be one of: ${validLanguages.join(", ")}`);

  const langNames = { javascript: "JavaScript", python: "Python", java: "Java", cpp: "C++" };
  const systemPrompt = `Translate ${langNames[sourceLanguage]} code to ${langNames[targetLanguage]}. Output ONLY the translated code.`;

  try {
    const reply = await llm(systemPrompt, [{ role: "user", content: code }], { maxTokens: 2000, temperature: 0.2 });
    const translatedCode = reply.replace(/^```[\w]*\n?/gm, "").replace(/\n?```$/gm, "").trim();
    res.json({ translatedCode, sourceLanguage, targetLanguage });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// ─── Start ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
