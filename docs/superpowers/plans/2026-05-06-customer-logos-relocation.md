# Customer Logos Relocation — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** Move customer logos from Branding card to Customers card; rename Branding → "White-labelling"; rename Settings tile "Display & branding" → "Display & white-labelling".

**Spec:** `docs/superpowers/specs/2026-05-06-customer-logos-relocation-design.md`

**Reference points:**
- `_renderCustomersCard` (extracted in earlier work) — Customers config table
- `_renderBrandingCard` — Branding card (logo control to remove)
- `App.setBranding(customer, opts)` — existing write API
- `App.CONFIG_CATEGORIES` registry — `display` category with label "Display & branding"

## Task 1: Add `App.setCustomerLogo` helper

**Files:**
- Modify: `index.html` near `App.setBranding`
- Modify: `tests/unit/customer-logos.test.mjs` (new)

- [ ] **Step 1: Failing unit test**

Create `tests/unit/customer-logos.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('App.setCustomerLogo', () => {
  it('exists and writes to data.customers[i].logo', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    expect(typeof app.App.setCustomerLogo).toBe('function');
    app.App.setCustomerLogo('GCC', 'https://example.com/logo.png');
    const c = (app.App.data.customers || []).find(x => x.name === 'GCC');
    expect(c).toBeTruthy();
    expect(c.logo).toBe('https://example.com/logo.png');
    app.teardown();
  });

  it('empty value clears the logo', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.setCustomerLogo('GCC', 'https://example.com/logo.png');
    app.App.setCustomerLogo('GCC', '');
    const c = (app.App.data.customers || []).find(x => x.name === 'GCC');
    expect(c.logo).toBe('');
    app.teardown();
  });
});
```

- [ ] **Step 2: Implement helper**

Find `App.setBranding(` in `index.html`. Just below it, add this property to the `App` object literal:

```javascript
  setCustomerLogo(customerName, logoUrl) {
    return this.setBranding(customerName, { logo: logoUrl == null ? '' : String(logoUrl) });
  },
```

(One-line wrapper. The existing `setBranding` handles dirty + save + customer lookup.)

- [ ] **Step 3: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 4: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/unit/customer-logos.test.mjs
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(settings): App.setCustomerLogo wrapper"
```

---

## Task 2: Customers card gains a Logo column + inline editor

**Files:**
- Modify: `index.html` `_renderCustomersCard` and add `App._openLogoEditor` / `App._commitLogoEditor`

- [ ] **Step 1: Add the column**

In `_renderCustomersCard`, locate the table header and rows. Add a `<th>Logo</th>` column header between Stale and Sponsors (or before Actions if Sponsors hasn't shipped yet).

In the per-row template, render a 24×24 thumbnail when `c.logo` is non-empty (an `<img>` with click handler `App._openLogoEditor(name)`). Otherwise render a small "Set logo…" button calling the same handler. Use `Dashboard.esc` on customer name and on logo URL.

- [ ] **Step 2: Add `_openLogoEditor` + `_commitLogoEditor` helpers**

Append to `App`. Build the modal via the same string-concat pattern as the existing audit/scenario modals (overlay div with fixed positioning, z-index 9000, body containing a textarea and Cancel/Remove/Save buttons). The textarea preloads the existing `c.logo`. Save calls `App.setCustomerLogo(customerName, textareaValue)`. Remove calls `setCustomerLogo(customerName, '')`. Both close the overlay then call `App.renderConfig()` to refresh the Customers card.

Use `id="logoEditorOverlay"` and `id="logoEditorValue"` so tests can assert on them.

- [ ] **Step 3: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 4: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(settings): logo column + inline editor on Customers card"
```

---

## Task 3: Strip logo from Branding card; rename Branding → White-labelling

**Files:**
- Modify: `index.html` `_renderBrandingCard` and `App.CONFIG_CATEGORIES`

- [ ] **Step 1: Remove logo input from Branding**

In `_renderBrandingCard`, find the per-customer block that emits a logo input (or textarea + Upload affordance). Remove that block. Keep primaryColor + companyName + footerText.

- [ ] **Step 2: Rename card title**

Find the `<h3>` heading in `_renderBrandingCard`. Change "Branding" → "White-labelling".

- [ ] **Step 3: Rename category tile label**

In `App.CONFIG_CATEGORIES`, the `display` entry has `label: 'Display & branding'`. Change to `label: 'Display & white-labelling'`.

- [ ] **Step 4: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS. Render snapshots in `tests/render/config.test.mjs` may break (they may assert "Branding" or test the logo input). Inspect, regenerate via `--update`.

- [ ] **Step 5: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/render/__snapshots__/
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(settings): rename Branding to White-labelling; drop logo input"
```

---

## Task 4: E2E coverage

**Files:**
- Create: `tests/e2e/customer-logos.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Logo editor on Customers card persists logo', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('config'));
  await page.locator('button.config-tile', { hasText: 'Customers' }).click();
  const btn = page.locator('button:has-text("Set logo")').first();
  await btn.click();
  await expect(page.locator('#logoEditorOverlay')).toBeVisible();
  await page.locator('#logoEditorValue').fill('https://example.com/logo.png');
  await page.locator('#logoEditorOverlay button:has-text("Save")').click();
  await expect(page.locator('#logoEditorOverlay')).toHaveCount(0);
  const stored = await page.evaluate(() => {
    const c = (window as any).App.data.customers[0];
    return c ? c.logo : null;
  });
  expect(stored).toBe('https://example.com/logo.png');
});

test('White-labelling card has no logo input', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('config'));
  await page.locator('button.config-tile', { hasText: /white-labelling/i }).click();
  await expect(page.locator('#configBody [data-field="logo"]')).toHaveCount(0);
});
```

- [ ] **Step 2: Run E2E**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:e2e
```
Expected: PASS (gantt flake allowed).

- [ ] **Step 3: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add tests/e2e/customer-logos.spec.ts
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "test(settings): E2E for logo move + Branding rename"
```
