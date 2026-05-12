import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePersona, makeObjective, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — Metrics detail pane', () => {
  it('renders definition, pseudo_logic, RACI, and cascade table', async () => {
    resetIdSeq();
    const sarah = makePersona({ id: 'PS', name: 'CFO' });
    const diane = makePersona({ id: 'PD', name: 'Regional GM — North' });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {},                  targets: [{ period: '2026', value: 400, period_type: 'annual' }] }];
    diane.metric_holdings = [{ id: 'H2', metric_id: 'M1', filter: { region: 'North' }, targets: [{ period: '2026', value: 200, period_type: 'annual' }] }];
    const obj = makeObjective({ id: 'O1', name: 'Grow regional revenue 12%' });
    const m = makeMetric({
      id: 'M1', name: 'Revenue', definition: 'Total recognised revenue.',
      pseudo_logic: 'SUM(order_lines.recognised_amount)',
      source: 'Snowflake · prod.fct_revenue', dimensions: ['region'],
      objective_ids: ['O1'],
      raci: { accountable: ['PS'], responsible: [], consulted: [], informed: [] },
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah, diane], metrics: [m], objectives: [obj],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderDetailPane('M1');
    expect(out).toContain('Total recognised revenue');
    expect(out).toContain('SUM(order_lines.recognised_amount)');
    expect(out).toContain('Snowflake');
    expect(out).toContain('region');
    expect(out).toContain('Grow regional revenue 12%');
    expect(out).toContain('CFO');
    expect(out).toContain('Regional GM — North');
    expect(out).toContain('region: North');
    expect(out).toContain('£400');
    expect(out).toContain('200');
    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-metrics-detail.html');
    app.teardown();
  });
});
