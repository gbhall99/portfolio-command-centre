// Sprint Planning swim-lane honours the sprint.window setting; current column emphasised.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const iso = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return d.toISOString().split('T')[0]; };
function boot() {
  const sprints = [
    { sprint_id: 'CY-P2', start_date: iso(-110) },
    { sprint_id: 'CY-P1', start_date: iso(-40) },
    { sprint_id: 'CY-CUR', start_date: iso(-1) },
    { sprint_id: 'CY-F1', start_date: iso(40) },
    { sprint_id: 'CY-F2', start_date: iso(80) }
  ];
  return loadApp(makeDataset({
    projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    sprints
  }));
}

function bootTeam() {
  const sprints = [
    { sprint_id: 'CY-P2', start_date: iso(-110) },
    { sprint_id: 'CY-P1', start_date: iso(-40) },
    { sprint_id: 'CY-CUR', start_date: iso(-1) },
    { sprint_id: 'CY-F1', start_date: iso(40) },
    { sprint_id: 'CY-F2', start_date: iso(80) }
  ];
  return loadApp(makeDataset({
    projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    team_members: [{ name: 'Avery Nolan', customer: 'Acme Industries', primary_skills: [], available_points_per_sprint: 10 }],
    sprints
  }));
}

function renderProjectsSwimlane(app) {
  app.App.activeCustomer = 'Acme Industries';
  app.Sprint.viewMode = 'swimlane';
  if (app.Sprint.setSprintView) app.Sprint.setSprintView('projects');
  const board = app.document.getElementById('sprintBoard');
  app.Sprint.render();
  return board;
}

describe('Sprint Planning swim-lane window', () => {
  it('default window shows 1 past + current + all future', async () => {
    const app = await boot();
    const board = renderProjectsSwimlane(app);
    const hdrTexts = Array.from(board.querySelectorAll('th.sl-sprint-hdr')).map(th => th.textContent.trim());
    expect(board.querySelectorAll('th.sl-sprint-hdr').length).toBe(4); // CY-P1, CY-CUR, CY-F1, CY-F2
    // Each header begins with the exact sprint id (renderer only strips a CY<digits>- prefix, so
    // CY-CUR stays "CY-CUR") immediately followed by the capitalised phase word (Past/Current/Future).
    // Anchor on that boundary so F1 can't match F11 and CUR can't match a substring. P2 is windowed out.
    expect(hdrTexts.some(t => /^CY-CUR(Past|Current|Future)/.test(t))).toBe(true);
    expect(hdrTexts.some(t => /^CY-F1(Past|Current|Future)/.test(t))).toBe(true);
    expect(hdrTexts.some(t => /^CY-F2(Past|Current|Future)/.test(t))).toBe(true);
    expect(hdrTexts.some(t => /^CY-P2(Past|Current|Future)/.test(t))).toBe(false);
    app.teardown();
  });
  it('past:0, future:1 shows current + 1 future only', async () => {
    const app = await boot();
    app.App.uiStateSet('sprint.window', { past: 0, future: 1 });
    const board = renderProjectsSwimlane(app);
    expect(board.querySelectorAll('th.sl-sprint-hdr').length).toBe(2);
    app.teardown();
  });
  it('the current column carries .sl-sprint-current', async () => {
    const app = await boot();
    const board = renderProjectsSwimlane(app);
    expect(board.querySelector('th.sl-sprint-hdr.sl-sprint-current')).toBeTruthy();
    app.teardown();
  });
});

describe('Sprint Planning TEAM swim-lane window', () => {
  it('team swim-lane honours the default window', async () => {
    const app = await bootTeam();
    app.App.activeCustomer = 'Acme Industries';
    app.Sprint.viewMode = 'swimlane';
    app.Sprint.setSprintView('team');
    app.Sprint.render();
    const board = app.document.getElementById('sprintBoard');
    const hdrTexts = Array.from(board.querySelectorAll('th.sl-sprint-hdr')).map(th => th.textContent.trim());
    expect(board.querySelectorAll('th.sl-sprint-hdr').length).toBe(4); // CY-P1, CY-CUR, CY-F1, CY-F2
    expect(hdrTexts.some(t => /^CY-P2(Past|Current|Future)/.test(t))).toBe(false);
    expect(hdrTexts.some(t => /^CY-CUR(Past|Current|Future)/.test(t))).toBe(true);
    app.teardown();
  });
});

describe('Sprint window toolbar control', () => {
  it('selects reflect the persisted setting after render', async () => {
    const app = await boot();
    app.App.uiStateSet('sprint.window', { past: 2, future: 3 });
    renderProjectsSwimlane(app);
    expect(app.document.getElementById('sprintWindowPast').value).toBe('2');
    expect(app.document.getElementById('sprintWindowFuture').value).toBe('3');
    app.teardown();
  });
  it('setWindow writes the setting and narrows the board', async () => {
    const app = await boot();
    renderProjectsSwimlane(app);
    app.Sprint.setWindow('future', '1');
    expect(app.App.uiStateGet('sprint.window', null).future).toBe(1);
    const board = app.document.getElementById('sprintBoard');
    // default past 1 + current + 1 future = 3 columns
    expect(board.querySelectorAll('th.sl-sprint-hdr').length).toBe(3);
    app.teardown();
  });
  it('setWindow("future", "all") persists the string "all" and shows all futures', async () => {
    const app = await boot();
    app.App.uiStateSet('sprint.window', { past: 1, future: 1 });
    renderProjectsSwimlane(app);
    app.Sprint.setWindow('future', 'all');
    expect(app.App.uiStateGet('sprint.window', null).future).toBe('all');
    const board = app.document.getElementById('sprintBoard');
    // boot() fixture: 1 past + current + 2 futures (all) = 4 columns
    expect(board.querySelectorAll('th.sl-sprint-hdr').length).toBe(4);
    app.teardown();
  });
});
