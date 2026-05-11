import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

describe('Personas module', () => {
  it('list() returns personas filtered by active customer', async () => {
    resetIdSeq();
    const acme = [makePersona({ customer: 'Acme Industries', name: 'Sarah' })];
    const globex = [makePersona({ customer: 'Globex', name: 'Other' })];
    const app = await loadApp(makeDataset({
      customers: [
        { name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 },
        { name: 'Globex', color: '#10b981', staleThreshold: 14 },
      ],
      personas: [...acme, ...globex],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const list = app.Personas.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Sarah');
    app.teardown();
  });

  it('descendants() walks parent_persona_id transitively', async () => {
    resetIdSeq();
    const ceo  = makePersona({ id: 'P1', name: 'CEO', parent_persona_id: null });
    const cfo  = makePersona({ id: 'P2', name: 'CFO', parent_persona_id: 'P1' });
    const finM = makePersona({ id: 'P3', name: 'Fin Mgr', parent_persona_id: 'P2' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [ceo, cfo, finM],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const desc = app.Personas.descendants('P1');
    expect(desc.map(p => p.id).sort()).toEqual(['P2', 'P3']);
    app.teardown();
  });

  it('cycleCheck() rejects self-parent and indirect cycles', async () => {
    resetIdSeq();
    const a = makePersona({ id: 'P1', parent_persona_id: null });
    const b = makePersona({ id: 'P2', parent_persona_id: 'P1' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [a, b],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Personas.cycleCheck('P1', 'P1')).toBe(false);   // self-parent rejected
    expect(app.Personas.cycleCheck('P1', 'P2')).toBe(false);   // would create cycle (P1→P2→P1)
    expect(app.Personas.cycleCheck('P2', 'P1')).toBe(true);    // valid (P2's parent stays P1)
    app.teardown();
  });
});
