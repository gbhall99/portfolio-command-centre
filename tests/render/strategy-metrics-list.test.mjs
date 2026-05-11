import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — Metrics inventory list', () => {
  it('renders library rows with group, status, holder count, dimensions', async () => {
    resetIdSeq();
    const m1 = makeMetric({ id: 'M1', name: 'Revenue',     status: 'live',  group_id: 'performance', dimensions: ['region'] });
    const m2 = makeMetric({ id: 'M2', name: 'Customer NPS', status: 'draft', group_id: 'customer' });
    const sarah = makePersona({ id: 'P1', name: 'Sarah Chen' });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [m1, m2], personas: [sarah],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderInventoryTab();
    expect(out).toContain('Revenue');
    expect(out).toContain('Customer NPS');
    // Dimensions render as compact chips in the new flat table.
    expect(out).toContain('region');
    // Persona / People / Targets counts surface in dedicated columns.
    expect(out).toMatch(/<td class="metric-th-right">1<\/td>/);
    expect(out).toMatch(/<td class="metric-th-right">0<\/td>/);
    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-metrics-list.html');
    app.teardown();
  });
});
