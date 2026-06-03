// UX benchmark overhaul — Wave 5 (close the residual partials + harden customer mode).
// R1 customer-mode read-only "For your attention"; R8 RAID scope lock; R10 plain-language labels;
// R3 worst-project chip; R4 outstanding-approvals rollup; R6 next-delivery caption.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Wave 5 R1/R8/R10 — customer mode is read-only, plain-language, and scope-locked', () => {
  it('relabels My Actions + RAID, keeps My Actions visible, and forces RAID customer scope', async () => {
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.customerMode = true;
    app.App._applyCustomerMode();
    const ma = app.document.querySelector('.nav-item[data-view="myactions"]');
    expect(ma.textContent).toMatch(/For your attention/);
    expect(app.document.querySelector('#navRaidSingle').textContent).toMatch(/Risks & Decisions/);
    // R2 (wave 8): the cross-customer toggle is not even rendered in customer mode.
    app.App.navigate('raid');
    expect(app.document.getElementById('raidContent').innerHTML).not.toMatch(/Show all customers/);
    // restoring full mode brings the labels back
    app.App.customerMode = false;
    app.App._applyCustomerMode();
    expect(ma.textContent).toMatch(/Actions/);
    expect(ma.textContent).not.toMatch(/My Actions/);
    app.teardown();
  });

  it('My Actions hides Approve/Reassign/Mark-done in customer mode (read-only)', async () => {
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }],
      governance_forums: [{ name: 'Steering', customer: 'Acme Industries', decisions: [{ text: 'Sign off scope', state: 'Proposed' }], actions: [] }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.customerMode = true; app.App._applyCustomerMode();
    app.App.navigate('myactions');
    const body = app.document.getElementById('myActionsBody').innerHTML;
    expect(body).toMatch(/Sign off scope/); // decision still shown
    expect(body).not.toMatch(/>Approve</); // mutating action gated
    app.teardown();
  });
});

describe('Wave 5 R3/R6 — Portfolio Overview worst-project chip + next-delivery caption', () => {
  it('renders a Worst project chip and a next-delivery caption', async () => {
    const proj = makeProject({
      id: 'P1', customer: 'Acme Industries', size_total: 20, rag_schedule: 'Red',
      target_date: '2026-12-01',
      skill_splits: { engineering: [{ sprint: 'S1', points: 10, completed: 5 }] },
      risks_register: [{ id: 'r', description: 'big', impact: 5, probability: 4, status: 'open' }]
    });
    const app = await loadApp(makeDataset({ projects: [proj], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.navigate('portfolio');
    expect(app.document.getElementById('portfolioExecLine').innerHTML).toMatch(/Worst project:/);
    expect(app.document.getElementById('portfolioCustomerGrid').innerHTML).toMatch(/Next delivery:|Delivery in progress/);
    app.teardown();
  });
});

describe('Wave 5 R4 — Governance outstanding-approvals rollup', () => {
  it('shows an "Outstanding approvals: N" banner when decisions are pending', async () => {
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }],
      governance_forums: [{ name: 'Steering', customer: 'Acme Industries', decisions: [{ text: 'D1', state: 'Proposed' }, { text: 'D2', state: 'Discussed' }, { text: 'D3', state: 'Agreed' }], actions: [] }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.navigate('governance');
    const html = app.document.getElementById('govForumsContent').innerHTML;
    expect(html).toMatch(/Outstanding approvals: 2/); // 2 pending (Proposed + Discussed), Agreed excluded
    app.teardown();
  });
});
