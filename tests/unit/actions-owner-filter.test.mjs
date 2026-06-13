// Actions view owner filter: defaults to All owners; filtering by an owner narrows the
// Overdue-actions and Blockers lists but never the Decisions list; nav badge is unfiltered.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const PAST = '2020-01-01'; // safely overdue

const boot = () => loadApp(makeDataset({
  projects: [makeProject({
    id: 'P1', name: 'Proj One', customer: 'Acme Industries',
    issues_register: [
      { id: 'i1', description: 'Issue owned by Priya', status: 'open', owner: 'Priya' },
      { id: 'i2', description: 'Issue owned by Sam', status: 'open', owner: 'Sam' }
    ]
  })],
  customers: [{ name: 'Acme Industries', color: '#6366f1' }],
  governance_forums: [{
    name: 'Steering', customer: 'Acme Industries',
    decisions: [{ text: 'Approve scope', state: 'Proposed' }],
    actions: [
      { description: 'Action for Priya', owner: 'Priya', due_date: PAST, status: 'Open' },
      { description: 'Action for Sam', owner: 'Sam', due_date: PAST, status: 'Open' }
    ]
  }]
}));

describe('Actions owner filter', () => {
  it('defaults to All owners and shows every owner\'s actions and blockers', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('myactions');
    expect(app.MyActions.ownerFilter).toBe('');
    const body = app.document.getElementById('myActionsBody').innerHTML;
    expect(body).toMatch(/Action for Priya/);
    expect(body).toMatch(/Action for Sam/);
    expect(body).toMatch(/Issue owned by Priya/);
    expect(body).toMatch(/Issue owned by Sam/);
    app.teardown();
  });

  it('renders an owner dropdown listing the distinct owners plus All owners', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('myactions');
    const sel = app.document.getElementById('actionsOwnerFilter');
    expect(sel).toBeTruthy();
    const opts = Array.from(sel.options).map(o => o.value);
    expect(opts[0]).toBe(''); // All owners
    expect(opts).toContain('Priya');
    expect(opts).toContain('Sam');
    app.teardown();
  });

  it('filtering to one owner narrows actions + blockers but keeps decisions', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('myactions');
    app.MyActions.setOwnerFilter('Priya');
    const body = app.document.getElementById('myActionsBody').innerHTML;
    expect(body).toMatch(/Action for Priya/);
    expect(body).not.toMatch(/Action for Sam/);
    expect(body).toMatch(/Issue owned by Priya/);
    expect(body).not.toMatch(/Issue owned by Sam/);
    expect(body).toMatch(/Approve scope/); // decision always shown
    app.teardown();
  });

  it('the RAID Actions tab count stays unfiltered after filtering', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('myactions'); // aliases to the RAID view's Actions tab
    const before = app.document.getElementById('raidCountActions').textContent;
    app.MyActions.setOwnerFilter('Priya');
    const after = app.document.getElementById('raidCountActions').textContent;
    expect(after).toBe(before);
    app.teardown();
  });

  it('resets a stale owner filter after switching to a customer without that owner', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('myactions');
    app.MyActions.setOwnerFilter('Priya');
    expect(app.MyActions.ownerFilter).toBe('Priya');
    // Switch to a customer that has no actions/blockers (and so no "Priya" owner).
    app.App.data.customers.push({ name: 'Globex', color: '#ec4899' });
    app.App.activeCustomer = 'Globex';
    app.App.navigate('myactions');
    // The stale filter self-heals to "All owners" so the view is not silently empty.
    expect(app.MyActions.ownerFilter).toBe('');
    const sel = app.document.getElementById('actionsOwnerFilter');
    expect(sel.value).toBe('');
    app.teardown();
  });
});
