// Phase 3 — Detail Panel four-tab IA flip (Overview / Delivery / Scope & Value / RAID).
// renderBody now wraps its sections in 4 tabs; legacy `setup` / `health` tab keys
// map to `scope` / `overview` via DetailPanel._legacyTabAlias for callsite back-compat.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Detail Panel — four-tab IA', () => {
  it('renders the four tabs (Overview / Delivery / Scope / RAID) with Overview active by default', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P1', status: 'In Progress' });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.open(proj.id);
    const html = app.window.document.getElementById('panelBody').innerHTML;
    expect(html).toMatch(/data-dp-tab-trigger="overview"/);
    expect(html).toMatch(/data-dp-tab-trigger="delivery"/);
    expect(html).toMatch(/data-dp-tab-trigger="scope"/);
    expect(html).toMatch(/data-dp-tab-trigger="raid"/);
    expect(app.DetailPanel.activeTab).toBe('overview');
    expect(html).toMatch(/data-dp-tab="overview"/);
    expect(html).toMatch(/data-dp-tab="delivery"/);
    expect(html).toMatch(/data-dp-tab="scope"/);
    expect(html).toMatch(/data-dp-tab="raid"/);
    app.teardown();
  });

  it('switchTab updates the active tab and shows that panel', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P1' });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.open(proj.id);
    expect(app.DetailPanel.activeTab).toBe('overview');
    app.DetailPanel.switchTab('scope');
    expect(app.DetailPanel.activeTab).toBe('scope');
    const scopePanel = app.window.document.querySelector('[data-dp-tab="scope"]');
    const overviewPanel = app.window.document.querySelector('[data-dp-tab="overview"]');
    expect(scopePanel).not.toBeNull();
    expect(overviewPanel).not.toBeNull();
    expect(scopePanel.classList.contains('dp-tab-active')).toBe(true);
    expect(overviewPanel.classList.contains('dp-tab-active')).toBe(false);
    // Legacy tab key 'setup' should alias to 'scope' for back-compat.
    app.DetailPanel.switchTab('setup');
    expect(app.DetailPanel.activeTab).toBe('scope');
    app.teardown();
  });

  it('Overview carries Status + Identity + Prioritisation; Delivery carries phase points + sprint window; Scope carries Strategy linkage + Benefits; RAID carries Health + Blockers + Risks + Issues + Decisions (user-IA-rev)', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P1' });
    proj.size_total = 10;
    proj.size_engineering = 6;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.open(proj.id);
    const overview = app.window.document.querySelector('[data-dp-tab="overview"]');
    const delivery = app.window.document.querySelector('[data-dp-tab="delivery"]');
    const scope = app.window.document.querySelector('[data-dp-tab="scope"]');
    const raid = app.window.document.querySelector('[data-dp-tab="raid"]');
    // Overview: Status (kept), Identity + Prioritisation (moved from Scope).
    expect(overview.innerHTML).toMatch(/panel-section-title[^>]*>Status</);
    expect(overview.innerHTML).toMatch(/panel-section-title[^>]*>Identity</);
    expect(overview.innerHTML).toMatch(/panel-section-title[^>]*>Prioritisation</);
    // Identity strip (read-only) was dropped earlier; full editable Identity now lives here.
    expect(overview.querySelector('.dp-identity-strip')).toBeNull();
    expect(delivery.innerHTML).toMatch(/Delivery Phases/);
    expect(delivery.innerHTML).toMatch(/Sprint window/);
    // Scope keeps Strategy linkage + Benefits + Success criteria; Identity moved out.
    expect(scope.innerHTML).toMatch(/Strategy linkage/);
    expect(scope.innerHTML).toMatch(/Benefits/);
    expect(scope.innerHTML).not.toMatch(/panel-section-title[^>]*>Identity</);
    // RAID: Health + Blockers (moved from Overview) + R/A/I/D.
    expect(raid.innerHTML).toMatch(/panel-section-title[^>]*>Health</);
    expect(raid.innerHTML).toMatch(/panel-section-title[^>]*>Blockers</);
    expect(raid.innerHTML).toMatch(/Risks/);
    expect(raid.innerHTML).toMatch(/Issues/);
    expect(raid.innerHTML).toMatch(/Decisions/);
    app.teardown();
  });
});
