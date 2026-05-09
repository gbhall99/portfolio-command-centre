import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

async function loadWithBaseline({ targetDate, baselineEnd, addAuditLog }) {
  resetIdSeq();
  const sprints = makeSprintSequence(4);
  const proj = makeProject({
    name: 'Atlas',
    start_date: '2026-01-05', target_date: targetDate,
    size_engineering: 12
  });
  proj.size_total = 12;
  proj.skill_splits = { size_engineering: [
    { sprint: sprints[0].sprint_id, points: 5, status: 'in_progress' },
    { sprint: sprints[1].sprint_id, points: 7, status: 'in_progress' }
  ] };
  const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
  app.App.activeCustomer = 'Acme Industries';
  app.App.data.baselines = [{
    id: 'b_test', name: 'Test', customer: 'Acme Industries',
    created_at: '2026-01-01T00:00:00.000Z', created_by: 'tester',
    snapshot: { [proj.id]: {
      start_date: '2026-01-05', target_date: baselineEnd, size_total: 5,
      skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 5 }] }
    } }
  }];
  app.Gantt.setActiveBaseline('b_test');
  if (addAuditLog) {
    app.App.data.audit_log = (app.App.data.audit_log || []).concat([
      { timestamp: '2026-01-15T10:00:00.000Z', projectId: proj.id, projectName: proj.name, field: 'size_data_engineering', oldValue: '5', newValue: '12', source: 'user' },
      { timestamp: '2026-01-20T10:00:00.000Z', projectId: proj.id, projectName: proj.name, field: 'target_date', oldValue: '2026-01-26', newValue: targetDate, source: 'user' },
      { timestamp: '2026-01-22T10:00:00.000Z', projectId: proj.id, projectName: proj.name, field: 'rag_schedule', oldValue: 'Green', newValue: 'Amber', source: 'user' }
    ]);
  }
  app.window.document.getElementById('ganttDetailed').checked = true;
  const cb = app.window.document.getElementById('ganttBaseline');
  if (cb) cb.checked = true;
  app.Gantt.render();
  return { app, proj };
}

describe('Gantt tooltip — bar/label hover (no Plan-vs-actual block)', () => {
  it('does NOT contain "Plan vs actual" when hovering the project bar', async () => {
    const { app } = await loadWithBaseline({ targetDate: '2026-02-09', baselineEnd: '2026-01-26' });
    const bar = app.window.document.querySelector('.gantt-bar[data-hover-type="bar"]');
    const html = app.Gantt._buildTooltipForTest('bar', bar);
    expect(html).not.toContain('Plan vs actual');
    expect(html).not.toContain('Slip contributors');
    app.teardown();
  });
});

describe('Gantt tooltip — delta-pill hover (the slip story lives here)', () => {
  it('renders Plan vs actual + Slip contributors + What moved with humanised labels', async () => {
    const { app } = await loadWithBaseline({ targetDate: '2026-02-09', baselineEnd: '2026-01-26', addAuditLog: true });
    const pill = app.window.document.querySelector('.gantt-delta-pill[data-hover-type="delta-pill"]');
    expect(pill, 'pill element').toBeTruthy();
    const html = app.Gantt._buildTooltipForTest('delta-pill', pill);
    expect(html).toContain('Plan vs actual');
    expect(html).toContain('Slip contributors');
    expect(html).toContain('What moved');
    // Week format
    expect(html).toContain('+2w');
    // Humanised labels — backend identifiers absent
    expect(html).not.toContain('size_data_engineering');
    expect(html).not.toContain('target_date');
    expect(html).not.toContain('rag_schedule');
    expect(html).toContain('Data Engineering scope');
    expect(html).toContain('Target date');
    expect(html).toContain('Schedule RAG');
    // No bookkeeping
    expect(html).not.toMatch(/set\s+\d+\s+(Jan|Feb|Apr)/i);
    expect(html).not.toContain('by tester');
    app.teardown();
  });

  it('lists slip contributors (phases that grew) sorted by expansion', async () => {
    const { app } = await loadWithBaseline({ targetDate: '2026-02-09', baselineEnd: '2026-01-26' });
    const pill = app.window.document.querySelector('.gantt-delta-pill[data-hover-type="delta-pill"]');
    const html = app.Gantt._buildTooltipForTest('delta-pill', pill);
    expect(html).toContain('Data Engineering');
    app.teardown();
  });
});

describe('Gantt tooltip — phase-tag hover (single-phase contribution)', () => {
  it('shows phase contribution focused on shift / expansion + per-phase audit', async () => {
    const { app } = await loadWithBaseline({ targetDate: '2026-02-09', baselineEnd: '2026-01-26', addAuditLog: true });
    const tag = app.window.document.querySelector('.gantt-phase-tag[data-hover-type="phase-tag"]');
    expect(tag, 'phase tag element').toBeTruthy();
    const html = app.Gantt._buildTooltipForTest('phase-tag', tag);
    expect(html).toContain('Data Engineering');
    expect(html).toContain('contribution');
    expect(html).toContain('expanded');
    expect(html).not.toContain('size_data_engineering');
    expect(html).toContain('Data Engineering scope');
    app.teardown();
  });
});

describe('Gantt tooltip — plan-lane hover is a one-liner', () => {
  it('contains the original span and no audit / contributors / scope', async () => {
    const { app } = await loadWithBaseline({ targetDate: '2026-02-09', baselineEnd: '2026-01-26', addAuditLog: true });
    const lane = app.window.document.querySelector('.gantt-plan-lane[data-hover-type="baseline"]');
    expect(lane, 'plan lane element').toBeTruthy();
    const html = app.Gantt._buildTooltipForTest('baseline', lane);
    expect(html).toContain('Originally planned');
    expect(html).not.toContain('Plan vs actual');
    expect(html).not.toContain('Slip contributors');
    expect(html).not.toContain('What moved');
    expect(html).not.toContain('by tester');
    app.teardown();
  });
});
