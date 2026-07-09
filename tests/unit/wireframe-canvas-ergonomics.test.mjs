// WF-14 — canvas pro ergonomics: drag-level undo coalescing, duplicate/paste,
// pointer-event handlers, zoom (viewBox scale) and roving tabindex + ARIA.
// All deterministic (no model).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function wf(components) {
  const w = {
    id: 'WF-1', customer: 'Acme Industries', name: 'Board', grid: { cols: 12, rows: 8 },
    status: 'Concept', template_id: 'default', template_kind: 'tableau',
    components, metric_ids: [], tableau_refs: [],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  };
  w.components.forEach(c => { if (!Array.isArray(c.comments)) c.comments = []; if (!c.props) c.props = {}; });
  app.App.data.wireframes.push(w);
  return w;
}

describe('WF-14 drag-level undo coalescing', () => {
  it('a single drag gesture across several cells is ONE undo, not one per tick', () => {
    const { WireframeSkill, Wireframe, App } = app;
    wf([{ id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 3, h: 2 }]);
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    const undoBefore = App.undoStack.length;
    WireframeSkill.onCompDown({ clientX: 0, clientY: 0, shiftKey: false, preventDefault() {}, stopPropagation() {} }, 'a');
    // Several move ticks (CELL = 64 px wide) — each would push its own undo pre-WF-14.
    WireframeSkill.onCanvasMove({ clientX: 70, clientY: 0 });
    WireframeSkill.onCanvasMove({ clientX: 140, clientY: 0 });
    WireframeSkill.onCanvasMove({ clientX: 200, clientY: 0 });
    WireframeSkill.onCanvasUp();
    expect(Wireframe.get('WF-1').components.find(c => c.id === 'a').x).toBe(3);  // moved 3 cells
    expect(App.undoStack.length).toBe(undoBefore + 1);  // exactly one snapshot for the gesture
    expect(App._batching).toBe(false);  // guard released on pointerup
    App.undo();
    expect(Wireframe.get('WF-1').components.find(c => c.id === 'a').x).toBe(0);  // whole drag reverts
  });

  it('a click with no movement pushes no undo entry', () => {
    const { WireframeSkill, App } = app;
    wf([{ id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 3, h: 2 }]);
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    const undoBefore = App.undoStack.length;
    WireframeSkill.onCompDown({ clientX: 0, clientY: 0, shiftKey: false, preventDefault() {}, stopPropagation() {} }, 'a');
    WireframeSkill.onCanvasUp();
    expect(App.undoStack.length).toBe(undoBefore);
  });
});

describe('WF-14 duplicate / copy-paste', () => {
  it('paste places the clone via _findFreeSpot without overlapping the original', () => {
    const { WireframeSkill, Wireframe } = app;
    wf([{ id: 'a', type: 'bar', title: 'Sales', x: 0, y: 1, w: 3, h: 2 }]);
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._selId = 'a';
    WireframeSkill.uiCopySelection();
    expect(WireframeSkill._clipboard.length).toBe(1);
    WireframeSkill.uiPaste();
    const comps = Wireframe.get('WF-1').components;
    expect(comps.length).toBe(2);
    const a = comps.find(c => c.id === 'a');
    const clone = comps.find(c => c.id !== 'a');
    // Placed via _findFreeSpot → not overlapping the original.
    expect(Wireframe._overlaps(a, clone)).toBe(false);
  });

  it('duplicating a marquee selection preserves relative layout and is one undo', () => {
    const { WireframeSkill, Wireframe, App } = app;
    wf([
      { id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 2, h: 2 },
      { id: 'b', type: 'kpi', title: 'B', x: 3, y: 1, w: 2, h: 2 }
    ]);
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._multi = ['a', 'b'];
    const undoBefore = App.undoStack.length;
    WireframeSkill.uiDuplicateSelection();
    const comps = Wireframe.get('WF-1').components;
    expect(comps.length).toBe(4);
    const clones = comps.filter(c => c.id !== 'a' && c.id !== 'b');
    // Relative x-offset (3-0 = 3) is preserved between the two clones.
    expect(Math.abs(clones[0].x - clones[1].x)).toBe(3);
    expect(App.undoStack.length).toBe(undoBefore + 1);
  });
});

describe('WF-14 pointer events, zoom, ARIA', () => {
  it('the canvas wires pointer handlers (touch/stylus), not just mouse', () => {
    const { WireframeSkill } = app;
    wf([{ id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 3, h: 2 }]);
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    const svg = WireframeSkill.renderCanvasSvg();
    expect(svg).toContain('onpointerdown="WireframeSkill.onCanvasDown(event)"');
    expect(svg).toContain('onpointermove="WireframeSkill.onCanvasMove(event)"');
    expect(svg).toContain('onpointerup="WireframeSkill.onCanvasUp()"');
    expect(svg).toContain('onpointerdown="WireframeSkill.onCompDown(event');
    expect(svg).not.toContain('onmousedown');
  });

  it('zoom scales the rendered width/height while the viewBox stays logical', () => {
    const { WireframeSkill } = app;
    const w = wf([{ id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 3, h: 2 }]);
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    const W = w.grid.cols * WireframeSkill.CELL, H = w.grid.rows * WireframeSkill.CELL_H;
    // Baseline at 100%.
    let svg = WireframeSkill.renderCanvasSvg();
    expect(svg).toContain('viewBox="0 0 ' + W + ' ' + H + '"');
    expect(svg).toContain('width="' + W + '"');
    // Zoom in one step.
    WireframeSkill.uiZoom(0.25);
    expect(WireframeSkill._zoom).toBe(1.25);
    svg = WireframeSkill.renderCanvasSvg();
    expect(svg).toContain('viewBox="0 0 ' + W + ' ' + H + '"');       // logical units unchanged
    expect(svg).toContain('width="' + Math.round(W * 1.25) + '"');    // pixel size scaled
    // Clamped to a max of 2.
    for (let i = 0; i < 10; i++) WireframeSkill.uiZoom(0.25);
    expect(WireframeSkill._zoom).toBe(2);
  });

  it('components are keyboard-focusable with a roving tabindex + ARIA', () => {
    const { WireframeSkill } = app;
    wf([
      { id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 3, h: 2 },
      { id: 'b', type: 'kpi', title: 'B', x: 3, y: 1, w: 3, h: 2 }
    ]);
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._selId = 'b';
    const svg = WireframeSkill.renderCanvasSvg();
    // Exactly one component is in the tab order (roving tabindex).
    expect((svg.match(/tabindex="0"/g) || []).length).toBe(1);
    expect((svg.match(/tabindex="-1"/g) || []).length).toBe(1);
    expect(svg).toContain('role="button"');
    expect(svg).toContain('aria-label="kpi — B"');
    expect(svg).toContain('aria-pressed="true"');
  });
});
