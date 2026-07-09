// WF-6 — Persona-grounded drafting. A concept declares the persona it is
// designed FOR (persona_id, migration-backfilled). Picking a persona seeds the
// metric checklist from the persona's held metrics (model-free); AI drafting
// folds the persona fact pack into the system prompt. Mock adapter only.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

let app;
const def = () => app.Definitions.loadJson('tableau/wireframe-definition.json');

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    metrics: [
      makeMetric({ id: 'MET-1', name: 'Revenue', customer: 'Acme Industries', raci_defaults: { accountable: ['PER-1'], responsible: [], consulted: [], informed: [] } }),
      makeMetric({ id: 'MET-2', name: 'Churn', customer: 'Acme Industries' })
    ],
    personas: [makePersona({
      id: 'PER-1', customer: 'Acme Industries', name: 'CFO',
      business_questions: ['Are we hitting revenue targets?', 'Where is margin leaking?'],
      goals: 'Grow profitable revenue', pain_points: 'Reporting is slow',
      information_needs: 'Weekly revenue vs plan',
      metric_holdings: [{ metric_id: 'MET-1', filter: {}, targets: [] }, { metric_id: 'MET-2', filter: {}, targets: [] }]
    })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function newWf() {
  return app.Wireframe.create({ customer: 'Acme Industries', definition: def(), name: 'Board', source: 'test' });
}

describe('WF-6 persona_id persistence + migration', () => {
  it('migration backfills persona_id and acceptance_runs on legacy wireframes', () => {
    const { App } = app;
    const data = makeDataset({ personas: [], wireframes: [{ id: 'WF-x', customer: 'Acme Industries', components: [] }] });
    App.migrateSchema(data);
    expect(data.wireframes[0].persona_id).toBe(null);
    expect(Array.isArray(data.wireframes[0].acceptance_runs)).toBe(true);
  });

  it('attachPersona sets persona_id (same-customer only) and is undoable', () => {
    const { Wireframe, App } = app;
    const wf = newWf();
    const r = Wireframe.attachPersona(wf.id, 'PER-1');
    expect(r.ok).toBe(true);
    expect(Wireframe.get(wf.id).persona_id).toBe('PER-1');
    App.undo();
    expect(Wireframe.get(wf.id).persona_id == null).toBe(true);
    // cross-customer / unknown persona → cleared to null
    Wireframe.attachPersona(wf.id, 'NOPE');
    expect(Wireframe.get(wf.id).persona_id).toBe(null);
  });
});

describe('WF-6 metric seeding (model-free)', () => {
  it('seeds wf.metric_ids from the persona held metrics in one undo', () => {
    const { Wireframe, App } = app;
    const wf = newWf();
    const r = Wireframe.attachPersona(wf.id, 'PER-1', { seedMetrics: true });
    expect(r.seeded).toBe(2);
    expect(Wireframe.get(wf.id).metric_ids.sort()).toEqual(['MET-1', 'MET-2']);
    // ONE undo reverts both the persona link and the seeded metrics.
    App.undo();
    const back = Wireframe.get(wf.id);
    expect(back.persona_id == null).toBe(true);
    expect(back.metric_ids.length).toBe(0);
  });
});

describe('WF-6 holdings checklist (model-free)', () => {
  it('flags which held metrics are linked vs actually visualised', () => {
    const { Wireframe } = app;
    const wf = newWf();
    Wireframe.attachPersona(wf.id, 'PER-1'); // no seed → nothing linked yet
    let cl = Wireframe.holdingsChecklist(Wireframe.get(wf.id));
    expect(cl.map(h => h.metric_id).sort()).toEqual(['MET-1', 'MET-2']);
    expect(cl.every(h => !h.linked && !h.visualised)).toBe(true);
    // bind a component to MET-1 → visualised true for MET-1 only
    const kpi = Wireframe.addComponent(wf.id, 'kpi', def(), { x: 0, y: 1 });
    Wireframe.setComponentMetric(wf.id, kpi.id, 'MET-1');
    cl = Wireframe.holdingsChecklist(Wireframe.get(wf.id));
    expect(cl.find(h => h.metric_id === 'MET-1').visualised).toBe(true);
    expect(cl.find(h => h.metric_id === 'MET-2').visualised).toBe(false);
  });
  it('derives an accountable audience role from metric RACI', () => {
    const { Wireframe } = app;
    expect(Wireframe._personaAudienceRole(app.App.data.personas[0])).toBe('accountable');
  });
});

describe('WF-6 aiDraft persona grounding (mock captured messages)', () => {
  it('folds the persona fact pack into the draft system prompt and stamps persona on the draft', async () => {
    const { AI, WireframeSkill, Wireframe } = app;
    const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(id);
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ name: 'CFO board', components: [{ type: 'title', x: 0, y: 0, w: 12, h: 1, title: 'CFO' }] }) }]);
    WireframeSkill.open({ customer: 'Acme Industries' });
    WireframeSkill._draftPersonaId = 'PER-1';
    await WireframeSkill.aiDraft('exec finance dashboard');
    const call = AI.ADAPTERS.mock._calls[0];
    const sys = call.messages.find(m => m.role === 'system').content;
    expect(sys).toContain('TARGET AUDIENCE');
    expect(sys).toContain('Are we hitting revenue targets?');
    expect(sys).toContain('CFO');
    // The fresh draft is stamped with the persona + seeded its held metrics.
    const drafted = Wireframe.list('Acme Industries').slice(-1)[0];
    expect(drafted.persona_id).toBe('PER-1');
    expect(drafted.metric_ids.sort()).toEqual(['MET-1', 'MET-2']);
  });

  it('emits no persona block when none is targeted', async () => {
    const { AI, WireframeSkill } = app;
    const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(id);
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ name: 'Plain', components: [{ type: 'title', x: 0, y: 0, w: 12, h: 1, title: 'Plain' }] }) }]);
    WireframeSkill.open({ customer: 'Acme Industries' });
    WireframeSkill._draftPersonaId = null;
    await WireframeSkill.aiDraft('plain dashboard');
    const sys = AI.ADAPTERS.mock._calls[0].messages.find(m => m.role === 'system').content;
    expect(sys).not.toContain('TARGET AUDIENCE');
  });
});
