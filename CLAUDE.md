# Kids Chess

A chess learning web app for two young children (a 4-year-old pre-reader and a 7-year-old), built as an offline PWA hosted on GitHub Pages. Agreed design decisions: [docs/decisions.md](docs/decisions.md). Vocabulary: [GLOSSARY.md](GLOSSARY.md).

## Rules
- **British English spelling** in all user-facing text and spoken lines.
- No personal info (children's names, photos) in the repo: the repo is public.
- Never embed API keys in the app. v1 is fully static with no server.
- Original art only for characters, stickers and menus. Chess pieces use an open-licensed standard set.
- Never punish: no points or stickers are ever taken away, and losing is gentle. Warnings never block a move.
- Puzzle answers are checked by **goal** (does the move achieve the puzzle's aim?), never by matching one stored move.
- Every promotion shows the piece picker. Never auto-queen.
- Agile: keep increments small and playable.

## Stack
Vite + TypeScript (no framework), Vitest, chessground (board), chess.js (rules), Stockfish WASM in a Web Worker, browser `speechSynthesis` (en-GB), Web Audio sound effects, localStorage progress with versioned keys. Deployed to GitHub Pages via GitHub Actions. Patterns to reuse come from the author's `word-bots` repo (speech, sound, progress, PWA service worker).

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues for robhumphries5/kids-chess (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
