// Capacity: show at most one past sprint, the current sprint, and all future sprints.
//
// NOTE: App.validateAndLoad unconditionally overwrites end_date to start_date + 34 days,
// so we must build start_dates relative to today such that the "current" sprint's
// start_date falls within the last 34 days and the "past" sprints' start_dates are older.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

// Build a dataset with 3 past sprints + 1 current (start within last 33 days) + 2 future.
// Dates are computed dynamically so the test does not bitrot.
function datasetWithSprints() {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };

  // Each sprint is 35 days wide (start_date to start_date + 34).
  // Current sprint: starts 1 day ago so today is inside [start, start+34].
  const currentStart = addDays(today, -1);
  const s3Start = addDays(currentStart, -35);
  const s2Start = addDays(s3Start, -35);
  const s1Start = addDays(s2Start, -35);
  const f1Start = addDays(currentStart, 35);
  const f2Start = addDays(f1Start, 35);

  const sprints = [
    { sprint_id: 'CY24-S1', start_date: iso(s1Start) },
    { sprint_id: 'CY24-S2', start_date: iso(s2Start) },
    { sprint_id: 'CY24-S3', start_date: iso(s3Start) },
    { sprint_id: 'CY99-S4', start_date: iso(currentStart) }, // current — start yesterday, end in 33d
    { sprint_id: 'CY99-S5', start_date: iso(f1Start) },
    { sprint_id: 'CY99-S6', start_date: iso(f2Start) }
  ];
  return makeDataset({
    projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    sprints
  });
}

// Between-cycles dataset: NO sprint spans today. One past sprint ends before today,
// the next sprint starts after today (a gap over today). validateAndLoad forces
// end_date = start_date + 34, so compute starts relative to now to stay deterministic.
function datasetBetweenCycles() {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
  // last past: starts today-40 => ends today-6 (before today)
  // nearest future: starts today+5 => ends today+39
  // another future: starts today+45
  const sprints = [
    { sprint_id: 'CY24-S1', start_date: iso(addDays(today, -80)) },
    { sprint_id: 'CY24-S2', start_date: iso(addDays(today, -40)) },
    { sprint_id: 'CY99-S3', start_date: iso(addDays(today, 5)) },  // nearest future — focus
    { sprint_id: 'CY99-S4', start_date: iso(addDays(today, 45)) }
  ];
  return makeDataset({
    projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    sprints
  });
}

// Only-future dataset: every sprint starts in the future.
function datasetOnlyFuture() {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
  const sprints = [
    { sprint_id: 'CY99-S1', start_date: iso(addDays(today, 5)) },  // nearest future — focus
    { sprint_id: 'CY99-S2', start_date: iso(addDays(today, 45)) },
    { sprint_id: 'CY99-S3', start_date: iso(addDays(today, 85)) }
  ];
  return makeDataset({
    projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    sprints
  });
}

describe('Capacity sprint window', () => {
  it('renders at most one Past sprint column and keeps current + futures', async () => {
    const app = await loadApp(datasetWithSprints());
    app.App.activeCustomer = 'Acme Industries';
    app.Sprint.viewMode = 'swimlane';
    const board = app.document.getElementById('sprintBoard');
    expect(board).toBeTruthy();
    app.Sprint.render();
    const scope = board;
    const pills = Array.from(scope.querySelectorAll('.sl-sprint-phase-pill')).map(p => p.textContent.trim().toLowerCase());
    expect(pills.filter(t => t === 'past').length).toBeLessThanOrEqual(1);
    expect(pills.filter(t => t === 'current').length).toBe(1);
    expect(pills.filter(t => t === 'future').length).toBeGreaterThanOrEqual(1);
    app.teardown();
  });

  it('between cycles (no current): one past, no current, futures kept, nearest future is focus', async () => {
    const app = await loadApp(datasetBetweenCycles());
    app.App.activeCustomer = 'Acme Industries';
    app.Sprint.viewMode = 'swimlane';
    const board = app.document.getElementById('sprintBoard');
    expect(board).toBeTruthy();
    app.Sprint.render();
    const scope = board;
    const pills = Array.from(scope.querySelectorAll('.sl-sprint-phase-pill')).map(p => p.textContent.trim().toLowerCase());
    expect(pills.filter(t => t === 'current').length).toBe(0);
    expect(pills.filter(t => t === 'past').length).toBeLessThanOrEqual(1);
    expect(pills.filter(t => t === 'future').length).toBeGreaterThanOrEqual(1);
    expect(scope.querySelector('th.sl-sprint-focus')).toBeTruthy();
    app.teardown();
  });

  it('only future sprints: no past, no current, nearest future is focus', async () => {
    const app = await loadApp(datasetOnlyFuture());
    app.App.activeCustomer = 'Acme Industries';
    app.Sprint.viewMode = 'swimlane';
    const board = app.document.getElementById('sprintBoard');
    expect(board).toBeTruthy();
    app.Sprint.render();
    const scope = board;
    const pills = Array.from(scope.querySelectorAll('.sl-sprint-phase-pill')).map(p => p.textContent.trim().toLowerCase());
    expect(pills.filter(t => t === 'past').length).toBe(0);
    expect(pills.filter(t => t === 'current').length).toBe(0);
    expect(scope.querySelector('th.sl-sprint-focus')).toBeTruthy();
    app.teardown();
  });
});
