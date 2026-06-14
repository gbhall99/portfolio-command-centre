// W3 — multi-dashboard wireframe sets. A "set" is wireframes sharing a set_id;
// addPage promotes a standalone into a set and appends ordered pages. The build
// spec can emit a whole set; AI can draft a linked set. Mock adapter only.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    metrics: [makeMetric({ id: 'MET-1', name: 'Revenue', customer: 'Acme Industries' })],
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function def() { return app.Definitions.loadJson('tableau/wireframe-definition.json'); }

function makeWf() {
  return app.Wireframe.create({ customer: 'Acme Industries', definition: def(), name: 'Exec board', project_id: 'A-1' });
}

describe('Wireframe.set / setOf', () => {
  it('a standalone wireframe is a set of one (itself)', () => {
    const wf = makeWf();
    const members = app.Wireframe.setOf(wf);
    expect(members.length).toBe(1);
    expect(members[0].id).toBe(wf.id);
  });
});

describe('Wireframe.addPage', () => {
  it('promotes the source into a set and appends an ordered page', () => {
    const wf = makeWf();
    app.Wireframe.attachProject(wf.id, 'A-1');
    const page = app.Wireframe.addPage(wf.id);
    expect(page).toBeTruthy();
    const src = app.Wireframe.get(wf.id);
    expect(src.set_id).toBeTruthy();
    expect(page.set_id).toBe(src.set_id);
    expect(page.set_order).toBe((src.set_order || 0) + 1);
    const members = app.Wireframe.set(src.set_id);
    expect(members.map(m => m.id)).toEqual([src.id, page.id]);
  });

  it('the new page inherits customer/project/grid/template and starts blank', () => {
    const wf = makeWf();
    app.Wireframe.attachProject(wf.id, 'A-1');
    const page = app.Wireframe.addPage(wf.id);
    expect(page.customer).toBe('Acme Industries');
    expect(page.project_id).toBe('A-1');
    expect(page.grid).toEqual(wf.grid);
    expect(page.template_kind).toBe(wf.template_kind);
    expect(page.components.length).toBe(0);
  });

  it('a third page keeps incrementing the order', () => {
    const wf = makeWf();
    const p2 = app.Wireframe.addPage(wf.id);
    const p3 = app.Wireframe.addPage(wf.id);
    const members = app.Wireframe.set(wf.set_id || app.Wireframe.get(wf.id).set_id);
    expect(members.length).toBe(3);
    expect(p3.set_order).toBeGreaterThan(p2.set_order);
  });

  it('is undoable (removes the page and the promotion)', () => {
    const wf = makeWf();
    app.Wireframe.addPage(wf.id);
    expect(app.App.data.wireframes.length).toBe(2);
    app.App.undo();
    expect(app.App.data.wireframes.length).toBe(1);
    expect(app.Wireframe.get(wf.id).set_id).toBeFalsy();
  });
});

describe('Wireframe.toSetBuildSpec', () => {
  it('emits every page in order', () => {
    const wf = makeWf();
    app.Wireframe.addComponent(wf.id, 'title', def());
    const page = app.Wireframe.addPage(wf.id);
    app.Wireframe.addComponent(page.id, 'title', def());
    const spec = app.Wireframe.toSetBuildSpec(wf);
    expect(spec.pages.length).toBe(2);
    expect(spec.name).toBe('Exec board');
  });
});

describe('Reports wireframe_spec for sets', () => {
  it('a standalone wireframe keeps the single-page section layout (+ Phase 3.2 field-map & checklist)', () => {
    const wf = makeWf();
    app.Wireframe.addComponent(wf.id, 'title', def());
    const doc = app.Reports._build('wireframe_spec', { wireframeId: wf.id });
    expect(doc.sections.map(s => s.id)).toEqual(['ws-overview', 'ws-components', 'ws-fieldmap', 'ws-checklist', 'ws-refs']);
  });

  it('a set emits per-page section groups', () => {
    const wf = makeWf();
    app.Wireframe.addComponent(wf.id, 'title', def());
    const page = app.Wireframe.addPage(wf.id);
    app.Wireframe.addComponent(page.id, 'title', def());
    const doc = app.Reports._build('wireframe_spec', { wireframeId: wf.id });
    const ids = doc.sections.map(s => s.id);
    expect(ids).toContain('ws-overview-0');
    expect(ids).toContain('ws-overview-1');
    expect(ids).toContain('ws-components-1');
    expect(doc.title).toContain('2 dashboards');
  });
});

describe('WireframeSkill.aiDraftSet', () => {
  it('drafts N linked dashboards sharing one set (mock adapter)', async () => {
    const { AI, WireframeSkill, Wireframe } = app;
    const pid = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(pid);
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({
      dashboards: [
        { name: 'Overview', components: [{ type: 'title', x: 0, y: 0, w: 12, h: 1, title: 'Overview' }, { type: 'kpi', x: 0, y: 1, w: 3, h: 1, title: 'Revenue' }] },
        { name: 'Sales', components: [{ type: 'title', x: 0, y: 0, w: 12, h: 1, title: 'Sales' }] }
      ]
    }) }]);
    WireframeSkill.open({ customer: 'Acme Industries' });
    await WireframeSkill.aiDraftSet('exec suite');
    const all = Wireframe.list('Acme Industries');
    expect(all.length).toBe(2);
    const setId = all[0].set_id;
    expect(setId).toBeTruthy();
    const members = Wireframe.set(setId);
    expect(members.length).toBe(2);
    expect(members.map(m => m.name)).toEqual(['Overview', 'Sales']);
    expect(members[0].components.some(c => c.type === 'title')).toBe(true);
  });
});
