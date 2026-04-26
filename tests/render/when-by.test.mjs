import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

describe('When-by modal', () => {
  it('opens with input fields and renders an answer when computed', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(6);
    const histProj = makeProject({
      name: 'History', size_engineering: 60,
      skill_splits: {
        size_engineering: [
          { sprint: sprints[0].sprint_id, points: 30, status: 'complete', completed: 30, assigned_to: [], reasons: [] },
          { sprint: sprints[1].sprint_id, points: 30, status: 'complete', completed: 30, assigned_to: [], reasons: [] }
        ]
      }
    });
    histProj.size_total = 60;
    const app = await loadApp(makeDataset({ projects: [histProj], sprints, team_members: [makeMember({ available_points_per_sprint: 30 })] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Dashboard.openWhenByModal();
    const overlay = app.window.document.getElementById('whenByOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay.innerHTML).toMatch(/When by\?/);
    const sizeInput = app.window.document.getElementById('wbSize');
    sizeInput.value = '30';
    app.Dashboard._runWhenBy();
    const out = app.window.document.getElementById('whenByOutput');
    expect(out.innerHTML).toMatch(/sprints/);
    app.teardown();
  });
});
