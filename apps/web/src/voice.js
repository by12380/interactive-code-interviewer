export function getSpeechRecognitionCtor() {
  return globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported() {
  return Boolean(getSpeechRecognitionCtor());
}

export function normalizeSpeechText(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function matchVoiceCommand(rawText) {
  const t0 = normalizeSpeechText(rawText);
  if (!t0) return null;

  // Allow common wake words/prefixes.
  const t = t0
    .replace(/^(command|computer|interviewer|hey)\s+/, "")
    .trim();

  // Run / tests
  if (/^(run|run code|execute|compile)$/.test(t)) return { type: "RUN_CODE" };
  if (/^(run tests|test|tests|run test)$/.test(t)) return { type: "RUN_TESTS" };

  // Navigation / session control
  if (/^(next|next problem|next question|skip)$/.test(t)) return { type: "NEXT" };
  if (/^(stop interview|end interview|stop)$/.test(t)) return { type: "STOP" };

  // Hints / coaching
  if (/^(give me a hint|hint|help|need a hint)$/.test(t)) return { type: "HINT" };
  if (/^(explain approach|explain the approach|explain solution|explain the solution)$/.test(t))
    return { type: "EXPLAIN_APPROACH" };

  // Pause / resume
  if (/^(pause|pause interview)$/.test(t)) return { type: "PAUSE" };
  if (/^(resume|resume interview|continue)$/.test(t)) return { type: "RESUME" };

  // Transcripts
  if (/^(clear transcript|clear transcripts)$/.test(t)) return { type: "CLEAR_TRANSCRIPT" };

  return null;
}

function replaceAllPhrases(text, rules) {
  let out = String(text || "");
  for (const [re, replacement] of rules) {
    out = out.replace(re, replacement);
  }
  return out;
}

/**
 * Best-effort conversion from spoken English into code-y text.
 * Intentionally simple + predictable; users can still refine with the keyboard.
 */
export function speechToCode(rawText) {
  let t = String(rawText || "");
  if (!t.trim()) return "";

  // Normalize common STT punctuation tokens.
  t = replaceAllPhrases(t, [
    [/\bnew line\b/gi, "\n"],
    [/\bnewline\b/gi, "\n"],
    [/\btab\b/gi, "\t"],

    [/\bopen paren(thesis)?\b/gi, "("],
    [/\bclose paren(thesis)?\b/gi, ")"],
    [/\bopen bracket\b/gi, "["],
    [/\bclose bracket\b/gi, "]"],
    [/\bopen brace\b/gi, "{"],
    [/\bclose brace\b/gi, "}"],

    [/\bsemicolon\b/gi, ";"],
    [/\bcomma\b/gi, ","],
    [/\bcolon\b/gi, ":"],
    [/\bdot\b/gi, "."],

    [/\btriple equals\b/gi, "==="],
    [/\bdouble equals\b/gi, "=="],
    [/\bstrict not equals\b/gi, "!=="],
    [/\bnot equals\b/gi, "!="],
    [/\bequals\b/gi, "="],

    [/\barrow\b/gi, "=>"],
    [/\band and\b/gi, "&&"],
    [/\bor or\b/gi, "||"],

    [/\bquote\b/gi, '"'],
    [/\bsingle quote\b/gi, "'"]
  ]);

  // Light cleanup: avoid spaces before punctuation we commonly insert.
  t = t.replace(/\s+([,;:.()\]})])/g, "$1");
  t = t.replace(/([( {[)\[])\s+/g, "$1");

  // If it looks like code already, keep it. Otherwise, add a trailing space
  // so dictation can feel "continuous" in the editor.
  if (!/[\n;{}()[\]=><]/.test(t) && !t.endsWith(" ")) {
    t += " ";
  }

  return t;
}

export function clampNumber(n, { min = -Infinity, max = Infinity, fallback = 0 } = {}) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

