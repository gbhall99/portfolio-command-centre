import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember } from '../harness/fixtures.mjs';

describe('Report.openSprintBriefPicker', () => {
  it('exists as a function', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()], sprints: makeSprintSequence(3) }));
    expect(typeof app.Report.openSprintBriefPicker).toBe('function');
    app.teardown();
  });
});

describe('Sprint picker default selection', () => {
  // The production code does `new Date()` inside the jsdom realm, which uses
  // jsdom's window.Date — not the Node global. So we must patch the Date
  // constructor on the jsdom window after the app has loaded.
  function patchWindowDate(window, iso) {
    const realDate = window.Date;
    const fixedMs = realDate.parse(iso + 'T12:00:00Z');
    function FakeDate(...args) {
      if (!(this instanceof FakeDate)) return new realDate(fixedMs).toString();
      return args.length ? new realDate(...args) : new realDate(fixedMs);
    }
    FakeDate.now = () => fixedMs;
    FakeDate.parse = realDate.parse;
    FakeDate.UTC = realDate.UTC;
    FakeDate.prototype = realDate.prototype;
    window.Date = FakeDate;
    return () => { window.Date = realDate; };
  }

  // NOTE: App.validateAndLoad auto-recomputes sprint end_date as start_date + 34 days
  // (4-week dev + 1-week hardening). Fixture end_date values are overwritten on load,
  // so we choose start_dates that produce the desired today-vs-window relationships.

  it('picks the sprint containing today', async () => {
    // start + 34d windows: S1=Mar1–Apr4, S2=Apr5–May9, S3=May10–Jun13. today=May5 ∈ S2.
    const sprints = [
      { sprint_id: 'CY26-S1', customer: 'Acme Industries', start_date: '2026-03-01' },
      { sprint_id: 'CY26-S2', customer: 'Acme Industries', start_date: '2026-04-05' },
      { sprint_id: 'CY26-S3', customer: 'Acme Industries', start_date: '2026-05-10' }
    ];
    const app = await loadApp(makeDataset({ projects: [makeProject({ customer: 'Acme Industries' })], sprints, team_members: [makeMember()] }));
    const restore = patchWindowDate(app.window, '2026-05-05');
    try {
      app.App.activeCustomer = 'Acme Industries';
      app.Report.openSprintBriefPicker();
      const checked = app.window.document.querySelector('#sprintBriefPickerOverlay input[name="sb-picker-sprint"]:checked');
      expect(checked).not.toBeNull();
      expect(checked.value).toBe('CY26-S2');
    } finally { restore(); app.teardown(); }
  });

  it('falls back to next future sprint when today is between sprints', async () => {
    // S1=Mar1–Apr4 (past), S2=Jun1–Jul5 (future). today=May5 falls between → pick S2.
    const sprints = [
      { sprint_id: 'CY26-S1', customer: 'Acme Industries', start_date: '2026-03-01' },
      { sprint_id: 'CY26-S2', customer: 'Acme Industries', start_date: '2026-06-01' }
    ];
    const app = await loadApp(makeDataset({ projects: [makeProject({ customer: 'Acme Industries' })], sprints, team_members: [makeMember()] }));
    const restore = patchWindowDate(app.window, '2026-05-05');
    try {
      app.App.activeCustomer = 'Acme Industries';
      app.Report.openSprintBriefPicker();
      const checked = app.window.document.querySelector('#sprintBriefPickerOverlay input[name="sb-picker-sprint"]:checked');
      expect(checked.value).toBe('CY26-S2');
    } finally { restore(); app.teardown(); }
  });

  it('falls back to last past sprint when no future sprint exists', async () => {
    // S1=Jan1–Feb4, S2=Feb5–Mar11. today=May5 > both → pick last past = S2.
    const sprints = [
      { sprint_id: 'CY26-S1', customer: 'Acme Industries', start_date: '2026-01-01' },
      { sprint_id: 'CY26-S2', customer: 'Acme Industries', start_date: '2026-02-05' }
    ];
    const app = await loadApp(makeDataset({ projects: [makeProject({ customer: 'Acme Industries' })], sprints, team_members: [makeMember()] }));
    const restore = patchWindowDate(app.window, '2026-05-05');
    try {
      app.App.activeCustomer = 'Acme Industries';
      app.Report.openSprintBriefPicker();
      const checked = app.window.document.querySelector('#sprintBriefPickerOverlay input[name="sb-picker-sprint"]:checked');
      expect(checked.value).toBe('CY26-S2');
    } finally { restore(); app.teardown(); }
  });

  it('shows empty state when no sprints exist', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject({ customer: 'Acme Industries' })], sprints: [], team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Report.openSprintBriefPicker();
    const overlay = app.window.document.getElementById('sprintBriefPickerOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toContain('No sprints configured');
    app.teardown();
  });
});
