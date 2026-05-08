import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Gantt._formatSlip', () => {
  it('formats day slips for ±1 to ±6', async () => {
    const app = await loadApp();
    expect(app.Gantt._formatSlip(0)).toBe('on plan');
    expect(app.Gantt._formatSlip(1)).toBe('+1d');
    expect(app.Gantt._formatSlip(6)).toBe('+6d');
    expect(app.Gantt._formatSlip(-1)).toBe('−1d');
    expect(app.Gantt._formatSlip(-6)).toBe('−6d');
    app.teardown();
  });

  it('formats whole weeks for multiples of 7', async () => {
    const app = await loadApp();
    expect(app.Gantt._formatSlip(7)).toBe('+1w');
    expect(app.Gantt._formatSlip(14)).toBe('+2w');
    expect(app.Gantt._formatSlip(21)).toBe('+3w');
    expect(app.Gantt._formatSlip(-7)).toBe('−1w');
    expect(app.Gantt._formatSlip(-14)).toBe('−2w');
    app.teardown();
  });

  it('formats weeks-and-days for non-multiples ≥ 7', async () => {
    const app = await loadApp();
    expect(app.Gantt._formatSlip(8)).toBe('+1w 1d');
    expect(app.Gantt._formatSlip(10)).toBe('+1w 3d');
    expect(app.Gantt._formatSlip(13)).toBe('+1w 6d');
    expect(app.Gantt._formatSlip(15)).toBe('+2w 1d');
    expect(app.Gantt._formatSlip(25)).toBe('+3w 4d');
    expect(app.Gantt._formatSlip(-10)).toBe('−1w 3d');
    app.teardown();
  });

  it('returns "on plan" for non-finite numbers', async () => {
    const app = await loadApp();
    expect(app.Gantt._formatSlip(NaN)).toBe('on plan');
    expect(app.Gantt._formatSlip(Infinity)).toBe('on plan');
    expect(app.Gantt._formatSlip(-Infinity)).toBe('on plan');
    expect(app.Gantt._formatSlip(undefined)).toBe('on plan');
    expect(app.Gantt._formatSlip(null)).toBe('on plan');
    app.teardown();
  });
});

describe('Gantt._humaniseField', () => {
  it('returns mapped labels for known fields', async () => {
    const app = await loadApp();
    expect(app.Gantt._humaniseField('size_data_engineering')).toBe('Data Engineering scope');
    expect(app.Gantt._humaniseField('size_engineering')).toBe('Data Engineering scope');
    expect(app.Gantt._humaniseField('size_total')).toBe('Total scope');
    expect(app.Gantt._humaniseField('size_uat_adoption')).toBe('UAT scope');
    expect(app.Gantt._humaniseField('size_tableau')).toBe('Tableau scope');
    expect(app.Gantt._humaniseField('size_data_science')).toBe('Data Science scope');
    expect(app.Gantt._humaniseField('size_requirements')).toBe('Requirements scope');
    expect(app.Gantt._humaniseField('target_date')).toBe('Target date');
    expect(app.Gantt._humaniseField('start_date')).toBe('Start date');
    expect(app.Gantt._humaniseField('hard_deadline')).toBe('Hard deadline');
    expect(app.Gantt._humaniseField('rag_schedule')).toBe('Schedule RAG');
    expect(app.Gantt._humaniseField('rag_resourcing')).toBe('Resourcing RAG');
    expect(app.Gantt._humaniseField('rag_scope')).toBe('Scope RAG');
    expect(app.Gantt._humaniseField('moscow')).toBe('MoSCoW priority');
    expect(app.Gantt._humaniseField('skill_splits')).toBe('Sprint allocation');
    expect(app.Gantt._humaniseField('governance_forum')).toBe('Meeting');
    expect(app.Gantt._humaniseField('manager')).toBe('Manager');
    app.teardown();
  });

  it('falls back to title-case for unknown fields', async () => {
    const app = await loadApp();
    expect(app.Gantt._humaniseField('phase_order')).toBe('Phase Order');
    expect(app.Gantt._humaniseField('made_up_field')).toBe('Made Up Field');
    app.teardown();
  });

  it('returns the input unchanged for null / empty', async () => {
    const app = await loadApp();
    expect(app.Gantt._humaniseField('')).toBe('');
    expect(app.Gantt._humaniseField(null)).toBe('');
    app.teardown();
  });

  it('works when called as a detached callback', async () => {
    const app = await loadApp();
    const detached = app.Gantt._humaniseField;
    expect(detached('target_date')).toBe('Target date');
    expect(detached('made_up_field')).toBe('Made Up Field');
    expect(['size_engineering', 'manager'].map(detached)).toEqual(['Data Engineering scope', 'Manager']);
    app.teardown();
  });
});

describe('Gantt._phaseSpans', () => {
  it('returns null when project has no entry in the active baseline snapshot', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({ name: 'Atlas', start_date: '2026-01-05', target_date: '2026-02-09', size_engineering: 5 });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Gantt._phaseSpans(proj, null, 'size_engineering')).toBe(null);
    app.teardown();
  });

  it('computes baseline / actual / shift / expansion from a named-baseline snapshot', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({ name: 'Atlas', start_date: '2026-01-05', target_date: '2026-02-09', size_engineering: 12 });
    proj.size_total = 12;
    proj.skill_splits = { size_engineering: [
      { sprint: sprints[0].sprint_id, points: 5, status: 'complete' },
      { sprint: sprints[1].sprint_id, points: 7, status: 'in_progress' }
    ] };
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    const baseline = {
      id: 'b_test', name: 'Test', customer: 'Acme Industries',
      created_at: '2026-01-01T00:00:00.000Z',
      snapshot: { [proj.id]: {
        start_date: '2026-01-05', target_date: '2026-01-26', size_total: 5,
        skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 5 }] }
      } }
    };
    const r = app.Gantt._phaseSpans(proj, baseline, 'size_engineering');
    expect(r).not.toBe(null);
    expect(r.baseline.startDate).toBe(sprints[0].start_date);
    expect(r.baseline.endDate).toBe(sprints[0].end_date);
    expect(r.actual.startDate).toBe(sprints[0].start_date);
    expect(r.actual.endDate).toBe(sprints[1].end_date);
    expect(r.shift).toBe(0);
    expect(r.expansion).toBeGreaterThan(0);
    app.teardown();
  });

  it('honours per-split work_start_date / work_end_date overrides', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({ name: 'Atlas', start_date: '2026-01-05', target_date: '2026-02-09', size_engineering: 5 });
    proj.size_total = 5;
    // Actual split nominally lives in sprint 0, but its work window is constrained to a narrower range.
    proj.skill_splits = { size_engineering: [
      { sprint: sprints[0].sprint_id, points: 5, status: 'in_progress',
        work_start_date: '2026-01-08', work_end_date: '2026-01-10' }
    ] };
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    const baseline = {
      id: 'b_test', name: 'Test', customer: 'Acme Industries',
      created_at: '2026-01-01T00:00:00.000Z',
      snapshot: { [proj.id]: {
        start_date: '2026-01-05', target_date: '2026-01-26', size_total: 5,
        skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 5 }] }
      } }
    };
    const r = app.Gantt._phaseSpans(proj, baseline, 'size_engineering');
    expect(r).not.toBe(null);
    // Actual span should be the work window, NOT the sprint span.
    expect(r.actual.startDate).toBe('2026-01-08');
    expect(r.actual.endDate).toBe('2026-01-10');
    // Days = 3 (8th, 9th, 10th inclusive)
    expect(r.actual.days).toBe(3);
    app.teardown();
  });
});
