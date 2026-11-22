# Design decisions (from the grilling session)

Input for `/to-spec` and `/to-tickets`. Terms are defined in [GLOSSARY.md](../GLOSSARY.md).

## Goal
Help two young beginners (4, pre-reader; 7, reluctant reader) get better at chess through unlimited very easy puzzles, games against a variety of characters, and instant, encouraging feedback on any move. They know roughly how the pieces move and nothing about tactics. Fun first; never punish, but losing is allowed.

## Platform
- Static SPA on GitHub Pages, public repo, offline-capable PWA. No server in v1.
- Tablet first (tap-tap or drag to move), laptop also supported.
- Vite + TypeScript (no framework), Vitest, chessground + chess.js, Stockfish WASM in a Web Worker.
- Explanations come from templates built on engine output plus simple tactic detection ("The knight could take your queen!"). No LLM in v1. A Railway LLM proxy for "tell me more" is backlog.
- Voice: the browser's built-in voice (en-GB, slightly slow), on by default, 🔊 replay on every message. Recorded/generated audio is backlog.
- Standard open-licensed chess pieces; cuteness lives in the Opponents, menus, sounds and stickers.

## Lessons from older repos
- `chess-shuffle-poc-2` accepted only the single stored solution move (exact UCI match), so alternative mates were rejected. It also always promoted to a queen. Fix: goal-based checking and a Promotion Picker everywhere.
- Reuse from `word-bots`: speech wrapper, Web Audio sound effects, versioned localStorage progress, Pages deploy workflow, service worker.

## Navigation
- Avatar picker → home with three big picture choices: Puzzles, Play, Mini-games.
- Tapping a choice speaks it and selects it; the Go Button (fixed position) confirms it. Chess moves on the board happen straight away (Undo is the safety net).
- The Grown-up Area sits behind a hold-for-3-seconds button: manage Profiles and Settings, see progress (puzzles solved, Opponents beaten, ladder level), set a starting ladder level.

## Puzzles
- App-generated, so effectively unlimited, on near-empty boards, checked with Stockfish. Ladder themes: take the free piece → make a new piece → move away from attack → mate in one with queen/rook → "is it really free?" (defended pieces) → simple forks → (backlog) real Lichess mate-in-1s.
- Any move that achieves the goal is correct.
- Hint Steps: wrong move → undo + "Nearly! Try again" + the right piece wobbles → wrong again → arrow shows the answer → wrong again → app plays it ("Watch this!") and moves on.
- Points: 30 / 20 / 10 / 0 as in the glossary. Never "failed".
- Hidden level per Profile: up after 5 perfect solves in a row; easier ones mixed in after a few low scores.

## Games against Opponents
- Six fixed-strength characters, all available from the start, with stars for the ones each Profile has beaten: Sleepy Snail (random), Greedy Pig (always captures if it can, else random), Silly Puppy (decent, big mistake ~1 in 3), Clever Cat (weakest Stockfish + some blunders), Wise Owl (low club level), Dragon (strong; parent challenge).
- Child picks a colour or 🎲. Undo is always available. Quit any time with no penalty; games are saved and can be resumed. No clocks (optional clocks are v2).
- Move Colours on tapping a piece (star / green / red / none), per-Profile switch, default on. On the 7-year-old's Profile, tapping a red square also speaks the reason.
- Blunder Warnings and Missed-Chance Alerts, each with four per-Profile switches (checkmate, queen, rook, bishop/knight). Defaults: all on for the 4-year-old; checkmate + queen on for the 7-year-old. Warnings never block: Undo / Keep it.
- Losing: the Opponent does a happy dance, "Greedy Pig won this time! Good game!", Go choices Rematch / Pick someone else, plus 10 good-try points.
- Promotion Picker on every promotion. No special queen celebration.

## Rewards
- Points are earned everywhere and never lost; the Sticker Book unlocks as the total grows (e.g. a new sticker every 100 points), shown as a filling star jar.

## Milestones
- **M1 Foundations**: board + rules, Promotion Picker, Profiles, home with Go Button, voice, sounds, Pages deploy.
- **M2 Puzzles**: generator + ladder, goal-based checking, Hint Steps, Points, Sticker Book.
- **M3 Play an Opponent**: six Opponents, Move Colours, Blunder Warnings, Missed-Chance Alerts, Undo, save/resume, gentle losing.
- **M4 First mini-game + polish**: Hungry Pieces, Grown-up Area, offline PWA.
- **v2 backlog** (roughly easiest first): Pawn Race, Don't Get Eaten, Catch the King, Queen vs Pawns, sibling two-player mode (board flip off by default), optional clocks, real Lichess puzzles, recorded voice, LLM "tell me more", spoken reasons for every move.

## Process
Matt Pocock skills: `/setup-matt-pocock-skills` (GitHub Issues, default labels, single-context) → `/to-spec` → `/to-tickets` → `/implement`.
