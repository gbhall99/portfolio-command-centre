import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makePerson, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Person.effectiveHoldings — persona holdings + per-Person target overrides', () => {
  it('returns persona holdings unchanged when no overrides are set', async () => {
    resetIdSeq();
    const persona = makePersona({
      id: 'P1', name: 'CFO',
      metric_holdings: [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [{ period: '2026', value: 100, period_type: 'annual' }] }],
    });
    const sarah = makePerson({ id: 'PRSN-1', persona_id: 'P1' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], people: [sarah], metrics: [makeMetric({ id: 'M1' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const eff = app.Person.effectiveHoldings(sarah);
    expect(eff).toHaveLength(1);
    expect(eff[0].targets[0].value).toBe(100);
    expect(eff[0]._overridden).toBe(false);
    app.teardown();
  });

  it('a target_override on a matching (metric_id, filter) pair replaces the targets', async () => {
    resetIdSeq();
    const persona = makePersona({
      id: 'P1',
      metric_holdings: [{ id: 'H1', metric_id: 'M1', filter: { region: 'North' }, targets: [{ period: '2026', value: 100, period_type: 'annual' }] }],
    });
    const diane = makePerson({
      id: 'PRSN-1', persona_id: 'P1',
      target_overrides: [{ metric_id: 'M1', filter: { region: 'North' }, targets: [{ period: '2026', value: 220, period_type: 'annual' }] }],
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], people: [diane], metrics: [makeMetric({ id: 'M1', dimensions: ['region'] })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const eff = app.Person.effectiveHoldings(diane);
    expect(eff[0].targets[0].value).toBe(220);
    expect(eff[0]._overridden).toBe(true);
    app.teardown();
  });

  it('overrides only match when filter shape is identical (different filter → no override applied)', async () => {
    resetIdSeq();
    const persona = makePersona({
      id: 'P1',
      metric_holdings: [{ id: 'H1', metric_id: 'M1', filter: { region: 'North' }, targets: [{ period: '2026', value: 100 }] }],
    });
    // Override has no filter — should NOT match the persona holding (which is filtered).
    const diane = makePerson({
      id: 'PRSN-1', persona_id: 'P1',
      target_overrides: [{ metric_id: 'M1', filter: {}, targets: [{ period: '2026', value: 999 }] }],
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], people: [diane], metrics: [makeMetric({ id: 'M1', dimensions: ['region'] })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const eff = app.Person.effectiveHoldings(diane);
    expect(eff[0].targets[0].value).toBe(100);
    expect(eff[0]._overridden).toBe(false);
    app.teardown();
  });

  it('setTargetOverride / clearTargetOverride round-trip', async () => {
    resetIdSeq();
    const persona = makePersona({
      id: 'P1',
      metric_holdings: [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [{ period: '2026', value: 100 }] }],
    });
    const sarah = makePerson({ id: 'PRSN-1', persona_id: 'P1' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], people: [sarah], metrics: [makeMetric({ id: 'M1' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Person.setTargetOverride('PRSN-1', 'M1', {}, [{ period: '2026', value: 250, period_type: 'annual' }]);
    expect(app.Person.effectiveHoldings(sarah)[0].targets[0].value).toBe(250);
    app.Person.clearTargetOverride('PRSN-1', 'M1', {});
    expect(app.Person.effectiveHoldings(sarah)[0].targets[0].value).toBe(100);
    expect(app.Person.effectiveHoldings(sarah)[0]._overridden).toBe(false);
    app.teardown();
  });

  it('no holdings returned when person has no persona_id', async () => {
    resetIdSeq();
    const orphan = makePerson({ id: 'PRSN-1', persona_id: null });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      people: [orphan],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Person.effectiveHoldings(orphan)).toEqual([]);
    app.teardown();
  });
});
