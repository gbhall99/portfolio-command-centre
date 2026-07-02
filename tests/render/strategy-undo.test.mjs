// Hardening L2 (undo/audit contracts) — Strategy entity edits must be undoable
// and persisted. The entity mutators (Objectives/Personas/Person .update) are
// memory-only (App._save is a no-op), so the UI callers own pushUndo + save.
// Before this fix the detail-modal "Save" and the inline table edits mutated
// without a pushUndo snapshot, so Ctrl+Z could not revert a strategy edit.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeDataset, makeObjective, makeMetric, makePersona, makePerson,
  makeMetricGroup, makeHolding, makeProject, resetIdSeq
} from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    objectives: [makeObjective({ id: 'OBJ-1', name: 'Original' })],
    metrics: [makeMetric({
      id: 'MET-1', name: 'Held Metric', group_id: 'performance',
      raci: { accountable: ['PRSN-1'], responsible: [], consulted: [], informed: [] }
    })],
    personas: [makePersona({
      id: 'PER-1', name: 'Holder',
      metric_holdings: [makeHolding({ id: 'HLD-1', metric_id: 'MET-1' })]
    })],
    people: [makePerson({ id: 'PRSN-1', name: 'Raci Person', persona_id: 'PER-1' })],
    metric_groups: [makeMetricGroup({ id: 'performance', name: 'Performance' })],
    projects: [makeProject({ id: 'PROJ-1', metric_ids: ['MET-1'] })]
  }));
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

// D-003 delete slice — whole-entity Strategy deletes cascade (Metrics.remove
// strips persona holdings + project metric_ids; Person.remove clears RACI) and
// were previously neither undoable nor synchronously persisted (App._save is a
// guarded no-op). The UI _remove callers now own pushUndo + save.
describe('Strategy entity deletes are undoable + persisted (D-003 delete slice)', () => {
  it('Metrics._remove snapshots once; one undo restores metric + persona holding + project metric_ids; saves synchronously', () => {
    const { Metrics, Personas, App, window } = app;

    const before = App.undoStack.length;
    Metrics._remove('MET-1');

    // delete + cascade happened
    expect(Metrics.byId('MET-1')).toBeNull();
    expect(Personas.byId('PER-1').metric_holdings).toHaveLength(0);
    expect(App.data.projects.find(p => p.id === 'PROJ-1').metric_ids).toEqual([]);

    // exactly one snapshot, persisted synchronously (not left to the 60s timer)
    expect(App.undoStack.length).toBe(before + 1);
    const saved = JSON.parse(window.localStorage.getItem(App.LS_KEY));
    expect(saved.metrics.some(m => m.id === 'MET-1')).toBe(false);

    // a single Ctrl+Z restores the metric AND its whole cascade
    App.undo();
    expect(Metrics.byId('MET-1')).toBeTruthy();
    expect(Personas.byId('PER-1').metric_holdings.map(h => h.metric_id)).toEqual(['MET-1']);
    expect(App.data.projects.find(p => p.id === 'PROJ-1').metric_ids).toEqual(['MET-1']);
  });

  it('Personas._remove, Objectives._remove and Person._removePrompt each take one undo snapshot and revert', () => {
    const { Personas, Objectives, Person, Metrics, App } = app;

    let before = App.undoStack.length;
    Person._removePrompt('PRSN-1');
    expect(Person.byId('PRSN-1')).toBeNull();
    expect(Metrics.byId('MET-1').raci.accountable).toEqual([]); // cascade
    expect(App.undoStack.length).toBe(before + 1);
    App.undo();
    expect(Person.byId('PRSN-1')).toBeTruthy();
    expect(Metrics.byId('MET-1').raci.accountable).toEqual(['PRSN-1']);

    before = App.undoStack.length;
    Personas._remove('PER-1');
    expect(Personas.byId('PER-1')).toBeNull();
    expect(App.undoStack.length).toBe(before + 1);
    App.undo();
    expect(Personas.byId('PER-1')).toBeTruthy();

    before = App.undoStack.length;
    Objectives._remove('OBJ-1');
    expect(Objectives.byId('OBJ-1')).toBeNull();
    expect(App.undoStack.length).toBe(before + 1);
    App.undo();
    expect(Objectives.byId('OBJ-1')).toBeTruthy();
  });

  it('MetricGroups._remove: refused (in-use) removal pushes no snapshot; a real removal is undoable', () => {
    const { MetricGroups, App } = app;

    // 'performance' is in use by MET-1 — refusal must not pollute the undo stack
    const before = App.undoStack.length;
    MetricGroups._remove('performance');
    expect(MetricGroups.byId('performance')).toBeTruthy();
    expect(App.undoStack.length).toBe(before);

    // an unused group removes with exactly one snapshot and reverts on undo
    App.data.metric_groups.push({ id: 'grp-x', customer: 'Acme Industries', name: 'Unused', swatch: '#888' });
    MetricGroups._remove('grp-x');
    expect(MetricGroups.byId('grp-x')).toBeNull();
    expect(App.undoStack.length).toBe(before + 1);
    App.undo();
    expect(MetricGroups.byId('grp-x')).toBeTruthy();
  });
});
