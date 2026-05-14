// Slot A — Items 12 (pill overlap), 13 (MoSCoW help), 10 (status own tile).
// Plan: plans/post-launch-ui-fixes.md.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function bootWithProject(extra = {}) {
  const p = makeProject(Object.assign({ id: 'A1', name: 'P', customer: 'Acme Industries' }, extra));
  const app = await loadApp(makeDataset({
    projects: [p],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return { app, p };
}

describe('Slot A — Item 12: customer pill / manager overlap', () => {
  it('badge CSS includes overflow:hidden + text-overflow:ellipsis + max-width', async () => {
    const app = await loadApp(makeDataset({
      projects: [], customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    // Read the inline <style> block and assert the rules exist.
    const css = app.window.document.querySelectorAll('style');
    let combined = '';
    css.forEach(s => combined += s.textContent || '');
    expect(combined).toMatch(/\.badge[^{]*\{[^}]*overflow:\s*hidden/);
    expect(combined).toMatch(/\.badge[^{]*\{[^}]*text-overflow:\s*ellipsis/);
    expect(combined).toMatch(/\.badge[^{]*\{[^}]*max-width:\s*100%/);
    expect(combined).toMatch(/\.project-table td \.badge-customer/);
    app.teardown();
  });
});

describe('Slot A — Item 13: MoSCoW field-help popover', () => {
  it('Prioritisation section renders a help button next to the MoSCoW label', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('A1');
    // User-IA-rev: Prioritisation moved from Scope to Overview.
    const overview = app.document.querySelector('[data-dp-tab="overview"]');
    const btn = overview.querySelector('.field-help-btn[data-field="moscow"]');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('?');
    expect(btn.getAttribute('aria-label')).toMatch(/MoSCoW/i);
    app.teardown();
  });

  it('clicking the help button opens a popover with 4 list items (Must/Should/Could/Won\'t)', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('A1');
    app.DetailPanel._showFieldHelp('moscow');
    const pop = app.document.getElementById('dpFieldHelpPopover');
    expect(pop).toBeTruthy();
    expect(pop.dataset.field).toBe('moscow');
    const items = pop.querySelectorAll('li');
    expect(items.length).toBe(4);
    const text = pop.textContent;
    expect(text).toMatch(/Must/);
    expect(text).toMatch(/Should/);
    expect(text).toMatch(/Could/);
    expect(text).toMatch(/Won/); // Won't apostrophe rendering varies
    app.teardown();
  });

  it('clicking the help button a second time closes the popover (toggle)', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('A1');
    app.DetailPanel._showFieldHelp('moscow');
    expect(app.document.getElementById('dpFieldHelpPopover')).toBeTruthy();
    app.DetailPanel._showFieldHelp('moscow');
    expect(app.document.getElementById('dpFieldHelpPopover')).toBeFalsy();
    app.teardown();
  });

  it('Close button dismisses the popover', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('A1');
    app.DetailPanel._showFieldHelp('moscow');
    app.DetailPanel._closeFieldHelp();
    expect(app.document.getElementById('dpFieldHelpPopover')).toBeFalsy();
    app.teardown();
  });
});

describe('Slot A — Item 10: Walkthrough status tile separated from Health', () => {
  it('Walkthrough renders a [data-wt-tile="status"] tile with an <h6>Status</h6>', async () => {
    const { app } = await bootWithProject();
    app.Walkthrough.open('Acme Industries');
    app.Walkthrough.selectProject('A1');
    const statusTile = app.document.querySelector('[data-wt-tile="status"]');
    expect(statusTile).toBeTruthy();
    const heading = statusTile.querySelector('h6');
    expect(heading).toBeTruthy();
    expect(heading.textContent).toBe('Status');
    expect(statusTile.querySelector('.wt-status-sel')).toBeTruthy();
    app.teardown();
  });

  it('Health tile no longer contains the status select', async () => {
    const { app } = await bootWithProject();
    app.Walkthrough.open('Acme Industries');
    app.Walkthrough.selectProject('A1');
    const health = app.document.querySelector('[data-wt-tile="health"]');
    expect(health).toBeTruthy();
    expect(health.querySelector('.wt-status-sel')).toBeFalsy();
    expect(health.textContent).toMatch(/Health/);
    app.teardown();
  });
});
