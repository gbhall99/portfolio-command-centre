// Auto-Allocate Cancel must restore App.data.projects[*].skill_splits to the exact
// snapshot taken when the alloc results overlay opened. Defensive: covers the case
// where any preview path mutates live data before the user clicks Cancel.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function setup() {
  resetIdSeq();
  const sprints = makeSprintSequence(3);
  const proj = makeProject({
    name: 'Pre-existing splits',
    size_engineering: 10,
    skill_splits: {
      size_engineering: [
        { sprint: sprints[0].sprint_id, points: 6, status: 'pending', completed: 0, assigned_to: [], reasons: [] },
        { sprint: sprints[1].sprint_id, points: 4, status: 'pending', completed: 0, assigned_to: [], reasons: [] }
      ]
    }
  });
  proj.size_total = 10;
  const member = makeMember({ name: 'Alice', available_points_per_sprint: 12 });
  const app = await loadApp(makeDataset({
    projects: [proj], sprints, team_members: [member]
  }));
  return { app, proj };
}

describe('Auto-Allocate Cancel — snapshot/restore helpers', () => {
  it('Sprint._snapshotSkillSplits returns a deep clone scoped to active customer', async () => {
    const { app, proj } = await setup();
    const before = app.Sprint._snapshotSkillSplits();
    proj.skill_splits.size_engineering[0].points = 999;
    expect(before[proj.id].size_engineering[0].points).toBe(6);
    app.teardown();
  });

  it('Sprint._restoreSkillSplits writes the snapshot back into App.data', async () => {
    const { app, proj } = await setup();
    const snap = app.Sprint._snapshotSkillSplits();
    proj.skill_splits = { size_engineering: [{ sprint: 'CY26-S3', points: 99, status: 'pending', completed: 0, assigned_to: [], reasons: [] }] };
    app.Sprint._restoreSkillSplits(snap);
    expect(proj.skill_splits.size_engineering).toHaveLength(2);
    expect(proj.skill_splits.size_engineering[0].points).toBe(6);
    expect(proj.skill_splits.size_engineering[1].points).toBe(4);
    app.teardown();
  });
});

describe('Auto-Allocate Cancel — lifecycle', () => {
  it('autoAllocate captures a snapshot, closeAllocResults restores it', async () => {
    const { app, proj } = await setup();
    const originalLen = proj.skill_splits.size_engineering.length;

    app.Sprint.autoAllocate();
    expect(app.Sprint._allocPreviewSnapshot).not.toBeNull();
    expect(app.Sprint._allocPreviewSnapshot[proj.id]).toBeDefined();

    proj.skill_splits = {};

    app.Sprint.closeAllocResults();
    expect(app.Sprint._allocPreviewSnapshot).toBeNull();
    expect(proj.skill_splits.size_engineering).toHaveLength(originalLen);
    app.teardown();
  });

  it('applyAllocation clears the snapshot (commit semantics, no rollback)', async () => {
    const { app, proj } = await setup();
    app.Sprint.autoAllocate();
    app.Sprint.pendingAllocation = {
      allocations: { [proj.id]: { size_engineering: [{ sprint: 'CY26-S1', points: 10, status: 'pending', completed: 0, assigned_to: [], reasons: [] }] } },
      warnings: [],
      stats: { projectsAllocated: 1, makespan: 1, totalPoints: 10, avgUtilization: 0 }
    };
    app.Sprint.applyAllocation();
    expect(app.Sprint._allocPreviewSnapshot).toBeNull();
    expect(proj.skill_splits.size_engineering[0].points).toBe(10);
    app.teardown();
  });

  it('showAllocResults (back-compat path) also captures a snapshot', async () => {
    const { app } = await setup();
    const fakeResult = {
      allocations: {}, warnings: [],
      stats: { projectsAllocated: 0, makespan: 0, totalPoints: 0, avgUtilization: 0 },
      utilizationGrid: {}
    };
    app.Sprint.showAllocResults(fakeResult);
    expect(app.Sprint._allocPreviewSnapshot).not.toBeNull();
    app.Sprint.closeAllocResults();
    expect(app.Sprint._allocPreviewSnapshot).toBeNull();
    app.teardown();
  });
});
