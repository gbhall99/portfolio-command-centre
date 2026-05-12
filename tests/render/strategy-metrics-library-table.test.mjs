import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePersona, makePerson, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — Metrics library tabular view', () => {
  it('renders a table with sortable column headers and one row per metric', async () => {
    resetIdSeq();
    const persona = makePersona({
      id: 'P1', name: 'CFO Persona',
      metric_holdings: [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [{ period: '2026', value: 100 }] }],
    });
    const sarah = makePerson({ id: 'PRSN-1', name: 'Sarah Chen', persona_id: 'P1' });
    const m1 = makeMetric({
      id: 'M1', name: 'Revenue', group_id: 'performance', unit: '£',
      raci: { accountable: ['PRSN-1'], responsible: [], consulted: [], informed: [] },
      raci_defaults: { accountable: ['P1'], responsible: [], consulted: [], informed: [] },
    });
    const m2 = makeMetric({
      id: 'M2', name: 'Customer NPS', group_id: 'customer', status: 'draft',
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], people: [sarah], metrics: [m1, m2],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderInventoryTab();

    // Tabular structure markers.
    expect(out).toContain('metric-library-table');
    // 2026-05 columns include Department (between Group and Definition).
    ['Name', 'Group', 'Department', 'Definition', 'Responsible', 'Accountable', 'Consulted', 'Informed', 'Dimensions', 'Targets', 'Status', 'Updated']
      .forEach(label => expect(out).toContain(label));
    // Department filter renders in the toolbar with ELT selected by default.
    expect(out).toMatch(/Metrics\._setDepartment/);
    // Each metric row carries a department chip; ELT (default) uses the
    // violet variant.
    expect(out).toContain('metric-dept-chip');
    // Both metrics rendered as rows.
    expect(out).toContain('Revenue');
    expect(out).toContain('Customer NPS');
    // Persona/Person toggle in the toolbar — defaults to Persona.
    expect(out).toContain('metric-raci-view-toggle');
    expect(out).toMatch(/metric-raci-view-btn is-active[^>]*>Persona</);
    // In the default Persona view, the persona pill resolves in the A column.
    expect(out).toMatch(/raci-stack-A[\s\S]*?CFO Persona/);
    // Canonical target chip surfaces — £100 (period 2026).
    expect(out).toMatch(/metric-target-chip[\s\S]*?2026[\s\S]*?£100/);

    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-metrics-library-table.html');
    app.teardown();
  });
});
