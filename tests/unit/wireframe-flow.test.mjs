// WF-11 — Dashboard suite flow contract: drills, shared filters, cross-filters
// on a wireframe SET; flow conformance rules; the flow contract in buildContract
// + the wireframe_spec report; AI-proposed flow validated against real ids; and
// the flow strip render. All deterministic paths are model-free.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

let app;
const def = () => app.Definitions.loadJson('tableau/wireframe-definition.json');

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

// Build a 2-page set with a component on each page; returns {p1, p2, cId}.
function makeSet() {
  const { Wireframe } = app;
  const p1 = Wireframe.create({ customer: 'Acme Industries', definition: def(), name: 'Overview' });
  const c = Wireframe.addComponent(p1.id, 'kpi', def());
  const p2 = Wireframe.addPage(p1.id, 'Detail');
  return { p1: Wireframe.get(p1.id), p2, cId: c.id };
}

describe('WF-11 manual flow authoring', () => {
  it('adds and removes a drill (validated against real page/component ids)', () => {
    const { Wireframe } = app;
    const { p1, p2, cId } = makeSet();
    const r = Wireframe.addDrill(p1.id, { source_page_id: p1.id, source_component_id: cId, target_page_id: p2.id, dimensions: ['Region'] });
    expect(r.ok).toBe(true);
    let it = Wireframe.interactions(Wireframe.get(p1.id));
    expect(it.drills.length).toBe(1);
    expect(it.drills[0].target_page_id).toBe(p2.id);
    expect(it.drills[0].dimensions).toEqual(['Region']);

    // Invalid refs are refused, not stored.
    expect(Wireframe.addDrill(p1.id, { source_page_id: p1.id, source_component_id: 'nope', target_page_id: p2.id }).ok).toBe(false);
    expect(Wireframe.addDrill(p1.id, { source_page_id: p1.id, source_component_id: cId, target_page_id: 'ghost' }).ok).toBe(false);
    expect(Wireframe.addDrill(p1.id, { source_page_id: p1.id, source_component_id: cId, target_page_id: p1.id }).ok).toBe(false); // same page

    Wireframe.removeDrill(p1.id, it.drills[0].id);
    it = Wireframe.interactions(Wireframe.get(p1.id));
    expect(it.drills.length).toBe(0);
  });

  it('adds a shared filter (undoable, deduped)', () => {
    const { Wireframe, App } = app;
    const { p1 } = makeSet();
    expect(Wireframe.addSharedFilter(p1.id, 'Region').ok).toBe(true);
    expect(Wireframe.addSharedFilter(p1.id, 'region').ok).toBe(false); // case-insensitive dupe
    expect(Wireframe.interactions(Wireframe.get(p1.id)).shared_filters.length).toBe(1);
    App.undo();
    expect(Wireframe.interactions(Wireframe.get(p1.id)).shared_filters.length).toBe(0);
  });
});

describe('WF-11 flow conformance rules', () => {
  it('dangling drill target is an error, folded into checkConformance', () => {
    const { Wireframe } = app;
    const { p1, p2, cId } = makeSet();
    Wireframe.addDrill(p1.id, { source_page_id: p1.id, source_component_id: cId, target_page_id: p2.id });
    // No flow error while both pages exist.
    expect(Wireframe.flowConformance(Wireframe.get(p1.id)).errors.length).toBe(0);
    // Remove the target page → the drill dangles.
    Wireframe.remove(p2.id);
    const flow = Wireframe.flowConformance(Wireframe.get(p1.id));
    expect(flow.errors.length).toBe(1);
    // And it surfaces in the structural conformance the build gate reads.
    const conf = Wireframe.checkConformance(Wireframe.get(p1.id), def());
    expect(conf.errors.some(e => /drill/i.test(e))).toBe(true);
  });

  it('shared filter missing on a page is a warning until a matching filter is placed on every page', () => {
    const { Wireframe } = app;
    const { p1, p2 } = makeSet();
    Wireframe.addSharedFilter(p1.id, 'Region');
    expect(Wireframe.flowConformance(Wireframe.get(p1.id)).warnings.length).toBe(1);
    // Place a matching filter component on both pages.
    const f1 = Wireframe.addComponent(p1.id, 'filter', def());
    Wireframe.updateComponent(p1.id, f1.id, { title: 'Region' }, def());
    const f2 = Wireframe.addComponent(p2.id, 'filter', def());
    Wireframe.updateComponent(p2.id, f2.id, { title: 'Region' }, def());
    expect(Wireframe.flowConformance(Wireframe.get(p1.id)).warnings.length).toBe(0);
  });

  it('leaves interaction-free concepts completely unaffected', () => {
    const { Wireframe } = app;
    const w = Wireframe.create({ customer: 'Acme Industries', definition: def(), name: 'Solo' });
    const flow = Wireframe.flowConformance(Wireframe.get(w.id));
    expect(flow.errors).toEqual([]);
    expect(flow.warnings).toEqual([]);
  });
});

describe('WF-11 flow contract in buildContract + spec', () => {
  it('buildContract carries a flow block only when interactions exist', () => {
    const { Wireframe } = app;
    const { p1, p2, cId } = makeSet();
    // Before any authoring, no flow block.
    expect(Wireframe.buildContract(Wireframe.get(p1.id), def()).flow).toBeUndefined();
    Wireframe.addDrill(p1.id, { source_page_id: p1.id, source_component_id: cId, target_page_id: p2.id, dimensions: ['Region'] });
    Wireframe.addSharedFilter(p1.id, 'Region');
    const contract = Wireframe.buildContract(Wireframe.get(p1.id), def());
    expect(contract.flow).toBeTruthy();
    expect(contract.flow.drills.length).toBe(1);
    expect(contract.flow.drills[0].to_page).toBe('Detail');
    expect(contract.flow.shared_filters).toEqual([{ field: 'Region' }]);
    // buildPromptText mentions the flow contract.
    expect(Wireframe.buildPromptText(Wireframe.get(p1.id), def())).toMatch(/FLOW & INTERACTION CONTRACT/);
  });

  it('wireframe_spec report gains a Flow & interaction contract section', () => {
    const { Wireframe, Reports } = app;
    const { p1, p2, cId } = makeSet();
    Wireframe.addDrill(p1.id, { source_page_id: p1.id, source_component_id: cId, target_page_id: p2.id });
    const doc = Reports._build('wireframe_spec', { wireframeId: p1.id });
    expect(doc.sections.some(s => s.id === 'ws-flow')).toBe(true);
  });
});

describe('WF-11 aiDraftSet flow proposal (validated against real ids)', () => {
  it('lands valid model-proposed drills/filters and drops bad references', async () => {
    const { AI, WireframeSkill, Wireframe } = app;
    const pid = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(pid);
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({
      dashboards: [
        { name: 'Overview', components: [{ type: 'title', x: 0, y: 0, w: 12, h: 1, title: 'Overview' }, { type: 'kpi', x: 0, y: 1, w: 3, h: 1, title: 'Revenue' }] },
        { name: 'Detail', components: [{ type: 'title', x: 0, y: 0, w: 12, h: 1, title: 'Detail' }] }
      ],
      interactions: {
        drills: [
          { source_page: 0, source_component: 1, target_page: 1, dimensions: ['Region'] }, // valid
          { source_page: 0, source_component: 0, target_page: 5 }                            // bad target page → dropped
        ],
        shared_filters: [{ field: 'Region' }]
      }
    }) }]);
    WireframeSkill.open({ customer: 'Acme Industries' });
    await WireframeSkill.aiDraftSet('exec suite');
    const all = Wireframe.list('Acme Industries');
    const anchor = Wireframe.set(all[0].set_id)[0];
    const it = Wireframe.interactions(anchor);
    expect(it.drills.length).toBe(1); // only the valid drill landed
    expect(it.shared_filters.map(s => s.field)).toEqual(['Region']);
  });
});

describe('WF-11 flow strip render', () => {
  it('renders pages as nodes with the drill arrow marker', () => {
    const { Wireframe, WireframeSkill } = app;
    const { p1, p2, cId } = makeSet();
    Wireframe.addDrill(p1.id, { source_page_id: p1.id, source_component_id: cId, target_page_id: p2.id });
    const svg = WireframeSkill._flowStripSvg(Wireframe.get(p1.id));
    expect(svg).toMatch(/<svg/);
    expect(svg).toContain('Overview');
    expect(svg).toContain('Detail');
    expect(svg).toContain('wfFlowArrow'); // drill arrow marker present
  });
});
