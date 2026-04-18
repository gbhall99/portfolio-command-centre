// Gantt render snapshots. renderLegend writes to #ganttLegend — snapshot that
// element's innerHTML so the go-live removal + new deadline icon stay locked.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';

describe('Gantt.renderLegend', () => {
  it('renders legend without go-live markers and with violet deadline icon', async () => {
    const app = await loadApp();
    app.Gantt.renderLegend();
    const legend = app.document.getElementById('ganttLegend');
    const html = legend.innerHTML;
    // Structural assertions (complement the snapshot for drift detection).
    expect(html).not.toContain('Go-Live');
    expect(html).not.toContain('Estimated');
    expect(html).toContain('Deadline');
    // New icon uses #8b5cf6 (violet) — not the old #dc2626 (red octagon).
    expect(html).toContain('#8b5cf6');
    expect(html).not.toContain('polygon points="5,1 11,1 15,5');
    await expect(html).toMatchFileSnapshot('./__snapshots__/gantt.legend.html');
    app.teardown();
  });
});
