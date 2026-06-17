// Wireframe follow-ups: deterministic tidy (autoFix), build-readiness gate
// (metric binding + no-metric escape hatch), and the extended field map.

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

function wf(components) {
  const w = {
    id: 'WF-1', customer: 'Acme Industries', name: 'Board', grid: { cols: 12, rows: 8 },
    status: 'Concept', template_id: 'default', template_kind: 'tableau',
    components, metric_ids: [], tableau_refs: [],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  };
  app.App.data.wireframes.push(w);
  return w;
}

describe('Wireframe.autoFix (deterministic tidy)', () => {
  it('resolves overlaps and clears conformance position errors, as one undo', () => {
    const { Wireframe, App } = app;
    wf([
      { id: 't', type: 'title', title: 'T', x: 3, y: 4, w: 6, h: 1, props: {} },   // off the top row
      { id: 'a', type: 'kpi', title: 'A', x: 0, y: 0, w: 3, h: 2, props: {} },
      { id: 'b', type: 'kpi', title: 'B', x: 1, y: 1, w: 3, h: 2, props: {} }       // overlaps A
    ]);
    const d = def();
    expect(Wireframe.checkConformance(Wireframe.get('WF-1'), d).ok).toBe(false);
    const before = App.data.audit_log.length;
    const changes = Wireframe.autoFix(Wireframe.get('WF-1'), d);
    expect(changes).toBeGreaterThan(0);
    const conf = Wireframe.checkConformance(Wireframe.get('WF-1'), d);
    expect(conf.errors.filter(e => /overlap|outside|top row/.test(e))).toEqual([]);
    expect(Wireframe.get('WF-1').components.find(c => c.id === 't').y).toBe(0); // title forced to top
    expect(App.data.audit_log.length).toBeGreaterThan(before);
    App.undo();
    expect(Wireframe.get('WF-1').components.find(c => c.id === 'b').y).toBe(1); // reverted
  });

  it('is a no-op (0 changes) on an already-tidy layout', () => {
    const { Wireframe } = app;
    wf([
      { id: 't', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} },
      { id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 3, h: 2, props: {} }
    ]);
    expect(Wireframe.autoFix(Wireframe.get('WF-1'), def())).toBe(0);
  });
});

describe('Wireframe.buildReady', () => {
  it('blocks on structural errors and on unbound data-bearing components', () => {
    const { Wireframe } = app;
    wf([
      { id: 't', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} },
      { id: 'a', type: 'kpi', title: 'A', x: 0, y: 1, w: 3, h: 2, props: {} }       // unbound, metrics exist
    ]);
    let r = Wireframe.buildReady(Wireframe.get('WF-1'), def());
    expect(r.ok).toBe(false);
    expect(r.blockers.some(b => /Bind a metric/.test(b))).toBe(true);
    // Binding the metric clears the blocker.
    Wireframe.setComponentMetric('WF-1', 'a', 'MET-1');
    r = Wireframe.buildReady(Wireframe.get('WF-1'), def());
    expect(r.ok).toBe(true);
  });

  it('the "no metric" escape hatch clears the binding blocker', () => {
    const { Wireframe } = app;
    wf([
      { id: 't', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} },
      { id: 'a', type: 'bar', title: 'Trend', x: 0, y: 1, w: 4, h: 2, props: {} }
    ]);
    expect(Wireframe.buildReady(Wireframe.get('WF-1'), def()).ok).toBe(false);
    Wireframe.setComponentNoMetric('WF-1', 'a', true);
    expect(Wireframe.buildReady(Wireframe.get('WF-1'), def()).ok).toBe(true);
    // Binding a metric later clears the no_metric flag.
    Wireframe.setComponentMetric('WF-1', 'a', 'MET-1');
    expect(Wireframe.get('WF-1').components.find(c => c.id === 'a').props.no_metric).toBeUndefined();
  });
});

describe('Wireframe.fieldMap (extended)', () => {
  it('covers filters / text / containers as well as data-bearing components', () => {
    const { Wireframe } = app;
    wf([
      { id: 't', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: {} },
      { id: 'k', type: 'kpi', title: 'Rev', x: 0, y: 1, w: 3, h: 2, metric_id: 'MET-1', props: {} },
      { id: 'f', type: 'filter', title: 'Region', x: 0, y: 3, w: 2, h: 1, props: {} },
      { id: 'x', type: 'text', title: 'Note', x: 3, y: 3, w: 2, h: 1, props: {} }
    ]);
    const rows = Wireframe.fieldMap(Wireframe.get('WF-1'));
    const byType = (t) => rows.find(r => r.component === t);
    expect(byType('kpi').field).toBe('[Revenue]');
    expect(byType('filter')).toBeTruthy();
    expect(byType('filter').calc).toMatch(/wire this filter/i);
    expect(byType('text')).toBeTruthy();
    // title is not a hand-off row
    expect(rows.find(r => r.component === 'title')).toBeUndefined();
  });
});
