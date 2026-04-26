// Named baselines must capture per-project dates and sizes alongside skill_splits,
// so a single Set Baseline drives the variance report AND the movers legend.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function setup() {
  resetIdSeq();
  const sprints = makeSprintSequence(3);
  const proj = makeProject({
    name: 'Dated project',
    size_engineering: 10,
    start_date: '2026-04-01',
    target_date: '2026-06-30',
    hard_deadline: '2026-07-15',
    skill_splits: {
      size_engineering: [
        { sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [], reasons: [] }
      ]
    }
  });
  proj.size_total = 10;
  const app = await loadApp(makeDataset({
    projects: [proj], sprints, team_members: [makeMember()]
  }));
  app.App.prompt = async () => 'April commit';
  return { app, proj };
}

describe('Named baseline — extended snapshot', () => {
  it('captures dates and sizes per project, not just skill_splits', async () => {
    const { app, proj } = await setup();
    await app.Gantt.openSetBaseline();
    const baselines = app.App.data.baselines || [];
    expect(baselines).toHaveLength(1);
    const snap = baselines[0].snapshot[proj.id];
    expect(snap).toBeDefined();
    expect(snap.skill_splits).toBeDefined();
    expect(snap.start_date).toBe('2026-04-01');
    expect(snap.target_date).toBe('2026-06-30');
    expect(snap.hard_deadline).toBe('2026-07-15');
    expect(snap.size_total).toBe(10);
    expect(snap.size_engineering).toBe(10);
    app.teardown();
  });
});
