// Quick-edit cells in the Projects table — Issue 3.
// Goal: every editable column on a Projects row exposes data-quick-edit="<field>"
// and clicking the cell swaps it for an inline editor that saves on blur.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Projects table — quick edit', () => {
  it('exposes data-quick-edit attributes for the editable columns', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'P1', status: 'In Progress', priority: 1, manager: 'Alex', size_total: 5 })],
      sprints: makeSprintSequence(2),
      team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'GCC';
    const html = app.Dashboard.buildRowHtml(app.App.data.projects[0]);
    expect(html).toMatch(/data-quick-edit="priority"/);
    expect(html).toMatch(/data-quick-edit="manager"/);
    expect(html).toMatch(/data-quick-edit="status"/);
    expect(html).toMatch(/data-quick-edit="size_total"/);
    app.teardown();
  });

  it('clicking a quick-edit cell swaps it for an inline editor and saves on blur', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'P1', status: 'In Progress', priority: 1, manager: 'Alex', size_total: 5 })],
      sprints: makeSprintSequence(2),
      team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'GCC';
    // Inject the row directly via a DocumentFragment — avoids virtual scroll dependencies.
    const tbody = app.window.document.getElementById('projectTableBody');
    const tmpl = app.window.document.createElement('template');
    tmpl.innerHTML = app.Dashboard.buildRowHtml(app.App.data.projects[0]);
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    tbody.appendChild(tmpl.content);
    const statusCell = tbody.querySelector('td[data-quick-edit="status"]');
    expect(statusCell).not.toBeNull();
    app.Dashboard.openQuickEdit(statusCell, 'status', app.App.data.projects[0].id);
    const editor = statusCell.querySelector('select, input');
    expect(editor).not.toBeNull();
    if (editor.tagName === 'SELECT') {
      editor.value = 'Blocked';
      editor.dispatchEvent(new app.window.Event('change', { bubbles: true }));
      editor.dispatchEvent(new app.window.Event('blur', { bubbles: true }));
    }
    expect(app.App.data.projects[0].status).toBe('Blocked');
    app.teardown();
  });

  it('Escape during a quick edit reverts without saving', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'P1', status: 'In Progress', manager: 'Alex' })],
      sprints: makeSprintSequence(2),
      team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'GCC';
    const tbody = app.window.document.getElementById('projectTableBody');
    const tmpl = app.window.document.createElement('template');
    tmpl.innerHTML = app.Dashboard.buildRowHtml(app.App.data.projects[0]);
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    tbody.appendChild(tmpl.content);
    const cell = tbody.querySelector('td[data-quick-edit="manager"]');
    const beforeMgr = app.App.data.projects[0].manager;
    app.Dashboard.openQuickEdit(cell, 'manager', app.App.data.projects[0].id);
    const input = cell.querySelector('input');
    input.value = 'Someone Else';
    const escEvent = new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    input.dispatchEvent(escEvent);
    expect(app.App.data.projects[0].manager).toBe(beforeMgr);
    app.teardown();
  });
});
