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
