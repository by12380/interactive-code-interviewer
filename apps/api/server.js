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

app.post("/api/chat", async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).send("Missing OPENAI_API_KEY on the server.");
  }

  const { messages, mode = "chat", interruptContext = null } = req.body || {};

  if (!Array.isArray(messages)) {
    return res.status(400).send("messages must be an array.");
  }

  let systemPrompt;
  
  if (mode === "interrupt") {
    // Assertive interviewer mode - proactively interrupts with guidance
    systemPrompt = `You are an experienced technical interviewer conducting a live coding interview.
You've just noticed something in the candidate's code that warrants an interruption.

CONTEXT FROM CODE ANALYSIS:
${interruptContext?.detectedIssue || "General observation"}
Severity: ${interruptContext?.severity || "approach"}

YOUR ROLE:
- Interrupt naturally like a real interviewer would: "Wait...", "Hold on...", "Before you continue..."
- Be direct but helpful - point out the issue without being condescending
- Ask probing questions to guide them toward better solutions
- If they're using a brute force approach, hint at the optimal solution WITHOUT giving it away
- Keep responses concise (2-3 sentences max)
- Sound like a human interviewer, not a robot

IMPORTANT: 
- Don't just repeat what the analysis already said - expand on it or ask a follow-up question
- If the candidate seems stuck, give a small hint about the right direction
- Never give away the full solution
- Be encouraging while still pushing them to think`;
  } else if (mode === "proactive") {
    systemPrompt = `You are a live interview coach observing code updates in real-time.
Your job is to watch for potential issues and provide brief, helpful nudges.

Look for:
- Inefficient approaches (nested loops when hash maps would work)
- Wrong data structures for the problem
- Common mistakes or edge cases being missed
- Signs the candidate might be stuck

If you notice something worth mentioning:
- Start with "I notice..." or "Quick thought..." 
- Keep it brief (1-2 sentences)
- Ask a guiding question rather than giving answers

If the code looks fine and no feedback is needed, respond with EXACTLY an empty string "".
Do NOT respond with encouragement or praise - only interrupt when there's something to address.`;
  } else {
    systemPrompt = `You are a coding interview coach. Focus on guiding the candidate.
Be concise, point out likely mistakes, and ask clarifying questions.
Do not solve the problem end-to-end unless asked.
When the candidate asks for help, guide them with questions rather than direct answers.`;
  }

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

// Code Translation endpoint
app.post("/api/translate", async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).send("Missing OPENAI_API_KEY on the server.");
  }

  const { code, sourceLanguage, targetLanguage, options = {} } = req.body || {};

  if (!code || typeof code !== "string") {
    return res.status(400).send("code must be a non-empty string.");
  }

  if (!sourceLanguage || !targetLanguage) {
    return res.status(400).send("sourceLanguage and targetLanguage are required.");
  }

  const validLanguages = ["javascript", "python", "java", "cpp"];
  if (!validLanguages.includes(sourceLanguage) || !validLanguages.includes(targetLanguage)) {
    return res.status(400).send(`Languages must be one of: ${validLanguages.join(", ")}`);
  }

  const languageNames = {
    javascript: "JavaScript",
    python: "Python",
    java: "Java",
    cpp: "C++"
  };

  const { preserveComments = true, generateIdiomatic = true, includeTestCases = true } = options;

  const systemPrompt = `You are an expert code translator specializing in converting code between programming languages.
Your task is to translate ${languageNames[sourceLanguage]} code to ${languageNames[targetLanguage]}.

TRANSLATION RULES:
1. ${preserveComments ? "PRESERVE all comments and translate them to the target language's comment syntax." : "You may remove comments."}
2. ${generateIdiomatic ? "Generate IDIOMATIC code that follows best practices and conventions of the target language." : "Perform a direct translation without optimizing for idioms."}
3. ${includeTestCases ? "Translate any test cases, assertions, or example usage to the target language format." : "Focus only on the main code logic."}

LANGUAGE-SPECIFIC GUIDELINES:

For JavaScript:
- Use modern ES6+ syntax (const/let, arrow functions, template literals)
- Use Array methods (map, filter, reduce) where appropriate
- Handle async operations with async/await

For Python:
- Use Pythonic idioms (list comprehensions, generators, context managers)
- Follow PEP 8 style guidelines
- Use f-strings for string formatting
- Add type hints where beneficial

For Java:
- Wrap code in appropriate class structure if needed
- Use proper access modifiers
- Use Java Streams for collection operations where appropriate
- Include necessary imports as comments

For C++:
- Use modern C++ features (auto, range-based for, smart pointers)
- Include necessary #include directives as comments
- Use STL containers appropriately
- Consider memory management

IMPORTANT:
- Maintain the same logic and functionality
- Preserve variable names where possible (adjust for naming conventions)
- Handle language-specific features intelligently
- If something cannot be directly translated, provide an equivalent implementation with a comment explaining the adaptation
- Output ONLY the translated code, no explanations before or after`;

  const payload = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Translate this ${languageNames[sourceLanguage]} code to ${languageNames[targetLanguage]}:\n\n${code}` }
    ],
    temperature: 0.2,
    max_tokens: 2000
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
    let translatedCode = data.choices?.[0]?.message?.content?.trim() || "";

    // Clean up the response - remove markdown code blocks if present
    translatedCode = translatedCode
      .replace(/^```[\w]*\n?/gm, "")
      .replace(/\n?```$/gm, "")
      .trim();

    return res.json({
      translatedCode,
      sourceLanguage,
      targetLanguage,
      metadata: {
        model: "gpt-4o-mini",
        preservedComments: preserveComments,
        idiomaticCode: generateIdiomatic,
        includedTestCases: includeTestCases
      }
    });
  } catch (error) {
    return res.status(500).send(error.message || "Translation request failed.");
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
