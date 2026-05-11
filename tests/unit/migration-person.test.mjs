import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric } from '../harness/fixtures.mjs';

describe('migration: Person rework', () => {
  it('adds an empty data.people array if missing', async () => {
    const data = makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }] });
    delete data.people;
    const app = await loadApp(data);
    expect(Array.isArray(app.App.data.people)).toBe(true);
    app.teardown();
  });

  it('drops persona.tools / persona.decisions / persona.decisions_owned', async () => {
    const persona = {
      id: 'P-1', customer: 'Acme Industries', name: 'Old', role_title: '',
      definition: '', key_responsibilities: '', parent_persona_id: null, metric_holdings: [],
      tools: 'Salesforce', decisions: 'Pricing', decisions_owned: 'Old field',
    };
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const p = app.Personas.byId('P-1');
    expect('tools' in p).toBe(false);
    expect('decisions' in p).toBe(false);
    expect('decisions_owned' in p).toBe(false);
    app.teardown();
  });

  it('moves metric.raci entries that look persona-keyed into raci_defaults', async () => {
    const persona = makePersona({ id: 'P-CFO' });
    // Legacy metric where raci ids are persona ids (no people defined).
    const m = {
      id: 'M1', customer: 'Acme Industries', name: 'Revenue',
      group_id: 'performance', dimensions: [], objective_ids: [],
      raci: { accountable: ['P-CFO'], responsible: [], consulted: [], informed: [] },
      // No raci_defaults — migration should populate it.
      actuals: [], notes: '',
    };
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const migrated = app.Metrics.byId('M1');
    expect(migrated.raci_defaults.accountable).toEqual(['P-CFO']);
    expect(migrated.raci.accountable).toEqual([]);
    app.teardown();
  });

  it('does not re-migrate when raci_defaults already populated (idempotent)', async () => {
    const persona = makePersona({ id: 'P-CFO' });
    const m = {
      id: 'M1', customer: 'Acme Industries', name: 'Revenue',
      group_id: 'performance', dimensions: [], objective_ids: [],
      raci: { accountable: [], responsible: [], consulted: [], informed: [] },
      raci_defaults: { accountable: ['P-CFO'], responsible: [], consulted: [], informed: [] },
      actuals: [], notes: '',
    };
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.migrateSchema(app.App.data); // re-run
    const migrated = app.Metrics.byId('M1');
    expect(migrated.raci_defaults.accountable).toEqual(['P-CFO']);
    expect(migrated.raci.accountable).toEqual([]);
    app.teardown();
  });

  it('seeds metric.raci from raci_defaults for active People matching persona', async () => {
    const persona = makePersona({ id: 'P-CFO' });
    const m = {
      id: 'M1', customer: 'Acme Industries', name: 'Revenue',
      group_id: 'performance', dimensions: [], objective_ids: [],
      raci: { accountable: [], responsible: [], consulted: [], informed: [] },
      // raci_defaults populated up-front to simulate post-migration state.
      raci_defaults: { accountable: ['P-CFO'], responsible: [], consulted: [], informed: [] },
      actuals: [], notes: '',
    };
    const sarah = { id: 'PRSN-S', customer: 'Acme Industries', name: 'Sarah', persona_id: 'P-CFO', active: true, target_overrides: [] };
    const inactive = { id: 'PRSN-X', customer: 'Acme Industries', name: 'Old', persona_id: 'P-CFO', active: false, target_overrides: [] };
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], metrics: [m], people: [sarah, inactive],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const migrated = app.Metrics.byId('M1');
    expect(migrated.raci.accountable).toContain('PRSN-S');
    expect(migrated.raci.accountable).not.toContain('PRSN-X');
    app.teardown();
  });
});
