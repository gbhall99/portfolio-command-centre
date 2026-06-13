// "All customers" global filter — aggregates the read/overview + planning-list
// views, while non-applicable views (Sprint Planning, the Strategy library,
// Settings) stay scoped to the single working customer. activeCustomer always
// stays a real customer so authoring/creation flows are never null-scoped.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }],
    projects: [
      makeProject({ id: 'A-1', name: 'Acme One', customer: 'Acme Industries', status: 'In Progress',
        risks_register: [{ id: 'ra', description: 'Acme risk', impact: 4, probability: 4, status: 'open' }] }),
      makeProject({ id: 'A-2', name: 'Acme Two', customer: 'Acme Industries', status: 'In Progress' }),
      makeProject({ id: 'G-1', name: 'Globex One', customer: 'Globex', status: 'In Progress',
        risks_register: [{ id: 'rg', description: 'Globex risk', impact: 5, probability: 5, status: 'open' }] })
    ]
  }));
  app.App.setActiveCustomer('Acme Industries');
  app.App.customerMode = false;
});
afterEach(() => app.teardown());

describe('selector + state', () => {
  it('setActiveCustomer("") turns on the All filter; picking a customer turns it off', () => {
    const { App } = app;
    App.setActiveCustomer('');
    expect(App.allCustomers).toBe(true);
    expect(App.activeCustomer).toBe('Acme Industries'); // working customer preserved
    App.setActiveCustomer('Globex');
    expect(App.allCustomers).toBe(false);
    expect(App.activeCustomer).toBe('Globex');
  });

  it('the global selector includes an "All customers" option mapping to value ""', () => {
    const { App, document } = app;
    App.allCustomers = true; App.currentView = 'dashboard';
    if (typeof app.Dashboard.init === 'function') app.Dashboard.init();
    const gc = document.getElementById('globalCustomer');
    const opts = Array.from(gc.options).map(o => ({ v: o.value, t: o.textContent }));
    expect(opts[0]).toMatchObject({ v: '', t: 'All customers' });
  });

  it('customer-facing read-only mode refuses to aggregate', () => {
    const { App } = app;
    App.customerMode = true;
    App.setActiveCustomer('');
    expect(App.allCustomers).toBe(false);
    expect(App.isAllScope()).toBe(false);
  });
});

describe('view-aware scope helpers', () => {
  it('isAllScope/scopeCustomer/matchesCustomer only aggregate on aggregate-capable views', () => {
    const { App } = app;
    App.setActiveCustomer('');
    // aggregate-capable
    App.currentView = 'dashboard';
    expect(App.isAllScope()).toBe(true);
    expect(App.scopeCustomer()).toBe(null);
    expect(App.matchesCustomer('Globex')).toBe(true);
    App.currentView = 'capacity';
    expect(App.isAllScope()).toBe(true);
    // NOT aggregate-capable — falls back to the working customer
    App.currentView = 'sprint';
    expect(App.isAllScope()).toBe(false);
    expect(App.scopeCustomer()).toBe('Acme Industries');
    expect(App.matchesCustomer('Globex')).toBe(false);
    App.currentView = 'personas';
    expect(App.isAllScope()).toBe(false);
    expect(App.scopeCustomer()).toBe('Acme Industries');
  });
});

describe('aggregate-capable views show every customer under All', () => {
  it('Projects (applyFilters) lists projects from all customers', () => {
    const { App, Dashboard } = app;
    App.currentView = 'dashboard';
    App.setActiveCustomer('');
    Dashboard.applyFilters();
    const ids = Dashboard.filteredProjects.map(p => p.id).sort();
    expect(ids).toEqual(['A-1', 'A-2', 'G-1']);
  });

  it('Projects scopes to one customer when not in All mode', () => {
    const { App, Dashboard } = app;
    App.currentView = 'dashboard';
    App.setActiveCustomer('Acme Industries');
    Dashboard.applyFilters();
    expect(Dashboard.filteredProjects.map(p => p.id).sort()).toEqual(['A-1', 'A-2']);
  });

  it('RAID (_collect) aggregates risks across customers', () => {
    const { App, RaidView } = app;
    App.currentView = 'raid';
    App.setActiveCustomer('');
    const rows = RaidView._collect('risks');
    expect(rows.map(r => r.project.id).sort()).toEqual(['A-1', 'G-1']);
  });

  it('Backlog buckets aggregate across customers', () => {
    const { App } = app;
    App.currentView = 'backlog';
    App.setActiveCustomer('');
    const buckets = App.computeBacklogBuckets(App.scopeCustomer());
    const all = [...buckets.unrefined, ...buckets.refined, ...buckets.parked].map(p => p.id).sort();
    expect(all).toEqual(['A-1', 'A-2', 'G-1']);
  });

  it('portfolioHealth aggregates every customer when given no customer', () => {
    const { App } = app;
    const agg = App.portfolioHealth(null);
    const acme = App.portfolioHealth('Acme Industries');
    expect(agg.total).toBe(3);
    expect(acme.total).toBe(2);
  });

  it('Kanban.moveCard works on any customer card under All, not just the working one', () => {
    const { App, Kanban } = app;
    App.currentView = 'board';
    App.setActiveCustomer(''); // working customer is still Acme
    // Globex card would be blocked in single mode; allowed under All.
    expect(Kanban.moveCard('G-1', 'Complete')).toBe(true);
    expect(App.data.projects.find(p => p.id === 'G-1').status).toBe('Complete');
  });
});

describe('non-applicable views stay single-customer under All', () => {
  it('a Strategy list helper still scopes to the working customer on its own view', () => {
    const { App } = app;
    App.setActiveCustomer('');
    App.currentView = 'personas'; // not aggregate-capable
    // matchesCustomer is the predicate shared helpers use; it must NOT aggregate here.
    expect(App.matchesCustomer('Globex')).toBe(false);
    expect(App.matchesCustomer('Acme Industries')).toBe(true);
  });
});

describe('persistence', () => {
  it('the All flag round-trips through localStorage on reload', async () => {
    const { App } = app;
    App.setActiveCustomer('');
    expect(app.window.localStorage.getItem('portfolio-command-centre-allCustomers')).toBe('1');
    // Re-run onDataLoaded to simulate a reload restoring the flag.
    App.allCustomers = false;
    App.onDataLoaded();
    expect(App.allCustomers).toBe(true);
  });
});
