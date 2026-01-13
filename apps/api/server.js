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

  const { messages, mode = "chat" } = req.body || {};

  if (!Array.isArray(messages)) {
    return res.status(400).send("messages must be an array.");
  }

  const systemPrompt =
    mode === "proactive"
      ? "You are a live interview coach observing code updates. " +
        "If the user appears to be working toward a double for-loop solution " +
        "for Two Sum, give a brief nudge toward a more efficient approach. " +
        "If no feedback is needed, respond with an empty string."
      : "You are a coding interview coach. Focus on guiding the candidate. " +
        "Be concise, point out likely mistakes, and ask clarifying questions. " +
        "Do not solve the problem end-to-end unless asked.";

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

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
