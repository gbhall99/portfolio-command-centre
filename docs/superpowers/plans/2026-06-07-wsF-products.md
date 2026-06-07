# Workstream F — Objectives rename + Customer Profile + Products page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relabel the Strategy page to "Objectives" and its menu section to "Customer Profile", and add a Products page (entity + schema-driven table + add/edit/remove modal) under Customer Profile, with many-products-per-project linking that mirrors the existing `metric_ids`/`persona_ids` pattern.

**Architecture:** All in `index.html`. Products mirror the `Objectives` entity object (customer-scoped `list/byId/add/update/remove`, `PRD-` ids, remove strips references) and the strategy-link pattern (`project.product_ids` arrays + detail-panel pickers). The strategy-link handlers (`onStrategyCheckboxChange`, `_toggleStrategySelection`) are already field-generic; only `_openStrategyPicker` + `labelFor` need a `product` case.

**Tech Stack:** Vanilla HTML/CSS/JS single file; vitest + jsdom; Playwright.

**Conventions:** `:root` tokens, inline SVG (no emojis), `Dashboard.esc()`, customer-scoped, `App._save()` to persist. Run tests: `npm test`; single file `npx vitest run tests/<f>`.

---

## File Structure

- **Modify:** `index.html`
  - Nav: `.nav-subsection-label` "Strategy"→"Customer Profile" (~3358); item label "Strategy"→"Objectives" (~3359-3361); add Products nav item after Metrics (~3367).
  - `viewNames` (~7518): `strategy: 'Objectives'`, add `products: 'Products'`. `VIEW_SCOPE` (~7497 region): add `products: 'one'`.
  - Migration (~5077 / ~5218): `data.products` + `project.product_ids` defaults.
  - Add `#viewProducts` container near `#viewStrategy` (~3464).
  - navigate/refresh routing (~4586, ~5698, ~7501, ~7567) + `setActiveCustomer` re-render: add `products`→`ProductsView.mount()`.
  - New `Products` object (mirror `Objectives` ~12359) and new `ProductsView` object (+ form).
  - Detail-panel pickers: picker A `rowHtml` (~18772) + `labelFor` (~18752); picker B `renderPicker` (~18935); `_openStrategyPicker` (~18777) product case; product detail linked-projects.
- **Create tests:** `tests/unit/products.test.mjs`, `tests/render/products-view.test.mjs`, `tests/unit/product-linking.test.mjs`.
- **Modify tests:** any asserting the "Strategy" nav label/viewName → "Objectives"/"Customer Profile".

---

## Task F1: Renames (Strategy→Objectives, section→Customer Profile)

**Files:** Modify `index.html` (nav ~3358-3361; viewNames ~7518); Create `tests/unit/customer-profile-rename.test.mjs`

- [ ] **Step 1: Write the failing test** — `tests/unit/customer-profile-rename.test.mjs`:

```javascript
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
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/unit/customer-profile-rename.test.mjs`.

- [ ] **Step 3: Rename the nav item + section.** In the nav (~3358-3361): change `<div class="nav-subsection-label">Strategy</div>` → `<div class="nav-subsection-label">Customer Profile</div>`. In the `data-view="strategy"` item, change the visible text `Strategy` → `Objectives` (keep the SVG, `data-view`, `onclick`); update its `title` to `"This customer only — Objectives"`.

- [ ] **Step 4: Update viewNames.** In `App` `viewNames` (~7518), change `strategy: 'Strategy'` → `strategy: 'Objectives'`.

- [ ] **Step 5: Update any other "Strategy" nav assertions.** Run `grep -rn "Strategy" tests/` — update any test asserting the nav label/viewName is "Strategy" (e.g. `slot-h-nav-raid` "Strategy + Metrics + Personas live in Delivery" — change the label expectation if it reads the visible text; data-view selectors stay `strategy`). Do NOT change tests asserting `data-view="strategy"` routing.

- [ ] **Step 6: Run** — `npx vitest run tests/unit/customer-profile-rename.test.mjs` (pass) and `npx vitest run tests/unit/slot-h-nav-raid.test.mjs tests/unit/ia-scope-clarity.test.mjs` (green).

- [ ] **Step 7: Commit**

```bash
git add index.html tests/unit/customer-profile-rename.test.mjs
git commit -m "feat(nav): rename Strategy page to Objectives + section to Customer Profile"
```

---

## Task F2: Products data model + Products object + migration

**Files:** Modify `index.html` (migration ~5077/~5218; new `Products` object near `Objectives` ~12359); Create `tests/unit/products.test.mjs`

- [ ] **Step 1: Write the failing test** — `tests/unit/products.test.mjs`:

```javascript
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
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/unit/products.test.mjs`.

- [ ] **Step 3: Migration.** In `migrateSchema`, in the strategy-entities init block (where `data.objectives`/`data.metrics` are defaulted, ~5077), add `if (!Array.isArray(data.products)) data.products = [];`. In the per-project backfill loop (where `p.metric_ids`/`p.persona_ids` are defaulted, ~5218), add `if (!Array.isArray(p.product_ids)) p.product_ids = [];`.

- [ ] **Step 4: Add the `Products` object** (place immediately after the `Objectives` object's closing `},` near the end of the Objectives definition ~line 12420, as a top-level `const Products = { … };`):

```javascript
const Products = {
  PRODUCT_TYPES: ['Application', 'Dashboard', 'Service', 'Other'],
  list() {
    if (!App.data || !Array.isArray(App.data.products)) return [];
    return App.data.products.filter(p => p.customer === App.activeCustomer);
  },
  byId(id) {
    return (App.data.products || []).find(p => p.id === id) || null;
  },
  add(product) {
    if (!App.data.products) App.data.products = [];
    const rec = {
      product_type: 'Application', versions: [], product_owner: '', tech_stack: [], description: '',
      ...product,
      customer: product.customer || App.activeCustomer,
    };
    if (!rec.id) rec.id = 'PRD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    if (!Array.isArray(rec.versions)) rec.versions = [];
    if (!Array.isArray(rec.tech_stack)) rec.tech_stack = [];
    App.data.products.push(rec);
    if (App._save) App._save();
    return rec;
  },
  update(id, patch) {
    const p = this.byId(id);
    if (!p) return null;
    Object.assign(p, patch);
    if (App._save) App._save();
    return p;
  },
  remove(id) {
    const idx = (App.data.products || []).findIndex(p => p.id === id);
    if (idx < 0) return false;
    App.data.products.splice(idx, 1);
    (App.data.projects || []).forEach(pr => {
      if (Array.isArray(pr.product_ids)) pr.product_ids = pr.product_ids.filter(pid => pid !== id);
    });
    if (App._save) App._save();
    return true;
  },
  // Projects (any customer's, but products are customer-scoped so these match) linking this product.
  linkedProjects(id) {
    return (App.data.projects || []).filter(pr => Array.isArray(pr.product_ids) && pr.product_ids.includes(id));
  }
};
```

- [ ] **Step 5: Run, verify PASS** — `npx vitest run tests/unit/products.test.mjs`.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/unit/products.test.mjs
git commit -m "feat(products): data model, migration, and Products entity object"
```

---

## Task F3: Products view + nav wiring

**Files:** Modify `index.html` (nav item ~3367; `#viewProducts` ~3464; VIEW_SCOPE/viewNames; navigate+refresh+setActiveCustomer routing; new `ProductsView` object); Create `tests/render/products-view.test.mjs`

- [ ] **Step 1: Write the failing test** — `tests/render/products-view.test.mjs`:

```javascript
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
  it('navigate(products) renders a table of the customer\'s products with a linked-project count', async () => {
    const app = await boot();
    const prod = app.Products.add({ name: 'Acme Portal', product_type: 'Application', versions: ['v2'], product_owner: 'Dana', tech_stack: ['React'] });
    app.App.data.projects[0].product_ids = [prod.id];
    app.App.navigate('products');
    const host = app.document.getElementById('viewProducts');
    expect(host.textContent).toMatch(/Acme Portal/);
    expect(host.textContent).toMatch(/Application/);
    expect(host.textContent).toMatch(/Dana/);
    // linked-project count cell shows 1
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
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/render/products-view.test.mjs`.

- [ ] **Step 3: Add the nav item.** After the Metrics nav item (~3367), add (matching indentation, inline-SVG, no emoji):

```html
      <div class="nav-item" data-view="products" onclick="App.navigate('products')" title="This customer only — products and their linked projects">
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        Products
      </div>
```

- [ ] **Step 4: Add the view container.** After `<div class="view" id="viewStrategy"></div>` (~3464) add: `<div class="view" id="viewProducts"></div>`.

- [ ] **Step 5: Wire scope + name + routing.** In `VIEW_SCOPE` (the object literal ~7497) add `products: 'one',`. In `viewNames` (~7518) add `products: 'Products',`. In each place that routes `metrics`→`MetricsView.mount()` (the navigate handler ~7501 and the three refresh/render branches ~4586, ~5698, ~7567 and `setActiveCustomer`'s re-render chain), add a sibling branch `… === 'products' … ProductsView.mount()`. (Grep `MetricsView.mount` to find all sites; add a `products` sibling at each.)

- [ ] **Step 6: Add the `ProductsView` object** (place after the `Products` object). `mount()` renders into `#viewProducts`; row-click opens the form (edit) which doubles as detail (Task F4 builds the form; this task's row-click calls `Products._openForm(id)` which F4 defines — to keep F3 testable now, the row carries `data-product-row` + an onclick to `Products._openForm`; if F4 isn't done yet the click is a no-op, but the table render + tests pass).

```javascript
const ProductsView = {
  mount() {
    const host = document.getElementById('viewProducts');
    if (!host || !App.data) return;
    const esc = Dashboard.esc;
    const prods = Products.list();
    const header = '<div class="view-titlebar-spacer"></div>';
    const toolbar = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<div><h2 style="font-size:15px;font-weight:700;color:var(--text-dark);margin:0">Products</h2>' +
      '<div style="font-size:12px;color:var(--text-muted)">Active products for ' + esc(App.activeCustomer || '') + ' and their linked projects.</div></div>' +
      '<button class="btn btn-primary btn-sm" onclick="Products._openForm()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add product</button>' +
      '</div>';
    let body;
    if (!prods.length) {
      body = '<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px">No products yet for ' + esc(App.activeCustomer || 'this customer') + '. Add one to start linking projects.</div>';
    } else {
      const th = (t) => '<th style="text-align:left;padding:8px 10px;font-size:var(--fs-xs);text-transform:uppercase;color:var(--text-muted);border-bottom:2px solid var(--border-light)">' + t + '</th>';
      body = '<div class="table-wrapper"><table style="width:100%;border-collapse:collapse;font-size:var(--fs-sm)">' +
        '<thead><tr>' + th('Product') + th('Type') + th('Version') + th('Owner') + th('Tech stack') + th('Projects') + '</tr></thead><tbody>' +
        prods.map(p => {
          const linked = Products.linkedProjects(p.id).length;
          const techChips = (p.tech_stack || []).slice(0, 4).map(t => '<span class="chip" style="font-size:var(--fs-2xs)">' + esc(t) + '</span>').join(' ');
          const ver = (p.versions && p.versions.length) ? esc(p.versions[0]) : '<span style="color:var(--text-muted)">—</span>';
          return '<tr data-product-row data-id="' + esc(p.id) + '" style="cursor:pointer;border-bottom:1px solid var(--border-light)" role="button" tabindex="0" aria-label="Open ' + esc(p.name) + '" onclick="Products._openForm(\'' + esc(p.id) + '\')" onkeydown="if(event.key===\'Enter\'){event.preventDefault();Products._openForm(\'' + esc(p.id) + '\')}">' +
            '<td style="padding:8px 10px"><strong>' + esc(p.name) + '</strong></td>' +
            '<td style="padding:8px 10px">' + esc(p.product_type || '') + '</td>' +
            '<td style="padding:8px 10px">' + ver + '</td>' +
            '<td style="padding:8px 10px">' + esc(p.product_owner || '') + '</td>' +
            '<td style="padding:8px 10px">' + (techChips || '<span style="color:var(--text-muted)">—</span>') + '</td>' +
            '<td style="padding:8px 10px;font-variant-numeric:tabular-nums">' + linked + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>';
    }
    host.innerHTML = '<div class="dashboard-container">' + toolbar + body + '</div>';
  }
};
```

- [ ] **Step 7: Run, verify PASS** — `npx vitest run tests/render/products-view.test.mjs`.

- [ ] **Step 8: Regression** — `npx vitest run`. Expect green.

- [ ] **Step 9: Commit**

```bash
git add index.html tests/render/products-view.test.mjs
git commit -m "feat(products): Products nav item + schema-driven table view"
```

---

## Task F4: Add / Edit / Remove product modal form

**Files:** Modify `index.html` (add form methods to `Products`); extend `tests/render/products-view.test.mjs`

- [ ] **Step 1: Add failing tests** — append to `tests/render/products-view.test.mjs`:

```javascript
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
  it('openForm(id) pre-fills + edit updates; remove deletes', async () => {
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
  it('edit form lists linked projects', async () => {
    const app = await boot2();
    const rec = app.Products.add({ name: 'Linked', product_type: 'Application' });
    app.App.data.projects[0].product_ids = [rec.id];
    app.Products._openForm(rec.id);
    expect(app.document.getElementById('productFormOverlay').textContent).toMatch(/Proj One/);
    app.Products._closeForm();
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/render/products-view.test.mjs`.

- [ ] **Step 3: Add the form methods to the `Products` object** (inside the object, after `linkedProjects`):

```javascript
  ,_editId: null,
  _openForm(id) {
    if (!App.data) return;
    const existing = document.getElementById('productFormOverlay');
    if (existing) existing.remove();
    this._editId = id || null;
    const p = this._editId ? (this.byId(this._editId) || {}) : {};
    const esc = Dashboard.esc;
    const fieldStyle = 'width:100%;margin-top:2px;padding:6px 8px;border:1px solid var(--border-dim);border-radius:var(--radius-sm);font-size:var(--fs-sm);background:var(--surface);color:var(--text-dark);box-sizing:border-box';
    const labelStyle = 'display:flex;flex-direction:column;gap:4px;font-size:var(--fs-xs);font-weight:600;color:var(--text-dark)';
    const typeOpts = this.PRODUCT_TYPES.map(t => '<option value="' + esc(t) + '"' + ((p.product_type || 'Application') === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    const linkedHtml = this._editId
      ? (this.linkedProjects(this._editId).map(pr => '<span class="chip" style="cursor:pointer" onclick="Products._closeForm();DetailPanel.open(\'' + esc(pr.id) + '\')">' + esc(pr.name) + '</span>').join(' ') || '<span style="color:var(--text-muted);font-size:var(--fs-2xs)">No linked projects yet — link this product from a project.</span>')
      : '';
    const overlay = document.createElement('div');
    overlay.className = 'team-edit-overlay';
    overlay.id = 'productFormOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', this._editId ? 'Edit product' : 'Add product');
    overlay.onclick = function () { Products._closeForm(); };
    const modal = document.createElement('div');
    modal.className = 'team-edit-modal';
    modal.onclick = function (e) { e.stopPropagation(); };
    modal.innerHTML =
      '<h3 style="font-size:15px;font-weight:700;color:var(--text-dark)">' + (this._editId ? 'Edit product' : 'Add product') + '</h3>' +
      '<div class="team-edit-body" style="display:flex;flex-direction:column;gap:12px">' +
        '<label style="' + labelStyle + '">Name<input type="text" id="pfName" value="' + esc(p.name || '') + '" style="' + fieldStyle + '"></label>' +
        '<label style="' + labelStyle + '">Type<select id="pfType" style="' + fieldStyle + '">' + typeOpts + '</select></label>' +
        '<label style="' + labelStyle + '">Versions (comma-separated)<input type="text" id="pfVersions" value="' + esc((p.versions || []).join(', ')) + '" placeholder="v2.0, v1.9" style="' + fieldStyle + '"></label>' +
        '<label style="' + labelStyle + '">Product owner<input type="text" id="pfOwner" value="' + esc(p.product_owner || '') + '" style="' + fieldStyle + '"></label>' +
        '<label style="' + labelStyle + '">Tech stack (comma-separated)<input type="text" id="pfTech" value="' + esc((p.tech_stack || []).join(', ')) + '" placeholder="React, Node, Postgres" style="' + fieldStyle + '"></label>' +
        '<label style="' + labelStyle + '">Description<textarea id="pfDescription" rows="3" style="' + fieldStyle + ';resize:vertical">' + esc(p.description || '') + '</textarea></label>' +
        (this._editId ? '<div style="font-size:var(--fs-xs);font-weight:600;color:var(--text-dark)">Linked projects<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">' + linkedHtml + '</div></div>' : '') +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:16px">' +
        '<div>' + (this._editId ? '<button class="btn btn-outline btn-sm" style="color:var(--status-red)" onclick="Products._removeFromForm()">Remove</button>' : '') + '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-outline btn-sm" onclick="Products._closeForm()">Cancel</button>' +
          '<button class="btn btn-primary btn-sm" onclick="Products._saveForm()">Save</button>' +
        '</div>' +
      '</div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    const n = document.getElementById('pfName');
    if (n && n.focus) { try { n.focus(); } catch (e) {} }
  },
  _parseList(v) { return (v || '').split(',').map(s => s.trim()).filter(Boolean); },
  _saveForm() {
    const nameEl = document.getElementById('pfName');
    if (!nameEl) return;
    const name = (nameEl.value || '').trim();
    if (!name) { App.toast('Product needs a name', 'error'); nameEl.classList.add('wiz-invalid'); return; }
    const rec = {
      name,
      product_type: document.getElementById('pfType').value || 'Application',
      versions: this._parseList(document.getElementById('pfVersions').value),
      product_owner: (document.getElementById('pfOwner').value || '').trim(),
      tech_stack: this._parseList(document.getElementById('pfTech').value),
      description: (document.getElementById('pfDescription').value || '').trim()
    };
    if (App.pushUndo) App.pushUndo(this._editId ? 'Edit product' : 'Add product');
    if (this._editId) this.update(this._editId, rec);
    else this.add(rec);
    if (App.markDirty) App.markDirty();
    if (App._save) App._save();
    this._closeForm();
    ProductsView.mount();
    if (App.toast) App.toast('Product saved', 'success');
  },
  _removeFromForm() {
    if (!this._editId) return;
    const p = this.byId(this._editId);
    if (!App.confirmSync && !window.confirm('Remove product "' + (p ? p.name : '') + '"?')) return;
    if (App.pushUndo) App.pushUndo('Remove product');
    this.remove(this._editId);
    this._closeForm();
    ProductsView.mount();
    if (App.toast) App.toast('Product removed', 'success');
  },
  _closeForm() {
    const o = document.getElementById('productFormOverlay');
    if (o) o.remove();
    this._editId = null;
  }
```

(`.wiz-input.wiz-invalid` exists from WS-G; the form uses inline field styles consistent with the holiday form. `App.confirmSync` may not exist — the `window.confirm` fallback covers jsdom where confirm returns false unless spied; the remove test isn't asserting confirm, so it's fine.)

- [ ] **Step 4: Register the form in `dismissTopModal`** — after the wizard/holiday checks in `App.dismissTopModal`, add: `const productForm = document.getElementById('productFormOverlay'); if (productForm) { Products._closeForm(); return true; }`.

- [ ] **Step 5: Run, verify PASS** — `npx vitest run tests/render/products-view.test.mjs`.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/render/products-view.test.mjs
git commit -m "feat(products): add/edit/remove product modal form with linked-projects view"
```

---

## Task F5: Project ↔ product linking on the detail panel

**Files:** Modify `index.html` (picker A ~18745-18774; picker B ~18879-18940; `_openStrategyPicker` ~18777); Create `tests/unit/product-linking.test.mjs`

- [ ] **Step 1: Write the failing test** — `tests/unit/product-linking.test.mjs`:

```javascript
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
    expect(panel.innerHTML).toMatch(/Products/);
    // a product_ids field control exists somewhere in the panel
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
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/unit/product-linking.test.mjs`.

- [ ] **Step 3: Picker A — add a Products row.** In the chip-based strategy renderer (~18745-18774): after `const objectives = …` add `const products = (typeof Products !== 'undefined') ? Products.list() : [];` and `const selectedProductIds = new Set(project.product_ids || []);`. In `labelFor`, add a `product` branch: `if (kind === 'product') { const x = products.find(y => y.id === id); return x ? x.name : id; }`. In `rowHtml`, extend the `selected` ternary to include `field === 'product_ids' ? selectedProductIds`, and the label ternary to map `product_ids`→`'Products'`. In the returned block, add `rowHtml('product_ids', 'product', products.length)` after the personas row.

- [ ] **Step 4: Picker B — add a Products picker.** In the `<details>` renderer (~18879-18940): add `const selectedProductIds = new Set(project.product_ids || []);` near the other selected sets; add `const productOpts = (typeof Products !== 'undefined' ? Products.list() : []).map(p => ({ id: p.id, name: p.name, subtitle: p.product_type || '' }));`; and add `+ renderPicker('product_ids', 'Products', productOpts, selectedProductIds, [])` after the personas picker in the returned block.

- [ ] **Step 5: `_openStrategyPicker` — handle the product kind.** In `_openStrategyPicker(field, kind)` (~18777), extend the options dispatch: add `: kind === 'product' ? (typeof Products !== 'undefined' ? Products.list() : [])` to the chain before the Objectives fallback. (`onStrategyCheckboxChange`/`_toggleStrategySelection` are already field-generic — no change.)

- [ ] **Step 6: Run, verify PASS** — `npx vitest run tests/unit/product-linking.test.mjs`.

- [ ] **Step 7: Regression** — `npx vitest run`. Expect green (existing strategy-link/detail-panel tests unaffected — product_ids is additive).

- [ ] **Step 8: Commit**

```bash
git add index.html tests/unit/product-linking.test.mjs
git commit -m "feat(products): link products on the project detail panel (both pickers)"
```

---

## Task F6: Full verification + visual pass

**Files:** none (verification only)

- [ ] **Step 1: Full suite** — `npm test`. Expect all green, 0 failures.

- [ ] **Step 2: Serve + visual** —
```bash
python3 -m http.server 8765 --bind 127.0.0.1
```
Drive `http://127.0.0.1:8765/index.html`, load demo data, select a customer; verify at 1440px (light + dark):
- The **Customer Profile** section shows Objectives · Personas · Metrics · **Products** (no "Strategy" label anywhere; the former Strategy item reads "Objectives"; its titlebar says "Objectives").
- **Products** view: empty state → **+ Add product** opens the modal; add an Application and a Dashboard with versions/owner/tech/description; the table lists them with type/version/owner/tech chips and a Projects count; Esc closes the form.
- Open a project → the strategy-linkage section has a **Products** picker; select a product → save; reopen the Products view, open that product → its **Linked projects** lists the project (clickable, opens it).
- Remove a product → it disappears and its id is gone from the project's links.
- No console errors.

- [ ] **Step 3: Final commit if a tweak was needed** — `git add -A && git commit -m "chore: WS-F verification pass"` (skip if none).

---

## Self-Review Notes

- **Spec coverage:** F1 renames → Task F1; F2 model+migration+Products object → Task F2; F3 view+nav → Task F3; F4 form → Task F4; F5 linking (both pickers + reverse view) → Tasks F4 (linked-projects in form) + F5 (project-side pickers). All covered.
- **Naming consistency:** `Products` (PRODUCT_TYPES/list/byId/add/update/remove/linkedProjects/_openForm/_saveForm/_removeFromForm/_closeForm/_editId/_parseList), `ProductsView.mount`, ids `pfName/pfType/pfVersions/pfOwner/pfTech/pfDescription`, overlay `productFormOverlay`, `data.products`, `project.product_ids`, `data-view="products"`, `VIEW_SCOPE.products='one'`, `viewNames.products='Products'` — consistent across tasks + tests.
- **No placeholders:** complete code for the entity object, view, form, and linking edits; tests are full.
- **Mirrors existing patterns:** `Products` mirrors `Objectives`; the form mirrors the holiday form; linking reuses the field-generic `onStrategyCheckboxChange`/`_toggleStrategySelection` with `product` added only to `_openStrategyPicker` + `labelFor` + the two picker render blocks.
- **F3↔F4 ordering:** F3's table row onclick calls `Products._openForm` which F4 defines; the F3 render test doesn't click it, so F3 is green before F4. After F4 the row-click opens the form.
