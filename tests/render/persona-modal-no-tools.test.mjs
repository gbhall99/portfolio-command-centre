import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Persona modal — slim down (post-Person rework)', () => {
  it('does not render tools, decisions_owned, or held-metrics display sections', async () => {
    resetIdSeq();
    const persona = makePersona({
      id: 'P1', name: 'CFO',
      // Set values on the legacy fields — they should be migrated away,
      // but even if a stale field hung around, the modal must not surface it.
      goals: 'Drive margin', pain_points: 'Slow close',
      metric_holdings: [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }],
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], metrics: [makeMetric({ id: 'M1', name: 'Revenue' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.renderDetailBody('P1');

    // Removed sections / fields.
    expect(out).not.toMatch(/data-persona-field="tools"/);
    expect(out).not.toMatch(/data-persona-field="decisions"/);
    expect(out.toLowerCase()).not.toContain('decisions owned');
    expect(out.toLowerCase()).not.toContain('held metrics');
    // Held-metric add affordance also gone.
    expect(out).not.toMatch(/Personas\._addHoldingPrompt/);

    // What stays.
    expect(out).toContain('Goals');
    expect(out).toContain('Pain points');
    expect(out).toContain('Information needs');
    expect(out).toContain('Assigned people');
    expect(out).toContain('RACI defaults');
    app.teardown();
  });
});
