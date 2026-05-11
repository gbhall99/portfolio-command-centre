import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeObjective, resetIdSeq } from '../harness/fixtures.mjs';

describe('Settings — Objectives tab', () => {
  it('renders the objectives list with status pills', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      objectives: [
        makeObjective({ id: 'O1', name: 'Reduce opex', status: 'active' }),
        makeObjective({ id: 'O2', name: 'Tooling done', status: 'achieved' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Objectives.renderSettingsTab();
    expect(out).toContain('Reduce opex');
    expect(out).toContain('Tooling done');
    expect(out).toMatch(/active/i);
    expect(out).toMatch(/achieved/i);
    app.teardown();
  });
});
