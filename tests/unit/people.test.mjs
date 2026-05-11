import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePerson, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Person module — CRUD + customer scoping', () => {
  it('list() returns people filtered by active customer', async () => {
    resetIdSeq();
    const acme = [makePerson({ customer: 'Acme Industries', name: 'Sarah' })];
    const globex = [makePerson({ customer: 'Globex', name: 'Other' })];
    const app = await loadApp(makeDataset({
      customers: [
        { name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 },
        { name: 'Globex',          color: '#10b981', staleThreshold: 14 },
      ],
      people: [...acme, ...globex],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Person.list().map(p => p.name)).toEqual(['Sarah']);
    app.App.activeCustomer = 'Globex';
    expect(app.Person.list().map(p => p.name)).toEqual(['Other']);
    app.teardown();
  });

  it('add() assigns a PRSN-* id when none supplied', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const created = app.Person.add({ name: 'New Hire' });
    expect(created.id).toMatch(/^PRSN-/);
    expect(created.customer).toBe('Acme Industries');
    expect(created.active).toBe(true);
    expect(Array.isArray(created.target_overrides)).toBe(true);
    app.teardown();
  });

  it('remove() clears RACI references and child manager_id pointers', async () => {
    resetIdSeq();
    const persona = makePersona({ id: 'P-1', name: 'Lead' });
    const head = makePerson({ id: 'PRSN-1', name: 'Head' });
    const report = makePerson({ id: 'PRSN-2', name: 'Report', manager_id: 'PRSN-1' });
    const m = makeMetric({ id: 'M1', raci: { accountable: ['PRSN-1'], responsible: [], consulted: [], informed: [] } });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], people: [head, report], metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Person.byId('PRSN-2').manager_id).toBe('PRSN-1');
    app.Person.remove('PRSN-1');
    expect(app.Person.byId('PRSN-1')).toBeNull();
    expect(app.Person.byId('PRSN-2').manager_id).toBeNull();
    expect(app.Metrics.byId('M1').raci.accountable).toEqual([]);
    app.teardown();
  });

  it('managerDepth() walks the manager chain', async () => {
    resetIdSeq();
    const head = makePerson({ id: 'PRSN-H', name: 'Head' });
    const lead = makePerson({ id: 'PRSN-L', name: 'Lead', manager_id: 'PRSN-H' });
    const ic   = makePerson({ id: 'PRSN-I', name: 'IC',   manager_id: 'PRSN-L' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      people: [head, lead, ic],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Person.managerDepth('PRSN-H')).toBe(0);
    expect(app.Person.managerDepth('PRSN-L')).toBe(1);
    expect(app.Person.managerDepth('PRSN-I')).toBe(2);
    app.teardown();
  });
});

describe('Person.add — RACI seeding from persona defaults', () => {
  it('a new Person inherits raci_defaults entries from their persona', async () => {
    resetIdSeq();
    const persona = makePersona({ id: 'P-CFO' });
    const m = makeMetric({
      id: 'M1',
      raci: { accountable: [], responsible: [], consulted: [], informed: [] },
      raci_defaults: { accountable: ['P-CFO'], responsible: [], consulted: [], informed: [] },
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const sarah = app.Person.add({ name: 'Sarah', persona_id: 'P-CFO' });
    expect(app.Metrics.byId('M1').raci.accountable).toContain(sarah.id);
    app.teardown();
  });
});
