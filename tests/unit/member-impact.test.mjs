import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Member impact simulator', () => {
  it('returns a diff showing reduced supply when a member is removed', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'P', size_engineering: 30,
      skill_splits: { size_engineering: [
        { sprint: sprints[0].sprint_id, points: 15, status: 'pending', completed: 0, assigned_to: [{ member: 'Alice', points: 15 }], reasons: [] },
        { sprint: sprints[1].sprint_id, points: 15, status: 'pending', completed: 0, assigned_to: [{ member: 'Alice', points: 15 }], reasons: [] }
      ]}
    });
    proj.size_total = 30;
    const alice = makeMember({ name: 'Alice', available_points_per_sprint: 18 });
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [alice] }));
    const result = app.Capacity.simulateMemberImpact('Alice', sprints[1].sprint_id);
    expect(result.before.totalSupply).toBeGreaterThan(result.after.totalSupply);
    expect(Array.isArray(result.affectedSprints)).toBe(true);
    expect(result.affectedSprints.length).toBeGreaterThan(0);
    app.teardown();
  });
});
