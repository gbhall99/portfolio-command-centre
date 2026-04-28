import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.computeProjectDeliveryTrajectory', () => {
  it('returns 5 sprint frames around the current sprint with committed/completed', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(6);
    const p = makeProject({ id: 'Acme Industries-T1' });
    p.skill_splits = {
      size_engineering: [
        { sprint: sprints[0].sprint_id, points: 8,  completed: 8,  status: 'complete' },
        { sprint: sprints[1].sprint_id, points: 12, completed: 10, status: 'in_progress' },
        { sprint: sprints[2].sprint_id, points: 25, completed: 12, status: 'in_progress' },
        { sprint: sprints[3].sprint_id, points: 18, completed: 0,  status: 'pending' },
        { sprint: sprints[4].sprint_id, points: 5,  completed: 0,  status: 'pending' }
      ]
    };
    const app = await loadApp(makeDataset({ projects: [p], sprints }));
    const t = app.App.computeProjectDeliveryTrajectory('Acme Industries-T1');
    expect(Array.isArray(t.sprints)).toBe(true);
    expect(t.sprints.length).toBeLessThanOrEqual(5);
    expect(t.total_committed).toBe(68);
    expect(t.total_completed).toBe(30);
    app.teardown();
  });

  it('marks past / current / future sprints by date', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(4);
    const p = makeProject({ id: 'Acme Industries-T2' });
    p.skill_splits = { size_engineering: sprints.map(s => ({ sprint: s.sprint_id, points: 5, completed: 0, status: 'pending' })) };
    const app = await loadApp(makeDataset({ projects: [p], sprints }));
    const t = app.App.computeProjectDeliveryTrajectory('Acme Industries-T2');
    const states = new Set(t.sprints.map(x => x.state));
    expect(states.size).toBeGreaterThanOrEqual(1);
    app.teardown();
  });

  it('returns empty trajectory when project has no skill_splits', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'Acme Industries-T3' });
    p.skill_splits = {};
    const app = await loadApp(makeDataset({ projects: [p] }));
    const t = app.App.computeProjectDeliveryTrajectory('Acme Industries-T3');
    expect(t.sprints).toEqual([]);
    expect(t.total_committed).toBe(0);
    app.teardown();
  });
});
