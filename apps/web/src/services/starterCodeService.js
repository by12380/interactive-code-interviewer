/**
 * Converts JavaScript starter code from the question bank into the
 * equivalent skeleton for Python, Java, or C++.  Handles both
 * `function name(params) { ... }` and simple `class Name { ... }` shapes.
 *
 * Falls back to a generic comment + placeholder if parsing fails.
 */

const COMMENT = {
  javascript: "//",
  python: "#",
  java: "//",
  cpp: "//",
};

// ── Single-function converter ────────────────────────────────────────

function convertFunction(name, params, language) {
  const paramList = params
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  switch (language) {
    case "python":
      return `def ${name}(${paramList.join(", ")}):\n    # Your solution here\n    pass`;

    case "java": {
      const javaParams = paramList.map((p) => `Object ${p}`).join(", ");
      return `public Object ${name}(${javaParams}) {\n    // Your solution here\n    return null;\n}`;
    }

    case "cpp": {
      const cppParams = paramList.map((p) => `auto ${p}`).join(", ");
      return `auto ${name}(${cppParams}) {\n    // Your solution here\n}`;
    }

    default:
      return `function ${name}(${paramList.join(", ")}) {\n  // Your solution here\n}`;
  }
}

// ── Class converter (MinStack-style) ─────────────────────────────────

function convertClass(className, methods, language) {
  switch (language) {
    case "python": {
      let out = `class ${className}:\n    def __init__(self):\n        # Your solution here\n        pass\n`;
      for (const m of methods) {
        const pyParams = m.params ? `self, ${m.params}` : "self";
        out += `\n    def ${m.name}(${pyParams}):\n        pass\n`;
      }
      return out;
    }

    case "java": {
      let out = `class ${className} {\n    public ${className}() {\n        // Your solution here\n    }\n`;
      for (const m of methods) {
        const javaParams = m.params
          ? m.params.split(",").map((p) => `int ${p.trim()}`).join(", ")
          : "";
        out += `\n    public void ${m.name}(${javaParams}) {\n        // Your solution here\n    }\n`;
      }
      out += "}";
      return out;
    }

    case "cpp": {
      let out = `class ${className} {\npublic:\n    ${className}() {\n        // Your solution here\n    }\n`;
      for (const m of methods) {
        const cppParams = m.params
          ? m.params.split(",").map((p) => `int ${p.trim()}`).join(", ")
          : "";
        out += `\n    void ${m.name}(${cppParams}) {\n        // Your solution here\n    }\n`;
      }
      out += "};";
      return out;
    }

    default:
      return null;
  }
}

// ── Main entry point ─────────────────────────────────────────────────

const FUNC_RE = /function\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
const CLASS_RE = /class\s+(\w+)\s*\{/;
const METHOD_RE = /(\w+)\s*\(([^)]*)\)\s*\{/g;

export function convertStarterCode(jsCode, language) {
  if (!jsCode || language === "javascript") return jsCode;

  const comment = COMMENT[language] || "//";

  // Try class pattern first
  const classMatch = jsCode.match(CLASS_RE);
  if (classMatch) {
    const className = classMatch[1];
    const methods = [];
    const bodyStart = jsCode.indexOf("{", classMatch.index) + 1;
    const body = jsCode.slice(bodyStart);

    let m;
    const methodRe = /(\w+)\s*\(([^)]*)\)\s*\{/g;
    while ((m = methodRe.exec(body)) !== null) {
      if (m[1] === "constructor") continue;
      methods.push({ name: m[1], params: m[2].trim() });
    }

    const result = convertClass(className, methods, language);
    if (result) return result;
  }

  // Try function pattern(s) — starter code can have multiple functions
  const functions = [];
  let fm;
  const funcRe = /function\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  while ((fm = funcRe.exec(jsCode)) !== null) {
    functions.push({ name: fm[1], params: fm[2].trim() });
  }

  if (functions.length > 0) {
    return functions
      .map((f) => convertFunction(f.name, f.params, language))
      .join("\n\n");
  }

  // Fallback: generic placeholder
  return `${comment} Your solution here\n`;
}
