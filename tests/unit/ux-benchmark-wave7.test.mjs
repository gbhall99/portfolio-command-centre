// UX benchmark overhaul — Wave 7 (close the SUPR-Q trust/loyalty gap).
// R2 scoping chip; R3 canonical severe-risk threshold; R4 unscored-risk honesty; R7 plain-language customer decisions.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Wave 7 R2 — persistent customer scoping chip', () => {
  it('shows "Viewing: <customer>" in customer mode and updates on customer switch', async () => {
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.customerMode = true; app.App._applyCustomerMode();
    expect(app.document.getElementById('customerModeScopeChip').textContent).toBe('Viewing: Acme Industries');
    app.App.setActiveCustomer('Globex');
    expect(app.document.getElementById('customerModeScopeChip').textContent).toBe('Viewing: Globex');
    app.App.customerMode = false; app.App._applyCustomerMode();
    expect(app.document.getElementById('customerModeScopeChip').textContent).toBe('');
    app.teardown();
  });
});

describe('Wave 7 R3 — one canonical severe-risk threshold (>=15) across surfaces', () => {
  it('App.isSevereRisk uses >=15 and MyActions blockers honour it', async () => {
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries',
        risks_register: [
          { id: 'r12', description: 'score 12', impact: 4, probability: 3, status: 'open' }, // below cutoff
          { id: 'r16', description: 'score 16', impact: 4, probability: 4, status: 'open' }   // severe
        ] })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    expect(app.App.isSevereRisk({ impact: 5, probability: 3, status: 'open' })).toBe(true);  // 15
    expect(app.App.isSevereRisk({ impact: 4, probability: 3, status: 'open' })).toBe(false); // 12
    expect(app.App.isSevereRisk({ impact: 5, probability: 5, status: 'closed' })).toBe(false); // closed excluded
    const riskBlockers = app.MyActions.collect().blockers.filter(b => b.kind === 'risk');
    expect(riskBlockers).toHaveLength(1); // only the score-16 risk
    expect(riskBlockers[0].row.id).toBe('r16');
    app.teardown();
  });
});

describe('Wave 7 R7 — plain-language customer decision items in customer mode', () => {
  it('renders "We need your decision on" instead of forum/state jargon', async () => {
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }],
      governance_forums: [{ name: 'Steering', customer: 'Acme Industries', decisions: [{ text: 'Approve phase 2 budget', state: 'Proposed', date: '2026-07-01' }], actions: [] }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.customerMode = true; app.App._applyCustomerMode();
    app.App.navigate('myactions');
    const html = app.document.getElementById('myActionsBody').innerHTML;
    expect(html).toMatch(/We need your decision on: Approve phase 2 budget/);
    expect(html).toMatch(/For your input/);
    expect(html).not.toMatch(/>Approve</); // mutating control still gated
    app.teardown();
  });
});
