import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — Personas inventory', () => {
  it('renders personas as a hierarchy with parent/child nesting', async () => {
    resetIdSeq();
    const cfo = makePersona({ id: 'P1', name: 'CFO', role_title: 'CFO', parent_persona_id: null });
    const gm  = makePersona({ id: 'P2', name: 'Regional GM — North', role_title: 'Regional GM — North', parent_persona_id: 'P1' });
    cfo.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [{ period: '2026', value: 400, period_type: 'annual' }] }];
    gm.metric_holdings  = [{ id: 'H2', metric_id: 'M1', filter: { region: 'North' }, targets: [] }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [cfo, gm],
      metrics: [makeMetric({ id: 'M1', name: 'Revenue', dimensions: ['region'], group_id: 'performance' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.renderInventoryTab();
    expect(out).toContain('class="persona-tree"');
    expect(out).toContain('data-id="P1"');
    expect(out).toContain('data-id="P2"');
    expect(out).toMatch(/data-id="P2"[^>]*data-depth="1"/);
    expect(out).toMatch(/data-id="P1"[^>]*data-depth="0"/);
    expect(out).toContain('CFO');
    expect(out).toContain('Regional GM — North');
    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-personas.html');
    app.teardown();
  });

  it('shows "no people assigned" hint on personas with no holders', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'P1', name: 'Head of Ops', role_title: 'Head of Ops' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.renderInventoryTab();
    expect(out.toLowerCase()).toContain('no people assigned');
    app.teardown();
  });
});
