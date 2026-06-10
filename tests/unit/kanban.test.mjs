// WS3 — Kanban board: schema-driven cards, customer scoping, transitions
// through App.updateProject (audited), WIP limits, swimlanes, column config.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [
      makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', status: 'In Progress', manager: 'Dana', priority: 2, hard_deadline: '2099-01-01' }),
      makeProject({ id: 'A-2', name: 'Acme Beta', customer: 'Acme Industries', status: 'In Progress', manager: 'Lee', priority: 1 }),
      makeProject({ id: 'A-3', name: 'Acme Gamma', customer: 'Acme Industries', status: 'Blocked', manager: 'Dana' }),
      makeProject({ id: 'G-1', name: 'Globex Other', customer: 'Globex', status: 'In Progress' })
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
  app.App.navigate('board');
});
afterEach(() => app.teardown());

describe('board rendering', () => {
  it('renders one column per status, customer-scoped cards, priority-sorted', () => {
    const { document, Kanban } = app;
    const cols = document.querySelectorAll('#kbBoard .kb-col');
    expect(cols.length).toBe(Kanban.STATUSES.length);
    const inProgress = document.querySelector('#kbBoard .kb-col[data-status="In Progress"]');
    const names = Array.from(inProgress.querySelectorAll('.kb-card-name')).map(e => e.textContent);
    expect(names).toEqual(['Acme Beta', 'Acme Alpha']); // priority 1 before 2
    expect(document.querySelector('#kbBoard').textContent).not.toContain('Globex Other');
  });

  it('cards carry the schema-driven fields: RAG dots, points, deadline, manager', () => {
    const { document } = app;
    const card = document.querySelector('#kbBoard .kb-card[data-project-id="A-1"]');
    expect(card.querySelectorAll('.kb-rag-dot').length).toBe(3);
    expect(card.textContent).toContain('5 SP');
    expect(card.textContent).toContain('2099-01-01');
    expect(card.textContent).toContain('Dana');
    expect(card.getAttribute('draggable')).toBe('true');
  });

  it('search filters cards across name/manager/category', () => {
    const { document, Kanban } = app;
    Kanban.setSearch('dana');
    const names = Array.from(document.querySelectorAll('#kbBoard .kb-card-name')).map(e => e.textContent);
    expect(names.sort()).toEqual(['Acme Alpha', 'Acme Gamma']);
    Kanban.setSearch('');
  });

  it('swimlanes group by manager', () => {
    const { document, Kanban } = app;
    Kanban.setSwimlane('manager');
    const lanes = Array.from(document.querySelectorAll('#kbBoard .kb-lane-label')).map(e => e.textContent);
    expect(lanes.some(l => l.startsWith('Dana'))).toBe(true);
    expect(lanes.some(l => l.startsWith('Lee'))).toBe(true);
    Kanban.setSwimlane('none');
  });
});

describe('transitions', () => {
  it('moveCard writes through App.updateProject with an audited drag source', () => {
    const { App, Kanban } = app;
    const ok = Kanban.moveCard('A-1', 'On Hold');
    expect(ok).toBe(true);
    expect(App.data.projects.find(p => p.id === 'A-1').status).toBe('On Hold');
    const entry = App.data.audit_log[App.data.audit_log.length - 1];
    expect(entry.field).toBe('status');
    expect(entry.source).toBe('board-drag');
    expect(entry.newValue).toBe('On Hold');
    // Undoable through the standard stack.
    App.undo();
    expect(App.data.projects.find(p => p.id === 'A-1').status).toBe('In Progress');
  });

  it('refuses cross-customer moves, unknown statuses and no-ops', () => {
    const { App, Kanban } = app;
    expect(Kanban.moveCard('G-1', 'On Hold')).toBe(false);
    expect(App.data.projects.find(p => p.id === 'G-1').status).toBe('In Progress');
    expect(Kanban.moveCard('A-1', 'Exploded')).toBe(false);
    expect(Kanban.moveCard('A-1', 'In Progress')).toBe(false); // same status no-op
    expect(Kanban.moveCard('missing', 'On Hold')).toBe(false);
  });
});

describe('WIP limits', () => {
  it('flags a column over its WIP limit and clears when raised', () => {
    const { document, Kanban } = app;
    Kanban.setWipLimit('In Progress', 1);
    let col = document.querySelector('#kbBoard .kb-col[data-status="In Progress"]');
    expect(col.classList.contains('over-wip')).toBe(true);
    expect(col.querySelector('.kb-count').textContent).toBe('2 / 1');
    Kanban.setWipLimit('In Progress', 5);
    col = document.querySelector('#kbBoard .kb-col[data-status="In Progress"]');
    expect(col.classList.contains('over-wip')).toBe(false);
    Kanban.setWipLimit('In Progress', 0); // clears the limit
    expect(Kanban.wipLimits()['In Progress']).toBeUndefined();
  });
});

describe('column configuration', () => {
  it('hiding a column persists via uiState; the last column cannot be hidden', () => {
    const { document, Kanban, App } = app;
    Kanban.setColumnVisible('Closed', false);
    Kanban.setColumnVisible('Complete', false);
    expect(document.querySelectorAll('#kbBoard .kb-col').length).toBe(5);
    expect(App.uiStateGet('board.columns', null)).not.toContain('Closed');
    // Try to hide everything — the guard keeps at least one.
    Kanban.STATUSES.forEach(s => Kanban.setColumnVisible(s, false));
    expect(document.querySelectorAll('#kbBoard .kb-col').length).toBeGreaterThanOrEqual(1);
    App.uiStateSet('board.columns', null);
  });
});

describe('XSS hygiene', () => {
  it('project names and managers are escaped on cards', () => {
    const { App, Kanban, document } = app;
    App.data.projects[0].name = '<img src=x onerror=alert(1)>';
    App.data.projects[0].manager = '<script>bad()<\/script>';
    Kanban.render();
    const board = document.getElementById('kbBoard');
    expect(board.querySelector('img')).toBeNull();
    expect(board.querySelector('script')).toBeNull();
  });
});
