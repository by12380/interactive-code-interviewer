import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const SUPPORTED_LANGUAGES = ["python", "javascript", "java", "cpp"];

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
          "- Do NOT give a full solution or final code.",
          "- If no interruption is needed, output an empty string.",
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
    max_tokens: 300
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

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
