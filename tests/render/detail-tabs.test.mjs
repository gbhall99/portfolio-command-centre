// Detail Panel tab IA: Overview / Delivery / Value / SoW / Wireframe / Billing / RAID.
// The old combined "Scope & Value" tab split into Value (outcomes) + SoW
// (scope/milestones/stakeholders + the Statement of Work), with Wireframe and
// Billing as their own tabs. Legacy `scope`/`setup` keys alias to `value`/`sow`.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Detail Panel — tab IA', () => {
  it('renders the seven tabs with Overview active by default', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P1', status: 'In Progress' });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.open(proj.id);
    const html = app.window.document.getElementById('panelBody').innerHTML;
    ['overview', 'delivery', 'value', 'sow', 'wireframe', 'billing', 'raid'].forEach(id => {
      expect(html).toMatch(new RegExp('data-dp-tab-trigger="' + id + '"'));
      expect(html).toMatch(new RegExp('data-dp-tab="' + id + '"'));
    });
    expect(app.DetailPanel.activeTab).toBe('overview');
    app.teardown();
  });

  it('switchTab updates the active tab; legacy scope/setup keys alias to value/sow', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P1' });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.open(proj.id);
    expect(app.DetailPanel.activeTab).toBe('overview');
    app.DetailPanel.switchTab('value');
    expect(app.DetailPanel.activeTab).toBe('value');
    const valuePanel = app.window.document.querySelector('[data-dp-tab="value"]');
    const overviewPanel = app.window.document.querySelector('[data-dp-tab="overview"]');
    expect(valuePanel.classList.contains('dp-tab-active')).toBe(true);
    expect(overviewPanel.classList.contains('dp-tab-active')).toBe(false);
    // Legacy aliases for back-compat.
    app.DetailPanel.switchTab('scope');
    expect(app.DetailPanel.activeTab).toBe('value');
    app.DetailPanel.switchTab('setup');
    expect(app.DetailPanel.activeTab).toBe('sow');
    app.teardown();
  });

  it('Value carries outcomes; SoW carries scope + the Statement of Work; Billing carries commercials', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P1' });
    proj.size_total = 10;
    proj.size_engineering = 6;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.open(proj.id);
    const q = (id) => app.window.document.querySelector('[data-dp-tab="' + id + '"]').innerHTML;
    // Overview keeps Status & Health + Identity + Prioritisation.
    expect(q('overview')).toMatch(/panel-section-title[^>]*>Status &amp; Health/);
    expect(q('overview')).toMatch(/panel-section-title[^>]*>Prioritisation</);
    expect(q('delivery')).toMatch(/Delivery Phases/);
    // Value = outcomes only (Strategy linkage + Benefits + Success criteria), NO scope/Identity.
    expect(q('value')).toMatch(/Strategy linkage/);
    expect(q('value')).toMatch(/Benefits/);
    expect(q('value')).toMatch(/Success criteria/);
    expect(q('value')).not.toMatch(/Statement of Work/);
    // SoW = scope info (Milestones & Dates, Stakeholders) + the Statement of Work.
    expect(q('sow')).toMatch(/Milestones &amp; Dates/);
    expect(q('sow')).toMatch(/Stakeholders/);
    expect(q('sow')).toMatch(/Statement of Work/);
    // Wireframe + Billing are their own tabs.
    expect(q('wireframe')).toMatch(/Wireframes/);
    expect(q('billing')).toMatch(/Billing &amp; commercials/);
    // RAID unchanged.
    expect(q('raid')).toMatch(/panel-section-title[^>]*>Blockers</);
    app.teardown();
  });
});
