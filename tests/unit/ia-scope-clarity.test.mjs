// IA Goal 1a — portfolio-wide vs single-customer menu clarity.
// Verifies scope-first section headers, the RAID split, the VIEW_SCOPE map, the titlebar scope badge,
// the "This customer" nav chip, and that customer mode hides the cross-customer RAID entry.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const boot = () => loadApp(makeDataset({
  projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
  customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }]
}));

describe('IA 1a — scope-first section headers', () => {
  it('exactly three section labels, matching all-customers / this-customer / system; none is bare "Portfolio"', async () => {
    const app = await boot();
    const labels = Array.from(app.document.querySelectorAll('.nav-section-label')).map(el => el.textContent.trim());
    expect(labels).toHaveLength(3);
    expect(labels.some(l => /across all customers/i.test(l))).toBe(true);
    expect(labels.some(l => /this customer/i.test(l))).toBe(true);
    expect(labels.some(l => /^system$/i.test(l))).toBe(true);
    expect(labels).not.toContain('Portfolio');
    app.teardown();
  });

  it('Portfolio Overview + the all-customers RAID sit under "Across all customers"', async () => {
    const app = await boot();
    const first = app.document.querySelectorAll('.nav-section')[0];
    expect(first.querySelector('.nav-section-label').textContent).toMatch(/across all customers/i);
    expect(first.querySelector('[data-view="portfolio"]')).toBeTruthy();
    expect(first.querySelector('#navRaidAll')).toBeTruthy();
    app.teardown();
  });
});

describe('IA 1a — RAID split into two explicit, scoped nav items', () => {
  it('two raid items exist with distinct ids and showAll-setting onclicks', async () => {
    const app = await boot();
    const raids = app.document.querySelectorAll('.nav-item[data-view="raid"]');
    expect(raids).toHaveLength(2);
    const all = app.document.getElementById('navRaidAll');
    const single = app.document.getElementById('navRaidSingle');
    expect(all).toBeTruthy();
    expect(single).toBeTruthy();
    expect(all.getAttribute('onclick')).toMatch(/showAll\s*=\s*true/);
    expect(single.getAttribute('onclick')).toMatch(/showAll\s*=\s*false/);
    app.teardown();
  });
});

describe('IA 1a — single-customer view titles signal scope', () => {
  it('dashboard/roadmap/backlog/single-RAID titles say "this customer"; portfolio says "all customers"', async () => {
    const app = await boot();
    const q = sel => app.document.querySelector(sel).getAttribute('title') || '';
    expect(q('[data-view="dashboard"]')).toMatch(/this customer/i);
    expect(q('[data-view="roadmap"]')).toMatch(/this customer/i);
    expect(q('[data-view="backlog"]')).toMatch(/this customer/i);
    expect(app.document.getElementById('navRaidSingle').getAttribute('title')).toMatch(/this customer/i);
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

  it('customer mode relabels only the single-customer RAID (not the all-customers entry)', async () => {
    const app = await boot();
    app.App.setActiveCustomer('Acme Industries');
    app.App.customerMode = true;
    app.App._applyCustomerMode();
    expect(app.document.getElementById('navRaidSingle').textContent).toMatch(/Risks & Decisions/);
    // the all-customers RAID entry keeps its label (it is CSS-hidden in customer mode, not relabelled)
    expect(app.document.getElementById('navRaidAll').textContent).toMatch(/all customers/i);
    app.App.customerMode = false; app.App._applyCustomerMode();
    app.teardown();
  });
});
