// UX benchmark overhaul — Wave 4 (Customer persona + appearance) regression guards.
// R1: customer (read-only) view mode. R2: work-delivered as %. R6: cross-portfolio health line.
// R12: persistent "viewing all customers" cue in RAID.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Wave 4 R1 — customer (read-only) view mode', () => {
  it('toggleCustomerMode flips the body class and persists the preference', async () => {
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    expect(app.document.body.classList.contains('customer-mode')).toBe(false);
    app.App.toggleCustomerMode();
    expect(app.document.body.classList.contains('customer-mode')).toBe(true);
    expect(app.App.uiStateGet('ui.customerMode', false)).toBe(true);
    // redirect away from a hidden internal view
    app.App.navigate('sprint');
    app.App._applyCustomerMode();
    expect(app.App.currentView).toBe('portfolio');
    app.App.toggleCustomerMode();
    expect(app.document.body.classList.contains('customer-mode')).toBe(false);
    app.teardown();
  });
});

describe('Wave 4 R2/R6 — Portfolio Overview value framing + cross-portfolio line', () => {
  it('renders a Portfolio health line and a Work-delivered progress bar', async () => {
    const proj = makeProject({
      id: 'P1', customer: 'Acme Industries', size_total: 20,
      skill_splits: { engineering: [{ sprint: 'S1', points: 10, completed: 5 }] }
    });
    const app = await loadApp(makeDataset({ projects: [proj], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.navigate('portfolio');
    const execLine = app.document.getElementById('portfolioExecLine');
    expect(execLine.textContent).toMatch(/Portfolio health/);
    const grid = app.document.getElementById('portfolioCustomerGrid');
    expect(grid.innerHTML).toMatch(/Work delivered/);
    expect(grid.innerHTML).toMatch(/role="progressbar"/);
    expect(grid.innerHTML).toMatch(/25%/); // 5 of 20 delivered
    app.teardown();
  });
});

describe('Wave 4 R12 — RAID shows a persistent all-customers cue', () => {
  it('renders a "Viewing all customers" pill when showAll is on', async () => {
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries', risks_register: [{ id: 'r', description: 'X', impact: 5, probability: 5, status: 'open' }] })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.navigate('raid');
    app.RaidView.toggleShowAll(true);
    expect(app.document.getElementById('raidContent').innerHTML).toMatch(/Viewing all customers/);
    app.RaidView.toggleShowAll(false);
    expect(app.document.getElementById('raidContent').innerHTML).not.toMatch(/Viewing all customers/);
    app.teardown();
  });
});
