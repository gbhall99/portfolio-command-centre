import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function boot(extra = {}) {
  const app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [makeProject({ id: 'P1', customer: 'Acme Industries',
      issues_register: [
        { id: 'i1', description: 'Older', status: 'open', opened_date: '2000-01-01' },
        { id: 'i2', description: 'Newer', status: 'open', opened_date: '2020-01-01' }
      ],
      risks_register: extra.risks_register || []
    })]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

describe('D5 enriched RAID tables', () => {
  it('issues table shows an age ("open Nd") and sorts oldest-first by default', async () => {
    const app = await boot();
    app.RaidView.activeTab = 'issues';
    app.App.navigate('raid');
    const host = app.document.getElementById('raidContent');
    expect(host.innerHTML).toMatch(/open \d+d|\bAge\b/);
    const text = host.textContent;
    expect(text.indexOf('Older')).toBeLessThan(text.indexOf('Newer'));
    app.teardown();
  });

  it('issues table has an Age column header and orders table rows oldest-first', async () => {
    const app = await boot();
    app.RaidView.activeTab = 'issues';
    app.App.navigate('raid');
    const table = app.document.querySelector('#raidContent .raid-table');
    expect(table).toBeTruthy();
    // Age header present in the table itself.
    expect(table.querySelector('thead').textContent).toMatch(/Age/);
    // Each body row carries an "open Nd" age cell.
    const bodyRows = table.querySelectorAll('tbody tr.raid-row');
    expect(bodyRows.length).toBe(2);
    expect(/open \d+d/.test(table.querySelector('tbody').innerHTML)).toBe(true);
    // Default order in the TABLE body is age desc: Older (2000) before Newer (2020).
    const order = Array.from(bodyRows).map(tr => tr.textContent);
    const olderIdx = order.findIndex(t => t.includes('Older'));
    const newerIdx = order.findIndex(t => t.includes('Newer'));
    expect(olderIdx).toBeLessThan(newerIdx);
    app.teardown();
  });

  it('risks table shows a Target column only when a risk has a target_date', async () => {
    // With a future target_date, the Target column should appear ("in Nd").
    const app = await boot({ risks_register: [
      { id: 'r1', description: 'Risk with target', impact: 4, probability: 3, status: 'open', target_date: '2099-01-01' }
    ] });
    app.RaidView.activeTab = 'risks';
    app.App.navigate('raid');
    const table = app.document.querySelector('#raidContent .raid-table');
    expect(table.querySelector('thead').textContent).toMatch(/Target/);
    expect(/in \d+d|overdue/.test(table.querySelector('tbody').innerHTML)).toBe(true);
    app.teardown();
  });

  it('risks table hides the Target column when no risk has a target_date', async () => {
    const app = await boot({ risks_register: [
      { id: 'r1', description: 'No target risk', impact: 4, probability: 3, status: 'open' }
    ] });
    app.RaidView.activeTab = 'risks';
    app.App.navigate('raid');
    const table = app.document.querySelector('#raidContent .raid-table');
    expect(table.querySelector('thead').textContent).not.toMatch(/Target/);
    app.teardown();
  });
});
