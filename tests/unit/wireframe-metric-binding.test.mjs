// W2 — bind wireframe components to the strategy metric they visualize.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }],
    metrics: [
      makeMetric({ id: 'MET-1', name: 'Revenue', customer: 'Acme Industries' }),
      makeMetric({ id: 'MET-G', name: 'Globex Metric', customer: 'Globex' })
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
  app.App.data.wireframes.push({
    id: 'WF-1', customer: 'Acme Industries', name: 'Board', grid: { cols: 12, rows: 8 },
    status: 'Concept', template_id: 'default', template_kind: 'tableau',
    components: [{ id: 'c1', type: 'kpi', title: 'Rev', x: 0, y: 0, w: 3, h: 2, props: {} }],
    metric_ids: [], tableau_refs: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  });
});
afterEach(() => app.teardown());

describe('Wireframe.setComponentMetric', () => {
  it('binds and clears a component metric, audited and undoable', () => {
    const { Wireframe, App } = app;
    const before = App.data.audit_log.length;
    Wireframe.setComponentMetric('WF-1', 'c1', 'MET-1');
    expect(Wireframe.get('WF-1').components[0].metric_id).toBe('MET-1');
    expect(App.data.audit_log.length).toBeGreaterThan(before);
    App.undo();
    expect(Wireframe.get('WF-1').components[0].metric_id).toBeUndefined();
  });

  it('refuses a metric from another customer (or an unknown id)', () => {
    const { Wireframe } = app;
    Wireframe.setComponentMetric('WF-1', 'c1', 'MET-G'); // Globex metric on an Acme wireframe
    expect(Wireframe.get('WF-1').components[0].metric_id).toBeUndefined();
    Wireframe.setComponentMetric('WF-1', 'c1', 'NOPE');
    expect(Wireframe.get('WF-1').components[0].metric_id).toBeUndefined();
  });

  it('feeds the build spec with the bound metric name', () => {
    const { Wireframe } = app;
    Wireframe.setComponentMetric('WF-1', 'c1', 'MET-1');
    expect(Wireframe.toBuildSpec(Wireframe.get('WF-1')).components[0].metric).toBe('Revenue');
  });
});

describe('conformance soft warning', () => {
  it('warns when a KPI has no bound metric, and clears once bound', () => {
    const { Wireframe } = app;
    const def = app.Definitions.loadJson('tableau/wireframe-definition.json');
    expect(Wireframe.checkConformance(Wireframe.get('WF-1'), def).warnings.some(w => /not linked to a metric/.test(w))).toBe(true);
    Wireframe.setComponentMetric('WF-1', 'c1', 'MET-1');
    expect(Wireframe.checkConformance(Wireframe.get('WF-1'), def).warnings.some(w => /not linked to a metric/.test(w))).toBe(false);
  });
});

describe('editor props panel', () => {
  it('offers a "Shows metric" picker scoped to the wireframe customer', () => {
    const { WireframeSkill, document } = app;
    WireframeSkill.open({}); WireframeSkill.edit('WF-1'); WireframeSkill._selId = 'c1'; WireframeSkill.render();
    const sel = document.getElementById('wfMetricSelect');
    expect(sel).toBeTruthy();
    const opts = Array.from(sel.options).map(o => o.textContent);
    expect(opts).toContain('Revenue');
    expect(opts).not.toContain('Globex Metric'); // other customer excluded
  });
});

// W4 — one-click conformance fix: feed live errors to the model, apply the
// returned ops through the same clamped mutators, one undo step.
describe('WireframeSkill.uiFixLayout', () => {
  function def(a) { return a.Definitions.loadJson('tableau/wireframe-definition.json'); }

  function brokenWf(a) {
    // A title in the wrong row (top-row rule) + an off-grid bar.
    a.App.data.wireframes.length = 0;
    a.App.data.wireframes.push({
      id: 'WF-X', customer: 'Acme Industries', name: 'Broken', grid: { cols: 12, rows: 8 },
      status: 'Concept', template_id: 'default', template_kind: 'tableau',
      components: [
        { id: 't1', type: 'title', title: 'Sales', x: 0, y: 3, w: 9, h: 1, props: {} },
        { id: 'b1', type: 'bar', title: 'Top products', x: 0, y: 2, w: 6, h: 3, props: {} }
      ],
      metric_ids: [], tableau_refs: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    });
    return a.Wireframe.get('WF-X');
  }

  it('clears conformance errors by applying the model patch ops, undoable', async () => {
    const { AI, WireframeSkill, Wireframe } = app;
    const pid = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(pid);
    brokenWf(app);
    expect(Wireframe.checkConformance(Wireframe.get('WF-X'), def(app)).errors.length).toBeGreaterThan(0);
    AI.ADAPTERS.mock.program([
      { text: JSON.stringify({ ops: [{ op: 'move', id: 't1', x: 0, y: 0 }] }) }
    ]);
    const before = app.App.data.audit_log.length;
    WireframeSkill.open({}); WireframeSkill.edit('WF-X');
    await WireframeSkill.uiFixLayout();
    expect(Wireframe.get('WF-X').components.find(c => c.id === 't1').y).toBe(0);
    expect(Wireframe.checkConformance(Wireframe.get('WF-X'), def(app)).errors.length).toBe(0);
    expect(app.App.data.audit_log.length).toBeGreaterThan(before);
    app.App.undo();
    expect(Wireframe.get('WF-X').components.find(c => c.id === 't1').y).toBe(3); // restored
  });

  it('drops out-of-vocabulary / off-grid ops rather than corrupting the layout', async () => {
    const { AI, WireframeSkill, Wireframe } = app;
    const pid = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(pid);
    brokenWf(app);
    AI.ADAPTERS.mock.program([
      { text: JSON.stringify({ ops: [
        { op: 'add', type: 'piechart3d', x: 0, y: 0, w: 4, h: 2 }, // not in vocabulary -> dropped
        { op: 'move', id: 'b1', x: 99, y: 99 },                    // off-grid -> clamped on-grid
        { op: 'move', id: 'ghost', x: 0, y: 0 }                    // unknown id -> dropped
      ] }) }
    ]);
    WireframeSkill.open({}); WireframeSkill.edit('WF-X');
    await WireframeSkill.uiFixLayout();
    const wf = Wireframe.get('WF-X');
    expect(wf.components.some(c => c.type === 'piechart3d')).toBe(false);
    const bar = wf.components.find(c => c.id === 'b1');
    expect(bar.x + bar.w).toBeLessThanOrEqual(wf.grid.cols);
    expect(bar.y + bar.h).toBeLessThanOrEqual(wf.grid.rows);
  });

  it('no-ops when the layout already conforms', async () => {
    const { AI, WireframeSkill, Wireframe } = app;
    const pid = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(pid);
    app.App.data.wireframes.length = 0;
    app.App.data.wireframes.push({
      id: 'WF-OK', customer: 'Acme Industries', name: 'Good', grid: { cols: 12, rows: 8 },
      status: 'Concept', template_id: 'default', template_kind: 'tableau',
      components: [{ id: 't1', type: 'title', title: 'Sales', x: 0, y: 0, w: 9, h: 1, props: {} }],
      metric_ids: [], tableau_refs: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    });
    expect(Wireframe.checkConformance(Wireframe.get('WF-OK'), def(app)).errors.length).toBe(0);
    const before = app.App.data.audit_log.length;
    WireframeSkill.open({}); WireframeSkill.edit('WF-OK');
    await WireframeSkill.uiFixLayout();
    expect(app.App.data.audit_log.length).toBe(before); // nothing mutated
  });

  it('renders a "Fix layout with AI" button only while errors remain and a model is set', () => {
    const { AI, WireframeSkill, Wireframe, document } = app;
    const pid = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(pid);
    brokenWf(app);
    WireframeSkill.open({}); WireframeSkill.edit('WF-X');
    expect(document.getElementById('wfConf').textContent).toContain('Fix layout with AI');
    // Once it conforms, the button disappears.
    Wireframe.updateComponent('WF-X', 't1', { y: 0 }, def(app));
    WireframeSkill.render();
    expect(document.getElementById('wfConf').textContent).not.toContain('Fix layout with AI');
  });
});
