import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePerson, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — RACI matrix axis-swap (rows=metrics, cols=people)', () => {
  it('uses a Tier filter that defaults to Heads + Leaders', async () => {
    resetIdSeq();
    const head   = makePerson({ id: 'PRSN-H', name: 'Head' });
    const lead   = makePerson({ id: 'PRSN-L', name: 'Lead', manager_id: 'PRSN-H' });
    const ic     = makePerson({ id: 'PRSN-I', name: 'IC',   manager_id: 'PRSN-L' });
    const m = makeMetric({ id: 'M1', name: 'Revenue',
      raci: { accountable: ['PRSN-H'], responsible: ['PRSN-L'], consulted: ['PRSN-I'], informed: [] } });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      people: [head, lead, ic], metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderRaciMatrix();

    // Toolbar includes the three tier buttons.
    expect(out).toContain('Heads');
    expect(out).toContain('Heads + Leaders');
    expect(out).toContain('All');
    // Default tier 'leaders' shows Head and Lead but NOT the IC.
    expect(out).toContain('Head');
    expect(out).toContain('Lead');
    expect(out).not.toMatch(/data-person-id="PRSN-I"/);
    app.teardown();
  });

  it('Tier=All includes everyone', async () => {
    resetIdSeq();
    const head = makePerson({ id: 'PRSN-H', name: 'Head' });
    const lead = makePerson({ id: 'PRSN-L', name: 'Lead', manager_id: 'PRSN-H' });
    const ic   = makePerson({ id: 'PRSN-I', name: 'IC',   manager_id: 'PRSN-L' });
    const m = makeMetric({ id: 'M1', raci: { accountable: ['PRSN-H'], responsible: [], consulted: [], informed: ['PRSN-I'] } });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      people: [head, lead, ic], metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.uiStateSet('strategy.matrix.filters', { tier: 'all' });
    const out = app.Metrics.renderRaciMatrix();
    expect(out).toMatch(/data-person-id="PRSN-I"/);
    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-raci-matrix-axis-all.html');
    app.teardown();
  });
});
