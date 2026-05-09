import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeObjective, makeMetric, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

describe('Rollups', () => {
  async function setupCustomerWithCascade() {
    resetIdSeq();
    const sarah = makePersona({ id: 'P-CFO',  name: 'Sarah Chen', role_title: 'CFO',  parent_persona_id: null });
    const diane = makePersona({ id: 'P-RGM',  name: 'Diane',      role_title: 'GM N', parent_persona_id: 'P-CFO' });
    const obj   = makeObjective({ id: 'O-REV', name: 'Grow regional revenue 12%' });
    const met   = makeMetric({ id: 'M-REV', name: 'Revenue', dimensions: ['region'], objective_ids: ['O-REV'] });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M-REV', filter: {},                 targets: [{ period: '2026', value: 400, period_type: 'annual' }] }];
    diane.metric_holdings = [{ id: 'H2', metric_id: 'M-REV', filter: { region: 'North' },targets: [{ period: '2026', value: 200, period_type: 'annual' }] }];
    const project = makeProject({ id: 'PR-1', name: 'Q3 reporting refresh', metric_ids: ['M-REV'], persona_ids: [] });
    return loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah, diane],
      objectives: [obj],
      metrics: [met],
      projects: [project],
    }));
  }

  it('Personas.rollup returns held metrics + derived objectives + supporting projects', async () => {
    const app = await setupCustomerWithCascade();
    app.App.activeCustomer = 'Acme Industries';
    const r = app.Personas.rollup('P-CFO');
    expect(r.holdings).toHaveLength(1);
    expect(r.held_metrics.map(m => m.id)).toEqual(['M-REV']);
    expect(r.contributing_objectives.map(o => o.id)).toEqual(['O-REV']);
    expect(r.supporting_projects.map(p => p.id)).toEqual(['PR-1']);
    expect(r.descendants.map(p => p.id)).toEqual(['P-RGM']);
  });

  it('Objectives.rollup returns measuring metrics + contributing personas + delivering projects', async () => {
    const app = await setupCustomerWithCascade();
    app.App.activeCustomer = 'Acme Industries';
    const r = app.Objectives.rollup('O-REV');
    expect(r.measuring_metrics.map(m => m.id)).toEqual(['M-REV']);
    expect(r.contributing_personas.map(p => p.id).sort()).toEqual(['P-CFO', 'P-RGM']);
    expect(r.delivering_projects.map(p => p.id)).toEqual(['PR-1']);
    expect(r.metric_count).toBe(1);
  });

  it('Metrics.rollup returns holders with filter + served objectives + delivering projects', async () => {
    const app = await setupCustomerWithCascade();
    app.App.activeCustomer = 'Acme Industries';
    const r = app.Metrics.rollup('M-REV');
    expect(r.holder_count).toBe(2);
    const holders = r.holders.map(h => ({ persona: h.persona.id, filter: h.holding.filter }));
    expect(holders).toEqual([
      { persona: 'P-CFO', filter: {} },
      { persona: 'P-RGM', filter: { region: 'North' } },
    ]);
    expect(r.served_objectives.map(o => o.id)).toEqual(['O-REV']);
    expect(r.delivering_projects.map(p => p.id)).toEqual(['PR-1']);
    expect(r.has_targets_anywhere).toBe(true);
  });
});
