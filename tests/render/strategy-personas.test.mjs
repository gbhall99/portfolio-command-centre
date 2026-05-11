import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — Personas inventory', () => {
  it('renders personas grouped by hierarchy with metric chips', async () => {
    resetIdSeq();
    const sarah = makePersona({ id: 'P1', name: 'Sarah Chen', role_title: 'CFO', parent_persona_id: null });
    const diane = makePersona({ id: 'P2', name: 'Diane Yuen', role_title: 'GM N', parent_persona_id: 'P1' });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [{ period: '2026', value: 400, period_type: 'annual' }] }];
    diane.metric_holdings = [{ id: 'H2', metric_id: 'M1', filter: { region: 'North' }, targets: [] }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah, diane],
      metrics: [makeMetric({ id: 'M1', name: 'Revenue', dimensions: ['region'], group_id: 'performance' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.renderInventoryTab();
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('Diane Yuen');
    expect(out).toContain('Revenue');
    // Tabular layout: filter dimensions are surfaced via the toolbar Dimension
    // dropdown rather than per-row tags.
    expect(out).toContain('strategy-table');
    expect(out).toContain('strategy-toolbar');
    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-personas.html');
    app.teardown();
  });

  it('shows "no metrics" hint for empty personas', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'P1', name: 'Tom', role_title: 'Ops' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.renderInventoryTab();
    expect(out.toLowerCase()).toContain('no metrics');
    app.teardown();
  });
});
