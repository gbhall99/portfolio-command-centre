import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Gantt baseline v2 — project header', () => {
  async function setup({ baselineEnd, currentEnd }) {
    resetIdSeq();
    const sprints = makeSprintSequence(4);
    const proj = makeProject({
      name: 'Atlas',
      start_date: '2026-01-05', target_date: currentEnd,
      baseline_start: '2026-01-05', baseline_end: baselineEnd,
      size_engineering: 5
    });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    const cb = app.window.document.getElementById('ganttBaseline');
    if (cb) cb.checked = true;
    app.Gantt.render();
    return app;
  }

  it('renders plan lane, movement arrow, drift line and slip pill on a slipped project', async () => {
    const app = await setup({ baselineEnd: '2026-01-26', currentEnd: '2026-02-09' });
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-plan-lane/);
    expect(html).toMatch(/gantt-move-arrow/);
    expect(html).toMatch(/gantt-drift-line/);
    expect(html).toMatch(/gantt-delta-pill slip/);
    expect(html).toMatch(/\+\d+(d|w)/);
    expect(html).not.toMatch(/gantt-baseline-bracket/);
    expect(html).not.toMatch(/gantt-baseline-spine/);
    expect(html).not.toMatch(/baseline-arrow/);
    app.teardown();
  });

  it('formats slips ≥ 7 days as weeks (+2w)', async () => {
    const app = await setup({ baselineEnd: '2026-01-26', currentEnd: '2026-02-09' });
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toContain('+2w');
    expect(html).not.toContain('+14d');
    app.teardown();
  });

  it('formats sub-week slips in days (+5d)', async () => {
    const app = await setup({ baselineEnd: '2026-01-26', currentEnd: '2026-01-31' });
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toContain('+5d');
    app.teardown();
  });

  it('renders an early pill (− prefix, green) when actual ends before baseline', async () => {
    const app = await setup({ baselineEnd: '2026-02-09', currentEnd: '2026-01-26' });
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-delta-pill early/);
    expect(html).toMatch(/−\d+/);
    app.teardown();
  });

  it('omits the pill entirely when on plan (no on-plan word)', async () => {
    const app = await setup({ baselineEnd: '2026-01-26', currentEnd: '2026-01-26' });
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).not.toMatch(/gantt-delta-pill/);
    app.teardown();
  });

  it('renders no plan lane when project has no baseline data', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'NoBaseline', start_date: '2026-01-05', target_date: '2026-02-09', size_engineering: 5 });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    const cb = app.window.document.getElementById('ganttBaseline');
    if (cb) cb.checked = true;
    app.Gantt.render();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).not.toMatch(/gantt-plan-lane/);
    expect(html).not.toMatch(/gantt-move-arrow/);
    expect(html).not.toMatch(/gantt-delta-pill/);
    app.teardown();
  });
});
