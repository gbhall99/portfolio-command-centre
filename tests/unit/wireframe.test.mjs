// WS6 — Tableau wireframe builder: vocabulary enforcement, every
// conformance rule, AI-drafted layouts validated against the definition,
// linkage, canvas rendering safety.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

const def = () => app.Definitions.loadJson('tableau/wireframe-definition.json');

function makeWf() {
  return app.Wireframe.create({ customer: 'Acme Industries', definition: def(), name: 'Test concept' });
}

describe('governed component vocabulary', () => {
  it('accepts only vocabulary types, honours min sizes and max_per_dashboard', () => {
    const { Wireframe } = app;
    const wf = makeWf();
    const d = def();
    expect(Wireframe.addComponent(wf.id, 'piechart3d', d)).toMatch(/not in the governed vocabulary/);
    const title = Wireframe.addComponent(wf.id, 'title', d);
    expect(title.w).toBeGreaterThanOrEqual(6); // min_w from the definition
    expect(Wireframe.addComponent(wf.id, 'title', d)).toMatch(/Only 1 "title"/);
    const map = Wireframe.addComponent(wf.id, 'map', d);
    expect(map.w).toBeGreaterThanOrEqual(4);
    expect(map.h).toBeGreaterThanOrEqual(3);
  });

  it('updateComponent clamps to the grid and the type minimums', () => {
    const { Wireframe } = app;
    const wf = makeWf();
    const d = def();
    const bar = Wireframe.addComponent(wf.id, 'bar', d);
    Wireframe.updateComponent(wf.id, bar.id, { w: 1, h: 1 }, d);   // below min 3x2
    expect(bar.w).toBe(3);
    expect(bar.h).toBe(2);
    Wireframe.updateComponent(wf.id, bar.id, { x: 99, y: 99 }, d); // off grid
    expect(bar.x + bar.w).toBeLessThanOrEqual(wf.grid.cols);
    expect(bar.y + bar.h).toBeLessThanOrEqual(wf.grid.rows);
  });
});

describe('conformance checker — each rule', () => {
  it('title_required: missing, duplicate-impossible, and wrong-row cases', () => {
    const { Wireframe } = app;
    const wf = makeWf();
    const d = def();
    let conf = Wireframe.checkConformance(wf, d);
    expect(conf.errors.some(e => /Exactly one dashboard title/.test(e))).toBe(true);
    const title = Wireframe.addComponent(wf.id, 'title', d);
    expect(Wireframe.checkConformance(wf, d).errors.some(e => /title/.test(e))).toBe(false);
    Wireframe.updateComponent(wf.id, title.id, { y: 3 }, d);
    conf = Wireframe.checkConformance(wf, d);
    expect(conf.errors.some(e => /top row/.test(e))).toBe(true);
    expect(conf.violating[title.id]).toBe(true);
  });

  it('no_overlap and min_size are structural errors', () => {
    const { Wireframe } = app;
    const wf = makeWf();
    const d = def();
    Wireframe.addComponent(wf.id, 'title', d);
    const a = Wireframe.addComponent(wf.id, 'bar', d);
    const b = Wireframe.addComponent(wf.id, 'line', d);
    // Force overlap directly (bypassing the free-spot finder).
    a.x = 0; a.y = 2; b.x = 1; b.y = 3;
    let conf = Wireframe.checkConformance(wf, d);
    expect(conf.errors.some(e => /overlap/.test(e))).toBe(true);
    // Force an undersized chart.
    b.x = 8; b.y = 6; b.w = 1; b.h = 1;
    conf = Wireframe.checkConformance(wf, d);
    expect(conf.errors.some(e => /below its minimum size/.test(e))).toBe(true);
  });

  it('filters_edge and kpi_band_top are warnings, not errors', () => {
    const { Wireframe } = app;
    const wf = makeWf();
    const d = def();
    Wireframe.addComponent(wf.id, 'title', d);
    const filter = Wireframe.addComponent(wf.id, 'filter', d);
    const kpi = Wireframe.addComponent(wf.id, 'kpi', d);
    filter.x = 4; filter.y = 4;  // mid-canvas
    kpi.x = 0; kpi.y = 6;        // bottom band
    const conf = Wireframe.checkConformance(wf, d);
    expect(conf.warnings.some(w => /filter sits mid-canvas/.test(w))).toBe(true);
    expect(conf.warnings.some(w => /KPI sits low/.test(w))).toBe(true);
    // Warnings alone don't fail conformance.
    expect(conf.ok).toBe(true);
  });

  it('chart_needs_title warns; titled charts pass (nuance is not flagged)', () => {
    const { Wireframe } = app;
    const wf = makeWf();
    const d = def();
    Wireframe.addComponent(wf.id, 'title', d);
    const bar = Wireframe.addComponent(wf.id, 'bar', d);
    let conf = Wireframe.checkConformance(wf, d);
    expect(conf.warnings.some(w => /bar chart has no title/.test(w))).toBe(true);
    Wireframe.updateComponent(wf.id, bar.id, { title: 'Northern region drives 60% of growth' }, d);
    conf = Wireframe.checkConformance(wf, d);
    expect(conf.warnings.some(w => /bar chart has no title/.test(w))).toBe(false);
  });

  it('max_components threshold warns on overload', () => {
    const { Wireframe } = app;
    const wf = makeWf();
    const d = def();
    Wireframe.addComponent(wf.id, 'title', d);
    for (let i = 0; i < 13; i++) {
      const c = Wireframe.addComponent(wf.id, 'kpi', d);
      if (typeof c !== 'string') { c.y = 0; c.x = 0; } // stack them; overlap is a separate rule
    }
    const conf = Wireframe.checkConformance(wf, d);
    expect(conf.warnings.some(w => /cognitive overload/.test(w))).toBe(true);
  });
});

describe('AI-drafted layout (mock adapter)', () => {
  it('places a conforming layout and drops out-of-vocabulary components', async () => {
    const { AI, WireframeSkill, Wireframe, document } = app;
    const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(id);
    AI.ADAPTERS.mock.program([
      // First response violates the schema enum (piechart3d) -> repair loop kicks in.
      { text: JSON.stringify({ name: 'Exec Sales', components: [{ type: 'piechart3d', x: 0, y: 0, w: 4, h: 2 }] }) },
      {
        text: JSON.stringify({
          name: 'Exec Sales Dashboard',
          components: [
            { type: 'title', x: 0, y: 0, w: 9, h: 1, title: 'Are we hitting Q3 targets?' },
            { type: 'filter', x: 10, y: 0, w: 2, h: 1, title: 'Region' },
            { type: 'kpi', x: 0, y: 1, w: 3, h: 1, title: 'Revenue vs target' },
            { type: 'bar', x: 0, y: 2, w: 6, h: 3, title: 'Top products' },
            { type: 'line', x: 6, y: 2, w: 6, h: 3, title: 'Monthly trend' }
          ]
        })
      }
    ]);
    WireframeSkill.open({});
    document.getElementById('wfAiPrompt').value = 'exec sales dashboard';
    await WireframeSkill.aiDraft();
    const wfs = Wireframe.list('Acme Industries');
    expect(wfs.length).toBe(1);
    const wf = wfs[0];
    expect(wf.name).toBe('Exec Sales Dashboard');
    expect(wf.components.length).toBe(5);
    expect(wf.components.map(c => c.type).sort()).toEqual(['bar', 'filter', 'kpi', 'line', 'title']);
    const conf = Wireframe.checkConformance(wf, def());
    expect(conf.ok).toBe(true);
    expect(conf.warnings).toEqual([]);
  });
});

describe('linkage + audit', () => {
  it('attaches to a project; create/mutate operations audit and undo', () => {
    const { Wireframe, App } = app;
    const wf = makeWf();
    expect(App.data.audit_log.some(e => e.field === 'wireframe_created')).toBe(true);
    Wireframe.attachProject(wf.id, 'A-1');
    expect(Wireframe.get(wf.id).project_id).toBe('A-1');
    const audited = App.data.audit_log.filter(e => e.field === 'wireframe_project_link');
    expect(audited.length).toBe(1);
    expect(audited[0].projectId).toBe('A-1');
    App.undo();
    expect(Wireframe.get(wf.id).project_id).toBe(null);
  });
});

describe('canvas rendering safety', () => {
  it('component titles from the model are escaped in the SVG', () => {
    const { Wireframe, WireframeSkill, document } = app;
    const wf = makeWf();
    const d = def();
    const bar = Wireframe.addComponent(wf.id, 'bar', d);
    Wireframe.updateComponent(wf.id, bar.id, { title: '"><script>alert(1)</script>' }, d);
    WireframeSkill.open({});
    WireframeSkill.edit(wf.id);
    const modal = document.getElementById('wfModal');
    expect(modal.querySelectorAll('script').length).toBe(0);
    expect(document.getElementById('wfCanvas')).not.toBeNull();
  });
});
