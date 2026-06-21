// Hardening L2 (undo/audit contracts) — Strategy entity edits must be undoable
// and persisted. The entity mutators (Objectives/Personas/Person .update) are
// memory-only (App._save is a no-op), so the UI callers own pushUndo + save.
// Before this fix the detail-modal "Save" and the inline table edits mutated
// without a pushUndo snapshot, so Ctrl+Z could not revert a strategy edit.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeObjective, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({ objectives: [makeObjective({ id: 'OBJ-1', name: 'Original' })] }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('Strategy edits are undoable + persisted (L2)', () => {
  it('saving an objective detail modal snapshots undo and Ctrl+Z reverts it', () => {
    const { Objectives, App, document } = app;

    const modal = document.createElement('div');
    modal.id = 'objectiveDetailModal';
    modal.innerHTML = '<input data-objective-field="name" value="Renamed">';
    document.body.appendChild(modal);

    const before = App.undoStack.length;
    Objectives._saveDetailModal('OBJ-1');

    expect(Objectives.byId('OBJ-1').name).toBe('Renamed');
    // exactly one undo snapshot was taken for the edit
    expect(App.undoStack.length).toBe(before + 1);

    App.undo();
    expect(Objectives.byId('OBJ-1').name).toBe('Original');
  });

  it('the inline strategy table quick-edit is undoable (real commit path)', () => {
    const { Strategy, Objectives, App, document, window } = app;
    // Drive the real _openQuickEdit → commit() choke point (shared by the
    // objectives/personas/people inline edits) via a blur event.
    const cell = document.createElement('td');
    document.body.appendChild(cell);
    Strategy._openQuickEdit(cell, 'name', 'OBJ-1', 'strategy.objectives');

    const editor = cell.querySelector('.quick-edit-input');
    expect(editor).toBeTruthy();
    const before = App.undoStack.length;
    editor.value = 'Inline';
    editor.dispatchEvent(new window.Event('blur'));

    expect(Objectives.byId('OBJ-1').name).toBe('Inline');
    expect(App.undoStack.length).toBe(before + 1);
    App.undo();
    expect(Objectives.byId('OBJ-1').name).toBe('Original');
  });
});
