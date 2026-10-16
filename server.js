import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.MODEL || "claude-sonnet-5-5";
const PORT = process.env.PORT || 3000;
const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function loadProfile() {
  const p = path.join(__dirname, "profile.local.md");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "(no candidate profile provided)";
}

const ROLE = "Product Support Specialist at Anthropic Japan (Tokyo)";

function interviewerSystem({ maxQuestions }) {
  return `You are a friendly but rigorous interviewer for the role: ${ROLE}.
The candidate is a Japanese speaker practicing English interviews.

Rules:
- Ask exactly ONE question per turn. Keep each turn under 60 words.
- Plain, natural spoken English (it will be read aloud).
- Mix: motivation (Why Anthropic / why this role), customer-support scenarios,
  technical troubleshooting (APIs, rate limits, errors, prompt issues), and
  behavioral questions (use STAR-style probing).
- If an answer is vague, ask ONE short follow-up for specifics before moving on.
- Plan for about ${maxQuestions} main questions in total. Do not give feedback
  during the interview; just react briefly (one short sentence at most) and ask next.
- Start with a short greeting and an easy opener on the first turn.
- Use the candidate profile only to personalize questions; do not recite it.

Candidate profile:
${loadProfile()}`;
}

app.post("/api/chat", async (req, res) => {
  try {
    const { messages = [], maxQuestions = 6 } = req.body;
    const msgs = messages.length
      ? messages
      : [{ role: "user", content: "Hello, I'm ready to start the interview." }];
    const r = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: interviewerSystem({ maxQuestions }),
      messages: msgs,
    });
    res.json({ reply: r.content.map((b) => b.text ?? "").join("") });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const FEEDBACK_SYSTEM = `You are an interview coach for a Japanese speaker practicing
English interviews for ${ROLE}. You will receive a transcript. Respond in
Markdown with these sections, in this order:

## Overall (2-3 sentences, include a score out of 10)
## Per-answer review
For each candidate answer: Q (short), what worked, what was weak
(STAR gaps: Situation/Task/Action/Result; vagueness; length), and an improved
English version of the answer in the candidate's own voice (keep it speakable,
under ~90 words).
## English naturalness
Up to 8 concrete corrections: "You said -> Better". Note recurring patterns.
## Top 3 priorities for next practice
Write the coaching explanations in Japanese; keep example answers and
corrections in English. Be honest, specific, and constructive.

Candidate profile:
`;

app.post("/api/feedback", async (req, res) => {
  try {
    const { messages = [] } = req.body;
    const transcript = messages
      .map((m) => `${m.role === "assistant" ? "Interviewer" : "Candidate"}: ${m.content}`)
      .join("\n\n");
    const r = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: FEEDBACK_SYSTEM + loadProfile(),
      messages: [{ role: "user", content: `Transcript:\n\n${transcript}` }],
    });
    res.json({ feedback: r.content.map((b) => b.text ?? "").join("") });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`interview-coach-ai on http://localhost:${PORT}`));
