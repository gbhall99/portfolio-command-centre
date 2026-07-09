// WF-4 — region-scoped conversational refinement with proposal diffs.
// Multi-select state, region-scoped refine (mock drops ops on unselected ids),
// pending-diff Accept (ONE runBatch / single undo), Discard (no mutation), and
// the model-free bulk actions (move / align / distribute / delete / duplicate).

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
    components, metric_ids: [], tableau_refs: [],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }, extra || {});
  w.components.forEach(c => { if (!Array.isArray(c.comments)) c.comments = []; if (!c.props) c.props = {}; });
  app.App.data.wireframes.push(w);
  return w;
}

function threeKpis() {
  return wf([
    { id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 3, h: 2 },
    { id: 'b', type: 'kpi', title: 'B', x: 3, y: 1, w: 3, h: 2 },
    { id: 'c', type: 'kpi', title: 'C', x: 6, y: 1, w: 3, h: 2 }
  ]);
}

function mockAi() {
  const pid = app.AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
  app.AI.setDefaultProfile(pid);
}

describe('WF-4 multi-select state', () => {
  it('shift-click toggles the multi-selection; _selection reflects it', () => {
    const { WireframeSkill } = app;
    threeKpis();
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._selId = 'a';
    const shift = (id) => WireframeSkill.onCompDown({ shiftKey: true, preventDefault() {}, stopPropagation() {} }, id);
    shift('b');  // seeds with the current single selection ('a') then adds 'b'
    expect(WireframeSkill._multi.sort()).toEqual(['a', 'b']);
    expect(WireframeSkill._selection().sort()).toEqual(['a', 'b']);
    shift('a');  // toggle 'a' back off
    expect(WireframeSkill._multi).toEqual(['b']);
    // A plain select() clears the multi-selection.
    WireframeSkill.select('c');
    expect(WireframeSkill._multi).toEqual([]);
    expect(WireframeSkill._selection()).toEqual(['c']);
  });

  it('a marquee box selects the components it intersects', () => {
    const { WireframeSkill } = app;
    threeKpis();
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    // 'a' spans px x 0..192, 'b' 192..384. A box over the first two rows/cols.
    WireframeSkill._marquee = { x0: 0, y0: 56, x1: 200, y1: 170 };
    WireframeSkill.onCanvasUp();
    expect(WireframeSkill._multi.sort()).toEqual(['a', 'b']);
  });
});

describe('WF-4 region-scoped refine (pending diff)', () => {
  it('drops ops that touch unselected component ids', async () => {
    const { WireframeSkill, AI, document } = app;
    mockAi();
    threeKpis();
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._multi = ['a', 'b'];       // scope = a, b
    WireframeSkill.render();
    // Model returns an in-scope move, an out-of-scope move (dropped) and an add (kept).
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ ops: [
      { op: 'move', id: 'a', x: 0, y: 4 },
      { op: 'move', id: 'c', x: 0, y: 0 },   // 'c' is not selected → dropped
      { op: 'add', type: 'line', x: 0, y: 6, w: 6, h: 2, title: 'Trend' }
    ] }) }]);
    document.getElementById('wfRegionInput').value = 'stack these and add a trend';
    await WireframeSkill.uiRegionRefine();
    expect(WireframeSkill._pendingRefine).toBeTruthy();
    const ids = WireframeSkill._pendingRefine.ops.map(o => o.op + ':' + (o.id || o.type));
    expect(ids).toContain('move:a');
    expect(ids).toContain('add:line');
    expect(ids).not.toContain('move:c');   // dropped per-op
  });

  it('renders the pending ops as ghosts on the canvas without mutating', async () => {
    const { WireframeSkill, AI, Wireframe, document } = app;
    mockAi();
    threeKpis();
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._multi = ['a', 'b']; WireframeSkill.render();
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ ops: [{ op: 'move', id: 'a', x: 0, y: 5 }] }) }]);
    document.getElementById('wfRegionInput').value = 'move a down';
    await WireframeSkill.uiRegionRefine();
    // Nothing mutated yet — the diff is a preview.
    expect(Wireframe.get('WF-1').components.find(c => c.id === 'a').y).toBe(1);
    // The ghost outline is drawn on the canvas.
    expect(WireframeSkill.renderCanvasSvg()).toContain('wf-pending');
  });

  it('Accept applies every op as ONE runBatch (single undo)', async () => {
    const { WireframeSkill, AI, Wireframe, App, document } = app;
    mockAi();
    threeKpis();
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._multi = ['a', 'b']; WireframeSkill.render();
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ ops: [
      { op: 'move', id: 'a', x: 0, y: 5 },
      { op: 'retitle', id: 'b', title: 'Bookings' }
    ] }) }]);
    document.getElementById('wfRegionInput').value = 'rework these two';
    await WireframeSkill.uiRegionRefine();
    const undoBefore = App.undoStack.length;
    WireframeSkill.uiAcceptRefine();
    expect(Wireframe.get('WF-1').components.find(c => c.id === 'a').y).toBe(5);
    expect(Wireframe.get('WF-1').components.find(c => c.id === 'b').title).toBe('Bookings');
    expect(WireframeSkill._pendingRefine).toBeNull();
    // Two mutations, exactly one undo entry.
    expect(App.undoStack.length).toBe(undoBefore + 1);
    App.undo();
    expect(Wireframe.get('WF-1').components.find(c => c.id === 'a').y).toBe(1);
    expect(Wireframe.get('WF-1').components.find(c => c.id === 'b').title).toBe('B');
  });

  it('Discard mutates nothing and clears the pending diff', async () => {
    const { WireframeSkill, AI, Wireframe, App, document } = app;
    mockAi();
    threeKpis();
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._multi = ['a', 'b']; WireframeSkill.render();
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ ops: [{ op: 'move', id: 'a', x: 0, y: 5 }] }) }]);
    document.getElementById('wfRegionInput').value = 'move a';
    await WireframeSkill.uiRegionRefine();
    const undoBefore = App.undoStack.length;
    WireframeSkill.uiDiscardRefine();
    expect(WireframeSkill._pendingRefine).toBeNull();
    expect(Wireframe.get('WF-1').components.find(c => c.id === 'a').y).toBe(1);
    expect(App.undoStack.length).toBe(undoBefore);  // no mutation, no undo entry
  });
});

describe('WF-4 model-free bulk actions', () => {
  it('group nudge moves the whole selection in one undo', () => {
    const { WireframeSkill, Wireframe, App } = app;
    threeKpis();
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._multi = ['a', 'b', 'c'];
    const undoBefore = App.undoStack.length;
    WireframeSkill.onModalKey({ key: 'ArrowDown', shiftKey: false, target: { tagName: 'DIV' }, preventDefault() {} });
    ['a', 'b', 'c'].forEach(id => expect(Wireframe.get('WF-1').components.find(c => c.id === id).y).toBe(2));
    expect(App.undoStack.length).toBe(undoBefore + 1);  // one undo for the group
  });

  it('uiAlign left aligns every selected component, one undo', () => {
    const { WireframeSkill, Wireframe, App } = app;
    threeKpis();
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._multi = ['a', 'b', 'c'];
    const undoBefore = App.undoStack.length;
    WireframeSkill.uiAlign('left');
    ['a', 'b', 'c'].forEach(id => expect(Wireframe.get('WF-1').components.find(c => c.id === id).x).toBe(0));
    expect(App.undoStack.length).toBe(undoBefore + 1);
  });

  it('uiDistribute spaces the middle components evenly', () => {
    const { WireframeSkill, Wireframe } = app;
    wf([
      { id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 2, h: 2 },
      { id: 'b', type: 'kpi', title: 'B', x: 1, y: 1, w: 2, h: 2 },
      { id: 'c', type: 'kpi', title: 'C', x: 8, y: 1, w: 2, h: 2 }
    ]);
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._multi = ['a', 'b', 'c'];
    WireframeSkill.uiDistribute('x');
    // Even spacing between x=0 and x=8 → middle lands at x=4.
    expect(Wireframe.get('WF-1').components.find(c => c.id === 'b').x).toBe(4);
  });

  it('uiDeleteSelection removes all selected in one undo', () => {
    const { WireframeSkill, Wireframe, App } = app;
    threeKpis();
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._multi = ['a', 'b'];
    const undoBefore = App.undoStack.length;
    WireframeSkill.uiDeleteSelection();
    expect(Wireframe.get('WF-1').components.map(c => c.id)).toEqual(['c']);
    expect(App.undoStack.length).toBe(undoBefore + 1);
    App.undo();
    expect(Wireframe.get('WF-1').components.length).toBe(3);
  });

  it('uiDuplicateSelection clones the selection (props + metric) in one undo', () => {
    const { WireframeSkill, Wireframe, App } = app;
    wf([
      { id: 'a', type: 'bar', title: 'Sales', x: 0, y: 1, w: 3, h: 2, metric_id: 'MET-1', props: { orientation: 'vertical' } }
    ]);
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._multi = []; WireframeSkill._selId = 'a';
    const undoBefore = App.undoStack.length;
    WireframeSkill.uiDuplicateSelection();
    const comps = Wireframe.get('WF-1').components;
    expect(comps.length).toBe(2);
    const clone = comps.find(c => c.id !== 'a');
    expect(clone.type).toBe('bar');
    expect(clone.metric_id).toBe('MET-1');
    expect(clone.props.orientation).toBe('vertical');
    expect(App.undoStack.length).toBe(undoBefore + 1);
  });
});
