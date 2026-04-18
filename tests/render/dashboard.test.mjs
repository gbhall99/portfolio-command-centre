// Snapshot tests for Dashboard HTML output. Fixed fixtures ensure the output is deterministic
// (no Date.now, no random). Snapshots live in tests/render/__snapshots__/.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

describe('Dashboard.buildRowHtml', () => {
  it('renders a project row with matching priority + recommendation (no chip)', async () => {
    resetIdSeq();
    const p = makeProject({
      id: 'GCC-ROW-A',
      name: 'Steady Project',
      priority: 3,
      status: 'In Progress',
      size_total: 20,
      current_sprint: 'CY26-S1',
      target_sprint: 'CY26-S3'
    });
    p.recommended_priority = 3;
    const app = await loadApp(makeDataset({ projects: [p] }));
    const html = app.Dashboard.buildRowHtml(p);
    await expect(html).toMatchFileSnapshot('./__snapshots__/dashboard.row.matching.html');
    app.teardown();
  });

  it('renders a project row with a recommendation chip when priority differs', async () => {
    resetIdSeq();
    const p = makeProject({
      id: 'GCC-ROW-B',
      name: 'Drift Project',
      priority: 5,
      status: 'Blocked',
      size_total: 30
    });
    p.recommended_priority = 1;
    const app = await loadApp(makeDataset({ projects: [p] }));
    const html = app.Dashboard.buildRowHtml(p);
    await expect(html).toMatchFileSnapshot('./__snapshots__/dashboard.row.chip.html');
    app.teardown();
  });
});
