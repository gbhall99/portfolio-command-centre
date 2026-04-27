// Issue 8 — Sprint Planning > Team view: drop the team capacity strip,
// keep only the per-member assignment swimlane.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Sprint Planning Team view — capacity strip removed', () => {
  it('Team view renders the per-member swimlane without a tv-cap-strip block', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'P1' })],
      sprints: makeSprintSequence(4),
      team_members: [makeMember({ name: 'Alex' })]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Sprint.sprintView = 'team';
    app.Sprint.viewMode = 'swimlane';
    const board = app.window.document.getElementById('sprintBoard');
    if (board) app.Sprint.renderTeamSwimlane(board);
    const html = (board && board.innerHTML) || '';
    expect(html).not.toMatch(/tv-cap-strip/);
    // Schedule swimlane is still there.
    expect(html).toMatch(/sprint-swimlane/);
    expect(html).toMatch(/Alex/);
    app.teardown();
  });
});
