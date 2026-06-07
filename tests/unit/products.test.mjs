import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const boot = (over = {}) => loadApp(makeDataset({
  customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }],
  projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
  ...over
}));

describe('F2 products model', () => {
  it('migration defaults data.products and project.product_ids', async () => {
    const app = await boot();
    expect(Array.isArray(app.App.data.products)).toBe(true);
    expect(Array.isArray(app.App.data.projects[0].product_ids)).toBe(true);
    app.teardown();
  });
  it('Products.add/list is customer-scoped; byId works', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    const rec = app.Products.add({ name: 'Acme Portal', product_type: 'Application' });
    expect(rec.id).toMatch(/^PRD-/);
    expect(rec.customer).toBe('Acme Industries');
    app.App.activeCustomer = 'Globex';
    app.Products.add({ name: 'Globex Dash', product_type: 'Dashboard' });
    expect(app.Products.list().map(p => p.name)).toEqual(['Globex Dash']);
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Products.list().map(p => p.name)).toEqual(['Acme Portal']);
    expect(app.Products.byId(rec.id).name).toBe('Acme Portal');
    app.teardown();
  });
  it('Products.remove strips the id from every project.product_ids', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    const rec = app.Products.add({ name: 'X', product_type: 'Application' });
    app.App.data.projects[0].product_ids = [rec.id];
    app.Products.remove(rec.id);
    expect(app.Products.byId(rec.id)).toBe(null);
    expect(app.App.data.projects[0].product_ids).toEqual([]);
    app.teardown();
  });
  it('linkedProjects returns projects whose product_ids include the product', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    const rec = app.Products.add({ name: 'Y', product_type: 'Application' });
    app.App.data.projects[0].product_ids = [rec.id];
    expect(app.Products.linkedProjects(rec.id).map(p => p.id)).toEqual(['P1']);
    app.teardown();
  });
});
