// WF-13 — IBCS / ISO 24896 notation template set. A second governed
// definitions/tableau set encoding IBCS SUCCESS semantics (scenario notation,
// EXPRESS chart-type-per-message, CONDENSE density, STRUCTURE ordering) as
// machine-checkable conformance rules. Customers opt in via the existing
// per-customer template picker; a customer NOT on IBCS is unaffected.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }],
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

const ibcsDef = () => app.Definitions.loadJson('tableau-ibcs/wireframe-definition.json');
const defaultDef = () => app.Definitions.loadJson('tableau/wireframe-definition.json');

// A fully IBCS-conformant concept on the 12x8 grid: message title, two scenario-
// marked KPIs above the charts, a comparison bar and a time-series line, dense.
function conformantWf(overrides) {
  const wf = {
    id: 'WF-IBCS', customer: 'Acme Industries', name: 'Board', grid: { cols: 12, rows: 8 },
    status: 'Concept', template_id: 'ibcs', template_kind: 'tableau',
    components: [
      { id: 'title', type: 'title', title: 'Margin below plan in EMEA', x: 0, y: 0, w: 12, h: 1, props: { text: 'Margin below plan in EMEA' } },
      { id: 'k1', type: 'kpi', title: 'Revenue', x: 0, y: 1, w: 3, h: 1, props: { scenario: 'actual' } },
      { id: 'k2', type: 'kpi', title: 'Plan', x: 3, y: 1, w: 3, h: 1, props: { scenario: 'plan' } },
      { id: 'bar', type: 'bar', title: 'Revenue vs plan by region', x: 0, y: 2, w: 6, h: 4, props: { scenario: 'actual', message: 'comparison' } },
      { id: 'line', type: 'line', title: 'Revenue development', x: 6, y: 2, w: 6, h: 4, props: { scenario: 'actual', message: 'time_series' } }
    ],
    metric_ids: [], tableau_refs: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  };
  if (overrides) overrides(wf);
  return wf;
}

const comp = (wf, id) => wf.components.find(c => c.id === id);

describe('IBCS template set loads and is selectable per customer', () => {
  it('the loader parses the authored IBCS definition + guidelines', () => {
    const def = ibcsDef();
    expect(def).not.toBeNull();
    expect(def.id).toBe('ibcs');
    expect(def.kind).toBe('tableau');
    const ids = def.rules.map(r => r.id);
    expect(ids).toEqual(expect.arrayContaining(['ibcs_scenario_notation', 'ibcs_express_charttype', 'ibcs_condense_density', 'ibcs_structure_order']));
    const guidelines = app.Definitions.loadText('tableau-ibcs/ibcs-design-guidelines.md');
    expect(guidelines).toMatch(/IBCS/);
    expect(guidelines).toMatch(/SUCCESS/);
  });

  it('the manifest lists two tableau sets and every file reference resolves', () => {
    const sets = app.Definitions.templateSets('tableau');
    expect(sets.map(s => s.id)).toEqual(['default', 'ibcs']);
    sets.forEach(s => Object.values(s.files).forEach(rel => {
      expect(app.Definitions.loadText(rel), 'missing ' + rel).not.toBeNull();
    }));
  });

  it('the per-customer template picker selects IBCS and resolve() returns it', () => {
    const { Definitions, App } = app;
    // Default before any selection.
    expect(Definitions.selectedSetId('tableau', 'Acme Industries')).toBe('default');
    Definitions.setSelectedSetId('tableau', 'Acme Industries', 'ibcs');
    expect(App.data.settings.skill_templates['Acme Industries'].tableau).toBe('ibcs');
    expect(Definitions.selectedSetId('tableau', 'Acme Industries')).toBe('ibcs');
    const r = Definitions.resolve('tableau', 'Acme Industries');
    expect(r.id).toBe('ibcs');
    expect(r.files.definition.rules.map(x => x.id)).toContain('ibcs_scenario_notation');
    expect(String(r.files.guidelines)).toMatch(/CONDENSE/);
    // A different customer still gets the default set (opt-in is per customer).
    expect(Definitions.selectedSetId('tableau', 'Globex')).toBe('default');
  });

  it('the scenario/message props are governed and editable only under the IBCS set', () => {
    const { Wireframe } = app;
    // The IBCS definition names scenario/message on the bar; the default does not.
    expect(Wireframe.editableProps(ibcsDef(), 'bar')).toEqual(expect.arrayContaining(['scenario', 'message']));
    expect(Wireframe.editableProps(defaultDef(), 'bar')).not.toContain('scenario');
    // cleanProps validates the enum values against PROP_SPECS.
    expect(Wireframe.cleanProps(ibcsDef(), 'bar', { scenario: 'forecast' })).toEqual({ scenario: 'forecast' });
    expect(Wireframe.cleanProps(ibcsDef(), 'bar', { scenario: 'bogus' })).toEqual({});
    expect(Wireframe.cleanProps(ibcsDef(), 'bar', { message: 'deviation' })).toEqual({ message: 'deviation' });
  });
});

describe('IBCS conformance rules — fire on violation, pass when conformant', () => {
  it('a fully conformant IBCS concept raises none of the IBCS findings', () => {
    const conf = app.Wireframe.checkConformance(conformantWf(), ibcsDef());
    const joined = conf.warnings.concat(conf.errors).join(' | ');
    expect(joined).not.toMatch(/UNIFY|EXPRESS|CONDENSE|STRUCTURE/);
    expect(conf.errors).toEqual([]);
  });

  it('ibcs_scenario_notation: flags a data-bearing component with no scenario marking', () => {
    const wf = conformantWf(w => { delete comp(w, 'k1').props.scenario; });
    const conf = app.Wireframe.checkConformance(wf, ibcsDef());
    expect(conf.warnings.join(' ')).toMatch(/UNIFY/);
    expect(conf.violating['k1']).toBe(true);
    // ...and passes once the scenario is marked.
    expect(app.Wireframe.checkConformance(conformantWf(), ibcsDef()).warnings.join(' ')).not.toMatch(/UNIFY/);
  });

  it('ibcs_express_charttype: flags a chart whose type does not fit its message', () => {
    // A "correlation" message must be a scatter — a bar violates EXPRESS.
    const wf = conformantWf(w => { comp(w, 'bar').props.message = 'correlation'; });
    const conf = app.Wireframe.checkConformance(wf, ibcsDef());
    expect(conf.warnings.join(' ')).toMatch(/EXPRESS/);
    expect(conf.violating['bar']).toBe(true);
    // The conformant comparison-bar does not fire.
    expect(app.Wireframe.checkConformance(conformantWf(), ibcsDef()).warnings.join(' ')).not.toMatch(/EXPRESS/);
  });

  it('ibcs_condense_density: flags a sparse canvas below the governed fill threshold', () => {
    const sparse = {
      id: 'WF-S', customer: 'Acme Industries', name: 'Sparse', grid: { cols: 12, rows: 8 },
      status: 'Concept', template_id: 'ibcs', template_kind: 'tableau',
      components: [
        { id: 't', type: 'title', title: 'T', x: 0, y: 0, w: 12, h: 1, props: { text: 'T', scenario: 'actual' } },
        { id: 'k', type: 'kpi', title: 'K', x: 0, y: 1, w: 2, h: 1, props: { scenario: 'actual' } }
      ],
      metric_ids: [], tableau_refs: [], created_at: '', updated_at: ''
    };
    const conf = app.Wireframe.checkConformance(sparse, ibcsDef());
    expect(conf.warnings.join(' ')).toMatch(/CONDENSE/);
    // The dense conformant concept passes.
    expect(app.Wireframe.checkConformance(conformantWf(), ibcsDef()).warnings.join(' ')).not.toMatch(/CONDENSE/);
  });

  it('ibcs_structure_order: flags a KPI sitting level with or below a chart', () => {
    const wf = conformantWf(w => { comp(w, 'k2').y = 6; });   // KPI pushed below the charts (which start at y=2)
    const conf = app.Wireframe.checkConformance(wf, ibcsDef());
    expect(conf.warnings.join(' ')).toMatch(/STRUCTURE/);
    expect(conf.violating['k2']).toBe(true);
    // Summary-above-detail conformant layout passes.
    expect(app.Wireframe.checkConformance(conformantWf(), ibcsDef()).warnings.join(' ')).not.toMatch(/STRUCTURE/);
  });

  it('IBCS thresholds are read from the definition (governed data), not hardcoded', () => {
    // Loosen the density floor in a cloned def → the sparse-ish concept passes.
    const def = ibcsDef();
    const dense = def.rules.find(r => r.id === 'ibcs_condense_density');
    dense.min_fill_pct = 5;
    const wf = conformantWf(w => { w.components = w.components.slice(0, 3); }); // fewer components
    const conf = app.Wireframe.checkConformance(wf, def);
    expect(conf.warnings.join(' ')).not.toMatch(/CONDENSE/);
  });
});

describe('regression — a customer NOT on IBCS is unaffected', () => {
  it('the default set never emits IBCS findings even for an IBCS-shaped layout', () => {
    // Same conformant layout, checked against the DEFAULT definition (no ibcs rules).
    const conf = app.Wireframe.checkConformance(conformantWf(), defaultDef());
    expect(conf.warnings.concat(conf.errors).join(' ')).not.toMatch(/UNIFY|EXPRESS|CONDENSE|STRUCTURE/);
  });

  it('the default set still enforces its own structural rules identically', () => {
    // A missing title is still an error under the default set (unchanged behaviour).
    const wf = conformantWf(w => { w.components = w.components.filter(c => c.type !== 'title'); });
    const conf = app.Wireframe.checkConformance(wf, defaultDef());
    expect(conf.ok).toBe(false);
    expect(conf.errors.join(' ')).toMatch(/title/i);
  });
});
