// Slot E — Item 11: remove add-action / add-decision UI from the Governance
// forum view. Project areas remain the authoring surfaces.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function bootWithForum() {
  const p = makeProject({ id: 'E1', name: 'P', customer: 'Acme Industries', governance_forum: 'Acme Forum' });
  const app = await loadApp(makeDataset({
    projects: [p],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    governance_forums: [{
      id: 'f1', name: 'Acme Forum', customer: 'Acme Industries',
      actions: [{ id: 'a1', description: 'Ship docs', owner: 'PO', due_date: '2026-06-01', status: 'Open', project_id: 'E1' }],
      decisions: [{ date: '2026-04-15', text: 'Approve Q2 plan', recordedBy: 'CFO', linkedProjects: ['E1'] }]
    }]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

describe('Slot E — Item 11: Governance forum is authoring-locked', () => {
  it('forum view does NOT render a "+ Add Action" button', async () => {
    const app = await bootWithForum();
    app.App.navigate('governance');
    const govView = app.document.getElementById('governanceView') || app.document.querySelector('[data-view="governance"]');
    // Render Governance via its public render method to populate the DOM.
    if (typeof app.Governance.render === 'function') app.Governance.render();
    const html = app.document.getElementById('govForumsContent').innerHTML;
    expect(html).not.toMatch(/Governance\.addAction\(/);
    expect(html).not.toMatch(/>\s*Add Action\s*</);
    app.teardown();
  });

  it('forum view does NOT render a "+ Add Decision" button or the show-decision-form trigger', async () => {
    const app = await bootWithForum();
    if (typeof app.Governance.render === 'function') app.Governance.render();
    const html = app.document.getElementById('govForumsContent').innerHTML;
    expect(html).not.toMatch(/Governance\.showDecisionForm\(/);
    expect(html).not.toMatch(/>\s*Add Decision\s*</);
    app.teardown();
  });

  it('forum view renders the read-only note pointing users to the project area', async () => {
    const app = await bootWithForum();
    if (typeof app.Governance.render === 'function') app.Governance.render();
    const content = app.document.getElementById('govForumsContent');
    expect(content.querySelector('[data-gov-readonly="actions"]')).toBeTruthy();
    expect(content.querySelector('[data-gov-readonly="decisions"]')).toBeTruthy();
    app.teardown();
  });

  it('existing forum actions + decisions still display when expanded', async () => {
    const app = await bootWithForum();
    if (typeof app.Governance.render === 'function') app.Governance.render();
    if (typeof app.Governance.toggle === 'function') app.Governance.toggle(0);
    const content = app.document.getElementById('govForumsContent');
    // Actions render inside editable <input> fields — check the value.
    const actionInputs = Array.from(content.querySelectorAll('input.action-desc-input, input[type="text"]'));
    const actionValues = actionInputs.map(i => i.value);
    expect(actionValues.some(v => v && v.indexOf('Ship docs') >= 0)).toBe(true);
    // Decisions render as plain text.
    expect(content.textContent).toContain('Approve Q2 plan');
    app.teardown();
  });

  it('Detail panel RAID tab still has the + Log Decision button (authoring path preserved)', async () => {
    const app = await bootWithForum();
    app.DetailPanel.open('E1');
    const raid = app.document.querySelector('[data-dp-tab="raid"]');
    expect(raid).toBeTruthy();
    expect(raid.innerHTML).toMatch(/onclick="DetailPanel\.addDecisionLog\(\)"/);
    app.teardown();
  });
});
