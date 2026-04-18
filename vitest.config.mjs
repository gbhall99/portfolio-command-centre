import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each test spins its own jsdom instance via tests/harness/loadApp.mjs.
    // Running node env keeps tests isolated — no shared document contamination.
    environment: 'node',
    include: ['tests/unit/**/*.test.mjs', 'tests/render/**/*.test.mjs'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    testTimeout: 15_000,
    globals: false,
    reporters: ['default']
  }
});
