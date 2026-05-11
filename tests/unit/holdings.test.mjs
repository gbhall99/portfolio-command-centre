import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Holdings helpers', () => {
  it('addHolding rejects unknown metric_id', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'P1' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const h = app.Personas.addHolding('P1', { metric_id: 'NOPE' });
    expect(h).toBe(null);
  });

  it('addHolding rejects filter keys not in metric.dimensions', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'P1' })],
      metrics: [makeMetric({ id: 'M1', dimensions: ['region'] })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const h = app.Personas.addHolding('P1', { metric_id: 'M1', filter: { product: 'X' } });
    expect(h).toBe(null);
  });

  it('addHolding succeeds with valid filter and assigns id', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'P1' })],
      metrics: [makeMetric({ id: 'M1', dimensions: ['region'] })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const h = app.Personas.addHolding('P1', { metric_id: 'M1', filter: { region: 'North' }, targets: [{ period: '2026', value: 100, period_type: 'annual' }] });
    expect(h).toBeTruthy();
    expect(h.id).toBeTruthy();
    expect(app.Personas.byId('P1').metric_holdings).toHaveLength(1);
  });

  it('updateHolding replaces filter and targets', async () => {
    resetIdSeq();
    const persona = makePersona({ id: 'P1' });
    persona.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: { region: 'North' }, targets: [], notes: '' }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona],
      metrics: [makeMetric({ id: 'M1', dimensions: ['region'] })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Personas.updateHolding('P1', 'H1', { filter: { region: 'South' } });
    expect(app.Personas.byId('P1').metric_holdings[0].filter.region).toBe('South');
  });

  it('removeHolding removes the holding by id', async () => {
    resetIdSeq();
    const persona = makePersona({ id: 'P1' });
    persona.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [], notes: '' }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona],
      metrics: [makeMetric({ id: 'M1' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Personas.removeHolding('P1', 'H1');
    expect(app.Personas.byId('P1').metric_holdings).toHaveLength(0);
  });
});
