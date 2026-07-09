// WF-7 — Business-question traceability. Data-bearing components cite persona
// business_questions (governed enum). The matrix maps question → metric → visual
// with unanswered/orphan flags + coverage. AI mapping is confirm-gated. The SOW
// wireframe grounding folds in the matrix. Mock adapter only.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

let app;
const def = () => app.Definitions.loadJson('tableau/wireframe-definition.json');
const Q1 = 'Are we hitting revenue targets?';
const Q2 = 'Where is margin leaking?';

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    metrics: [makeMetric({ id: 'MET-1', name: 'Revenue', customer: 'Acme Industries' })],
    personas: [makePersona({ id: 'PER-1', customer: 'Acme Industries', name: 'CFO', business_questions: [Q1, Q2], metric_holdings: [{ metric_id: 'MET-1', filter: {}, targets: [] }] })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function boardWith() {
  const { Wireframe } = app;
  const wf = Wireframe.create({ customer: 'Acme Industries', definition: def(), name: 'Board', source: 'test' });
  Wireframe.attachPersona(wf.id, 'PER-1');
  const kpi = Wireframe.addComponent(wf.id, 'kpi', def(), { x: 0, y: 1 });
  Wireframe.updateComponent(wf.id, kpi.id, { x: 0, y: 1, w: 2, h: 1, title: 'Revenue' }, def());
  Wireframe.setComponentMetric(wf.id, kpi.id, 'MET-1');
  const bar = Wireframe.addComponent(wf.id, 'bar', def(), { x: 3, y: 1 });
  Wireframe.updateComponent(wf.id, bar.id, { x: 3, y: 1, w: 4, h: 3, title: 'By region' }, def());
  return { wf: Wireframe.get(wf.id), kpiId: kpi.id, barId: bar.id };
}

describe('WF-7 setComponentAnswers (validated against the persona list)', () => {
  it('keeps authored questions, drops invalid + duplicates, undoable', () => {
    const { Wireframe, App } = app;
    const { wf, kpiId } = boardWith();
    const r = Wireframe.setComponentAnswers(wf.id, kpiId, [Q1, 'INVENTED?', Q1, Q2]);
    expect(r.ok).toBe(true);
    const c = Wireframe.get(wf.id).components.find(x => x.id === kpiId);
    expect(c.props.answers).toEqual([Q1, Q2]); // invalid + dupe dropped
    App.undo();
    const back = Wireframe.get(wf.id).components.find(x => x.id === kpiId);
    expect(back.props.answers).toBeUndefined();
  });
  it('refuses non-data-bearing components', () => {
    const { Wireframe } = app;
    const { wf } = boardWith();
    const title = Wireframe.get(wf.id).components.find(c => c.type === 'title') || Wireframe.addComponent(wf.id, 'title', def());
    const r = Wireframe.setComponentAnswers(wf.id, title.id, [Q1]);
    expect(r.ok).toBe(false);
  });
});

describe('WF-7 matrix (deterministic)', () => {
  it('maps question → metric → component, flags unanswered + orphans + coverage', () => {
    const { Wireframe } = app;
    const { wf, kpiId } = boardWith();
    Wireframe.setComponentAnswers(wf.id, kpiId, [Q1]); // bar left untagged → orphan
    const m = Wireframe.traceabilityMatrix(Wireframe.get(wf.id));
    expect(m.has_persona).toBe(true);
    expect(m.coverage).toEqual({ total: 2, answered: 1, pct: 50 });
    const row1 = m.rows.find(r => r.question === Q1);
    expect(row1.answered).toBe(true);
    expect(row1.metrics).toEqual(['Revenue']);
    expect(row1.components.map(c => c.id)).toEqual([kpiId]);
    expect(m.unanswered).toEqual([Q2]);
    expect(m.orphans.map(o => o.type)).toEqual(['bar']);
    // deterministic
    expect(Wireframe.traceabilityMatrix(Wireframe.get(wf.id))).toEqual(m);
  });
  it('has_persona false with no linked persona', () => {
    const { Wireframe } = app;
    const wf = Wireframe.create({ customer: 'Acme Industries', definition: def(), name: 'NoPersona', source: 'test' });
    expect(Wireframe.traceabilityMatrix(wf).has_persona).toBe(false);
  });
});

describe('WF-7 AI mapping is confirm-gated', () => {
  it('uiMapQuestions stores a pending diff and mutates nothing until confirm', async () => {
    const { AI, Wireframe, WireframeSkill, App } = app;
    const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(id);
    const { wf, kpiId, barId } = boardWith();
    WireframeSkill._wfId = wf.id; WireframeSkill._mode = 'edit';
    // Model maps kpi→Q1 (+ an invented question that must drop) and a stray comp id.
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ mappings: [
      { component_id: kpiId, questions: [Q1, 'INVENTED?'] },
      { component_id: barId, questions: [Q2] },
      { component_id: 'zzz', questions: [Q1] }
    ] }) }]);
    await WireframeSkill.uiMapQuestions();
    expect(WireframeSkill._qMap).toBeTruthy();
    // stray id dropped; invented question dropped
    const entryK = WireframeSkill._qMap.entries.find(e => e.compId === kpiId);
    expect(entryK.add).toEqual([Q1]);
    expect(WireframeSkill._qMap.entries.some(e => e.compId === 'zzz')).toBe(false);
    // nothing mutated yet
    expect(Wireframe.get(wf.id).components.find(c => c.id === kpiId).props.answers).toBeUndefined();
    const undoBefore = App.undoStack.length;
    WireframeSkill.uiConfirmQMap();
    expect(WireframeSkill._qMap).toBe(null);
    expect(Wireframe.get(wf.id).components.find(c => c.id === kpiId).props.answers).toEqual([Q1]);
    expect(Wireframe.get(wf.id).components.find(c => c.id === barId).props.answers).toEqual([Q2]);
    // one batch = one undo reverts the whole mapping
    expect(App.undoStack.length).toBe(undoBefore + 1);
    App.undo();
    expect(Wireframe.get(wf.id).components.find(c => c.id === kpiId).props.answers).toBeUndefined();
  });
});

describe('WF-7 Sow.wireframeGrounding folds in the matrix', () => {
  it('includes stakeholder_questions_answered for the attached wireframe', () => {
    const { Wireframe, Sow, App } = app;
    const { wf, kpiId } = boardWith();
    Wireframe.setComponentAnswers(wf.id, kpiId, [Q1]);
    const sow = { id: 'SOW-1', customer: 'Acme Industries', wireframe_ids: [wf.id], sections: [], status: 'Draft' };
    App.data.sows.push(sow);
    const g = Sow.wireframeGrounding(sow);
    expect(g).toBeTruthy();
    expect(g[0].stakeholder_questions_answered).toEqual([{ question: Q1, metrics: ['Revenue'] }]);
  });
});
