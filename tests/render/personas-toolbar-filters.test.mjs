import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Personas tab toolbar', () => {
  it('renders search, status, RACI involvement, dimension, target period filters', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'P1', name: 'Sarah Chen' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.renderInventoryTab();
    expect(out).toMatch(/search/i);
    expect(out).toMatch(/status/i);
    expect(out).toMatch(/raci/i);
    expect(out).toMatch(/dimension/i);
    expect(out).toMatch(/period/i);
    app.teardown();
  });

  it('applyFilters returns subset matching status=draft', async () => {
    resetIdSeq();
    const m1 = makeMetric({ id: 'M1', name: 'Live one',  status: 'live'  });
    const m2 = makeMetric({ id: 'M2', name: 'Draft one', status: 'draft' });
    const sarah = makePersona({ id: 'P1', name: 'Sarah' });
    const tom   = makePersona({ id: 'P2', name: 'Tom' });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }];
    tom.metric_holdings   = [{ id: 'H2', metric_id: 'M2', filter: {}, targets: [] }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah, tom], metrics: [m1, m2],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.applyFilters({ status: 'draft' });
    expect(out.map(p => p.id)).toEqual(['P2']);
    app.teardown();
  });

  it('applyFilters with raciInvolved filter returns personas in that RACI bucket', async () => {
    resetIdSeq();
    const m = makeMetric({ id: 'M1', name: 'Total opex', raci: { accountable: [], responsible: [], consulted: ['P3'], informed: [] } });
    const sarah = makePersona({ id: 'P1', name: 'Sarah' });
    const mei   = makePersona({ id: 'P3', name: 'Mei' });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah, mei], metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.applyFilters({ raciInvolved: 'P3' });
    expect(out.map(p => p.id)).toEqual(['P3']);
    app.teardown();
  });
});
