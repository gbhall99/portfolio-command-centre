import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — Metrics RACI matrix view', () => {
  it('renders a matrix with R/A/C/I letters in the right (persona, metric) cells', async () => {
    resetIdSeq();
    const sarah = makePersona({ id: 'P1', name: 'Sarah Chen',  role_title: 'CFO' });
    const tom   = makePersona({ id: 'P2', name: 'Tom Lee',     role_title: 'COO' });
    const ravi  = makePersona({ id: 'P3', name: 'Ravi Singh',  role_title: 'CIO' });
    const m1 = makeMetric({
      id: 'M1', name: 'Revenue', group_id: 'performance',
      raci: { accountable: ['P1'], responsible: [], consulted: ['P2'], informed: [] },
    });
    const m2 = makeMetric({
      id: 'M2', name: 'Customer NPS', group_id: 'customer',
      raci: { accountable: [], responsible: [], consulted: [], informed: ['P3'] },
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah, tom, ravi], metrics: [m1, m2],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderRaciMatrix();

    // Matrix container exists.
    expect(out).toContain('raci-matrix');
    // Personas (rows) are present.
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('Tom Lee');
    expect(out).toContain('Ravi Singh');
    // Metric column headers are present.
    expect(out).toContain('Revenue');
    expect(out).toContain('Customer NPS');
    // The right RACI letter classes appear in the right places. Each cell carries
    // data attributes naming the persona + metric so tests can verify cell-level
    // assignment without depending on exact column ordering.
    // Sarah / Revenue → A
    expect(out).toMatch(/data-persona-id="P1"[^>]*data-metric-id="M1"[^>]*>[\s\S]*?raci-letter raci-A/);
    // Tom / Revenue → C
    expect(out).toMatch(/data-persona-id="P2"[^>]*data-metric-id="M1"[^>]*>[\s\S]*?raci-letter raci-C/);
    // Ravi / NPS → I
    expect(out).toMatch(/data-persona-id="P3"[^>]*data-metric-id="M2"[^>]*>[\s\S]*?raci-letter raci-I/);

    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-metrics-raci.html');
    app.teardown();
  });

  it('renders an empty-state when the customer has no personas or no metrics', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderRaciMatrix();
    expect(out.toLowerCase()).toMatch(/no personas|no metrics/);
    app.teardown();
  });

  it('a persona in two roles on the same metric shows both letters', async () => {
    resetIdSeq();
    const sarah = makePersona({ id: 'P1', name: 'Sarah Chen',  role_title: 'CFO' });
    const m = makeMetric({
      id: 'M1', name: 'Revenue', group_id: 'performance',
      raci: { accountable: ['P1'], responsible: ['P1'], consulted: [], informed: [] },
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah], metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderRaciMatrix();
    // Both 'A' and 'R' inside the same cell.
    const cellMatch = out.match(/data-persona-id="P1"[^>]*data-metric-id="M1"[^>]*>[\s\S]*?<\/td>/);
    expect(cellMatch).not.toBeNull();
    const cell = cellMatch[0];
    expect(cell).toMatch(/raci-letter raci-A/);
    expect(cell).toMatch(/raci-letter raci-R/);
    app.teardown();
  });
});
