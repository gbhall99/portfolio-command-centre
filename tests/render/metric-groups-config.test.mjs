import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('MetricGroups config', () => {
  it('renders the three default groups with in-use counts', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [
        makeMetric({ name: 'A', group_id: 'performance' }),
        makeMetric({ name: 'B', group_id: 'performance' }),
        makeMetric({ name: 'C', group_id: 'customer' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.MetricGroups.renderConfigBody();
    expect(out).toMatch(/Customer.*1/);
    expect(out).toMatch(/Performance.*2/);
    expect(out).toMatch(/Operations.*0/);
    app.teardown();
  });
});
