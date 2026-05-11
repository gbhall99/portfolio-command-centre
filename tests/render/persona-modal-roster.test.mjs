import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makePerson, resetIdSeq } from '../harness/fixtures.mjs';

describe('Persona detail modal — Roster section', () => {
  it('lists active People assigned to this persona, with click-through to Person modal', async () => {
    resetIdSeq();
    const persona = makePersona({ id: 'P1', name: 'CFO Persona' });
    const sarah = makePerson({ id: 'PRSN-1', name: 'Sarah Chen', role_title: 'CFO',         department: 'Finance', region: 'Group',  persona_id: 'P1' });
    const priya = makePerson({ id: 'PRSN-2', name: 'Priya Shah', role_title: 'Finance Mgr', department: 'Finance', region: 'Group',  persona_id: 'P1' });
    const inactive = makePerson({ id: 'PRSN-3', name: 'Old Hand', persona_id: 'P1', active: false });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], people: [sarah, priya, inactive],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.renderDetailBody('P1');

    expect(out).toContain('roster-section');
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('Priya Shah');
    // Inactive hidden by default.
    expect(out).not.toContain('Old Hand');
    // Toggle UI present (1 inactive count).
    expect(out).toMatch(/Show 1 inactive/);
    // Click-through routes to Person._openDetail.
    expect(out).toMatch(/Person\._openDetail\('PRSN-1'\)/);

    await expect(out).toMatchFileSnapshot('./__snapshots__/persona-modal-roster.html');
    app.teardown();
  });
});
