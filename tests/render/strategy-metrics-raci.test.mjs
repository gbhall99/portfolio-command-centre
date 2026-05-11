import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makePerson, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — RACI matrix axis (rows = metrics, cols = people)', () => {
  it('renders metric rows and people columns with R/A/C/I letters in the right cells', async () => {
    resetIdSeq();
    const cfo = makePersona({ id: 'P-CFO', name: 'CFO Persona' });
    const coo = makePersona({ id: 'P-COO', name: 'COO Persona' });
    const sarah = makePerson({ id: 'PRSN-1', name: 'Sarah Chen',  role_title: 'CFO', persona_id: 'P-CFO' });
    const tom   = makePerson({ id: 'PRSN-2', name: 'Tom Lee',     role_title: 'COO', persona_id: 'P-COO' });
    const ravi  = makePerson({ id: 'PRSN-3', name: 'Ravi Singh',  role_title: 'CIO' });
    const m1 = makeMetric({
      id: 'M1', name: 'Revenue', group_id: 'performance',
      raci: { accountable: ['PRSN-1'], responsible: [], consulted: ['PRSN-2'], informed: [] },
    });
    const m2 = makeMetric({
      id: 'M2', name: 'Customer NPS', group_id: 'customer',
      raci: { accountable: [], responsible: [], consulted: [], informed: ['PRSN-3'] },
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [cfo, coo], people: [sarah, tom, ravi], metrics: [m1, m2],
    }));
    app.App.activeCustomer = 'Acme Industries';
    // Default tier 'leaders' — none have managers, so all are tier 0 (Heads).
    const out = app.Metrics.renderRaciMatrix();

    // Matrix container exists.
    expect(out).toContain('raci-matrix');
    // People column headers are present (they are the X axis now).
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('Tom Lee');
    expect(out).toContain('Ravi Singh');
    // Metric row headers are present (Y axis).
    expect(out).toContain('Revenue');
    expect(out).toContain('Customer NPS');
    // Cell-level RACI assignment via data attributes.
    expect(out).toMatch(/data-person-id="PRSN-1"[^>]*data-metric-id="M1"[^>]*>[\s\S]*?raci-letter raci-A/);
    expect(out).toMatch(/data-person-id="PRSN-2"[^>]*data-metric-id="M1"[^>]*>[\s\S]*?raci-letter raci-C/);
    expect(out).toMatch(/data-person-id="PRSN-3"[^>]*data-metric-id="M2"[^>]*>[\s\S]*?raci-letter raci-I/);

    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-metrics-raci.html');
    app.teardown();
  });

  it('renders an empty-state when the customer has no people or no metrics', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderRaciMatrix();
    expect(out.toLowerCase()).toMatch(/no people|no metrics/);
    app.teardown();
  });

  it('a person in two roles on the same metric shows both letters', async () => {
    resetIdSeq();
    const persona = makePersona({ id: 'P-CFO', name: 'CFO Persona' });
    const sarah = makePerson({ id: 'PRSN-1', name: 'Sarah Chen', role_title: 'CFO', persona_id: 'P-CFO' });
    const m = makeMetric({
      id: 'M1', name: 'Revenue', group_id: 'performance',
      raci: { accountable: ['PRSN-1'], responsible: ['PRSN-1'], consulted: [], informed: [] },
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], people: [sarah], metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderRaciMatrix();
    const cellMatch = out.match(/data-person-id="PRSN-1"[^>]*data-metric-id="M1"[^>]*>[\s\S]*?<\/td>/);
    expect(cellMatch).not.toBeNull();
    const cell = cellMatch[0];
    expect(cell).toMatch(/raci-letter raci-A/);
    expect(cell).toMatch(/raci-letter raci-R/);
    app.teardown();
  });
});
