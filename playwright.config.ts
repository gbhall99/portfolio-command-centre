import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false, // single-file app, shared static server — keep sequential for stability
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir: './tests/.playwright-artifacts',
  use: {
    baseURL: 'http://127.0.0.1:8765',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    // Python is present on macOS + Ubuntu runners by default; node's http-server would add a dep.
    command: 'python3 -m http.server 8765 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8765/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chromium-headless-shell', viewport: { width: 1280, height: 800 } } }
  ]
});
