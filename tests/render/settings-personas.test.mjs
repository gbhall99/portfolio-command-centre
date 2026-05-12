import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

describe('Settings — Personas tab', () => {
  it('renders the personas list for the active customer', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [
        // After 2026-05 cleanup, persona.name IS the archetype label.
        makePersona({ id: 'P1', name: 'CFO' }),
        makePersona({ id: 'P2', name: 'Head Ops', parent_persona_id: 'P1' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.renderSettingsTab();
    expect(out).toContain('CFO');
    expect(out).toContain('Head Ops');
    // Settings table no longer carries a separate "Role" column —
    // persona.name is the archetype.
    expect(out).not.toContain('<th style="text-align:left;padding:6px">Role</th>');
    app.teardown();
  });
});
