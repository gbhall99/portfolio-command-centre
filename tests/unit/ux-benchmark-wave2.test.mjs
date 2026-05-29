// UX benchmark overhaul — Wave 2 (trust tier) regression guards.
// R1: customer-safe export prominence + cross-customer relabel.
// R7: My Actions scoped to the active customer.
// R3: plain-language "value delivered" on the customer-facing Portfolio Overview.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Wave 2 R1 — customer-safe export is prominent; cross-customer report is relabelled', () => {
  it('Governance exports panel offers a primary Customer Pack and a relabelled Internal Status Report', async () => {
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.navigate('governance');
    const gov = app.document.getElementById('govExports');
    expect(gov).toBeTruthy();
    const html = gov.innerHTML;
    expect(html).toMatch(/Customer Pack/);
    expect(html).toMatch(/Internal Status Report/);
    // Customer Pack is the primary (forwardable) action.
    const customerPackBtn = Array.from(gov.querySelectorAll('button')).find(b => /Customer Pack/.test(b.textContent));
    expect(customerPackBtn.className).toMatch(/btn-primary/);
    expect(customerPackBtn.getAttribute('onclick')).toMatch(/exportCustomerPack/);
    // exportStatusReport is async (so it can await the cross-customer confirm guard).
    expect(app.App.exportStatusReport.constructor.name).toBe('AsyncFunction');
    app.teardown();
  });
});

describe('Wave 2 R7 — My Actions is scoped to the active customer', () => {
  it('collect() only includes the active customer\'s forums', async () => {
    const forums = [
      { name: 'Acme Steering', customer: 'Acme Industries',
        decisions: [{ text: 'Acme decision', state: 'Proposed' }],
        actions: [{ description: 'Acme overdue', status: 'Open', due_date: '2020-01-01' }] },
      { name: 'Globex Steering', customer: 'Globex',
        decisions: [{ text: 'Globex decision', state: 'Proposed' }],
        actions: [{ description: 'Globex overdue', status: 'Open', due_date: '2020-01-01' }] }
    ];
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }],
      governance_forums: forums
    }));
    app.App.setActiveCustomer('Acme Industries');
    const res = app.MyActions.collect();
    expect(res.decisions).toHaveLength(1);
    expect(res.actions).toHaveLength(1);
    expect(res.decisions[0].decision.text).toBe('Acme decision');
    app.App.setActiveCustomer('Globex');
    const res2 = app.MyActions.collect();
    expect(res2.decisions[0].decision.text).toBe('Globex decision');
    app.teardown();
  });
});

describe('Wave 2 R3 — Portfolio Overview shows plain-language value delivered per customer', () => {
  it('customer card includes delivered SP and milestones-met', async () => {
    const proj = makeProject({
      id: 'P1', customer: 'Acme Industries', size_total: 20,
      skill_splits: { engineering: [{ sprint: 'S1', points: 10, completed: 6 }] },
      customer_milestones: [{ name: 'Go-live', date: '2026-03-01', status: 'Achieved' }, { name: 'Phase 2', date: '2026-09-01', status: 'Planned' }]
    });
    const app = await loadApp(makeDataset({
      projects: [proj], customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.navigate('portfolio');
    const grid = app.document.getElementById('portfolioCustomerGrid');
    expect(grid).toBeTruthy();
    const html = grid.innerHTML;
    expect(html).toMatch(/Delivered/);
    expect(html).toMatch(/6 \/ 20 SP/);
    expect(html).toMatch(/Milestones met/);
    expect(html).toMatch(/1 \/ 2/);
    app.teardown();
  });
});
