// Phase 3 — Detail Panel IA flip. Tests cover AC-3.1 (ARIA tablist), AC-3.2
// (zero orphans — every §3.13 section lands in its new home), AC-3.3
// (entry-point routing), AC-3.4 (hash round-trip), AC-3.5 (read-only Identity
// strip rendered into Overview regardless of active tab).
//
// The plan lives at plans/detail-panel-ia-refactor.md (§3.1, §3.13, §5 row Phase 3).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function bootWithProject(extra = {}) {
  const p = makeProject(Object.assign({ id: 'P-T3', name: 'P', customer: 'Acme Industries' }, extra));
  const app = await loadApp(makeDataset({ projects: [p] }));
  app.App.activeCustomer = 'Acme Industries';
  return { app, p };
}

describe('Phase 3 / AC-3.1 — ARIA tablist', () => {
  it('tab strip is a role=tablist with four role=tab buttons in fixed order', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('P-T3');
    const body = app.document.getElementById('panelBody');
    const tablist = body.querySelector('[role="tablist"]');
    expect(tablist).toBeTruthy();
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    expect(tabs.length).toBe(4);
    const ids = tabs.map(t => t.dataset.dpTabTrigger);
    expect(ids).toEqual(['overview', 'delivery', 'scope', 'raid']);
    // Each tab carries aria-controls pointing at a tabpanel with matching id.
    tabs.forEach(tab => {
      const target = tab.getAttribute('aria-controls');
      const panel = body.querySelector('#' + target);
      expect(panel).toBeTruthy();
      expect(panel.getAttribute('role')).toBe('tabpanel');
      expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
    });
    app.teardown();
  });

  it('exactly one tab has aria-selected=true; the rest are false; active tab is keyboard-focusable', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('P-T3');
    const body = app.document.getElementById('panelBody');
    const tabs = Array.from(body.querySelectorAll('[role="tab"]'));
    const selected = tabs.filter(t => t.getAttribute('aria-selected') === 'true');
    expect(selected.length).toBe(1);
    expect(selected[0].dataset.dpTabTrigger).toBe('overview');
    // Active tab is tabindex=0; the rest are tabindex=-1 (roving focus).
    expect(selected[0].getAttribute('tabindex')).toBe('0');
    tabs.filter(t => t !== selected[0]).forEach(t => {
      expect(t.getAttribute('tabindex')).toBe('-1');
    });
    app.teardown();
  });

  it('switchTab updates aria-selected + tabindex on every tab', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('P-T3');
    app.DetailPanel.switchTab('delivery');
    const body = app.document.getElementById('panelBody');
    const tabs = Array.from(body.querySelectorAll('[role="tab"]'));
    const selected = tabs.filter(t => t.getAttribute('aria-selected') === 'true');
    expect(selected.length).toBe(1);
    expect(selected[0].dataset.dpTabTrigger).toBe('delivery');
    expect(selected[0].getAttribute('tabindex')).toBe('0');
    app.teardown();
  });
});

describe('Phase 3 / AC-3.2 — section migration map (zero orphans)', () => {
  it('every §3.13 section renders in its new home', async () => {
    const { app } = await bootWithProject({
      benefits: [{ description: 'b' }],
      success_criteria: [{ description: 's' }],
      risks_register: [],
      decisions_register: [],
      assumptions_register: [],
      issues_register: [],
      customer_milestones: [{ name: 'M1', date: '2026-01-01', status: 'Planned' }]
    });
    app.DetailPanel.open('P-T3');
    const overview = app.document.querySelector('[data-dp-tab="overview"]');
    const delivery = app.document.querySelector('[data-dp-tab="delivery"]');
    const scope = app.document.querySelector('[data-dp-tab="scope"]');
    const raid = app.document.querySelector('[data-dp-tab="raid"]');

    // Overview holds: Identity strip, EVM strip, Status & Health, Strategy
    expect(overview.querySelector('.dp-identity-strip')).toBeTruthy();
    expect(overview.innerHTML).toMatch(/Status &amp; Health|Status & Health/);
    expect(overview.innerHTML).toMatch(/panel-section-title[^>]*>Strategy</);

    // Delivery holds: Delivery Setup, Dependencies, Stakeholders, Dates,
    // Sprint window, Delivery Phases, Customer Milestones
    expect(delivery.innerHTML).toMatch(/Delivery Setup/);
    expect(delivery.innerHTML).toMatch(/Dependencies/);
    expect(delivery.innerHTML).toMatch(/Stakeholders/);
    expect(delivery.innerHTML).toMatch(/Dates/);
    expect(delivery.innerHTML).toMatch(/Sprint window/);
    expect(delivery.innerHTML).toMatch(/Delivery Phases/);
    expect(delivery.innerHTML).toMatch(/Customer Milestones/);

    // Scope holds: Identity (editable), Prioritisation, Strategy linkage, Benefits, Success criteria
    const scopeTitles = Array.from(scope.querySelectorAll('.panel-section-title')).map(t => t.textContent.trim());
    expect(scopeTitles.some(t => /^Identity/.test(t))).toBe(true);
    expect(scopeTitles.some(t => /^Prioritisation/.test(t))).toBe(true);
    expect(scopeTitles.some(t => /^Strategy linkage/.test(t))).toBe(true);
    expect(scopeTitles.some(t => /^Benefits/.test(t))).toBe(true);
    expect(scopeTitles.some(t => /^Success criteria/.test(t))).toBe(true);

    // RAID holds: Assumptions, Risks, Decisions, Issues
    const raidTitles = Array.from(raid.querySelectorAll('.panel-section-title')).map(t => t.textContent.trim());
    expect(raidTitles.some(t => /^Assumptions/.test(t))).toBe(true);
    expect(raidTitles.some(t => /^Risks/.test(t))).toBe(true);
    expect(raidTitles.some(t => /^Decisions/.test(t))).toBe(true);
    expect(raidTitles.some(t => /^Issues/.test(t))).toBe(true);

    app.teardown();
  });

  it('Issues moved from Delivery → RAID; Dependencies stays on Delivery', async () => {
    const { app } = await bootWithProject({ issues_register: [{ description: 'I1' }], dependencies: [] });
    app.DetailPanel.open('P-T3');
    const delivery = app.document.querySelector('[data-dp-tab="delivery"]');
    const raid = app.document.querySelector('[data-dp-tab="raid"]');
    expect(delivery.innerHTML).not.toMatch(/panel-section-title[^>]*>Issues\b/);
    expect(raid.innerHTML).toMatch(/panel-section-title[^>]*>Issues\b/);
    expect(delivery.innerHTML).toMatch(/panel-section-title[^>]*>Dependencies\b/);
    expect(raid.innerHTML).not.toMatch(/panel-section-title[^>]*>Dependencies\b/);
    app.teardown();
  });
});

describe('Phase 3 / AC-3.3 — entry-point routing', () => {
  const fixtures = [
    { entryPoint: 'dashboard', expected: 'overview' },
    { entryPoint: 'walkthrough', expected: 'overview' },
    { entryPoint: 'projects', expected: 'delivery' },
    { entryPoint: 'roadmap', expected: 'delivery' },
    { entryPoint: 'strategy', expected: 'scope' }
  ];
  fixtures.forEach(({ entryPoint, expected }) => {
    it(`entryPoint=${entryPoint} → landing tab=${expected}`, async () => {
      const { app } = await bootWithProject();
      app.DetailPanel.open('P-T3', { entryPoint });
      expect(app.DetailPanel.activeTab).toBe(expected);
      app.teardown();
    });
  });

  it('opts.tab override beats entryPoint', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('P-T3', { entryPoint: 'projects', tab: 'raid' });
    expect(app.DetailPanel.activeTab).toBe('raid');
    app.teardown();
  });
});

describe('Phase 3 / AC-3.4 — hash routing round-trips', () => {
  it('switchTab writes the hash #/p/<id>/<tab>', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('P-T3');
    app.DetailPanel.switchTab('scope');
    expect(app.window.location.hash).toBe('#/p/P-T3/scope');
    app.DetailPanel.switchTab('raid');
    expect(app.window.location.hash).toBe('#/p/P-T3/raid');
    app.teardown();
  });

  it('opening with a hash that matches lands on the encoded tab', async () => {
    const { app } = await bootWithProject();
    app.window.history.replaceState(null, '', '#/p/P-T3/delivery');
    app.DetailPanel.open('P-T3');
    expect(app.DetailPanel.activeTab).toBe('delivery');
    app.teardown();
  });

  it('legacy tab keys in the hash alias to the new tab name', async () => {
    const { app } = await bootWithProject();
    app.window.history.replaceState(null, '', '#/p/P-T3/setup');
    app.DetailPanel.open('P-T3');
    expect(app.DetailPanel.activeTab).toBe('scope');
    app.teardown();
  });

  it('_parseHash and _hashFor are inverses', async () => {
    const { app } = await bootWithProject();
    const h = app.DetailPanel._hashFor('PX', 'raid', 'risks');
    expect(h).toBe('#/p/PX/raid#risks');
    const parsed = app.DetailPanel._parseHash(h);
    expect(parsed).toEqual({ projectId: 'PX', tab: 'raid', section: 'risks' });
    app.teardown();
  });
});

describe('Phase 3 / AC-3.5 — read-only Identity strip on Overview', () => {
  it('renders customer + sponsor + governance forum even when active tab is not Overview', async () => {
    const { app } = await bootWithProject({ sponsor: 'Ada Lovelace', governance_forum: 'Acme Weekly' });
    app.DetailPanel.open('P-T3', { tab: 'raid' });
    expect(app.DetailPanel.activeTab).toBe('raid');
    // Identity strip still in DOM under the Overview panel.
    const strip = app.document.querySelector('[data-dp-tab="overview"] .dp-identity-strip');
    expect(strip).toBeTruthy();
    expect(strip.textContent).toContain('Acme Industries');
    expect(strip.textContent).toContain('Ada Lovelace');
    expect(strip.textContent).toContain('Acme Weekly');
    // Strip is marked read-only (it points to Scope & Value → Identity for edits).
    expect(strip.getAttribute('data-readonly')).toBe('true');
    app.teardown();
  });

  it('handles empty sponsor + forum with a dash placeholder', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('P-T3');
    const strip = app.document.querySelector('[data-dp-tab="overview"] .dp-identity-strip');
    expect(strip.textContent).toContain('Sponsor: —');
    expect(strip.textContent).toContain('Forum: —');
    app.teardown();
  });
});
