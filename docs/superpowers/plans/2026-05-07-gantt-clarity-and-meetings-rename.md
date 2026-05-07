# Gantt Clarity + Forums → Governance Meetings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Gantt milestones black-on-white, replace the dashed baseline strip with a bracket + delta pill, surface a Plan-vs-actual hover commentary, and rename "Forums" to "Governance Meetings" in the UI.

**Architecture:** All app code lives in `index.html` (single-file zero-dep app). Tests live under `tests/` with a vitest+jsdom harness for unit/render and Playwright for e2e. Each task touches a localised region of `index.html` + a paired test file. No data-model changes — JSON keys (`governance_forums`, etc.) and JS function names stay; only user-visible strings rename.

**Tech Stack:** Vanilla JS / inline SVG / CSS custom properties / vitest + jsdom + Playwright. No bundler.

**Spec:** [docs/superpowers/specs/2026-05-07-gantt-clarity-and-meetings-rename-design.md](../specs/2026-05-07-gantt-clarity-and-meetings-rename-design.md)

---

## File Map

All implementation lives in:
- `index.html` — touched in five regions:
  - HTML body (~lines 2452, 2764, 2810–2816, 2920+) — nav + governance tab + forum modal markup
  - HTML body (~lines 9311, 9417, 9460–9466) — detail panel + spotlight settings
  - JS strings (~lines 3988, 5937, 11035, 11549, 11557, 12444, 12460, 25469, 25530, 26320, 26326, 26372, 26382, 26406, 26407) — dynamic UI strings
  - CSS (~lines 95–135, 1330–1360) — milestone/baseline tokens + classes
  - Gantt.render / Gantt.renderLegend / Gantt.attachHoverHandlers (~lines 15762–16225, 16775–16880) — milestone SVGs, baseline render path, tooltip builder

Tests:
- `tests/render/gantt.test.mjs` + snapshot — legend with new icons
- `tests/render/gantt-baseline-arrows.test.mjs` — replaced by `tests/render/gantt-baseline.test.mjs` (new bracket + pill assertions)
- `tests/render/gantt-baseline-hover.test.mjs` — NEW, asserts Plan-vs-actual block in tooltip
- `tests/e2e/navigation.spec.ts` — comment update (no string assertions to change)
- `tests/e2e/gantt-baseline.spec.ts` — NEW, e2e for bracket hover

---

## Task 1: Rename Forums in top nav and Governance page header

**Files:**
- Modify: `index.html:2452` (nav badge), `index.html:2764` (gov tab label), `index.html:5937` (view names map), `index.html:9417` (settings nav title), `index.html:11035` (upcoming summary)

- [ ] **Step 1: Rename top nav label**

Edit `index.html:2452` — find:
```html
Forums <span class="nav-badge" id="navBadgeForums">0</span>
```
Replace with:
```html
Meetings <span class="nav-badge" id="navBadgeForums">0</span>
```
(ID stays `navBadgeForums` — it's a code identifier, not user-visible.)

- [ ] **Step 2: Rename the governance Forums tab label**

Edit `index.html:2764` — find:
```html
<div class="gov-tab active" data-tab="forums" onclick="Governance.switchTab('forums')">Forums <span class="tab-count" id="govForumCount">0</span></div>
```
Replace `>Forums <` with `>Meetings <`. Keep `data-tab="forums"` and `Governance.switchTab('forums')` unchanged — internal attribute and function arg.

- [ ] **Step 3: Rename view-names map entry**

Edit `index.html:5937` — find `governance: 'Governance Forums'` and replace with `governance: 'Governance Meetings'`.

- [ ] **Step 4: Rename settings nav tile**

Edit `index.html:9417` — find:
```js
{ title: 'Governance Forums', id: 'governance' },
```
Replace with:
```js
{ title: 'Governance Meetings', id: 'governance' },
```

- [ ] **Step 5: Rename upcoming-summary string**

Edit `index.html:11035` — find:
```js
if (forums7) forwardBits.push('<strong>' + forums7 + '</strong> governance forum' + (forums7 === 1 ? '' : 's') + ' within 7 days');
```
Replace `'governance forum'` with `'governance meeting'`.

- [ ] **Step 6: Run unit + render tests**

Run: `npm run test:unit`
Expected: pass. (No existing tests assert these specific strings; rename is purely human-facing.)

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "rename: Forums → Meetings in nav, governance tab, summaries"
```

---

## Task 2: Rename Forum modal labels and Add/Edit/Save buttons

**Files:**
- Modify: `index.html:2810–2816` (modal HTML), `index.html:25469–25470` (Add Forum button), `index.html:25530` (Edit button title/aria), `index.html:26326` (dynamic title), `index.html:26372`, `26382`, `26406–26407` (undo/confirm strings)

- [ ] **Step 1: Rename Add Forum modal default heading**

Edit `index.html:2812` — find:
```html
<h3 id="forumModalTitle" style="font-size:15px;font-weight:700;margin-bottom:14px">Add Forum</h3>
```
Replace `>Add Forum<` with `>Add Meeting<`.

- [ ] **Step 2: Rename Save button label**

Edit `index.html:2816` — find:
```html
<button class="btn btn-primary btn-sm" onclick="Governance.saveForum()">Save</button>
```
The label is already just "Save" — leave unchanged. (No "Save Forum" text exists.)

- [ ] **Step 3: Rename "Add Forum" toolbar button**

Edit `index.html:25469–25470` — find:
```js
let addBtnHtml = '<div style="margin-bottom:10px"><button class="btn btn-add btn-sm" onclick="Governance.openForumModal(null)"><svg ... </svg> Add Forum</button></div>';
```
Replace ` Add Forum<` with ` Add Meeting<`.

- [ ] **Step 4: Rename per-row Edit button title and aria-label**

Edit `index.html:25530` — find `title="Edit forum"` and `aria-label="Edit forum '` and the surrounding string. Replace both:
- `title="Edit forum"` → `title="Edit meeting"`
- `aria-label="Edit forum '` → `aria-label="Edit meeting '`

- [ ] **Step 5: Rename modal dynamic title set**

Edit `index.html:26326` — find:
```js
document.getElementById('forumModalTitle').textContent = isEdit ? 'Edit Forum' : 'Add Forum';
```
Replace with:
```js
document.getElementById('forumModalTitle').textContent = isEdit ? 'Edit Meeting' : 'Add Meeting';
```

- [ ] **Step 6: Rename undo and delete-confirm strings**

Edit `index.html:26372` — `App.pushUndo('Edit forum');` → `App.pushUndo('Edit meeting');`
Edit `index.html:26382` — `App.pushUndo('Add forum');` → `App.pushUndo('Add meeting');`
Edit `index.html:26406` — `confirm({ title: 'Delete forum "'` → `confirm({ title: 'Delete meeting "'`; `confirmLabel: 'Delete forum'` → `confirmLabel: 'Delete meeting'`. Body string `'Minutes, actions and decisions logged on this forum will be lost with it.'` → `'Minutes, actions and decisions logged on this meeting will be lost with it.'`
Edit `index.html:26407` — `App.pushUndo('Delete forum');` → `App.pushUndo('Delete meeting');`

- [ ] **Step 7: Verify — manual smoke**

Open `index.html` in a browser, load demo data, navigate to Governance Meetings → click "Add Meeting", modal title reads "Add Meeting". Edit existing → title reads "Edit Meeting". Cancel out.

- [ ] **Step 8: Run unit + render**

Run: `npm run test:unit`
Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "rename: Forum modal labels and buttons → Meeting"
```

---

## Task 3: Rename detail panel field, spotlight, import report, toasts, aria-labels

**Files:**
- Modify: `index.html:9311` (detail-panel field label), `index.html:9460–9466` (spotlight group + meta), `index.html:3988` (import report row), `index.html:11549, 11557, 11558` (upcoming summary), `index.html:12444, 12460` (My Actions aria-labels), `index.html:4406` (validateDataIntegrity message)

- [ ] **Step 1: Rename detail panel "Forum" field label**

Edit `index.html:9311` — find:
```js
'<div><div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px">Forum</div><select id="pimBeForum" ...
```
Replace `>Forum<` with `>Meeting<`. Leave `id="pimBeForum"` unchanged.

- [ ] **Step 2: Rename spotlight group and meta**

Edit `index.html:9460–9466` — find:
```js
group: 'Forums',
...
meta: 'Forum · ' + (f.cadence || 'Ad-hoc') + ...
...
keywords: ('forum ' + f.name + ' ' + (f.customer || '') + ' ' + (f.cadence || '')).toLowerCase()
```
Replace:
- `group: 'Forums',` → `group: 'Meetings',`
- `meta: 'Forum · '` → `meta: 'Meeting · '`
- Keywords stay lowercase `'forum '` (search-token, internal — but include `'meeting '` too for forward-compatibility): `keywords: ('meeting forum ' + f.name + ...)`. This keeps existing-typed-search-by-"forum" working and adds the new term.

- [ ] **Step 3: Rename import report row label**

Edit `index.html:3988` — find:
```js
'<div ...><span>Governance Forums</span><span>' + report.updatedForums + ' updated, ' + report.addedForums + ' new</span></div>' +
```
Replace `<span>Governance Forums</span>` with `<span>Governance Meetings</span>`.

- [ ] **Step 4: Rename "X forum(s) in the next 7 days" summary**

Edit `index.html:11549` — find:
```js
upcomingForums.push({ id: null, name: Dashboard.esc(f.name), reason: label + ' · ' + count + ' projects', color: 'var(--accent-blue)' });
```
No change needed — `label` is already a passthrough.

Edit `index.html:11556–11558` — find:
```js
count: upcomingForums.length,
summary: upcomingForums.length + ' forum' + (upcomingForums.length > 1 ? 's' : '') + ' in the next 7 days',
items: upcomingForums
```
Replace `' forum'` with `' meeting'`.

- [ ] **Step 5: Rename My Actions "Open this forum" aria-labels**

Edit `index.html:12444` and `index.html:12460` — find both occurrences of:
```html
aria-label="Open this forum"
```
Replace with `aria-label="Open this meeting"`.

- [ ] **Step 6: Rename data-integrity warning message**

Edit `index.html:4406` — find:
```js
issues.push({ type: 'warning', message: 'Project "' + p.name + '" references non-existent forum: ' + p.governance_forum, fixAction: 'clear_forum', projectId: p.id });
```
Replace `'references non-existent forum: '` with `'references non-existent meeting: '`. Leave `fixAction: 'clear_forum'` unchanged (internal action key).

- [ ] **Step 7: Run unit + render**

Run: `npm run test:unit`
Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "rename: detail panel, spotlight, import report, toasts → Meeting"
```

---

## Task 4: Update navigation comment in e2e test (Forums references in test files)

**Files:**
- Modify: `tests/e2e/navigation.spec.ts:22` (comment only)

- [ ] **Step 1: Update navigation test comment**

Edit `tests/e2e/navigation.spec.ts:22` — find:
```ts
  // Governance Forums
```
Replace with:
```ts
  // Governance Meetings
```

(JS function names like `completeForumAction`, `deferForumAction`, `buildForumPackDoc` and describe block titles like `'P3 — Forum agenda'`, `'Forum agenda generator'`, `'Forum pack surfaces narrative...'` all stay — they're code identifiers and refer to functions whose names we're not changing per the spec.)

- [ ] **Step 2: Run e2e suite**

Run: `npm run test:e2e`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/navigation.spec.ts
git commit -m "test: update navigation comment to Governance Meetings"
```

---

## Task 5: Add CSS tokens for milestone colours

**Files:**
- Modify: `index.html:91–105` (light theme :root), `index.html:125–140` (dark theme block)

- [ ] **Step 1: Add light-theme tokens**

Edit `index.html` near line 99 — after the existing `--gantt-milestone-stroke: #5b21b6;` line, add two new properties to the same `:root` block:
```css
  --gantt-ms-stroke: #0f172a;
  --gantt-ms-fill: #ffffff;
```

- [ ] **Step 2: Add dark-theme tokens**

Edit `index.html` near line 133 — in the `html[data-theme="dark"]` block where `--gantt-milestone-stroke` is overridden, add:
```css
  --gantt-ms-stroke: #e2e8f0;
  --gantt-ms-fill: #1e293b;
```
(`#1e293b` matches existing `--surface-2` in dark theme; verify by `grep -n "surface-2" index.html | head -3` and reuse the right hex if it differs.)

- [ ] **Step 3: Verify tokens exist**

Run: `grep -n "gantt-ms-stroke\|gantt-ms-fill" index.html`
Expected output: 4 lines (2 light, 2 dark).

- [ ] **Step 4: Run unit + render**

Run: `npm run test:unit`
Expected: pass (no behaviour change yet — tokens are unused).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(gantt): add --gantt-ms-stroke and --gantt-ms-fill tokens"
```

---

## Task 6: Repaint milestone SVGs in Gantt.render

**Files:**
- Modify: `index.html:16835–16878` (msDeadline, msLaunch, msUat, external-dep diamond)

- [ ] **Step 1: Repaint Deadline (calendar) SVG**

Edit `index.html:16837–16845` — replace the entire `msDeadline` body with:
```js
      const msDeadline = (x, type, date) => msWrap('gantt-ms-deadline', x, type, date,
        '<svg width="16" height="16" viewBox="0 0 16 16" focusable="false">' +
          '<rect x="2" y="3" width="12" height="11" rx="1.5" style="fill:var(--gantt-ms-fill);stroke:var(--gantt-ms-stroke);stroke-width:1.2"/>' +
          '<line x1="2" y1="6.5" x2="14" y2="6.5" style="stroke:var(--gantt-ms-stroke);stroke-width:1"/>' +
          '<line x1="5" y1="1.5" x2="5" y2="4.5" style="stroke:var(--gantt-ms-stroke);stroke-width:1.3" stroke-linecap="round"/>' +
          '<line x1="11" y1="1.5" x2="11" y2="4.5" style="stroke:var(--gantt-ms-stroke);stroke-width:1.3" stroke-linecap="round"/>' +
          '<line x1="8" y1="8.5" x2="8" y2="11" style="stroke:var(--gantt-ms-stroke);stroke-width:1.5" stroke-linecap="round"/>' +
          '<circle cx="8" cy="12.5" r="0.9" style="fill:var(--gantt-ms-stroke)"/>' +
        '</svg>');
```
(Old: violet fill, white `!`. New: white fill, black calendar + black `!`.)

- [ ] **Step 2: Repaint Launch (rocket) SVG**

Edit `index.html:16847–16852` — replace the `msLaunch` body with:
```js
      const msLaunch = (x, type, date) => msWrap('gantt-ms-launch', x, type, date,
        '<svg width="16" height="16" viewBox="0 0 16 16" focusable="false">' +
          '<path d="M8 1.5 L11 6 L11 11 L5 11 L5 6 Z" style="fill:var(--gantt-ms-fill);stroke:var(--gantt-ms-stroke);stroke-width:1.2" stroke-linejoin="round"/>' +
          '<circle cx="8" cy="7" r="1.2" style="fill:var(--gantt-ms-stroke)"/>' +
          '<path d="M5 11 L3 14 M11 11 L13 14" style="stroke:var(--gantt-ms-stroke);stroke-width:1.2" stroke-linecap="round" fill="none"/>' +
        '</svg>');
```

- [ ] **Step 3: Repaint UAT (doc + check) SVG**

Edit `index.html:16854–16858` — replace the `msUat` body with:
```js
      const msUat = (x, type, date) => msWrap('gantt-ms-uat', x, type, date,
        '<svg width="16" height="16" viewBox="0 0 16 16" focusable="false">' +
          '<rect x="3" y="2" width="10" height="12" rx="1" style="fill:var(--gantt-ms-fill);stroke:var(--gantt-ms-stroke);stroke-width:1.2"/>' +
          '<polyline points="5.5,8.5 7.5,10.5 10.5,6.5" fill="none" style="stroke:var(--gantt-ms-stroke);stroke-width:1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>');
```

- [ ] **Step 4: Repaint external-dep diamond SVG**

Edit `index.html:16876` — replace the inline diamond SVG inside the `(p.dependencies || []).forEach` block. Find:
```js
'<svg width="14" height="14" viewBox="0 0 14 14" focusable="false"><path d="M7 1 L13 7 L7 13 L1 7 Z" fill="var(--accent-violet)" stroke="#5b21b6" stroke-width="1.2" stroke-linejoin="round"/><path d="M7 4 L7 8" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="7" cy="10" r="0.9" fill="#fff"/></svg>'
```
Replace with:
```js
'<svg width="14" height="14" viewBox="0 0 14 14" focusable="false"><path d="M7 1 L13 7 L7 13 L1 7 Z" style="fill:var(--gantt-ms-fill);stroke:var(--gantt-ms-stroke);stroke-width:1.2" stroke-linejoin="round"/><path d="M7 4 L7 8" style="stroke:var(--gantt-ms-stroke);stroke-width:1.6" stroke-linecap="round"/><circle cx="7" cy="10" r="0.9" style="fill:var(--gantt-ms-stroke)"/></svg>'
```

- [ ] **Step 5: Manual smoke test**

Open `index.html` in a browser, load demo data, navigate to Roadmap. Verify all milestone glyphs (where they appear) render as black-outlined on white. Toggle dark theme via Settings → Display: glyphs become light-on-dark, still legible.

- [ ] **Step 6: Run unit + render**

Run: `npm run test:unit`
Expected: `gantt.test.mjs` may fail — its assertions check for `#8b5cf6` (violet). Snapshot will diff. Move to Task 8 to update tests.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat(gantt): repaint milestone SVGs to black-on-white via tokens"
```

---

## Task 7: Repaint legend milestone SVGs to match

**Files:**
- Modify: `index.html:15775–15782` (renderLegend SVGs for Deadline / Launch / UAT)

- [ ] **Step 1: Repaint legend Deadline SVG**

Edit `index.html:15777` — replace the inline SVG (the entire `<svg>...</svg>` inside the Deadline `<span>`) with:
```js
'<svg width="14" height="14" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="1.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.2"/><line x1="2" y1="6.5" x2="14" y2="6.5" stroke="#0f172a" stroke-width="1"/><line x1="5" y1="1.5" x2="5" y2="4.5" stroke="#0f172a" stroke-width="1.3" stroke-linecap="round"/><line x1="11" y1="1.5" x2="11" y2="4.5" stroke="#0f172a" stroke-width="1.3" stroke-linecap="round"/><line x1="8" y1="8.5" x2="8" y2="11" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="12.5" r="0.9" fill="#0f172a"/></svg>'
```
(Legend uses literal hex — not tokens — because it's snapshot-asserted; theme switching the legend isn't required for v1.)

- [ ] **Step 2: Repaint legend Launch SVG**

Edit `index.html:15779` — replace the inline SVG with:
```js
'<svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 1.5 L11 6 L11 11 L5 11 L5 6 Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.2" stroke-linejoin="round"/><circle cx="8" cy="7" r="1.2" fill="#0f172a"/><path d="M5 11 L3 14 M11 11 L13 14" stroke="#0f172a" stroke-width="1.2" stroke-linecap="round" fill="none"/></svg>'
```

- [ ] **Step 3: Repaint legend UAT SVG**

Edit `index.html:15781` — replace the inline SVG with:
```js
'<svg width="14" height="14" viewBox="0 0 16 16"><rect x="3" y="2" width="10" height="12" rx="1" fill="#ffffff" stroke="#0f172a" stroke-width="1.2"/><polyline points="5.5,8.5 7.5,10.5 10.5,6.5" fill="none" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
```

- [ ] **Step 4: Run snapshot test (will fail — expected)**

Run: `npm run test:unit -- gantt.test.mjs`
Expected: FAIL with snapshot diff and "expected to contain '#8b5cf6'" assertion failure.

- [ ] **Step 5: Don't commit yet**

Move on to Task 8 to update the test assertions and snapshot.

---

## Task 8: Update gantt legend test + snapshot for new icons

**Files:**
- Modify: `tests/render/gantt.test.mjs`
- Regenerate: `tests/render/__snapshots__/gantt.legend.html`

- [ ] **Step 1: Update test assertions**

Replace the contents of `tests/render/gantt.test.mjs` with:
```js
// Gantt render snapshots. renderLegend writes to #ganttLegend — snapshot that
// element's innerHTML so the milestone-icon repaint stays locked.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';

describe('Gantt.renderLegend', () => {
  it('renders legend with black-on-white milestone glyphs', async () => {
    const app = await loadApp();
    app.Gantt.renderLegend();
    const legend = app.document.getElementById('ganttLegend');
    const html = legend.innerHTML;
    // Structural assertions — milestones now use #0f172a (near-black) strokes
    // and #ffffff fills. Old violet-and-amber palette is gone.
    expect(html).not.toContain('Go-Live');
    expect(html).not.toContain('Estimated');
    expect(html).toContain('Deadline');
    expect(html).toContain('Launch');
    expect(html).toContain('UAT release');
    expect(html).not.toContain('#8b5cf6'); // old violet calendar
    expect(html).not.toContain('#f59e0b'); // old amber rocket
    expect(html).not.toContain('#0891b2'); // old cyan UAT
    // New palette
    expect(html).toContain('stroke="#0f172a"');
    expect(html).toContain('fill="#ffffff"');
    await expect(html).toMatchFileSnapshot('./__snapshots__/gantt.legend.html');
    app.teardown();
  });
});
```

- [ ] **Step 2: Regenerate snapshot file**

Run: `npm run test:update-snapshots -- gantt.test.mjs`
Expected: snapshot file `tests/render/__snapshots__/gantt.legend.html` rewritten.

- [ ] **Step 3: Verify snapshot reflects new palette**

Run: `grep -c "#0f172a" tests/render/__snapshots__/gantt.legend.html`
Expected: ≥ 6 (multiple stroke references across three milestone glyphs).

Run: `grep -c "#8b5cf6\|#f59e0b\|#0891b2" tests/render/__snapshots__/gantt.legend.html`
Expected: 0.

- [ ] **Step 4: Run full unit suite**

Run: `npm run test:unit`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/gantt.test.mjs tests/render/__snapshots__/gantt.legend.html
git commit -m "test(gantt): repaint legend SVGs and update snapshot"
```

---

## Task 9: Add CSS classes for baseline bracket and delta pill

**Files:**
- Modify: `index.html:1343–1352` (replace `gantt-bar-baseline` block with new classes)

- [ ] **Step 1: Replace the dashed-strip baseline CSS**

Edit `index.html:1343–1352` — find the current `gantt-bar-baseline` block (and the `html[data-theme="dark"] .gantt-bar-baseline` line) and replace **both** with:
```css
/* Baseline-vs-actual: bracket above the bar + inline delta pill.
   Replaces the legacy 3px dashed strip (.gantt-bar-baseline) and the SVG
   baseline-arrow. The bracket reads as a caliper spanning the original
   start→end; the pill quantifies any slip on the right edge. */
.gantt-baseline-bracket {
  position: absolute; top: 1px; height: 6px;
  pointer-events: auto; cursor: pointer;
}
.gantt-baseline-bracket::before,
.gantt-baseline-bracket::after {
  content: ''; position: absolute; top: 0; width: 1.5px; height: 6px;
  background: var(--gantt-baseline);
}
.gantt-baseline-bracket::before { left: 0; }
.gantt-baseline-bracket::after { right: 0; }
.gantt-baseline-bracket > .gantt-baseline-spine {
  position: absolute; left: 1.5px; right: 1.5px; top: 5px; height: 1px;
  background: var(--gantt-baseline);
}
html[data-theme="dark"] .gantt-baseline-bracket::before,
html[data-theme="dark"] .gantt-baseline-bracket::after,
html[data-theme="dark"] .gantt-baseline-bracket > .gantt-baseline-spine { background: var(--gantt-baseline); }

.gantt-delta-pill {
  position: absolute; top: 50%; transform: translateY(-50%);
  font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 8px;
  white-space: nowrap; pointer-events: none; z-index: 4;
}
.gantt-delta-pill.slip   { color: var(--status-red);   background: var(--tint-red-weak); }
.gantt-delta-pill.early  { color: var(--status-green); background: var(--tint-green-weak); }
.gantt-delta-pill.onplan { color: var(--text-muted); background: transparent; }
```

- [ ] **Step 2: Bump live-bar top so the bracket fits above it**

Edit `index.html:1330–1338` — find `.gantt-bar { position: absolute; top: 6px; height: 24px; ...` and change `top: 6px` to `top: 8px`. (The 2 px shift accommodates the 6 px bracket above without growing the row.)

- [ ] **Step 3: Verify CSS parses**

Open `index.html` in a browser, hard-reload. The Gantt should still render — bars sit 2 px lower; baselines render as before (`gantt-bar-baseline` is gone but its DOM use is removed in Task 10).

- [ ] **Step 4: Run unit + render**

Run: `npm run test:unit`
Expected: `gantt-baseline-arrows.test.mjs` will fail because we haven't yet rewritten the render path. Continue.

- [ ] **Step 5: Don't commit yet**

The CSS without the matching render path is half-finished. Move to Task 10.

---

## Task 10: Replace baseline render path with bracket + delta pill (TDD)

**Files:**
- Replace: `tests/render/gantt-baseline-arrows.test.mjs` → renamed to `tests/render/gantt-baseline.test.mjs`
- Modify: `index.html:16775–16819` (the `if (showBaseline) { ... }` block in `Gantt.render`)

- [ ] **Step 1: Write the new failing test**

Delete `tests/render/gantt-baseline-arrows.test.mjs` and create `tests/render/gantt-baseline.test.mjs`:
```js
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Gantt baseline bracket + delta pill', () => {
  async function setup({ baselineEnd, currentEnd }) {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'BaselineProj',
      start_date: '2026-01-05', target_date: currentEnd,
      baseline_start: '2026-01-05', baseline_end: baselineEnd,
      size_engineering: 5
    });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    const checkbox = app.window.document.getElementById('ganttBaseline');
    if (checkbox) checkbox.checked = true;
    app.Gantt.render();
    return app;
  }

  it('renders a bracket and a "+Nd" slip pill when target moved later', async () => {
    const app = await setup({ baselineEnd: '2026-01-26', currentEnd: '2026-02-09' });
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-baseline-bracket/);
    expect(html).toMatch(/gantt-delta-pill slip/);
    expect(html).toMatch(/\+\d+d/);
    expect(html).not.toMatch(/baseline-arrow/); // legacy SVG removed
    expect(html).not.toMatch(/gantt-bar-baseline/); // legacy dashed strip removed
    app.teardown();
  });

  it('renders a "−Nd" early pill when target moved earlier', async () => {
    const app = await setup({ baselineEnd: '2026-02-09', currentEnd: '2026-01-26' });
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-delta-pill early/);
    expect(html).toMatch(/−\d+d/);
    app.teardown();
  });

  it('renders an "on plan" pill when target unchanged', async () => {
    const app = await setup({ baselineEnd: '2026-01-26', currentEnd: '2026-01-26' });
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-delta-pill onplan/);
    expect(html).toContain('on plan');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the new test — it should fail**

Run: `npm run test:unit -- gantt-baseline.test.mjs`
Expected: FAIL — `gantt-baseline-bracket` not found in HTML (current code still renders `gantt-bar-baseline`).

- [ ] **Step 3: Replace the baseline render block in Gantt.render**

Edit `index.html:16775–16819` — find the entire block starting `let baselineHtml = '';` and ending `}` (the close of `if (showBaseline)`). Replace with:
```js
      let baselineHtml = '';
      if (showBaseline) {
        // Preferred: span computed from the selected named baseline's snapshot for this project.
        const span = this._projectBaselineSpan(p.id);
        let bStart = null, bEnd = null;
        if (span) {
          const startSp = (App.data.sprints || []).find(s => s.sprint_id === span.startSprint);
          const endSp = (App.data.sprints || []).find(s => s.sprint_id === span.endSprint);
          if (startSp) bStart = startSp.start_date;
          if (endSp) bEnd = endSp.end_date;
        }
        // Fallback: per-project dates inside the active named baseline (D2.4).
        if (!bStart || !bEnd) {
          const ab = this._activeBaseline();
          const node = (ab && ab.snapshot && ab.snapshot[p.id]) || null;
          if (node && node.start_date && node.target_date) {
            bStart = node.start_date;
            bEnd = node.target_date;
          }
        }
        // Final fallback: legacy project.baseline_start/end (pre-D2.3).
        if (!bStart || !bEnd) { bStart = p.baseline_start; bEnd = p.baseline_end; }
        if (bStart && bEnd) {
          const bx1 = Math.max(0, dateToX(bStart));
          const bx2 = Math.max(bx1 + 4, dateToX(bEnd));
          // Bracket sits above the bar, spanning the baseline's original start → end.
          baselineHtml += '<div class="gantt-baseline-bracket gantt-hoverable" data-hover-type="baseline" data-id="' + Dashboard.esc(p.id) + '" tabindex="0" role="img" aria-label="Baseline ' + Dashboard.esc(bStart) + ' to ' + Dashboard.esc(bEnd) + '" style="left:' + bx1 + 'px;width:' + (bx2 - bx1) + 'px"><div class="gantt-baseline-spine"></div></div>';
          // Delta pill — quantify the slip / early / on-plan state vs current target_date.
          if (p.target_date) {
            const baseDays = Math.round((new Date(bEnd) - new Date(bStart)) / 86400000);
            const liveDays = Math.round((new Date(p.target_date) - new Date(p.start_date || bStart)) / 86400000);
            const targetDelta = Math.round((new Date(p.target_date) - new Date(bEnd)) / 86400000);
            let pillCls, pillText;
            if (targetDelta > 0)      { pillCls = 'slip';   pillText = '+' + targetDelta + 'd'; }
            else if (targetDelta < 0) { pillCls = 'early';  pillText = '−' + Math.abs(targetDelta) + 'd'; }
            else                      { pillCls = 'onplan'; pillText = 'on plan'; }
            const pillX = Math.max(x2, bx2) + 4;
            const tipText = 'Baseline ' + bStart + ' → ' + bEnd + ' · current ' + p.target_date + ' (' + pillText + ')';
            baselineHtml += '<div class="gantt-delta-pill ' + pillCls + '" style="left:' + pillX + 'px" title="' + Dashboard.esc(tipText) + '">' + pillText + '</div>';
          }
        }
      }
```
This removes the dashed `gantt-bar-baseline` strip AND the inline `baseline-arrow` SVG entirely.

- [ ] **Step 4: Run the new test — it should pass**

Run: `npm run test:unit -- gantt-baseline.test.mjs`
Expected: PASS — three test cases (slip / early / on-plan) all green.

- [ ] **Step 5: Run full unit suite to catch regressions**

Run: `npm run test:unit`
Expected: pass.

- [ ] **Step 6: Manual smoke**

Open `index.html`, load demo, navigate to Roadmap, set a baseline, slip a project's target_date by editing it. Verify the bracket renders above the bar, the pill appears with `+Nd` red text. Pull the date in by 5 days: pill flips to `−5d` green. Reset to baseline: pill says `on plan`.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/render/gantt-baseline.test.mjs
git rm tests/render/gantt-baseline-arrows.test.mjs
git commit -m "feat(gantt): replace dashed-strip baseline with bracket + delta pill"
```

---

## Task 11: Make the baseline bracket hoverable (data-hover-type='baseline')

**Files:**
- Modify: `index.html:16145–16195` (paint/erase for new hover type) — small no-op handlers since the bracket itself is the visible target
- Already wired in Task 10: the bracket gets `class="gantt-hoverable"` and `data-hover-type="baseline"`.

- [ ] **Step 1: Add baseline branch to paint() helper**

Edit `index.html:16145–16174` — in `const paint = (el) => { ... }`, find the `else if (type === 'phase')` branch. After it, add a new branch:
```js
      } else if (type === 'baseline') {
        const id = el.dataset.id;
        const bar = scroll.querySelector('.gantt-bar[data-id="' + id + '"]');
        const label = document.querySelector('.gantt-label-row[data-id="' + id + '"]');
        if (bar) bar.classList.add('gantt-bar-highlight');
        if (label) label.classList.add('gantt-label-active');
```
Keep the existing trailing `}` of `else if (type === 'dep')`.

- [ ] **Step 2: Add baseline branch to erase() helper**

Edit `index.html:16175–16196` — in `const erase = (el) => { ... }`, mirror the same structure: after the `phase` branch, before `dep`:
```js
      } else if (type === 'baseline') {
        const id = el.dataset.id;
        const bar = scroll.querySelector('.gantt-bar[data-id="' + id + '"]');
        const label = document.querySelector('.gantt-label-row[data-id="' + id + '"]');
        if (bar) bar.classList.remove('gantt-bar-highlight');
        if (label) label.classList.remove('gantt-label-active');
```

- [ ] **Step 3: Run unit + render**

Run: `npm run test:unit`
Expected: pass.

- [ ] **Step 4: Manual smoke**

Hover the bracket. The matching bar gets the blue highlight outline + the matching label row in the labels column highlights. Move away, both clear.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(gantt): wire baseline bracket into hover paint/erase"
```

---

## Task 12: Add Plan-vs-actual block to tooltip builder (TDD)

**Files:**
- New: `tests/render/gantt-baseline-hover.test.mjs`
- Modify: `index.html:16001–16143` (add helper `buildPlanVsActual` and call it in three branches: `bar`, `label`, new `baseline`)
- Modify: `index.html:1371` (`.gantt-tooltip { ... max-width: 300px; }` → `360px`)

- [ ] **Step 1: Write the failing test**

Create `tests/render/gantt-baseline-hover.test.mjs`:
```js
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

async function loadWithBaseline({ targetDate, baselineEnd }) {
  resetIdSeq();
  const sprints = makeSprintSequence(3);
  const proj = makeProject({
    name: 'PlanVsActualProj',
    start_date: '2026-01-05', target_date: targetDate,
    baseline_start: '2026-01-05', baseline_end: baselineEnd,
    size_engineering: 5
  });
  proj.size_total = 5;
  const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
  app.App.activeCustomer = 'Acme Industries';
  const cb = app.window.document.getElementById('ganttBaseline');
  if (cb) cb.checked = true;
  app.Gantt.render();
  return { app, proj };
}

describe('Gantt tooltip — Plan vs actual block', () => {
  it('appears for a bar hover when project is in active baseline', async () => {
    const { app } = await loadWithBaseline({ targetDate: '2026-02-09', baselineEnd: '2026-01-26' });
    const bar = app.window.document.querySelector('.gantt-bar[data-hover-type="bar"]');
    expect(bar, 'bar element').toBeTruthy();
    // Drive tooltip-build directly via the same path the hover handler calls.
    const html = app.Gantt._buildTooltipForTest ? app.Gantt._buildTooltipForTest('bar', bar) : '';
    expect(html).toContain('Plan vs actual');
    expect(html).toMatch(/Baseline/);
    expect(html).toMatch(/Current/);
    expect(html).toMatch(/\+\d+d/); // slip in the diff line
    app.teardown();
  });

  it('does not include Plan vs actual when no baseline is active', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'NoBaseline', start_date: '2026-01-05', target_date: '2026-02-09', size_engineering: 5 });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Gantt.render();
    const bar = app.window.document.querySelector('.gantt-bar[data-hover-type="bar"]');
    const html = app.Gantt._buildTooltipForTest ? app.Gantt._buildTooltipForTest('bar', bar) : '';
    expect(html).not.toContain('Plan vs actual');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run new test — it should fail**

Run: `npm run test:unit -- gantt-baseline-hover.test.mjs`
Expected: FAIL — `_buildTooltipForTest` undefined / output doesn't contain "Plan vs actual".

- [ ] **Step 3: Expose tooltip builder for tests**

Edit `index.html` — at the **bottom** of `Gantt.attachHoverHandlers` (just before its closing `}` near line 16270, after the `attachTo(...)` calls), add a single line:
```js
    self._buildTooltipForTest = buildTooltip;
```
This exposes the closure-scoped `buildTooltip` for direct test invocation without needing real DOM mouse events. `Gantt.render()` already calls `attachHoverHandlers()` (line 17251), so the test calling `Gantt.render()` first is sufficient to wire `_buildTooltipForTest` before the assertion runs.

- [ ] **Step 4: Add the buildPlanVsActual helper**

Edit `index.html:16001` — just before the `const buildTooltip = (type, el) => { ... }` declaration, add a helper:
```js
    // Plan-vs-actual narrative — appended to bar/label/baseline tooltips when an active
    // baseline contains this project. Returns '' otherwise so the existing tooltip stays
    // unchanged.
    const buildPlanVsActual = (proj) => {
      if (!proj) return '';
      const ab = self._activeBaseline ? self._activeBaseline() : null;
      const node = (ab && ab.snapshot && ab.snapshot[proj.id]) || null;
      if (!node) return '';
      const baseStart  = node.start_date  || proj.baseline_start;
      const baseEnd    = node.target_date || proj.baseline_end;
      const baseSize   = (node.size_total != null) ? node.size_total : (proj.size_total || 0);
      const liveStart  = proj.start_date;
      const liveEnd    = proj.target_date;
      const liveSize   = proj.size_total || 0;
      if (!baseStart || !baseEnd || !liveStart || !liveEnd) return '';
      const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
      const startDelta = Math.round((new Date(liveStart) - new Date(baseStart)) / 86400000);
      const targetDelta = Math.round((new Date(liveEnd) - new Date(baseEnd)) / 86400000);
      const sizeDelta = liveSize - baseSize;
      const startBit = startDelta === 0 ? 'start unchanged' : (startDelta > 0 ? '+' + startDelta + 'd on start' : startDelta + 'd on start');
      const targetBit = targetDelta === 0 ? 'target unchanged' : (targetDelta > 0 ? '+' + targetDelta + 'd on target' : targetDelta + 'd on target');
      const sizeBit = sizeDelta === 0 ? 'scope unchanged' : (sizeDelta > 0 ? '+' + sizeDelta + ' SP' : sizeDelta + ' SP');
      const setMeta = ab.created_at ? 'set ' + new Date(ab.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + (ab.created_by ? ' by ' + esc(ab.created_by) : '') : '';
      // What moved — top 3 distinct field changes from audit_log since baseline was set.
      let movers = '';
      try {
        const sinceTs = ab.created_at || '';
        const log = (App.data.audit_log || []).filter(e => e.project_id === proj.id && (!sinceTs || (e.timestamp || '') >= sinceTs));
        const seen = new Set();
        const bullets = [];
        for (let i = log.length - 1; i >= 0 && bullets.length < 3; i--) {
          const e = log[i];
          if (!e.field || seen.has(e.field)) continue;
          seen.add(e.field);
          bullets.push('<li>' + esc(e.field) + ': ' + esc(String(e.old_value || '')) + ' → ' + esc(String(e.new_value || '')) + '</li>');
        }
        if (bullets.length) {
          movers = '<div style="font-size:10px;color:var(--text-muted);margin-top:4px">What moved</div>' +
                   '<ul style="margin:2px 0 0 14px;padding:0;font-size:11px;color:var(--text-dark-secondary)">' + bullets.join('') + '</ul>';
        }
      } catch (_) { /* audit log may be absent — fine */ }
      return '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border-light)">' +
        '<div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px"><span>Plan vs actual</span><span style="font-weight:400;text-transform:none;letter-spacing:0">' + esc(setMeta) + '</span></div>' +
        '<div style="font-size:11px;color:var(--text-dark-secondary);margin-top:2px"><span style="color:var(--text-muted)">Baseline</span> ' + fmtD(baseStart) + ' → ' + fmtD(baseEnd) + ' · ' + baseSize + ' SP</div>' +
        '<div style="font-size:11px;color:var(--text-dark-secondary)"><span style="color:var(--text-muted)">Current</span> ' + fmtD(liveStart) + ' → ' + fmtD(liveEnd) + ' · ' + liveSize + ' SP</div>' +
        '<div style="font-size:10px;color:var(--text-muted);margin-top:2px">' + startBit + ' · ' + targetBit + ' · ' + sizeBit + '</div>' +
        movers +
      '</div>';
    };
```

- [ ] **Step 5: Append the block to bar / label tooltips**

Edit `index.html:16040` — find the existing `bar`/`label` return statement:
```js
return '<div class="gantt-tooltip-title">' + esc(p.name) + ... +
  buildAssigneeLine(p, null) + buildPhaseBreakdown(p) + buildProjectSummary(p);
```
Append `+ buildPlanVsActual(p)` immediately after `buildPhaseBreakdown(p)`:
```js
return '<div class="gantt-tooltip-title">' + esc(p.name) + ... +
  buildAssigneeLine(p, null) + buildPhaseBreakdown(p) + buildPlanVsActual(p) + buildProjectSummary(p);
```

- [ ] **Step 6: Add baseline tooltip branch**

Edit `index.html:16141` — just before the final `return '';` line in `buildTooltip`, add:
```js
      if (type === 'baseline') {
        const id = el.dataset.id;
        const p = id ? App.data.projects.find(pr => pr.id === id) : null;
        if (!p) return '';
        const projHeader = '<div style="font-size:11px;font-weight:600;color:var(--text-dark-secondary);margin-bottom:3px">' + esc(p.name) +
          ' <span style="font-size:9px;padding:1px 4px;border-radius:3px;background:' + App.customerColor(p.customer) + '20;color:' + App.customerColor(p.customer) + '">' + esc(p.customer) + '</span></div>';
        const block = buildPlanVsActual(p);
        if (!block) return projHeader + '<div style="font-size:11px;color:var(--text-muted)">Project not in active baseline.</div>';
        return projHeader + block;
      }
```

- [ ] **Step 7: Bump tooltip max-width**

Edit `index.html:1371` — find:
```css
.gantt-tooltip { position: fixed; z-index: 1500; ... padding: 10px 14px; font-size: 11px; max-width: 300px; ... }
```
Change `max-width: 300px` to `max-width: 360px`.

- [ ] **Step 8: Run new test — it should pass**

Run: `npm run test:unit -- gantt-baseline-hover.test.mjs`
Expected: PASS — both cases green.

- [ ] **Step 9: Run full unit suite**

Run: `npm run test:unit`
Expected: pass.

- [ ] **Step 10: Manual smoke**

Set a baseline → edit a project's target +14 days → hover the bar. Tooltip now contains "Plan vs actual" with `Baseline 14 Apr → 26 Jun · 38 SP` style rows, plus a `What moved` bullet list (or no bullets if audit log is empty). Hover the bracket directly: same content focused on the project. Project not in baseline: bracket says "Project not in active baseline."

- [ ] **Step 11: Commit**

```bash
git add index.html tests/render/gantt-baseline-hover.test.mjs
git commit -m "feat(gantt): add Plan vs actual block to tooltip + baseline hover type"
```

---

## Task 13: E2E test for baseline bracket hover

**Files:**
- New: `tests/e2e/gantt-baseline.spec.ts`

- [ ] **Step 1: Create the e2e spec**

Create `tests/e2e/gantt-baseline.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Gantt baseline bracket: hover surfaces Plan vs actual', async ({ page }) => {
  await openAppWithData(page);

  // Navigate to roadmap.
  await page.click('.nav-item[data-view="roadmap"]');
  await expect(page.locator('#ganttLabels')).toBeVisible();

  // Set a baseline programmatically through the bridge — avoids the named-baseline modal.
  await page.evaluate(() => {
    const w = window as any;
    const cust = w.App.activeCustomer;
    const proj = w.App.data.projects.find((p: any) => p.customer === cust);
    if (!proj) return;
    proj.baseline_start = proj.start_date;
    proj.baseline_end = proj.target_date;
    // Slip target by 14 days.
    const d = new Date(proj.target_date);
    d.setDate(d.getDate() + 14);
    proj.target_date = d.toISOString().split('T')[0];
    // Force the legacy fallback path — no named baseline needed.
    const cb = document.getElementById('ganttBaseline') as HTMLInputElement;
    if (cb) cb.checked = true;
    w.Gantt.render();
  });

  // Bracket should be present.
  const bracket = page.locator('.gantt-baseline-bracket').first();
  await expect(bracket).toBeVisible();

  // Hover surfaces tooltip with Plan vs actual block.
  await bracket.hover();
  await expect(page.locator('#ganttTooltip')).toContainText('Plan vs actual');
  await expect(page.locator('#ganttTooltip')).toContainText('Baseline');
  await expect(page.locator('#ganttTooltip')).toContainText('Current');
});
```

- [ ] **Step 2: Run the e2e spec**

Run: `npm run test:e2e -- gantt-baseline.spec.ts`
Expected: PASS.

- [ ] **Step 3: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/gantt-baseline.spec.ts
git commit -m "test(e2e): hover baseline bracket surfaces Plan vs actual"
```

---

## Task 14: Final verification + cleanup

**Files:** none modified — verification only.

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: all green (unit + render + e2e).

- [ ] **Step 2: Manual smoke checklist**

Open `index.html`, load demo data, then:

- [ ] Navigation shows "Meetings" (not "Forums") in left nav.
- [ ] Governance Meetings page heading reads "Governance Meetings".
- [ ] Add Meeting → modal title reads "Add Meeting"; Edit → "Edit Meeting".
- [ ] Detail panel field label reads "Meeting" (not "Forum").
- [ ] Spotlight (Cmd-K) shows a "Meetings" group.
- [ ] Roadmap milestone glyphs (deadline / launch / UAT / external-dep) all render black-on-white. Toggle dark theme: glyphs flip to light-on-dark and stay legible.
- [ ] Set a baseline on Roadmap → projects render bracket above bar.
- [ ] Slip a project: pill shows `+Nd` red.
- [ ] Pull a project in: pill shows `−Nd` green.
- [ ] Project unchanged: pill says `on plan`.
- [ ] Hover bar / label / bracket: tooltip contains a "Plan vs actual" block with baseline + current rows and a delta line.
- [ ] Project not in baseline: no bracket, no pill; bracket-hover-equivalent on bar shows tooltip without Plan-vs-actual block.

- [ ] **Step 3: grep for stale strings**

Run: `grep -n "Forums\|Forum\b\|forum '" index.html | grep -v "governance_forum\|openForum\|saveForum\|closeForumModal\|openForumModal\|completeForumAction\|deferForumAction\|forumModalTitle\|forumModalOverlay\|forumIdx\|forum-edit\|forum-modal\|navBadgeForums\|govForumCount\|govForumsContent\|existingForumMap\|updatedForums\|addedForums\|upcomingForums\|govForums\|allForums\|buildForumPackDoc\|forums7\|data-tab=\"forums\"\|switchTab('forums')\|fixAction: 'clear_forum'\|c === 'forum'"`
Expected: empty output (any remaining lines are user-facing strings that need rename).

- [ ] **Step 4: Push branch / open PR**

```bash
git push -u origin <branch-name>
gh pr create --title "Gantt clarity (black icons, baseline bracket, hover commentary) + Forums → Meetings rename" --body "$(cat <<'EOF'
## Summary
- Repaints all Gantt milestone glyphs (deadline / launch / UAT / external-dep) as black-on-white outlines so meaning is carried by shape rather than competing with RAG/customer/skill colours.
- Replaces the dashed-strip baseline + slip-arrow with a bracket-above-bar + delta pill (`+Nd` red / `−Nd` green / `on plan` muted) so plan-vs-actual is readable at a glance.
- Adds a "Plan vs actual" block to the hover tooltip on bars, labels, and the new bracket — shows baseline vs current dates + scope, plus a top-3 "what moved" narrative pulled from the audit log.
- Renames Forums → Governance Meetings in every user-visible string. Data keys (`governance_forums`, `governance_forum`), JS function names, CSS classes, and DOM IDs unchanged for backward compatibility.

## Test plan
- [x] `npm run test:unit` — passes (legend snapshot regen, new bracket + hover tests added)
- [x] `npm run test:e2e` — passes (new gantt-baseline.spec.ts)
- [x] Manual smoke: navigation, governance flows, milestone repaint in light + dark, baseline bracket + pill states, hover commentary

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Verify PR opens green in CI**

Wait for CI; check that both the unit job and the e2e job succeed.

---

## Spec Self-Review

Coverage check vs spec sections:

| Spec section | Implemented in tasks |
|---|---|
| §1 Milestone icons → black | Tasks 5, 6, 7, 8 |
| §1 Reference lines unchanged | Verified in spec — no task needed (no edit) |
| §2 Bracket + delta pill | Tasks 9, 10 |
| §2 Edge cases (baseline only start, overflow, executiveMode, project added after baseline) | Covered by Task 10's snapshot fallback chain (`_projectBaselineSpan` → `node.start_date/target_date` → legacy `baseline_start/end`); the `if (bStart && bEnd)` guard handles the start-only case by skipping render |
| §3 Hover card | Tasks 11, 12, 13 |
| §3 Width bump 300 → 360 | Task 12 step 7 |
| §3 Audit-log v1 fallback | Task 12 step 4 — `try { … } catch` ensures graceful degradation |
| §4 Forums → Meetings rename | Tasks 1, 2, 3, 4 |
| §4 Untouched code identifiers list | Task 14 step 3 grep verifies no UI-string Forum references remain |
| Test plan §unit | Tasks 8, 10, 12 |
| Test plan §e2e | Task 13 |
| Test plan §manual | Task 14 step 2 |
| Risks: row-height shift breaks PDF/PNG export | Task 9 step 2 keeps row height effectively unchanged (bar shifts 2 px down, bracket fills the freed 2 px above + 4 px previously used by dashed strip) — no row-height change passed to export code |
