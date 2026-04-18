// Foundational smoke test — if this doesn't pass, nothing else will.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';

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
