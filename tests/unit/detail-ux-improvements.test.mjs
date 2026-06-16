// Detail-page UX (Workflow 2) — structural regressions for the shipped items.
// TASK-1: Status + RAG health co-located on Overview (no RAID Health echo).
// NAV-2: History renders inside the Overview tab panel only.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function openPanel() {
  const proj = makeProject({ id: 'P1', name: 'Demo', customer: 'Acme Industries', status: 'In Progress', rag_schedule: 'Amber' });
  const app = await loadApp(makeDataset({ projects: [proj], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
  app.App.setActiveCustomer('Acme Industries');
  app.DetailPanel.open('P1');
  return app;
}

describe('Detail TASK-1 — Status + Health co-located on Overview', () => {
  it('Overview has a "Status & Health" card with all three RAG dials; RAID has no Health section', async () => {
    const app = await openPanel();
    const overview = app.document.querySelector('[data-dp-tab="overview"]').innerHTML;
    const raid = app.document.querySelector('[data-dp-tab="raid"]').innerHTML;
    expect(overview).toMatch(/Status\s*(&amp;|&)\s*Health/);
    expect(overview).toMatch(/data-field="rag_schedule"/);
    expect(overview).toMatch(/data-field="rag_resourcing"/);
    expect(overview).toMatch(/data-field="rag_scope"/);
    expect(overview).toMatch(/data-field="status"/);
    // RAID no longer echoes a Health section title.
    expect(raid).not.toMatch(/panel-section-title[^>]*>Health\b/);
    app.teardown();
  });
});

describe('Detail NAV-2 — History lives in the Overview tab only', () => {
  it('the change-history section is inside the Overview panel and not at panel-body root', async () => {
    const app = await openPanel();
    const overview = app.document.querySelector('[data-dp-tab="overview"]');
    const others = ['delivery', 'value', 'sow', 'wireframe', 'billing', 'raid'].map(t => app.document.querySelector('[data-dp-tab="' + t + '"]').innerHTML).join('');
    expect(overview.innerHTML).toMatch(/data-section="change-history"|>History</);
    expect(others).not.toMatch(/data-section="change-history"/);
    app.teardown();
  });
});
