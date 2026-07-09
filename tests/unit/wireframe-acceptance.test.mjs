// WF-9 — Structured compare-to-built: persisted acceptance runs + built-drift.
// Verdicts (pass/fail/cannot_verify) persist through the pushUndo'd
// recordAcceptanceRun; a passing run's spec signature detects later drift; a
// fully manual tick-off works with no model. Mock adapter only.

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

function board() {
  const { Wireframe } = app;
  const wf = Wireframe.create({ customer: 'Acme Industries', definition: def(), name: 'Board', source: 'test' });
  const t = Wireframe.addComponent(wf.id, 'title', def(), { x: 0, y: 0 });
  Wireframe.updateComponent(wf.id, t.id, { x: 0, y: 0, w: 12, h: 1, title: 'Board' }, def());
  const kpi = Wireframe.addComponent(wf.id, 'kpi', def(), { x: 0, y: 1 });
  Wireframe.updateComponent(wf.id, kpi.id, { x: 0, y: 1, w: 2, h: 1, title: 'Revenue' }, def());
  Wireframe.setComponentMetric(wf.id, kpi.id, 'MET-1');
  return Wireframe.get(wf.id);
}

describe('WF-9 recordAcceptanceRun (persist + undoable)', () => {
  it('stores a clamped run, stamps a signature and passed flag; undoable', () => {
    const { Wireframe, App } = app;
    const wf = board();
    const r = Wireframe.recordAcceptanceRun(wf.id, {
      mode: 'manual',
      items: [{ item: 'Grid matches', verdict: 'pass' }, { item: 'KPI present', verdict: 'bogus' }],
      summary: 'manual'
    }, def());
    expect(r.ok).toBe(true);
    expect(r.run.items[1].verdict).toBe('cannot_verify'); // bogus clamped
    expect(r.run.passed).toBe(true);                        // no fail
    expect(typeof r.run.signature).toBe('string');
    expect(Wireframe.latestAcceptanceRun(Wireframe.get(wf.id)).id).toBe(r.run.id);
    App.undo();
    expect(Wireframe.get(wf.id).acceptance_runs.length).toBe(0);
  });
  it('a run with any fail is not passed and exposes failed component ids', () => {
    const { Wireframe } = app;
    const wf = board();
    const kpiId = wf.components.find(c => c.type === 'kpi').id;
    const r = Wireframe.recordAcceptanceRun(wf.id, { mode: 'manual', items: [
      { item: 'Grid', verdict: 'pass', compId: null },
      { item: 'KPI', verdict: 'fail', compId: kpiId }
    ] }, def());
    expect(r.run.passed).toBe(false);
    expect(Wireframe.failedComponentIds(Wireframe.get(wf.id))[kpiId]).toBe(true);
  });
});

describe('WF-9 built-drift (living-documents contract)', () => {
  it('fires only after a passing run once the spec changes', () => {
    const { Wireframe } = app;
    const wf = board();
    // no run yet → no baseline
    expect(Wireframe.builtDrift(Wireframe.get(wf.id), def()).has_baseline).toBe(false);
    // a passing run captures the signature
    const items = Wireframe.acceptanceItems(Wireframe.get(wf.id), def()).map(it => ({ item: it.item, compId: it.compId, verdict: 'pass' }));
    Wireframe.recordAcceptanceRun(wf.id, { mode: 'manual', items }, def());
    expect(Wireframe.builtDrift(Wireframe.get(wf.id), def()).drifted).toBe(false);
    // move a component → spec changes → drift
    const kpiId = Wireframe.get(wf.id).components.find(c => c.type === 'kpi').id;
    Wireframe.updateComponent(wf.id, kpiId, { x: 5 }, def());
    expect(Wireframe.builtDrift(Wireframe.get(wf.id), def()).drifted).toBe(true);
  });
  it('a failing run is not a drift baseline', () => {
    const { Wireframe } = app;
    const wf = board();
    Wireframe.recordAcceptanceRun(wf.id, { mode: 'manual', items: [{ item: 'x', verdict: 'fail' }] }, def());
    expect(Wireframe.builtDrift(Wireframe.get(wf.id), def()).has_baseline).toBe(false);
  });
});

describe('WF-9 compareToBuilt verdicts (vision + text degrade)', () => {
  it('vision run maps per-item verdicts and marks mode vision', async () => {
    const { AI, Wireframe, WireframeSkill } = app;
    const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock', vision: true });
    AI.setDefaultProfile(id);
    const wf = board();
    WireframeSkill._wfId = wf.id; WireframeSkill._mode = 'edit';
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ items: [{ index: 0, verdict: 'pass' }, { index: 1, verdict: 'fail', note: 'no' }], summary: 's' }) }]);
    await WireframeSkill.compareToBuilt('data:image/png;base64,QUJD');
    const run = Wireframe.latestAcceptanceRun(Wireframe.get(wf.id));
    expect(run.mode).toBe('vision');
    expect(run.items[0].verdict).toBe('pass');
    expect(run.items[1].verdict).toBe('fail');
    // items beyond index 1 were not returned → cannot_verify
    expect(run.items.slice(2).every(i => i.verdict === 'cannot_verify')).toBe(true);
  });
  it('text-only degrades to a text-mode run', async () => {
    const { AI, Wireframe, WireframeSkill } = app;
    const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock', vision: false });
    AI.setDefaultProfile(id);
    const wf = board();
    WireframeSkill._wfId = wf.id; WireframeSkill._mode = 'edit';
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ items: [], summary: 'verify by eye' }) }]);
    await WireframeSkill.compareToBuilt('data:image/png;base64,QUJD');
    const run = Wireframe.latestAcceptanceRun(Wireframe.get(wf.id));
    expect(run.mode).toBe('text');
    expect(run.items.every(i => i.verdict === 'cannot_verify')).toBe(true);
  });
});

describe('WF-9 manual tick-off (no AI)', () => {
  it('starts, cycles a verdict, and saves a manual run', () => {
    const { Wireframe, WireframeSkill } = app;
    const wf = board();
    WireframeSkill._wfId = wf.id; WireframeSkill._mode = 'edit';
    WireframeSkill.uiStartManualAcceptance();
    expect(WireframeSkill._pendingAcceptance.items.length).toBeGreaterThan(0);
    expect(WireframeSkill._pendingAcceptance.items.every(i => i.verdict === 'pass')).toBe(true);
    WireframeSkill.uiSetVerdict(1, 'fail');
    WireframeSkill.uiSaveManualAcceptance();
    expect(WireframeSkill._pendingAcceptance).toBe(null);
    const run = Wireframe.latestAcceptanceRun(Wireframe.get(wf.id));
    expect(run.mode).toBe('manual');
    expect(run.passed).toBe(false); // one fail
  });
});
