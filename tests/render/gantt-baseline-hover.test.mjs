import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

async function loadWithBaseline({ targetDate, baselineEnd }) {
  resetIdSeq();
  const sprints = makeSprintSequence(3);
  const proj = makeProject({
    name: 'PlanVsActualProj',
    start_date: '2026-01-05', target_date: targetDate,
    baseline_start: '2026-01-05', baseline_end: baselineEnd,
    size_engineering: 5
  });
  proj.size_total = 5;
  const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
  app.App.activeCustomer = 'Acme Industries';
  const cb = app.window.document.getElementById('ganttBaseline');
  if (cb) cb.checked = true;
  app.Gantt.render();
  return { app, proj };
}

describe('Gantt tooltip — Plan vs actual block', () => {
  // SKIPPED: bar/label tooltip no longer calls buildPlanVsActual per spec §8. Task 7 rewrites buildPlanVsActual and this test.
  it.skip('appears for a bar hover when project is in active baseline', async () => {
    const { app } = await loadWithBaseline({ targetDate: '2026-02-09', baselineEnd: '2026-01-26' });
    const bar = app.window.document.querySelector('.gantt-bar[data-hover-type="bar"]');
    expect(bar, 'bar element').toBeTruthy();
    const html = app.Gantt._buildTooltipForTest ? app.Gantt._buildTooltipForTest('bar', bar) : '';
    expect(html).toContain('Plan vs actual');
    expect(html).toMatch(/Baseline/);
    expect(html).toMatch(/Current/);
    expect(html).toMatch(/\+\d+d/);
    app.teardown();
  });

  it('does not include Plan vs actual when no baseline is active', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'NoBaseline', start_date: '2026-01-05', target_date: '2026-02-09', size_engineering: 5 });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Gantt.render();
    const bar = app.window.document.querySelector('.gantt-bar[data-hover-type="bar"]');
    const html = app.Gantt._buildTooltipForTest ? app.Gantt._buildTooltipForTest('bar', bar) : '';
    expect(html).not.toContain('Plan vs actual');
    app.teardown();
  });

  // SKIPPED: bar/label tooltip no longer calls buildPlanVsActual per spec §8. Task 7 rewrites buildPlanVsActual and this test.
  it.skip('renders What moved bullets from audit_log entries since baseline.created_at', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'NamedBaselineProj',
      start_date: '2026-01-05', target_date: '2026-02-09',
      size_engineering: 5
    });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    // Set up a named baseline that captures the project at start_date / target_date 2026-01-05 → 2026-01-26 (so target slipped by 14d)
    const baseline = {
      id: 'b_test',
      name: 'Test baseline',
      customer: 'Acme Industries',
      created_at: '2026-01-01T00:00:00.000Z',
      created_by: 'tester',
      snapshot: {
        [proj.id]: {
          start_date: '2026-01-05',
          target_date: '2026-01-26',
          size_total: 5,
          skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 5 }] }
        }
      }
    };
    app.App.data.baselines = [baseline];
    app.Gantt.setActiveBaseline('b_test');
    // Push some audit log entries AFTER baseline.created_at
    app.App.data.audit_log = app.App.data.audit_log || [];
    app.App.data.audit_log.push(
      { timestamp: '2026-01-15T10:00:00.000Z', projectId: proj.id, projectName: proj.name, field: 'target_date', oldValue: '2026-01-26', newValue: '2026-02-09', source: 'user', rationale: null },
      { timestamp: '2026-01-20T10:00:00.000Z', projectId: proj.id, projectName: proj.name, field: 'rag_schedule', oldValue: 'Green', newValue: 'Amber', source: 'user', rationale: null }
    );
    const cb = app.window.document.getElementById('ganttBaseline');
    if (cb) cb.checked = true;
    app.Gantt.render();
    const bar = app.window.document.querySelector('.gantt-bar[data-hover-type="bar"]');
    expect(bar, 'bar element').toBeTruthy();
    const html = app.Gantt._buildTooltipForTest('bar', bar);
    expect(html).toContain('Plan vs actual');
    expect(html).toContain('What moved');
    expect(html).toContain('target_date');
    expect(html).toContain('rag_schedule');
    app.teardown();
  });
});
