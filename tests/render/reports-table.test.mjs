import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

describe('Reports.table — shared renderer', () => {
  it('renders headers, rows, and escapes content', async () => {
    const app = await loadApp(makeDataset({}));
    const html = app.Reports.table({
      columns: [
        { key: 'name', label: 'Project' },
        { key: 'score', label: 'Score', cell: (r) => '<span class="rp-chip" style="background:var(--rp-red)">' + r.score + '</span>' }
      ],
      rows: [{ name: 'Customer <360>', score: 25 }]
    });
    expect(html).toContain('class="rp-table"');
    expect(html).toContain('<th');
    expect(html).toContain('Project');
    expect(html).toContain('Customer &lt;360&gt;'); // escaped
    expect(html).toContain('rp-chip');
    app.teardown();
  });
  it('renders an empty-state row when no rows', async () => {
    const app = await loadApp(makeDataset({}));
    const html = app.Reports.table({ columns: [{ key: 'x', label: 'X' }], rows: [], empty: 'Nothing to report' });
    expect(html).toContain('Nothing to report');
    app.teardown();
  });
});
