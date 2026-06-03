// RAID is always scoped to the active customer — no all-customers toggle, scope is static.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const boot = () => loadApp(makeDataset({
  projects: [
    makeProject({ id: 'A1', customer: 'Acme Industries', risks_register: [{ id: 'r', description: 'Acme risk', impact: 5, probability: 4, status: 'open' }] }),
    makeProject({ id: 'G1', customer: 'Globex', risks_register: [{ id: 'r2', description: 'Globex risk', impact: 5, probability: 4, status: 'open' }] })
  ],
  customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }]
}));

describe('RAID always customer-scoped', () => {
  it('renders no "Show all customers" toggle', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('raid');
    const html = app.document.getElementById('raidContent').innerHTML;
    expect(html).not.toMatch(/Show all customers/i);
    expect(html).not.toMatch(/Viewing all customers/i);
    app.teardown();
  });

  it('_viewScope("raid") is always "one" regardless of showAll', async () => {
    const app = await boot();
    app.RaidView.showAll = true;
    expect(app.App._viewScope('raid')).toBe('one');
    app.RaidView.showAll = false;
    expect(app.App._viewScope('raid')).toBe('one');
    app.teardown();
  });

  it('only shows the active customer\'s rows', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('raid');
    const html = app.document.getElementById('raidContent').innerHTML;
    expect(html).toMatch(/Acme risk/);
    expect(html).not.toMatch(/Globex risk/);
    app.teardown();
  });
});
