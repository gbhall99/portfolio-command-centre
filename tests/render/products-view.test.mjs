import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function boot() {
  const app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [makeProject({ id: 'P1', name: 'Proj One', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

describe('F3 products view', () => {
  it('nav has a Products item under Customer Profile; VIEW_SCOPE products=one', async () => {
    const app = await boot();
    expect(app.document.querySelector('.nav-item[data-view="products"]')).toBeTruthy();
    expect(app.App.VIEW_SCOPE.products).toBe('one');
    app.teardown();
  });
  it('navigate(products) renders a table of the customer products with a linked-project count', async () => {
    const app = await boot();
    const prod = app.Products.add({ name: 'Acme Portal', product_type: 'Application', versions: ['v2'], product_owner: 'Dana', tech_stack: ['React'] });
    app.App.data.projects[0].product_ids = [prod.id];
    app.App.navigate('products');
    const host = app.document.getElementById('viewProducts');
    expect(host.textContent).toMatch(/Acme Portal/);
    expect(host.textContent).toMatch(/Application/);
    expect(host.textContent).toMatch(/Dana/);
    expect(host.querySelector('[data-product-row]')).toBeTruthy();
    app.teardown();
  });
  it('empty state when no products', async () => {
    const app = await boot();
    app.App.navigate('products');
    expect(app.document.getElementById('viewProducts').textContent).toMatch(/No products/i);
    app.teardown();
  });
});
