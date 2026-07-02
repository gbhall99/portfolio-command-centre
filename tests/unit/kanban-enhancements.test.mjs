// Kanban board enhancements (K1–K10): dependency/aging cues, time-in-status,
// WIP guard, column subtotals, sort modes, quick filters, collapse, card menu.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;
const old = (days) => new Date(Date.now() - days * 86400000).toISOString();

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [
      makeProject({ id: 'A-1', name: 'Alpha', customer: 'Acme Industries', status: 'In Progress', manager: 'Dana', priority: 3, size_total: 8,
        dependencies: [{ kind: 'project', type: 'blocked_by', target_id: 'A-2' }], last_updated: old(40), status_changed_at: old(40) }),
      makeProject({ id: 'A-2', name: 'Beta', customer: 'Acme Industries', status: 'In Progress', manager: 'Lee', priority: 1, size_total: 3,
        dependencies: [{ kind: 'project', type: 'blocks', target_id: 'A-1' }], hard_deadline: '2099-01-01', last_updated: old(1), status_changed_at: old(1) }),
      makeProject({ id: 'A-3', name: 'Gamma', customer: 'Acme Industries', status: 'Blocked', manager: 'Dana', priority: 2, size_total: 5, rag_schedule: 'Red' })
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
  app.App.navigate('board');
});
afterEach(() => app.teardown());

describe('K1 dependency awareness', () => {
  it('flags blocked cards and shows blocked-by / blocks chips', () => {
    const { document } = app;
    const a1 = document.querySelector('.kb-card[data-project-id="A-1"]');
    expect(a1.classList.contains('kb-card-blocked')).toBe(true);
    expect(a1.textContent).toContain('Blocked by 1');
    const a2 = document.querySelector('.kb-card[data-project-id="A-2"]');
    expect(a2.textContent).toContain('Blocks 1');
    expect(a2.classList.contains('kb-card-blocked')).toBe(false);
  });
});

describe('K2 aging + K3 time-in-status', () => {
  it('marks stale cards and shows days-in-status, and stamps on move', () => {
    const { document, App, Kanban } = app;
    const a1 = document.querySelector('.kb-card[data-project-id="A-1"]');
    expect(a1.classList.contains('kb-card-stale')).toBe(true); // 40d > default 7d threshold
    expect(a1.textContent).toMatch(/\d+d in status/);
    // Moving a card re-stamps status_changed_at (recent → no longer stale-by-status).
    const before = App.data.projects.find(p => p.id === 'A-1').status_changed_at;
    Kanban.moveCard('A-1', 'On Hold');
    const after = App.data.projects.find(p => p.id === 'A-1').status_changed_at;
    expect(after).not.toBe(before);
    expect(Kanban._statusDays(App.data.projects.find(p => p.id === 'A-1'))).toBe(0);
  });
});

describe('K4 WIP would-exceed helper', () => {
  it('reports when a target column is at/over its limit', () => {
    const { Kanban } = app;
    Kanban.setWipLimit('In Progress', 2);
    expect(Kanban._wouldExceedWip('In Progress')).toBe(true);  // 2 cards, limit 2
    Kanban.setWipLimit('In Progress', 5);
    expect(Kanban._wouldExceedWip('In Progress')).toBe(false);
    expect(Kanban._wouldExceedWip('On Hold')).toBe(false);     // no limit
  });
});

describe('K5 column subtotals', () => {
  it('renders total story points per column', () => {
    const { document } = app;
    const ip = document.querySelector('.kb-col[data-status="In Progress"]');
    expect(ip.querySelector('.kb-col-pts').textContent).toBe('11 SP'); // 8 + 3
  });
});

describe('K6 quick + dimension filters', () => {
  it('filters to blocked, at-risk, and by manager', () => {
    const { Kanban } = app;
    Kanban.setQuick('blocked');
    expect(Kanban.projects().map(p => p.id).sort()).toEqual(['A-1', 'A-3']); // A-1 has blocker, A-3 Blocked status
    Kanban.setQuick('atrisk');
    expect(Kanban.projects().map(p => p.id)).toEqual(['A-3']); // Red rag
    Kanban.setQuick('all');
    Kanban.setManager('Dana');
    expect(Kanban.projects().map(p => p.id).sort()).toEqual(['A-1', 'A-3']);
    Kanban.setManager('');
  });
});

describe('K7 sort modes', () => {
  it('sorts a column by the chosen dimension', () => {
    const { document, Kanban } = app;
    // default priority: Beta(1) before Alpha(3)
    let names = Array.from(document.querySelectorAll('.kb-col[data-status="In Progress"] .kb-card-name')).map(e => e.textContent);
    expect(names).toEqual(['Beta', 'Alpha']);
    Kanban.setSort('points'); // Alpha 8 before Beta 3
    names = Array.from(document.querySelectorAll('.kb-col[data-status="In Progress"] .kb-card-name')).map(e => e.textContent);
    expect(names).toEqual(['Alpha', 'Beta']);
    Kanban.setSort('priority');
  });
});

describe('K8 collapse persistence', () => {
  it('persists collapsed columns per customer', () => {
    const { document, Kanban, App } = app;
    Kanban.toggleColumnCollapse('Closed');
    expect(App.uiStateGet('board.collapsed.Acme Industries', null)).toContain('Closed');
    const closed = document.querySelector('.kb-col[data-status="Closed"]');
    expect(closed.classList.contains('kb-col-collapsed')).toBe(true);
    Kanban.toggleColumnCollapse('Closed'); // toggles back off
    expect(App.uiStateGet('board.collapsed.Acme Industries', null)).toBe(null);
  });
});

describe('K10 keyboard support — menu keys are not hijacked by the card handler', () => {
  const key = (el, k) => el.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const menuItem = (status) => {
    const menu = app.document.querySelector('.kb-card[data-project-id="A-1"] .kb-card-menu');
    return Array.from(menu.querySelectorAll('.kb-menu-item')).find(b => b.dataset.status === status);
  };
  let opened, origOpen;
  beforeEach(() => {
    opened = [];
    origOpen = app.DetailPanel.open;
    app.DetailPanel.open = (id) => opened.push(id);
  });
  afterEach(() => { app.DetailPanel.open = origOpen; });

  it('Enter on a menu item does not open the detail panel or move the card', () => {
    const { App, Kanban } = app;
    Kanban.openCardMenu('A-1');
    key(menuItem('On Hold'), 'Enter');
    expect(opened).toEqual([]);
    expect(App.data.projects.find(p => p.id === 'A-1').status).toBe('In Progress');
  });

  it('ArrowRight on a menu item does not move the card across columns', () => {
    const { App, Kanban } = app;
    Kanban.openCardMenu('A-1');
    key(menuItem('On Hold'), 'ArrowRight');
    expect(App.data.projects.find(p => p.id === 'A-1').status).toBe('In Progress');
  });

  it('Enter on the card itself opens the detail panel', () => {
    const { document } = app;
    key(document.querySelector('.kb-card[data-project-id="A-1"]'), 'Enter');
    expect(opened).toEqual(['A-1']);
  });

  it('Escape on a menu item closes the menu', () => {
    const { Kanban } = app;
    Kanban.openCardMenu('A-1');
    key(menuItem('On Hold'), 'Escape');
    expect(Kanban._menuId).toBe(null);
    expect(app.document.querySelector('.kb-card[data-project-id="A-1"] .kb-card-menu')).toBeNull();
  });
});

describe('K9 card menu move', () => {
  it('opens a menu and moves via it without dragging', () => {
    const { document, App, Kanban } = app;
    Kanban.openCardMenu('A-1');
    const menu = document.querySelector('.kb-card[data-project-id="A-1"] .kb-card-menu');
    expect(menu).not.toBeNull();
    // simulate clicking "Move to On Hold"
    const btn = Array.from(menu.querySelectorAll('.kb-menu-item')).find(b => b.dataset.status === 'On Hold');
    Kanban.menuMove({ target: btn });
    expect(App.data.projects.find(p => p.id === 'A-1').status).toBe('On Hold');
    expect(Kanban._menuId).toBe(null);
  });
});
