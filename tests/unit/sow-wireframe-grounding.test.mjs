// SoW drafts grounded in the design of attached wireframes — the field/calc map
// and answered metrics ride into the draft/redraft prompts so the Scope /
// Deliverables describe the dashboards actually being built.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;
const sowDef = () => app.Definitions.loadJson('sow/sow-definition.json');

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' })],
    metrics: [makeMetric({ id: 'MET-1', name: 'Revenue', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function makeWf(bound) {
  const wf = {
    id: 'WF-' + Math.random().toString(36).slice(2, 7), customer: 'Acme Industries',
    name: 'Exec dashboard', grid: { cols: 12, rows: 8 }, status: 'Concept', template_id: 'default', template_kind: 'tableau',
    components: [
      { id: 't', type: 'title', title: 'Sales overview', x: 0, y: 0, w: 12, h: 1, props: {} },
      { id: 'k', type: 'kpi', title: 'Revenue', x: 0, y: 1, w: 3, h: 2, props: {}, metric_id: bound ? 'MET-1' : undefined }
    ],
    metric_ids: bound ? ['MET-1'] : [], tableau_refs: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  };
  app.App.data.wireframes.push(wf);
  return wf;
}

function makeSow() {
  const def = sowDef();
  const filler = Array.from({ length: 60 }, (_, i) => 'w' + i).join(' ');
  return app.Sow.create({
    customer: 'Acme Industries', definition: def,
    generatedSections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true, phases: [] })),
    name: 'Scope of Work', source_text: 'src'
  });
}

describe('Sow.wireframeGrounding', () => {
  it('is null with nothing attached', () => {
    const { Sow } = app;
    expect(Sow.wireframeGrounding(makeSow())).toBeNull();
  });

  it('packs name, status, answered metrics and the field map', () => {
    const { Sow } = app;
    const sow = makeSow();
    const wf = makeWf(true);
    Sow.toggleWireframe(sow.id, wf.id);
    const g = Sow.wireframeGrounding(Sow.get(sow.id));
    expect(g).toHaveLength(1);
    expect(g[0].name).toBe('Exec dashboard');
    expect(g[0].metrics_answered).toContain('Revenue');
    expect(g[0].fields.some(f => f.component === 'kpi')).toBe(true);
  });

  it('omits Superseded wireframes from the pack', () => {
    const { Sow, Wireframe } = app;
    const sow = makeSow();
    const wf = makeWf(true);
    Sow.toggleWireframe(sow.id, wf.id);
    Wireframe.setStatus(wf.id, 'Superseded', Sow._wireframeDef('Acme Industries'));
    expect(Sow.wireframeGrounding(Sow.get(sow.id))).toBeNull();
  });

  it('groundingBlock wraps the pack in <wireframe_facts>, empty string when none', () => {
    const { Sow } = app;
    const sow = makeSow();
    expect(Sow.wireframeGroundingBlock(sow)).toBe('');
    Sow.toggleWireframe(sow.id, makeWf(true).id);
    const block = Sow.wireframeGroundingBlock(Sow.get(sow.id));
    expect(block).toContain('<wireframe_facts>');
    expect(block).toContain('Revenue');
  });
});

describe('draft prompt carries the wireframe design', () => {
  it('injects <wireframe_facts> into the section-draft request', async () => {
    const { Sow, SowSkill, AI } = app;
    AI.upsertProfile({ id: 'mp', name: 'Mock', adapter: 'mock', model: 'mock', toolMode: 'native' });
    AI.setDefaultProfile('mp');
    AI.ADAPTERS.mock.program([{ text: '{"content":"Drafted scope referencing the dashboard."}' }]);
    const sow = makeSow();
    Sow.toggleWireframe(sow.id, makeWf(true).id);
    SowSkill.open({}); SowSkill.edit(sow.id);
    const sectionId = Sow.get(sow.id).sections[0].id;
    await SowSkill.uiDraftSection(sectionId);
    const sent = JSON.stringify(AI.ADAPTERS.mock._calls[0].messages);
    expect(sent).toContain('<wireframe_facts>');
    expect(sent).toContain('Revenue');
  });
});
