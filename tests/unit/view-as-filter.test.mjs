import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('View-as filter', () => {
  it('App.isAssignedTo(p, member) returns true when any split is assigned', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'X', size_engineering: 10,
      skill_splits: { size_engineering: [
        { sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [{ member: 'Alice', points: 10 }], reasons: [] }
      ]}
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember({ name: 'Alice' })] }));
    expect(app.App.isAssignedTo(proj, 'Alice')).toBe(true);
    expect(app.App.isAssignedTo(proj, 'Bob')).toBe(false);
    app.teardown();
  });

  it('viewAsMember setter updates state', async () => {
    const app = await loadApp(makeDataset({}));
    app.App.setViewAsMember('Alice');
    expect(app.App.viewAsMember).toBe('Alice');
    app.App.setViewAsMember(null);
    expect(app.App.viewAsMember).toBeFalsy();
    app.teardown();
  });
});
