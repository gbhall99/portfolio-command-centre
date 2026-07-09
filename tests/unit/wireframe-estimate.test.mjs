// WF-8 — Priced concepts: wireframe complexity → Tableau sizing → live quote
// delta. A DETERMINISTIC complexity model (governed, tunable COMPLEXITY_WEIGHTS)
// maps a concept to suggested Tableau story points, compared to the linked
// project's size_tableau; the £ delta is priced ONLY through Billing —
// figures are never model-written. "Apply suggested sizing" raises a
// confirm-gated proposal routed through App.updateProject (undoable, no mutate
// until applied). The wireframe_estimate read tool wraps the same helper. The
// optional AI pass adds a rationale + confidence and cannot touch the £ figure.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

let app;
function def() { return app.Definitions.loadJson('tableau/wireframe-definition.json'); }

// Re-derive the suggestion from the live weights — proves the published fn
// matches the governed formula (and that weights, not magic numbers, drive it).
function expectedSP(a, wf) {
  const W = a.Wireframe.COMPLEXITY_WEIGHTS;
  const cx = a.Wireframe.complexity(wf);
  let sp = W.base;
  Object.keys(cx.by_type).forEach(t => {
    const w = (W.component && W.component[t] != null) ? W.component[t] : W.component_default;
    sp += w * cx.by_type[t];
  });
  sp += W.per_page * Math.max(0, cx.pages - 1) + W.per_metric * cx.distinct_metrics + W.per_interaction * cx.interactions;
  const step = W.round_to > 0 ? W.round_to : 1;
  return Math.max(0, Math.round(sp / step) * step);
}

const BILLING = { currency: 'USD', hours_per_point: 8, rate_table: { 'United Kingdom': { Consultant: 100 } }, customer_defaults: { 'Acme Industries': { country: 'United Kingdom', level: 'Consultant' } } };

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#f59e0b' }],
    projects: [
      makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', size_tableau: 5 }),
      makeProject({ id: 'G-1', name: 'Globex Gamma', customer: 'Globex', size_tableau: 3 })
    ],
    metrics: [makeMetric({ id: 'MET-1', name: 'Revenue', customer: 'Acme Industries' })],
    settings: { billing: BILLING }
  }));
  app.App.activeCustomer = 'Acme Industries';
  // A concept linked to Acme Alpha: title + a metric-bound KPI + a bar with a
  // measure prop + a filter (interaction). Deterministic build.
  const wf = app.Wireframe.create({ customer: 'Acme Industries', definition: def(), name: 'Exec board', project_id: 'A-1' });
  app.Wireframe.addComponent(wf.id, 'title', def());
  const kpi = app.Wireframe.addComponent(wf.id, 'kpi', def());
  app.Wireframe.setComponentMetric(wf.id, kpi.id, 'MET-1');
  const bar = app.Wireframe.addComponent(wf.id, 'bar', def());
  app.Wireframe.setComponentProps(wf.id, bar.id, { measure: 'Sales', dimension: 'Region' }, def());
  app.Wireframe.addComponent(wf.id, 'filter', def());
  app._wfId = wf.id;
});
afterEach(() => app.teardown());

function wf() { return app.Wireframe.get(app._wfId); }
const ctx = () => ({ customer: 'Acme Industries', proposals: [], citations: [] });

describe('Wireframe complexity → suggested Tableau points (deterministic)', () => {
  it('is deterministic and matches the governed weight formula', () => {
    const { Wireframe } = app;
    const a = Wireframe.suggestedTableauPoints(wf());
    const b = Wireframe.suggestedTableauPoints(wf());
    expect(a).toBe(b);                       // deterministic
    expect(a).toBe(expectedSP(app, wf()));   // formula-driven, integer
    expect(Number.isInteger(a)).toBe(true);
    // complexity signal reflects the concept
    const cx = Wireframe.complexity(wf());
    expect(cx.components).toBe(4);
    expect(cx.distinct_metrics).toBe(1);
    expect(cx.interactions).toBe(1);
    expect(cx.pages).toBe(1);
  });

  it('moves UP with component, metric and page counts', () => {
    const { Wireframe } = app;
    const before = Wireframe.suggestedTableauPoints(wf());
    // add another data-bearing chart → more points
    const line = Wireframe.addComponent(app._wfId, 'line', def());
    const afterComp = Wireframe.suggestedTableauPoints(wf());
    expect(afterComp).toBeGreaterThan(before);
    // bind a second distinct metric → per_metric adds more
    app.App.data.metrics.push({ id: 'MET-2', name: 'Churn', customer: 'Acme Industries' });
    Wireframe.setComponentMetric(app._wfId, line.id, 'MET-2');
    const afterMetric = Wireframe.suggestedTableauPoints(wf());
    expect(afterMetric).toBeGreaterThan(afterComp);
    // add a linked page → per_page adds more
    Wireframe.addPage(app._wfId, 'Drilldown');
    const afterPage = Wireframe.suggestedTableauPoints(wf());
    expect(afterPage).toBeGreaterThan(afterMetric);
  });

  it('honours the tunable weights (changing a weight changes the suggestion)', () => {
    const { Wireframe } = app;
    const base = Wireframe.suggestedTableauPoints(wf());
    Wireframe.COMPLEXITY_WEIGHTS.per_metric += 10;   // one distinct metric bound
    const bumped = Wireframe.suggestedTableauPoints(wf());
    expect(bumped).toBe(base + 10);
  });
});

describe('Wireframe.estimate — £ delta from Billing only', () => {
  it('prices the delta via Billing.quoteForProject (not written by hand)', () => {
    const { Wireframe, Billing, App } = app;
    const est = Wireframe.estimate(wf());
    const suggested = est.suggested_tableau_points;
    const project = App.data.projects.find(p => p.id === 'A-1');
    // Independent Billing computation: quote as-is vs with suggested tableau SP.
    const baseAmt = Billing.quoteForProject(project).totals.amount;
    const suggAmt = Billing.quoteForProject(Object.assign({}, project, { size_tableau: suggested })).totals.amount;
    expect(est.priced).toBe(true);
    expect(est.current_tableau_points).toBe(5);
    expect(est.delta_points).toBe(suggested - 5);
    expect(est.current_amount).toBe(baseAmt);
    expect(est.suggested_amount).toBe(suggAmt);
    expect(est.delta_amount).toBe(suggAmt - baseAmt);
    // sanity: with no prepaid, delta = extra SP × hours_per_point × rate
    expect(est.delta_amount).toBe((suggested - 5) * 8 * 100);
  });

  it('never mutates the linked project when estimating', () => {
    const { Wireframe, App } = app;
    Wireframe.estimate(wf());
    expect(App.data.projects.find(p => p.id === 'A-1').size_tableau).toBe(5);
  });

  it('still returns the SP suggestion when there is no rate band (priced=false)', async () => {
    // Drop billing config → no band; the deterministic SP still stands.
    app.App.data.settings.billing = { currency: 'USD', hours_per_point: 8, rate_table: {}, customer_defaults: {} };
    const est = app.Wireframe.estimate(wf());
    expect(est.suggested_tableau_points).toBeGreaterThan(0);
    // no band → amount is 0 for both, delta priced at 0 but priced flag true only when a band exists
    expect(est.delta_amount === 0 || est.priced === false).toBe(true);
  });
});

describe('Wireframe.sizingProposal — confirm-gated, undoable', () => {
  it('returns a proposal that routes through App.updateProject and does NOT mutate until applied', () => {
    const { Wireframe, App } = app;
    const est = Wireframe.estimate(wf());
    const prop = Wireframe.sizingProposal(wf(), 'ai');
    expect(prop).toBeTruthy();
    expect(prop.kind).toBe('wireframe_sizing');
    expect(prop.changes[0]).toEqual({ field: 'size_tableau', before: '5', after: String(est.suggested_tableau_points) });
    // NOT applied yet
    expect(App.data.projects.find(p => p.id === 'A-1').size_tableau).toBe(5);
    // apply routes through App.updateProject (source 'ai', audited + undoable)
    prop.apply();
    expect(App.data.projects.find(p => p.id === 'A-1').size_tableau).toBe(est.suggested_tableau_points);
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'size_tableau')).toBe(true);
    App.undo();
    expect(App.data.projects.find(p => p.id === 'A-1').size_tableau).toBe(5);
  });

  it('is null when there is no linked project or no change', () => {
    const { Wireframe, App } = app;
    // no linked project
    const solo = Wireframe.create({ customer: 'Acme Industries', definition: def(), name: 'Unlinked' });
    expect(Wireframe.sizingProposal(solo, 'ai')).toBeNull();
    // already sized to the suggestion → delta 0 → no proposal
    const est = Wireframe.estimate(wf());
    App.updateProject('A-1', 'size_tableau', est.suggested_tableau_points, 'user');
    expect(Wireframe.sizingProposal(wf(), 'ai')).toBeNull();
  });
});

describe('wireframe_estimate read tool', () => {
  it('returns the estimate scoped to ctx.customer with citations and never mutates', () => {
    const { AgentTools, App } = app;
    const c = ctx();
    const res = AgentTools.invoke('wireframe_estimate', { wireframe_id: app._wfId }, c);
    expect(res.error).toBeUndefined();
    expect(res.suggested_tableau_points).toBe(app.Wireframe.suggestedTableauPoints(wf()));
    expect(res.project_id).toBe('A-1');
    expect(res.priced).toBe(true);
    // citations: the wireframe and its linked project
    expect(c.citations.some(x => x.type === 'wireframe' && x.id === app._wfId)).toBe(true);
    expect(c.citations.some(x => x.type === 'project' && x.id === 'A-1')).toBe(true);
    // read tool never mutates
    expect(App.data.projects.find(p => p.id === 'A-1').size_tableau).toBe(5);
    expect(c.proposals.length).toBe(0);
  });

  it('is customer-scoped — a Globex wireframe is invisible under an Acme context', () => {
    const { AgentTools, Wireframe } = app;
    const gwf = Wireframe.create({ customer: 'Globex', definition: def(), name: 'Globex board', project_id: 'G-1' });
    const res = AgentTools.invoke('wireframe_estimate', { wireframe_id: gwf.id }, ctx());
    expect(res.error).toMatch(/No wireframe/);
  });

  it('validateArgs rejects missing and unknown args', () => {
    const { AgentTools } = app;
    expect(AgentTools.invoke('wireframe_estimate', {}, ctx()).error).toMatch(/Invalid arguments/);
    expect(AgentTools.invoke('wireframe_estimate', { wireframe_id: app._wfId, bogus: 1 }, ctx()).error).toMatch(/unknown arg/);
  });
});

describe('AI calibration — adds rationale, cannot change the £ figure', () => {
  function mock() {
    const pid = app.AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    app.AI.setDefaultProfile(pid);
    return pid;
  }
  it('records a rationale + confidence; the deterministic £ delta is unchanged', async () => {
    const { AI, WireframeSkill, Wireframe } = app;
    mock();
    const before = Wireframe.estimate(wf()).delta_amount;
    // The model even tries to smuggle a figure — it must be ignored.
    AI.ADAPTERS.mock.program([
      { text: JSON.stringify({ rationale: 'Comparable exec boards landed near this size; the estimate looks reasonable. (fake £99,999)', confidence: 'medium' }) }
    ]);
    WireframeSkill._mode = 'edit';
    WireframeSkill._wfId = app._wfId;
    await WireframeSkill.uiCalibrateEstimate();
    expect(WireframeSkill._calibration).toBeTruthy();
    expect(WireframeSkill._calibration.confidence).toBe('medium');
    expect(WireframeSkill._calibration.rationale).toMatch(/reasonable/);
    // The £ figure is recomputed from Billing — untouched by the model.
    const after = Wireframe.estimate(wf()).delta_amount;
    expect(after).toBe(before);
  });
});
