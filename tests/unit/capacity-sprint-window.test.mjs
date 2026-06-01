// Capacity "Team Workload by Sprint" grid windows sprints to at most one most-recent
// past sprint + the current sprint + all futures, and emphasises the focus sprint.
//
// NOTE: App.validateAndLoad unconditionally overwrites end_date to start_date + 34 days,
// so we set only start_date and let the loader compute end_date. Dates are computed once
// at fixture-build time relative to today so the test does not bitrot or straddle midnight.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

// ISO date offset from today (computed once per fixture build).
const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

// 6 sprints with distinct, identifiable stripped titles (card title strips /^CY\d+-/):
//   PA1/PA2/PA3 past (PA3 most recent), CUR current (spans today), FU1/FU2 future.
function datasetWithCurrent() {
  const sprints = [
    { sprint_id: 'CY24-PA1', start_date: iso(-150) }, // ends -116 → past
    { sprint_id: 'CY24-PA2', start_date: iso(-110) }, // ends -76  → past
    { sprint_id: 'CY24-PA3', start_date: iso(-40) },  // ends -6   → most recent past
    { sprint_id: 'CY24-CUR', start_date: iso(-1) },   // spans today → current
    { sprint_id: 'CY24-FU1', start_date: iso(40) },   // future
    { sprint_id: 'CY24-FU2', start_date: iso(80) }    // future
  ];
  return makeDataset({
    projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    sprints
  });
}

// Same fixture but with the CUR sprint removed: no sprint spans today.
function datasetBetweenCycles() {
  const sprints = [
    { sprint_id: 'CY24-PA1', start_date: iso(-150) },
    { sprint_id: 'CY24-PA2', start_date: iso(-110) },
    { sprint_id: 'CY24-PA3', start_date: iso(-40) },
    { sprint_id: 'CY24-FU1', start_date: iso(40) },
    { sprint_id: 'CY24-FU2', start_date: iso(80) }
  ];
  return makeDataset({
    projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    sprints
  });
}

function renderCapacityGrid(app) {
  app.App.activeCustomer = 'Acme Industries';
  app.App.navigate('capacity');
  let grid = app.document.getElementById('sprintCapGrid');
  if (!grid || !grid.querySelector('.sprint-cap-card')) {
    app.Capacity.renderSprintCapacity();
    grid = app.document.getElementById('sprintCapGrid');
  }
  return grid;
}

describe('Capacity sprint window (Team Workload by Sprint grid)', () => {
  it('windows to one past sprint + current + futures, current is the focus', async () => {
    const app = await loadApp(datasetWithCurrent());
    const grid = renderCapacityGrid(app);
    expect(grid).toBeTruthy();

    const cards = grid.querySelectorAll('.sprint-cap-card');
    expect(cards.length).toBe(4);

    const text = grid.textContent;
    expect(text).toContain('PA3');
    expect(text).toContain('CUR');
    expect(text).toContain('FU1');
    expect(text).toContain('FU2');
    expect(text).not.toContain('PA1');
    expect(text).not.toContain('PA2');

    const focusCards = grid.querySelectorAll('.sprint-cap-card-focus');
    expect(focusCards.length).toBe(1);
    expect(focusCards[0].querySelector('.sprint-cap-title').textContent.trim()).toBe('CUR');

    app.teardown();
  });

  it('between cycles (no current): nearest future is the focus', async () => {
    const app = await loadApp(datasetBetweenCycles());
    const grid = renderCapacityGrid(app);
    expect(grid).toBeTruthy();

    const cards = grid.querySelectorAll('.sprint-cap-card');
    expect(cards.length).toBe(3);

    const text = grid.textContent;
    expect(text).toContain('PA3');
    expect(text).toContain('FU1');
    expect(text).toContain('FU2');
    expect(text).not.toContain('PA1');
    expect(text).not.toContain('PA2');
    expect(text).not.toContain('CUR');

    const focusCards = grid.querySelectorAll('.sprint-cap-card-focus');
    expect(focusCards.length).toBe(1);
    expect(focusCards[0].querySelector('.sprint-cap-title').textContent.trim()).toBe('FU1');

    app.teardown();
  });
});
