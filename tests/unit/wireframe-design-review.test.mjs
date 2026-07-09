// WF-3 — design review: deterministic design-lint pack + attention-order overlay
// + one-click fix, with an OPTIONAL AI narration that can never introduce a
// finding. Layer 1 is pure geometry/data; Layer 2 narrates the fact pack only.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

let app;
function def() { return app.Definitions.loadJson('tableau/wireframe-definition.json'); }

function seed(components, metric_ids) {
  app.App.data.wireframes.push({
    id: 'WF-1', customer: 'Acme Industries', name: 'Board', grid: { cols: 12, rows: 8 },
    status: 'Concept', template_id: 'default', template_kind: 'tableau',
    components: components, metric_ids: metric_ids || [], tableau_refs: [],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  });
  return app.Wireframe.get('WF-1');
}

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    metrics: [
      makeMetric({ id: 'MET-1', name: 'Revenue', customer: 'Acme Industries' }),
      makeMetric({ id: 'MET-2', name: 'Margin', customer: 'Acme Industries' })
    ],
    personas: [
      makePersona({
        id: 'PER-CFO', name: 'CFO', customer: 'Acme Industries',
        business_questions: ['How is revenue trending?', 'Is margin on target?', 'Where is cash at risk?'],
        metric_holdings: [{ id: 'H1', metric_id: 'MET-1' }, { id: 'H2', metric_id: 'MET-2' }]
      })
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

// A clean, well-ordered concept that should pass every lint rule.
function cleanComponents() {
  return [
    { id: 't1', type: 'title', title: 'Sales overview', x: 0, y: 0, w: 12, h: 1, props: {} },
    { id: 'k1', type: 'kpi', title: 'Revenue', x: 0, y: 1, w: 3, h: 1, props: {} },
    { id: 'k2', type: 'kpi', title: 'Margin', x: 3, y: 1, w: 3, h: 1, props: {} },
    { id: 'b1', type: 'bar', title: 'Top products', x: 0, y: 3, w: 6, h: 3, props: {} },
    { id: 'l1', type: 'line', title: 'Revenue trend', x: 6, y: 3, w: 6, h: 3, props: {} }
  ];
}

describe('Wireframe.designReview — the lint rules pass on a clean layout', () => {
  it('a clean, well-ordered concept scores highly with no findings', () => {
    const wf = seed(cleanComponents());
    const r = app.Wireframe.designReview(wf, def());
    expect(r.findings.length).toBe(0);
    expect(r.score).toBe(100);
    expect(r.grade).toBe('A');
  });
});

describe('Wireframe.designReview — each rule fires on a violating layout', () => {
  it('scan_order: a KPI below a chart is flagged (high) and fixable', () => {
    const wf = seed([
      { id: 't1', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} },
      { id: 'b1', type: 'bar', title: 'Chart', x: 0, y: 1, w: 6, h: 2, props: {} },
      { id: 'k1', type: 'kpi', title: 'Below', x: 0, y: 4, w: 3, h: 1, props: {} }
    ]);
    const r = app.Wireframe.designReview(wf, def());
    const f = r.findings.find(x => x.id === 'scan_order' && x.severity === 'high');
    expect(f).toBeTruthy();
    expect(f.compIds).toContain('k1');
    expect(r.violating.k1).toBe(true);
    expect(r.fixable).toBe(true);
  });

  it('scan_order: a title not anchored top-left is flagged (medium)', () => {
    const wf = seed([{ id: 't1', type: 'title', title: 'T', x: 6, y: 0, w: 6, h: 1, props: {} }]);
    const r = app.Wireframe.designReview(wf, def());
    expect(r.findings.some(x => x.id === 'scan_order' && x.compIds.includes('t1'))).toBe(true);
  });

  it('row_density: more than the ceiling components in one row is flagged', () => {
    const row = [{ id: 't1', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} }];
    for (let i = 0; i < 5; i++) row.push({ id: 'k' + i, type: 'kpi', title: 'K' + i, x: i * 2, y: 1, w: 2, h: 1, props: {} });
    const wf = seed(row);
    const r = app.Wireframe.designReview(wf, def());
    expect(r.findings.some(x => x.id === 'row_density')).toBe(true);
  });

  it('filter_window: more than 5 filters is flagged; a clean 4-filter layout is not', () => {
    const many = [{ id: 't1', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} }];
    for (let i = 0; i < 6; i++) many.push({ id: 'f' + i, type: 'filter', title: 'F' + i, x: i >= 3 ? 9 : i * 3, y: i >= 3 ? i - 3 : 0, w: 3, h: 1, props: {} });
    let r = app.Wireframe.designReview(seed(many), def());
    expect(r.findings.some(x => x.id === 'filter_window')).toBe(true);
    app.App.data.wireframes = [];
    const four = [{ id: 't1', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} }];
    for (let i = 0; i < 4; i++) four.push({ id: 'f' + i, type: 'filter', title: 'F' + i, x: 9, y: i, w: 3, h: 1, props: {} });
    r = app.Wireframe.designReview(seed(four), def());
    expect(r.findings.some(x => x.id === 'filter_window')).toBe(false);
  });

  it('data_ink: an empty text/container block is flagged', () => {
    const wf = seed([
      { id: 't1', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} },
      { id: 'x1', type: 'text', title: '', x: 0, y: 1, w: 3, h: 1, props: {} }
    ]);
    const r = app.Wireframe.designReview(wf, def());
    expect(r.findings.some(x => x.id === 'data_ink' && x.compIds.includes('x1'))).toBe(true);
  });

  it('colour_semantics: a RAG-worded chart title is flagged', () => {
    const wf = seed([
      { id: 't1', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} },
      { id: 'b1', type: 'bar', title: 'Status: red / green traffic light', x: 0, y: 1, w: 6, h: 2, props: {} }
    ]);
    const r = app.Wireframe.designReview(wf, def());
    expect(r.findings.some(x => x.id === 'colour_semantics' && x.compIds.includes('b1'))).toBe(true);
  });
});

describe('attention order is deterministic', () => {
  it('numbers components in reading order (top-to-bottom, left-to-right), title excluded', () => {
    const wf = seed(cleanComponents());
    const a = app.Wireframe.designReview(wf, def()).attentionOrder;
    const b = app.Wireframe.designReview(wf, def()).attentionOrder;
    expect(a).toEqual(b);                                   // deterministic
    expect(a.some(x => x.id === 't1')).toBe(false);         // title excluded
    // the two KPIs (row 1) precede the two charts (row 3)
    expect(a[0].id).toBe('k1');
    expect(a[1].id).toBe('k2');
    expect(a.map(x => x.n)).toEqual([1, 2, 3, 4]);
  });
});

describe('one-click fix resolves the scan-order finding', () => {
  it('uiReviewFix re-lays out so the KPI-below-chart finding clears', () => {
    const { WireframeSkill, Wireframe } = app;
    seed([
      { id: 't1', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} },
      { id: 'b1', type: 'bar', title: 'Chart', x: 0, y: 1, w: 6, h: 2, props: {} },
      { id: 'k1', type: 'kpi', title: 'Below', x: 0, y: 4, w: 3, h: 1, props: {} }
    ]);
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill.uiDesignReview();
    expect(WireframeSkill._review.findings.some(f => f.id === 'scan_order' && f.severity === 'high')).toBe(true);
    WireframeSkill.uiReviewFix();
    // after the priority re-pack the KPI reads above the chart
    const wf = Wireframe.get('WF-1');
    const kpi = wf.components.find(c => c.id === 'k1');
    const bar = wf.components.find(c => c.id === 'b1');
    expect(kpi.y).toBeLessThanOrEqual(bar.y);
    expect(WireframeSkill._review.findings.some(f => f.id === 'scan_order' && f.severity === 'high')).toBe(false);
  });
});

describe('Layer 2 — AI narration can never introduce a rule violation', () => {
  it('the model narrates the fact pack; findings still come only from the deterministic scan', async () => {
    const { AI, WireframeSkill, Wireframe } = app;
    const pid = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(pid);
    // A clean layout: deterministic review has zero findings.
    seed(cleanComponents(), ['MET-1']);
    WireframeSkill.open({}); WireframeSkill.edit('WF-1');
    WireframeSkill.uiDesignReview();
    expect(WireframeSkill._review.findings.length).toBe(0);
    // The model tries to assert a brand-new problem — it lands only as prose.
    AI.ADAPTERS.mock.program([{ text: 'INVENTED FINDING: the colour contrast fails WCAG and there is a missing map component.' }]);
    await WireframeSkill.uiReviewNarrate();
    expect(WireframeSkill._reviewNarration).toContain('INVENTED FINDING');
    // narration is stored as escaped commentary, not promoted into the findings
    expect(WireframeSkill._review.findings.length).toBe(0);
    // re-running the deterministic scan still yields no findings
    expect(Wireframe.designReview(Wireframe.get('WF-1'), def()).findings.length).toBe(0);
  });

  it('reviewGrounding carries only deterministic facts + persona business questions', () => {
    const wf = seed(cleanComponents(), ['MET-1']);
    const pack = app.Wireframe.reviewGrounding(wf, def());
    expect(pack.personas[0].persona).toBe('CFO');
    expect(pack.personas[0].business_questions).toContain('Is margin on target?');
    expect(pack.personas[0].held_metrics).toBe(2);
    expect(pack.personas[0].held_metrics_answered).toBe(1);  // only MET-1 is answered
    expect(pack.metrics_answered).toContain('Revenue');
  });
});
