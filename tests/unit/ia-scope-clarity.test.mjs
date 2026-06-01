// IA Goal 1a — portfolio-wide vs single-customer menu clarity.
// Verifies scope-first section headers, the single RAID destination (scope is an in-view toggle),
// the VIEW_SCOPE map, the titlebar scope badge, and the "This customer" nav chip.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const boot = () => loadApp(makeDataset({
  projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
  customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }]
}));

describe('IA 1a — scope-first section headers', () => {
  it('exactly three section labels: Portfolio / {Customer} Delivery / System', async () => {
    const app = await boot();
    const labels = Array.from(app.document.querySelectorAll('.nav-section-label')).map(el => el.textContent.trim());
    expect(labels).toHaveLength(3);
    expect(labels).toContain('Portfolio');
    expect(labels.some(l => /delivery/i.test(l))).toBe(true);
    expect(labels.some(l => /^system$/i.test(l))).toBe(true);
    app.teardown();
  });

  it('Portfolio Overview sits under "Portfolio" and there is no RAID entry there', async () => {
    const app = await boot();
    const first = app.document.querySelectorAll('.nav-section')[0];
    expect(first.querySelector('.nav-section-label').textContent).toMatch(/^portfolio$/i);
    expect(first.querySelector('[data-view="portfolio"]')).toBeTruthy();
    expect(first.querySelector('[data-view="raid"]')).toBeFalsy();
    app.teardown();
  });
});

describe('IA 1a — RAID is a single, unambiguous nav destination', () => {
  it('exactly one raid nav item exists; scope defaults to this-customer via onclick', async () => {
    const app = await boot();
    const raids = app.document.querySelectorAll('.nav-item[data-view="raid"]');
    expect(raids).toHaveLength(1);
    expect(app.document.getElementById('navRaidAll')).toBeFalsy();
    const single = app.document.getElementById('navRaidSingle');
    expect(single).toBeTruthy();
    expect(single.getAttribute('onclick')).toMatch(/showAll\s*=\s*false/);
    app.teardown();
  });
});

describe('IA 1a — single-customer view titles signal scope', () => {
  it('dashboard/roadmap/backlog titles say "this customer"; portfolio says "all customers"; RAID notes its in-view toggle', async () => {
    const app = await boot();
    const q = sel => app.document.querySelector(sel).getAttribute('title') || '';
    expect(q('[data-view="dashboard"]')).toMatch(/this customer/i);
    expect(q('[data-view="roadmap"]')).toMatch(/this customer/i);
    expect(q('[data-view="backlog"]')).toMatch(/this customer/i);
    expect(app.document.getElementById('navRaidSingle').getAttribute('title')).toMatch(/in-view/i);
    expect(app.document.getElementById('navRaidSingle').getAttribute('title')).not.toMatch(/cross-portfolio/i);
    expect(q('[data-view="portfolio"]')).toMatch(/all customers/i);
    app.teardown();
  });
});

describe('IA 1a — VIEW_SCOPE map + titlebar scope badge', () => {
  it('VIEW_SCOPE classifies portfolio=all, dashboard=one, activity/config=system', async () => {
    const app = await boot();
    expect(app.App.VIEW_SCOPE.portfolio).toBe('all');
    expect(app.App.VIEW_SCOPE.dashboard).toBe('one');
    expect(app.App.VIEW_SCOPE.activity).toBe('system');
    expect(app.App.VIEW_SCOPE.config).toBe('system');
    // RAID scope is dynamic.
    app.RaidView.showAll = true; expect(app.App._viewScope('raid')).toBe('all');
    app.RaidView.showAll = false; expect(app.App._viewScope('raid')).toBe('one');
    app.teardown();
  });

  it('titlebar badge reads "All customers" (no dot) on portfolio, "This customer: <name>" on a scoped view', async () => {
    const app = await boot();
    app.App.setActiveCustomer('Acme Industries');
    app.App.navigate('portfolio');
    const cust = app.document.getElementById('viewTitlebarCustomer');
    expect(cust.textContent).toMatch(/all customers/i);
    expect(cust.classList.contains('tb-no-dot')).toBe(true);
    app.App.navigate('dashboard');
    expect(cust.textContent).toMatch(/this customer: Acme Industries/i);
    expect(cust.classList.contains('tb-no-dot')).toBe(false);
    app.teardown();
  });
});

describe('IA 1a — "This customer" nav chip + customer-mode RAID hiding', () => {
  it('the nav chip names the active customer and updates on switch', async () => {
    const app = await boot();
    app.App.setActiveCustomer('Acme Industries');
    expect(app.document.getElementById('navScopeCustomerChip').textContent).toBe('Acme Industries');
    app.App.setActiveCustomer('Globex');
    expect(app.document.getElementById('navScopeCustomerChip').textContent).toBe('Globex');
    app.teardown();
  });

  it('customer mode relabels the single RAID nav item to plain language', async () => {
    const app = await boot();
    app.App.setActiveCustomer('Acme Industries');
    app.App.customerMode = true;
    app.App._applyCustomerMode();
    expect(app.document.getElementById('navRaidSingle').textContent).toMatch(/Risks & Decisions/);
    app.App.customerMode = false; app.App._applyCustomerMode();
    app.teardown();
  });
});
