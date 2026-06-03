# Workstream B — Configurable Sprint Planning Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Sprint Planning swim-lanes show a configurable sprint window (default 1 past + current + all future, current column emphasised as largest), with past/future steppers on the Sprint toolbar persisted globally and driving both Sprint Planning and the Capacity cards.

**Architecture:** Generalise the existing `Sprint._windowedSprints(all)` helper to accept `{past, future}` opts (defaulting to a persisted `sprint.window` UI-state value). Point the two Sprint Planning swim-lane renderers at it (they currently show all sprints); the Capacity card renderer already calls the helper so it auto-follows. Add two `<select>` controls to the Sprint toolbar that write the setting and re-render.

**Tech Stack:** Vanilla HTML/CSS/JS single file `index.html`; vitest + jsdom; Playwright.

**Conventions:** `:root` tokens, inline SVG (no emojis), `Dashboard.esc()`. No `data-view`/id churn. Story points stay integers. Run tests: `npm test`; single file `npx vitest run tests/unit/<f>.mjs`.

---

## File Structure

- **Modify:** `index.html`
  - `Sprint._windowedSprints` (line 28059) → accept `opts`; add `Sprint._windowOpts()` + `Sprint.setWindow()` + `Sprint._syncWindowControls()`.
  - `Sprint.renderSwimLane` sprint list (line 28077) and `Sprint.renderTeamSwimlane` sprint list (line 28314) → use the helper.
  - `Sprint.render()` → call `_syncWindowControls()`.
  - CSS near `.sl-sprint-current` (line 1873-1875) → current-column width emphasis.
  - Sprint toolbar HTML (`#viewSprint .sprint-toolbar`, ~line 3546) → add the two selects.
  - (Capacity `renderSprintCapacity` at line 31682 already calls `_windowedSprints(App.data.sprints)` — no change; it inherits the setting.)
- **Create test:** `tests/unit/sprint-window-config.test.mjs` (helper + setting), `tests/render/sprint-window-swimlane.test.mjs` (swim-lane honours setting + control sync).

---

## Task B1: Generalise the windowing helper + setting accessors

**Files:** Modify `index.html` (`Sprint._windowedSprints` ~28059, add helpers); Create `tests/unit/sprint-window-config.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/sprint-window-config.test.mjs`:

```javascript
// Sprint window helper: configurable past/future counts, 'all', and 0; setting accessors.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

// Clock-relative sprints; validateAndLoad forces end_date = start_date + 34d.
const iso = (offsetDays) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString().split('T')[0]; };
function boot() {
  const sprints = [
    { sprint_id: 'CY-P3', start_date: iso(-150) }, // past (oldest)
    { sprint_id: 'CY-P2', start_date: iso(-110) }, // past
    { sprint_id: 'CY-P1', start_date: iso(-40) },  // past (most recent: ends ~today-6)
    { sprint_id: 'CY-CUR', start_date: iso(-1) },  // current (ends ~today+33)
    { sprint_id: 'CY-F1', start_date: iso(40) },   // future
    { sprint_id: 'CY-F2', start_date: iso(80) },   // future
    { sprint_id: 'CY-F3', start_date: iso(120) }   // future
  ];
  return loadApp(makeDataset({
    projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    sprints
  }));
}
const ids = (r) => r.sprints.map(s => s.sprint_id);

describe('Sprint._windowedSprints with opts', () => {
  it('default (1 past + current + all future)', async () => {
    const app = await boot();
    const r = app.Sprint._windowedSprints(app.App.data.sprints, { past: 1, future: 'all' });
    expect(ids(r)).toEqual(['CY-P1', 'CY-CUR', 'CY-F1', 'CY-F2', 'CY-F3']);
    expect(r.focusId).toBe('CY-CUR');
    app.teardown();
  });
  it('past 0, future 2', async () => {
    const app = await boot();
    const r = app.Sprint._windowedSprints(app.App.data.sprints, { past: 0, future: 2 });
    expect(ids(r)).toEqual(['CY-CUR', 'CY-F1', 'CY-F2']);
    app.teardown();
  });
  it('all past + all future = everything', async () => {
    const app = await boot();
    const r = app.Sprint._windowedSprints(app.App.data.sprints, { past: 'all', future: 'all' });
    expect(ids(r)).toEqual(['CY-P3', 'CY-P2', 'CY-P1', 'CY-CUR', 'CY-F1', 'CY-F2', 'CY-F3']);
    app.teardown();
  });
  it('reads persisted sprint.window when opts omitted', async () => {
    const app = await boot();
    app.App.uiStateSet('sprint.window', { past: 2, future: 1 });
    const r = app.Sprint._windowedSprints(app.App.data.sprints);
    expect(ids(r)).toEqual(['CY-P2', 'CY-P1', 'CY-CUR', 'CY-F1']);
    app.teardown();
  });
});

describe('Sprint._windowOpts normalisation', () => {
  it('defaults to {past:1, future:"all"} when unset', async () => {
    const app = await boot();
    expect(app.Sprint._windowOpts()).toEqual({ past: 1, future: 'all' });
    app.teardown();
  });
  it('coerces string-number and passes "all" through; bad values fall back', async () => {
    const app = await boot();
    app.App.uiStateSet('sprint.window', { past: '3', future: 'all' });
    expect(app.Sprint._windowOpts()).toEqual({ past: 3, future: 'all' });
    app.App.uiStateSet('sprint.window', { past: 'garbage', future: -5 });
    expect(app.Sprint._windowOpts()).toEqual({ past: 1, future: 'all' });
    app.teardown();
  });
});
```

- [ ] **Step 2: Run it, verify it FAILS**

Run: `npx vitest run tests/unit/sprint-window-config.test.mjs`
Expected: FAIL — `_windowedSprints` ignores opts (4-arg slicing not implemented), `_windowOpts` is not a function.

- [ ] **Step 3: Generalise `_windowedSprints` and add `_windowOpts`**

Replace the whole `_windowedSprints(all) { … }` method (index.html ~28059-28074) with:

```javascript
  // Persisted sprint-window setting → normalised { past, future } (int >= 0 or 'all').
  _windowOpts() {
    const raw = (App.uiStateGet && App.uiStateGet('sprint.window', { past: 1, future: 'all' })) || {};
    const norm = (v, d) => {
      if (v === 'all') return 'all';
      if (Number.isInteger(v) && v >= 0) return v;
      if (typeof v === 'string' && /^\d+$/.test(v)) return parseInt(v, 10);
      return d;
    };
    return { past: norm(raw.past, 1), future: norm(raw.future, 'all') };
  },

  // Window the sprint list: keep the last `past` past sprints, the current sprint(s),
  // and the first `future` future sprints ('all' => all, 0 => none). Current is always
  // shown. focusId = current sprint, else nearest upcoming (between cycles).
  _windowedSprints(all, opts) {
    const cfg = opts || this._windowOpts();
    const list = (all || []).slice().sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
    const todayISO = new Date().toISOString().split('T')[0];
    const phase = (s) => {
      if (s.end_date && s.end_date < todayISO) return 'past';
      if (s.start_date && s.start_date <= todayISO && (!s.end_date || s.end_date >= todayISO)) return 'current';
      return 'future';
    };
    const pasts = list.filter(s => phase(s) === 'past');
    const currents = list.filter(s => phase(s) === 'current');
    const futures = list.filter(s => phase(s) === 'future');
    const keepPast = cfg.past === 'all' ? pasts : pasts.slice(Math.max(0, pasts.length - (cfg.past || 0)));
    const keepFuture = cfg.future === 'all' ? futures : futures.slice(0, cfg.future || 0);
    const sprints = keepPast.concat(currents).concat(keepFuture);
    const focusId = currents.length ? currents[0].sprint_id : (futures.length ? futures[0].sprint_id : null);
    return { sprints, focusId };
  },
```

- [ ] **Step 4: Run the test, verify it PASSES**

Run: `npx vitest run tests/unit/sprint-window-config.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Regression — Capacity window test still green (default unchanged)**

Run: `npx vitest run tests/unit/capacity-sprint-window.test.mjs`
Expected: PASS — with no `sprint.window` set, `_windowOpts()` returns `{past:1, future:'all'}`, so Capacity's windowing is unchanged.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/unit/sprint-window-config.test.mjs
git commit -m "feat(sprint): generalise _windowedSprints with past/future opts + persisted setting"
```

---

## Task B2: Sprint Planning swim-lanes honour the window + current-column emphasis

**Files:** Modify `index.html` (`renderSwimLane` ~28077, `renderTeamSwimlane` ~28314, CSS ~1875); Create `tests/render/sprint-window-swimlane.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/render/sprint-window-swimlane.test.mjs`:

```javascript
// Sprint Planning swim-lane honours the sprint.window setting; current column emphasised.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const iso = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return d.toISOString().split('T')[0]; };
function boot() {
  const sprints = [
    { sprint_id: 'CY-P2', start_date: iso(-110) },
    { sprint_id: 'CY-P1', start_date: iso(-40) },
    { sprint_id: 'CY-CUR', start_date: iso(-1) },
    { sprint_id: 'CY-F1', start_date: iso(40) },
    { sprint_id: 'CY-F2', start_date: iso(80) }
  ];
  return loadApp(makeDataset({
    projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    sprints
  }));
}

function renderProjectsSwimlane(app) {
  app.App.activeCustomer = 'Acme Industries';
  app.Sprint.viewMode = 'swimlane';
  if (app.Sprint.setSprintView) app.Sprint.setSprintView('projects');
  const board = app.document.getElementById('sprintBoard');
  app.Sprint.render();
  return board;
}

describe('Sprint Planning swim-lane window', () => {
  it('default window shows 1 past + current + all future', async () => {
    const app = await boot();
    const board = renderProjectsSwimlane(app);
    const hdrs = Array.from(board.querySelectorAll('th.sl-sprint-hdr')).map(th => th.textContent);
    // 4 sprint columns: CY-P1, CY-CUR, CY-F1, CY-F2 (CY-P2 dropped)
    expect(board.querySelectorAll('th.sl-sprint-hdr').length).toBe(4);
    expect(hdrs.join(' ')).not.toMatch(/P2/);
    app.teardown();
  });
  it('past:0, future:1 shows current + 1 future only', async () => {
    const app = await boot();
    app.App.uiStateSet('sprint.window', { past: 0, future: 1 });
    const board = renderProjectsSwimlane(app);
    expect(board.querySelectorAll('th.sl-sprint-hdr').length).toBe(2);
    app.teardown();
  });
  it('the current column carries .sl-sprint-current', async () => {
    const app = await boot();
    const board = renderProjectsSwimlane(app);
    expect(board.querySelector('th.sl-sprint-hdr.sl-sprint-current')).toBeTruthy();
    app.teardown();
  });
});
```

Note: confirm the swim-lane header selector by inspecting `renderSwimLane`'s thead (`th.sl-sprint-hdr` per earlier reads). If `setSprintView`/`viewMode` differ, adapt to whatever `Sprint.render()` needs to produce the Projects swim-lane (mirror `tests/unit/capacity-sprint-window.test.mjs` and any existing sprint render test). Keep the assertions (column count matches window; current column class present).

- [ ] **Step 2: Run it, verify it FAILS**

Run: `npx vitest run tests/render/sprint-window-swimlane.test.mjs`
Expected: FAIL — swim-lane shows all 5 columns (renderSwimLane still uses `App.data.sprints`).

- [ ] **Step 3: Point `renderSwimLane` at the helper**

In `Sprint.renderSwimLane` (index.html:28077), change:

```javascript
    const sprints = App.data.sprints || [];
```

to:

```javascript
    const { sprints, focusId } = this._windowedSprints(App.data.sprints);
```

(`focusId` is available if needed; the current column emphasis is driven by the existing `.sl-sprint-current` phase class, so `focusId` may be unused here — that's fine.)

- [ ] **Step 4: Point `renderTeamSwimlane` at the helper**

In `Sprint.renderTeamSwimlane` (index.html:28314), change:

```javascript
    const sprints = App.data.sprints || [];
```

to:

```javascript
    const { sprints, focusId } = Sprint._windowedSprints(App.data.sprints);
```

- [ ] **Step 5: Add the current-column width emphasis (CSS)**

In `index.html` immediately after the existing rule at line ~1875 (`.sprint-swimlane th.sl-sprint-current { color: var(--text-dark); }`), add:

```css
.sprint-swimlane th.sl-sprint-hdr.sl-sprint-current { min-width: 200px; max-width: 240px; }
```

- [ ] **Step 6: Run the test, verify it PASSES**

Run: `npx vitest run tests/render/sprint-window-swimlane.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 7: Regression**

Run: `npx vitest run tests/render tests/unit/capacity-sprint-window.test.mjs`
Expected: PASS, 0 snapshots broken. (If a sprint-swimlane snapshot exists and legitimately changes because the column set narrowed, STOP and report it rather than blind-updating.)

- [ ] **Step 8: Commit**

```bash
git add index.html tests/render/sprint-window-swimlane.test.mjs
git commit -m "feat(sprint): swim-lanes honour the configurable window; emphasise current column"
```

---

## Task B3: Toolbar control (past/future selects)

**Files:** Modify `index.html` (toolbar HTML ~3546; `Sprint.setWindow` + `Sprint._syncWindowControls`; `Sprint.render` call site)

- [ ] **Step 1: Write the failing test**

Append to `tests/render/sprint-window-swimlane.test.mjs` a new describe block:

```javascript
describe('Sprint window toolbar control', () => {
  it('selects reflect the persisted setting after render', async () => {
    const app = await boot();
    app.App.uiStateSet('sprint.window', { past: 2, future: 3 });
    renderProjectsSwimlane(app);
    expect(app.document.getElementById('sprintWindowPast').value).toBe('2');
    expect(app.document.getElementById('sprintWindowFuture').value).toBe('3');
    app.teardown();
  });
  it('setWindow writes the setting and narrows the board', async () => {
    const app = await boot();
    renderProjectsSwimlane(app);
    app.Sprint.setWindow('future', '1');
    expect(app.App.uiStateGet('sprint.window', null).future).toBe(1);
    const board = app.document.getElementById('sprintBoard');
    // default past 1 + current + 1 future = 3 columns
    expect(board.querySelectorAll('th.sl-sprint-hdr').length).toBe(3);
    app.teardown();
  });
});
```

(`renderProjectsSwimlane` is defined earlier in the file.)

- [ ] **Step 2: Run it, verify it FAILS**

Run: `npx vitest run tests/render/sprint-window-swimlane.test.mjs`
Expected: FAIL — `#sprintWindowPast`/`#sprintWindowFuture` don't exist; `setWindow` is not a function.

- [ ] **Step 3: Add the toolbar control HTML**

In `index.html` inside `#viewSprint .sprint-toolbar`, immediately AFTER the Hours checkbox label (the `<label class="toolbar-chk" ...><input ... id="chipHoursMode" ...> Hours</label>` at ~line 3547), insert:

```html
          <span class="filter-label" style="margin-left:6px">Sprints</span>
          <label class="toolbar-chk" style="gap:3px" title="How many past sprints to show">Past
            <select id="sprintWindowPast" onchange="Sprint.setWindow('past', this.value)" style="font-size:var(--fs-2xs);padding:1px 4px;border:1px solid var(--border-dim);border-radius:var(--radius-sm);background:var(--surface);color:var(--text-dark)">
              <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="all">All</option>
            </select>
          </label>
          <span style="font-size:var(--fs-2xs);color:var(--text-muted)">&middot; Current &middot;</span>
          <label class="toolbar-chk" style="gap:3px" title="How many future sprints to show">Future
            <select id="sprintWindowFuture" onchange="Sprint.setWindow('future', this.value)" style="font-size:var(--fs-2xs);padding:1px 4px;border:1px solid var(--border-dim);border-radius:var(--radius-sm);background:var(--surface);color:var(--text-dark)">
              <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="all">All</option>
            </select>
          </label>
```

- [ ] **Step 4: Add `setWindow` and `_syncWindowControls` to `Sprint`**

In the `Sprint` object, near `_windowOpts` (added in B1), add:

```javascript
  setWindow(which, value) {
    if (which !== 'past' && which !== 'future') return;
    const cur = this._windowOpts();
    const v = value === 'all' ? 'all' : (parseInt(value, 10) || 0);
    const next = { past: cur.past, future: cur.future };
    next[which] = v;
    App.uiStateSet('sprint.window', next);
    this.render();
  },

  // Reflect the persisted window in the toolbar selects (static options; set .value).
  _syncWindowControls() {
    const cfg = this._windowOpts();
    const past = document.getElementById('sprintWindowPast');
    const future = document.getElementById('sprintWindowFuture');
    if (past) past.value = String(cfg.past);
    if (future) future.value = String(cfg.future);
  },
```

- [ ] **Step 5: Call `_syncWindowControls` from `Sprint.render`**

In `Sprint.render()` (index.html ~27477-27505), add a call to `this._syncWindowControls();` near the top of the method (after it confirms `App.data` exists / before the viewMode branch). It must run on every render so the selects stay in sync after `setWindow` re-renders. Read `render()` first; place the call where `this` is the Sprint object and the toolbar DOM exists (the toolbar is static HTML always present).

- [ ] **Step 6: Run the test, verify it PASSES**

Run: `npx vitest run tests/render/sprint-window-swimlane.test.mjs`
Expected: PASS (all 5 tests in the file).

- [ ] **Step 7: Regression — full unit/render suite**

Run: `npx vitest run`
Expected: all pass, 0 failures.

- [ ] **Step 8: Commit**

```bash
git add index.html tests/render/sprint-window-swimlane.test.mjs
git commit -m "feat(sprint): add past/future window selects to the Sprint Planning toolbar"
```

---

## Task B4: Full verification + visual pass

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all unit/render + e2e green, 0 failures.

- [ ] **Step 2: Serve + visual verification**

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Drive `http://127.0.0.1:8765/index.html`, load demo data, select a customer; verify at 1440px:
- **Sprint Planning (Projects view):** default shows 1 past + current + all future; the current column is visibly wider (largest) with its accent tint/border. The toolbar shows `Sprints: Past [1] · Current · Future [All]`.
- Change **Past → All**: more past columns appear and the board scrolls horizontally with the project column frozen (no column crushing). Change **Future → 1**: only the next future column remains. Reload the page → the selects retain the chosen values (persisted).
- **Team view** (toggle to Team): same window applied.
- **Capacity view:** the "Team Workload by Sprint" cards reflect the same window as Sprint Planning (e.g. set Future→1 on Sprint Planning, then open Capacity → cards show current + 1 future).
- No console errors.

- [ ] **Step 3: Final commit if verification required a tweak**

```bash
git add -A && git commit -m "chore: WS-B verification pass"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** B1 (setting + helper) → Task B1; B2 (helper generalisation) → Task B1; B3 (swim-lanes use it + current largest) → Task B2; B4 (toolbar control) → Task B3; B5 (Capacity unified) → inherited automatically (Capacity's existing `_windowedSprints` call now reads the setting; verified in B1 Step 5 regression + B4 Step 2). Scroll constraint → B2 (existing `.sprint-board` overflow-x:auto preserved) + verified B4.
- **Naming consistency:** `Sprint._windowOpts()`, `Sprint._windowedSprints(all, opts)`, `Sprint.setWindow(which, value)`, `Sprint._syncWindowControls()`, UI-state key `'sprint.window'`, select ids `sprintWindowPast`/`sprintWindowFuture` — used consistently across tasks.
- **No placeholders:** every code step shows the literal edit. The B2/B3 test notes flag harness-API adaptation (mirror the existing capacity-sprint-window render test) without weakening assertions.
- **Default-unchanged guarantee:** with no `sprint.window` set, `_windowOpts()` returns `{past:1, future:'all'}`, so the existing Capacity behaviour and its tests are unaffected (B1 Step 5).
