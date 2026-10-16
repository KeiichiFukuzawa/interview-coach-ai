import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.MODEL || "claude-sonnet-5-5";
// Feedback is the quality-critical step, so it can use a stronger model than the rest.
const FEEDBACK_MODEL = process.env.FEEDBACK_MODEL || MODEL;
const PORT = process.env.PORT || 3000;
const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Optional passphrase: if APP_PASSWORD is set, every /api call must send it
// in the x-app-password header. Protects your API key's usage when deployed.
const APP_PASSWORD = process.env.APP_PASSWORD;
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
app.use("/api", (req, res, next) => {
  if (!APP_PASSWORD) return next();
  if (safeEqual(req.get("x-app-password") || "", APP_PASSWORD)) return next();
  res.status(401).json({ error: "unauthorized" });
});

function loadProfile() {
  // On hosts without the gitignored file (e.g. Render), set PROFILE_MD instead.
  if (process.env.PROFILE_MD) return process.env.PROFILE_MD;
  const p = path.join(__dirname, "profile.local.md");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "(no candidate profile provided)";
}

const ROLE = "Product Support Specialist at Anthropic Japan (Tokyo)";

// Extra personal facts typed in the browser (kept in localStorage, never in the repo).
function factsBlock(facts) {
  const f = String(facts || "").trim().slice(0, 8000);
  return f
    ? `\n\nExtra facts from the candidate (may be in Japanese; treat as true, and translate to natural spoken English when used):\n${f}`
    : "";
}

function interviewerSystem({ maxQuestions, facts }) {
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
${loadProfile()}${factsBlock(facts)}`;
}

app.post("/api/chat", async (req, res) => {
  try {
    const { messages = [], maxQuestions = 6, facts = "" } = req.body;
    const msgs = messages.length
      ? messages
      : [{ role: "user", content: "Hello, I'm ready to start the interview." }];
    const r = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: interviewerSystem({ maxQuestions, facts }),
      messages: msgs,
    });
    res.json({ reply: r.content.map((b) => b.text ?? "").join("") });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const MODEL_ANSWER_SYSTEM = `You write model answers for a Japanese speaker practicing English
interviews for ${ROLE}. You get the conversation so far. Write the answer the candidate could
give to the interviewer's LAST message.

Rules:
- First person, spoken English, simple words and short sentences (about CEFR A2-B1), 40-90 words.
- If the candidate's own prepared scripts below contain relevant content, reuse their sentences
  and wording as closely as possible, adapting only what the question needs.
- Do not invent employers, numbers, or achievements. When the question asks for specifics that
  are not in the profile or scripts (a product name, a concrete problem, a result), still write a
  complete answer: keep the structure (situation, action, result) and put square-bracket
  placeholders where a real detail is needed, e.g. [software name], [what went wrong], [result].
  The candidate will replace the placeholders with true details.
- ALWAYS output an answer. Never reply with an empty message, a refusal, or a question.
- Output only the answer text. No quotes, labels, or commentary.`;

app.post("/api/model-answer", async (req, res) => {
  try {
    const { messages = [], kanpe = "", facts = "" } = req.body;
    const convo = messages
      .map((m) => `${m.role === "assistant" ? "Interviewer" : "Candidate"}: ${m.content}`)
      .join("\n\n");
    const system =
      MODEL_ANSWER_SYSTEM +
      "\n\nCandidate profile:\n" + loadProfile() + factsBlock(facts) +
      "\n\nCandidate's prepared scripts:\n" + (String(kanpe).slice(0, 12000) || "(none)");
    let answer = "";
    for (let attempt = 0; attempt < 2 && !answer; attempt++) {
      const r = await client.messages.create({
        model: MODEL,
        max_tokens: 500,
        system,
        messages: [{
          role: "user",
          content: `Conversation so far:\n\n${convo}\n\nWrite the model answer to the interviewer's last message now.` +
            (attempt ? "\nYour previous reply was empty. Write the answer text, using [placeholders] for missing details." : ""),
        }],
      });
      answer = r.content.map((b) => b.text ?? "").join("").trim();
    }
    if (!answer) return res.status(502).json({ error: "empty answer from model" });
    res.json({ answer });
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
    const { messages = [], facts = "" } = req.body;
    const transcript = messages
      .map((m) => `${m.role === "assistant" ? "Interviewer" : "Candidate"}: ${m.content}`)
      .join("\n\n");
    const r = await client.messages.create({
      model: FEEDBACK_MODEL,
      max_tokens: 3000,
      system: FEEDBACK_SYSTEM + loadProfile() + factsBlock(facts),
      messages: [{ role: "user", content: `Transcript:\n\n${transcript}` }],
    });
    res.json({ feedback: r.content.map((b) => b.text ?? "").join("") });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`interview-coach-ai on http://localhost:${PORT}`));
