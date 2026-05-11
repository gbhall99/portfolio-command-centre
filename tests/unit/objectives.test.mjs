import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeObjective, resetIdSeq } from '../harness/fixtures.mjs';

describe('Objectives module', () => {
  it('list() returns objectives filtered by active customer', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [
        { name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 },
        { name: 'Globex', color: '#10b981', staleThreshold: 14 },
      ],
      objectives: [
        makeObjective({ customer: 'Acme Industries', name: 'A' }),
        makeObjective({ customer: 'Globex', name: 'B' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const list = app.Objectives.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('A');
    app.teardown();
  });

  it('add() seeds default status=active and time_horizon shape', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const obj = app.Objectives.add({ name: 'Reduce opex' });
    expect(obj.status).toBe('active');
    expect(obj.time_horizon).toEqual({ start_date: null, target_date: null });
    app.teardown();
  });

  it('update() patches a single field without clobbering others', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      objectives: [makeObjective({ id: 'O1', name: 'Original', description: 'desc' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Objectives.update('O1', { status: 'achieved' });
    const o = app.Objectives.byId('O1');
    expect(o.name).toBe('Original');
    expect(o.description).toBe('desc');
    expect(o.status).toBe('achieved');
    app.teardown();
  });
});
