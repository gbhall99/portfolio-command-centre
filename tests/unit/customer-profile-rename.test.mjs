import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const boot = () => loadApp(makeDataset({ projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));

describe('F1 renames', () => {
  it('nav item formerly "Strategy" now reads "Objectives" (data-view kept)', async () => {
    const app = await boot();
    const item = app.document.querySelector('.nav-item[data-view="strategy"]');
    expect(item).toBeTruthy();
    expect(item.textContent).toMatch(/Objectives/);
    expect(item.textContent).not.toMatch(/Strategy/);
    app.teardown();
  });
  it('the section label is "Customer Profile"', async () => {
    const app = await boot();
    const labels = Array.from(app.document.querySelectorAll('.nav-subsection-label')).map(l => l.textContent.trim());
    expect(labels).toContain('Customer Profile');
    expect(labels).not.toContain('Strategy');
    app.teardown();
  });
  it('viewNames maps strategy → Objectives', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('strategy');
    expect(app.document.getElementById('viewTitlebarName').textContent).toBe('Objectives');
    app.teardown();
  });
});
