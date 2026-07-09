// WF-1 — live chart previews with grounded mock data (fidelity dial).
// Seeded PRNG previews are stable per component id; metric-bound components
// render real figures (direction-aware); the AI sample fill is clamped at the
// mutator; the fidelity toggle persists; exports embed the canvas styles.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    metrics: [
      makeMetric({
        id: 'MET-UP', name: 'Revenue', customer: 'Acme Industries', unit: '£m',
        direction: 'higher_is_better',
        actuals: [{ period: '2026-01', value: 80 }, { period: '2026-02', value: 120 }]
      }),
      makeMetric({
        id: 'MET-DOWN', name: 'Churn', customer: 'Acme Industries', unit: '%',
        direction: 'lower_is_better',
        actuals: [{ period: '2026-01', value: 8 }, { period: '2026-02', value: 12 }]
      }),
      makeMetric({ id: 'MET-BARE', name: 'NPS', customer: 'Acme Industries', direction: 'lower_is_better', actuals: [] })
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
  app.App.data.wireframes.push({
    id: 'WF-1', customer: 'Acme Industries', name: 'Board', grid: { cols: 12, rows: 8 },
    status: 'Concept', template_id: 'default', template_kind: 'tableau',
    components: [
      { id: 't1', type: 'title', title: 'Board', x: 0, y: 0, w: 12, h: 1, props: {} },
      { id: 'k1', type: 'kpi', title: 'Revenue', x: 0, y: 1, w: 3, h: 2, metric_id: 'MET-UP', props: {} },
      { id: 'k2', type: 'kpi', title: 'Churn', x: 3, y: 1, w: 3, h: 2, metric_id: 'MET-DOWN', props: {} },
      { id: 'b1', type: 'bar', title: 'Top products', x: 0, y: 3, w: 6, h: 3, props: {} },
      { id: 'f1', type: 'filter', title: 'Region', x: 9, y: 1, w: 2, h: 1, props: {} }
    ],
    metric_ids: [], tableau_refs: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  });
});
afterEach(() => app.teardown());

function editPreview() {
  const { WireframeSkill } = app;
  WireframeSkill.open({});
  WireframeSkill.edit('WF-1');
  WireframeSkill.uiSetFidelity('preview');
  return app.document.getElementById('wfCanvasWrap').innerHTML;
}

describe('seeded preview stability', () => {
  it('the same component id always yields the same series; a different id differs', () => {
    const { WireframeSkill } = app;
    const a1 = WireframeSkill._previewSeries({ id: 'c-alpha', props: {} }, 8, null);
    const a2 = WireframeSkill._previewSeries({ id: 'c-alpha', props: {} }, 8, null);
    const b = WireframeSkill._previewSeries({ id: 'c-beta', props: {} }, 8, null);
    expect(a1).toEqual(a2);
    expect(a1).not.toEqual(b);
  });

  it('renders identically across repeated renders (no per-render randomness)', () => {
    const { WireframeSkill } = app;
    editPreview();
    const first = app.document.getElementById('wfCanvasWrap').innerHTML;
    WireframeSkill.renderCanvasAndConf();
    const second = app.document.getElementById('wfCanvasWrap').innerHTML;
    expect(second).toBe(first);
  });
});

describe('fidelity toggle', () => {
  it('defaults to structure (no glyphs) and persists the preview choice in uiState', () => {
    const { WireframeSkill, App } = app;
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    expect(app.document.getElementById('wfCanvasWrap').innerHTML).not.toContain('wf-glyph');
    WireframeSkill.uiSetFidelity('preview');
    expect(App.uiStateGet('wireframe.fidelity', null)).toBe('preview');
    expect(WireframeSkill.fidelity()).toBe('preview');
    expect(app.document.getElementById('wfCanvasWrap').innerHTML).toContain('wf-glyph');
    WireframeSkill.uiSetFidelity('structure');
    expect(WireframeSkill.fidelity()).toBe('structure');
    expect(app.document.getElementById('wfCanvasWrap').innerHTML).not.toContain('wf-glyph');
  });

  it('shows a fidelity toolbar above the canvas', () => {
    const { WireframeSkill, document } = app;
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    const bar = document.getElementById('wfToolbar');
    expect(bar).toBeTruthy();
    expect(bar.textContent).toContain('Structure');
    expect(bar.textContent).toContain('Preview');
  });
});

describe('metric-bound previews use real data, direction-aware', () => {
  it('a bound KPI shows the genuine latest actual and an improvement delta', () => {
    const html = editPreview();
    expect(html).toContain('>120 £m</text>');       // latest actual, real figure
    expect(html).toContain('+40');                  // movement from 80 → 120
    expect(html).toContain('#16a34a');              // higher_is_better rise = improved
  });

  it('a rise in a lower_is_better metric reads as worsened', () => {
    const html = editPreview();
    // Churn 8 → 12: up-arrow but BAD tone.
    expect(html).toContain('#dc2626');
  });

  it('synthetic trends slope in the metric-improving direction', () => {
    const { WireframeSkill } = app;
    const up = WireframeSkill._previewSeries({ id: 'c-up', props: {} }, 8, { direction: 'higher_is_better', latest: { value: 100 }, has_actuals: false });
    expect(up[up.length - 1]).toBeGreaterThan(up[0]);
    expect(up[up.length - 1]).toBe(100);            // ends at the real latest actual
    const down = WireframeSkill._previewSeries({ id: 'c-down', props: {} }, 8, { direction: 'lower_is_better', latest: { value: 100 }, has_actuals: false });
    expect(down[down.length - 1]).toBeLessThan(down[0]);
  });

  it('a bound chart plots the recorded actuals themselves', () => {
    const { WireframeSkill, Wireframe } = app;
    Wireframe.setComponentMetric('WF-1', 'b1', 'MET-UP');
    const c = Wireframe.get('WF-1').components.find(x => x.id === 'b1');
    const series = WireframeSkill._previewSeries(c, 8, WireframeSkill._previewFacts(c));
    expect(series).toEqual([80, 120]);
  });
});

describe('AI sample fill (mock adapter)', () => {
  function mockAi() {
    const pid = app.AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    app.AI.setDefaultProfile(pid);
  }

  it('stores the model series in props.sample, undoable, and the preview uses it', async () => {
    const { AI, WireframeSkill, Wireframe, App } = app;
    mockAi();
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ values: [12, 20, 30], labels: ['Jan', 'Feb', 'Mar'] }) }]);
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._selId = 'b1'; WireframeSkill.render();
    await WireframeSkill.uiFillSample();
    const bar = Wireframe.get('WF-1').components.find(c => c.id === 'b1');
    expect(bar.props.sample.values).toEqual([12, 20, 30]);
    const series = WireframeSkill._previewSeries(bar, 8, null);
    expect(series).toEqual([12, 20, 30]);                    // reproducible — stored, not re-rolled
    App.undo();
    expect(Wireframe.get('WF-1').components.find(c => c.id === 'b1').props.sample).toBeUndefined();
  });

  it('the mutator drops unusable model output instead of storing junk', () => {
    const { Wireframe } = app;
    expect(Wireframe.setComponentSample('WF-1', 'k1', { value: 'not-a-number' })).toBe(false);
    expect(Wireframe.setComponentSample('WF-1', 'b1', { values: [1] })).toBe(false); // too short
    expect(Wireframe.get('WF-1').components.find(c => c.id === 'b1').props.sample).toBeUndefined();
    // KPI deltas keep their sign but are integer-clamped.
    expect(Wireframe.setComponentSample('WF-1', 'b1', { values: [3.4, 7.9] })).toBe(true);
    expect(Wireframe.get('WF-1').components.find(c => c.id === 'b1').props.sample.values).toEqual([3, 8]);
  });

  it('"Fill with sample data" only shows for unbound data components with a model configured', () => {
    const { AI, WireframeSkill, document } = app;
    // Explicitly no AI (clear the seeded local default) → no button.
    AI.saveSettings({ profiles: [], defaultProfileId: null, taskDefaults: {} });
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._selId = 'b1'; WireframeSkill.render();
    expect(document.querySelector('.wf-props').textContent).not.toContain('Fill with sample data');
    // AI configured + unbound → button appears.
    mockAi();
    WireframeSkill.render();
    expect(document.querySelector('.wf-props').textContent).toContain('Fill with sample data');
    // Bound component → real data previews; no fill button.
    WireframeSkill._selId = 'k1'; WireframeSkill.render();
    expect(document.querySelector('.wf-props').textContent).not.toContain('Fill with sample data');
  });
});

describe('export fidelity (styles survive serialisation)', () => {
  it('embeds the canvas CSS and strips editor chrome from the exported SVG', () => {
    const { WireframeSkill } = app;
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill._selId = 'b1'; WireframeSkill.render();   // selected → live svg has a resize handle
    const xml = WireframeSkill._exportSvgXml();
    expect(xml).toContain('<style');
    expect(xml).toContain('.wf-comp rect.body');
    expect(xml).not.toContain('wf-resize');
    expect(xml).not.toContain('selected');
  });

  it('exports at the chosen fidelity — preview glyphs ride along with inline presentation attributes', () => {
    const { WireframeSkill } = app;
    editPreview();
    const xml = WireframeSkill._exportSvgXml();
    expect(xml).toContain('wf-glyph');
    expect(xml).toContain('#3b82f6'); // glyph styling is attribute-borne, not class-borne
  });
});
