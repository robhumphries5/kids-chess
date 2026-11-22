# Kids Chess

A gentle chess learning web app for young children. Static site, no server, no tracking.

## Develop

```sh
npm install
npm run dev        # local dev server
npm test           # Vitest
npm run typecheck
npm run build      # outputs dist/
```

Pushing to `main` runs the tests, builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`).
On Windows, run Vitest from a path with an upper-case drive letter (`C:\...`): a lower-case `c:\` loads Vitest twice and every suite fails with "Cannot read properties of undefined (reading 'config')".

## Layout

- `src/core/` – the coach core: a DOM-free `Session` that takes commands and returns plain events.
- `src/opponents/` – Opponent move-picking strategies (Sleepy Snail so far).
- `src/ui/` – thin UI that renders Session events with chessground.

## Credits

- Board: [chessground](https://github.com/lichess-org/chessground) (GPL-3.0). Rules: [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause).
- Chess pieces: the "cburnett" set by Colin M.L. Burnett, shipped with chessground (CC BY-SA 3.0 / GPL).
