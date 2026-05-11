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
      id: 'M1', name: 'Revenue', group_id: 'performance',
      raci: { accountable: ['PRSN-1'], responsible: [], consulted: [], informed: [] },
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
    // Column headers — extended with Definition, RACI and Dimensions.
    ['Name', 'Group', 'Definition', 'Owner (Accountable)', 'RACI', 'Dimensions', 'Personas', 'People', 'Targets', 'Status', 'Updated']
      .forEach(label => expect(out).toContain(label));
    // Both metrics rendered as rows.
    expect(out).toContain('Revenue');
    expect(out).toContain('Customer NPS');
    // Owner accountable Person resolved.
    expect(out).toContain('Sarah Chen');

    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-metrics-library-table.html');
    app.teardown();
  });
});
