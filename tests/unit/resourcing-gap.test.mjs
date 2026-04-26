// Resourcing Gap — surfaces demand vs supply per skill per sprint and
// translates the gap into FTE so a manager can walk into a hiring conversation
// with a number.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function setup() {
  resetIdSeq();
  const sprints = makeSprintSequence(2);
  const proj = makeProject({
    name: 'Hungry',
    size_engineering: 50,
    skill_splits: {
      size_engineering: [
        { sprint: sprints[0].sprint_id, points: 30, status: 'pending', completed: 0, assigned_to: [], reasons: [] },
        { sprint: sprints[1].sprint_id, points: 20, status: 'pending', completed: 0, assigned_to: [], reasons: [] }
      ]
    }
  });
  proj.size_total = 50;
  const member = makeMember({ name: 'Alice', available_points_per_sprint: 18 });
  const app = await loadApp(makeDataset({
    projects: [proj], sprints, team_members: [member]
  }));
  return { app, sprints };
}

describe('Capacity.computeResourcingGap', () => {
  it('returns per-skill, per-sprint demand / supply / gap rows', async () => {
    const { app, sprints } = await setup();
    const result = app.Capacity.computeResourcingGap('GCC');
    const de = result.bySkill.find(r => r.skillKey === 'size_engineering');
    expect(de).toBeDefined();
    expect(de.bySprint).toHaveLength(2);
    expect(de.bySprint[0]).toMatchObject({
      sprintId: sprints[0].sprint_id, demand: 30, supply: 18, gap: -12
    });
    expect(de.bySprint[1]).toMatchObject({
      sprintId: sprints[1].sprint_id, demand: 20, supply: 18, gap: -2
    });
    app.teardown();
  });

  it('aggregates total gap SP and FTE equivalent across the deficit window', async () => {
    const { app } = await setup();
    const result = app.Capacity.computeResourcingGap('GCC');
    const de = result.bySkill.find(r => r.skillKey === 'size_engineering');
    expect(de.totalGap).toBe(-14);
    expect(de.gapFte).toBeGreaterThan(0.3);
    expect(de.gapFte).toBeLessThan(0.5);
    app.teardown();
  });

  it('returns zero-FTE rows when supply meets demand', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(1);
    const proj = makeProject({
      name: 'Easy', size_engineering: 10,
      skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [], reasons: [] }] }
    });
    proj.size_total = 10;
    const member = makeMember({ name: 'Alice', available_points_per_sprint: 18 });
    const app = await loadApp(makeDataset({
      projects: [proj], sprints, team_members: [member]
    }));
    const result = app.Capacity.computeResourcingGap('GCC');
    const de = result.bySkill.find(r => r.skillKey === 'size_engineering');
    expect(de.totalGap).toBe(8);
    expect(de.gapFte).toBe(0);
    app.teardown();
  });
});
