# Design decisions (talking points)

Four decisions I made while building this, each written the way I would explain it out loud: the problem, what I chose, why, and what I would do next.

## 1. Handling personal data

**Problem.** The app needs my background and my prepared answers to be useful, but the repository is public and the app runs on a public host.

**What I chose.**
- Scripts, the facts memo and session history live only in the browser's `localStorage`.
- The candidate profile is a gitignored file locally and an environment variable on Render.
- The server has no database and no request logging, so nothing about me is stored there.
- Only `profile.example.md`, which holds made-up placeholders, is committed.

**Why.** The safest data is data that never exists in the repository or on the server's disk, so there is nothing to leak, rotate or clean up later.

**Honest limit.** Facts and profile are sent with each request so the model can personalize, which means they reach the Anthropic API at that moment. I would not claim the data never leaves the device. I claim it is never stored by me and never committed.

**Short version.** "I kept personal data out of the repo and the server's storage by design. It lives in the browser, and it only travels with a request when the model needs it."

## 2. Cost control

**Problem.** A public URL that calls a paid API with my key is an open wallet.

**What I chose.**
- A shared passphrase on every `/api` route, compared in constant time.
- A `max_tokens` cap on every call, a 1 MB body limit, and truncation of user-supplied text before it enters a prompt.
- Easy mode with saved scripts makes no API call for the answer.
- Render's free plan, which is enough for one user.

**Why.** Each layer is cheap, and together they bound the worst case without adding infrastructure.

**What is still missing.** There is no per-user rate limit or daily spend cap. Today the passphrase is the only thing between a leaked URL and my bill, so a spend cap is the first roadmap item.

**Short version.** "I bounded cost at the door, per request and per feature, and I know the next gap is a hard daily cap."

## 3. Using different models for different jobs

**Problem.** One model for everything is either overpaying for easy turns or underpowered for the turn that matters.

**What I chose.** Two settings, `MODEL` and `FEEDBACK_MODEL`. Questions are short, low-stakes turns, so a small, fast model is enough. The end-of-session feedback has to be specific, accurate and bilingual, so it gets a stronger model. A pairing like Haiku for questions and Sonnet for feedback keeps most of the quality at a fraction of the cost.

**Why.** Spend the budget where the user reads the output most closely. The split is configuration, so I can change it without touching code.

**Short version.** "I matched model strength to how much each step matters, and made that a config choice."

## 4. Rebuilding Easy mode: from AI-generated answers to my own script, verbatim

**Problem.** Easy mode originally asked the model to write a model answer under each question.

**What went wrong.**
- The answer was not in my own words, but my goal is to say my own prepared sentences fluently.
- The model could drift into invented details, so the prompt needed rules against placeholders and made-up employers or numbers.
- It sometimes returned an empty answer, which needed a retry path and a bug fix.
- It cost an API call for every question.

**What I chose.** The model now only asks the question, and the server pins the wording of that question. The app then displays the saved script for that scene directly, with no generation step.

**Why.** For this use case the right answer already exists: I wrote it. Generating it again adds cost, latency and risk of fabrication, and removes the part that matters, which is that the words are mine. It is deterministic, free and cannot invent experience.

**What I learned.** A model is not always the right component. Part of using AI well is noticing where a plain lookup is better.

**Short version.** "I replaced a generation step with a lookup, because the answer already existed and generating it only added cost and risk."

## Questions I should be ready for

- **Why not store scripts on the server?** It would add a database, authentication and a privacy surface for no benefit with a single user.
- **Is the passphrase enough?** For one user and a small budget, yes. It is not enough for real traffic, and I say so in the roadmap.
- **How would you test this?** Prompt builders and the script matcher are pure functions and are the first things I would cover. Model output I would sample and review rather than assert on.
- **What would you change at scale?** Real auth, per-user rate limits and spend caps, server-side session storage with consent, and logging that excludes message content.
