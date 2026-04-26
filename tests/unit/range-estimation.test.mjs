import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

describe('Range estimation — schema', () => {
  it('migrateSchema seeds *_max fields equal to their point estimate when missing', async () => {
    resetIdSeq();
    const proj = makeProject({ size_engineering: 10, size_tableau: 5 });
    delete proj.size_engineering_max;
    delete proj.size_tableau_max;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    expect(app.App.data.projects[0].size_engineering_max).toBe(10);
    expect(app.App.data.projects[0].size_tableau_max).toBe(5);
    app.teardown();
  });

  it('does not overwrite an explicit *_max if already set', async () => {
    resetIdSeq();
    const proj = makeProject({ size_engineering: 10 });
    proj.size_engineering_max = 24;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    expect(app.App.data.projects[0].size_engineering_max).toBe(24);
    app.teardown();
  });
});

describe('Forecast cone widens by lifecycle_stage', () => {
  it('returns a wider P95 for a POC than for an Implementation with identical inputs', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(6);
    const sized = (stage) => {
      const p = makeProject({
        name: stage, lifecycle_stage: stage,
        size_engineering: 30,
        skill_splits: {
          size_engineering: [
            { sprint: sprints[0].sprint_id, points: 10, status: 'complete', completed: 10, assigned_to: [], reasons: [] },
            { sprint: sprints[1].sprint_id, points: 10, status: 'complete', completed: 10, assigned_to: [], reasons: [] }
          ]
        }
      });
      p.size_total = 30;
      return p;
    };
    const poc = sized('POC');
    const impl = sized('Implementation');
    const app = await loadApp(makeDataset({
      projects: [poc, impl], sprints, team_members: [makeMember({ available_points_per_sprint: 10 })]
    }));
    // Run multiple times to reduce Monte Carlo noise; expect POC>=Impl on average.
    let pocSum = 0, implSum = 0;
    for (let i = 0; i < 5; i++) {
      const pf = app.window.__pcc__.Forecast.projectForecast(poc);
      const im = app.window.__pcc__.Forecast.projectForecast(impl);
      pocSum += pf.distribution.p95;
      implSum += im.distribution.p95;
    }
    expect(pocSum).toBeGreaterThanOrEqual(implSum);
    app.teardown();
  });
});
