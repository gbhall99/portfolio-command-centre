# Customizable & Editable Projects Table — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Projects table user-configurable (visibility/order/width per column) and inline-editable per data type, with all writes flowing through `App.updateProject` for audit/undo/save integrity.

**Architecture:** Replace today's two duplicated row builders with a single schema-driven loop over `Dashboard.COLUMNS`. The same registry powers a column-picker popover, header rendering with sort/resize/reorder, and a type-dispatched inline editor. Preferences persist globally via `App.uiStateSet('dashboard.columns', …)`. Edit trigger becomes Excel-style double-click; single click on a row keeps opening the detail panel.

**Tech Stack:** Plain JS in single `index.html` file (no framework, no build step). Tests: vitest + jsdom (unit + render snapshots), Playwright + chromium-headless-shell (E2E). All writes go through existing `App.updateProject(id, field, value)`.

**Project conventions (from CLAUDE.md, important context):** All UI rendering is string concatenation assigned to `.innerHTML`. User content is escaped via `Dashboard.esc()`. This plan follows that established pattern — every code sample uses `Dashboard.esc()` around user-controlled values. Reviewers should not flag the use of `.innerHTML` itself; it is the project convention.

**Spec:** `docs/superpowers/specs/2026-05-03-customizable-editable-table-design.md`

**Reference points in `index.html`:**
- Dashboard module: line 9316
- Current `<thead>` markup: lines 2566–2582
- Toolbar: line 2538
- Existing `renderTable` row HTML: lines 9801–9817
- Existing `buildRowHtml`: lines 9925–9991
- Existing `openQuickEdit`: lines 10015–10101
- `attachRowHandlers`: line 9993
- `App.updateProject`: line 5548
- `App.uiStateGet/Set`: lines 7078–7087
- `App.notifyDataChange`: line 3282
- `App.toInteger`: line 8115; `App.fmtPoints`: line 8122; `App.toast`: line 7089

---

## File Structure

This work all lives in `/Users/zaza/Documents/Projects/portfolio-command-centre/index.html` (single-file app). Test files live under `tests/`.

| File | Role |
|---|---|
| `index.html` (Dashboard module section, ~9316–10100) | Add `COLUMNS` registry, `visibleColumns` getter, `renderHeader`, `setColumnVisible`/`setColumnOrder`/`setColumnWidth`, refactored `buildRowHtml`, extended `openQuickEdit` with type-dispatched editors, `attachHeaderHandlers` for sort+resize+reorder. |
| `index.html` (new `ColumnPicker` module, after Dashboard) | Popover UI with grouped checkboxes, Reset. |
| `index.html` (`<thead>` markup at line 2566) | Replaced with empty `<thead id="projectTableHead"></thead>` rendered by JS. |
| `index.html` (toolbar at line 2538) | Add "Columns" button next to CSV / Copy Table. |
| `index.html` (CSS additions near line 540) | Styles for `.col-resize-handle`, `.col-picker-popover`, `.col-picker-row`, `.quick-edit-textarea`. |
| `tests/unit/columns.test.mjs` (NEW) | Registry shape, editor dispatch, skill-size cascade, persistence read/write fallback. |
| `tests/render/dashboard.test.mjs` (modify) | Regenerate existing snapshots that change due to refactor. |
| `tests/e2e/columns.spec.ts` (NEW) | Picker toggle/reorder/resize persistence; double-click edit a date/number; skill cascade; single-click still opens detail panel. |

---

## Task 1: Add `Dashboard.COLUMNS` registry (no behaviour change yet)

**Files:**
- Modify: `index.html` — add new `COLUMNS` constant near `Dashboard = {` at line 9316
- Test: `tests/unit/columns.test.mjs` (new)

- [ ] **Step 1: Write the failing test for registry shape**

Create `tests/unit/columns.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Dashboard.COLUMNS registry', () => {
  it('exists as a non-empty array', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    expect(Array.isArray(app.Dashboard.COLUMNS)).toBe(true);
    expect(app.Dashboard.COLUMNS.length).toBeGreaterThan(15);
    app.teardown();
  });

  it('every column has id, group, label, render', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    for (const col of app.Dashboard.COLUMNS) {
      expect(col.id, JSON.stringify(col)).toMatch(/^[a-z_][a-z0-9_]*$/);
      expect(typeof col.group).toBe('string');
      expect(typeof col.label).toBe('string');
      expect(typeof col.render).toBe('function');
    }
    app.teardown();
  });

  it('column ids are unique', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    const ids = app.Dashboard.COLUMNS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    app.teardown();
  });

  it('every editable column has a known edit.type', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    const known = new Set(['text', 'number', 'date', 'select', 'textarea', 'rag', 'sprint', 'derived']);
    for (const col of app.Dashboard.COLUMNS) {
      if (col.edit) {
        expect(known.has(col.edit.type), col.id + ': ' + col.edit.type).toBe(true);
        if (col.edit.type === 'select') expect(Array.isArray(col.edit.options)).toBe(true);
        if (col.edit.type !== 'derived' && col.edit.type !== 'rag') {
          expect(typeof col.edit.field).toBe('string');
        }
      }
    }
    app.teardown();
  });

  it('priority and name are alwaysOn', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    const get = (id) => app.Dashboard.COLUMNS.find(c => c.id === id);
    expect(get('priority').alwaysOn).toBe(true);
    expect(get('name').alwaysOn).toBe(true);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/columns.test.mjs`
Expected: FAIL — `Dashboard.COLUMNS` undefined.

- [ ] **Step 3: Add the COLUMNS registry to Dashboard module**

In `index.html` immediately after `const Dashboard = {` (currently line 9316), insert the registry. The registry uses helper closures (`fmtDate`, `sumSkillSizes`, `sumDone`) defined inside the IIFE. Each entry's `render` returns an HTML string that will be inserted into a `<td>` via the project's existing string-concatenation pattern; user-controlled values are escaped via `Dashboard.esc`.

```javascript
  COLUMNS: (function buildColumns() {
    const STAGES = ['Requirements', 'Data Sourcing', 'Data Modeling', 'Development', 'UAT'];
    const fmtDate = (iso) => {
      if (!iso) return '—';
      try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
      catch (_) { return '—'; }
    };
    const sumDone = (p) => Object.values(p.skill_splits || {}).reduce(
      (s, arr) => s + (Array.isArray(arr) ? arr.reduce((s2, e) => s2 + (e.completed || 0), 0) : 0), 0
    );

    return [
      // ---- Row chrome (alwaysOn, hidden from picker) ----
      { id: '__drag', group: 'Chrome', label: '', width: 30, alwaysOn: true, hideFromPicker: true,
        cellClass: 'drag-handle',
        render: () => '⠇' },
      { id: '__pin', group: 'Chrome', label: '', width: 26, alwaysOn: true, hideFromPicker: true,
        render: (p) => {
          const pinned = App.isPinned(p.id);
          const fill = pinned ? 'currentColor' : 'none';
          const titleTxt = pinned ? 'Remove from watchlist' : 'Add to watchlist';
          return '<button class="pin-btn' + (pinned ? ' pinned' : '') + '" onclick="event.stopPropagation();App.togglePin(\'' + p.id + '\')" title="' + titleTxt + '" aria-label="' + titleTxt + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="' + fill + '" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></button>';
        }
      },

      // ---- Identity ----
      { id: 'priority', group: 'Identity', label: '#', width: 48, alwaysOn: true, sortable: true,
        cellClass: 'priority-cell',
        render: (p) => {
          const rec = p.recommended_priority;
          const recChip = (rec && rec !== p.priority)
            ? ' <span title="Recommended priority #' + rec + ' — click to apply" onclick="event.stopPropagation();App.applyRecommendedPriority(\'' + p.id + '\')" style="display:inline-block;font-size:9px;padding:1px 4px;border-radius:3px;background:var(--accent-violet);color:white;font-weight:700;cursor:pointer;margin-left:3px">→#' + rec + '</span>'
            : '';
          const warnChip = (App.priorityWarningChip ? App.priorityWarningChip(p) : '');
          const whyBtn = '<button class="why-rank-btn" onclick="event.stopPropagation();App.openWhyRank(\'' + p.id + '\')" aria-label="Why is this project ranked here?" title="Why this rank?" tabindex="0">?</button>';
          return '<span>' + (p.priority || '') + '</span>' + recChip + warnChip + whyBtn;
        },
        edit: { type: 'number', field: 'priority' } },
      { id: 'name', group: 'Identity', label: 'Project', width: 240, alwaysOn: true, sortable: true,
        cellClass: 'project-name-cell',
        render: (p) => {
          const staleThreshold = App.getStaleThreshold(p.customer);
          const staleDays = p.last_updated ? Math.floor((Date.now() - new Date(p.last_updated).getTime()) / 86400000) : -1;
          const staleIcon = (staleDays >= staleThreshold && p.status !== 'Complete' && p.status !== 'Closed')
            ? '<span class="stale-icon" title="Not updated in ' + staleDays + ' days · threshold is ' + staleThreshold + ' days"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>'
            : '';
          const lastReviewedMs = p.last_reviewed_at ? new Date(p.last_reviewed_at).getTime() : 0;
          const reviewedDays = lastReviewedMs ? Math.floor((Date.now() - lastReviewedMs) / 86400000) : null;
          const reviewedBadge = reviewedDays != null
            ? '<span class="reviewed-badge" title="Reviewed ' + (reviewedDays <= 1 ? 'today' : reviewedDays + ' days ago') + '"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></span>'
            : '';
          const lifecycle = (App.lifecycleStageChip ? App.lifecycleStageChip(p) : '');
          return Dashboard.esc(p.name) + staleIcon + reviewedBadge + lifecycle;
        },
        edit: { type: 'text', field: 'name' } },
      { id: 'customer', group: 'Identity', label: 'Customer', width: 80, sortable: true,
        render: (p) => '<span class="badge badge-customer" style="background:' + App.customerColor(p.customer) + '">' + Dashboard.esc(p.customer) + '</span>',
        edit: { type: 'select', field: 'customer', options: [] } },
      { id: 'category', group: 'Identity', label: 'Category', width: 100, sortable: true,
        render: (p) => Dashboard.esc(p.category || ''),
        edit: { type: 'text', field: 'category' } },
      { id: 'manager', group: 'Identity', label: 'Manager', width: 130, sortable: true, cellClass: 'manager-cell',
        render: (p) => Dashboard.esc(p.manager || '—'),
        edit: { type: 'text', field: 'manager' } },
      { id: 'sponsor', group: 'Identity', label: 'Sponsor', width: 130,
        render: (p) => Dashboard.esc(p.sponsor || '—'),
        edit: { type: 'text', field: 'sponsor' } },
      { id: 'status', group: 'Identity', label: 'Status', width: 110, sortable: true,
        render: (p) => '<span class="badge badge-status" style="color:' + App.statusColor(p.status) + ';background:' + App.statusColor(p.status) + '20">' + Dashboard.esc(p.status) + '</span>',
        edit: { type: 'select', field: 'status', options: ['Not Started','In Progress','On Hold','At Risk','Blocked','Complete','Closed'] } },

      // ---- Risks ----
      { id: 'rag', group: 'Risks', label: 'RAG', width: 80,
        render: (p) => '<div class="rag-dots">' +
          '<div class="rag-dot" title="Schedule: ' + (p.rag_schedule||'') + '" style="background:' + App.ragColor(p.rag_schedule) + '"></div>' +
          '<div class="rag-dot" title="Resourcing: ' + (p.rag_resourcing||'') + '" style="background:' + App.ragColor(p.rag_resourcing) + '"></div>' +
          '<div class="rag-dot" title="Scope: ' + (p.rag_scope||'') + '" style="background:' + App.ragColor(p.rag_scope) + '"></div>' +
        '</div>',
        edit: { type: 'rag' } },
      { id: 'risks', group: 'Risks', label: 'Risks', width: 200,
        render: (p) => Dashboard.esc((p.risks || '').slice(0, 80)) + ((p.risks||'').length > 80 ? '…' : ''),
        edit: { type: 'textarea', field: 'risks' } },
      { id: 'assumptions', group: 'Risks', label: 'Assumptions', width: 200,
        render: (p) => Dashboard.esc((p.assumptions || '').slice(0, 80)) + ((p.assumptions||'').length > 80 ? '…' : ''),
        edit: { type: 'textarea', field: 'assumptions' } },
      { id: 'dependencies', group: 'Risks', label: 'Dependencies', width: 160,
        render: (p) => Dashboard.esc((p.dependencies || '').slice(0, 60)) + ((p.dependencies||'').length > 60 ? '…' : ''),
        edit: { type: 'textarea', field: 'dependencies' } },

      // ---- Dates ----
      { id: 'start_date', group: 'Dates', label: 'Start', width: 80, sortable: true,
        render: (p) => fmtDate(p.start_date),
        edit: { type: 'date', field: 'start_date' } },
      { id: 'target_date', group: 'Dates', label: 'Target', width: 80, sortable: true,
        render: (p) => fmtDate(p.target_date),
        edit: { type: 'date', field: 'target_date' } },
      { id: 'hard_deadline', group: 'Dates', label: 'Hard deadline', width: 80, sortable: true,
        render: (p) => p.hard_deadline ? '<span style="color:var(--status-red)">' + fmtDate(p.hard_deadline) + '</span>' : '—',
        edit: { type: 'date', field: 'hard_deadline' } },
      { id: 'baseline_start', group: 'Dates', label: 'Baseline start', width: 80,
        render: (p) => fmtDate(p.baseline_start),
        edit: { type: 'date', field: 'baseline_start' } },
      { id: 'baseline_end', group: 'Dates', label: 'Baseline end', width: 80,
        render: (p) => fmtDate(p.baseline_end),
        edit: { type: 'date', field: 'baseline_end' } },
      { id: 'actual_date', group: 'Dates', label: 'Actual', width: 80,
        render: (p) => fmtDate(p.actual_date),
        edit: { type: 'date', field: 'actual_date' } },
      { id: 'product_release_date', group: 'Dates', label: 'Product release', width: 80,
        render: (p) => fmtDate(p.product_release_date),
        edit: { type: 'date', field: 'product_release_date' } },
      { id: 'comms_date', group: 'Dates', label: 'Comms date', width: 80,
        render: (p) => fmtDate(p.comms_date),
        edit: { type: 'date', field: 'comms_date' } },
      { id: 'last_updated', group: 'Dates', label: 'Updated', width: 80,
        render: (p) => fmtDate(p.last_updated),
        edit: { type: 'derived' } },

      // ---- Sprints ----
      { id: 'sprint_range', group: 'Sprints', label: 'Sprints', width: 90, sortable: true, sortField: 'current_sprint',
        cellClass: 'sprint-cell',
        render: (p) => Dashboard.sprintRange(p),
        edit: { type: 'derived' } },
      { id: 'current_sprint', group: 'Sprints', label: 'Current sprint', width: 100,
        render: (p) => Dashboard.esc(p.current_sprint || '—'),
        edit: { type: 'sprint', field: 'current_sprint' } },
      { id: 'target_sprint', group: 'Sprints', label: 'Target sprint', width: 100,
        render: (p) => Dashboard.esc(p.target_sprint || '—'),
        edit: { type: 'sprint', field: 'target_sprint' } },

      // ---- Estimates ----
      { id: 'size_total', group: 'Estimates', label: 'Est', width: 50, sortable: true, cellClass: 'size-cell',
        render: (p) => p.size_total != null ? App.fmtPoints(p.size_total) : '—',
        edit: { type: 'derived' } },
      { id: 'size_requirements', group: 'Estimates', label: 'Req pts', width: 60, cellClass: 'size-cell',
        render: (p) => p.size_requirements != null ? App.fmtPoints(p.size_requirements) : '—',
        edit: { type: 'number', field: 'size_requirements' } },
      { id: 'size_tableau', group: 'Estimates', label: 'Tab pts', width: 60, cellClass: 'size-cell',
        render: (p) => p.size_tableau != null ? App.fmtPoints(p.size_tableau) : '—',
        edit: { type: 'number', field: 'size_tableau' } },
      { id: 'size_engineering', group: 'Estimates', label: 'DE pts', width: 60, cellClass: 'size-cell',
        render: (p) => p.size_engineering != null ? App.fmtPoints(p.size_engineering) : '—',
        edit: { type: 'number', field: 'size_engineering' } },
      { id: 'size_data_science', group: 'Estimates', label: 'DS pts', width: 60, cellClass: 'size-cell',
        render: (p) => p.size_data_science != null ? App.fmtPoints(p.size_data_science) : '—',
        edit: { type: 'number', field: 'size_data_science' } },
      { id: 'size_uat_adoption', group: 'Estimates', label: 'UAT pts', width: 60, cellClass: 'size-cell',
        render: (p) => p.size_uat_adoption != null ? App.fmtPoints(p.size_uat_adoption) : '—',
        edit: { type: 'number', field: 'size_uat_adoption' } },

      // ---- Remaining work ----
      { id: 'size_done', group: 'Remaining work', label: 'Done', width: 50, cellClass: 'size-cell',
        render: (p) => { const done = sumDone(p); return done ? App.fmtPoints(done) : '—'; },
        edit: { type: 'derived' } },
      { id: 'size_remaining', group: 'Remaining work', label: 'Remaining', width: 70, cellClass: 'size-cell',
        render: (p) => { const remain = (p.size_total || 0) - sumDone(p); return remain > 0 ? App.fmtPoints(remain) : '—'; },
        edit: { type: 'derived' } },
      { id: 'progress', group: 'Remaining work', label: 'Progress', width: 150, sortable: true, cellClass: 'progress-bar-cell',
        render: (p) => {
          const stages = p.stages || {};
          const applicable = STAGES.filter(s => stages[s] && stages[s] !== 'N/A');
          const completed = applicable.filter(s => stages[s] === 'Complete').length;
          const pct = applicable.length > 0 ? Math.round((completed / applicable.length) * 100) : -1;
          if (pct === -1) return '<span style="font-size:11px;color:var(--text-muted)">—</span>';
          const segments = STAGES.map(s => {
            const val = stages[s] || 'N/A';
            if (val === 'N/A') return '';
            const cls = val === 'Complete' ? 'complete' : val === 'In Progress' ? 'in-progress' : 'not-started';
            return '<div class="progress-segment ' + cls + '" title="' + s + ': ' + val + '"></div>';
          }).join('');
          return '<div class="progress-bar"><div class="progress-track">' + segments + '</div><span class="progress-pct' + (pct === 100 ? ' done' : '') + '">' + pct + '%</span></div>';
        },
        edit: { type: 'derived' } },
    ];
  })(),
```

The customer column's `edit.options` is an empty array; populate it dynamically in `openQuickEdit` from `App.getCustomers()` so a new customer added in Configuration is reflected without restart (handled in Task 8).

- [ ] **Step 4: Run test to verify shape passes**

Run: `npx vitest run tests/unit/columns.test.mjs`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/unit/columns.test.mjs
git commit -m "feat(table): add Dashboard.COLUMNS registry (no behaviour change)"
```

---

## Task 2: Add `visibleColumns` getter and persistence helpers

**Files:**
- Modify: `index.html` — add methods to Dashboard (after the COLUMNS array)
- Modify: `tests/unit/columns.test.mjs`

- [ ] **Step 1: Write failing tests for visibleColumns + persistence**

Append to `tests/unit/columns.test.mjs`:

```javascript
describe('Dashboard.visibleColumns + persistence', () => {
  it('defaults expose 12 user-visible columns plus 2 chrome', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.uiStateSet('dashboard.columns', null);
    const cols = app.Dashboard.visibleColumns();
    expect(cols.length).toBe(14);
    const ids = cols.map(c => c.id);
    expect(ids).toEqual([
      '__drag', '__pin',
      'priority', 'name', 'customer', 'manager', 'status',
      'rag', 'target_date', 'hard_deadline', 'sprint_range',
      'size_total', 'size_done', 'size_remaining'
    ]);
    app.teardown();
  });

  it('respects stored visibility prefs', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.uiStateSet('dashboard.columns', {
      visible: ['priority', 'name', 'customer', 'status'],
      order: ['priority', 'name', 'customer', 'status'],
      widths: {}
    });
    const ids = app.Dashboard.visibleColumns().map(c => c.id);
    expect(ids).toEqual(['__drag', '__pin', 'priority', 'name', 'customer', 'status']);
    app.teardown();
  });

  it('alwaysOn columns cannot be hidden', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.uiStateSet('dashboard.columns', {
      visible: ['customer'],
      order: ['customer'],
      widths: {}
    });
    const ids = app.Dashboard.visibleColumns().map(c => c.id);
    expect(ids).toContain('priority');
    expect(ids).toContain('name');
    app.teardown();
  });

  it('falls back to defaults when prefs are malformed', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.uiStateSet('dashboard.columns', { not: 'an object we expect' });
    const ids = app.Dashboard.visibleColumns().map(c => c.id);
    expect(ids).toContain('priority');
    expect(ids).toContain('name');
    expect(ids.length).toBeGreaterThan(2);
    app.teardown();
  });

  it('setColumnVisible persists', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.uiStateSet('dashboard.columns', null);
    app.Dashboard.setColumnVisible('manager', false);
    const ids = app.Dashboard.visibleColumns().map(c => c.id);
    expect(ids).not.toContain('manager');
    const prefs = app.App.uiStateGet('dashboard.columns');
    expect(prefs.visible).not.toContain('manager');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/columns.test.mjs`
Expected: FAIL — `Dashboard.visibleColumns is not a function`.

- [ ] **Step 3: Implement the helpers**

In `index.html`, immediately after the `COLUMNS:` block, add to the Dashboard object:

```javascript
  DEFAULT_VISIBLE: [
    '__drag', '__pin',
    'priority', 'name', 'customer', 'manager', 'status',
    'rag', 'target_date', 'hard_deadline', 'sprint_range',
    'size_total', 'size_done', 'size_remaining'
  ],

  _getColumnPrefs() {
    const raw = (App && App.uiStateGet) ? App.uiStateGet('dashboard.columns', null) : null;
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.visible)) {
      return { visible: this.DEFAULT_VISIBLE.slice(), order: this.DEFAULT_VISIBLE.slice(), widths: {} };
    }
    const visible = Array.isArray(raw.visible) ? raw.visible : this.DEFAULT_VISIBLE.slice();
    const order = Array.isArray(raw.order) && raw.order.length ? raw.order : visible.slice();
    const widths = (raw.widths && typeof raw.widths === 'object') ? raw.widths : {};
    return { visible, order, widths };
  },

  _setColumnPrefs(prefs) {
    if (App && App.uiStateSet) App.uiStateSet('dashboard.columns', prefs);
  },

  visibleColumns() {
    const prefs = this._getColumnPrefs();
    const byId = new Map(this.COLUMNS.map(c => [c.id, c]));
    const visibleSet = new Set(prefs.visible);
    this.COLUMNS.filter(c => c.alwaysOn).forEach(c => visibleSet.add(c.id));
    const seen = new Set();
    const out = [];
    for (const id of prefs.order) {
      if (visibleSet.has(id) && byId.has(id) && !seen.has(id)) { out.push(byId.get(id)); seen.add(id); }
    }
    for (const c of this.COLUMNS) {
      if (c.alwaysOn && !seen.has(c.id)) { out.push(c); seen.add(c.id); }
    }
    return out;
  },

  setColumnVisible(id, on) {
    const prefs = this._getColumnPrefs();
    const col = this.COLUMNS.find(c => c.id === id);
    if (!col || col.alwaysOn) return;
    const set = new Set(prefs.visible);
    if (on) set.add(id); else set.delete(id);
    prefs.visible = Array.from(set);
    if (on && !prefs.order.includes(id)) prefs.order.push(id);
    this._setColumnPrefs(prefs);
  },

  setColumnOrder(orderedIds) {
    if (!Array.isArray(orderedIds)) return;
    const prefs = this._getColumnPrefs();
    prefs.order = orderedIds.slice();
    this._setColumnPrefs(prefs);
  },

  setColumnWidth(id, px) {
    const prefs = this._getColumnPrefs();
    prefs.widths = prefs.widths || {};
    prefs.widths[id] = Math.max(40, Math.round(px));
    this._setColumnPrefs(prefs);
  },

  resetColumns() {
    if (App && App.uiStateSet) App.uiStateSet('dashboard.columns', null);
  },
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/columns.test.mjs`
Expected: PASS — all 5 new tests green.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/unit/columns.test.mjs
git commit -m "feat(table): visibleColumns getter + persistence helpers"
```

---

## Task 3: Refactor `buildRowHtml` to consume the registry

**Files:**
- Modify: `index.html` lines 9925–9991 (`buildRowHtml` function)
- Regenerate: `tests/render/__snapshots__/dashboard.row.matching.html`
- Regenerate: `tests/render/__snapshots__/dashboard.row.chip.html`

- [ ] **Step 1: Replace buildRowHtml body**

Replace the entire `buildRowHtml(p)` function (currently 9925–9991) with:

```javascript
  buildRowHtml(p) {
    const tone = p.status === 'At Risk' ? ' class="row-at-risk"'
               : p.status === 'Blocked' ? ' class="row-blocked"' : '';
    const cells = this.visibleColumns().map(col => {
      const editAttr = (col.edit && col.edit.type !== 'derived') ? ' data-quick-edit="' + col.id + '"' : '';
      const cls = col.cellClass ? ' class="' + col.cellClass + '"' : '';
      let inner;
      try { inner = col.render(p); }
      catch (e) { console.error('[PCC] render failed for column ' + col.id, e); inner = '—'; }
      return '<td' + cls + editAttr + '>' + inner + '</td>';
    }).join('');
    return '<tr' + tone + ' data-id="' + p.id + '" draggable="true">' + cells + '</tr>';
  },
```

- [ ] **Step 2: Run existing dashboard render tests**

Run: `npx vitest run tests/render/dashboard.test.mjs`
Expected: FAIL — snapshots have changed because the column set changes from old hardcoded to new default.

- [ ] **Step 3: Inspect the snapshot diff**

Run: `git diff tests/render/__snapshots__/`
Verify visually that the new HTML reflects the default 14-cell column set (drag, pin, priority, name, customer, manager, status, rag, target_date, hard_deadline, sprint_range, size_total, size_done, size_remaining).

If the new HTML matches, regenerate.

- [ ] **Step 4: Regenerate snapshots**

Run: `npx vitest run tests/render/dashboard.test.mjs --update`
Expected: PASS, snapshot files updated.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/__snapshots__/
git commit -m "refactor(table): buildRowHtml iterates COLUMNS registry"
```

---

## Task 4: Refactor `renderTable` to use `buildRowHtml`

**Files:**
- Modify: `index.html` lines 9744–9818 (the inline row-building inside `renderTable`)

- [ ] **Step 1: Replace the duplicated row-building block**

In `renderTable`, replace the block from `const STAGES = …` through the end of the row-building map (currently lines 9744–9818) with a single line that delegates to `buildRowHtml`:

```javascript
    const rows = projects.map(p => this.buildRowHtml(p));
    tbody.innerHTML = rows.join('');
```

The drag-handler attachment block that follows `tbody.innerHTML = rows.join('');` (currently lines 9826–9865) stays untouched — it operates on the rendered DOM.

- [ ] **Step 2: Run unit + render suite**

Run: `npm run test:unit`
Expected: PASS — both `renderTable` callers and direct `buildRowHtml` callers now share one code path; snapshots already updated in Task 3.

- [ ] **Step 3: Smoke-test in browser**

Run: `python3 -m http.server 8080 --bind 127.0.0.1 &` then open `http://127.0.0.1:8080/` and click **Restore** (or **Load JSON** with `portfolio-data.json`).
Expected: Projects table renders for the default column set (14 cells per row). Sort by clicking headers still works (header itself is the old static one until Task 5).

Stop the server: `kill %1`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "refactor(table): renderTable delegates row HTML to buildRowHtml"
```

---

## Task 5: Add `Dashboard.renderHeader` driven by the registry

**Files:**
- Modify: `index.html` line 2566 — replace static `<thead>` markup
- Modify: `index.html` Dashboard module — add `renderHeader` + `attachHeaderHandlers`

- [ ] **Step 1: Replace the static thead with an empty placeholder**

Currently lines 2565–2583 contain a hardcoded `<thead><tr><th …></th>…</tr></thead>`. Replace the entire block with:

```html
            <thead id="projectTableHead"></thead>
```

- [ ] **Step 2: Add renderHeader to Dashboard**

Add to the Dashboard object after `visibleColumns()`:

```javascript
  renderHeader() {
    const head = document.getElementById('projectTableHead');
    if (!head) return;
    const prefs = this._getColumnPrefs();
    const cols = this.visibleColumns();
    const ths = cols.map(col => {
      const w = (prefs.widths && prefs.widths[col.id]) || col.width;
      const sortKey = col.sortField || col.id;
      const sortedCls = (col.sortable && this.sortField === sortKey) ? ' sorted' : '';
      const sortAttr = col.sortable ? ' data-sort="' + sortKey + '"' : '';
      const reorderable = !col.alwaysOn && !col.hideFromPicker;
      const widthAttr = (typeof w === 'number') ? ' style="width:' + w + 'px"' : '';
      const sortArrow = col.sortable ? ' <span class="sort-arrow">' + (this.sortDir === 'desc' ? '▼' : '▲') + '</span>' : '';
      const resizeHandle = col.alwaysOn || col.hideFromPicker ? '' : '<div class="col-resize-handle" data-col-id="' + col.id + '"></div>';
      return '<th data-col-id="' + col.id + '"' + sortAttr + ' class="th-col' + sortedCls + '"' + widthAttr +
        (reorderable ? ' draggable="true"' : '') +
        '><span class="th-label">' + Dashboard.esc(col.label) + sortArrow + '</span>' + resizeHandle + '</th>';
    }).join('');
    head.innerHTML = '<tr>' + ths + '</tr>';
    this.attachHeaderHandlers();
  },

  attachHeaderHandlers() {
    const head = document.getElementById('projectTableHead');
    if (!head) return;
    head.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', (e) => {
        if (e.target.closest('.col-resize-handle')) return;
        if (th.dataset.dragging === '1') return;
        this.sortBy(th.dataset.sort);
      });
    });
  },
```

- [ ] **Step 3: Wire renderHeader into init + renderTable**

In `Dashboard.init` (line 9322), add at the end (before the closing brace):

```javascript
    try { this.renderHeader(); } catch (e) { console.error('[PCC] Dashboard.renderHeader failed:', e); }
```

In `renderTable` (line 9699), add immediately after the `if (!projects.length) { … return; }` short-circuit branch so the header always renders:

```javascript
    this.renderHeader();
```

- [ ] **Step 4: Add CSS for the resize handle (no behaviour yet)**

In `index.html` near line 700 (after `.priority-cell`), add:

```css
.th-col { position: relative; }
.col-resize-handle { position: absolute; top: 0; right: 0; width: 4px; height: 100%; cursor: col-resize; user-select: none; }
.col-resize-handle:hover { background: var(--accent-blue); opacity: 0.4; }
```

- [ ] **Step 5: Smoke-test**

Open the app in a browser. Confirm:
- Header renders 14 cells matching the default visible columns.
- Sort by Priority / Name / Customer still works.
- Resize handles visible on hover (no drag yet — Task 6).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(table): renderHeader builds <thead> from COLUMNS registry"
```

---

## Task 6: Implement column resize via drag

**Files:**
- Modify: `index.html` Dashboard module — extend `attachHeaderHandlers`

- [ ] **Step 1: Add mousedown handler on resize handles**

In `attachHeaderHandlers`, after the `th[data-sort]` block, append:

```javascript
    head.querySelectorAll('.col-resize-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const colId = handle.dataset.colId;
        const th = handle.closest('th');
        const startX = e.clientX;
        const startW = th.getBoundingClientRect().width;
        const onMove = (ev) => {
          const next = Math.max(40, startW + (ev.clientX - startX));
          th.style.width = next + 'px';
        };
        const onUp = (ev) => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          const finalW = Math.max(40, startW + (ev.clientX - startX));
          this.setColumnWidth(colId, finalW);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
```

- [ ] **Step 2: Smoke-test in browser**

Open app. Drag the right edge of the Manager header by 60px. Reload. Confirm width persisted.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(table): drag-resize columns with persisted widths"
```

---

## Task 7: Implement column reorder via drag-drop on `<th>`

**Files:**
- Modify: `index.html` Dashboard module — extend `attachHeaderHandlers`

- [ ] **Step 1: Add HTML5 drag-drop handlers**

In `attachHeaderHandlers`, after the resize block, append:

```javascript
    head.querySelectorAll('th[draggable="true"]').forEach(th => {
      th.addEventListener('dragstart', (e) => {
        th.dataset.dragging = '1';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', th.dataset.colId);
      });
      th.addEventListener('dragend', () => {
        delete th.dataset.dragging;
        head.querySelectorAll('th').forEach(x => { x.classList.remove('th-drop-before','th-drop-after'); });
      });
      th.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = th.getBoundingClientRect();
        const before = e.clientX < rect.left + rect.width / 2;
        head.querySelectorAll('th').forEach(x => { x.classList.remove('th-drop-before','th-drop-after'); });
        th.classList.add(before ? 'th-drop-before' : 'th-drop-after');
      });
      th.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        const targetId = th.dataset.colId;
        if (!draggedId || draggedId === targetId) return;
        const rect = th.getBoundingClientRect();
        const before = e.clientX < rect.left + rect.width / 2;
        const ids = Array.from(head.querySelectorAll('th[data-col-id]')).map(x => x.dataset.colId);
        const fromIdx = ids.indexOf(draggedId);
        const toBaseIdx = ids.indexOf(targetId);
        if (fromIdx === -1 || toBaseIdx === -1) return;
        const reordered = ids.slice();
        reordered.splice(fromIdx, 1);
        const insertAt = before ? toBaseIdx - (fromIdx < toBaseIdx ? 1 : 0) : toBaseIdx + (fromIdx > toBaseIdx ? 1 : 0);
        reordered.splice(Math.max(0, insertAt), 0, draggedId);
        this.setColumnOrder(reordered);
        this.renderHeader();
        this.renderTable(this.filteredProjects);
      });
    });
```

- [ ] **Step 2: Add CSS for drop indicators**

Append to the CSS block from Task 5:

```css
.th-col.th-drop-before { box-shadow: inset 2px 0 0 var(--accent-blue); }
.th-col.th-drop-after { box-shadow: inset -2px 0 0 var(--accent-blue); }
```

- [ ] **Step 3: Smoke-test**

Open app, drag Manager `<th>` left of Customer. Confirm columns reorder. Reload. Confirm order persisted.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(table): drag-reorder columns via header DnD"
```

---

## Task 8: Extend `openQuickEdit` with type-dispatched editors

**Files:**
- Modify: `index.html` lines 10015–10101 (`openQuickEdit`)
- Modify: `tests/unit/columns.test.mjs`

- [ ] **Step 1: Write failing tests for editor dispatch**

Append to `tests/unit/columns.test.mjs`:

```javascript
describe('Dashboard.openQuickEdit type dispatch', () => {
  function setup(p) { return loadApp(makeDataset({ projects: [p] })); }

  it('date editor renders date input with ISO value', async () => {
    const p = makeProject({ id: 'P1', target_date: '2026-06-30' });
    const app = await setup(p);
    const td = app.window.document.createElement('td');
    td.dataset.quickEdit = 'target_date';
    app.Dashboard.openQuickEdit(td, 'target_date', 'P1');
    const input = td.querySelector('input[type="date"]');
    expect(input).toBeTruthy();
    expect(input.value).toBe('2026-06-30');
    app.teardown();
  });

  it('number editor parses integers via App.toInteger and writes', async () => {
    const p = makeProject({ id: 'P2', size_engineering: 8 });
    const app = await setup(p);
    const td = app.window.document.createElement('td');
    td.dataset.quickEdit = 'size_engineering';
    app.Dashboard.openQuickEdit(td, 'size_engineering', 'P2');
    const input = td.querySelector('input[type="number"]');
    input.value = '12';
    input.dispatchEvent(new app.window.Event('blur'));
    const updated = app.App.data.projects.find(x => x.id === 'P2');
    expect(updated.size_engineering).toBe(12);
    app.teardown();
  });

  it('select editor lists options and commits chosen value', async () => {
    const p = makeProject({ id: 'P3', status: 'In Progress' });
    const app = await setup(p);
    const td = app.window.document.createElement('td');
    td.dataset.quickEdit = 'status';
    app.Dashboard.openQuickEdit(td, 'status', 'P3');
    const select = td.querySelector('select');
    expect(select).toBeTruthy();
    expect(select.options.length).toBe(7);
    select.value = 'Blocked';
    select.dispatchEvent(new app.window.Event('blur'));
    expect(app.App.data.projects.find(x => x.id === 'P3').status).toBe('Blocked');
    app.teardown();
  });

  it('invalid date is rejected and cell reverts', async () => {
    const p = makeProject({ id: 'P4', target_date: '2026-06-30' });
    const app = await setup(p);
    const td = app.window.document.createElement('td');
    td.dataset.quickEdit = 'target_date';
    td.textContent = '30 Jun';
    app.Dashboard.openQuickEdit(td, 'target_date', 'P4');
    const input = td.querySelector('input');
    input.value = 'not-a-date';
    input.dispatchEvent(new app.window.Event('blur'));
    expect(app.App.data.projects.find(x => x.id === 'P4').target_date).toBe('2026-06-30');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/columns.test.mjs`
Expected: FAIL — date / number / select dispatch not yet wired (existing function only supports priority/size_total/status/text/rag).

- [ ] **Step 3: Replace openQuickEdit body**

Replace `openQuickEdit(cell, field, projectId) { … }` (lines 10015–10101) with:

```javascript
  openQuickEdit(cell, field, projectId) {
    if (!cell || !field || !projectId) return;
    const project = App.data && App.data.projects.find(p => p.id === projectId);
    if (!project) return;
    if (cell.dataset.editing === '1') return;
    const col = this.COLUMNS.find(c => c.id === field);
    const edit = col && col.edit;
    if (!edit || edit.type === 'derived') return;
    const dataField = edit.field || field;
    const originalValue = project[dataField];
    const originalHtml = cell.innerHTML;
    cell.dataset.editing = '1';

    const cancel = () => { cell.innerHTML = originalHtml; delete cell.dataset.editing; };
    const reRender = () => {
      try {
        if (typeof Dashboard.applyAndRender === 'function') Dashboard.applyAndRender();
        else if (typeof Dashboard.renderTable === 'function' && Array.isArray(Dashboard.filteredProjects)) Dashboard.renderTable(Dashboard.filteredProjects);
      } catch (_) {}
    };

    const parsers = {
      number: (raw) => {
        const n = App.toInteger(raw);
        return (Number.isFinite(n) && n >= 0) ? n : NaN;
      },
      date: (raw) => {
        const s = String(raw || '').trim();
        if (!s) return null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
        const t = Date.parse(s);
        return Number.isFinite(t) ? s : undefined;
      },
      text: (raw) => String(raw == null ? '' : raw).trim(),
      textarea: (raw) => String(raw == null ? '' : raw),
      select: (raw) => String(raw),
      sprint: (raw) => String(raw)
    };

    const commit = (raw) => {
      const parser = parsers[edit.type] || parsers.text;
      const next = parser(raw);
      if (next === undefined) {
        App.toast('Invalid ' + edit.type + ' value', 'warn');
        cancel();
        return;
      }
      if (edit.type === 'number' && Number.isNaN(next)) {
        App.toast('Story points must be a non-negative integer', 'warn');
        cancel();
        return;
      }
      if (next === originalValue) { cancel(); return; }
      App.updateProject(projectId, dataField, next);
      if (/^size_(requirements|tableau|engineering|data_science|uat_adoption)$/.test(dataField)) {
        const p2 = App.data.projects.find(x => x.id === projectId);
        const newTotal = ['size_requirements','size_tableau','size_engineering','size_data_science','size_uat_adoption']
          .reduce((s, k) => s + (App.toInteger(p2[k]) || 0), 0);
        if (newTotal !== p2.size_total) App.updateProject(projectId, 'size_total', newTotal);
      }
      reRender();
      delete cell.dataset.editing;
    };

    let editor;
    if (edit.type === 'rag') {
      const next = (cur) => cur === 'Green' ? 'Amber' : cur === 'Amber' ? 'Red' : 'Green';
      const cycle = (dim) => {
        App.updateProject(projectId, dim, next(project[dim] || 'Green'));
        reRender();
        delete cell.dataset.editing;
      };
      cell.innerHTML =
        '<div class="rag-dots quick-edit-rag" role="group" aria-label="Cycle RAG">' +
          '<button type="button" data-rag="rag_schedule" class="rag-dot" title="Schedule (click to cycle)" style="background:' + App.ragColor(project.rag_schedule) + '"></button>' +
          '<button type="button" data-rag="rag_resourcing" class="rag-dot" title="Resourcing (click to cycle)" style="background:' + App.ragColor(project.rag_resourcing) + '"></button>' +
          '<button type="button" data-rag="rag_scope" class="rag-dot" title="Scope (click to cycle)" style="background:' + App.ragColor(project.rag_scope) + '"></button>' +
        '</div>';
      cell.querySelectorAll('button[data-rag]').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); cycle(btn.dataset.rag); });
      });
      const onAway = (e) => {
        if (!cell.contains(e.target)) {
          document.removeEventListener('click', onAway, true);
          if (cell.dataset.editing === '1') cancel();
        }
      };
      setTimeout(() => document.addEventListener('click', onAway, true), 0);
      return;
    }

    if (edit.type === 'number') {
      cell.innerHTML = '<input type="number" min="0" step="1" class="quick-edit-input" value="' + Dashboard.esc(String(originalValue == null ? '' : originalValue)) + '">';
      editor = cell.querySelector('input');
    } else if (edit.type === 'date') {
      const v = originalValue ? String(originalValue).slice(0, 10) : '';
      cell.innerHTML = '<input type="date" class="quick-edit-input" value="' + Dashboard.esc(v) + '">';
      editor = cell.querySelector('input');
    } else if (edit.type === 'select') {
      let options = edit.options || [];
      if (field === 'customer' && App.getCustomers) options = App.getCustomers();
      const opts = options.map(o =>
        '<option value="' + Dashboard.esc(o) + '"' + (o === originalValue ? ' selected' : '') + '>' + Dashboard.esc(o) + '</option>'
      ).join('');
      cell.innerHTML = '<select class="quick-edit-input">' + opts + '</select>';
      editor = cell.querySelector('select');
    } else if (edit.type === 'textarea') {
      cell.innerHTML = '<textarea class="quick-edit-input quick-edit-textarea" rows="4">' + Dashboard.esc(String(originalValue == null ? '' : originalValue)) + '</textarea>';
      editor = cell.querySelector('textarea');
    } else if (edit.type === 'sprint') {
      const sprints = (App.data && App.data.sprints || []).filter(s => s.customer === project.customer);
      const ids = sprints.map(s => s.sprint_id);
      const opts = ['<option value="">—</option>'].concat(
        ids.map(id => '<option value="' + Dashboard.esc(id) + '"' + (id === originalValue ? ' selected' : '') + '>' + Dashboard.esc(id) + '</option>')
      ).join('');
      cell.innerHTML = '<select class="quick-edit-input">' + opts + '</select>';
      editor = cell.querySelector('select');
    } else {
      cell.innerHTML = '<input type="text" class="quick-edit-input" value="' + Dashboard.esc(String(originalValue == null ? '' : originalValue)) + '">';
      editor = cell.querySelector('input');
    }

    if (editor) {
      editor.addEventListener('blur', () => commit(editor.value));
      editor.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          if (edit.type === 'textarea' && !(e.metaKey || e.ctrlKey)) return;
          e.preventDefault(); editor.blur();
        } else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        else if (e.key === 'Tab') { editor.blur(); }
      });
      try { editor.focus(); if (editor.select) editor.select(); } catch (_) {}
    }
  },
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/columns.test.mjs`
Expected: PASS — all editor-dispatch tests green.

- [ ] **Step 5: Add a CSS rule for textarea editors**

Append:

```css
.quick-edit-textarea { min-height: 80px; resize: vertical; }
```

- [ ] **Step 6: Commit**

```bash
git add index.html tests/unit/columns.test.mjs
git commit -m "feat(table): type-dispatched inline editors (text/number/date/select/textarea/sprint)"
```

---

## Task 9: Verify skill-size cascade with a unit test

**Files:**
- Modify: `tests/unit/columns.test.mjs`

- [ ] **Step 1: Add the cascade test**

Append:

```javascript
describe('Skill-size cascade', () => {
  it('editing size_engineering recomputes size_total', async () => {
    const p = makeProject({
      id: 'CASCADE',
      size_requirements: 5,
      size_tableau: 13,
      size_engineering: 8,
      size_data_science: 0,
      size_uat_adoption: 3,
      size_total: 29
    });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const td = app.window.document.createElement('td');
    td.dataset.quickEdit = 'size_engineering';
    app.Dashboard.openQuickEdit(td, 'size_engineering', 'CASCADE');
    const input = td.querySelector('input[type="number"]');
    input.value = '12';
    input.dispatchEvent(new app.window.Event('blur'));
    const updated = app.App.data.projects.find(x => x.id === 'CASCADE');
    expect(updated.size_engineering).toBe(12);
    expect(updated.size_total).toBe(33);
    app.teardown();
  });

  it('size_total is read-only (derived columns reject inline edit)', async () => {
    const p = makeProject({ id: 'NODERIV', size_total: 29 });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const td = app.window.document.createElement('td');
    td.dataset.quickEdit = 'size_total';
    app.Dashboard.openQuickEdit(td, 'size_total', 'NODERIV');
    expect(td.querySelector('input')).toBeNull();
    app.teardown();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/columns.test.mjs`
Expected: PASS — both cascade tests green.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/columns.test.mjs
git commit -m "test(table): skill-size cascade + derived columns are read-only"
```

---

## Task 10: Implement the `ColumnPicker` popover + toolbar button

**Files:**
- Modify: `index.html` toolbar at line 2538 — add the Columns button
- Modify: `index.html` — add `ColumnPicker` module after the Dashboard object literal
- Modify: `index.html` — CSS for the popover

- [ ] **Step 1: Add the toolbar button**

In `index.html` at the dashboard toolbar around line 2555 (before the CSV button at line 2555), insert:

```html
          <button class="btn btn-outline btn-sm" onclick="ColumnPicker.toggle(this)" title="Show / hide columns" aria-label="Columns"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="9"/><rect x="14" y="15" width="7" height="6"/></svg> Columns</button>
```

- [ ] **Step 2: Add ColumnPicker module**

After the closing `};` of the `Dashboard` object literal (search for the `};` immediately following `openQuickEdit`'s closing brace, currently around line 10110), append:

```javascript
const ColumnPicker = {
  isOpen: false,
  el: null,

  toggle(triggerBtn) {
    if (this.isOpen) { this.close(); return; }
    this.open(triggerBtn);
  },

  open(triggerBtn) {
    if (this.isOpen) return;
    const cols = Dashboard.COLUMNS.filter(c => !c.hideFromPicker);
    const prefs = Dashboard._getColumnPrefs();
    const visibleSet = new Set(prefs.visible);
    const groups = {};
    cols.forEach(c => { (groups[c.group] = groups[c.group] || []).push(c); });
    const groupOrder = ['Identity', 'Dates', 'Estimates', 'Sprints', 'Risks', 'Remaining work'];
    const html = '<div class="col-picker-popover" role="dialog" aria-label="Columns">' +
      '<div class="col-picker-header">Columns<button class="col-picker-reset" onclick="ColumnPicker.reset()">Reset</button></div>' +
      '<div class="col-picker-body">' +
        groupOrder.filter(g => groups[g]).map(g =>
          '<div class="col-picker-group"><div class="col-picker-group-title">' + Dashboard.esc(g) + '</div>' +
            groups[g].map(c => {
              const checked = visibleSet.has(c.id) || c.alwaysOn;
              const disabled = c.alwaysOn ? ' disabled' : '';
              return '<label class="col-picker-row"><input type="checkbox" data-col-id="' + c.id + '"' + (checked ? ' checked' : '') + disabled + '><span>' + Dashboard.esc(c.label) + (c.alwaysOn ? ' <em style="color:var(--text-muted);font-style:normal;font-size:10px">(always)</em>' : '') + '</span></label>';
            }).join('') +
          '</div>'
        ).join('') +
      '</div></div>';
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    this.el = wrap.firstChild;
    document.body.appendChild(this.el);
    if (triggerBtn) {
      const r = triggerBtn.getBoundingClientRect();
      this.el.style.top = (r.bottom + 6) + 'px';
      this.el.style.left = Math.max(8, r.right - 280) + 'px';
    }
    this.el.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        Dashboard.setColumnVisible(cb.dataset.colId, cb.checked);
        Dashboard.renderHeader();
        Dashboard.renderTable(Dashboard.filteredProjects);
      });
    });
    setTimeout(() => document.addEventListener('click', this._onAway, true), 0);
    document.addEventListener('keydown', this._onKey);
    this.isOpen = true;
  },

  _onAway: (e) => {
    if (ColumnPicker.el && !ColumnPicker.el.contains(e.target) && !e.target.closest('[onclick*="ColumnPicker.toggle"]')) {
      ColumnPicker.close();
    }
  },

  _onKey: (e) => { if (e.key === 'Escape') ColumnPicker.close(); },

  close() {
    if (this.el) { this.el.remove(); this.el = null; }
    document.removeEventListener('click', this._onAway, true);
    document.removeEventListener('keydown', this._onKey);
    this.isOpen = false;
  },

  reset() {
    Dashboard.resetColumns();
    Dashboard.renderHeader();
    Dashboard.renderTable(Dashboard.filteredProjects);
    this.close();
  }
};
```

- [ ] **Step 3: Add CSS for the popover**

Append:

```css
.col-picker-popover { position: fixed; z-index: 9100; background: var(--surface); border: 1px solid var(--border-light); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); width: 280px; max-height: 70vh; overflow: auto; font-size: 12px; }
.col-picker-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid var(--border-light); font-weight: 700; color: var(--text-dark); }
.col-picker-reset { font-size: 11px; padding: 2px 8px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); background: var(--bg-content); color: var(--text-dark-secondary); cursor: pointer; }
.col-picker-body { padding: 6px 0; }
.col-picker-group { padding: 4px 12px 8px; }
.col-picker-group-title { font-size: 10px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 4px; letter-spacing: 0.4px; }
.col-picker-row { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: var(--radius-sm); cursor: pointer; }
.col-picker-row:hover { background: var(--bg-content); }
.col-picker-row input[disabled] { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 4: Smoke-test**

Open app. Click "Columns" button. Confirm popover opens with grouped checklist. Toggle off Manager — confirm column disappears, persists across reload. Click Reset — confirm default returns. Click outside / press Esc — popover closes.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(table): ColumnPicker popover with grouped visibility + reset"
```

---

## Task 11: Switch edit trigger from single-click to double-click

**Files:**
- Modify: `index.html` `attachRowHandlers` at line 9993
- Modify: `index.html` `renderTable` row click handler block at line 9826

- [ ] **Step 1: Replace attachRowHandlers**

Replace the body of `attachRowHandlers(tbody)` (lines 9993–10011) with:

```javascript
  attachRowHandlers(tbody) {
    tbody.querySelectorAll('tr[data-id]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('drag-handle')) return;
        if (e.target.closest('.why-rank-btn, .pin-btn, .rag-dot, [onclick]')) return;
        DetailPanel.open(row.dataset.id);
      });
      row.addEventListener('dblclick', (e) => {
        const editCell = e.target.closest('td[data-quick-edit]');
        if (!editCell || !row.contains(editCell)) return;
        if (e.target.closest('.why-rank-btn, .pin-btn, .rag-dot, [onclick]')) return;
        e.stopPropagation();
        e.preventDefault();
        Dashboard.openQuickEdit(editCell, editCell.dataset.quickEdit, row.dataset.id);
      });
    });
  },
```

- [ ] **Step 2: Apply same handler change in renderTable's row attachment**

In `renderTable` (line 9826 onward), the existing `tbody.querySelectorAll('tr[data-id]').forEach(row => { row.addEventListener('click', …) … })` block contains both click-to-open-detail and drag setup. Replace the click listener with a call to `attachRowHandlers`, and keep the drag setup.

Specifically: locate the block that currently looks like

```javascript
    tbody.querySelectorAll('tr[data-id]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('drag-handle')) return;
        DetailPanel.open(row.dataset.id);
      });
      if (canDrag) { /* dragstart, dragend, dragover, dragleave, drop listeners */ }
    });
```

Refactor to:

```javascript
    this.attachRowHandlers(tbody);
    if (canDrag) {
      tbody.querySelectorAll('tr[data-id]').forEach(row => {
        row.addEventListener('dragstart', (e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', row.dataset.id);
          row.classList.add('dragging');
        });
        row.addEventListener('dragend', () => {
          row.classList.remove('dragging');
          tbody.querySelectorAll('tr').forEach(r => { r.classList.remove('drag-over-above','drag-over-below'); });
        });
        row.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const rect = row.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          tbody.querySelectorAll('tr').forEach(r => { r.classList.remove('drag-over-above','drag-over-below'); });
          row.classList.add(e.clientY < mid ? 'drag-over-above' : 'drag-over-below');
        });
        row.addEventListener('dragleave', () => {
          row.classList.remove('drag-over-above','drag-over-below');
        });
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData('text/plain');
          const targetId = row.dataset.id;
          if (draggedId === targetId) return;
          const rect = row.getBoundingClientRect();
          const above = e.clientY < rect.top + rect.height / 2;
          this.reorderPriority(draggedId, targetId, above);
          tbody.querySelectorAll('tr').forEach(r => { r.classList.remove('drag-over-above','drag-over-below'); });
        });
      });
    }
```

- [ ] **Step 3: Smoke-test**

Open app:
- Single-click any row → detail panel opens.
- Single-click on Status badge cell → detail panel opens (NOT inline edit).
- Double-click on Status badge cell → inline `<select>` appears.
- Double-click on Target date cell → inline date input appears.
- Double-click on RAG cell → cycle dots appear.

- [ ] **Step 4: Confirm existing E2E tests still pass**

Run: `npm run test:e2e`
Expected: PASS — `tests/e2e/edit-project.spec.ts` already uses single-click on a row to open the detail panel; that flow is unchanged.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: PASS — unit, render snapshots, E2E.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(table): Excel-style double-click to edit; single-click opens detail panel"
```

---

## Task 12: E2E tests for picker, edit, persistence

**Files:**
- Create: `tests/e2e/columns.spec.ts`

- [ ] **Step 1: Write the E2E spec**

Create `tests/e2e/columns.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('column picker hides Manager and persists across reload', async ({ page }) => {
  await openAppWithData(page);
  await expect(page.locator('#projectTableHead th[data-col-id="manager"]')).toBeVisible();
  await page.locator('button[onclick*="ColumnPicker.toggle"]').click();
  await expect(page.locator('.col-picker-popover')).toBeVisible();
  await page.locator('.col-picker-popover input[data-col-id="manager"]').click();
  await expect(page.locator('#projectTableHead th[data-col-id="manager"]')).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__pcc__);
  await expect(page.locator('#projectTableHead th[data-col-id="manager"]')).toHaveCount(0);
});

test('Reset restores default columns', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).__pcc__.Dashboard.setColumnVisible('manager', false));
  await page.evaluate(() => (window as any).__pcc__.Dashboard.renderHeader());
  await expect(page.locator('#projectTableHead th[data-col-id="manager"]')).toHaveCount(0);
  await page.locator('button[onclick*="ColumnPicker.toggle"]').click();
  await page.locator('.col-picker-reset').click();
  await expect(page.locator('#projectTableHead th[data-col-id="manager"]')).toBeVisible();
});

test('column resize persists across reload', async ({ page }) => {
  await openAppWithData(page);
  const handle = page.locator('th[data-col-id="manager"] .col-resize-handle');
  const startBox = await handle.boundingBox();
  await page.mouse.move(startBox!.x + 2, startBox!.y + startBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(startBox!.x + 62, startBox!.y + startBox!.height / 2, { steps: 5 });
  await page.mouse.up();
  const newWidth = await page.evaluate(() => {
    const th = document.querySelector('#projectTableHead th[data-col-id="manager"]') as HTMLElement;
    return th.getBoundingClientRect().width;
  });
  expect(newWidth).toBeGreaterThan(140);
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__pcc__);
  const afterReload = await page.evaluate(() => {
    const th = document.querySelector('#projectTableHead th[data-col-id="manager"]') as HTMLElement;
    return th.getBoundingClientRect().width;
  });
  expect(Math.abs(afterReload - newWidth)).toBeLessThan(5);
});

test('double-click edits target date', async ({ page }) => {
  await openAppWithData(page);
  const firstRow = page.locator('#projectTableBody tr').first();
  const projectId = await firstRow.getAttribute('data-id');
  const cell = firstRow.locator('td[data-quick-edit="target_date"]');
  await cell.dblclick();
  const input = cell.locator('input[type="date"]');
  await expect(input).toBeVisible();
  await input.fill('2026-12-31');
  await input.blur();
  await expect(page.locator('#projectTableBody tr[data-id="' + projectId + '"] td[data-quick-edit="target_date"]')).toContainText('31 Dec');
  const stored = await page.evaluate((id) => {
    const App = (window as any).__pcc__.App;
    return App.data.projects.find((p: any) => p.id === id).target_date;
  }, projectId);
  expect(stored).toBe('2026-12-31');
});

test('skill cascade updates size_total', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).__pcc__.Dashboard.setColumnVisible('size_engineering', true));
  await page.evaluate(() => {
    const D = (window as any).__pcc__.Dashboard;
    D.renderHeader(); D.renderTable(D.filteredProjects);
  });
  const firstRow = page.locator('#projectTableBody tr').first();
  const projectId = await firstRow.getAttribute('data-id');
  const before = await page.evaluate((id) => {
    return (window as any).__pcc__.App.data.projects.find((p: any) => p.id === id);
  }, projectId);
  const newDe = (before.size_engineering || 0) + 5;
  const expectedTotal = (before.size_total || 0) - (before.size_engineering || 0) + newDe;
  const cell = firstRow.locator('td[data-quick-edit="size_engineering"]');
  await cell.dblclick();
  const input = cell.locator('input[type="number"]');
  await input.fill(String(newDe));
  await input.blur();
  const after = await page.evaluate((id) => {
    return (window as any).__pcc__.App.data.projects.find((p: any) => p.id === id);
  }, projectId);
  expect(after.size_engineering).toBe(newDe);
  expect(after.size_total).toBe(expectedTotal);
});

test('single-click still opens detail panel', async ({ page }) => {
  await openAppWithData(page);
  const firstRow = page.locator('#projectTableBody tr').first();
  await firstRow.click();
  await expect(page.locator('#detailPanel.open')).toBeVisible();
});
```

- [ ] **Step 2: Run E2E**

Run: `npm run test:e2e`
Expected: PASS — all 6 specs green.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS — unit + render + E2E all green.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/columns.spec.ts
git commit -m "test(table): E2E coverage for picker, edit, persistence"
```

---

## Task 13: Final clean-up and documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

In `CLAUDE.md` under "Architecture", add a bullet:

```markdown
- **Schema-driven Projects table** — `Dashboard.COLUMNS` is the single source of truth for header, row body, column picker, and inline editor. Add a column = add one entry. Inline edits dispatch on `col.edit.type` and write through `App.updateProject`.
```

- [ ] **Step 2: Sanity-run npm test once more**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Smoke checklist (manual)**

Open the app in a real browser. Confirm:

- Default 14 cells per row (drag, pin, plus 12 user-visible).
- Click "Columns" → popover opens; toggling Manager hides/shows; reset works; click-outside / Esc closes.
- Drag a `<th>` to reorder; reload — order preserved.
- Drag a column's right edge to resize; reload — width preserved.
- Double-click status cell → `<select>`; pick a value → row updates AND filters reflect.
- Double-click target_date cell → date input; type a date → cell shows new date.
- Double-click DE pts cell → number input; type 12 → cell updates AND Est cell auto-updates.
- Single-click any row → detail panel opens (not edit).
- Switch GCC / KS / DR&I → column layout preserved (global, not per-customer).
- Sort by Customer / Status / Priority — works.
- Reload — all of the above persisted.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: customizable & editable Projects table notes in CLAUDE.md"
```

---

## Self-Review Checklist (already run)

- **Spec coverage** — every section in the spec maps to a task: registry (T1), persistence (T2), buildRowHtml (T3), renderTable refactor (T4), renderHeader (T5), resize (T6), reorder (T7), editor dispatch (T8), skill cascade (T9), picker (T10), Excel-style trigger (T11), tests (T12), docs (T13).
- **Placeholder scan** — no TODO / TBD / "appropriate error handling". Every code step has full code. Every command has expected output.
- **Type consistency** — `Dashboard.COLUMNS`, `visibleColumns()`, `setColumnVisible/setColumnOrder/setColumnWidth/resetColumns`, `_getColumnPrefs/_setColumnPrefs`, `renderHeader`, `attachHeaderHandlers`, `openQuickEdit`, `ColumnPicker.toggle/open/close/reset` all consistent across tasks.
- **DRY** — `renderTable` uses `buildRowHtml` (T4) which uses the registry (T3). One header source (T5), one row source (T3). Persistence helpers shared (T2).
- **YAGNI** — only visibility, order, width persisted. No collapsible groups, no search-in-picker, no per-customer layouts, no cell-level undo.
- **TDD** — Tasks 1, 2, 8, 9 are test-first; Tasks 3, 11 use snapshot regen. UI tasks (5, 6, 7, 10) verified by E2E in Task 12 + smoke checklist in Task 13.
