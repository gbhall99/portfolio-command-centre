import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePersona, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

describe('Project edit form — strategy pickers (Slot B / Item 6 compact pickers)', () => {
  it('DetailPanel renders persona/metric/objective picker rows in the compact form', async () => {
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
    // Compact picker emits chip-strip rows keyed by data-field attribute.
    expect(html).toMatch(/data-field="metric_ids"/);
    expect(html).toMatch(/data-field="persona_ids"/);
    expect(html).toMatch(/data-field="objective_ids"/);
    expect(html).toMatch(/dp-strategy-section/);
    expect(html).toMatch(/dp-strategy-add/);
    app.teardown();
  });

  it('options for metrics/personas are present in the picker popover when opened', async () => {
    resetIdSeq();
    const project = makeProject({ id: 'PR2', name: 'Q4 refresh' });
    const m = makeMetric({ id: 'M2', name: 'Revenue', group_id: 'performance' });
    const p = makePersona({ id: 'P2', name: 'Sarah Chen' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1' }],
      projects: [project], metrics: [m], personas: [p],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.open('PR2');
    app.DetailPanel._openStrategyPicker('metric_ids', 'metric');
    const pop = app.document.getElementById('dpStrategyPopover');
    expect(pop.textContent).toContain('Revenue');
    app.DetailPanel._closeStrategyPicker();
    app.DetailPanel._openStrategyPicker('persona_ids', 'persona');
    const pop2 = app.document.getElementById('dpStrategyPopover');
    expect(pop2.textContent).toContain('Sarah Chen');
    app.DetailPanel._closeStrategyPicker();
    app.teardown();
  });
});
