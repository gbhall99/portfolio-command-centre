// H-019 (L14): App.fmtDate is the canonical, timezone-safe date formatter.
// A date-ONLY ISO string ('YYYY-MM-DD') is a calendar date, not an instant:
// `new Date('2026-06-01')` parses as UTC midnight, which toLocaleDateString then
// renders in LOCAL time — shifting the day backwards for any user west of UTC
// (e.g. "31 May" for 1 June). We force a west-of-UTC timezone here so the bug
// would reproduce on the old raw path, and assert the helper preserves the day.

process.env.TZ = 'America/Los_Angeles';

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

let app;

describe('App.fmtDate — timezone-safe (H-019)', () => {
  it('renders a date-only string on its own calendar day, west of UTC', async () => {
    app = await loadApp(makeDataset({ projects: [makeProject()] }));
    const { App } = app;

    // The raw, buggy path shifts the day backwards in this timezone…
    const buggy = new Date('2026-06-01').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    expect(buggy).toBe('31 May 2026'); // demonstrates the bug exists in this TZ

    // …the helper preserves the calendar day.
    expect(App.fmtDate('2026-06-01')).toBe('1 Jun 2026');
    expect(App.fmtDate('2026-06-01', { day: '2-digit', month: '2-digit', year: 'numeric' })).toBe('01/06/2026');
    expect(App.fmtDate('2026-12-31')).toBe('31 Dec 2026');

    // A full timestamp is a real instant — rendered as-is (not special-cased).
    expect(App.fmtDate('2026-06-01T12:00:00Z')).toContain('2026');

    // Empty / invalid input speaks with an em-dash, never "Invalid Date".
    expect(App.fmtDate('')).toBe('—');
    expect(App.fmtDate(null)).toBe('—');
    expect(App.fmtDate('not-a-date')).toBe('—');

    app.teardown();
  });
});

// D-007 (review finding #14): Sprint.addSprint / onSprintDateChange must do all
// date arithmetic in UTC. Date-only end_date strings parse as UTC midnight, so
// walking to "next Monday" with LOCAL getDay()/setDate() lands the persisted
// start_date on a Tuesday for users west of UTC, and a local DST spring-forward
// shifts the +28/+34 offsets by a day.
describe('Sprint date computation — timezone-safe (D-007)', () => {
  it('addSprint starts the next sprint on a Monday, west of UTC', async () => {
    app = await loadApp(makeDataset({
      sprints: [{
        sprint_id: 'CY26-S1',
        start_date: '2026-06-01',
        hardening_start: '2026-06-29',
        end_date: '2026-07-05' // a Sunday
      }]
    }));
    const { App, Sprint } = app;

    Sprint.addSprint();

    const sprints = App.data.sprints;
    expect(sprints.length).toBe(2);
    const next = sprints[1];
    expect(next.start_date).toBe('2026-07-06'); // the Monday after, not Tuesday
    expect(new Date(next.start_date + 'T00:00:00Z').getUTCDay()).toBe(1);
    expect(next.hardening_start).toBe('2026-08-03'); // +28
    expect(next.end_date).toBe('2026-08-09'); // +34

    app.teardown();
  });

  it('onSprintDateChange keeps +28/+34 offsets across a spring-forward DST boundary', async () => {
    app = await loadApp(makeDataset({
      sprints: [{
        sprint_id: 'CY26-S1',
        start_date: '2026-01-05',
        hardening_start: '2026-02-02',
        end_date: '2026-02-08'
      }]
    }));
    const { App, Sprint } = app;

    // 2026-02-23 + 28 days crosses the US spring-forward (8 Mar 2026); the old
    // local-time setDate path persisted 2026-03-22 in America/Los_Angeles.
    Sprint.onSprintDateChange(0, '2026-02-23');

    const s = App.data.sprints[0];
    expect(s.start_date).toBe('2026-02-23');
    expect(s.hardening_start).toBe('2026-03-23'); // +28, not 03-22
    expect(s.end_date).toBe('2026-03-29'); // +34

    app.teardown();
  });
});
