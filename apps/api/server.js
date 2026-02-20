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
    systemPrompt = `You are an experienced technical interviewer conducting a live coding interview.
You've just noticed something in the candidate's code that warrants an interruption.
CONTEXT: ${interruptContext?.detectedIssue || "General observation"}
Severity: ${interruptContext?.severity || "approach"}
Rules:
- Interrupt naturally: "Wait...", "Hold on...", "Before you continue..."
- Be direct but helpful – 2-3 sentences max
- Don't give the full solution
- Ground feedback in the current code
- Do NOT ask generic "what is your approach?" unless the code is essentially empty`;
  } else if (mode === "proactive") {
    systemPrompt = `You are a live interview coach observing code in real-time.
Look for inefficient approaches, wrong data structures, common mistakes, signs of being stuck.
If something is worth mentioning: start with "I notice..." or "Quick thought..." (1-2 sentences).
Ground feedback in the current code and expected signature/output; call out off-track or irrelevant code explicitly.
Do NOT ask generic "what is your approach?" unless the code is essentially empty.
If no feedback is needed respond with EXACTLY an empty string "".`;
  } else {
    systemPrompt = `You are a coding interview coach. Be concise, point out mistakes, ask clarifying questions. Do not solve end-to-end unless asked.`;
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
  const { title, questionIds, settings, createdBy, interviewerEmail } = req.body || {};
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
    interviewerEmail: interviewerEmail || null,
    shareCode,
    status: "draft",
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
    // Gather all submissions
    const subSnap = await withTimeout(getDocs(collection(db, "sessions", sid, "candidates", candidateId, "submissions")));
    const submissions = {};
    subSnap.forEach((d) => { submissions[d.id] = d.data(); });

    const evaluations = {};
    for (const [qid, sub] of Object.entries(submissions)) {
      const question = questionBank.find((q) => q.id === qid);
      const prompt = `Evaluate this candidate's solution for "${question?.title || qid}".
Score on: correctness (0-40), efficiency (0-25), code quality (0-20), communication (0-15).
Return JSON: { "correctness": N, "efficiency": N, "codeQuality": N, "communication": N, "total": N, "feedback": "..." }`;
      const reply = await llm(prompt, [{ role: "user", content: sub.code || "// no code" }], { maxTokens: 500 });
      try {
        evaluations[qid] = JSON.parse(reply);
      } catch {
        evaluations[qid] = { raw: reply, total: 0 };
      }
    }

    // Store evaluation on the candidate doc
    await withTimeout(updateDoc(doc(db, "sessions", sid, "candidates", candidateId), { evaluation: evaluations }));
    res.json({ candidateId, evaluations });
  } catch (e) {
    console.error("POST evaluate error:", e);
    res.status(500).send(e.message);
  }
});

app.post("/api/sessions/:sid/compare", async (req, res) => {
  const { sid } = req.params;
  try {
    const candSnap = await withTimeout(getDocs(collection(db, "sessions", sid, "candidates")));
    const candidates = [];
    for (const cdoc of candSnap.docs) {
      const data = cdoc.data();
      const subSnap = await withTimeout(getDocs(collection(db, "sessions", sid, "candidates", cdoc.id, "submissions")));
      const subs = {};
      subSnap.forEach((s) => { subs[s.id] = s.data(); });
      candidates.push({ id: cdoc.id, displayName: data.displayName, submissions: subs, evaluation: data.evaluation || null });
    }

    const summaryPrompt = `You are a senior technical interviewer. Compare ${candidates.length} candidates.
For each candidate you have their code submissions and individual evaluations.
Produce a JSON ranking:
{
  "rankings": [{ "candidateId": "...", "displayName": "...", "totalScore": N, "strengths": "...", "weaknesses": "..." }],
  "bestApproach": "... which candidate had the most elegant solution and why ...",
  "summary": "... overall comparison ..."
}
Sort rankings by totalScore descending.`;

    const candidateSummary = candidates.map((c) => ({
      id: c.id,
      name: c.displayName,
      evaluation: c.evaluation,
      codeSnippets: Object.fromEntries(
        Object.entries(c.submissions).map(([qid, s]) => [qid, (s.code || "").slice(0, 800)])
      ),
    }));

    const reply = await llm(summaryPrompt, [{ role: "user", content: JSON.stringify(candidateSummary) }], {
      maxTokens: 1200,
      temperature: 0.2,
    });

    let comparison;
    try { comparison = JSON.parse(reply); } catch { comparison = { raw: reply }; }

    await withTimeout(setDoc(doc(db, "evaluations", sid), { comparison, updatedAt: new Date().toISOString() }));
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

// ═══════════════════════════════════════════════════════════════════
//  REPORT GENERATION & EMAIL
// ═══════════════════════════════════════════════════════════════════

async function generateFullReport(sid) {
  const sessionSnap = await withTimeout(getDoc(doc(db, "sessions", sid)));
  if (!sessionSnap.exists()) throw new Error("Session not found.");
  const session = { id: sid, ...sessionSnap.data() };

  const candSnap = await withTimeout(getDocs(collection(db, "sessions", sid, "candidates")));
  const candidates = [];
  for (const cdoc of candSnap.docs) {
    const data = cdoc.data();
    const subSnap = await withTimeout(getDocs(collection(db, "sessions", sid, "candidates", cdoc.id, "submissions")));
    const submissions = {};
    subSnap.forEach((s) => { submissions[s.id] = s.data(); });

    // Evaluate each candidate individually
    const evaluations = {};
    for (const [qid, sub] of Object.entries(submissions)) {
      const question = questionBank.find((q) => q.id === qid);
      const prompt = `Evaluate this candidate's solution for "${question?.title || qid}".
Score on: correctness (0-40), efficiency (0-25), code quality (0-20), communication (0-15).
Return JSON: { "correctness": N, "efficiency": N, "codeQuality": N, "communication": N, "total": N, "feedback": "..." }`;
      const reply = await llm(prompt, [{ role: "user", content: sub.code || "// no code" }], { maxTokens: 500 });
      try {
        evaluations[qid] = JSON.parse(reply);
      } catch {
        evaluations[qid] = { raw: reply, total: 0 };
      }
    }
    await withTimeout(updateDoc(doc(db, "sessions", sid, "candidates", cdoc.id), { evaluation: evaluations }));

    candidates.push({
      id: cdoc.id,
      displayName: data.displayName,
      joinedAt: data.joinedAt,
      submissions,
      evaluation: evaluations,
    });
  }

  // Build the comprehensive report via LLM
  const reportPrompt = `You are a senior technical interviewer writing a comprehensive post-interview report.

Session: "${session.title}"
Number of candidates: ${candidates.length}
Questions: ${(session.questionIds || []).map((qid) => {
    const q = questionBank.find((x) => x.id === qid);
    return q?.title || qid;
  }).join(", ")}

For each candidate you have their code submissions and per-question evaluation scores.

Generate a DETAILED JSON report with this exact structure:
{
  "reportTitle": "Interview Report: <session title>",
  "generatedAt": "<ISO timestamp>",
  "sessionSummary": {
    "title": "...",
    "totalCandidates": N,
    "questionsUsed": ["..."],
    "overallDifficulty": "Easy|Medium|Hard"
  },
  "rankings": [
    {
      "rank": 1,
      "candidateId": "...",
      "displayName": "...",
      "overallScore": N,
      "recommendation": "Strong Hire|Hire|Lean Hire|Lean No Hire|No Hire",
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "perQuestion": [
        {
          "questionId": "...",
          "questionTitle": "...",
          "correctness": N,
          "efficiency": N,
          "codeQuality": N,
          "communication": N,
          "total": N,
          "feedback": "..."
        }
      ]
    }
  ],
  "comparativeAnalysis": "A 3-5 sentence paragraph comparing all candidates, highlighting who performed best and why.",
  "bestApproach": "Which candidate(s) had the most elegant solution and why.",
  "hiringRecommendation": "A clear 2-3 sentence final recommendation for the interviewer about which candidates to advance."
}

Sort rankings by overallScore descending. Be thorough and specific in feedback.`;

  const candidateData = candidates.map((c) => ({
    id: c.id,
    name: c.displayName,
    evaluation: c.evaluation,
    codeSnippets: Object.fromEntries(
      Object.entries(c.submissions).map(([qid, s]) => [qid, (s.code || "").slice(0, 1200)])
    ),
  }));

  const reportReply = await llm(reportPrompt, [{ role: "user", content: JSON.stringify(candidateData) }], {
    maxTokens: 3000,
    temperature: 0.2,
  });

  let report;
  try {
    report = JSON.parse(reportReply);
  } catch {
    report = { raw: reportReply, generatedAt: new Date().toISOString() };
  }

  report.generatedAt = report.generatedAt || new Date().toISOString();

  // Store report in Firestore
  await withTimeout(setDoc(doc(db, "reports", sid), {
    report,
    sessionId: sid,
    sessionTitle: session.title,
    candidateCount: candidates.length,
    createdBy: session.createdBy,
    interviewerEmail: session.interviewerEmail || null,
    updatedAt: new Date().toISOString(),
  }));

  // Also update the evaluations collection for backward compatibility
  const comparison = {
    rankings: (report.rankings || []).map((r) => ({
      candidateId: r.candidateId,
      displayName: r.displayName,
      totalScore: r.overallScore,
      strengths: Array.isArray(r.strengths) ? r.strengths.join("; ") : r.strengths,
      weaknesses: Array.isArray(r.weaknesses) ? r.weaknesses.join("; ") : r.weaknesses,
    })),
    bestApproach: report.bestApproach,
    summary: report.comparativeAnalysis,
  };
  await withTimeout(setDoc(doc(db, "evaluations", sid), { comparison, updatedAt: new Date().toISOString() }));

  return { report, session, candidates };
}

function buildReportHTML(report, sessionTitle) {
  const rankings = report.rankings || [];
  const recColors = {
    "Strong Hire": "#059669",
    "Hire": "#10b981",
    "Lean Hire": "#f59e0b",
    "Lean No Hire": "#f97316",
    "No Hire": "#dc2626",
  };

  let candidateRows = rankings.map((r, i) => {
    const color = recColors[r.recommendation] || "#64748b";
    const strengths = Array.isArray(r.strengths) ? r.strengths.map((s) => `<li>${s}</li>`).join("") : `<li>${r.strengths}</li>`;
    const weaknesses = Array.isArray(r.weaknesses) ? r.weaknesses.map((w) => `<li>${w}</li>`).join("") : `<li>${r.weaknesses}</li>`;

    const perQ = (r.perQuestion || []).map((pq) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;">${pq.questionTitle || pq.questionId}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:13px;">${pq.correctness}/40</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:13px;">${pq.efficiency}/25</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:13px;">${pq.codeQuality}/20</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:13px;">${pq.communication}/15</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;font-size:13px;">${pq.total}/100</td>
      </tr>
    `).join("");

    return `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;background:#fff;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#4f46e5;color:#fff;font-weight:700;font-size:14px;">${i + 1}</span>
        <h3 style="margin:0;font-size:18px;">${r.displayName || r.candidateId}</h3>
        <span style="margin-left:auto;font-size:24px;font-weight:700;color:#1e293b;">${r.overallScore}/100</span>
      </div>
      <span style="display:inline-block;padding:3px 12px;border-radius:999px;font-size:12px;font-weight:700;color:#fff;background:${color};">${r.recommendation}</span>
      <div style="display:flex;gap:24px;margin-top:16px;">
        <div style="flex:1;">
          <h4 style="margin:0 0 6px;font-size:13px;color:#059669;text-transform:uppercase;">Strengths</h4>
          <ul style="margin:0;padding-left:18px;font-size:13px;color:#334155;">${strengths}</ul>
        </div>
        <div style="flex:1;">
          <h4 style="margin:0 0 6px;font-size:13px;color:#dc2626;text-transform:uppercase;">Areas for Improvement</h4>
          <ul style="margin:0;padding-left:18px;font-size:13px;color:#334155;">${weaknesses}</ul>
        </div>
      </div>
      ${perQ ? `
      <h4 style="margin:16px 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;">Per-Question Breakdown</h4>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:6px 10px;text-align:left;font-size:12px;color:#64748b;">Question</th>
            <th style="padding:6px 10px;text-align:center;font-size:12px;color:#64748b;">Correct</th>
            <th style="padding:6px 10px;text-align:center;font-size:12px;color:#64748b;">Efficiency</th>
            <th style="padding:6px 10px;text-align:center;font-size:12px;color:#64748b;">Quality</th>
            <th style="padding:6px 10px;text-align:center;font-size:12px;color:#64748b;">Comm.</th>
            <th style="padding:6px 10px;text-align:center;font-size:12px;color:#64748b;">Total</th>
          </tr>
        </thead>
        <tbody>${perQ}</tbody>
      </table>` : ""}
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:720px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="margin:0 0 4px;font-size:24px;color:#1e293b;">${report.reportTitle || `Interview Report: ${sessionTitle}`}</h1>
      <p style="margin:0;color:#64748b;font-size:14px;">Generated on ${new Date(report.generatedAt).toLocaleString()}</p>
    </div>

    <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:16px;margin-bottom:24px;">
      <h2 style="margin:0 0 8px;font-size:16px;color:#3730a3;">Session Summary</h2>
      <p style="margin:0;font-size:14px;color:#334155;">
        <strong>${report.sessionSummary?.totalCandidates || 0}</strong> candidate(s) evaluated across 
        <strong>${(report.sessionSummary?.questionsUsed || []).length}</strong> question(s)
      </p>
    </div>

    <h2 style="font-size:18px;color:#1e293b;margin-bottom:12px;">Candidate Rankings</h2>
    ${candidateRows}

    <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin-bottom:16px;">
      <h2 style="margin:0 0 8px;font-size:16px;color:#1e293b;">Comparative Analysis</h2>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${report.comparativeAnalysis || ""}</p>
    </div>

    ${report.bestApproach ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:16px;">
      <h2 style="margin:0 0 8px;font-size:16px;color:#166534;">Best Approach</h2>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${report.bestApproach}</p>
    </div>` : ""}

    <div style="background:#4f46e5;border-radius:12px;padding:20px;color:#fff;">
      <h2 style="margin:0 0 8px;font-size:16px;">Hiring Recommendation</h2>
      <p style="margin:0;font-size:14px;line-height:1.6;opacity:0.95;">${report.hiringRecommendation || ""}</p>
    </div>

    <p style="text-align:center;margin-top:32px;font-size:12px;color:#94a3b8;">
      Generated by AI Interview Platform
    </p>
  </div>
</body>
</html>`;
}

// Generate report
app.post("/api/sessions/:sid/report/generate", async (req, res) => {
  const { sid } = req.params;
  try {
    const { report } = await generateFullReport(sid);
    res.json({ report });
  } catch (e) {
    console.error("POST report/generate error:", e);
    res.status(500).send(e.message);
  }
});

// Get stored report
app.get("/api/sessions/:sid/report", async (req, res) => {
  try {
    const snap = await withTimeout(getDoc(doc(db, "reports", req.params.sid)));
    if (!snap.exists()) return res.json({ report: null });
    res.json(snap.data());
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Send report via email
app.post("/api/sessions/:sid/report/send", async (req, res) => {
  const { sid } = req.params;
  const { email } = req.body || {};
  if (!email) return res.status(400).send("email required.");

  try {
    // Fetch stored report
    let reportSnap = await withTimeout(getDoc(doc(db, "reports", sid)));
    let report;
    if (!reportSnap.exists()) {
      const generated = await generateFullReport(sid);
      report = generated.report;
    } else {
      report = reportSnap.data().report;
    }

    const sessionSnap = await withTimeout(getDoc(doc(db, "sessions", sid)));
    const sessionTitle = sessionSnap.exists() ? sessionSnap.data().title : "Interview Session";

    const html = buildReportHTML(report, sessionTitle);

    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;

    if (!smtpUser || !smtpPass) {
      return res.status(500).json({
        error: "Email not configured. Set SMTP_USER and SMTP_PASS environment variables.",
        report,
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"AI Interview Platform" <${smtpFrom}>`,
      to: email,
      subject: `Interview Report: ${sessionTitle}`,
      html,
    });

    // Record that the report was sent
    await withTimeout(updateDoc(doc(db, "reports", sid), {
      lastSentTo: email,
      lastSentAt: new Date().toISOString(),
    }));

    res.json({ ok: true, sentTo: email });
  } catch (e) {
    console.error("POST report/send error:", e);
    res.status(500).send(e.message);
  }
});

// End session and auto-generate report
app.post("/api/sessions/:sid/end", async (req, res) => {
  const { sid } = req.params;
  try {
    await withTimeout(updateDoc(doc(db, "sessions", sid), { status: "completed" }));

    // Auto-generate report and optionally email it
    generateFullReport(sid)
      .then(async ({ report, session }) => {
        console.log(`Report auto-generated for session ${sid}`);
        const email = session.interviewerEmail;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        if (email && smtpUser && smtpPass) {
          try {
            const html = buildReportHTML(report, session.title);
            const transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST || "smtp.gmail.com",
              port: parseInt(process.env.SMTP_PORT || "587", 10),
              secure: parseInt(process.env.SMTP_PORT || "587", 10) === 465,
              auth: { user: smtpUser, pass: smtpPass },
            });
            await transporter.sendMail({
              from: `"AI Interview Platform" <${process.env.SMTP_FROM || smtpUser}>`,
              to: email,
              subject: `Interview Report: ${session.title}`,
              html,
            });
            console.log(`Report auto-emailed to ${email} for session ${sid}`);
            await updateDoc(doc(db, "reports", sid), {
              lastSentTo: email,
              lastSentAt: new Date().toISOString(),
            }).catch(() => {});
          } catch (emailErr) {
            console.error(`Auto-email failed for ${sid}:`, emailErr.message);
          }
        }
      })
      .catch((e) => console.error(`Auto-report generation failed for ${sid}:`, e.message));

    res.json({ ok: true, status: "completed" });
  } catch (e) {
    console.error("POST end session error:", e);
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
