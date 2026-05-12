import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makeMetricGroup, makePersona, makePerson, resetIdSeq } from '../harness/fixtures.mjs';

describe('MetricGroups module', () => {
  it('list() returns groups for the active customer', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const groups = app.MetricGroups.list();
    expect(groups.map(g => g.id).sort()).toEqual(['customer', 'operations', 'performance']);
  });

  it('add() rejects duplicate id within the same customer', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const r = app.MetricGroups.add({ id: 'customer', name: 'Dup', swatch: '#000' });
    expect(r).toBe(null);
  });

  it('remove() refuses to remove a group with metrics still in it', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [makeMetric({ group_id: 'operations', name: 'Cost per ticket' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const ok = app.MetricGroups.remove('operations');
    expect(ok).toBe(false);
    expect(app.MetricGroups.byId('operations')).not.toBe(null);
  });

  it('remove() succeeds when no metrics reference the group', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.MetricGroups.add({ id: 'extra', name: 'Extra', swatch: '#888' });
    const ok = app.MetricGroups.remove('extra');
    expect(ok).toBe(true);
  });
});

describe('Metrics module', () => {
  it('list() returns metrics for active customer', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [
        { name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 },
        { name: 'Globex', color: '#10b981', staleThreshold: 14 },
      ],
      metrics: [
        makeMetric({ name: 'Revenue', customer: 'Acme Industries' }),
        makeMetric({ name: 'Other', customer: 'Globex' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Metrics.list().map(m => m.name)).toEqual(['Revenue']);
  });

  it('add() seeds defaults for status, dimensions, raci, group_id', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const m = app.Metrics.add({ name: 'New metric' });
    expect(m.status).toBe('draft');
    expect(m.group_id).toBe('performance'); // first available default group
    expect(Array.isArray(m.dimensions)).toBe(true);
    expect(m.raci).toEqual({ accountable: [], responsible: [], consulted: [], informed: [] });
  });

  it('add() rejects metric whose group_id is unknown for the customer', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const m = app.Metrics.add({ name: 'Bad', group_id: 'nonexistent' });
    expect(m).toBe(null);
  });

  it('remove() removes any holdings of the deleted metric from all personas', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [makeMetric({ id: 'M1', name: 'Doomed' })],
      personas: [{
        id: 'P1', customer: 'Acme Industries', name: 'Holder',
        metric_holdings: [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }],
        parent_persona_id: null, business_questions: [],
      }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Metrics.remove('M1');
    expect(app.Personas.byId('P1').metric_holdings).toHaveLength(0);
  });
});

// 2026-05: the Library / RACI matrix view toggle was removed in favour of a
// single flat table with R/A/C/I as separate columns and inline cascade
// expansion. The state key + helpers still exist for legacy callers but no
// longer change the rendering output.
describe('Metrics inventory — single flat-table layout', () => {
  it('renderInventoryTab renders the flat library table regardless of view state', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [makeMetric({ id: 'M1', name: 'Revenue' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderInventoryTab();
    expect(out).toContain('metric-library-table');
    // RACI matrix view + toggle no longer surface in the inventory tab.
    expect(out).not.toContain('raci-matrix');
    expect(out).not.toContain('RACI matrix');
    expect(out).not.toContain('>Library<');
    app.App.uiStateSet('strategy.metric.view', 'raci');
    const out2 = app.Metrics.renderInventoryTab();
    expect(out2).toContain('metric-library-table');
    expect(out2).not.toContain('raci-matrix');
    app.teardown();
  });

  it('exposes Expand all / Collapse all controls', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [makeMetric({ id: 'M1', name: 'Revenue' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderInventoryTab();
    expect(out).toContain('Expand all');
    expect(out).toContain('Collapse all');
    app.teardown();
  });

  it('expanding a metric reveals an inline cascade row per holder', async () => {
    const persona = makePersona({ id: 'P1', name: 'CFO',
      metric_holdings: [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [{ period: '2026', value: 100, period_type: 'annual' }] }],
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona],
      // raci_defaults makes the persona Accountable so its pill renders in
      // the cascade row's Accountable column (which is now the only place the
      // persona name appears at cascade level — inherited cells are blank).
      metrics: [makeMetric({ id: 'M1', name: 'Revenue',
        raci_defaults: { accountable: ['P1'], responsible: [], consulted: [], informed: [] } })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    // Collapsed: no cascade row.
    expect(app.Metrics.renderInventoryTab()).not.toContain('metric-cascade-row');
    // Expanded: one cascade row exists and the persona pill renders in the
    // Accountable column.
    app.Metrics._toggleExpand('M1');
    const expanded = app.Metrics.renderInventoryTab();
    expect(expanded).toContain('metric-cascade-row');
    // Persona pill carries the name + sits in an Accountable stack.
    expect(expanded).toMatch(/raci-stack-A[\s\S]*?CFO/);
    // Inherited cells (Name/Group/Definition/Status/Updated) are blank — the
    // persona name lives only in the RACI pill.
    expect(expanded).toContain('metric-cascade-blank');
    app.teardown();
  });
});

// Cascade is single-level (persona holders). The previous L2 person drill-in
// has been removed — the Name cell on cascade rows is now blank, with the
// persona pill in the matching RACI column serving as both identity and
// click-through to the persona detail modal.
describe('Metrics cascade — persona pill is the click target', () => {
  it('the persona pill onclick routes to Personas._openDetail', async () => {
    const persona = makePersona({ id: 'P-CFO', name: 'CFO',
      metric_holdings: [{ id: 'H1', metric_id: 'M-REV', filter: {}, targets: [] }],
    });
    const m = makeMetric({
      id: 'M-REV', name: 'Revenue',
      raci_defaults: { accountable: ['P-CFO'], responsible: [], consulted: [], informed: [] },
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Metrics._toggleExpand('M-REV');
    const html = app.Metrics.renderInventoryTab();
    // The cascade Name cell is blank — no twisty/tag/View button artefacts.
    expect(html).not.toMatch(/cascade-kind-persona/);
    expect(html).not.toMatch(/metric-cascade-view-btn/);
    expect(html).not.toMatch(/metric-twisty-inner/);
    // The persona pill in the Accountable column carries the click handler
    // that opens the persona detail modal.
    expect(html).toMatch(/raci-stack-A[\s\S]*?Personas\._openDetail\('P-CFO'\)/);
    app.teardown();
  });
});
