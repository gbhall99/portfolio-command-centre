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
