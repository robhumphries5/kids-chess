import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Served from https://<user>.github.io/kids-chess/
  base: './',
  test: {
    environment: 'node',
  },
});
