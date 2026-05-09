import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Settings — Metrics tab', () => {
  it('renders the library list with group + status', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [
        makeMetric({ id: 'M1', name: 'Revenue',     group_id: 'performance', status: 'live' }),
        makeMetric({ id: 'M2', name: 'NPS',         group_id: 'customer',    status: 'draft' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderSettingsTab();
    expect(out).toContain('Revenue');
    expect(out).toContain('NPS');
    expect(out).toMatch(/Performance/i);
    expect(out).toMatch(/Customer/i);
    expect(out).toMatch(/live/i);
    expect(out).toMatch(/draft/i);
    app.teardown();
  });
});
