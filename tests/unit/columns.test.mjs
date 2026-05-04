import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Dashboard.COLUMNS registry', () => {
  it('exists as a non-empty array', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    expect(Array.isArray(app.Dashboard.COLUMNS)).toBe(true);
    expect(app.Dashboard.COLUMNS.length).toBeGreaterThan(15);
    app.teardown();
  });

  it('every column has id, group, label, render', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    for (const col of app.Dashboard.COLUMNS) {
      expect(col.id, JSON.stringify(col)).toMatch(/^[a-z_][a-z0-9_]*$/);
      expect(typeof col.group).toBe('string');
      expect(typeof col.label).toBe('string');
      expect(typeof col.render).toBe('function');
    }
    app.teardown();
  });

  it('column ids are unique', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    const ids = app.Dashboard.COLUMNS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    app.teardown();
  });

  it('every editable column has a known edit.type', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    const known = new Set(['text', 'number', 'date', 'select', 'textarea', 'rag', 'sprint', 'derived']);
    for (const col of app.Dashboard.COLUMNS) {
      if (col.edit) {
        expect(known.has(col.edit.type), col.id + ': ' + col.edit.type).toBe(true);
        if (col.edit.type === 'select') expect(Array.isArray(col.edit.options)).toBe(true);
        if (col.edit.type !== 'derived' && col.edit.type !== 'rag') {
          expect(typeof col.edit.field).toBe('string');
        }
      }
    }
    app.teardown();
  });

  it('priority and name are alwaysOn', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    const get = (id) => app.Dashboard.COLUMNS.find(c => c.id === id);
    expect(get('priority').alwaysOn).toBe(true);
    expect(get('name').alwaysOn).toBe(true);
    app.teardown();
  });
});

describe('Dashboard.visibleColumns + persistence', () => {
  it('defaults expose 12 user-visible columns plus 2 chrome', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.uiStateSet('dashboard.columns', null);
    const cols = app.Dashboard.visibleColumns();
    expect(cols.length).toBe(14);
    const ids = cols.map(c => c.id);
    expect(ids).toEqual([
      '__drag', '__pin',
      'priority', 'name', 'customer', 'manager', 'status',
      'rag', 'target_date', 'hard_deadline', 'sprint_range',
      'size_total', 'size_done', 'size_remaining'
    ]);
    app.teardown();
  });

  it('respects stored visibility prefs', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.uiStateSet('dashboard.columns', {
      visible: ['priority', 'name', 'customer', 'status'],
      order: ['priority', 'name', 'customer', 'status'],
      widths: {}
    });
    const ids = app.Dashboard.visibleColumns().map(c => c.id);
    expect(ids).toEqual(['__drag', '__pin', 'priority', 'name', 'customer', 'status']);
    app.teardown();
  });

  it('alwaysOn columns cannot be hidden', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.uiStateSet('dashboard.columns', {
      visible: ['customer'],
      order: ['customer'],
      widths: {}
    });
    const ids = app.Dashboard.visibleColumns().map(c => c.id);
    expect(ids).toContain('priority');
    expect(ids).toContain('name');
    app.teardown();
  });

  it('falls back to defaults when prefs are malformed', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.uiStateSet('dashboard.columns', { not: 'an object we expect' });
    const ids = app.Dashboard.visibleColumns().map(c => c.id);
    expect(ids).toContain('priority');
    expect(ids).toContain('name');
    expect(ids.length).toBeGreaterThan(2);
    app.teardown();
  });

  it('setColumnVisible persists', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.uiStateSet('dashboard.columns', null);
    app.Dashboard.setColumnVisible('manager', false);
    const ids = app.Dashboard.visibleColumns().map(c => c.id);
    expect(ids).not.toContain('manager');
    const prefs = app.App.uiStateGet('dashboard.columns');
    expect(prefs.visible).not.toContain('manager');
    app.teardown();
  });
});

describe('Dashboard.openQuickEdit type dispatch', () => {
  function setup(p) { return loadApp(makeDataset({ projects: [p] })); }

  it('date editor renders date input with ISO value', async () => {
    const p = makeProject({ id: 'P1', target_date: '2026-06-30' });
    const app = await setup(p);
    const td = app.window.document.createElement('td');
    td.dataset.quickEdit = 'target_date';
    app.Dashboard.openQuickEdit(td, 'target_date', 'P1');
    const input = td.querySelector('input[type="date"]');
    expect(input).toBeTruthy();
    expect(input.value).toBe('2026-06-30');
    app.teardown();
  });

  it('number editor parses integers via App.toInteger and writes', async () => {
    const p = makeProject({ id: 'P2', size_engineering: 8 });
    const app = await setup(p);
    const td = app.window.document.createElement('td');
    td.dataset.quickEdit = 'size_engineering';
    app.Dashboard.openQuickEdit(td, 'size_engineering', 'P2');
    const input = td.querySelector('input[type="number"]');
    input.value = '12';
    input.dispatchEvent(new app.window.Event('blur'));
    const updated = app.App.data.projects.find(x => x.id === 'P2');
    expect(updated.size_engineering).toBe(12);
    app.teardown();
  });

  it('select editor lists options and commits chosen value', async () => {
    const p = makeProject({ id: 'P3', status: 'In Progress' });
    const app = await setup(p);
    const td = app.window.document.createElement('td');
    td.dataset.quickEdit = 'status';
    app.Dashboard.openQuickEdit(td, 'status', 'P3');
    const select = td.querySelector('select');
    expect(select).toBeTruthy();
    expect(select.options.length).toBe(7);
    select.value = 'Blocked';
    select.dispatchEvent(new app.window.Event('blur'));
    expect(app.App.data.projects.find(x => x.id === 'P3').status).toBe('Blocked');
    app.teardown();
  });

  it('invalid date is rejected and cell reverts', async () => {
    const p = makeProject({ id: 'P4', target_date: '2026-06-30' });
    const app = await setup(p);
    const td = app.window.document.createElement('td');
    td.dataset.quickEdit = 'target_date';
    td.textContent = '30 Jun';
    app.Dashboard.openQuickEdit(td, 'target_date', 'P4');
    const input = td.querySelector('input');
    input.value = 'not-a-date';
    input.dispatchEvent(new app.window.Event('blur'));
    expect(app.App.data.projects.find(x => x.id === 'P4').target_date).toBe('2026-06-30');
    app.teardown();
  });
});
