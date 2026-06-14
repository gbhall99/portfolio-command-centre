// Phase 3.3 — metric-insight narration (+ confirming the data-derived
// success_story report). Movement/target/RACI/objective facts are resolved from
// the cascade; every figure is recorded data, never invented. Mock adapter only.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeMetric, makePersona, makePerson, makeObjective, resetIdSeq } from '../harness/fixtures.mjs';

let app;

function fixture(extra) {
  resetIdSeq();
  return makeDataset(Object.assign({
    customers: [{ name: 'Acme Industries' }, { name: 'Globex' }],
    projects: [makeProject({ id: 'A-1', name: 'NPS Dashboard', customer: 'Acme Industries', metric_ids: ['MET-1'], description: 'Lift advocacy', size_engineering: 8 })],
    objectives: [makeObjective({ id: 'OBJ-1', name: 'Grow advocacy', customer: 'Acme Industries' })],
    personas: [makePersona({ id: 'PER-1', name: 'CFO', customer: 'Acme Industries', metric_holdings: [{ metric_id: 'MET-1', role: 'accountable', targets: [{ period: 'Q4', value: 40, period_type: 'quarter' }] }] })],
    people: [makePerson({ id: 'PRSN-1', name: 'Jane Doe', customer: 'Acme Industries', persona_id: 'PER-1' })],
    metrics: [makeMetric({
      id: 'MET-1', name: 'NPS', customer: 'Acme Industries', unit: 'pts', direction: 'higher_is_better',
      objective_ids: ['OBJ-1'],
      raci: { accountable: ['PRSN-1'], responsible: [], consulted: [], informed: [] },
      actuals: [{ period: 'Q1', value: 20 }, { period: 'Q2', value: 32 }]
    })]
  }, extra || {}));
}

const ctx = (over) => Object.assign({ customer: 'Acme Industries', allScope: false, citations: [], proposals: [] }, over || {});

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('Metrics.insightFor', () => {
  it('computes grounded movement, target, objectives, RACI and delivering projects', () => {
    const i = app.Metrics.insightFor('MET-1');
    expect(i.name).toBe('NPS');
    expect(i.has_actuals).toBe(true);
    expect(i.movement).toEqual({ from: 20, to: 32, delta: 12, direction: 'improved' });
    expect(i.target).toMatchObject({ period: 'Q4', value: 40, held_by: 'CFO' });
    expect(i.objectives).toEqual(['Grow advocacy']);
    expect(i.accountable).toEqual(['Jane Doe']);
    expect(i.delivering_projects).toEqual([{ id: 'A-1', name: 'NPS Dashboard' }]);
  });

  it('respects direction — a rise in a lower_is_better metric is "worsened"', () => {
    app.App.data.metrics[0].direction = 'lower_is_better';
    app.App.data.metrics[0].actuals = [{ period: 'Q1', value: 10 }, { period: 'Q2', value: 15 }];
    expect(app.Metrics.insightFor('MET-1').movement.direction).toBe('worsened');
  });

  it('is honest when there are no actuals', () => {
    app.App.data.metrics[0].actuals = [];
    const i = app.Metrics.insightFor('MET-1');
    expect(i.has_actuals).toBe(false);
    expect(i.movement).toBeNull();
    expect(app.Metrics.movementSummary('MET-1')).toMatch(/no actuals recorded/);
  });

  it('movementSummary narrates only recorded figures', () => {
    const s = app.Metrics.movementSummary('MET-1');
    expect(s).toContain('NPS improved from 20 pts to 32 pts');
    expect(s).toContain('target 40 pts (Q4)');
    expect(s).toContain('serves Grow advocacy');
    expect(s).toContain('accountable: Jane Doe');
  });
});

describe('metric_insight tool', () => {
  it('returns grounded facts and cites the metric + delivering projects', () => {
    const c = ctx();
    const r = app.AgentTools.invoke('metric_insight', { metric_id: 'MET-1' }, c);
    expect(r.error).toBeUndefined();
    expect(r.movement.to).toBe(32);
    expect(r.note).toMatch(/do not invent/i);
    expect(c.citations.some(x => x.type === 'metric' && x.id === 'MET-1')).toBe(true);
    expect(c.citations.some(x => x.type === 'project' && x.id === 'A-1')).toBe(true);
  });

  it('refuses a metric from another customer', () => {
    app.App.data.metrics.push(makeMetric({ id: 'G-MET', name: 'Globex KPI', customer: 'Globex' }));
    expect(app.AgentTools.invoke('metric_insight', { metric_id: 'G-MET' }, ctx()).error).toMatch(/No metric with id/);
  });

  it('notes the absence of actuals instead of inventing a value', () => {
    app.App.data.metrics[0].actuals = [];
    const r = app.AgentTools.invoke('metric_insight', { metric_id: 'MET-1' }, ctx());
    expect(r.has_actuals).toBe(false);
    expect(r.note).toMatch(/No actuals recorded/);
  });
});

describe('success_story report (data-derived)', () => {
  it('builds a doc whose Outcomes section carries the grounded metric movement', () => {
    const doc = app.Reports.Builders.successStory('A-1');
    expect(doc).not.toBeNull();
    expect(doc.reportType).toBe('success_story');
    const outcomes = doc.sections.find(s => s.id === 'ss-outcomes');
    expect(outcomes).toBeTruthy();
    expect(outcomes.html).toContain('NPS improved from 20 pts to 32 pts');
  });

  it('escapes metric names in the rendered report (XSS hygiene)', () => {
    app.App.data.metrics[0].name = '<script>alert(1)</script>';
    const doc = app.Reports.Builders.successStory('A-1');
    const outcomes = doc.sections.find(s => s.id === 'ss-outcomes');
    expect(outcomes.html).not.toContain('<script>alert(1)</script>');
    expect(outcomes.html).toContain('&lt;script&gt;');
  });

  it('the generate_report tool still enumerates success_story', () => {
    const def = app.AgentTools.defs().find(d => d.name === 'generate_report');
    expect(def.parameters.properties.report_type.enum).toContain('success_story');
  });
});
