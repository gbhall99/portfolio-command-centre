import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Walkthrough mode', () => {
  it('opens with a one-card-per-untouched-chip queue', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({
      name: 'P', size_engineering: 10,
      skill_splits: {
        size_engineering: [{ sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [], reasons: [] }]
      }
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Sprint.openWalkthrough();
    const overlay = app.window.document.getElementById('walkthroughOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay.innerHTML).toMatch(/Walkthrough/);
    expect(overlay.innerHTML).toMatch(/Pending: <strong>10/);
    app.teardown();
  });
});
