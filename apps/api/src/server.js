import cors from "cors";
import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors({ origin: ["http://localhost:5173"] }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/chat", async (req, res) => {
  const { messages, code } = req.body || {};

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY." });
  }

  if (!Array.isArray(messages) || typeof code !== "string") {
    return res.status(400).json({ error: "Expected { messages: [], code: string }." });
  }

  try {
    const chatHistory = messages
      .filter((msg) => msg && typeof msg.content === "string")
      .map((msg) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content
      }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a live coding interviewer. Be concise, helpful, and proactive."
        },
        {
          role: "user",
          content: `Code:\n${code}`
        },
        ...chatHistory
      ]
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "";
    return res.json({ reply });
  } catch (error) {
    console.error("OpenAI error:", error);
    return res.status(500).json({ error: "LLM request failed." });
  }
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
