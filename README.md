# interview-coach-ai

An AI mock interviewer for practicing English job interviews, built with the Claude API.
The first target role is **Product Support Specialist** (customer-facing technical support for an API product).

I built it to rehearse for my own interviews, and I use it to practice troubleshooting-style and behavioral answers out loud. It is deliberately small: one Express server and one HTML file, with no build step and no database.

## What it does

- **Mock interview.** An AI interviewer asks one question at a time, adds a follow-up when an answer is vague, and gives no feedback until the end. You answer by voice (browser Web Speech API) or by typing. After the session you get feedback: STAR gaps, improved English versions of your answers, naturalness corrections, and three priorities for next time. Coaching text is in Japanese, and example answers are in English.
- **Script read-aloud tab.** Save your own prepared answers as named scenes. Listen to them at 0.7-1.0x, blur the text to practice from memory, or read aloud and get a word-level match rate that highlights what you missed.
- **Easy mode.** The interviewer asks the questions from your saved scenes, in order, and shows your own script under each question as the model answer, word for word.
- **Facts memo.** A free-form note (Japanese is fine) that feeds the interviewer, the feedback and the model answers.

## Running it

Requires Node 20+.

```bash
npm install
cp .env.example .env                      # set ANTHROPIC_API_KEY
cp profile.example.md profile.local.md    # optional: your background (gitignored)
npm start
# open http://localhost:3000  (Chrome recommended for voice input)
```

### Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Required. Stays on the server. |
| `APP_PASSWORD` | Passphrase required for every `/api` call. Set it before deploying publicly. |
| `MODEL` | Model for interview questions and model answers. Default `claude-sonnet-5-5`. |
| `FEEDBACK_MODEL` | Model for the end-of-session feedback. Defaults to `MODEL`. |
| `PROFILE_MD` | Your background as text, for hosts where `profile.local.md` does not exist. |
| `PORT` | Default `3000`. |

A cheap and good combination is `MODEL=claude-haiku-5-5` with `FEEDBACK_MODEL=claude-sonnet-5-5`.

### Deploying to Render (to practice on a phone)

1. Render dashboard → New → Blueprint → select this repo (`render.yaml` is picked up).
2. Set `ANTHROPIC_API_KEY` and `APP_PASSWORD` when prompted, and `PROFILE_MD` if you want a profile.
3. Open the `https://...onrender.com` URL on your phone. HTTPS is required for the microphone.

The free plan sleeps when idle, so the first request after a break takes about 30-60 seconds.

## Design decisions

The longer version, written as talking points, is in [docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md).

**Personal data stays out of the repo and off the server's disk.**
Scripts, the facts memo and session history live in the browser's `localStorage`. The candidate profile is gitignored (`profile.local.md`) and reaches Render through an environment variable. The server stores nothing: it has no database and no request logging. Facts and profile are sent with each request so the model can use them, which means they do reach the Anthropic API at request time. In the current flow, saved scripts are not sent at all.

**Cost is controlled at several layers.**
A shared passphrase (compared in constant time) gates every `/api` route, because the app is public and spends my API key. Every call has a `max_tokens` cap, request bodies are limited to 1 MB, and user-supplied text is truncated before it goes into a prompt. Easy mode with saved scripts makes no API call for the model answer. There is no per-user rate limit yet (see the roadmap).

**Different models for different jobs.**
Interview questions are short and low-stakes, so they can use a small, fast model. The final feedback is the part that has to be accurate, specific and well written in two languages, so it can use a stronger one. `MODEL` and `FEEDBACK_MODEL` are separate settings so the split is a config change, not a code change.

**Easy mode shows my script verbatim instead of generating an answer.**
The first version asked the model to write a model answer for each question. In practice that was the wrong tool: the output was not my own wording, it could drift into invented details or placeholders, it sometimes came back empty and needed a retry path, and it cost an API call per question. Since the goal is to say my own prepared sentences smoothly, the model now only asks the question (the wording is pinned by the server) and the app displays the saved script directly. It is deterministic, free, and cannot invent experience I do not have.

## Roadmap

- [ ] Rate limiting and a daily spend cap on the server
- [ ] Companion project, in progress: [claude-api-support-lab](https://github.com/KeiichiFukuzawa/claude-api-support-lab), an API diagnostic tool for common Claude API problems (auth, rate limits, request errors). The repository is still empty.
- [ ] STAR-scored answers with a per-dimension score
- [ ] Question bank by category (motivation / troubleshooting / behavioral)
- [ ] Session history view (sessions are already saved in `localStorage`, last 20)
- [ ] "Reframe my experience" practice mode
- [ ] Whisper input for better speech recognition accuracy
- [ ] Automated tests for the prompt builders and the script matcher

## Project layout

```
server.js          Express API: /api/chat, /api/model-answer, /api/feedback
public/index.html  The whole front end (vanilla JS, no build)
render.yaml        Render blueprint (free plan)
profile.example.md Template for the gitignored profile.local.md
```
