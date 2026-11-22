# Glossary

- **Profile**: one child's identity on this device, chosen by tapping an avatar picture. No passwords. Holds Points, Sticker Book, Puzzle Ladder level, Opponents beaten and Settings. Stored in localStorage only.
- **Help preset**: "Lots of help" or "Some help", chosen by a grown-up when making a Profile. Sets the starting values of the Move Colours, Blunder Warning and Missed-Chance Alert switches. Lots: all on. Some: Move Colours and spoken reasons on, warnings and alerts only for checkmate and the queen. Replaces storing children's names or ages in the repo.
- **Grown-up Area**: settings and progress screen behind a hold-for-3-seconds button. Manages Profiles and their Settings.
- **Go Button**: the big confirm button that always sits in the same place. Tapping any menu choice speaks its name and selects it; Go confirms it. Not used for chess moves.
- **Speak**: reading text aloud with the browser's built-in en-GB voice. Every message has a 🔊 replay.
- **Puzzle**: a small position with a goal (take the free piece, make a new piece, move away from attack, checkmate in one…). Solved by any move that achieves the goal.
- **Puzzle Ladder**: ordered puzzle themes of rising difficulty. Each Profile has a hidden level: up after 5 perfect solves in a row, easier puzzles mixed in after a few low scores.
- **Hint Step**: the puzzle help that follows a wrong move. Step 1: the right piece wobbles. Step 2: an arrow shows the answer. After a third miss the app plays the move itself ("Watch this!").
- **Points**: earned and never lost. Puzzle: 30 (no mistakes) / 20 (after Hint Step 1) / 10 (after Hint Step 2) / 0 (the app played it). Beating an Opponent: 50, rising 25 a step up the ladder (Snail 50 … Dragon 175). Losing or a draw: 10 "good try". Mini-games: by fewness of moves.
- **Sticker Book**: rewards unlocked as a Profile's Points total grows (a star jar fills up).
- **Opponent**: an animal character with a fixed playing strength that never secretly goes easy. Snail (random), Pig (greedy), Puppy (blunders often), Cat, Owl, Dragon (Stockfish, rising strength).
- **Move Colours**: the per-Profile switch that colours a tapped piece's squares in games: gold star = best, green = good, red = gives something away, none = in-between.
- **Blunder Warning**: after a move that allows checkmate or loses a queen / rook / bishop-or-knight (each a separate per-Profile switch), the app says why and offers Undo / Keep it. Never blocks.
- **Missed-Chance Alert**: before the child moves, the app says there's something good to find: a checkmate, or a free queen / rook / bishop-or-knight (each a separate per-Profile switch).
- **Promotion Picker**: big pictures of queen, rook, bishop and knight shown every time a pawn reaches the end.
- **Mini-game**: a short non-standard chess game. v1: Hungry Pieces. Backlog: Pawn Race, Don't Get Eaten, Catch the King, Queen vs Pawns.
- **Hungry Pieces**: one piece must eat all the apples on the board in as few moves as possible.
- **Pawn Race**: pawns only; the first to make a new piece wins.
