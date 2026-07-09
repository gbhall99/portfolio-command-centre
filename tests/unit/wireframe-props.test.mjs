// WF-5 — build-ready drafts: governed component props + AI metric auto-binding.
// setComponentProps clamps values against the definition's declared props;
// fieldMap/toBuildSpec/buildReady consume them; bind_metric/set_props op kinds
// and metric_id/props in the draft layout schema land validated, per-op.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

let app;

function def() { return app.Definitions.loadJson('tableau/wireframe-definition.json'); }

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }],
    metrics: [
      makeMetric({
        id: 'MET-1', name: 'Revenue', customer: 'Acme Industries', unit: '£m',
        actuals: [{ period: '2026-01', value: 80 }, { period: '2026-02', value: 120 }],
        raci_defaults: { accountable: ['PER-CFO'], responsible: [], consulted: [], informed: [] }
      }),
      makeMetric({ id: 'MET-G', name: 'Globex Metric', customer: 'Globex' })
    ],
    personas: [
      makePersona({
        id: 'PER-CFO', name: 'CFO', customer: 'Acme Industries',
        metric_holdings: [{ id: 'HLD-1', metric_id: 'MET-1', targets: [{ period: '2026-Q4', value: 150 }] }]
      })
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
  app.App.data.wireframes.push({
    id: 'WF-1', customer: 'Acme Industries', name: 'Board', grid: { cols: 12, rows: 8 },
    status: 'Concept', template_id: 'default', template_kind: 'tableau',
    components: [
      { id: 't1', type: 'title', title: 'Sales overview', x: 0, y: 0, w: 12, h: 1, props: {} },
      { id: 'c1', type: 'kpi', title: 'Rev', x: 0, y: 1, w: 3, h: 1, props: {} },
      { id: 'c2', type: 'bar', title: 'Top products', x: 0, y: 2, w: 6, h: 3, props: {} },
      { id: 'c3', type: 'scatter', title: 'Spend vs ROI', x: 6, y: 2, w: 4, h: 3, props: {} }
    ],
    metric_ids: [], tableau_refs: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  });
});
afterEach(() => app.teardown());

function comp(id) { return app.Wireframe.get('WF-1').components.find(c => c.id === id); }

describe('Wireframe.setComponentProps', () => {
  it('applies declared props, audited and undoable', () => {
    const { Wireframe, App } = app;
    const before = App.data.audit_log.length;
    const n = Wireframe.setComponentProps('WF-1', 'c2', { orientation: 'horizontal', dimension: 'Region' }, def());
    expect(n).toBe(2);
    expect(comp('c2').props.orientation).toBe('horizontal');
    expect(comp('c2').props.dimension).toBe('Region');
    expect(App.data.audit_log.length).toBeGreaterThan(before);
    App.undo();
    expect(comp('c2').props.orientation).toBeUndefined();
    expect(comp('c2').props.dimension).toBeUndefined();
  });

  it('drops out-of-vocabulary enum values and unknown/undeclared prop names per-key', () => {
    const { Wireframe, App } = app;
    const undoBefore = App.undoStack.length;
    // 'diagonal' is not an orientation option; 'bogus' is not a prop;
    // 'control_type' is declared for filters, not bars.
    const n = Wireframe.setComponentProps('WF-1', 'c2', { orientation: 'diagonal', bogus: 'x', control_type: 'slider' }, def());
    expect(n).toBe(0);
    expect(comp('c2').props.orientation).toBeUndefined();
    expect(comp('c2').props.bogus).toBeUndefined();
    expect(comp('c2').props.control_type).toBeUndefined();
    expect(App.undoStack.length).toBe(undoBefore); // no-op → no undo snapshot
  });

  it('never writes the reserved keys (no_metric / sample / metric)', () => {
    const { Wireframe } = app;
    const n = Wireframe.setComponentProps('WF-1', 'c2', { no_metric: true, sample: { values: [1, 2] }, metric: 'MET-1' }, def());
    expect(n).toBe(0);
    expect(comp('c2').props.no_metric).toBeUndefined();
    expect(comp('c2').props.sample).toBeUndefined();
  });

  it('length-clamps free-text values and clears on empty', () => {
    const { Wireframe } = app;
    Wireframe.setComponentProps('WF-1', 'c2', { measure: 'x'.repeat(300) }, def());
    expect(comp('c2').props.measure.length).toBe(120);
    Wireframe.setComponentProps('WF-1', 'c2', { measure: '' }, def());
    expect(comp('c2').props.measure).toBeUndefined();
  });
});

describe('fieldMap / toBuildSpec / buildReady consume props', () => {
  it('fieldMap uses the measure/dimension/orientation props instead of the title', () => {
    const { Wireframe } = app;
    Wireframe.setComponentProps('WF-1', 'c2', { measure: 'Sales', dimension: 'Region', orientation: 'horizontal' }, def());
    const row = Wireframe.fieldMap(Wireframe.get('WF-1')).find(r => r.component === 'bar');
    expect(row.field).toBe('[Sales]');
    expect(row.aggregation).toContain('[Region]');
    expect(row.aggregation).toContain('horizontal');
    expect(row.calc).toBe(''); // props define the calc/source
  });

  it('a bound KPI with a comparison prop carries it in the aggregation', () => {
    const { Wireframe } = app;
    Wireframe.setComponentMetric('WF-1', 'c1', 'MET-1');
    Wireframe.setComponentProps('WF-1', 'c1', { comparison: 'vs target' }, def());
    const row = Wireframe.fieldMap(Wireframe.get('WF-1')).find(r => r.component === 'kpi');
    expect(row.field).toBe('[Revenue]');
    expect(row.aggregation).toMatch(/headline/i);
    expect(row.aggregation).toContain('vs target');
  });

  it('toBuildSpec carries declared props but never sample / no_metric', () => {
    const { Wireframe } = app;
    Wireframe.setComponentProps('WF-1', 'c2', { measure: 'Sales' }, def());
    Wireframe.setComponentSample('WF-1', 'c2', { values: [1, 2, 3] });
    const spec = Wireframe.toBuildSpec(Wireframe.get('WF-1'));
    const bar = spec.components.find(c => c.type === 'bar');
    expect(bar.props).toEqual({ measure: 'Sales' });
  });

  it('buildReady is props-aware: fully-specified charts pass, unbound KPIs still block', () => {
    const { Wireframe } = app;
    // Both measures specified → the scatter is build-specifiable without a metric.
    Wireframe.setComponentProps('WF-1', 'c3', { measure_x: 'Spend', measure_y: 'ROI' }, def());
    Wireframe.setComponentProps('WF-1', 'c2', { measure: 'Sales' }, def());
    const r = Wireframe.buildReady(Wireframe.get('WF-1'), def());
    expect(r.blockers.some(b => /scatter/.test(b))).toBe(false);
    expect(r.blockers.some(b => /bar/.test(b))).toBe(false);
    expect(r.blockers.some(b => /kpi/.test(b))).toBe(true); // headline figures must trace to strategy
  });

  it('the acceptance checklist picks up the chart-semantics props', () => {
    const { Wireframe } = app;
    Wireframe.setComponentProps('WF-1', 'c2', { dimension: 'Region', orientation: 'horizontal' }, def());
    const items = Wireframe.acceptanceChecklist(Wireframe.get('WF-1'), def());
    expect(items.some(x => /by Region/.test(x) && /horizontal/.test(x))).toBe(true);
  });
});

describe('refine ops: bind_metric / set_props (mock adapter)', () => {
  function mockAi() {
    const pid = app.AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    app.AI.setDefaultProfile(pid);
  }

  it('binds valid metrics, drops cross-customer bindings and invalid prop values per-op', async () => {
    const { AI, WireframeSkill, document } = app;
    mockAi();
    AI.ADAPTERS.mock.program([
      { text: JSON.stringify({ ops: [
        { op: 'bind_metric', id: 'c1', metric_id: 'MET-1' },                        // valid → applied
        { op: 'bind_metric', id: 'c2', metric_id: 'MET-G' },                        // cross-customer → dropped
        { op: 'set_props', id: 'c2', props: { dimension: 'Region', orientation: 'diagonal' } } // partial: dimension lands
      ] }) }
    ]);
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    document.getElementById('wfRefineInput').value = 'bind the KPI to revenue';
    await WireframeSkill.uiRefine();
    expect(comp('c1').metric_id).toBe('MET-1');
    expect(comp('c2').metric_id).toBeUndefined();
    expect(comp('c2').props.dimension).toBe('Region');
    expect(comp('c2').props.orientation).toBeUndefined();
  });

  it('an added component may arrive bound and props-populated', async () => {
    const { AI, WireframeSkill, Wireframe, document } = app;
    mockAi();
    AI.ADAPTERS.mock.program([
      { text: JSON.stringify({ ops: [
        { op: 'add', type: 'line', x: 0, y: 5, w: 6, h: 2, title: 'Revenue trending up', metric_id: 'MET-1', props: { date_dimension: 'Month' } }
      ] }) }
    ]);
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    document.getElementById('wfRefineInput').value = 'add a revenue trend';
    await WireframeSkill.uiRefine();
    const line = Wireframe.get('WF-1').components.find(c => c.type === 'line');
    expect(line).toBeTruthy();
    expect(line.metric_id).toBe('MET-1');
    expect(line.props.date_dimension).toBe('Month');
  });
});

describe('AI drafts arrive metric-bound and props-populated', () => {
  it('aiDraft binds valid metric_ids, drops invalid ones, clamps props', async () => {
    const { AI, WireframeSkill, Wireframe } = app;
    const pid = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(pid);
    AI.ADAPTERS.mock.program([
      { text: JSON.stringify({ name: 'Exec board', components: [
        { type: 'title', x: 0, y: 0, w: 12, h: 1, title: 'Exec board' },
        { type: 'kpi', x: 0, y: 1, w: 3, h: 1, title: 'Revenue', metric_id: 'MET-1', props: { comparison: 'vs target' } },
        { type: 'kpi', x: 3, y: 1, w: 3, h: 1, title: 'Rogue', metric_id: 'MET-G', props: { comparison: 'sideways' } }
      ] }) }
    ]);
    await WireframeSkill.aiDraft('exec dashboard');
    const wf = Wireframe.list('Acme Industries').find(w => w.name === 'Exec board');
    expect(wf).toBeTruthy();
    const kpis = wf.components.filter(c => c.type === 'kpi');
    expect(kpis[0].metric_id).toBe('MET-1');
    expect(kpis[0].props.comparison).toBe('vs target');
    expect(kpis[1].metric_id).toBeUndefined();       // cross-customer refused at the mutator
    expect(kpis[1].props.comparison).toBeUndefined(); // out-of-vocabulary value dropped
  });

  it('the draft grounding is a structured metric pack (id, latest, target, direction)', () => {
    const pack = app.WireframeSkill._metricPack('Acme Industries');
    const rev = pack.find(m => m.id === 'MET-1');
    expect(rev).toBeTruthy();
    expect(rev.name).toBe('Revenue');
    expect(rev.direction).toBe('higher_is_better');
    expect(rev.latest).toEqual({ period: '2026-02', value: 120 });
    expect(rev.target).toEqual({ period: '2026-Q4', value: 150 });
    expect(rev.owner).toBe('CFO');
    // …and it reaches the draft prompt.
    const block = app.WireframeSkill._metricPromptBlock('Acme Industries');
    expect(block).toContain('"metric_id"');
    expect(block).toContain('MET-1');
  });

  it('the props vocabulary reaches the prompt with its enum values', () => {
    const block = app.WireframeSkill._propsPromptBlock(def());
    expect(block).toContain('bar: measure, dimension, orientation');
    expect(block).toContain('orientation: one of vertical | horizontal');
  });
});

describe('editor props panel (governed inputs)', () => {
  it('renders a dropdown for enum props and inputs for text props of the selected type', () => {
    const { WireframeSkill, document } = app;
    WireframeSkill.open({}); WireframeSkill.edit('WF-1'); WireframeSkill._selId = 'c2'; WireframeSkill.render();
    const panel = document.querySelector('.wf-props');
    expect(panel.textContent).toContain('Orientation');
    expect(panel.textContent).toContain('Dimension');
    expect(panel.textContent).toContain('Measure');
    const orientationSelect = Array.from(panel.querySelectorAll('select')).find(s => (s.getAttribute('aria-label') || '') === 'Orientation');
    expect(orientationSelect).toBeTruthy();
    expect(Array.from(orientationSelect.options).map(o => o.value)).toContain('horizontal');
  });
});
