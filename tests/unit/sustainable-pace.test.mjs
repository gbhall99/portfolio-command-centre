import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Sustainable pace alert', () => {
  it('flags a member at >=90% for 3+ consecutive sprints', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(4);
    const member = makeMember({ name: 'Alice', available_points_per_sprint: 10 });
    const proj = makeProject({
      name: 'Hot', size_engineering: 36,
      skill_splits: {
        size_engineering: sprints.slice(0, 3).map(s => ({
          sprint: s.sprint_id, points: 10, status: 'pending', completed: 0,
          assigned_to: [{ member: 'Alice', points: 10 }],
          reasons: []
        }))
      }
    });
    proj.size_total = 36;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [member] }));
    const flagged = app.Capacity.computeSustainedHighLoad('GCC');
    expect(flagged.length).toBe(1);
    expect(flagged[0].member).toBe('Alice');
    expect(flagged[0].consecutiveSprints).toBeGreaterThanOrEqual(3);
    app.teardown();
  });

  it('does NOT flag members with intermittent peaks', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(4);
    const member = makeMember({ name: 'Bob', available_points_per_sprint: 10 });
    const proj = makeProject({
      name: 'Spiky', size_engineering: 20,
      skill_splits: {
        size_engineering: [
          { sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [{ member: 'Bob', points: 10 }], reasons: [] },
          { sprint: sprints[2].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [{ member: 'Bob', points: 10 }], reasons: [] }
        ]
      }
    });
    proj.size_total = 20;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [member] }));
    const flagged = app.Capacity.computeSustainedHighLoad('GCC');
    expect(flagged.length).toBe(0);
    app.teardown();
  });
});
