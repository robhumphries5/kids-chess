import { defineConfig } from 'vitest/config';
import { offlineServiceWorker } from './build/pwa-plugin.ts';
import { stockfishEngine } from './build/stockfish-plugin.ts';

export default defineConfig({
  // Served from https://<user>.github.io/kids-chess/
  base: './',
  plugins: [stockfishEngine(), offlineServiceWorker()],
  test: {
    environment: 'node',
  },
});
