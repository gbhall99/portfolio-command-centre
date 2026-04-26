import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Gantt baseline → current arrows', () => {
  it('renders a connector when target_date moved', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'Slipped',
      start_date: '2026-01-05', target_date: '2026-02-09',
      baseline_start: '2026-01-05', baseline_end: '2026-01-26',
      size_engineering: 5
    });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    const checkbox = app.window.document.getElementById('ganttBaseline');
    if (checkbox) checkbox.checked = true;
    app.Gantt.render();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/baseline-arrow/);
    app.teardown();
  });
});
