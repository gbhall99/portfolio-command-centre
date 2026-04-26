// HTML shape of the Gap panel — skill rows, sprint cells, totals + FTE column.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

describe('Capacity.renderResourcingGap', () => {
  it('renders a gap table with skill rows, sprint cells, FTE column', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({
      name: 'Hungry', size_engineering: 50,
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
    // Production HTML already includes #capacityGapPanel; reuse it.
    let host = app.window.document.getElementById('capacityGapPanel');
    if (!host) {
      host = app.window.document.createElement('div');
      host.id = 'capacityGapPanel';
      app.window.document.body.appendChild(host);
    }
    app.Capacity.renderResourcingGap('GCC');
    expect(host.innerHTML).toMatch(/Resourcing Gap/);
    expect(host.innerHTML).toMatch(/Data Engineering/);
    expect(host.innerHTML).toMatch(/-14/);
    expect(host.innerHTML).toMatch(/FTE/);
    expect(host.innerHTML).toMatch(/-12/);
    app.teardown();
  });
});
