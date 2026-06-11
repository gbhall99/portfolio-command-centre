import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

describe('Reports.tokens — parity stylesheet', () => {
  it('uses the app RAG tokens, not the legacy report hex', async () => {
    const app = await loadApp(makeDataset({}));
    const css = app.Reports.tokens();
    expect(css).toContain('<style>');
    // App RAG values (parity), NOT the legacy #22c55e / #f59e0b / #ef4444 family
    expect(css).toContain('#0d9488'); // status-green
    expect(css).toContain('#d97706'); // status-amber
    expect(css).toContain('#dc2626'); // status-red
    expect(css).not.toContain('#22c55e');
    expect(css).not.toContain('#ef4444');
    // print-tuned
    expect(css).toMatch(/@page/);
    app.teardown();
  });
  it('accepts a brand primary color', async () => {
    const app = await loadApp(makeDataset({}));
    const css = app.Reports.tokens({ primaryColor: '#112233' });
    expect(css).toContain('#112233');
    app.teardown();
  });
});
