import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeObjective, makeMetric, makePersona, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — Objectives inventory', () => {
  it('renders objective entries with derived counts', async () => {
    resetIdSeq();
    const obj = makeObjective({ id: 'O1', name: 'Reduce opex 15%', description: 'Drive opex efficiencies.', status: 'active',
      time_horizon: { start_date: '2025-06-01', target_date: '2026-05-31' } });
    const m  = makeMetric({ id: 'M1', name: 'Total opex', objective_ids: ['O1'] });
    const persona = makePersona({ id: 'P1' });
    persona.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }];
    const project = makeProject({ id: 'PR1', metric_ids: ['M1'] });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      objectives: [obj], metrics: [m], personas: [persona], projects: [project],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Objectives.renderInventoryTab();
    expect(out).toContain('Reduce opex 15%');
    expect(out).toContain('Total opex');
    expect(out).toMatch(/1.*metrics?/);
    expect(out).toMatch(/1.*personas?/);
    expect(out).toMatch(/1.*projects?/);
    expect(out).toContain('2025-06-01');
    expect(out).toContain('2026-05-31');
    expect(out).not.toContain('Uncovered');
    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-objectives.html');
    app.teardown();
  });
});
