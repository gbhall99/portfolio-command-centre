import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

describe('Settings — Personas tab', () => {
  it('renders the personas list for the active customer', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [
        makePersona({ id: 'P1', name: 'Sarah Chen', role_title: 'CFO' }),
        makePersona({ id: 'P2', name: 'Tom Lee',    role_title: 'Head Ops', parent_persona_id: 'P1' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.renderSettingsTab();
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('Tom Lee');
    expect(out).toContain('CFO');
    app.teardown();
  });
});
