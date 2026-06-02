# Workstream A — Quick Correctness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land six small, low-risk correctness fixes: remove the header power-tools edge gradient, backfill sample-data priority inputs, make the project detail panel auto-save/close silently, remove the RAID all-customers toggle, stop empty views leaking under the load screen, and align the drop-zone background to the design tokens.

**Architecture:** All UI/logic changes are in the single file `index.html` (CSS in one `<style>`, HTML in `<body>`, JS in one `<script>`). Two data fixes touch `portfolio-data.json` and `portfolio-data-demo.json`. No framework/build.

**Tech Stack:** Vanilla HTML/CSS/JS single file; vitest + jsdom (unit/render); Playwright + chromium-headless-shell (e2e).

**Conventions:** inline SVG (no emojis); `:root` tokens (no hardcoded colours where a token exists); `Dashboard.esc()` for user content. No `data-view`/id/handler renames.

**Run tests:** full `npm test`; single unit file `npx vitest run tests/unit/<file>.mjs`; single render file `npx vitest run tests/render/<file>.mjs`.

---

## File Structure

- **Modify:** `index.html`
  - A1: `.header-tools` CSS (lines ~399-400) — delete mask-image.
  - A3: `DetailPanel.close()` (lines ~19043-19072) — remove phantom-diff confirm.
  - A4: `RaidView` (lines ~36866-36977) — remove all-customers toggle; `App._viewScope` (line ~7495).
  - A5: `App.navigate()` guard (line ~4294); `no-data` body-class set/clear in `init()`/`onDataLoaded()`; CSS for `body.no-data .view`.
  - A6: `.drop-zone` / `.file-loader-screen` CSS (lines ~556-566, 235, 299-301).
- **Modify:** `portfolio-data.json`, `portfolio-data-demo.json` (A2 backfill).
- **Create tests:** `tests/unit/sample-data-priority.test.mjs` (A2), `tests/unit/raid-customer-scope.test.mjs` (A4), `tests/unit/load-screen-no-data.test.mjs` (A5), `tests/render/detail-close-silent.test.mjs` (A3).
- **Modify test:** `tests/unit/ia-scope-clarity.test.mjs` (A4 — RAID scope now static).

---

## Task A1: Remove the header power-tools right-edge gradient (issue #1)

CSS-only. Verified visually (no jsdom test for mask-image).

**Files:** Modify `index.html` (lines ~398-400)

- [ ] **Step 1: Delete the mask declarations**

Find the `.header-tools` rule (line ~398). It ends with these two lines:

```css
  -webkit-mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 14px), transparent 100%);
          mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 14px), transparent 100%); }
```

Edit so the rule closes after `scrollbar-width: none;` with no mask. The rule should become:

```css
.header-tools { display: inline-flex; align-items: center; gap: var(--space-1); padding: 2px var(--space-1); background: var(--surface-inset, var(--bg-tertiary)); border: 1px solid var(--border-dim, var(--border-color)); border-radius: var(--radius-pill); min-width: 0; flex-shrink: 1; overflow-x: auto; scrollbar-width: none; }
```

(i.e. remove the trailing `\n  -webkit-mask-image: …;\n          mask-image: …;` and put the closing `}` on the first line.)

- [ ] **Step 2: Verify no mask references remain on header-tools**

Run: `grep -n "mask-image" index.html`
Expected: no line within the `.header-tools` rule (other unrelated mask uses elsewhere, if any, are fine).

- [ ] **Step 3: Full suite still green**

Run: `npx vitest run`
Expected: all pass (CSS change, no test impact).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix(header): remove power-tools right-edge gradient mask"
```

---

## Task A2: Backfill sample-data priority inputs (issue #5)

Data-only, both files, same 6 projects. Add a guard test first so the backfill is verified and protected from regression.

**Files:** Create `tests/unit/sample-data-priority.test.mjs`; Modify `portfolio-data.json`, `portfolio-data-demo.json`

- [ ] **Step 1: Write the failing guard test**

Create `tests/unit/sample-data-priority.test.mjs`:

```javascript
// Sample data must be fully prioritised so the detail/backlog surfaces never flag a
// shipped sample project as "MoSCoW not set" / "no WSJF inputs", and every project
// keeps at least one linked metric.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = ['portfolio-data.json', 'portfolio-data-demo.json'];
const MOSCOW = ['Must', 'Should', 'Could', "Won't"];

describe.each(FILES)('sample data %s — fully prioritised', (file) => {
  const data = JSON.parse(readFileSync(join(root, file), 'utf8'));
  const projects = data.projects || [];

  it('has projects', () => { expect(projects.length).toBeGreaterThan(0); });

  it('every project has complete WSJF + MoSCoW + a linked metric', () => {
    const bad = [];
    projects.forEach(p => {
      const wsjfOk = ['business_value', 'time_criticality', 'risk_reduction_opportunity']
        .every(k => Number.isInteger(p[k]) && p[k] >= 1 && p[k] <= 10);
      const moscowOk = MOSCOW.includes(p.moscow);
      const metricOk = Array.isArray(p.metric_ids) && p.metric_ids.length > 0;
      if (!wsjfOk || !moscowOk || !metricOk) bad.push(p.id + (wsjfOk ? '' : ' wsjf') + (moscowOk ? '' : ' moscow') + (metricOk ? '' : ' metric'));
    });
    expect(bad).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, verify it FAILS**

Run: `npx vitest run tests/unit/sample-data-priority.test.mjs`
Expected: FAIL — `bad` lists ACM-004, ACM-005, GLB-002, GLB-003, GLB-005, INI-001 (each `… wsjf moscow`).

- [ ] **Step 3: Backfill the 6 projects in BOTH files**

In `portfolio-data.json` AND `portfolio-data-demo.json`, locate each of these projects (by `"id"`) and add the four fields alongside the existing project fields. Use exactly these values (sensible, varied 1–10 + varied MoSCoW). Keep both files identical for these projects.

| id | business_value | time_criticality | risk_reduction_opportunity | moscow |
|----|---|---|---|---|
| ACM-004 | 6 | 4 | 8 | "Should" |
| ACM-005 | 7 | 6 | 9 | "Must" |
| GLB-002 | 8 | 7 | 5 | "Should" |
| GLB-003 | 5 | 5 | 4 | "Could" |
| GLB-005 | 6 | 8 | 7 | "Should" |
| INI-001 | 4 | 3 | 3 | "Could" |

For each project object add (matching the file's existing indentation, valid JSON commas):

```json
      "business_value": 6,
      "time_criticality": 4,
      "risk_reduction_opportunity": 8,
      "moscow": "Should",
```

(substituting that project's row from the table). Do not alter any other field. After editing, validate both files parse: `node -e "JSON.parse(require('fs').readFileSync('portfolio-data.json','utf8'));JSON.parse(require('fs').readFileSync('portfolio-data-demo.json','utf8'));console.log('ok')"` → prints `ok`.

- [ ] **Step 4: Run the guard test, verify it PASSES**

Run: `npx vitest run tests/unit/sample-data-priority.test.mjs`
Expected: PASS (both files, all projects prioritised).

- [ ] **Step 5: Commit**

```bash
git add portfolio-data.json portfolio-data-demo.json tests/unit/sample-data-priority.test.mjs
git commit -m "fix(data): backfill WSJF + MoSCoW on all sample projects"
```

---

## Task A3: Detail panel — silent close, no phantom prompt (issue #6)

Keep the blur-flush (auto-saves the focused field); remove the DOM-vs-stored diff confirm so closing never shows a phantom dialog.

**Files:** Create `tests/render/detail-close-silent.test.mjs`; Modify `index.html` (`DetailPanel.close()` ~19043-19072)

- [ ] **Step 1: Write the failing test**

Create `tests/render/detail-close-silent.test.mjs`:

```javascript
// Detail panel: editing a field auto-saves; closing never invokes a confirm() dialog.

import { describe, it, expect, vi } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const boot = () => loadApp(makeDataset({
  projects: [makeProject({ id: 'P1', name: 'Orig Name', customer: 'Acme Industries' })],
  customers: [{ name: 'Acme Industries', color: '#6366f1' }]
}));

describe('Detail panel silent close', () => {
  it('does not call confirm() on close, even after a field edit', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.open('P1');
    // Edit a text field through the normal auto-save path.
    const nameEl = app.document.querySelector('[data-field="name"]');
    expect(nameEl).toBeTruthy();
    nameEl.value = 'Edited Name';
    // Persist as the app does on blur.
    app.App.updateProject('P1', 'name', 'Edited Name');
    const confirmSpy = vi.spyOn(app.window, 'confirm').mockReturnValue(true);
    app.DetailPanel.close();
    expect(confirmSpy).not.toHaveBeenCalled();
    // The edit persisted.
    expect(app.App.data.projects.find(p => p.id === 'P1').name).toBe('Edited Name');
    confirmSpy.mockRestore();
    app.teardown();
  });
});
```

- [ ] **Step 2: Run it, verify it FAILS**

Run: `npx vitest run tests/render/detail-close-silent.test.mjs`
Expected: FAIL — `confirm` is invoked by the close-time diff check (the spy is called), or the panel short-circuits.

Note: if the harness exposes the global as `app.global`/`app.app.window` rather than `app.window`, adjust the spy target to whatever `loadApp` returns for the window object (check an existing render test that spies on globals). The behavioural assertion (confirm not called, edit persisted) is the point.

- [ ] **Step 3: Remove the phantom-diff confirm block**

In `DetailPanel.close()` (index.html ~19039-19073), KEEP the blur-flush:

```javascript
    const active = document.activeElement;
    if (active && panel && panel.contains(active) && typeof active.blur === 'function') {
      active.blur();
    }
```

Then DELETE the entire block that follows it — from the comment line `// After the blur flush, check whether any field still has a DOM value …` through the closing `}` of the `if (p) { … }` block (the lines defining `const normalize`, the `panel.querySelectorAll('[data-field]').forEach(...)`, the `if (pending.length) { … confirm('You have unsaved changes in: ' … 'Close without saving?'); if (!proceed) return; }`, up to and including the `}` that closes `if (p) {`). Stop immediately before:

```javascript
    panel.classList.remove('open');
```

After the edit, the method goes straight from the blur-flush to `panel.classList.remove('open');`. Replace the deleted block with a one-line comment:

```javascript
    // Fields auto-save on blur via App.updateProject; the blur above flushes the focused
    // field, so close silently. Genuine persistence failures surface via the storage-full
    // toast independently — no close-time confirm.
```

- [ ] **Step 4: Run the test, verify it PASSES**

Run: `npx vitest run tests/render/detail-close-silent.test.mjs`
Expected: PASS.

- [ ] **Step 5: Regression — detail/edit e2e + render**

Run: `npx vitest run tests/render && npx playwright test tests/e2e/edit-project.spec.ts tests/e2e/add-project.spec.ts`
Expected: PASS (closing still works; edits persist).

- [ ] **Step 6: Commit**

```bash
git add index.html tests/render/detail-close-silent.test.mjs
git commit -m "fix(detail): close silently after auto-save; drop phantom unsaved prompt"
```

---

## Task A4: Remove the RAID all-customers toggle (issue #7)

RAID becomes permanently customer-scoped.

**Files:** Create `tests/unit/raid-customer-scope.test.mjs`; Modify `index.html` (`RaidView` ~36870-36977, `App._viewScope` ~7495); Modify `tests/unit/ia-scope-clarity.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/raid-customer-scope.test.mjs`:

```javascript
// RAID is always scoped to the active customer — no all-customers toggle, scope is static.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const boot = () => loadApp(makeDataset({
  projects: [
    makeProject({ id: 'A1', customer: 'Acme Industries', risks_register: [{ id: 'r', description: 'Acme risk', impact: 5, probability: 4, status: 'open' }] }),
    makeProject({ id: 'G1', customer: 'Globex', risks_register: [{ id: 'r2', description: 'Globex risk', impact: 5, probability: 4, status: 'open' }] })
  ],
  customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }]
}));

describe('RAID always customer-scoped', () => {
  it('renders no "Show all customers" toggle', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('raid');
    const html = app.document.getElementById('raidContent').innerHTML;
    expect(html).not.toMatch(/Show all customers/i);
    expect(html).not.toMatch(/Viewing all customers/i);
    app.teardown();
  });

  it('_viewScope("raid") is always "one" regardless of showAll', async () => {
    const app = await boot();
    app.RaidView.showAll = true;
    expect(app.App._viewScope('raid')).toBe('one');
    app.RaidView.showAll = false;
    expect(app.App._viewScope('raid')).toBe('one');
    app.teardown();
  });

  it('only shows the active customer\'s rows', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('raid');
    const html = app.document.getElementById('raidContent').innerHTML;
    expect(html).toMatch(/Acme risk/);
    expect(html).not.toMatch(/Globex risk/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run it, verify it FAILS**

Run: `npx vitest run tests/unit/raid-customer-scope.test.mjs`
Expected: FAIL — the toggle string is present and `_viewScope('raid')` returns `'all'` when `showAll` is true.

- [ ] **Step 3: Make `_collect` always customer-scoped**

In `RaidView._collect` (index.html ~36934), change:

```javascript
      if (!p || (!this.showAll && cust && p.customer !== cust)) return;
```

to:

```javascript
      if (!p || (cust && p.customer !== cust)) return;
```

- [ ] **Step 4: Remove the toggle from `_renderActiveTab`**

In `RaidView._renderActiveTab` (index.html ~36966-36974), replace the `scope`/`toolbar` lines:

```javascript
    const scope = this.showAll ? ' across all customers' : '';
    const toolbar = '<div class="raid-toolbar" style="display:flex;align-items:center;gap:14px;margin-bottom:10px">' +
      (App.customerMode ? '' :
        '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-dark-secondary);cursor:pointer">' +
        '<input type="checkbox" ' + (this.showAll ? 'checked' : '') + ' onchange="RaidView.toggleShowAll(this.checked)" aria-label="Show ' + this.activeTab + ' across all customers"> Show all customers</label>') +
      (this.showAll && !App.customerMode ? '<span style="font-size:var(--fs-2xs);font-weight:700;padding:2px 8px;border-radius:999px;background:var(--accent-blue);color:#fff" role="status">Viewing all customers</span>' : '') +
      '<span style="font-size:11px;color:var(--text-muted)">' + rows.length + ' ' + this.activeTab + scope + '</span></div>';
```

with:

```javascript
    const toolbar = '<div class="raid-toolbar" style="display:flex;align-items:center;gap:14px;margin-bottom:10px">' +
      '<span style="font-size:11px;color:var(--text-muted)">' + rows.length + ' ' + this.activeTab + '</span></div>';
```

And in the empty-state line just below, change:

```javascript
      : '<div class="raid-empty" style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px">No ' + this.activeTab + ' recorded for ' + (this.showAll ? 'any customer' : (App.activeCustomer || 'this customer')) + '.</div>';
```

to:

```javascript
      : '<div class="raid-empty" style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px">No ' + this.activeTab + ' recorded for ' + (App.activeCustomer || 'this customer') + '.</div>';
```

- [ ] **Step 5: Remove `toggleShowAll` and neutralise `showAll`**

In `RaidView` delete the method (index.html ~36870):

```javascript
  toggleShowAll(checked) { this.showAll = !!checked; this.render(); },
```

Leave the `showAll: false,` property declaration (line ~36866) in place — it is never set true now, and remaining references (`App._viewScope`, customer-mode reset, nav onclick) read it harmlessly. Also update its comment to: `showAll: false,        // retained false — RAID is always customer-scoped (toggle removed)`.

- [ ] **Step 6: Make `_viewScope('raid')` static**

In `App._viewScope` (index.html ~7494-7497), delete the dynamic RAID line:

```javascript
    if (view === 'raid' && typeof RaidView !== 'undefined' && RaidView.showAll) return 'all';
```

so the method falls through to `return this.VIEW_SCOPE[view] || 'one';` (and `VIEW_SCOPE.raid` is already `'one'`).

- [ ] **Step 7: Update `ia-scope-clarity` VIEW_SCOPE test**

In `tests/unit/ia-scope-clarity.test.mjs`, find the lines:

```javascript
    // RAID scope is dynamic.
    app.RaidView.showAll = true; expect(app.App._viewScope('raid')).toBe('all');
    app.RaidView.showAll = false; expect(app.App._viewScope('raid')).toBe('one');
```

Replace with:

```javascript
    // RAID is always customer-scoped (all-customers toggle removed).
    app.RaidView.showAll = true; expect(app.App._viewScope('raid')).toBe('one');
    app.RaidView.showAll = false; expect(app.App._viewScope('raid')).toBe('one');
```

- [ ] **Step 8: Run the new + regression tests**

Run: `npx vitest run tests/unit/raid-customer-scope.test.mjs tests/unit/ia-scope-clarity.test.mjs tests/unit/slot-h-nav-raid.test.mjs tests/unit/ux-benchmark-wave5.test.mjs`
Expected: PASS (wave5's customer-mode `not.toMatch(/Show all customers/)` still holds since the toggle is gone everywhere).

- [ ] **Step 9: Commit**

```bash
git add index.html tests/unit/raid-customer-scope.test.mjs tests/unit/ia-scope-clarity.test.mjs
git commit -m "feat(raid): remove all-customers toggle; RAID is always customer-scoped"
```

---

## Task A5: Stop empty views leaking under the load screen (issue #9)

When `!App.data`, only the file-loader screen shows.

**Files:** Create `tests/unit/load-screen-no-data.test.mjs`; Modify `index.html` (`App.navigate` ~4294, `init` ~4272-4286, `onDataLoaded`, CSS near `.view` line ~553)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/load-screen-no-data.test.mjs`:

```javascript
// With no data loaded, navigation must not activate any view; the load screen owns the
// screen. After data loads, the no-data state clears and views can activate.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('no-data load screen', () => {
  it('navigate() does not activate a view while App.data is null', async () => {
    // Boot WITHOUT data: load the app shell, then clear data.
    const app = await loadApp(makeDataset({ projects: [], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    app.App.data = null;
    app.document.body.classList.add('no-data');
    app.App.navigate('dashboard');
    const active = app.document.querySelectorAll('.view.active');
    expect(active.length).toBe(0);
    expect(app.document.body.classList.contains('no-data')).toBe(true);
    app.teardown();
  });

  it('after data + onDataLoaded, the no-data class is cleared and a view can activate', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    expect(app.document.body.classList.contains('no-data')).toBe(false);
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('dashboard');
    expect(app.document.querySelectorAll('.view.active').length).toBeGreaterThan(0);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run it, verify it FAILS**

Run: `npx vitest run tests/unit/load-screen-no-data.test.mjs`
Expected: FAIL — `navigate('dashboard')` activates `#viewDashboard` even with `App.data` null (first test fails), and/or `no-data` class is never managed.

Note: confirm how `loadApp` seeds data — if it calls `onDataLoaded`, the second test's precondition (`no-data` absent after load) validates the clear path. If `loadApp` does not run the real load path, set `app.document.body.classList.remove('no-data')` is handled by the code under test in `onDataLoaded`; adjust the test to call `app.App.onDataLoaded()` if needed to exercise the clear.

- [ ] **Step 3: Tighten the navigate guard**

In `App.navigate` (index.html ~4294), change:

```javascript
    if (!this.data && viewName !== 'dashboard' && viewName !== 'portfolio') return;
```

to block ALL navigation pre-data:

```javascript
    if (!this.data) return;
```

- [ ] **Step 4: Manage the `no-data` body class**

In `App.init()` (index.html ~4272, near the top of the body), set the class when there is no data at boot. Add as the first statement inside `init()`:

```javascript
    if (!this.data) document.body.classList.add('no-data');
```

In `App.onDataLoaded()` (index.html ~5755, at the start of the method body, right after `this._ensureSettingsDefaults();`), clear it:

```javascript
    document.body.classList.remove('no-data');
```

- [ ] **Step 5: Add the CSS guard**

In `index.html` immediately after the `.view.active { display: flex; }` rule (line ~554), add:

```css
body.no-data .view { display: none !important; }
body.no-data .view-titlebar { display: none !important; }
```

- [ ] **Step 6: Run the test + regression**

Run: `npx vitest run tests/unit/load-screen-no-data.test.mjs && npx vitest run tests/render`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/unit/load-screen-no-data.test.mjs
git commit -m "fix(load): gate views behind no-data state so none leak under the load screen"
```

---

## Task A6: Drop-zone / load-screen background alignment (issue #8b)

CSS-only token alignment. Verified visually.

**Files:** Modify `index.html` (`.drop-zone` ~558-559; `.file-loader-screen` ~556; dark overrides ~235, ~299-301)

- [ ] **Step 1: Token-align the drop-zone background**

In `index.html` change `.drop-zone` (line ~558) from:

```css
.drop-zone { width: 100%; max-width: 520px; padding: 48px 32px; border: 2px dashed var(--border-light); border-radius: var(--radius-lg); text-align: center; cursor: pointer; transition: all 0.2s ease; background: white; }
```

to use the surface token:

```css
.drop-zone { width: 100%; max-width: 520px; padding: 48px 32px; border: 2px dashed var(--border-light); border-radius: var(--radius-lg); text-align: center; cursor: pointer; transition: all 0.2s ease; background: var(--surface); }
```

(The hover rule line ~559 `background: rgba(59,130,246,0.04)` is a token-consistent accent wash — leave it.)

- [ ] **Step 2: Confirm the load-screen sits on the app canvas**

`.file-loader-screen` (line ~556) has no `background` declared, so it inherits the `.main-content` canvas (`var(--bg-content)`). Leave it as-is (canvas) — the card-on-canvas relationship now matches the rest of the app. No change needed unless a `background` is present; if one is, set it to `var(--bg-content)`.

- [ ] **Step 3: Remove now-redundant dark `.drop-zone` background overrides**

The dark-theme overrides at lines ~235 (`html[data-theme="dark"] .drop-zone { background: var(--bg-card); }`) and ~299 (`html[data-theme="dark"] .drop-zone { background: var(--bg-card); border-color: #1f2937; color: var(--text-dark); }`) previously countered the hardcoded `white`. Now that the base uses `var(--surface)` (which already resolves to a dark value in dark theme), delete the redundant `background: var(--bg-card);` from BOTH dark rules. Keep the line ~299 `border-color`/`color` parts (they style the dark border/text). So line ~235 rule is removed entirely (it only set background); line ~299 becomes:

```css
html[data-theme="dark"] .drop-zone { border-color: #1f2937; color: var(--text-dark); }
```

(Leave lines ~300-301 `.drop-title` / `.drop-subtitle` dark overrides untouched.)

- [ ] **Step 4: Full suite green**

Run: `npx vitest run`
Expected: all pass (CSS only).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "fix(load): align drop-zone background to surface token (light + dark)"
```

---

## Task A7: Full verification + visual pass

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all unit/render + e2e green, 0 failures. (New: sample-data-priority, raid-customer-scope, load-screen-no-data, detail-close-silent.)

- [ ] **Step 2: Serve + visual verification**

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Drive `http://127.0.0.1:8765/index.html` in the browser; verify at 1440px, light + dark:
- **A1:** the header power-tools pill has solid, uniform edges — no transparent fade on the right.
- **A6:** on a hard reload with no session, the drop-zone reads as a normal themed card on the app canvas (consistent in light + dark); hover/drag-over still gives feedback.
- **A5:** with no data, ONLY the file-loader screen shows — no empty table/headers behind it, no titlebar. After "Explore with sample data", views render normally.
- **A2:** load demo data, open ACM-004 / GLB-003 etc. detail panels and the backlog-health view — no "MoSCoW not set" / "no WSJF inputs" reasons.
- **A3:** open a project, edit fields, close via × and Esc — closes immediately, no dialog; reopen shows the edits.
- **A4:** RAID page shows no all-customers toggle in any mode; rows are the active customer's; switching customer updates RAID.

- [ ] **Step 3: Final commit (only if verification required a tweak)**

```bash
git add -A && git commit -m "chore: WS-A verification pass"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** A1↔#1, A2↔#5, A3↔#6, A4↔#7, A5↔#9, A6↔#8b — all six WS-A items have a task.
- **Naming consistency:** `RaidView.showAll` retained (never set true), `toggleShowAll` removed, `_viewScope('raid')` → `'one'`; `body.no-data` class used consistently in init/onDataLoaded/CSS/test.
- **No placeholders:** every code step shows the literal edit; the only "pin during planning" item from the spec (A5 trigger) is resolved here — it was the `navigate()` dashboard/portfolio pre-data exception, tightened to `if (!this.data) return;`.
- **Test-harness caveat:** A3 and A5 tests note how to adapt to `loadApp`'s exact globals/seed path; the behavioural assertions are unambiguous.
