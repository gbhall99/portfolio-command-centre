// WSJF (SAFe) + MoSCoW prioritisation. Falls back to the legacy hybrid score when
// the project has no WSJF inputs populated.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.calculateWsjf', () => {
  it('computes CoD / size with half-up rounding and high confidence when all inputs populated', async () => {
    const app = await loadApp();
    const w = app.App.calculateWsjf({
      business_value: 8,
      time_criticality: 6,
      risk_reduction_opportunity: 4,
      size_total: 9
    });
    expect(w.cod).toBe(18);
    expect(w.size).toBe(9);
    expect(w.wsjf).toBe(2);
    expect(w.confidence).toBe('high');
    app.teardown();
  });

  it('reports low confidence when no inputs are populated', async () => {
    const app = await loadApp();
    const w = app.App.calculateWsjf({ size_total: 5 });
    expect(w.wsjf).toBe(0);
    expect(w.confidence).toBe('low');
    app.teardown();
  });

  it('size floors at 1 to avoid divide-by-zero', async () => {
    const app = await loadApp();
    const w = app.App.calculateWsjf({ business_value: 10, time_criticality: 10, risk_reduction_opportunity: 10, size_total: 0 });
    expect(w.size).toBe(1);
    expect(w.wsjf).toBe(30);
    app.teardown();
  });
});

describe('App.moscowBand', () => {
  it('orders Must < Should < Could < Won\u2019t with Could as default', async () => {
    const app = await loadApp();
    expect(app.App.moscowBand({ moscow: 'Must' })).toBe(0);
    expect(app.App.moscowBand({ moscow: 'Should' })).toBe(1);
    expect(app.App.moscowBand({ moscow: 'Could' })).toBe(2);
    expect(app.App.moscowBand({ moscow: 'Won\u2019t' })).toBe(3);
    expect(app.App.moscowBand({})).toBe(2);
    app.teardown();
  });
});

describe('Solver — Issue 2 sort integration', () => {
  it('a WSJF-populated, MoSCoW=Must project beats an untagged project with lower priority integer', async () => {
    resetIdSeq();
    const sprints = (() => { const start = new Date(); start.setDate(start.getDate() + 7); return makeSprintSequence(4, start.toISOString().slice(0, 10)); })();
    const highWsjf = makeProject({
      id: 'GCC-HI', name: 'HighValue', priority: 5,
      moscow: 'Must', business_value: 10, time_criticality: 8, risk_reduction_opportunity: 6,
      size_engineering: 3, delivery_config: { phase_order: ['Data Engineering'] }
    });
    const lowPriority = makeProject({
      id: 'GCC-LO', name: 'LowValue', priority: 1,
      size_engineering: 3, delivery_config: { phase_order: ['Data Engineering'] }
    });
    const bob = makeMember({ name: 'Bob', primary_skills: ['Data Engineering'], available_points_per_sprint: 3 });
    const app = await loadApp(makeDataset({
      projects: [lowPriority, highWsjf], sprints, team_members: [bob]
    }));
    const settings = { ...app.Sprint.allocSettings };
    const plan = app.Solver.solve('GCC', settings, app.App.data, app.Sprint);

    // Earliest sprint with any allocation for HI must be ≤ earliest for LO.
    const firstSprintIdx = (pid) => {
      const arr = (plan.allocations[pid] && plan.allocations[pid].size_engineering) || [];
      if (!arr.length) return Infinity;
      return Math.min(...arr.map(sp => sprints.findIndex(s => s.sprint_id === sp.sprint)));
    };
    expect(firstSprintIdx('GCC-HI')).toBeLessThanOrEqual(firstSprintIdx('GCC-LO'));
    app.teardown();
  });
});
