import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Gantt detailed-mode culprit attribution', () => {
  async function setupSlipped() {
    resetIdSeq();
    const sprints = makeSprintSequence(4);
    const proj = makeProject({ name: 'Atlas', start_date: '2026-01-05', target_date: '2026-02-09', size_engineering: 12 });
    proj.size_total = 12;
    proj.skill_splits = { size_engineering: [
      { sprint: sprints[0].sprint_id, points: 5, status: 'in_progress' },
      { sprint: sprints[1].sprint_id, points: 7, status: 'in_progress' }
    ] };
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.data.baselines = [{
      id: 'b_test', name: 'Test', customer: 'Acme Industries',
      created_at: '2026-01-01T00:00:00.000Z',
      snapshot: { [proj.id]: {
        start_date: '2026-01-05', target_date: '2026-01-26', size_total: 5,
        skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 5 }] }
      } }
    }];
    app.Gantt.setActiveBaseline('b_test');
    app.window.document.getElementById('ganttDetailed').checked = true;
    const cb = app.window.document.getElementById('ganttBaseline');
    if (cb) cb.checked = true;
    app.Gantt.render();
    return app;
  }

  it('renders a per-phase plan lane on every phase row in detailed mode', async () => {
    const app = await setupSlipped();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-phase-plan-lane/);
    app.teardown();
  });

  it('renders a culprit overlay + phase tag for a phase that grew', async () => {
    const app = await setupSlipped();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-phase-overlay-culprit/);
    expect(html).toMatch(/gantt-phase-tag[^>]*>\+/);
    app.teardown();
  });

  it('renders a phase status dot with the correct state', async () => {
    const app = await setupSlipped();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-phase-status-dot in-progress/);
    app.teardown();
  });

  it('renders the phase short code', async () => {
    const app = await setupSlipped();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-phase-name-tag/);
    expect(html).toContain('DE');
    app.teardown();
  });

  it('does not render culprit overlay or phase tag when phase span is unchanged', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'OnPlan', start_date: '2026-01-05', target_date: '2026-01-26', size_engineering: 5 });
    proj.size_total = 5;
    proj.skill_splits = { size_engineering: [{ sprint: sprints[0].sprint_id, points: 5, status: 'complete' }] };
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.data.baselines = [{
      id: 'b_test', name: 'Test', customer: 'Acme Industries', created_at: '2026-01-01T00:00:00.000Z',
      snapshot: { [proj.id]: {
        start_date: '2026-01-05', target_date: '2026-01-26', size_total: 5,
        skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 5 }] }
      } }
    }];
    app.Gantt.setActiveBaseline('b_test');
    app.window.document.getElementById('ganttDetailed').checked = true;
    const cb = app.window.document.getElementById('ganttBaseline');
    if (cb) cb.checked = true;
    app.Gantt.render();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-phase-plan-lane/);
    expect(html).not.toMatch(/gantt-phase-overlay-culprit/);
    expect(html).not.toMatch(/gantt-phase-tag/);
    app.teardown();
  });
});
