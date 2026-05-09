import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

describe('migration: strategy arrays', () => {
  it('adds empty personas/objectives/metrics arrays if missing', async () => {
    const data = makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }] });
    delete data.personas; delete data.objectives; delete data.metrics; delete data.metric_groups;
    const app = await loadApp(data);
    expect(Array.isArray(app.App.data.personas)).toBe(true);
    expect(Array.isArray(app.App.data.objectives)).toBe(true);
    expect(Array.isArray(app.App.data.metrics)).toBe(true);
    expect(Array.isArray(app.App.data.metric_groups)).toBe(true);
    app.teardown();
  });

  it('seeds three default metric_groups per customer if metric_groups is empty', async () => {
    const data = makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }] });
    data.metric_groups = [];
    const app = await loadApp(data);
    const acmeGroups = app.App.data.metric_groups.filter(g => g.customer === 'Acme Industries');
    expect(acmeGroups.map(g => g.id).sort()).toEqual(['customer', 'operations', 'performance']);
    expect(acmeGroups.find(g => g.id === 'customer').name).toBe('Customer');
    expect(acmeGroups.find(g => g.id === 'performance').swatch).toBe('#c89dde');
    app.teardown();
  });

  it('does not overwrite existing metric_groups', async () => {
    const data = makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }] });
    data.metric_groups = [{ id: 'custom', name: 'Custom', swatch: '#000', customer: 'Acme Industries' }];
    const app = await loadApp(data);
    const acmeGroups = app.App.data.metric_groups.filter(g => g.customer === 'Acme Industries');
    expect(acmeGroups).toHaveLength(1);
    expect(acmeGroups[0].id).toBe('custom');
    app.teardown();
  });
});

describe('migration: project additions', () => {
  it('seeds metric_ids and persona_ids on existing projects', async () => {
    const data = makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      projects: [{ id: 'PR1', customer: 'Acme Industries', name: 'Old project', status: 'In Progress', delivery_config: { phase_order: ['Data Engineering'] } }],
    });
    const app = await loadApp(data);
    const p = app.App.data.projects.find(x => x.id === 'PR1');
    expect(Array.isArray(p.metric_ids)).toBe(true);
    expect(Array.isArray(p.persona_ids)).toBe(true);
    app.teardown();
  });
});
