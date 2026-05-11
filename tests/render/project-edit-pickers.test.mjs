import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePersona, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

describe('Project edit form — strategy pickers', () => {
  it('DetailPanel renders persona/metric pickers in the edit form', async () => {
    resetIdSeq();
    const project = makeProject({ id: 'PR1', name: 'Q3 refresh' });
    const m = makeMetric({ id: 'M1', name: 'Revenue', group_id: 'performance' });
    const p = makePersona({ id: 'P1', name: 'Sarah Chen' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      projects: [project], metrics: [m], personas: [p],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const html = app.DetailPanel.renderStrategyEditFields(project);
    expect(html).toContain('Revenue');
    expect(html).toContain('Sarah Chen');
    expect(html).toMatch(/metric_ids/);
    expect(html).toMatch(/persona_ids/);
    app.teardown();
  });
});
