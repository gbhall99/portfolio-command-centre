// Foundational smoke test — if this doesn't pass, nothing else will.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makePersona, makeObjective, makeMetric, makeMetricGroup, makeHolding } from '../harness/fixtures.mjs';

describe('harness smoke', () => {
  let app;
  beforeAll(async () => { app = await loadApp(); });
  afterAll(() => app.teardown());

  it('exposes all subsystem globals', () => {
    expect(app.App).toBeDefined();
    expect(app.Solver).toBeDefined();
    expect(app.Sprint).toBeDefined();
    expect(app.Dashboard).toBeDefined();
    expect(app.Gantt).toBeDefined();
    expect(app.Capacity).toBeDefined();
    expect(app.Governance).toBeDefined();
    expect(app.DetailPanel).toBeDefined();
    expect(app.AuditPanel).toBeDefined();
  });

  it('hydrates App.data from portfolio-data.json', () => {
    expect(Array.isArray(app.App.data.projects)).toBe(true);
    expect(app.App.data.projects.length).toBeGreaterThan(0);
  });

  it('settings defaults are populated', () => {
    expect(app.App.data.settings.scheduler).toBeDefined();
    expect(app.App.data.settings.scoring).toBeDefined();
    expect(app.App.data.settings.scheduler.defaultDevDays).toBe(20);
    expect(app.App.data.settings.scheduler.daysPerSPMultiplier).toBe(1);
  });

  it('computeRecommendedPriorities populates recommended_priority on load', () => {
    const activeWithRec = app.App.data.projects.filter(p =>
      p.status !== 'Complete' && p.status !== 'Closed' && p.recommended_priority
    );
    expect(activeWithRec.length).toBeGreaterThan(0);
  });
});

describe('strategy fixtures', () => {
  it('makePersona returns persona with required fields', () => {
    const p = makePersona({ name: 'Sarah Chen', role_title: 'CFO' });
    expect(p.id).toBeTruthy();
    expect(p.name).toBe('Sarah Chen');
    expect(p.customer).toBe('Acme Industries');
    expect(Array.isArray(p.metric_holdings)).toBe(true);
  });

  it('makeMetric returns metric with default group_id and dimensions', () => {
    const m = makeMetric({ name: 'Revenue' });
    expect(m.group_id).toBe('performance');
    expect(m.status).toBe('live');
    expect(Array.isArray(m.dimensions)).toBe(true);
    expect(Array.isArray(m.objective_ids)).toBe(true);
    expect(m.raci).toBeDefined();
  });

  it('makeHolding returns holding with empty filter and targets', () => {
    const h = makeHolding({ metric_id: 'M-001' });
    expect(h.id).toBeTruthy();
    expect(h.metric_id).toBe('M-001');
    expect(h.filter).toEqual({});
    expect(h.targets).toEqual([]);
  });
});
