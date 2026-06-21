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
