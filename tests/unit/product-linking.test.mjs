import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function boot() {
  const app = await loadApp(makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1' }], projects: [makeProject({ id: 'P1', name: 'Proj One', customer: 'Acme Industries' })] }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

describe('F5 project↔product linking', () => {
  it('the detail-panel strategy section renders a Products picker', async () => {
    const app = await boot();
    app.Products.add({ name: 'Portal', product_type: 'Application' });
    app.DetailPanel.open('P1');
    const panel = app.document.getElementById('detailPanel') || app.document.body;
    expect(panel.querySelector('[data-field="product_ids"]')).toBeTruthy();
    app.teardown();
  });
  it('onStrategyCheckboxChange writes product_ids', async () => {
    const app = await boot();
    const rec = app.Products.add({ name: 'Portal', product_type: 'Application' });
    app.DetailPanel.open('P1');
    app.DetailPanel.onStrategyCheckboxChange('product_ids', { checked: true, value: rec.id });
    expect(app.App.data.projects[0].product_ids).toContain(rec.id);
    app.DetailPanel.onStrategyCheckboxChange('product_ids', { checked: false, value: rec.id });
    expect(app.App.data.projects[0].product_ids).not.toContain(rec.id);
    app.teardown();
  });
});
