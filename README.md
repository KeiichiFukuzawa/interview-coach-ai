# interview-coach-ai

AI mock interviewer for English job interviews. First target: **Product Support Specialist (Anthropic Japan)**.

- An AI interviewer (Claude API) asks one question at a time, with follow-ups when answers are vague
- Answer by voice (browser Web Speech API) or by typing
- After the session you get feedback: STAR gaps, improved sample answers, English corrections, next priorities
- Sessions are kept in the browser's localStorage (last 20)

## Setup

```bash
npm install
cp .env.example .env            # set ANTHROPIC_API_KEY
cp profile.example.md profile.local.md   # optional: your background (gitignored)
npm start
# open http://localhost:3000  (Chrome recommended for voice input)
```

## Deploy (Render, for phone use)

1. Render dashboard → New → Blueprint → select this repo (`render.yaml` is picked up)
2. Set `ANTHROPIC_API_KEY` and `APP_PASSWORD` when prompted
3. Open the issued `https://...onrender.com` URL on your phone (HTTPS is required for the microphone)

The free plan sleeps when idle, so the first request after a break takes ~30-60s.

## Notes

- Set `APP_PASSWORD` before deploying publicly. The app asks for it once and remembers it in the browser; without it, anyone with the URL can use your API key.
- The API key stays on the server; the browser only talks to `/api/chat` and `/api/feedback`.
- `profile.local.md` is gitignored so personal career details never reach this repo.
- Model defaults to `claude-sonnet-5-5` (override with `MODEL` in `.env`).

## Roadmap

- [ ] STAR-scored answers with a per-dimension score
- [ ] "Reframe my experience" practice mode
- [ ] Question bank by category (motivation / troubleshooting / behavioral)
- [ ] Whisper input for better accuracy
- [ ] Session history view
