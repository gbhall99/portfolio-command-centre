// Gantt render snapshots. renderLegend writes to #ganttLegend — snapshot that
// element's innerHTML so the milestone-icon repaint stays locked.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';

describe('Gantt.renderLegend', () => {
  it('renders legend with black-on-white milestone glyphs', async () => {
    const app = await loadApp();
    app.Gantt.renderLegend();
    const legend = app.document.getElementById('ganttLegend');
    const html = legend.innerHTML;
    // Structural assertions — milestones now use #0f172a (near-black) strokes
    // and #ffffff fills. Old violet-and-amber palette is gone.
    expect(html).not.toContain('Go-Live');
    expect(html).not.toContain('Estimated');
    expect(html).toContain('Deadline');
    expect(html).toContain('Launch');
    expect(html).toContain('UAT release');
    expect(html).not.toContain('#8b5cf6'); // old violet calendar
    expect(html).not.toContain('#f59e0b'); // old amber rocket
    expect(html).not.toContain('fill="#0891b2"'); // old cyan UAT fill (skill swatch uses background:#0891b2 which is fine)
    // New palette
    expect(html).toContain('stroke="#0f172a"');
    expect(html).toContain('fill="#ffffff"');
    await expect(html).toMatchFileSnapshot('./__snapshots__/gantt.legend.html');
    app.teardown();
  });
});
