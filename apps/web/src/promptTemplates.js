import { randomId } from "./storage.js";

export const PROMPT_TEMPLATE_CATEGORIES = ["explanation", "debugging", "optimization"];

export const BUILTIN_PROMPT_TEMPLATES = [
  {
    id: "builtin_explain_code",
    source: "builtin",
    title: "Explain this code",
    category: "explanation",
    body: [
      "Explain the following code in plain English.",
      "Include:",
      "- What it does at a high level",
      "- The algorithm/data structures used",
      "- Time and space complexity",
      "- Edge cases and likely pitfalls",
      "- One concrete improvement suggestion",
      "",
      "Problem: {{problemTitle}}",
      "Signature: {{problemSignature}}",
      "",
      "Code:",
      "{{code}}"
    ].join("\n")
  },
  {
    id: "builtin_find_bugs",
    source: "builtin",
    title: "Find bugs / edge cases",
    category: "debugging",
    body: [
      "Find bugs, logical errors, and missing edge cases in the code below.",
      "Be specific: point to the exact line/logic, explain why it's wrong, and propose a minimal fix.",
      "",
      "Problem: {{problemTitle}}",
      "Description: {{problemDescription}}",
      "",
      "Code:",
      "{{code}}"
    ].join("\n")
  },
  {
    id: "builtin_optimize",
    source: "builtin",
    title: "Optimize this solution",
    category: "optimization",
    body: [
      "Optimize the solution for time and/or space while preserving behavior.",
      "Explain the changes and resulting complexity.",
      "",
      "Problem: {{problemTitle}}",
      "Signature: {{problemSignature}}",
      "Difficulty: {{difficulty}}",
      "",
      "Current code:",
      "{{code}}"
    ].join("\n")
  }
];

export function normalizeCustomPromptTemplates(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((t) => normalizeCustomPromptTemplate(t))
    .filter(Boolean);
}

function normalizeCustomPromptTemplate(t) {
  if (!t || typeof t !== "object") return null;
  const id = String(t.id || "");
  const title = String(t.title || "").trim();
  const body = String(t.body || "");
  const category = String(t.category || "").trim() || "explanation";
  if (!id || !title || !body) return null;
  return {
    id,
    source: "custom",
    title,
    category,
    body,
    createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
    updatedAt: typeof t.updatedAt === "number" ? t.updatedAt : Date.now()
  };
}

export function createCustomPromptTemplate({ title, category, body }) {
  const now = Date.now();
  return {
    id: randomId("tmpl"),
    source: "custom",
    title: String(title || "").trim() || "Untitled template",
    category: String(category || "").trim() || "explanation",
    body: String(body || ""),
    createdAt: now,
    updatedAt: now
  };
}

const VAR_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export function extractTemplateVariables(text) {
  const s = String(text || "");
  const out = [];
  const seen = new Set();
  let m = null;
  while ((m = VAR_RE.exec(s))) {
    const key = String(m[1] || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function renderTemplate(text, vars) {
  const s = String(text || "");
  const v = vars && typeof vars === "object" ? vars : {};
  const missing = new Set();

  const rendered = s.replace(VAR_RE, (_match, keyRaw) => {
    const key = String(keyRaw || "").trim();
    if (!key) return "";
    const val = v[key];
    if (val == null || String(val).trim() === "") {
      missing.add(key);
      return "";
    }
    return String(val);
  });

  return { text: rendered, missing: Array.from(missing) };
}

