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

describe('F4 product form', () => {
  async function boot2() {
    const app = await loadApp(makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1' }], projects: [makeProject({ id: 'P1', name: 'Proj One', customer: 'Acme Industries' })] }));
    app.App.activeCustomer = 'Acme Industries';
    return app;
  }
  it('openForm() builds a blank form; save appends a product', async () => {
    const app = await boot2();
    app.Products._openForm();
    expect(app.document.getElementById('productFormOverlay')).toBeTruthy();
    app.document.getElementById('pfName').value = 'New App';
    app.document.getElementById('pfType').value = 'Dashboard';
    app.document.getElementById('pfOwner').value = 'Sam';
    app.document.getElementById('pfTech').value = 'React, Node';
    app.document.getElementById('pfVersions').value = 'v1.0, v0.9';
    app.document.getElementById('pfDescription').value = 'Desc';
    app.Products._saveForm();
    const rec = app.Products.list().find(p => p.name === 'New App');
    expect(rec).toBeTruthy();
    expect(rec.product_type).toBe('Dashboard');
    expect(rec.tech_stack).toEqual(['React', 'Node']);
    expect(rec.versions).toEqual(['v1.0', 'v0.9']);
    app.teardown();
  });
  it('openForm(id) pre-fills + edit updates; list length unchanged', async () => {
    const app = await boot2();
    const rec = app.Products.add({ name: 'Edit Me', product_type: 'Application', versions: ['v2'], tech_stack: ['Go'] });
    app.Products._openForm(rec.id);
    expect(app.document.getElementById('pfName').value).toBe('Edit Me');
    expect(app.document.getElementById('pfTech').value).toBe('Go');
    app.document.getElementById('pfName').value = 'Edited';
    app.Products._saveForm();
    expect(app.Products.byId(rec.id).name).toBe('Edited');
    expect(app.Products.list().length).toBe(1);
    app.teardown();
  });
  it('save rejects an empty name', async () => {
    const app = await boot2();
    app.Products._openForm();
    app.document.getElementById('pfName').value = '';
    app.Products._saveForm();
    expect(app.Products.list().length).toBe(0);
    app.Products._closeForm();
    app.teardown();
  });
  it('saving a product persists via saveToLocalStorage', async () => {
    const app = await boot2();
    let saved = 0;
    const orig = app.App.saveToLocalStorage; app.App.saveToLocalStorage = function () { saved++; return orig && orig.apply(this, arguments); };
    app.Products._openForm();
    app.document.getElementById('pfName').value = 'Persisted';
    app.Products._saveForm();
    expect(saved).toBeGreaterThan(0);
    expect(app.Products.list().some(p => p.name === 'Persisted')).toBe(true);
    app.App.saveToLocalStorage = orig;
    app.teardown();
  });
  it('edit form lists linked projects', async () => {
    const app = await boot2();
    const rec = app.Products.add({ name: 'Linked', product_type: 'Application' });
    app.App.data.projects[0].product_ids = [rec.id];
    app.Products._openForm(rec.id);
    expect(app.document.getElementById('productFormOverlay').textContent).toMatch(/Proj One/);
    app.Products._closeForm();
    app.teardown();
  });
  it('dismissTopModal (Esc) closes the product form', async () => {
    const app = await boot2();
    app.Products._openForm();
    expect(app.App.dismissTopModal()).toBe(true);
    expect(app.document.getElementById('productFormOverlay')).toBeFalsy();
    app.teardown();
  });
  it('customer mode hides the Add product button', async () => {
    const app = await boot2();
    app.App.customerMode = true;
    app.App.navigate('products');
    const host = app.document.getElementById('viewProducts');
    expect(host.innerHTML).not.toMatch(/Add product/);
    app.App.customerMode = false;
    app.teardown();
  });
});
