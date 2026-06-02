# Nav/IA Restructure + UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Delivery nav into a chronological order with Governance/Actions folded in and the Strategy vertical line removed, add an owner filter to the renamed "Actions" view, tighten the Capacity sprint window with the current sprint emphasised, and fix two visual bugs (table side-shading, assignee-circle overlap).

**Architecture:** All changes live in the single file `index.html` (~18k lines: CSS in one `<style>`, HTML in `<body>`, JS in one `<script>`). No framework/build. Nav is static HTML in the sidebar; the Actions view is rendered by the `MyActions` JS object; the Capacity view is rendered by `Sprint.renderSwimLane`. Tests are vitest+jsdom (unit/render) and Playwright (e2e).

**Tech Stack:** Vanilla HTML/CSS/JS single file; vitest + jsdom; Playwright + chromium-headless-shell.

**Conventions (from CLAUDE.md):** inline SVG only (no emojis), `:root` tokens (no hardcoded colour/size values where a token exists), `Dashboard.esc()` for user content, integer points. No behaviour/ID/`data-*` hook changes beyond the explicit `My Actions`→`Actions` text rename (the `data-view="myactions"` key and `id="navMyActions"` are preserved).

**Run tests with:** `npm test` (full suite). For a single unit file: `npx vitest run tests/unit/<file>.mjs`. For a single e2e: `npx playwright test tests/e2e/<file>.spec.ts`.

---

## File Structure

- **Modify:** `index.html`
  - Nav sidebar block (currently lines ~3344-3393) — reorder + regroup Delivery items.
  - CSS `.nav-strategy-group` rule (line ~542) — delete (removes the vertical line).
  - CSS `.persona-table-wrap` (lines ~940-952) and `.metric-library-wrap` (lines ~1060-1079) — remove dark edge-gradient layers.
  - CSS `.sl-chip-assignee` (line ~2825) — enlarge circle so 2-letter initials fit.
  - CSS `.sprint-swimlane th.sl-sprint-current` (near line ~1900) — widen the emphasised current column.
  - `MyActions` object (lines ~18270+) — rename title, add owner filter.
  - Customer-mode label swap (line ~8956) — `My Actions`→`Actions`.
  - `App` viewNames map (line ~7528) — `myactions: 'My Actions'`→`'Actions'`.
  - Page heading h2 (line ~3447) — `My Actions`→`Actions`.
  - `Sprint.renderSwimLane` (line ~28078+) — window the `sprints` array.
- **Create:** `tests/unit/nav-delivery-order.test.mjs` — asserts the new Delivery order/grouping.
- **Create:** `tests/unit/actions-owner-filter.test.mjs` — asserts owner-filter behaviour.
- **Create:** `tests/unit/capacity-sprint-window.test.mjs` — asserts the one-past-sprint window.
- **Modify:** `tests/unit/ux-benchmark-wave5.test.mjs` — update the `My Actions`→`Actions` label assertion.

---

## Task 1: Restructure the Delivery nav (requests 1, 2, 4, 8)

Reorder the Delivery section to `Projects, RAID, Governance, Actions` then `— Planning —` (`Backlog, Roadmap, Sprint Planning, Capacity`) then `— Strategy —` (`Strategy, Personas, Metrics`). Remove the `.nav-strategy-group` wrapper (and its CSS) so the vertical line disappears and Strategy becomes a plain labelled subsection. (The Actions text rename is done in Task 2; here the item keeps its current "My Actions" label.)

**Files:**
- Create: `tests/unit/nav-delivery-order.test.mjs`
- Modify: `index.html` (nav block ~3344-3393; CSS rule line ~542)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/nav-delivery-order.test.mjs`:

```javascript
// Delivery nav: chronological reorder — RAID/Governance/Actions at top with Projects,
// then a Planning subsection (Backlog first), then a Strategy subsection (Personas before
// Metrics). No nav-strategy-group wrapper (the vertical line is gone).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const boot = () => loadApp(makeDataset({
  projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
  customers: [{ name: 'Acme Industries', color: '#6366f1' }]
}));

const deliverySection = (app) => {
  const sections = Array.from(app.document.querySelectorAll('.nav-section'));
  return sections.find(s => {
    const label = s.querySelector('.nav-section-label');
    return label && /delivery/i.test(label.textContent || '');
  });
};

describe('Delivery nav — chronological order', () => {
  it('RAID, Governance and Actions sit at the top with Projects, before any subsection label', async () => {
    const app = await boot();
    const sec = deliverySection(app);
    const children = Array.from(sec.children);
    const firstSubLabelIdx = children.findIndex(c => c.classList.contains('nav-subsection-label'));
    const topViews = children.slice(0, firstSubLabelIdx)
      .filter(c => c.classList.contains('nav-item'))
      .map(c => c.getAttribute('data-view'));
    expect(topViews).toEqual(['dashboard', 'raid', 'governance', 'myactions']);
    app.teardown();
  });

  it('Backlog is the first item under the Planning subsection', async () => {
    const app = await boot();
    const sec = deliverySection(app);
    const children = Array.from(sec.children);
    const planningIdx = children.findIndex(c => c.classList.contains('nav-subsection-label') && /planning/i.test(c.textContent));
    expect(planningIdx).toBeGreaterThan(-1);
    expect(children[planningIdx + 1].getAttribute('data-view')).toBe('backlog');
    app.teardown();
  });

  it('Strategy subsection lists Strategy, Personas, then Metrics (Personas before Metrics)', async () => {
    const app = await boot();
    const sec = deliverySection(app);
    const children = Array.from(sec.children);
    const stratIdx = children.findIndex(c => c.classList.contains('nav-subsection-label') && /strategy/i.test(c.textContent));
    expect(stratIdx).toBeGreaterThan(-1);
    const after = children.slice(stratIdx + 1).filter(c => c.classList.contains('nav-item')).map(c => c.getAttribute('data-view'));
    expect(after.slice(0, 3)).toEqual(['strategy', 'personas', 'metrics']);
    app.teardown();
  });

  it('the nav-strategy-group wrapper (vertical line) is gone', async () => {
    const app = await boot();
    expect(app.document.querySelector('.nav-strategy-group')).toBeFalsy();
    app.teardown();
  });

  it('all Delivery routes still resolve', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    for (const v of ['dashboard', 'raid', 'governance', 'myactions', 'backlog', 'roadmap', 'sprint', 'capacity', 'strategy', 'personas', 'metrics']) {
      app.App.navigate(v);
      expect(app.App.currentView).toBe(v);
    }
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/nav-delivery-order.test.mjs`
Expected: FAIL — the first test gets `['dashboard','roadmap','backlog','raid']` (current order) instead of `['dashboard','raid','governance','myactions']`; the `.nav-strategy-group` test fails because the wrapper still exists.

- [ ] **Step 3: Reorder the nav HTML**

In `index.html`, replace the entire Delivery `<div class="nav-section">…</div>` block (the one whose label is `…Delivery`, currently lines ~3344-3393) with the block below. Each `<div class="nav-item">` is moved **verbatim** from the current file (same SVG, same `onclick`, same `title`); only the order, the removal of the `nav-strategy-group` wrapper, and the relocation of the `— Planning —` / `— Strategy —` labels change. (The "My Actions" label text is changed in Task 2.)

```html
    <div class="nav-section">
      <div class="nav-section-label" id="navScopeCustomerLabel"><span class="nav-scope-customer-chip" id="navScopeCustomerChip"></span>Delivery</div>
      <div class="nav-item active" data-view="dashboard" onclick="App.navigate('dashboard')" title="This customer only — projects">
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
        Projects <span class="nav-badge" id="navBadgeTotal">0</span>
      </div>
      <div class="nav-item nav-item-raid" data-view="raid" id="navRaidSingle" onclick="if(typeof RaidView!=='undefined')RaidView.showAll=false;App.navigate('raid')" title="Risks / Assumptions / Issues / Decisions — toggle all-customers in-view">
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        RAID <span class="nav-badge" id="navBadgeRaid">0</span>
      </div>
      <div class="nav-item" data-view="governance" onclick="App.navigate('governance')" title="This customer only — governance forums & decisions">
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/></svg>
        Governance <span class="nav-badge" id="navBadgeForums" style="display:none">0</span>
      </div>
      <div class="nav-item" data-view="myactions" id="navMyActions" onclick="App.navigate('myactions')" title="This customer only — decisions awaiting approval + overdue actions">
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
        My Actions <span class="nav-badge" id="navBadgeMyActions">0</span>
      </div>
      <div class="nav-subsection-label">Planning</div>
      <div class="nav-item" data-view="backlog" onclick="App.navigate('backlog')" title="This customer only — Unrefined / Refined / Parked">
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/></svg>
        <span>Backlog</span>
      </div>
      <div class="nav-item" data-view="roadmap" onclick="App.navigate('roadmap')" title="This customer only — delivery timeline">
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="10" height="4" rx="1"/><rect x="7" y="11" width="10" height="4" rx="1"/><rect x="11" y="17" width="10" height="4" rx="1"/></svg>
        Roadmap
      </div>
      <div class="nav-item" data-view="sprint" onclick="App.navigate('sprint')" title="This customer only — sprint allocation">
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3.5-7.1"/><polyline points="21 4 21 10 15 10"/></svg>
        Sprint Planning
      </div>
      <div class="nav-item" data-view="capacity" onclick="App.navigate('capacity')" title="This customer only — team capacity & workload">
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Capacity
      </div>
      <div class="nav-subsection-label">Strategy</div>
      <div class="nav-item" data-view="strategy" onclick="App.navigate('strategy')" title="This customer only — Personas, Objectives, and Metrics inventory">
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/></svg>
        Strategy
      </div>
      <div class="nav-item" data-view="personas" onclick="App.navigate('personas')" title="This customer only — Persona hierarchy + assigned people">
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 21v-1a4 4 0 014-4h4a4 4 0 014 4v1"/><circle cx="17" cy="9" r="2"/><path d="M16 21v-1a3 3 0 013-3h0a3 3 0 013 3v1"/></svg>
        Personas
      </div>
      <div class="nav-item" data-view="metrics" onclick="App.navigate('metrics')" title="This customer only — Metric library with RACI and cascade">
        <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 18 9 12 13 16 21 8"/><polyline points="14 8 21 8 21 15"/></svg>
        Metrics
      </div>
    </div>
```

- [ ] **Step 4: Remove the `.nav-strategy-group` CSS (the vertical line)**

In `index.html` delete line ~542 in full:

```css
.nav-strategy-group { position: relative; margin-left: var(--space-2); padding-left: var(--space-3); border-left: 1px solid var(--border-dim, var(--border-color)); }
```

- [ ] **Step 5: Run the new test to verify it passes**

Run: `npx vitest run tests/unit/nav-delivery-order.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the nav regression tests to confirm no breakage**

Run: `npx vitest run tests/unit/slot-h-nav-raid.test.mjs tests/unit/ia-scope-clarity.test.mjs`
Expected: PASS — the three top-level section labels (Portfolio / Delivery / System), the single RAID item in Delivery, and Strategy/Metrics/Personas/Governance Delivery-membership are all unchanged.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/unit/nav-delivery-order.test.mjs
git commit -m "feat(nav): chronological Delivery order; remove Strategy vertical line"
```

---

## Task 2: Rename "My Actions" → "Actions" (request 3, part 1)

Rename the visible label everywhere while keeping `data-view="myactions"`, `id="navMyActions"`, and `id="navBadgeMyActions"` for back-compat.

**Files:**
- Modify: `index.html` (nav item text ~3373; page h2 ~3447; viewNames map ~7528; customer-mode label swap ~8956)
- Modify: `tests/unit/ux-benchmark-wave5.test.mjs`

- [ ] **Step 1: Update the failing assertion in the existing test**

In `tests/unit/ux-benchmark-wave5.test.mjs`, the test "relabels My Actions + RAID…" asserts the restored full-mode label. Change the final restore assertion (currently `expect(ma.textContent).toMatch(/My Actions/);`) to:

```javascript
    // restoring full mode brings the labels back
    app.App.customerMode = false;
    app.App._applyCustomerMode();
    expect(ma.textContent).toMatch(/Actions/);
    expect(ma.textContent).not.toMatch(/My Actions/);
    app.teardown();
```

Leave the customer-mode assertion `expect(ma.textContent).toMatch(/For your attention/);` unchanged.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/ux-benchmark-wave5.test.mjs`
Expected: FAIL — full-mode label is still "My Actions", so `not.toMatch(/My Actions/)` fails.

- [ ] **Step 3: Rename in the nav item**

In `index.html` line ~3373, change:

```html
        My Actions <span class="nav-badge" id="navBadgeMyActions">0</span>
```

to:

```html
        Actions <span class="nav-badge" id="navBadgeMyActions">0</span>
```

- [ ] **Step 4: Rename the page heading**

In `index.html` line ~3447, change `<h2 class="portfolio-title">My Actions</h2>` to:

```html
            <h2 class="portfolio-title">Actions</h2>
```

- [ ] **Step 5: Rename in the viewNames map**

In `index.html` line ~7528, within the `names` object, change `myactions: 'My Actions'` to `myactions: 'Actions'`. The surrounding line stays intact; only that one value changes.

- [ ] **Step 6: Update the customer-mode label swap**

In `index.html` line ~8956, change:

```javascript
    setNavLabel('#navMyActions', on ? 'For your attention' : 'My Actions');
```

to:

```javascript
    setNavLabel('#navMyActions', on ? 'For your attention' : 'Actions');
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/unit/ux-benchmark-wave5.test.mjs`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add index.html tests/unit/ux-benchmark-wave5.test.mjs
git commit -m "feat(actions): rename 'My Actions' to 'Actions' (data-view preserved)"
```

---

## Task 3: Add the Actions owner filter (request 3, part 2)

Add an owner dropdown to the Actions view, defaulting to "All owners". It filters the **Overdue actions** and **Blockers** lists by `owner`; **Decisions** are always shown (no owner). The nav badge stays unfiltered. The filter toolbar is hidden in customer mode.

**Files:**
- Create: `tests/unit/actions-owner-filter.test.mjs`
- Modify: `index.html` (`MyActions` object — add `ownerFilter` state, `setOwnerFilter`, toolbar + filtering in `render()`)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/actions-owner-filter.test.mjs`:

```javascript
// Actions view owner filter: defaults to All owners; filtering by an owner narrows the
// Overdue-actions and Blockers lists but never the Decisions list; nav badge is unfiltered.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const PAST = '2020-01-01'; // safely overdue

const boot = () => loadApp(makeDataset({
  projects: [makeProject({
    id: 'P1', name: 'Proj One', customer: 'Acme Industries',
    issues_register: [
      { id: 'i1', description: 'Issue owned by Priya', status: 'open', owner: 'Priya' },
      { id: 'i2', description: 'Issue owned by Sam', status: 'open', owner: 'Sam' }
    ]
  })],
  customers: [{ name: 'Acme Industries', color: '#6366f1' }],
  governance_forums: [{
    name: 'Steering', customer: 'Acme Industries',
    decisions: [{ text: 'Approve scope', state: 'Proposed' }],
    actions: [
      { description: 'Action for Priya', owner: 'Priya', due_date: PAST, status: 'Open' },
      { description: 'Action for Sam', owner: 'Sam', due_date: PAST, status: 'Open' }
    ]
  }]
}));

describe('Actions owner filter', () => {
  it('defaults to All owners and shows every owner\'s actions and blockers', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('myactions');
    expect(app.MyActions.ownerFilter).toBe('');
    const body = app.document.getElementById('myActionsBody').innerHTML;
    expect(body).toMatch(/Action for Priya/);
    expect(body).toMatch(/Action for Sam/);
    expect(body).toMatch(/Issue owned by Priya/);
    expect(body).toMatch(/Issue owned by Sam/);
    app.teardown();
  });

  it('renders an owner dropdown listing the distinct owners plus All owners', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('myactions');
    const sel = app.document.getElementById('actionsOwnerFilter');
    expect(sel).toBeTruthy();
    const opts = Array.from(sel.options).map(o => o.value);
    expect(opts[0]).toBe(''); // All owners
    expect(opts).toContain('Priya');
    expect(opts).toContain('Sam');
    app.teardown();
  });

  it('filtering to one owner narrows actions + blockers but keeps decisions', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('myactions');
    app.MyActions.setOwnerFilter('Priya');
    const body = app.document.getElementById('myActionsBody').innerHTML;
    expect(body).toMatch(/Action for Priya/);
    expect(body).not.toMatch(/Action for Sam/);
    expect(body).toMatch(/Issue owned by Priya/);
    expect(body).not.toMatch(/Issue owned by Sam/);
    expect(body).toMatch(/Approve scope/); // decision always shown
    app.teardown();
  });

  it('nav badge stays unfiltered after filtering', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('myactions');
    const before = app.document.getElementById('navBadgeMyActions').textContent;
    app.MyActions.setOwnerFilter('Priya');
    const after = app.document.getElementById('navBadgeMyActions').textContent;
    expect(after).toBe(before);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/actions-owner-filter.test.mjs`
Expected: FAIL — `app.MyActions.ownerFilter` is undefined; `#actionsOwnerFilter` does not exist; `setOwnerFilter` is not a function.

- [ ] **Step 3: Add `ownerFilter` state + `setOwnerFilter` method**

In `index.html`, in the `MyActions` object, immediately after the opening line `const MyActions = {` (line ~18270), insert:

```javascript
  ownerFilter: '',
  setOwnerFilter(value) {
    this.ownerFilter = value || '';
    this.render();
  },
```

- [ ] **Step 4: Apply the filter and render the toolbar in `render()`**

In `MyActions.render()`, the body currently does `const { decisions, actions, blockers } = this.collect();`. Replace that line with the block below, which keeps the unfiltered sets for the badge, derives the owner list, and produces filtered `actions`/`blockers` for display:

```javascript
    const all = this.collect();
    const decisions = all.decisions;
    // Distinct owners across actions + blockers (non-empty), sorted.
    const ownerSet = new Set();
    all.actions.forEach(a => { if (a.action.owner) ownerSet.add(a.action.owner); });
    all.blockers.forEach(b => { if (b.row.owner) ownerSet.add(b.row.owner); });
    const owners = Array.from(ownerSet).sort((x, y) => x.localeCompare(y));
    const of = this.ownerFilter;
    const actions = of ? all.actions.filter(a => (a.action.owner || '') === of) : all.actions;
    const blockers = of ? all.blockers.filter(b => (b.row.owner || '') === of) : all.blockers;
    // Owner filter toolbar (hidden in customer mode — internal triage control).
    const ownerToolbar = App.customerMode ? '' :
      '<div style="display:flex;justify-content:flex-end;align-items:center;gap:6px">' +
        '<label for="actionsOwnerFilter" style="font-size:var(--fs-xs);color:var(--text-muted)">Owner</label>' +
        '<select id="actionsOwnerFilter" onchange="MyActions.setOwnerFilter(this.value)" style="font-size:var(--fs-xs);padding:3px 8px;border:1px solid var(--border-dim);border-radius:var(--radius-sm);background:var(--surface);color:var(--text-dark)">' +
          '<option value=""' + (of === '' ? ' selected' : '') + '>All owners</option>' +
          owners.map(o => '<option value="' + esc(o) + '"' + (of === o ? ' selected' : '') + '>' + esc(o) + '</option>').join('') +
        '</select>' +
      '</div>';
```

Then prepend the toolbar to the rendered HTML. The render assigns `const html = '<div…decisions…'` then later `body.innerHTML = html;`. Change that assignment to lead with the toolbar by editing the final assignment to:

```javascript
    body.innerHTML = ownerToolbar + html;
```

(Leave the existing `const html = …` construction and the trailing `this.updateNavBadge();` unchanged. `updateNavBadge()` calls `collect()` itself, so it remains unfiltered.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/actions-owner-filter.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the existing My Actions tests to confirm no breakage**

Run: `npx vitest run tests/unit/ux-benchmark-wave2.test.mjs tests/unit/ux-benchmark-wave3.test.mjs tests/unit/ux-benchmark-wave5.test.mjs tests/render/myactions-badge.test.mjs`
Expected: PASS — customer-mode body still shows the decision and hides Approve; badge load-time behaviour unchanged.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/unit/actions-owner-filter.test.mjs
git commit -m "feat(actions): owner filter (default All; filters actions+blockers, not decisions)"
```

---

## Task 4: Trim the Capacity sprint window + emphasise current (request 7)

In `Sprint.renderSwimLane`, narrow the rendered sprint set to **one most-recent past sprint + the current sprint + all future sprints**, and make the current column wider. The current column already gets the `sl-sprint-current` class (both `th` and `td`) via the existing `sprintPhase()` classification, so the emphasis is a CSS width bump on that class.

**Files:**
- Create: `tests/unit/capacity-sprint-window.test.mjs`
- Modify: `index.html` (`Sprint.renderSwimLane` ~28078; CSS `.sprint-swimlane th.sl-sprint-current` ~1901)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/capacity-sprint-window.test.mjs`. This drives `renderSwimLane` and asserts the rendered sprint-header columns include at most one "Past" pill.

```javascript
// Capacity: show at most one past sprint, the current sprint, and all future sprints.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

// Build sprints around a fixed "today" the harness clock returns. The view classifies by
// comparing start/end ISO dates to today; we straddle today with 3 past + 1 current + 2 future.
function datasetWithSprints() {
  const sprints = [
    { sprint_id: 'CY24-S1', start_date: '2000-01-01', end_date: '2000-02-01' },
    { sprint_id: 'CY24-S2', start_date: '2000-02-02', end_date: '2000-03-01' },
    { sprint_id: 'CY24-S3', start_date: '2000-03-02', end_date: '2000-04-01' },
    { sprint_id: 'CY99-S4', start_date: '2000-04-02', end_date: '2999-01-01' }, // spans today => current
    { sprint_id: 'CY99-S5', start_date: '2999-01-02', end_date: '2999-02-01' },
    { sprint_id: 'CY99-S6', start_date: '2999-02-02', end_date: '2999-03-01' }
  ];
  return makeDataset({
    projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    sprints
  });
}

describe('Capacity sprint window', () => {
  it('renders at most one Past sprint column and keeps current + futures', async () => {
    const app = await loadApp(datasetWithSprints());
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('capacity');
    // The swim-lane header pills carry the phase: count rendered phase pills.
    const board = app.document.querySelector('.sprint-swimlane') || app.document.body;
    const pills = Array.from(board.querySelectorAll('.sl-sprint-phase-pill')).map(p => p.textContent.trim().toLowerCase());
    const pasts = pills.filter(t => t === 'past');
    const currents = pills.filter(t => t === 'current');
    expect(pasts.length).toBeLessThanOrEqual(1);
    expect(currents.length).toBe(1);
    // futures still present
    expect(pills.filter(t => t === 'future').length).toBeGreaterThanOrEqual(1);
    app.teardown();
  });
});
```

Note: if the Capacity view in this harness renders via a different entry than `.sprint-swimlane`, the test falls back to scanning the whole document for `.sl-sprint-phase-pill`, which only the swim-lane header emits — so the assertion is still valid.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/capacity-sprint-window.test.mjs`
Expected: FAIL — currently all three past sprints render, so `pasts.length` is 3.

- [ ] **Step 3: Window the `sprints` array in `renderSwimLane`**

In `index.html` `Sprint.renderSwimLane(board)`, find the line (~28080):

```javascript
    const sprints = App.data.sprints || [];
```

Replace it with the windowing logic below. It sorts by `start_date`, classifies each sprint with the same rule the header uses, keeps only the last past sprint + current + all futures, and falls back to the nearest upcoming sprint as the focus when nothing spans today:

```javascript
    const _allSprints = (App.data.sprints || []).slice().sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
    const _todayISO = new Date().toISOString().split('T')[0];
    const _phase = (s) => {
      if (s.end_date && s.end_date < _todayISO) return 'past';
      if (s.start_date && s.start_date <= _todayISO && (!s.end_date || s.end_date >= _todayISO)) return 'current';
      return 'future';
    };
    const _pasts = _allSprints.filter(s => _phase(s) === 'past');
    const _currents = _allSprints.filter(s => _phase(s) === 'current');
    const _futures = _allSprints.filter(s => _phase(s) === 'future');
    // Window: at most one (most recent) past sprint, the current sprint, then all futures.
    // If no sprint spans today, the nearest upcoming sprint becomes the focus (still one prior shown).
    const sprints = (_pasts.length ? [_pasts[_pasts.length - 1]] : [])
      .concat(_currents)
      .concat(_futures);
```

(Everything downstream — `sprintCapCache`, `sprintTotals`, the `thead`/`tbody` loops — already iterates this `sprints` variable, so the window applies uniformly.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/capacity-sprint-window.test.mjs`
Expected: PASS.

- [ ] **Step 5: Widen the emphasised current column (CSS)**

In `index.html`, find (~line 1901):

```css
.sprint-swimlane th.sl-sprint-current,
.sprint-swimlane td.sl-sprint-current { background: rgba(59, 130, 246, 0.06) !important; border-left: 3px solid var(--accent-blue); }
```

Immediately after that rule, add a width emphasis on the current header (the existing `th.sl-sprint-hdr` rule sets `min-width:130px;max-width:180px` for all sprint headers; this overrides it for the current one):

```css
.sprint-swimlane th.sl-sprint-hdr.sl-sprint-current { min-width: 200px; max-width: 240px; box-shadow: inset 0 2px 0 var(--accent-blue); }
```

- [ ] **Step 6: Run the capacity-adjacent suite**

Run: `npx vitest run tests/unit/capacity-sprint-window.test.mjs && npx vitest run tests/render`
Expected: PASS — no render snapshot covers the swim-lane header column set, so snapshots are unaffected.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/unit/capacity-sprint-window.test.mjs
git commit -m "feat(capacity): window to one past sprint + emphasise current column"
```

---

## Task 5: Remove the metrics/personas side shading (request 5)

Delete the dark edge-gradient "scroll-shadow" layers from the two wide-table wrappers, keeping the always-visible scrollbar (the real overflow affordance) and a plain surface background. This is a pure-CSS change verified visually (jsdom does not compute backgrounds).

**Files:**
- Modify: `index.html` (`.persona-table-wrap` ~940-952; `.metric-library-wrap` ~1060-1079)

- [ ] **Step 1: Simplify `.persona-table-wrap` background**

In `index.html` replace the `.persona-table-wrap { … }` rule (lines ~940-952) with:

```css
.persona-table-wrap {
  flex: 1; min-height: 0; overflow-x: scroll; overflow-y: auto; -webkit-overflow-scrolling: touch;
  scrollbar-width: thin; scrollbar-gutter: stable;
  background: var(--surface);
}
```

- [ ] **Step 2: Simplify `.metric-library-wrap` background**

In `index.html` replace the `.metric-library-wrap { … }` rule (lines ~1060-1079, the block with the `overflow-x:scroll` comment and the four gradient layers) with:

```css
.metric-library-wrap {
  flex: 1; min-height: 0; overflow-x: scroll; overflow-y: auto; -webkit-overflow-scrolling: touch;
  scrollbar-width: thin; scrollbar-gutter: stable;
  background: var(--surface);
}
```

(Leave the `::-webkit-scrollbar*` rules for both wrappers untouched — they keep the classic always-visible scrollbar.)

- [ ] **Step 3: Visual verification**

Launch the app and check the Metrics and Personas views in the browser (see Task 7 for the launch recipe). Confirm: no dark vertical band on the left/right edges of the metrics/persona tables; the horizontal scrollbar is still visible; horizontal scrolling still works.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix(strategy): remove dark scroll-shadow side-shading on metrics/personas tables"
```

---

## Task 6: Fix the assignee-circle initials overlap (request 6)

`.sl-chip-assignee` is a 16px dark circle holding two uppercase initials at the 11px font floor; the letters are cramped/overlap. Enlarge the circle and neutralise the negative letter-spacing so two characters fit. Pure-CSS, verified visually.

**Files:**
- Modify: `index.html` (`.sl-chip-assignee` ~2825)

- [ ] **Step 1: Resize the circle**

In `index.html` replace the `.sl-chip-assignee { … }` rule (line ~2825) with:

```css
.sl-chip-assignee { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: var(--bg-tertiary); color: white; font-size: var(--fs-2xs); font-weight: 700; margin-left: 2px; flex-shrink: 0; line-height: 1; letter-spacing: 0; padding: 0; box-sizing: border-box; }
```

(Width/height 16→20px gives the two 11px initials room; `letter-spacing` -0.3px→0 stops the glyphs touching. `font-size` stays at the `--fs-2xs` 11px floor.)

- [ ] **Step 2: Visual verification**

Launch the app, open Sprint Planning (swim-lane) for a customer with an assignee on a skill chip, and confirm the dark circle shows two clean, non-overlapping initials (e.g. "GH"). Check both light and dark themes (toggle via the header theme control).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix(sprint): enlarge assignee circle so 2-letter initials no longer overlap"
```

---

## Task 7: Full verification + branch wrap-up

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all unit/render + e2e green (the pre-existing baseline is 673 unit / 58 e2e passing; this plan adds 3 new unit files and modifies 1, with no e2e changes). Confirm 0 failures.

- [ ] **Step 2: Launch the app for visual verification**

Serve the file and drive it with the browser MCP (the repo's e2e harness serves on 127.0.0.1):

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Then via the browser tooling, navigate to `http://127.0.0.1:8765/index.html`, select a customer, and verify at 1280px and 1440px widths:
- **Nav:** Delivery shows Projects, RAID, Governance, Actions, then `— Planning —` (Backlog, Roadmap, Sprint Planning, Capacity), then `— Strategy —` (Strategy, Personas, Metrics). No vertical line beside Strategy.
- **Actions:** title reads "Actions"; an "Owner" dropdown defaulting to "All owners" sits top-right; selecting an owner narrows the Overdue-actions and Blockers lists, decisions stay.
- **Capacity:** one past sprint column, the current column wider/highlighted, futures present.
- **Metrics & Personas:** no dark side-shading bands; scrollbar present.
- **Sprint Planning:** assignee circles show clean 2-letter initials.

- [ ] **Step 3: Take screenshots for the record**

Capture the nav sidebar, Actions, Capacity, Metrics, Personas, and a Sprint swim-lane chip with an assignee. Confirm no console errors.

- [ ] **Step 4: Final commit if any verification tweaks were needed**

```bash
git add -A
git commit -m "chore: nav/IA + UI fixes — verification pass"
```

(Skip if nothing changed during verification.)

---

## Self-Review Notes

- **Spec coverage:** request 1 (Governance into Delivery) → Task 1; request 2 (chronological) → Task 1; request 3 (Actions move/rename/owner filter) → Tasks 2+3 (the move was already in Delivery; rename + owner filter cover the intent, default All per the user's choice); request 4 (Backlog → Planning) → Task 1; request 5 (side shading) → Task 5; request 6 (circle overlap) → Task 6; request 7 (capacity window) → Task 4; request 8 (strategy vertical line) → Task 1 Step 4. All eight covered.
- **Naming consistency:** `MyActions.ownerFilter` / `MyActions.setOwnerFilter` used consistently in Task 3 code and tests; `#actionsOwnerFilter` is the dropdown id in both. Capacity uses the existing `sl-sprint-current` class (no new class introduced — simpler than the spec's tentative `sl-sprint-current-focus`).
- **No placeholders:** every code step includes the literal code.
