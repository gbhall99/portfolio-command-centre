import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePerson, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — RACI matrix drill-in', () => {
  it('drillMetric collapses to one metric row with all People who have RACI on it', async () => {
    resetIdSeq();
    const head1 = makePerson({ id: 'PRSN-H1', name: 'Head1', department: 'Finance' });
    const head2 = makePerson({ id: 'PRSN-H2', name: 'Head2', department: 'Operations' });
    const ic    = makePerson({ id: 'PRSN-I',  name: 'Deep IC', manager_id: 'PRSN-H1' });
    // ic is normally hidden (depth=1 only with leader filter, but this is depth 1).
    // Make ic the only one with RACI on M1 to test the drill expanding to ALL persons regardless of tier.
    const m = makeMetric({ id: 'M1', name: 'Revenue', raci: { accountable: ['PRSN-H1'], responsible: ['PRSN-I'], consulted: [], informed: [] } });
    const m2 = makeMetric({ id: 'M2', name: 'Other',   raci: { accountable: ['PRSN-H2'], responsible: [], consulted: [], informed: [] } });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      people: [head1, head2, ic], metrics: [m, m2],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.uiStateSet('strategy.matrix.filters', { drillMetric: 'M1' });
    const out = app.Metrics.renderRaciMatrix();

    expect(out).toContain('matrix-drill-metric');
    expect(out).toContain('Revenue');
    expect(out).toContain('Head1');     // accountable
    expect(out).toContain('Deep IC');   // ignored by tier filter normally; included in drill
    // The unrelated metric M2 must NOT appear.
    expect(out).not.toContain('Other');
    // Back-to-matrix button.
    expect(out).toContain('Back to matrix');

    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-raci-matrix-drillin-metric.html');
    app.teardown();
  });

  it('drillPerson collapses to one person column with all metrics they have RACI on', async () => {
    resetIdSeq();
    const sarah = makePerson({ id: 'PRSN-S', name: 'Sarah Chen' });
    const m1 = makeMetric({ id: 'M1', name: 'Revenue', raci: { accountable: ['PRSN-S'], responsible: [], consulted: [], informed: [] } });
    const m2 = makeMetric({ id: 'M2', name: 'Opex',    raci: { accountable: [], responsible: [], consulted: ['PRSN-S'], informed: [] } });
    const m3 = makeMetric({ id: 'M3', name: 'Untouched', raci: { accountable: [], responsible: [], consulted: [], informed: [] } });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      people: [sarah], metrics: [m1, m2, m3],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.uiStateSet('strategy.matrix.filters', { drillPerson: 'PRSN-S' });
    const out = app.Metrics.renderRaciMatrix();

    expect(out).toContain('matrix-drill-person');
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('Revenue');
    expect(out).toContain('Opex');
    expect(out).not.toContain('Untouched');
    expect(out).toContain('Back to matrix');

    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-raci-matrix-drillin-person.html');
    app.teardown();
  });
});
