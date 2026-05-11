import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePerson, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — People tab', () => {
  it('renders a table with Name, Role, Department, Region, Persona, Manager, Active columns', async () => {
    resetIdSeq();
    const persona = makePersona({ id: 'P1', name: 'CFO Persona' });
    const head = makePerson({ id: 'PRSN-1', name: 'Sarah Chen',  role_title: 'CFO',          department: 'Finance', region: 'Group',  persona_id: 'P1' });
    const lead = makePerson({ id: 'PRSN-2', name: 'Priya Shah',  role_title: 'Finance Mgr',  department: 'Finance', region: 'Group',  persona_id: 'P1', manager_id: 'PRSN-1' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], people: [head, lead],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Person.renderInventoryTab();

    expect(out).toContain('people-toolbar');
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('Priya Shah');
    expect(out).toContain('Finance Mgr');
    expect(out).toContain('CFO Persona'); // persona name in row
    expect(out).toContain('Sarah Chen'); // also as manager of Priya

    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-people.html');
    app.teardown();
  });

  it('Person.renderSettingsTab renders the same data in a Settings-style table', async () => {
    resetIdSeq();
    const persona = makePersona({ id: 'P1', name: 'CFO' });
    const sarah = makePerson({ id: 'PRSN-1', name: 'Sarah', persona_id: 'P1' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona], people: [sarah],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Person.renderSettingsTab();
    expect(out).toContain('people-settings');
    expect(out).toContain('Sarah');
    app.teardown();
  });
});
