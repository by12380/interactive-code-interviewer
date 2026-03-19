import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import { initializeApp } from "firebase/app";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { adminDb } from "./firebase.js";

dotenv.config();

// ─── Firebase ───────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyC6-DxTHKbdLzo70CwX3ieKn_dF6Mpyd_4",
  authDomain: "ai-interviewer-app-6ce20.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "ai-interviewer-app-6ce20",
  storageBucket: "ai-interviewer-app-6ce20.firebasestorage.app",
  messagingSenderId: "487765501995",
  appId: "1:487765501995:web:2739ffc99144bcc2f5e26e",
};

const firebaseApp = initializeApp(firebaseConfig, "api-storage");
const db = adminDb;
const storage = getStorage(firebaseApp);

// ─── Firestore compatibility helpers ────────────────────────────────
// These map the Firebase Client SDK call-style used throughout this
// file to the underlying db object (which may be Admin SDK or a
// Client SDK wrapper — both expose .collection() / .doc() / etc.).

function collection(_db, ...segments) {
  return db.collection(segments.join("/"));
}

function doc(_db, ...segments) {
  return db.doc(segments.join("/"));
}

async function addDoc(collectionRef, data) {
  return collectionRef.add(data);
}

async function getDoc(ref) {
  return ref.get();
}

async function getDocs(ref) {
  return ref.get();
}

async function setDoc(ref, data, options) {
  return ref.set(data, options);
}

async function updateDoc(ref, data) {
  return ref.update(data);
}

async function deleteDoc(ref) {
  return ref.delete();
}

function where(...args) {
  return { type: "where", args };
}

function orderBy(...args) {
  return { type: "orderBy", args };
}

function limit(...args) {
  return { type: "limit", args };
}

function query(baseRef, ...constraints) {
  return constraints.reduce((acc, constraint) => {
    if (!constraint || typeof acc?.[constraint.type] !== "function") return acc;
    return acc[constraint.type](...constraint.args);
  }, baseRef);
}

const app = express();
const PORT = process.env.PORT || 3002;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const videoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

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

  const { messages, mode = "chat", interruptContext = null, practiceMode = false, language = "javascript" } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).send("messages must be an array.");

  const langNames = { javascript: "JavaScript", python: "Python", java: "Java", cpp: "C++" };
  const langLabel = langNames[language] || "JavaScript";

  let systemPrompt;
  if (practiceMode) {
    if (mode === "interrupt") {
      systemPrompt = `You are a friendly AI coding tutor helping someone practice in ${langLabel}.
You've noticed something in the learner's code worth mentioning.
CONTEXT: ${interruptContext?.detectedIssue || "General observation"}
Severity: ${interruptContext?.severity || "approach"}
Rules:
- Be encouraging and supportive: "Hey, quick tip..." or "I noticed something..."
- Be direct but gentle – 2-3 sentences max
- Give more guidance than you would in an interview — it's okay to be more helpful
- Ground feedback in the current ${langLabel} code
- Use ${langLabel}-specific terminology and idioms when giving advice
- If they seem stuck, offer a concrete next step`;
    } else if (mode === "proactive") {
      systemPrompt = `You are a supportive AI coding tutor observing ${langLabel} code in real-time during a practice session.
Look for learning opportunities: inefficient approaches, wrong data structures, common mistakes, signs of being stuck.
If something is worth mentioning: start with "Tip:" or "Quick thought..." (1-2 sentences).
Be encouraging — this is practice, not an interview. It's okay to give more direct guidance.
Use ${langLabel}-specific best practices and idioms in your feedback.
Ground feedback in the current code. If no feedback is needed respond with EXACTLY an empty string "".`;
    } else {
      systemPrompt = `You are a friendly and supportive AI coding tutor. The user is practicing ${langLabel} — not in an interview.
Be helpful, explain concepts clearly, give hints freely, and encourage learning.
If they ask for help, guide them step by step. It's okay to show ${langLabel} code examples.
Be concise but thorough. Celebrate progress and correct mistakes gently.`;
    }
  } else {
    if (mode === "interrupt") {
      systemPrompt = `You are a senior technical interviewer conducting a live ${langLabel} coding interview.
You've noticed a SIGNIFICANT issue in the candidate's ${langLabel} code that warrants a brief interruption.
CONTEXT: ${interruptContext?.detectedIssue || "General observation"}
Severity: ${interruptContext?.severity || "approach"}
Rules:
- ONLY interrupt for real problems: wrong algorithm choice, critical bugs, fundamentally flawed approach, or infinite loops
- Do NOT interrupt for minor style issues, variable naming, or small optimizations
- Do NOT ask the candidate to explain their approach — they're in an interview, let them work
- Do NOT ask beginner-level questions
- Be brief and precise: use ${langLabel}-specific terminology (1-2 sentences)
- Never give the full solution, but point them in the right direction
- Ground feedback in the specific ${langLabel} code they wrote`;
    } else if (mode === "proactive") {
      systemPrompt = `You are a senior technical interviewer silently observing a live ${langLabel} coding interview.
Your bar for intervention is HIGH. Only speak up if:
- The candidate is heading toward a fundamentally wrong approach that will waste significant time
- There's a critical bug (off-by-one that breaks all test cases, wrong data structure entirely)
- The candidate appears completely stuck (no meaningful progress for a while)
- The candidate is using non-idiomatic ${langLabel} patterns that indicate a fundamental misunderstanding

Do NOT speak up for:
- Minor inefficiencies they might fix later
- Style or naming preferences
- Approaches that work but aren't optimal (let them optimize after getting a working solution)
- To ask them about their thought process — this is an interview, not tutoring

If intervention IS warranted, be precise and brief (1 sentence max): "Heads up — that won't handle negative inputs." 
If no feedback is needed respond with EXACTLY an empty string "".`;
    } else {
      systemPrompt = `You are a senior technical interviewer in a live ${langLabel} coding interview. The candidate is asking you a question or clarifying something.
Rules:
- Answer their question concisely and professionally, using ${langLabel}-specific terminology
- Do NOT over-explain or lecture — treat them as a competent engineer
- It's okay to confirm their approach is reasonable or point out a flaw if asked
- Do NOT volunteer the solution unless they're completely stuck and explicitly ask for major help
- Do NOT ask them beginner questions or quiz them on fundamentals
- Keep responses short (2-3 sentences max) — this is a real interview, not a tutoring session
- If they ask a clarifying question about the problem, answer it directly
- Any code examples you provide must be in ${langLabel}`;
    }
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
//  CANDIDATE INVITATION EMAIL
// ═══════════════════════════════════════════════════════════════════

function buildInvitationHTML({ title, shareCode, scheduledAt, joinUrl }) {
  const scheduledLabel = scheduledAt
    ? new Date(scheduledAt).toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 28px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">You're Invited to an Interview</h1>
      </div>

      <div style="padding:28px;">
        <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.6;">
          You have been scheduled for an interview session. Here are the details:
        </p>

        <div style="background:#f1f5f9;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;vertical-align:top;width:110px;">Session</td>
              <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${title}</td>
            </tr>
            ${scheduledLabel ? `
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;vertical-align:top;">Scheduled</td>
              <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${scheduledLabel}</td>
            </tr>` : ""}
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;vertical-align:top;">Session Code</td>
              <td style="padding:6px 0;color:#4f46e5;font-size:18px;font-weight:700;letter-spacing:2px;">${shareCode}</td>
            </tr>
          </table>
        </div>

        ${scheduledLabel
          ? `<p style="margin:0 0 20px;color:#64748b;font-size:13px;line-height:1.5;">
              The join button below will become active at the scheduled time. Please be ready a few minutes early.
            </p>`
          : ""}

        <div style="text-align:center;margin:24px 0;">
          <a href="${joinUrl}" style="display:inline-block;padding:14px 36px;background:#4f46e5;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;">
            Join Interview
          </a>
        </div>

        <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;line-height:1.5;">
          Or paste this link in your browser:<br>
          <a href="${joinUrl}" style="color:#4f46e5;word-break:break-all;">${joinUrl}</a>
        </p>
      </div>

      <div style="background:#f8fafc;padding:16px 28px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#94a3b8;font-size:11px;">AI Interview Platform</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function sendCandidateInvitation({ candidateEmail, shareCode, title, scheduledAt }) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.warn("SMTP not configured — skipping candidate invitation email.");
    return;
  }

  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  const joinUrl = `${clientOrigin}/join/${shareCode}`;
  const html = buildInvitationHTML({ title, shareCode, scheduledAt, joinUrl });

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: parseInt(process.env.SMTP_PORT || "587", 10) === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const scheduledLabel = scheduledAt
    ? ` — ${new Date(scheduledAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}`
    : "";

  await transporter.sendMail({
    from: `"AI Interview Platform" <${process.env.SMTP_FROM || smtpUser}>`,
    to: candidateEmail,
    subject: `Interview Invitation: ${title}${scheduledLabel}`,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════
//  SESSIONS
// ═══════════════════════════════════════════════════════════════════

app.post("/api/sessions", async (req, res) => {
  const {
    title, questionIds, settings, createdBy, interviewerEmail, candidateEmail, scheduledAt,
    sessionFormat, candidateProfile, aiGeneratedQuestions,
  } = req.body || {};
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
      includeMockInterview: sessionFormat === "mock_interview" || sessionFormat === "both",
      ...(settings || {}),
    },
    sessionFormat: sessionFormat || "coding_only",
    candidateProfile: candidateProfile || null,
    aiGeneratedQuestions: aiGeneratedQuestions || [],
    createdBy: createdBy || null,
    interviewerEmail: interviewerEmail || null,
    candidateEmail: candidateEmail || null,
    scheduledAt: scheduledAt || null,
    shareCode,
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  try {
    const ref = await withTimeout(addDoc(collection(db, "sessions"), session));
    console.log("Session created:", ref.id);

    if (candidateEmail) {
      sendCandidateInvitation({ candidateEmail, shareCode, title, scheduledAt })
        .then(() => console.log(`Invitation sent to ${candidateEmail}`))
        .catch((err) => console.error(`Failed to send invitation to ${candidateEmail}:`, err.message));
    }

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
//  SESSION LOOKUP (by share code — public, returns minimal info)
// ═══════════════════════════════════════════════════════════════════

app.get("/api/sessions/lookup/:code", async (req, res) => {
  try {
    const code = (req.params.code || "").toUpperCase();
    const q = query(collection(db, "sessions"), where("shareCode", "==", code), limit(1));
    const snap = await withTimeout(getDocs(q));
    if (snap.empty) return res.status(404).send("Session not found.");
    const data = snap.docs[0].data();
    res.json({
      title: data.title,
      scheduledAt: data.scheduledAt || null,
      status: data.status,
    });
  } catch (e) {
    console.error("GET /api/sessions/lookup error:", e);
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

app.post("/api/sessions/:sid/candidates/:cid/behavioral-response", async (req, res) => {
  const { sid, cid } = req.params;
  const {
    questionIndex,
    questionId,
    question,
    category,
    rationale,
    answer,
    answerSource,
    answeredAt,
  } = req.body || {};

  const normalizedAnswer = typeof answer === "string" ? answer.trim() : "";
  if (!normalizedAnswer) return res.status(400).send("answer required.");

  const normalizedIndex = Number.isFinite(Number(questionIndex))
    ? Number(questionIndex)
    : null;
  const resolvedQuestionId = questionId || (
    normalizedIndex !== null ? `behavioral-${normalizedIndex + 1}` : `behavioral-${Date.now()}`
  );

  try {
    const candidateRef = doc(db, "sessions", sid, "candidates", cid);
    const candidateSnap = await withTimeout(getDoc(candidateRef));
    const existingResponses = candidateSnap.exists() && Array.isArray(candidateSnap.data().behavioralResponses)
      ? candidateSnap.data().behavioralResponses
      : [];

    const responseRecord = {
      questionIndex: normalizedIndex,
      questionId: resolvedQuestionId,
      question: question || "",
      category: category || null,
      rationale: rationale || null,
      answer: normalizedAnswer,
      answerSource: answerSource || "speech",
      answeredAt: answeredAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextResponses = existingResponses.filter((item) => {
      if (normalizedIndex !== null && item.questionIndex === normalizedIndex) return false;
      return item.questionId !== resolvedQuestionId;
    });
    nextResponses.push(responseRecord);
    nextResponses.sort((a, b) => (a.questionIndex ?? 999) - (b.questionIndex ?? 999));
    const behavioralAnswers = nextResponses.map((item) => ({
      question: item.question || "",
      category: item.category || "",
      answer: item.answer || "",
    }));

    await withTimeout(setDoc(candidateRef, {
      behavioralResponses: nextResponses,
      behavioralAnswers,
      lastBehavioralAnsweredAt: new Date().toISOString(),
      status: "interviewing",
    }, { merge: true }));

    res.json({ ok: true, behavioralResponses: nextResponses });
  } catch (e) {
    console.error("POST behavioral-response error:", e);
    res.status(500).send(e.message);
  }
});

app.post("/api/sessions/:sid/candidates/:cid/behavioral-state", async (req, res) => {
  const { sid, cid } = req.params;
  const {
    phase,
    behavioralQuestionIndex,
    behavioralQuestionText,
    behavioralTotalQuestions,
    behavioralCompletedCount,
    codingQuestionId,
    codingQuestionTitle,
    statusLabel,
  } = req.body || {};

  try {
    const candidateRef = doc(db, "sessions", sid, "candidates", cid);
    const liveInterviewState = {
      phase: phase || "behavioral",
      behavioralQuestionIndex: Number.isFinite(Number(behavioralQuestionIndex))
        ? Number(behavioralQuestionIndex)
        : null,
      behavioralQuestionText: typeof behavioralQuestionText === "string" ? behavioralQuestionText : null,
      behavioralTotalQuestions: Number.isFinite(Number(behavioralTotalQuestions))
        ? Number(behavioralTotalQuestions)
        : null,
      behavioralCompletedCount: Number.isFinite(Number(behavioralCompletedCount))
        ? Number(behavioralCompletedCount)
        : null,
      codingQuestionId: typeof codingQuestionId === "string" ? codingQuestionId : null,
      codingQuestionTitle: typeof codingQuestionTitle === "string" ? codingQuestionTitle : null,
      statusLabel: statusLabel || (phase === "coding" ? "coding" : "answering"),
      updatedAt: new Date().toISOString(),
    };

    await withTimeout(setDoc(candidateRef, {
      liveInterviewState,
      status: liveInterviewState.statusLabel === "completed"
        ? "submitted"
        : (phase === "coding" ? "coding" : "interviewing"),
    }, { merge: true }));

    res.json({ ok: true, liveInterviewState });
  } catch (e) {
    console.error("POST behavioral-state error:", e);
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
    const sessionLang = session.settings?.language || "javascript";
    const langNames = { javascript: "JavaScript", python: "Python", java: "Java", cpp: "C++" };
    const langLabel = langNames[sessionLang] || "JavaScript";
    const prompt = `You are a coding interview coach. The candidate is working on "${question?.title || questionId}" in ${langLabel}.
Give ONE helpful hint (1-2 sentences) based on their ${langLabel} code so far. Don't give the answer. Use ${langLabel}-specific guidance.`;
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

    const sessionSnap2 = await withTimeout(getDoc(doc(db, "sessions", sid)));
    const sessionData = sessionSnap2.exists() ? sessionSnap2.data() : {};
    const evalLang = sessionData.settings?.language || "javascript";
    const evalLangNames = { javascript: "JavaScript", python: "Python", java: "Java", cpp: "C++" };
    const evalLangLabel = evalLangNames[evalLang] || "JavaScript";

    const evaluations = {};
    for (const [qid, sub] of Object.entries(submissions)) {
      const question = questionBank.find((q) => q.id === qid);
      const prompt = `Evaluate this candidate's ${evalLangLabel} solution for "${question?.title || qid}".
Score on: correctness (0-40), efficiency (0-25), code quality (0-20), communication (0-15).
Consider ${evalLangLabel}-specific best practices, idiomatic patterns, and language features in the code quality score.
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

  const reportLang = session.settings?.language || "javascript";
  const reportLangNames = { javascript: "JavaScript", python: "Python", java: "Java", cpp: "C++" };
  const reportLangLabel = reportLangNames[reportLang] || "JavaScript";

  const candSnap = await withTimeout(getDocs(collection(db, "sessions", sid, "candidates")));
  const candidates = [];
  for (const cdoc of candSnap.docs) {
    const data = cdoc.data();
    const subSnap = await withTimeout(getDocs(collection(db, "sessions", sid, "candidates", cdoc.id, "submissions")));
    const submissions = {};
    subSnap.forEach((s) => { submissions[s.id] = s.data(); });
    const behavioralResponses = Array.isArray(data.behavioralResponses)
      ? data.behavioralResponses
      : [];
    const behavioralAnswers = behavioralResponses.length > 0
      ? behavioralResponses.map((item) => ({
        question: item.question || "",
        category: item.category || "",
        answer: item.answer || "",
      }))
      : (Array.isArray(data.behavioralAnswers) ? data.behavioralAnswers : []);

    // Evaluate each candidate individually
    const evaluations = {};
    for (const [qid, sub] of Object.entries(submissions)) {
      const question = questionBank.find((q) => q.id === qid);
      const prompt = `Evaluate this candidate's ${reportLangLabel} solution for "${question?.title || qid}".
Score on: correctness (0-40), efficiency (0-25), code quality (0-20), communication (0-15).
Consider ${reportLangLabel}-specific best practices and idiomatic patterns in the code quality score.
Return JSON: { "correctness": N, "efficiency": N, "codeQuality": N, "communication": N, "total": N, "feedback": "..." }`;
      const reply = await llm(prompt, [{ role: "user", content: sub.code || "// no code" }], { maxTokens: 500 });
      try {
        evaluations[qid] = JSON.parse(reply);
      } catch {
        evaluations[qid] = { raw: reply, total: 0 };
      }
    }

    // Evaluate behavioral answers if present
    let behavioralEvaluation = null;
    if (behavioralAnswers.length > 0) {
      const baPrompt = `You are a senior technical interviewer evaluating behavioral interview answers.
Evaluate each answer on: relevance (0-25), depth (0-25), communication (0-25), examples (0-25).
Return JSON:
{
  "overallScore": N,
  "perQuestion": [
    { "question": "...", "answer": "...", "relevance": N, "depth": N, "communication": N, "examples": N, "total": N, "feedback": "..." }
  ],
  "summary": "2-3 sentence overall assessment of behavioral performance"
}`;
      const baContent = behavioralAnswers.map((a, i) => `Q${i + 1}: ${a.question}\nAnswer: ${a.answer}`).join("\n\n");
      const baReply = await llm(baPrompt, [{ role: "user", content: baContent }], { maxTokens: 800 });
      try {
        behavioralEvaluation = JSON.parse(baReply);
      } catch {
        behavioralEvaluation = { raw: baReply, overallScore: 0 };
      }
    }

    await withTimeout(updateDoc(doc(db, "sessions", sid, "candidates", cdoc.id), {
      evaluation: evaluations,
      behavioralAnswers,
      ...(behavioralEvaluation ? { behavioralEvaluation } : {}),
    }));

    candidates.push({
      id: cdoc.id,
      displayName: data.displayName,
      joinedAt: data.joinedAt,
      submissions,
      behavioralResponses,
      evaluation: evaluations,
      behavioralAnswers,
      behavioralEvaluation,
    });
  }

  // Build the comprehensive report via LLM
  const reportPrompt = `You are a senior technical interviewer writing a comprehensive post-interview report.

Session: "${session.title}"
Programming Language: ${reportLangLabel}
Session Format: ${session.sessionFormat || "coding_only"}
Number of candidates: ${candidates.length}
Questions: ${(session.questionIds || []).map((qid) => {
    const q = questionBank.find((x) => x.id === qid);
    return q?.title || qid;
  }).join(", ")}

For each candidate you have their ${reportLangLabel} code submissions, per-question evaluation scores, and possibly behavioral interview responses captured during the live interview.
Use behavioral responses, when present, to assess communication, ownership, clarity, and examples from past experience.
If this session is behavioral-only or a candidate has no code submissions, evaluate them from the behavioral evidence that is available rather than treating missing code as a failure.
Evaluate their use of ${reportLangLabel}-specific features, idioms, and best practices when code exists.

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
      "leaderboardReason": "1-2 sentences explaining why this candidate earned this rank relative to the others.",
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
  "leaderboardSummary": "If there are multiple candidates, explain how the leaderboard order was decided and what separated the top performers. If there is only one candidate, summarize their standing in 2-4 sentences.",
  "comparativeAnalysis": "A 3-5 sentence paragraph comparing all candidates, highlighting who performed best and why.",
  "bestApproach": "Which candidate(s) had the most elegant solution and why.",
  "hiringRecommendation": "A clear 2-3 sentence final recommendation for the interviewer about which candidates to advance."
}

Sort rankings by overallScore descending. Be thorough and specific in feedback.`;

  const candidateData = candidates.map((c) => ({
    id: c.id,
    name: c.displayName,
    evaluation: c.evaluation,
    behavioralEvaluation: c.behavioralEvaluation || null,
    behavioralResponses: (c.behavioralResponses || []).map((a, index) => ({
      questionIndex: a.questionIndex ?? index,
      question: a.question,
      category: a.category || "",
      answer: (a.answer || "").slice(0, 500),
    })),
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

  const asList = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => (item == null ? "" : String(item).trim()))
        .filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) return [value.trim()];
    return [];
  };
  const toScore = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(100, Math.round(num)));
  };
  const candidateLookup = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const candidateNameLookup = new Map(candidates.map((candidate) => [candidate.id, candidate.displayName || candidate.id]));
  const rawRankings = Array.isArray(report.rankings) ? report.rankings : [];
  const sortedRankings = [...rawRankings].sort((a, b) => toScore(b?.overallScore) - toScore(a?.overallScore));

  report.rankings = sortedRankings.map((ranking, index) => {
    const candidateId = ranking?.candidateId || candidates[index]?.id || `candidate-${index + 1}`;
    const candidate = candidateLookup.get(candidateId);
    const strengths = asList(ranking?.strengths);
    const weaknesses = asList(ranking?.weaknesses);
    const fallbackReasonParts = [];
    if (strengths.length > 0) fallbackReasonParts.push(`Strengths: ${strengths.slice(0, 2).join("; ")}`);
    if (weaknesses.length > 0) fallbackReasonParts.push(`Risks: ${weaknesses.slice(0, 2).join("; ")}`);

    return {
      rank: index + 1,
      candidateId,
      displayName: ranking?.displayName || candidateNameLookup.get(candidateId) || candidateId,
      overallScore: toScore(ranking?.overallScore),
      recommendation: ranking?.recommendation || "Lean No Hire",
      leaderboardReason: (
        ranking?.leaderboardReason ||
        ranking?.rankingReason ||
        ranking?.whyThisRank ||
        fallbackReasonParts.join(". ")
      ) || "This ranking was inferred from the overall interview evidence available.",
      strengths,
      weaknesses,
      perQuestion: Array.isArray(ranking?.perQuestion)
        ? ranking.perQuestion.map((item, itemIndex) => ({
          questionId: item?.questionId || `question-${itemIndex + 1}`,
          questionTitle: item?.questionTitle || item?.question || item?.questionId || `Question ${itemIndex + 1}`,
          correctness: Math.max(0, Math.min(40, Math.round(Number(item?.correctness) || 0))),
          efficiency: Math.max(0, Math.min(25, Math.round(Number(item?.efficiency) || 0))),
          codeQuality: Math.max(0, Math.min(20, Math.round(Number(item?.codeQuality) || 0))),
          communication: Math.max(0, Math.min(15, Math.round(Number(item?.communication) || 0))),
          total: toScore(item?.total),
          feedback: item?.feedback || "",
        }))
        : [],
      behavioralSummary: ranking?.behavioralSummary || candidate?.behavioralEvaluation?.summary || "",
    };
  });

  report.leaderboardSummary = report.leaderboardSummary
    || report.comparativeAnalysis
    || (
      report.rankings.length > 1
        ? `The leaderboard was determined by overall interview performance across coding quality, communication, and behavioral evidence. ${report.rankings[0]?.displayName || "The top candidate"} placed first based on the strongest combination of strengths and recommendation.`
        : `Only one candidate completed this session. ${report.rankings[0]?.displayName || "The candidate"} was assessed from the available coding and behavioral evidence.`
    );
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
      ${r.leaderboardReason ? `
      <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;">
        ${r.leaderboardReason}
      </p>` : ""}
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

    <h2 style="font-size:18px;color:#1e293b;margin-bottom:12px;">${rankings.length > 1 ? "AI Leaderboard" : "Candidate Summary"}</h2>
    ${report.leaderboardSummary ? `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin-bottom:16px;">
      <h2 style="margin:0 0 8px;font-size:16px;color:#9a3412;">Leaderboard Decision</h2>
      <p style="margin:0;font-size:14px;color:#7c2d12;line-height:1.6;">${report.leaderboardSummary}</p>
    </div>` : ""}
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

// Leaderboard — AI-ranked candidates with reasoning (for multi-candidate sessions)


// Generate leaderboard with AI reasoning (for multi-candidate sessions)
app.post("/api/sessions/:sid/leaderboard/generate", async (req, res) => {
  const { sid } = req.params;
  try {
    const sessionSnap = await withTimeout(getDoc(doc(db, "sessions", sid)));
    if (!sessionSnap.exists()) return res.status(404).send("Session not found.");
    const session = sessionSnap.data();

    const lbLang = session.settings?.language || "javascript";
    const lbLangNames = { javascript: "JavaScript", python: "Python", java: "Java", cpp: "C++" };
    const lbLangLabel = lbLangNames[lbLang] || "JavaScript";

    const candSnap = await withTimeout(getDocs(collection(db, "sessions", sid, "candidates")));
    if (candSnap.size < 2) {
      return res.status(400).json({ error: "Leaderboard requires at least 2 candidates." });
    }

    const candidates = [];
    for (const cdoc of candSnap.docs) {
      const data = cdoc.data();
      const subSnap = await withTimeout(getDocs(collection(db, "sessions", sid, "candidates", cdoc.id, "submissions")));
      const submissions = {};
      subSnap.forEach((s) => { submissions[s.id] = s.data(); });
      candidates.push({
        id: cdoc.id,
        displayName: data.displayName,
        evaluation: data.evaluation || null,
        behavioralEvaluation: data.behavioralEvaluation || null,
        submissions,
      });
    }

    const leaderboardPrompt = `You are a senior technical interviewer creating a detailed leaderboard for a ${lbLangLabel} coding interview session.

Session: "${session.title}"
Number of candidates: ${candidates.length}
Questions: ${(session.questionIds || []).map((qid) => {
      const q = questionBank.find((x) => x.id === qid);
      return q?.title || qid;
    }).join(", ")}

For each candidate, provide a DETAILED ranking with clear reasoning for their position.
The leaderboard must explain WHY each candidate is ranked where they are — be specific about code quality, approach, efficiency, and problem-solving skills.

Return a JSON object with this EXACT structure (no markdown, no code fences):
{
  "leaderboard": [
    {
      "rank": 1,
      "candidateId": "...",
      "displayName": "...",
      "overallScore": N,
      "recommendation": "Strong Hire|Hire|Lean Hire|Lean No Hire|No Hire",
      "rankReason": "2-3 sentence specific explanation of why this candidate is ranked at this position, referencing their actual code and approach",
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "codeHighlights": "Brief note about their most impressive code decision or biggest code issue",
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
  "rankingRationale": "A detailed 3-5 sentence paragraph explaining the overall ranking methodology and key differentiators between candidates. Be specific about what separated the top performers from the rest.",
  "comparativeAnalysis": "A 3-5 sentence paragraph comparing all candidates head-to-head.",
  "bestApproach": "Which candidate had the most elegant solution and why.",
  "hiringRecommendation": "Clear 2-3 sentence final recommendation."
}

Sort by overallScore descending. Be thorough, fair, and specific in your reasoning.`;

    const candidateData = candidates.map((c) => ({
      id: c.id,
      name: c.displayName,
      evaluation: c.evaluation,
      behavioralEvaluation: c.behavioralEvaluation,
      codeSnippets: Object.fromEntries(
        Object.entries(c.submissions).map(([qid, s]) => [qid, (s.code || "").slice(0, 1200)])
      ),
    }));

    const reply = await llm(leaderboardPrompt, [{ role: "user", content: JSON.stringify(candidateData) }], {
      maxTokens: 3000,
      temperature: 0.2,
    });

    let leaderboardData;
    try {
      leaderboardData = JSON.parse(reply);
    } catch {
      leaderboardData = { raw: reply };
    }

    leaderboardData.generatedAt = new Date().toISOString();
    leaderboardData.sessionId = sid;
    leaderboardData.sessionTitle = session.title;

    // Persist leaderboard
    await withTimeout(setDoc(doc(db, "leaderboards", sid), leaderboardData));

    res.json(leaderboardData);
  } catch (e) {
    console.error("POST leaderboard/generate error:", e);
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
      .then(async ({ report, session, candidates }) => {
        console.log(`Report auto-generated for session ${sid}`);

        // Auto-generate leaderboard if multiple candidates
        if (candidates.length >= 2) {
          try {
            const lbLang = session.settings?.language || "javascript";
            const lbLangNames = { javascript: "JavaScript", python: "Python", java: "Java", cpp: "C++" };
            const lbLangLabel = lbLangNames[lbLang] || "JavaScript";

            const leaderboardPrompt = `You are a senior technical interviewer creating a detailed leaderboard for a ${lbLangLabel} coding interview session.

Session: "${session.title}"
Number of candidates: ${candidates.length}

For each candidate, provide a DETAILED ranking with clear reasoning for their position.
Return a JSON object:
{
  "leaderboard": [
    {
      "rank": N,
      "candidateId": "...",
      "displayName": "...",
      "overallScore": N,
      "recommendation": "Strong Hire|Hire|Lean Hire|Lean No Hire|No Hire",
      "rankReason": "2-3 sentence specific explanation of why this candidate is ranked at this position",
      "strengths": ["..."],
      "weaknesses": ["..."],
      "codeHighlights": "Brief note about their most impressive code decision or biggest code issue"
    }
  ],
  "rankingRationale": "3-5 sentence paragraph explaining the ranking methodology and key differentiators.",
  "comparativeAnalysis": "3-5 sentence head-to-head comparison.",
  "bestApproach": "Which candidate had the most elegant solution and why.",
  "hiringRecommendation": "Clear 2-3 sentence final recommendation."
}
Sort by overallScore descending.`;

            const candidateData = candidates.map((c) => ({
              id: c.id,
              name: c.displayName,
              evaluation: c.evaluation,
              codeSnippets: Object.fromEntries(
                Object.entries(c.submissions).map(([qid, s]) => [qid, (s.code || "").slice(0, 1200)])
              ),
            }));

            const lbReply = await llm(leaderboardPrompt, [{ role: "user", content: JSON.stringify(candidateData) }], {
              maxTokens: 3000,
              temperature: 0.2,
            });

            let leaderboardData;
            try { leaderboardData = JSON.parse(lbReply); } catch { leaderboardData = { raw: lbReply }; }
            leaderboardData.generatedAt = new Date().toISOString();
            leaderboardData.sessionId = sid;
            leaderboardData.sessionTitle = session.title;

            await setDoc(doc(db, "leaderboards", sid), leaderboardData).catch(() => {});
            console.log(`Leaderboard auto-generated for session ${sid} with ${candidates.length} candidates`);
          } catch (lbErr) {
            console.error(`Auto-leaderboard failed for ${sid}:`, lbErr.message);
          }
        }

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
//  SAVED CODE (persist user progress per problem)
// ═══════════════════════════════════════════════════════════════════

app.post("/api/saved-code", async (req, res) => {
  const { userId, problemId, code, language } = req.body || {};
  if (!userId || !problemId) return res.status(400).send("userId and problemId required.");

  try {
    const docId = `${userId}_${problemId}`;
    await withTimeout(setDoc(doc(db, "savedCode", docId), {
      userId,
      problemId,
      code: code ?? "",
      language: language || "javascript",
      savedAt: new Date().toISOString(),
    }));
    res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (e) {
    console.error("POST /api/saved-code error:", e);
    res.status(500).send(e.message);
  }
});

app.get("/api/saved-code/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const q = query(collection(db, "savedCode"), where("userId", "==", userId));
    const snap = await withTimeout(getDocs(q));
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
    res.json(items);
  } catch (e) {
    console.error("GET /api/saved-code/:userId error:", e);
    res.status(500).send(e.message);
  }
});

app.get("/api/saved-code/:userId/:problemId", async (req, res) => {
  const { userId, problemId } = req.params;
  try {
    const docId = `${userId}_${problemId}`;
    const snap = await withTimeout(getDoc(doc(db, "savedCode", docId)));
    if (!snap.exists()) return res.json({ code: null, savedAt: null });
    res.json(snap.data());
  } catch (e) {
    console.error("GET /api/saved-code error:", e);
    res.status(500).send(e.message);
  }
});

app.delete("/api/saved-code/:userId/:problemId", async (req, res) => {
  const { userId, problemId } = req.params;
  try {
    const docId = `${userId}_${problemId}`;
    await withTimeout(deleteDoc(doc(db, "savedCode", docId)));
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/saved-code error:", e);
    res.status(500).send(e.message);
  }
});

// ═══════════════════════════════════════════════════════════════════
//  INLINE CODE HINTS (IDE-style real-time analysis)
// ═══════════════════════════════════════════════════════════════════

app.post("/api/code-hints", async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(500).send("Missing OPENAI_API_KEY on the server.");

  const { code, problemTitle, problemDescription, starterCode, practiceMode = false, language = "javascript" } = req.body || {};
  if (!code || typeof code !== "string") return res.status(400).send("code required.");

  const langNames = { javascript: "JavaScript", python: "Python", java: "Java", cpp: "C++" };
  const langLabel = langNames[language] || "JavaScript";

  const tone = practiceMode
    ? `You are a friendly ${langLabel} coding tutor. Be encouraging but point out issues clearly.`
    : `You are a senior technical interviewer evaluating ${langLabel} code. Only flag significant issues — wrong algorithm choice, critical bugs, or fundamentally flawed approaches. Ignore minor style issues or small inefficiencies.`;

  const systemPrompt = `${tone}
Analyze the following ${langLabel} code for a problem titled "${problemTitle || "coding challenge"}".
${problemDescription ? `Problem: ${problemDescription}\n` : ""}
Return a JSON object with this EXACT structure (no markdown, no code fences):
{
  "hasIssue": true/false,
  "hints": [
    {
      "lineNumber": <number>,
      "endLineNumber": <number>,
      "severity": "error" | "warning" | "info",
      "shortMessage": "<6-10 word summary for inline display>",
      "message": "<1-2 sentence explanation>"
    }
  ]
}

Rules:
- Only return hints for genuine issues (wrong approach, bugs, inefficiency, edge case misses)
- Maximum 2 hints at a time — focus on the most important issues
- lineNumber must reference actual lines in the code (1-based)
- If the code looks good or is just starter code, return {"hasIssue": false, "hints": []}
- shortMessage appears inline in the editor gutter, so keep it very concise
- DO NOT mention trivial style issues — focus on logic, correctness, and algorithm choice
- Return ONLY valid JSON, no explanation text around it`;

  try {
    const reply = await llm(systemPrompt, [{ role: "user", content: code }], {
      maxTokens: 400,
      temperature: 0.2,
    });

    let parsed;
    try {
      const cleaned = reply.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.json({ hasIssue: false, hints: [] });
    }

    if (!parsed.hasIssue || !Array.isArray(parsed.hints)) {
      return res.json({ hasIssue: false, hints: [] });
    }

    const totalLines = code.split("\n").length;
    const validHints = parsed.hints
      .filter(h => h.lineNumber >= 1 && h.lineNumber <= totalLines && h.message)
      .slice(0, 2)
      .map(h => ({
        lineNumber: h.lineNumber,
        endLineNumber: Math.min(h.endLineNumber || h.lineNumber, totalLines),
        severity: ["error", "warning", "info"].includes(h.severity) ? h.severity : "info",
        shortMessage: (h.shortMessage || h.message.slice(0, 40)).slice(0, 60),
        message: h.message.slice(0, 200),
      }));

    return res.json({ hasIssue: validHints.length > 0, hints: validHints });
  } catch (error) {
    console.error("POST /api/code-hints error:", error);
    return res.status(500).send(error.message || "Hint analysis failed.");
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

// ═══════════════════════════════════════════════════════════════════
//  ADAPTIVE LEARNING — AI QUESTION GENERATION
// ═══════════════════════════════════════════════════════════════════

app.post("/api/generate-question", async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(500).send("Missing OPENAI_API_KEY on the server.");

  const {
    skillId,
    targetDifficulty = "Medium",
    userRating = 1200,
    completedProblemTitles = [],
    language = "javascript",
  } = req.body || {};

  if (!skillId) return res.status(400).send("skillId required.");

  const langNames = { javascript: "JavaScript", python: "Python", java: "Java", cpp: "C++" };
  const langLabel = langNames[language] || "JavaScript";

  const categoryNames = {
    "arrays-hashing": "Arrays & Hashing",
    "two-pointers": "Two Pointers",
    "sliding-window": "Sliding Window",
    "stack": "Stack",
    "binary-search": "Binary Search",
    "linked-lists": "Linked Lists",
    "trees": "Trees",
    "graphs": "Graphs",
    "dynamic-programming": "Dynamic Programming",
    "backtracking": "Backtracking",
    "greedy": "Greedy Algorithms",
    "heap": "Heap / Priority Queue",
  };

  const categoryName = categoryNames[skillId] || skillId;
  const avoidList = completedProblemTitles.slice(0, 30).join(", ");

  const systemPrompt = `You are an expert coding problem designer. Generate a NOVEL ${langLabel} coding interview problem.

REQUIREMENTS:
- Category: ${categoryName}
- Difficulty: ${targetDifficulty}
- User skill rating: ${userRating}/2000 (Elo-like scale; 1000=beginner, 1400=intermediate, 1800=advanced)
- Language: ${langLabel}
- The problem MUST be DIFFERENT from these already-solved problems: ${avoidList || "none"}
- Create something fresh — don't just rename existing LeetCode problems. Combine concepts, use real-world scenarios, or add twists.
- For ${targetDifficulty === "Hard" ? "Hard" : targetDifficulty === "Easy" ? "Easy" : "Medium"} difficulty, calibrate complexity appropriately.

Return a JSON object with this EXACT structure (no markdown, no code fences):
{
  "id": "generated-<unique-slug>",
  "title": "<descriptive title>",
  "difficulty": "${targetDifficulty}",
  "category": "${categoryName}",
  "description": "<clear problem statement with examples, using markdown>",
  "starterCode": "<${langLabel} function signature with placeholder>",
  "testCases": [
    { "input": { <param>: <value> }, "expected": <value> },
    { "input": { <param>: <value> }, "expected": <value> },
    { "input": { <param>: <value> }, "expected": <value> }
  ],
  "hints": ["<hint1>", "<hint2>"],
  "solution": "<complete working ${langLabel} solution>",
  "optimalComplexity": "<e.g. O(n)>",
  "isGenerated": true,
  "generatedAt": "<ISO timestamp>"
}

CRITICAL:
- testCases must have at least 3 entries with valid, correct expected values
- starterCode must be valid ${langLabel}
- solution must actually solve the problem correctly
- Return ONLY valid JSON`;

  try {
    const reply = await llm(
      systemPrompt,
      [{ role: "user", content: `Generate a ${targetDifficulty} ${categoryName} problem for a user with rating ${userRating}.` }],
      { maxTokens: 2000, temperature: 0.8 }
    );

    let question;
    try {
      const cleaned = reply.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      question = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Failed to parse generated question", raw: reply });
    }

    // Validate and sanitize
    if (!question.id) question.id = "generated-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (!question.title) return res.status(500).json({ error: "Generated question missing title" });
    question.isGenerated = true;
    question.generatedAt = question.generatedAt || new Date().toISOString();
    question.difficulty = targetDifficulty;
    question.category = categoryName;

    // Persist to Firestore for reuse
    try {
      await withTimeout(setDoc(doc(db, "generatedQuestions", question.id), {
        ...question,
        skillId,
        userRating,
        language,
      }));
    } catch { /* non-critical — question still returned to client */ }

    res.json(question);
  } catch (e) {
    console.error("POST /api/generate-question error:", e);
    res.status(500).send(e.message || "Question generation failed.");
  }
});

// ═══════════════════════════════════════════════════════════════════
//  ADAPTIVE LEARNING — SKILL ANALYSIS
// ═══════════════════════════════════════════════════════════════════

app.post("/api/analyze-skills", async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(500).send("Missing OPENAI_API_KEY on the server.");

  const { ratings = {}, attemptHistory = [], categorySuccessRate = {} } = req.body || {};

  const systemPrompt = `You are a coding interview coach analyzing a student's performance data.

Given their Elo-like skill ratings (1000=beginner, 1400=mid, 1800=advanced) and recent attempt history,
provide actionable learning insights.

Return JSON (no markdown, no code fences):
{
  "weakestAreas": [{ "skillId": "...", "reason": "..." }],
  "strongestAreas": [{ "skillId": "...", "reason": "..." }],
  "nextSteps": ["<action1>", "<action2>", "<action3>"],
  "overallAssessment": "<1-2 sentence summary>",
  "suggestedFocus": "<skillId to focus on next>",
  "estimatedReadiness": "<beginner|intermediate|interview-ready|advanced>"
}`;

  const recentAttempts = (attemptHistory || []).slice(0, 20).map((a) => ({
    category: a.category,
    difficulty: a.difficulty,
    score: a.score,
    hintsUsed: a.hintsUsed,
  }));

  try {
    const reply = await llm(
      systemPrompt,
      [{ role: "user", content: JSON.stringify({ ratings, recentAttempts, categorySuccessRate }) }],
      { maxTokens: 600, temperature: 0.3 }
    );

    let analysis;
    try {
      const cleaned = reply.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { raw: reply };
    }

    res.json(analysis);
  } catch (e) {
    console.error("POST /api/analyze-skills error:", e);
    res.status(500).send(e.message || "Skill analysis failed.");
  }
});

// ═══════════════════════════════════════════════════════════════════
//  CANDIDATE ANALYSIS — AI-powered session format recommendation
// ═══════════════════════════════════════════════════════════════════

app.post("/api/analyze-candidate", upload.single("resume"), async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(500).send("Missing OPENAI_API_KEY on the server.");

  let candidateInfo = req.body.candidateInfo || "";
  let resumeText = "";

  // Extract text from uploaded PDF if present
  if (req.file) {
    try {
      const pdfData = await pdfParse(req.file.buffer);
      resumeText = pdfData.text || "";
    } catch (e) {
      console.error("PDF parse error:", e.message);
      return res.status(400).json({ error: "Could not parse the uploaded PDF. Please try pasting the resume text instead." });
    }
  }

  const profileText = [candidateInfo, resumeText].filter(Boolean).join("\n\n");
  if (!profileText.trim()) {
    return res.status(400).send("Provide candidateInfo text or upload a resume file.");
  }

  const systemPrompt = `You are a senior technical hiring manager. Analyze the candidate profile below and recommend an interview format.

Based on the candidate's experience level, tech stack, and role:
- Recommend "mock_interview" (behavioral-only AI interview) for junior candidates, career changers, or roles emphasizing soft skills and culture fit.
- Recommend "coding_only" for senior/staff engineers with proven track records where technical depth is the primary concern.
- Recommend "both" (mock behavioral interview followed by coding session) for mid-level candidates, full-stack roles, or when the profile suggests both behavioral and technical assessment are valuable.

Return a JSON object with this EXACT structure (no markdown, no code fences):
{
  "recommendedFormat": "mock_interview" | "coding_only" | "both",
  "reasoning": "<2-3 sentence explanation of why this format was chosen>",
  "candidateSummary": {
    "name": "<extracted or inferred name>",
    "experienceLevel": "junior" | "mid" | "senior" | "staff",
    "primaryTechStack": ["<tech1>", "<tech2>"],
    "yearsOfExperience": <number or null>
  },
  "suggestedBehavioralQuestions": [
    {
      "question": "<tailored behavioral question>",
      "category": "Introduction" | "Problem Solving" | "Teamwork" | "Leadership" | "Growth" | "Work Style" | "Career",
      "rationale": "<why this question is relevant for this candidate>"
    }
  ],
  "suggestedCodingConfig": {
    "difficulty": "Easy" | "Medium" | "Hard",
    "categories": ["<relevant problem category>"],
    "problemCount": <1-3>,
    "focusAreas": ["<specific skill to test>"]
  }
}

Rules:
- Generate 3-5 behavioral questions tailored to the candidate's specific background and experience
- Coding difficulty should match the candidate's experience level
- Categories should align with the tech stack mentioned
- If the profile is sparse, default to "both" with Medium difficulty
- Return ONLY valid JSON`;

  try {
    const reply = await llm(
      systemPrompt,
      [{ role: "user", content: `Candidate Profile:\n${profileText}` }],
      { maxTokens: 1200, temperature: 0.4 }
    );

    let parsed;
    try {
      const cleaned = reply.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Failed to parse AI recommendation", raw: reply });
    }

    if (!parsed.recommendedFormat) {
      parsed.recommendedFormat = "both";
    }
    if (!Array.isArray(parsed.suggestedBehavioralQuestions)) {
      parsed.suggestedBehavioralQuestions = [];
    }
    if (!parsed.suggestedCodingConfig) {
      parsed.suggestedCodingConfig = { difficulty: "Medium", categories: [], problemCount: 2, focusAreas: [] };
    }

    res.json(parsed);
  } catch (e) {
    console.error("POST /api/analyze-candidate error:", e);
    res.status(500).send(e.message || "Candidate analysis failed.");
  }
});

// ═══════════════════════════════════════════════════════════════════
//  INTERVIEW RECORDING UPLOAD
// ═══════════════════════════════════════════════════════════════════

app.post("/api/sessions/:sid/recording", videoUpload.single("recording"), async (req, res) => {
  const { sid } = req.params;
  const { candidateId } = req.body || {};

  if (!req.file) return res.status(400).send("No recording file uploaded.");
  if (!candidateId) return res.status(400).send("candidateId required.");

  try {
    const timestamp = Date.now();
    const filePath = `recordings/${sid}/${candidateId}/${timestamp}.webm`;
    const fileRef = storageRef(storage, filePath);

    await uploadBytes(fileRef, req.file.buffer, {
      contentType: req.file.mimetype || "video/webm",
    });

    const downloadURL = await getDownloadURL(fileRef);

    // Store the recording URL on the candidate's document
    const candidateRef = doc(db, "sessions", sid, "candidates", candidateId);
    await withTimeout(updateDoc(candidateRef, {
      recordingUrl: downloadURL,
      recordingPath: filePath,
      recordingUploadedAt: new Date().toISOString(),
    }));

    console.log(`Recording uploaded for session ${sid}, candidate ${candidateId}`);
    res.json({ ok: true, recordingUrl: downloadURL });
  } catch (e) {
    console.error("POST recording upload error:", e);
    res.status(500).send(e.message || "Recording upload failed.");
  }
});

// ═══════════════════════════════════════════════════════════════════
//  TEXT-TO-SPEECH (OpenAI TTS — returns audio for behavioral questions)
// ═══════════════════════════════════════════════════════════════════

app.post("/api/tts", async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(500).send("Missing OPENAI_API_KEY on the server.");

  const { text, voice = "alloy", speed = 1.0 } = req.body || {};
  if (!text || typeof text !== "string") return res.status(400).send("text required.");

  try {
    const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text.slice(0, 4096),
        voice,
        speed,
        response_format: "mp3",
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error("TTS API error:", errText);
      return res.status(502).send("TTS generation failed.");
    }

    res.set({
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=3600",
    });

    const arrayBuffer = await ttsRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (e) {
    console.error("POST /api/tts error:", e);
    res.status(500).send(e.message || "TTS failed.");
  }
});

// ═══════════════════════════════════════════════════════════════════
//  BEHAVIORAL ANSWERS STORAGE (persists candidate spoken answers)
// ═══════════════════════════════════════════════════════════════════

app.post("/api/sessions/:sid/candidates/:cid/behavioral-answers", async (req, res) => {
  const { sid, cid } = req.params;
  const { answers } = req.body || {};
  if (!Array.isArray(answers)) return res.status(400).send("answers must be an array.");

  try {
    const ref = doc(db, "sessions", sid, "candidates", cid);
    await withTimeout(updateDoc(ref, { behavioralAnswers: answers, behavioralCompletedAt: new Date().toISOString() }));
    res.json({ ok: true });
  } catch (e) {
    console.error("POST behavioral-answers error:", e);
    res.status(500).send(e.message);
  }
});

app.get("/api/sessions/:sid/candidates/:cid/behavioral-answers", async (req, res) => {
  const { sid, cid } = req.params;
  try {
    const ref = doc(db, "sessions", sid, "candidates", cid);
    const snap = await withTimeout(getDoc(ref));
    if (!snap.exists()) return res.json({ answers: [] });
    const data = snap.data();
    res.json({ answers: data.behavioralAnswers || [] });
  } catch (e) {
    console.error("GET behavioral-answers error:", e);
    res.status(500).send(e.message);
  }
});
// ═══════════════════════════════════════════════════════════════════
//  GENERATE MOCK INTERVIEW — AI-powered interview from CV / details
// ═══════════════════════════════════════════════════════════════════

app.post("/api/generate-mock-interview", upload.single("resume"), async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(500).send("Missing OPENAI_API_KEY on the server.");

  let candidateInfo = req.body.candidateInfo || "";
  let targetRole = req.body.targetRole || "";
  let experienceLevel = req.body.experienceLevel || "";
  let focusAreas = req.body.focusAreas || "";
  let resumeText = "";

  if (req.file) {
    try {
      const pdfData = await pdfParse(req.file.buffer);
      resumeText = pdfData.text || "";
    } catch (e) {
      console.error("PDF parse error:", e.message);
      return res.status(400).json({ error: "Could not parse the uploaded PDF. Please try pasting your info instead." });
    }
  }

  const profileText = [candidateInfo, resumeText].filter(Boolean).join("\n\n");
  if (!profileText.trim() && !targetRole.trim()) {
    return res.status(400).send("Provide some information about yourself — paste details, upload a resume, or at least specify a target role.");
  }

  const systemPrompt = `You are a senior technical interviewer who creates personalized mock interview plans. Based on the candidate's profile, generate a complete mock interview configuration.

Candidate context:
- Target role: ${targetRole || "Software Engineer (general)"}
- Experience level: ${experienceLevel || "Not specified"}
- Focus areas: ${focusAreas || "General"}

Generate a tailored mock interview plan. Return a JSON object with this EXACT structure (no markdown, no code fences):
{
  "candidateSummary": {
    "name": "<extracted or 'Candidate'>",
    "experienceLevel": "junior" | "mid" | "senior" | "staff",
    "primaryTechStack": ["<tech1>", "<tech2>"],
    "targetRole": "<role title>"
  },
  "interviewPlan": {
    "title": "<descriptive interview title, e.g. 'Senior Frontend Engineer Mock Interview'>",
    "totalTimeMinutes": <30-90>,
    "difficulty": "Easy" | "Medium" | "Hard",
    "behavioralQuestions": [
      {
        "id": "custom-bq-<n>",
        "category": "Introduction" | "Problem Solving" | "Teamwork" | "Leadership" | "Growth" | "Work Style" | "Career",
        "question": "<tailored behavioral question>",
        "followUps": ["<follow-up 1>", "<follow-up 2>"],
        "tips": "<advice for answering>"
      }
    ],
    "codingConfig": {
      "problemCount": <1-3>,
      "difficulty": "Easy" | "Medium" | "Hard",
      "categories": ["<relevant category>"],
      "focusAreas": ["<specific skill to test>"]
    },
    "includeSystemDesign": <true if senior/staff, false otherwise>,
    "interviewerPersona": "friendly" | "neutral" | "strict"
  },
  "reasoning": "<2-3 sentences explaining why this plan was chosen>"
}

Rules:
- Generate 3-5 behavioral questions tailored to the candidate's background
- Behavioral questions should probe areas relevant to the target role
- Coding difficulty should match experience level
- Include system design only for senior+ candidates
- If profile is sparse, create a balanced general interview
- Return ONLY valid JSON`;

  try {
    const reply = await llm(
      systemPrompt,
      [{ role: "user", content: `Candidate Profile:\n${profileText || "(No detailed profile provided)"}\n\nTarget Role: ${targetRole}\nExperience Level: ${experienceLevel}\nFocus Areas: ${focusAreas}` }],
      { maxTokens: 1500, temperature: 0.5 }
    );

    let parsed;
    try {
      const cleaned = reply.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Failed to parse AI response", raw: reply });
    }

    if (!parsed.interviewPlan) {
      parsed.interviewPlan = {
        title: "General Mock Interview",
        totalTimeMinutes: 60,
        difficulty: "Medium",
        behavioralQuestions: [],
        codingConfig: { problemCount: 2, difficulty: "Medium", categories: [], focusAreas: [] },
        includeSystemDesign: false,
        interviewerPersona: "neutral"
      };
    }

    res.json(parsed);
  } catch (e) {
    console.error("POST /api/generate-mock-interview error:", e);
    res.status(500).send(e.message || "Failed to generate mock interview.");
  }
});

// ─── Start ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
