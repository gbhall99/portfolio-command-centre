import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — Personas inventory', () => {
  it('renders personas as a flat table with rich columns', async () => {
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
    expect(out).toContain('persona-table');
    expect(out).toContain('data-id="P1"');
    expect(out).toContain('data-id="P2"');
    expect(out).toContain('CFO');
    expect(out).toContain('Regional GM — North');
    // 2026-05 columns: Definition + R/A/C/I; "Held metrics" column dropped —
    // holdings now surface as a dot on the relevant RACI pill instead.
    expect(out).toContain('Definition');
    expect(out).toContain('Responsible');
    expect(out).toContain('Accountable');
    expect(out).toContain('Consulted');
    expect(out).toContain('Informed');
    expect(out).toContain('Reports to');
    expect(out).toContain('View more');
    expect(out).not.toContain('>Held metrics<');
    expect(out).not.toContain('>Holdings<');
    // Column header reads "Persona Title" — the entity context lives in the
    // header, so no per-row "Persona" tag chip next to each name.
    expect(out).toContain('>Persona Title<');
    expect(out).not.toContain('persona-tbl-kind');
    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-personas.html');
    app.teardown();
  });

  it('shows "no people" hint on personas with no holders', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'P1', name: 'Head of Ops', role_title: 'Head of Ops' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.renderInventoryTab();
    expect(out.toLowerCase()).toContain('no people');
    app.teardown();
  });
});
