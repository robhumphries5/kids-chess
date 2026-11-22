/**
 * Where the Stockfish engine files sit in the build (and the dev server), relative to the page.
 * Stockfish 19, lite and single-threaded: GitHub Pages can't send the headers the multi-threaded
 * build needs, and the lite network keeps the download small.
 *
 * The names are not content-hashed on purpose. The engine script finds its WASM by swapping `.js`
 * for `.wasm` in its own address, and a `#wasm-address` hint doesn't survive being served by the
 * offline service worker, so the two names must match.
 */
export const ENGINE_DIR = 'engine';
export const ENGINE_SCRIPT = 'stockfish-19-lite-single.js';
export const ENGINE_WASM = 'stockfish-19-lite-single.wasm';
/** Stockfish is GPL-3.0; its licence ships alongside it. */
export const ENGINE_LICENCE = 'Copying.txt';
