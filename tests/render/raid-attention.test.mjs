import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function boot() {
  const app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [makeProject({ id: 'P1', name: 'Proj One', customer: 'Acme Industries',
      risks_register: [{ description: 'Hot risk', impact: 5, probability: 5, target_date: '2099-01-01', owner: 'A' }],
      issues_register: [{ id: 'i1', description: 'Old issue', status: 'open', owner: 'A', opened_date: '2000-01-01' }]
    })],
    governance_forums: [{ name: 'Steering', customer: 'Acme Industries', decisions: [{ text: 'Approve scope', state: 'Proposed', date: '2000-01-01' }], actions: [] }]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

describe('D4 RAID Attention panel', () => {
  it('renders the three groups with the seeded items', async () => {
    const app = await boot();
    app.App.navigate('raid');
    const host = app.document.getElementById('raidContent') || app.document.getElementById('viewRaid');
    const html = host.innerHTML;
    expect(html).toMatch(/Attention|Risks to watch/i);
    expect(html).toMatch(/Hot risk/);
    expect(html).toMatch(/Old issue/);
    expect(html).toMatch(/Approve scope/);
    app.teardown();
  });
  it('shows "all clear" groups when nothing is urgent', async () => {
    const app = await loadApp(makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1' }], projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })] }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('raid');
    const host = app.document.getElementById('raidContent') || app.document.getElementById('viewRaid');
    expect(host.innerHTML).toMatch(/all clear|nothing|no /i);
    app.teardown();
  });
});
