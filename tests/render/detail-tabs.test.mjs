// Issue 9 — Detail Panel three-tab redesign.
// renderBody must wrap its sections in three tabs: Setup / Health / Delivery.
// The Health tab is the default; switching tabs updates which panel is active.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Detail Panel — three-tab redesign', () => {
  it('renders the three tabs (Setup / Health / Delivery) with Health active by default', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P1', status: 'In Progress' });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'GCC';
    app.DetailPanel.open(proj.id);
    const html = app.window.document.getElementById('panelBody').innerHTML;
    expect(html).toMatch(/data-dp-tab-trigger="setup"/);
    expect(html).toMatch(/data-dp-tab-trigger="health"/);
    expect(html).toMatch(/data-dp-tab-trigger="delivery"/);
    // Default active tab = health.
    expect(app.DetailPanel.activeTab).toBe('health');
    // Each tab panel exists.
    expect(html).toMatch(/data-dp-tab="setup"/);
    expect(html).toMatch(/data-dp-tab="health"/);
    expect(html).toMatch(/data-dp-tab="delivery"/);
    app.teardown();
  });

  it('switchTab updates the active tab and shows that panel', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P1' });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'GCC';
    app.DetailPanel.open(proj.id);
    expect(app.DetailPanel.activeTab).toBe('health');
    app.DetailPanel.switchTab('setup');
    expect(app.DetailPanel.activeTab).toBe('setup');
    const setupPanel = app.window.document.querySelector('[data-dp-tab="setup"]');
    const healthPanel = app.window.document.querySelector('[data-dp-tab="health"]');
    expect(setupPanel).not.toBeNull();
    expect(healthPanel).not.toBeNull();
    expect(setupPanel.classList.contains('dp-tab-active')).toBe(true);
    expect(healthPanel.classList.contains('dp-tab-active')).toBe(false);
    app.teardown();
  });

  it('Setup tab carries identity + plan fields; Health tab carries RAG + EVM; Delivery tab carries phase points', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P1' });
    proj.size_total = 10;
    proj.size_engineering = 6;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'GCC';
    app.DetailPanel.open(proj.id);
    const setup = app.window.document.querySelector('[data-dp-tab="setup"]');
    const health = app.window.document.querySelector('[data-dp-tab="health"]');
    const delivery = app.window.document.querySelector('[data-dp-tab="delivery"]');
    expect(setup.innerHTML).toMatch(/Identity/);
    // Timeline section was removed in T9 — Start/End sprint now live in Delivery as a
    // read-only Sprint window (auto-populated by the solver).
    expect(setup.innerHTML).not.toMatch(/panel-section-title">Timeline</);
    expect(health.innerHTML).toMatch(/Status &amp; Health|Status & Health/);
    expect(delivery.innerHTML).toMatch(/Delivery Phases/);
    expect(delivery.innerHTML).toMatch(/Sprint window/);
    app.teardown();
  });
});
