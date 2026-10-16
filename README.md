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

## Notes

- The API key stays on the server; the browser only talks to `/api/chat` and `/api/feedback`.
- `profile.local.md` is gitignored so personal career details never reach this repo.
- Model defaults to `claude-sonnet-5-5` (override with `MODEL` in `.env`).

## Roadmap

- [ ] STAR-scored answers with a per-dimension score
- [ ] "Reframe my experience" practice mode
- [ ] Question bank by category (motivation / troubleshooting / behavioral)
- [ ] Whisper input for better accuracy
- [ ] Session history view
