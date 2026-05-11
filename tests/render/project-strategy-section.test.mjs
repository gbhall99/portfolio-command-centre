import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeMetric, makeObjective, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

describe('Project detail — Strategy section', () => {
  it('shows linked metrics + derived objectives + derived personas with flags', async () => {
    resetIdSeq();
    const obj = makeObjective({ id: 'O1', name: 'Grow regional revenue' });
    const m   = makeMetric({ id: 'M1', name: 'Revenue', objective_ids: ['O1'], dimensions: ['region'] });
    const sarah = makePersona({ id: 'PS', name: 'Sarah Chen' });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }];
    const diane = makePersona({ id: 'PD', name: 'Diane Yuen' });
    diane.metric_holdings = [{ id: 'H2', metric_id: 'M1', filter: { region: 'North' }, targets: [] }];
    const project = makeProject({ id: 'PR1', metric_ids: ['M1'], persona_ids: [] });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      objectives: [obj], metrics: [m], personas: [sarah, diane], projects: [project],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.DetailPanel.renderStrategySection(project);
    expect(out).toContain('Revenue');
    expect(out).toContain('Grow regional revenue');
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('Diane Yuen');
    expect(out).toMatch(/via.*Revenue/i);
    expect(out).toMatch(/region: North/);
    await expect(out).toMatchFileSnapshot('./__snapshots__/project-strategy-section.html');
    app.teardown();
  });
});
