// Wireframe lifecycle (Concept → Approved → Superseded) + attaching wireframes
// to a SoW so SoW approval co-signs them.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;
const wfDef = () => app.Definitions.loadJson('tableau/wireframe-definition.json');
const sowDef = () => app.Definitions.loadJson('sow/sow-definition.json');

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }],
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' })],
    metrics: [makeMetric({ id: 'MET-1', name: 'Revenue', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

// A structurally-conformant wireframe; `bound` controls metric binding.
function makeWf(bound, customer) {
  const wf = {
    id: 'WF-' + Math.random().toString(36).slice(2, 7), customer: customer || 'Acme Industries',
    name: 'Board', grid: { cols: 12, rows: 8 }, status: 'Concept', template_id: 'default', template_kind: 'tableau',
    components: [
      { id: 't', type: 'title', title: 'Sales overview', x: 0, y: 0, w: 12, h: 1, props: {} },
      { id: 'k', type: 'kpi', title: 'Revenue', x: 0, y: 1, w: 3, h: 2, props: {}, metric_id: bound ? 'MET-1' : undefined }
    ],
    metric_ids: [], tableau_refs: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  };
  app.App.data.wireframes.push(wf);
  return wf;
}

function makeSow() {
  const def = sowDef();
  const filler = Array.from({ length: 60 }, (_, i) => 'w' + i).join(' ');
  return app.Sow.create({
    customer: 'Acme Industries', definition: def,
    generatedSections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true, phases: s.id === 'deliverables' ? ['Data Engineering'] : [] })),
    name: 'Scope of Work', source_text: 'src'
  });
}

describe('Wireframe lifecycle', () => {
  it('blocks Approved until build-ready, then approves; undoable + audited', () => {
    const { Wireframe, App } = app;
    const wf = makeWf(false); // unbound kpi → not build-ready
    let r = Wireframe.setStatus(wf.id, 'Approved', wfDef());
    expect(r.ok).toBe(false);
    expect(Wireframe.get(wf.id).status).toBe('Concept');
    Wireframe.setComponentMetric(wf.id, 'k', 'MET-1'); // now build-ready
    const before = App.data.audit_log.length;
    r = Wireframe.setStatus(wf.id, 'Approved', wfDef());
    expect(r.ok).toBe(true);
    expect(Wireframe.get(wf.id).status).toBe('Approved');
    expect(Wireframe.get(wf.id).approved_at).toBeTruthy();
    expect(App.data.audit_log.length).toBeGreaterThan(before);
    App.undo();
    expect(Wireframe.get(wf.id).status).toBe('Concept');
  });

  it('can be marked Superseded from any state without a readiness gate', () => {
    const { Wireframe } = app;
    const wf = makeWf(false);
    expect(Wireframe.setStatus(wf.id, 'Superseded', wfDef()).ok).toBe(true);
    expect(Wireframe.get(wf.id).status).toBe('Superseded');
  });
});

describe('Sow.toggleWireframe', () => {
  it('attaches/detaches and refuses a cross-customer wireframe', () => {
    const { Sow } = app;
    const sow = makeSow();
    const wf = makeWf(true);
    const other = makeWf(true, 'Globex');
    Sow.toggleWireframe(sow.id, wf.id);
    expect(Sow.get(sow.id).wireframe_ids).toContain(wf.id);
    Sow.toggleWireframe(sow.id, other.id); // cross-customer → ignored
    expect(Sow.get(sow.id).wireframe_ids).not.toContain(other.id);
    Sow.toggleWireframe(sow.id, wf.id); // detach
    expect(Sow.get(sow.id).wireframe_ids).not.toContain(wf.id);
  });
});

describe('SoW approval co-signs attached wireframes', () => {
  it('blocks approval while an attached wireframe is not build-ready', () => {
    const { Sow } = app;
    const def = sowDef();
    const sow = makeSow();
    const wf = makeWf(false); // not build-ready
    Sow.toggleWireframe(sow.id, wf.id);
    const v = Sow.validate(Sow.get(sow.id), def);
    expect(v.ok).toBe(false);
    expect(v.errors.some(e => /isn’t build-ready/.test(e))).toBe(true);
    expect(Sow.setStatus(sow.id, 'Approved', def).ok).toBe(false);
  });

  it('approves the SoW and co-signs the wireframe as one undo', () => {
    const { Sow, Wireframe, App } = app;
    const def = sowDef();
    const sow = makeSow();
    const wf = makeWf(true); // build-ready
    Sow.toggleWireframe(sow.id, wf.id);
    expect(Sow.validate(Sow.get(sow.id), def).ok).toBe(true);
    const r = Sow.setStatus(sow.id, 'Approved', def);
    expect(r.ok).toBe(true);
    expect(Sow.get(sow.id).status).toBe('Approved');
    expect(Wireframe.get(wf.id).status).toBe('Approved'); // co-signed
    App.undo(); // single undo reverts BOTH
    expect(Sow.get(sow.id).status).toBe('Draft');
    expect(Wireframe.get(wf.id).status).toBe('Concept');
  });

  it('a Superseded attached wireframe does not gate approval', () => {
    const { Sow, Wireframe } = app;
    const def = sowDef();
    const sow = makeSow();
    const wf = makeWf(false);
    Wireframe.setStatus(wf.id, 'Superseded', wfDef());
    Sow.toggleWireframe(sow.id, wf.id);
    expect(Sow.validate(Sow.get(sow.id), def).ok).toBe(true);
  });
});

describe('sign-off UI', () => {
  it('wireframe editor shows a status chip + an Approve button gated on build-readiness', () => {
    const { Wireframe, WireframeSkill, document } = app;
    const wf = makeWf(false);
    WireframeSkill.open({}); WireframeSkill.edit(wf.id);
    const side = document.querySelector('.wf-side');
    expect(side.textContent).toContain('Concept');
    const approve = [...side.querySelectorAll('button')].find(b => b.textContent.trim() === 'Approve');
    expect(approve).toBeTruthy();
    expect(approve.disabled).toBe(true);                 // not build-ready
    Wireframe.setComponentMetric(wf.id, 'k', 'MET-1');
    WireframeSkill.render();
    const approve2 = [...document.querySelector('.wf-side').querySelectorAll('button')].find(b => b.textContent.trim() === 'Approve');
    expect(approve2.disabled).toBe(false);               // now build-ready
  });

  it('SoW side panel offers a wireframe picker and reflects an attachment', () => {
    const { Sow, SowSkill, document } = app;
    const sow = makeSow();
    const wf = makeWf(true);
    SowSkill.open({}); SowSkill.edit(sow.id);
    expect(document.getElementById('sowSide').textContent).toContain('Wireframes for sign-off');
    expect(document.getElementById('sowWfPicker')).toBeTruthy();
    Sow.toggleWireframe(sow.id, wf.id);
    SowSkill.render();
    const side = document.getElementById('sowSide').textContent;
    expect(side).toContain('Board');      // attached wireframe name
    expect(side).toContain('co-signs');
  });
});
