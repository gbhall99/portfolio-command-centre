// WF-12 — agent-consumable build contract. A deterministic serialisation of
// everything the spec knows (grid, components + props, field map, acceptance
// checklist, quote linkage) plus a plain-text build prompt. Pure — no AI, no
// Date.now, no randomness — so it round-trips identically for identical data.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

let app;
function def() { return app.Definitions.loadJson('tableau/wireframe-definition.json'); }

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    metrics: [makeMetric({ id: 'MET-1', name: 'Revenue', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
  const wf = app.Wireframe.create({ customer: 'Acme Industries', definition: def(), name: 'Exec board' });
  app.Wireframe.addComponent(wf.id, 'title', def());
  const kpi = app.Wireframe.addComponent(wf.id, 'kpi', def());
  app.Wireframe.setComponentMetric(wf.id, kpi.id, 'MET-1');
  const bar = app.Wireframe.addComponent(wf.id, 'bar', def());
  app.Wireframe.setComponentProps(wf.id, bar.id, { measure: 'Sales', dimension: 'Region', orientation: 'horizontal' }, def());
  app.Wireframe.updateComponent(wf.id, bar.id, { title: 'Top products' }, def());
  app._wfId = wf.id;
});
afterEach(() => app.teardown());

function wf() { return app.Wireframe.get(app._wfId); }

describe('Wireframe.buildContract', () => {
  it('contains grid, components with props, fieldMap and acceptanceChecklist', () => {
    const c = app.Wireframe.buildContract(wf(), def());
    expect(c.contract_version).toBe(1);
    expect(c.kind).toBe('tableau-wireframe-build-contract');
    expect(c.grid).toEqual({ cols: 12, rows: 8 });
    expect(c.pages.length).toBe(1);
    const page = c.pages[0];
    // components carry declared props (measure/dimension/orientation on the bar)
    const bar = page.components.find(x => x.type === 'bar');
    expect(bar.props).toEqual({ measure: 'Sales', dimension: 'Region', orientation: 'horizontal' });
    // field/calc map is present and resolves the bound KPI metric name
    const kpiRow = page.field_map.find(r => r.component === 'kpi');
    expect(kpiRow.field).toBe('[Revenue]');
    const barRow = page.field_map.find(r => r.component === 'bar');
    expect(barRow.field).toBe('[Sales]');
    // acceptance checklist is present
    expect(Array.isArray(page.acceptance_checklist)).toBe(true);
    expect(page.acceptance_checklist.length).toBeGreaterThan(0);
  });

  it('round-trips deterministically for identical data (no timestamps/randomness)', () => {
    const a = JSON.stringify(app.Wireframe.buildContract(wf(), def()));
    const b = JSON.stringify(app.Wireframe.buildContract(wf(), def()));
    expect(a).toBe(b);
  });

  it('is a pure function needing no AI call', () => {
    // buildContract/buildPromptText never touch AI — purely serialisation.
    const c = app.Wireframe.buildContract(wf(), def());
    expect(c).toBeTruthy();
    expect(c.pages[0].components.length).toBe(3);
  });

  it('embeds every page of a set in order', () => {
    const first = wf();
    const page2 = app.Wireframe.addPage(first.id, 'Regional detail');
    app.Wireframe.addComponent(page2.id, 'title', def());
    const c = app.Wireframe.buildContract(app.Wireframe.get(first.id), def());
    expect(c.is_set).toBe(true);
    expect(c.pages.length).toBe(2);
    expect(c.pages[1].name).toBe('Regional detail');
  });

  it('includes a quote block only when Billing can price the linked project (figures from Billing)', () => {
    // no linked project → no quote block
    expect(app.Wireframe.buildContract(wf(), def()).quote).toBeUndefined();
  });
});

describe('Wireframe.buildPromptText', () => {
  it('renders the contract as a build prompt for a coding/BI agent', () => {
    const text = app.Wireframe.buildPromptText(wf(), def());
    expect(text).toContain('You are a BI developer');
    expect(text).toContain('GRID: 12 columns x 8 rows');
    expect(text).toContain('Components:');
    expect(text).toContain('Field & calc map:');
    expect(text).toContain('Acceptance checklist:');
    expect(text).toContain('[Revenue]');
    // deterministic
    expect(app.Wireframe.buildPromptText(wf(), def())).toBe(text);
  });
});

describe('WireframeSkill export wiring', () => {
  it('exportBuildContract downloads a JSON blob (no AI)', () => {
    const { WireframeSkill, document, window } = app;
    let downloaded = false;
    const realCreate = document.createElement.bind(document);
    const realURL = window.URL.createObjectURL;
    const realRevoke = window.URL.revokeObjectURL;
    window.URL.createObjectURL = () => 'blob:mock';
    window.URL.revokeObjectURL = () => {};
    document.createElement = (tag) => {
      const el = realCreate(tag);
      if (tag === 'a') el.click = () => { downloaded = true; };
      return el;
    };
    try {
      WireframeSkill.open({}); WireframeSkill.edit(app._wfId);
      WireframeSkill.exportBuildContract();
      expect(downloaded).toBe(true);
    } finally {
      document.createElement = realCreate;
      window.URL.createObjectURL = realURL;
      window.URL.revokeObjectURL = realRevoke;
    }
  });
});
