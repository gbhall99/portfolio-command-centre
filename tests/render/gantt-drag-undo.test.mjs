// Gantt bar drag-to-resize date edits must honour the entity-mutator contract
// (CLAUDE.md: pushUndo BEFORE mutating, explicit save after — App._save is a
// no-op and markDirty only arms the 60s autosave). Before this fix the resize
// onUp mutated project.start_date/target_date with only logChange + markDirty:
// Ctrl+Z popped an UNRELATED earlier snapshot, and a reload inside the autosave
// window lost the edit while the audit log claimed it happened (H-007 class).
// attachResizeHandlers also gains a __ganttResizeWired guard (mirrors
// __ganttHoverWired): #ganttScroll persists across renders, so without it every
// render stacked another mousedown listener and one drag would commit N times.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

const DAY = 86400000;
const fmt = ms => new Date(ms).toISOString().slice(0, 10);

let app;

beforeEach(async () => {
  resetIdSeq();
  const today = Date.now();
  const sprints = [{
    sprint_id: 'CY99-S1',
    start_date: fmt(today - 30 * DAY),
    hardening_start: fmt(today + 1 * DAY),
    end_date: fmt(today + 8 * DAY)
  }];
  const proj = makeProject({
    id: 'Acme Industries-DRAG',
    name: 'Drag Me',
    start_date: fmt(today - 20 * DAY),
    target_date: fmt(today + 10 * DAY)
  });
  app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
  app.App.activeCustomer = 'Acme Industries';
  app.App.navigate('roadmap');
  if (typeof app.Gantt.render === 'function') app.Gantt.render();
});
afterEach(() => app.teardown());

function drag(app, edge, dxPx) {
  const { window, document } = app;
  const handle = document.querySelector(
    '.gantt-resize-handle[data-edge="' + edge + '"][data-id="Acme Industries-DRAG"]');
  expect(handle).toBeTruthy();
  handle.dispatchEvent(new window.MouseEvent('mousedown', {
    bubbles: true, cancelable: true, clientX: 400, clientY: 120
  }));
  document.dispatchEvent(new window.MouseEvent('mousemove', {
    bubbles: true, clientX: 400 + dxPx, clientY: 120
  }));
  document.dispatchEvent(new window.MouseEvent('mouseup', {
    bubbles: true, clientX: 400 + dxPx, clientY: 120
  }));
}

describe('Gantt drag-to-resize date edit — undoable + synchronously persisted', () => {
  it('pushes exactly one undo snapshot, Ctrl+Z restores the date, and localStorage holds the new date immediately', () => {
    const { App, window } = app;
    const project = App.data.projects.find(p => p.id === 'Acme Industries-DRAG');
    const originalTarget = project.target_date;
    const before = App.undoStack.length;

    // Drag the right edge ~30px to the right → later target_date.
    drag(app, 'right', 30);

    expect(project.target_date).not.toBe(originalTarget);
    expect(project.target_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // last_updated is stamped (keeps check_plan_drift honest — updateProject does this too)
    expect(project.last_updated).toBeTruthy();

    // Exactly ONE undo snapshot for the drag (not zero, not stacked duplicates)
    expect(App.undoStack.length).toBe(before + 1);

    // Persisted synchronously — not left to the 60s autosave timer
    const saved = JSON.parse(window.localStorage.getItem(App.LS_KEY));
    const savedProj = saved.projects.find(p => p.id === 'Acme Industries-DRAG');
    expect(savedProj.target_date).toBe(project.target_date);

    // A single Ctrl+Z reverts the drag on its own
    App.undo();
    const reverted = App.data.projects.find(p => p.id === 'Acme Industries-DRAG');
    expect(reverted.target_date).toBe(originalTarget);
  });

  it('re-renders do not stack resize listeners — a drag after N renders still commits once', () => {
    const { App, Gantt } = app;
    // onUp itself re-renders; add extra renders on top to simulate filter/zoom churn.
    Gantt.render();
    Gantt.render();

    const project = App.data.projects.find(p => p.id === 'Acme Industries-DRAG');
    const originalStart = project.start_date;
    const before = App.undoStack.length;

    drag(app, 'left', -25);

    expect(project.start_date).not.toBe(originalStart);
    expect(App.undoStack.length).toBe(before + 1);

    App.undo();
    expect(App.data.projects.find(p => p.id === 'Acme Industries-DRAG').start_date).toBe(originalStart);
  });

  it('a tiny drag (<3px) commits nothing and pushes no snapshot', () => {
    const { App } = app;
    const project = App.data.projects.find(p => p.id === 'Acme Industries-DRAG');
    const originalTarget = project.target_date;
    const before = App.undoStack.length;

    drag(app, 'right', 1);

    expect(project.target_date).toBe(originalTarget);
    expect(App.undoStack.length).toBe(before);
  });
});
