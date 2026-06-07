# Workstream G — Align the Add-Project Wizard UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the 3-step add-project wizard to the app's conventions (shared token-based field classes, token stepper, dark-mode-correct chrome) and fix interaction gaps (Esc-to-close, no accidental backdrop-dismiss, token validation cue) — without changing the flow, fields, or logic.

**Architecture:** All in `index.html` — `DetailPanel._openCreateWizard` (~22939) + `_showWizardStep` (~23159) + `_wizardNext` (~23135) render/validate the wizard; add `.wiz-label`/`.wiz-input` CSS near `.team-edit-modal` (~2321); register the wizard in `App.dismissTopModal` (~8827). No flow/field changes.

**Tech Stack:** Vanilla HTML/CSS/JS single file; vitest + jsdom; Playwright.

**Conventions:** `:root` tokens, inline SVG (no emojis), `Dashboard.esc()`. Run tests: `npm test`; single file `npx vitest run tests/<f>`.

---

## File Structure

- **Modify:** `index.html`
  - New CSS `.wiz-label` / `.wiz-input` near line 2321.
  - `DetailPanel._openCreateWizard` (~22974-23064) — apply classes to fields; token chrome borders; token stepPill.
  - `DetailPanel._showWizardStep` (~23164) — token step-pill repaint.
  - `DetailPanel._openCreateWizard` (~23066) — remove backdrop-close listener.
  - `DetailPanel._wizardNext` (~23139) — token validation cue.
  - `App.dismissTopModal` (~8845) — register `createWizard`.
- **Create test:** `tests/render/wizard-ux.test.mjs`.
- **Keep green:** `tests/unit/phase4-wizard.test.mjs` (flow unchanged).

---

## Task 1: Restyle — token field classes, stepper, chrome

**Files:** Modify `index.html` (CSS ~2321; `_openCreateWizard` ~22974-23064; `_showWizardStep` ~23164); Create `tests/render/wizard-ux.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/render/wizard-ux.test.mjs`:

```javascript
// WS-G: add-project wizard restyled to app tokens/classes (flow unchanged).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

async function boot() {
  const app = await loadApp(makeDataset({ projects: [], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

describe('WS-G wizard restyle', () => {
  it('fields use shared classes, not inline font/border styles', async () => {
    const app = await boot();
    app.DetailPanel._openCreateWizard();
    const wiz = app.document.getElementById('createWizard');
    expect(wiz).toBeTruthy();
    const html = wiz.innerHTML;
    // shared classes present on inputs/selects + labels
    expect(wiz.querySelectorAll('.wiz-input').length).toBeGreaterThanOrEqual(8);
    expect(wiz.querySelectorAll('.wiz-label').length).toBeGreaterThanOrEqual(8);
    // no leftover hardcoded field sizing or step-pill colours
    expect(html).not.toMatch(/font-size:11px/);
    expect(html).not.toMatch(/font-size:12px/);
    expect(html).not.toMatch(/#f1f5f9/);
    expect(html).not.toMatch(/rgba\(59,130,246,0\.15\)/);
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });

  it('the .wiz-input / .wiz-label CSS rules exist', async () => {
    const app = await boot();
    const styleText = Array.from(app.document.querySelectorAll('style')).map(s => s.textContent).join('\n');
    expect(styleText).toMatch(/\.wiz-input\s*\{/);
    expect(styleText).toMatch(/\.wiz-label\s*\{/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify it FAILS**

Run: `npx vitest run tests/render/wizard-ux.test.mjs`
Expected: FAIL — `.wiz-input`/`.wiz-label` don't exist; the wizard HTML still contains `font-size:11px/12px` and the hardcoded pill colours.

- [ ] **Step 3: Add the field CSS classes**

In `index.html` immediately before the `.team-edit-modal {` rule (~line 2321), add:

```css
.wiz-label { font-size: var(--fs-xs); font-weight: 600; color: var(--text-dark); }
.wiz-input { width: 100%; margin-top: 2px; padding: 6px 8px; border: 1px solid var(--border-dim); border-radius: var(--radius-sm); font-size: var(--fs-sm); background: var(--surface); color: var(--text-dark); box-sizing: border-box; }
```

- [ ] **Step 4: Apply `.wiz-input` to every wizard field**

First confirm the inline field style is wizard-only: run
`grep -n 'width:100%;padding:6px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px;margin-top:2px' index.html`
and verify EVERY match line number is within the `_openCreateWizard` innerHTML block (~22994-23050). If all matches are in that range, replace the exact attribute string everywhere:

Replace all occurrences of:
`style="width:100%;padding:6px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px;margin-top:2px"`
with:
`class="wiz-input"`

(If any match is OUTSIDE the wizard block, do NOT global-replace — instead edit only the in-wizard occurrences. Report if so.)

- [ ] **Step 5: Apply `.wiz-label` to every wizard field label**

Within `_openCreateWizard`, the labels use two inline forms. Replace each:
- `style="font-size:11px;font-weight:600"` → `class="wiz-label"`
- `style="flex:1;font-size:11px;font-weight:600"` → `class="wiz-label" style="flex:1"`

Use targeted replace-all for each of the two exact strings (verify with grep they're wizard-only first; the `flex:1;font-size:11px;font-weight:600` form is wizard-specific). Keep the `<br>` separators and field structure intact.

- [ ] **Step 6: Token-ize the step pills (both build + repaint)**

In `_openCreateWizard`, the `stepPill(n, label, active)` helper builds:
`background:' + (active ? 'rgba(59,130,246,0.15)' : '#f1f5f9') + ';color:' + (active ? 'var(--accent-blue)' : 'var(--text-muted)')`
Change to tokens:
`background:' + (active ? 'var(--accent-soft)' : 'var(--surface-inset)') + ';color:' + (active ? 'var(--accent)' : 'var(--text-muted)')`

In `_showWizardStep` (~line 23164) the repaint sets:
```javascript
      el.style.background = active ? 'rgba(59,130,246,0.15)' : '#f1f5f9';
      el.style.color = active ? 'var(--accent-blue)' : 'var(--text-muted)';
```
Change to:
```javascript
      el.style.background = active ? 'var(--accent-soft)' : 'var(--surface-inset)';
      el.style.color = active ? 'var(--accent)' : 'var(--text-muted)';
```

- [ ] **Step 7: Token-ize chrome dividers**

In `_openCreateWizard`, the header and footer divider borders use `border-bottom:1px solid var(--border-light)` / `border-top:1px solid var(--border-light)`. Change those two to `var(--border-dim)` to match the app convention. (Leave the card surface/shadow/radius — already tokens.)

- [ ] **Step 8: Run the test, verify PASS**

Run: `npx vitest run tests/render/wizard-ux.test.mjs`
Expected: PASS.

- [ ] **Step 9: Regression — wizard flow unchanged**

Run: `npx vitest run tests/unit/phase4-wizard.test.mjs`
Expected: PASS (the flow/ids/template logic are untouched). If a test asserted an inline style we removed, STOP and report (it shouldn't — it asserts ids/behaviour).

- [ ] **Step 10: Commit**

```bash
git add index.html tests/render/wizard-ux.test.mjs
git commit -m "feat(wizard): restyle fields/stepper/chrome to :root tokens + shared classes"
```

---

## Task 2: Interaction — Esc closes, backdrop doesn't, token validation cue

**Files:** Modify `index.html` (`dismissTopModal` ~8845; `_openCreateWizard` ~23066; `_wizardNext` ~23139); extend `tests/render/wizard-ux.test.mjs`

- [ ] **Step 1: Add the failing tests**

Append to `tests/render/wizard-ux.test.mjs`:

```javascript
describe('WS-G wizard interaction', () => {
  async function boot2() {
    const app = await loadApp(makeDataset({ projects: [], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    app.App.activeCustomer = 'Acme Industries';
    return app;
  }

  it('dismissTopModal (Esc) closes the wizard', async () => {
    const app = await boot2();
    app.DetailPanel._openCreateWizard();
    expect(app.document.getElementById('createWizard')).toBeTruthy();
    const handled = app.App.dismissTopModal();
    expect(handled).toBe(true);
    expect(app.document.getElementById('createWizard')).toBeFalsy();
    expect(app.DetailPanel._cwState).toBe(null);
    app.teardown();
  });

  it('clicking the backdrop does NOT close the wizard (protects input)', async () => {
    const app = await boot2();
    app.DetailPanel._openCreateWizard();
    const overlay = app.document.getElementById('createWizard');
    overlay.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true }));
    expect(app.document.getElementById('createWizard')).toBeTruthy(); // still open
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });

  it('Step-1 validation blocks Next and flags the empty field', async () => {
    const app = await boot2();
    app.DetailPanel._openCreateWizard();
    app.document.getElementById('cwName').value = ''; // missing required name
    app.DetailPanel._wizardNext();
    // still on step 1 (did not advance)
    expect(app.DetailPanel._cwState.step).toBe(1);
    // the name field carries the error cue
    expect(app.document.getElementById('cwName').classList.contains('wiz-invalid')).toBe(true);
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify it FAILS**

Run: `npx vitest run tests/render/wizard-ux.test.mjs`
Expected: FAIL — dismissTopModal doesn't close the wizard; backdrop click still closes it; no `wiz-invalid` class.

- [ ] **Step 3: Register the wizard in `dismissTopModal`**

In `App.dismissTopModal` (~line 8845), immediately AFTER the holiday-overlay check (`if (holidayOverlay) { this.closeHolidayForm(); return true; }`), add:

```javascript
    // Add-project wizard
    const createWizard = document.getElementById('createWizard');
    if (createWizard) { DetailPanel._closeCreateWizard(); return true; }
```

- [ ] **Step 4: Remove the backdrop-close listener**

In `_openCreateWizard` (~line 23066), delete the line:

```javascript
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this._closeCreateWizard(); });
```

(The × button and Esc remain the close paths. The card already stops propagation by being a child; with the listener gone, an overlay click is a no-op.)

- [ ] **Step 5: Add the `.wiz-invalid` CSS cue**

Next to the `.wiz-input` rule (added in Task 1), add:

```css
.wiz-input.wiz-invalid { border-color: var(--status-red); }
```

- [ ] **Step 6: Apply the validation cue in `_wizardNext`**

In `_wizardNext` step-1 validation (~line 23139), set/clear the `wiz-invalid` class on each field as it's checked, keeping the existing toast + early-return. Replace the step-1 block:

```javascript
    if (this._cwState.step === 1) {
      const name = (document.getElementById('cwName') || {}).value || '';
      const cust = (document.getElementById('cwCustomer') || {}).value || '';
      const size = parseInt((document.getElementById('cwSize') || {}).value, 10) || 0;
      if (!name.trim()) { App.toast('Project name is required', 'error'); return; }
      if (!cust) { App.toast('Customer is required', 'error'); return; }
      if (size <= 0) { App.toast('Total size must be greater than zero', 'error'); return; }
    }
```

with:

```javascript
    if (this._cwState.step === 1) {
      const nameEl = document.getElementById('cwName');
      const custEl = document.getElementById('cwCustomer');
      const sizeEl = document.getElementById('cwSize');
      const name = (nameEl || {}).value || '';
      const cust = (custEl || {}).value || '';
      const size = parseInt((sizeEl || {}).value, 10) || 0;
      // clear prior cues
      [nameEl, custEl, sizeEl].forEach(el => { if (el) el.classList.remove('wiz-invalid'); });
      if (!name.trim()) { if (nameEl) nameEl.classList.add('wiz-invalid'); App.toast('Project name is required', 'error'); return; }
      if (!cust) { if (custEl) custEl.classList.add('wiz-invalid'); App.toast('Customer is required', 'error'); return; }
      if (size <= 0) { if (sizeEl) sizeEl.classList.add('wiz-invalid'); App.toast('Total size must be greater than zero', 'error'); return; }
    }
```

(`#cwName`/`#cwCustomer`/`#cwSize` already carry `class="wiz-input"` from Task 1, so `.wiz-input.wiz-invalid` applies the red border.)

- [ ] **Step 7: Run the tests, verify PASS**

Run: `npx vitest run tests/render/wizard-ux.test.mjs`
Expected: PASS (all wizard-ux tests).

- [ ] **Step 8: Regression**

Run: `npx vitest run tests/unit/phase4-wizard.test.mjs && npx vitest run`
Expected: all green, 0 snapshots broken.

- [ ] **Step 9: Commit**

```bash
git add index.html tests/render/wizard-ux.test.mjs
git commit -m "feat(wizard): Esc closes, backdrop no longer dismisses, token validation cue"
```

---

## Task 3: Full verification + visual pass

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all unit/render + e2e green, 0 failures.

- [ ] **Step 2: Serve + visual verification**

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Drive `http://127.0.0.1:8765/index.html`, load demo data, click **+ New Project**. Verify at 1440px, light + dark:
- Fields look like the rest of the app (13px token inputs/selects; labels consistent); the modal chrome dividers match other modals.
- The step indicator (Identify / Scope & value / Delivery shape) is readable in **dark mode** (no white-on-white / stuck light pill).
- **Esc closes** the wizard; **clicking the dark backdrop does NOT** close it; the × button closes it.
- On Step 1, clearing Name and clicking **Next** keeps you on Step 1 with a red border on Name + the toast.
- "Add details later →", template "Suggested" auto-fill, and per-field "Add later" still work (flow unchanged); creating a project still lands on the detail panel.
- No console errors.

- [ ] **Step 3: Final commit if a tweak was needed**

```bash
git add -A && git commit -m "chore: WS-G verification pass"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** G1 chrome tokens → Task 1 Step 7; G2 field classes → Task 1 Steps 3-5; G3 stepper tokens → Task 1 Step 6 (both build + repaint); G4 Esc/backdrop/validation/spacing → Task 2 (spacing tokens are cosmetic and folded into the field rows — note: the spec's `var(--space-*)` row-gap tweak is optional polish; the field classes already normalise spacing, so it's not a separate step). All spec sections covered.
- **Naming consistency:** `.wiz-label`, `.wiz-input`, `.wiz-invalid`; ids `cwName`/`cwCustomer`/`cwSize`/`createWizard`; `_cwState`, `_closeCreateWizard`, `_wizardNext`, `dismissTopModal` — used consistently across tasks and tests.
- **No placeholders:** every step shows literal edits. Task 1 Step 4/5 include a grep-scope safeguard before any global replace.
- **Flow untouched:** no change to steps, fields, `_confirmCreateWizard`, `_addDetailsLater`, template suggestions, or `App.addProject`; `phase4-wizard.test.mjs` is the guard.
