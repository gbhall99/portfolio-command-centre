import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makeMetricGroup, resetIdSeq } from '../harness/fixtures.mjs';

describe('MetricGroups module', () => {
  it('list() returns groups for the active customer', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const groups = app.MetricGroups.list();
    expect(groups.map(g => g.id).sort()).toEqual(['customer', 'operations', 'performance']);
  });

  it('add() rejects duplicate id within the same customer', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const r = app.MetricGroups.add({ id: 'customer', name: 'Dup', swatch: '#000' });
    expect(r).toBe(null);
  });

  it('remove() refuses to remove a group with metrics still in it', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [makeMetric({ group_id: 'operations', name: 'Cost per ticket' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const ok = app.MetricGroups.remove('operations');
    expect(ok).toBe(false);
    expect(app.MetricGroups.byId('operations')).not.toBe(null);
  });

  it('remove() succeeds when no metrics reference the group', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.MetricGroups.add({ id: 'extra', name: 'Extra', swatch: '#888' });
    const ok = app.MetricGroups.remove('extra');
    expect(ok).toBe(true);
  });
});

describe('Metrics module', () => {
  it('list() returns metrics for active customer', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [
        { name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 },
        { name: 'Globex', color: '#10b981', staleThreshold: 14 },
      ],
      metrics: [
        makeMetric({ name: 'Revenue', customer: 'Acme Industries' }),
        makeMetric({ name: 'Other', customer: 'Globex' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Metrics.list().map(m => m.name)).toEqual(['Revenue']);
  });

  it('add() seeds defaults for status, dimensions, raci, group_id', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const m = app.Metrics.add({ name: 'New metric' });
    expect(m.status).toBe('draft');
    expect(m.group_id).toBe('performance'); // first available default group
    expect(Array.isArray(m.dimensions)).toBe(true);
    expect(m.raci).toEqual({ accountable: [], responsible: [], consulted: [], informed: [] });
  });

  it('add() rejects metric whose group_id is unknown for the customer', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const m = app.Metrics.add({ name: 'Bad', group_id: 'nonexistent' });
    expect(m).toBe(null);
  });

  it('remove() removes any holdings of the deleted metric from all personas', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [makeMetric({ id: 'M1', name: 'Doomed' })],
      personas: [{
        id: 'P1', customer: 'Acme Industries', name: 'Holder',
        metric_holdings: [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }],
        parent_persona_id: null, business_questions: [],
      }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Metrics.remove('M1');
    expect(app.Personas.byId('P1').metric_holdings).toHaveLength(0);
  });
});
