// WF-10 — Wireframe review workflow: per-component comments/flags, baseline
// snapshot on approval, structural redline diff, regen preservation, and the
// AI suggest-fix that applies ops + resolveComment in one App.runBatch.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

let app;
const def = () => app.Definitions.loadJson('tableau/wireframe-definition.json');

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    metrics: [makeMetric({ id: 'MET-1', name: 'Revenue', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function wf(components, extra) {
  const w = Object.assign({
    id: 'WF-1', customer: 'Acme Industries', name: 'Board', grid: { cols: 12, rows: 8 },
    status: 'Concept', template_id: 'default', template_kind: 'tableau',
    components, metric_ids: [], tableau_refs: [], baseline: null, successor_id: null, interactions: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }, extra || {});
  w.components.forEach(c => { if (!Array.isArray(c.comments)) c.comments = []; });
  app.App.data.wireframes.push(w);
  return w;
}

describe('WF-10 comments (author-free, undoable)', () => {
  it('adds and resolves a comment; both are undoable and audited', () => {
    const { Wireframe, App } = app;
    wf([{ id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 3, h: 2, props: {} }]);
    const before = App.data.audit_log.length;
    Wireframe.addComment('WF-1', 'a', 'Move this to the top');
    let c = Wireframe.get('WF-1').components[0];
    expect(Wireframe.openComments(c)).toBe(1);
    expect(App.data.audit_log.length).toBeGreaterThan(before);

    Wireframe.resolveComment('WF-1', 'a', 0, true);
    c = Wireframe.get('WF-1').components[0];
    expect(Wireframe.openComments(c)).toBe(0);
    expect(c.comments[0].resolved).toBe(true);

    App.undo(); // reopen
    expect(Wireframe.openComments(Wireframe.get('WF-1').components[0])).toBe(1);
    App.undo(); // remove comment
    expect(Wireframe.get('WF-1').components[0].comments.length).toBe(0);
  });

  it('reviewItems lists components with an open comment or flag', () => {
    const { Wireframe } = app;
    wf([
      { id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 3, h: 2, props: {} },
      { id: 'b', type: 'kpi', title: 'B', x: 3, y: 1, w: 3, h: 2, props: {} }
    ]);
    Wireframe.addComment('WF-1', 'a', 'tighten');
    Wireframe.flagComponent('WF-1', 'b', 'wrong chart');
    const items = Wireframe.reviewItems(Wireframe.get('WF-1'));
    expect(items.length).toBe(2);
    expect(items.find(i => i.id === 'a').open_comments).toBe(1);
    expect(items.find(i => i.id === 'b').flagged).toBe(true);
  });

  it('optional comments_resolved approval token blocks buildReady', () => {
    const { Wireframe } = app;
    wf([{ id: 't', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} }]);
    const d = def();
    // Plain shipped def: comments never block.
    Wireframe.addComment('WF-1', 't', 'reword title');
    expect(Wireframe.buildReady(Wireframe.get('WF-1'), d).ok).toBe(true);
    // A def carrying the token blocks while a comment is open.
    const gated = Object.assign({}, d, { approval_requires: ['comments_resolved'] });
    expect(Wireframe.buildReady(Wireframe.get('WF-1'), gated).ok).toBe(false);
    Wireframe.resolveComment('WF-1', 't', 0, true);
    expect(Wireframe.buildReady(Wireframe.get('WF-1'), gated).ok).toBe(true);
  });
});

describe('WF-10 baseline + structural redline', () => {
  it('captures a components baseline on Concept→Approved', () => {
    const { Wireframe } = app;
    // title-only concept is build-ready (no data-bearing components to bind).
    wf([{ id: 't', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} }]);
    const r = Wireframe.setStatus('WF-1', 'Approved', def());
    expect(r.ok).toBe(true);
    const w = Wireframe.get('WF-1');
    expect(w.baseline).toBeTruthy();
    expect(w.baseline.components.length).toBe(1);
    expect(w.baseline.components[0].id).toBe('t');
  });

  it('structuralDiff reports added / removed / moved / re-bound deterministically', () => {
    const { Wireframe } = app;
    const w = wf([
      { id: 't', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} },
      { id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 3, h: 2, props: {}, metric_id: null },
      { id: 'gone', type: 'kpi', title: 'Gone', x: 6, y: 1, w: 3, h: 2, props: {} }
    ]);
    // Sign off a baseline snapshot, then mutate the live layout.
    w.baseline = Wireframe._baselineSnapshot(w);
    Wireframe.updateComponent('WF-1', 'a', { x: 4 }, def());        // moved
    Wireframe.setComponentMetric('WF-1', 'a', 'MET-1');             // re-bound
    Wireframe.removeComponent('WF-1', 'gone');                       // removed
    Wireframe.addComponent('WF-1', 'kpi', def());                    // added
    const diff = Wireframe.structuralDiff(Wireframe.get('WF-1'));
    expect(diff.has_baseline).toBe(true);
    expect(diff.removed.map(c => c.id)).toEqual(['gone']);
    expect(diff.moved.map(c => c.id)).toEqual(['a']);
    expect(diff.bindingChanges.map(c => c.id)).toEqual(['a']);
    expect(diff.bindingChanges[0].to).toBe('MET-1');
    expect(diff.added.length).toBe(1);
    expect(diff.changed).toBe(4);
    // Deterministic — same inputs, same shape.
    expect(Wireframe.structuralDiff(Wireframe.get('WF-1'))).toEqual(diff);
  });
});

describe('WF-10 regen preserves untouched comments', () => {
  it('a refine op on one component keeps another component\'s comment intact', () => {
    const { Wireframe, WireframeSkill } = app;
    wf([
      { id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 3, h: 2, props: {} },
      { id: 'b', type: 'kpi', title: 'B', x: 3, y: 1, w: 3, h: 2, props: {} }
    ]);
    Wireframe.addComment('WF-1', 'a', 'keep me');
    WireframeSkill._wfId = 'WF-1';
    // Move component B; A must keep its comment (comments ride component ids).
    const applied = WireframeSkill._applyOps([{ op: 'move', id: 'b', x: 6, y: 1 }], def());
    expect(applied).toBe(1);
    const a = Wireframe.get('WF-1').components.find(c => c.id === 'a');
    expect(a.comments.length).toBe(1);
    expect(a.comments[0].text).toBe('keep me');
  });
});

describe('WF-10 AI suggest-fix (ops + resolveComment in one runBatch)', () => {
  it('applies the scoped ops and resolves the comment as a single undo', async () => {
    const { AI, Wireframe, WireframeSkill, App } = app;
    const pid = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(pid);
    wf([{ id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 3, h: 2, props: {} }]);
    Wireframe.addComment('WF-1', 'a', 'give it a clearer title');
    WireframeSkill._wfId = 'WF-1';
    WireframeSkill._selId = 'a';
    // Model returns a scoped retitle op (plus a stray op on another id that must drop).
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({
      ops: [{ op: 'retitle', id: 'a', title: 'Revenue vs target' }, { op: 'move', id: 'zzz', x: 0, y: 0 }]
    }) }]);
    await WireframeSkill.uiSuggestFix('a');
    expect(WireframeSkill._compFix).toBeTruthy();
    expect(WireframeSkill._compFix.ops.length).toBe(1); // stray op on 'zzz' filtered out

    const undoBefore = App.undoStack.length;
    WireframeSkill.uiAcceptFix();
    const w = Wireframe.get('WF-1');
    expect(w.components[0].title).toBe('Revenue vs target');
    expect(Wireframe.openComments(w.components[0])).toBe(0); // comment resolved
    // ONE undo reverts both the retitle and the resolution.
    expect(App.undoStack.length).toBe(undoBefore + 1);
    App.undo();
    const back = Wireframe.get('WF-1');
    expect(back.components[0].title).toBe('A');
    expect(Wireframe.openComments(back.components[0])).toBe(1);
  });
});

describe('WF-10 supersede successor pointer', () => {
  it('records a same-customer successor and refuses self/cross-customer', () => {
    const { Wireframe } = app;
    wf([{ id: 't', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} }]);
    const next = wf([{ id: 't2', type: 'title', title: 'T2', x: 0, y: 0, w: 12, h: 1, props: {} }], { id: 'WF-2', name: 'v2' });
    Wireframe.setStatus('WF-1', 'Superseded', def(), { successor_id: 'WF-2' });
    expect(Wireframe.get('WF-1').successor_id).toBe('WF-2');
    // self-reference refused
    Wireframe.setSuccessor('WF-1', 'WF-1');
    expect(Wireframe.get('WF-1').successor_id).toBe('WF-2');
  });
});
