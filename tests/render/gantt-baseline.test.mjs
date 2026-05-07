import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Gantt baseline bracket + delta pill', () => {
  async function setup({ baselineEnd, currentEnd }) {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'BaselineProj',
      start_date: '2026-01-05', target_date: currentEnd,
      baseline_start: '2026-01-05', baseline_end: baselineEnd,
      size_engineering: 5
    });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    const checkbox = app.window.document.getElementById('ganttBaseline');
    if (checkbox) checkbox.checked = true;
    app.Gantt.render();
    return app;
  }

  it('renders a bracket and a "+Nd" slip pill when target moved later', async () => {
    const app = await setup({ baselineEnd: '2026-01-26', currentEnd: '2026-02-09' });
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-baseline-bracket/);
    expect(html).toMatch(/gantt-delta-pill slip/);
    expect(html).toMatch(/\+\d+d/);
    expect(html).not.toMatch(/baseline-arrow/);
    expect(html).not.toMatch(/gantt-bar-baseline/);
    app.teardown();
  });

  it('renders a "−Nd" early pill when target moved earlier', async () => {
    const app = await setup({ baselineEnd: '2026-02-09', currentEnd: '2026-01-26' });
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-delta-pill early/);
    expect(html).toMatch(/−\d+d/);
    app.teardown();
  });

  it('renders an "on plan" pill when target unchanged', async () => {
    const app = await setup({ baselineEnd: '2026-01-26', currentEnd: '2026-01-26' });
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-delta-pill onplan/);
    expect(html).toContain('on plan');
    app.teardown();
  });
});
