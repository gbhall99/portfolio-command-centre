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
      metrics: [makeMetric({ id: 'M1', name: 'Revenue' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    // Collapsed: no cascade row.
    expect(app.Metrics.renderInventoryTab()).not.toContain('metric-cascade-row');
    // Expanded: one cascade row mentioning the persona.
    app.Metrics._toggleExpand('M1');
    const expanded = app.Metrics.renderInventoryTab();
    expect(expanded).toContain('metric-cascade-row');
    expect(expanded).toContain('CFO');
    app.teardown();
  });
});

// Two-level cascade: persona row carries its own twisty when active people
// fill it. The composite expansion key (metricId|personaId) controls level 2.
describe('Metrics cascade — level-2 people drill-in', () => {
  it('expanding the metric and then the persona reveals person rows beneath', async () => {
    const persona = makePersona({ id: 'P-CFO', name: 'CFO',
      metric_holdings: [{ id: 'H1', metric_id: 'M-REV', filter: {}, targets: [] }],
    });
    const sarah = makePerson({ id: 'PRSN-1', name: 'Sarah Chen', role_title: 'CFO', persona_id: 'P-CFO' });
    const inactive = makePerson({ id: 'PRSN-2', name: 'Old Hand', persona_id: 'P-CFO', active: false });
    const m = makeMetric({
      id: 'M-REV', name: 'Revenue',
      raci_defaults: { accountable: ['P-CFO'], responsible: [], consulted: [], informed: [] },
      raci: { accountable: ['PRSN-1'], responsible: [], consulted: [], informed: [] },
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], people: [sarah, inactive], metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';

    // L1 only: persona twisty visible, no person rows yet.
    app.Metrics._toggleExpand('M-REV');
    let html = app.Metrics.renderInventoryTab();
    expect(html).toMatch(/data-kind="persona"/);
    expect(html).not.toMatch(/data-kind="person"/);
    // Persona row carries the people-count chip.
    expect(html).toMatch(/1 person/);

    // L2: expand persona inside the metric. Sarah surfaces, Old Hand stays hidden.
    app.Metrics._toggleExpand('M-REV|P-CFO');
    html = app.Metrics.renderInventoryTab();
    expect(html).toMatch(/data-kind="person"/);
    expect(html).toContain('Sarah Chen');
    expect(html).not.toContain('Old Hand');
    // Sarah's Accountable RACI pill renders from the person-keyed metric.raci.
    expect(html).toMatch(/raci-pill raci-pill-A[^>]*>Sarah Chen/);
    app.teardown();
  });
});
