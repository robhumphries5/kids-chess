import { defineConfig } from 'vitest/config';
import { offlineServiceWorker } from './build/pwa-plugin.ts';

export default defineConfig({
  // Served from https://<user>.github.io/kids-chess/
  base: './',
  plugins: [offlineServiceWorker()],
  test: {
    environment: 'node',
  },
});
