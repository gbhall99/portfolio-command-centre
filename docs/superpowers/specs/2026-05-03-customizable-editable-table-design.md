# Customizable & Editable Projects Table — Design

**Date:** 2026-05-03
**Status:** Approved
**Owner:** Gareth
**Scope:** Dashboard / Projects tabular view (`#projectTable`)

---

## Goal

Turn the Projects table into a review surface the user can shape and update without round-tripping through the detail panel. Two outcomes:

1. **Choose which columns are visible**, in what order, and at what width — drawn from the project fields the user reviews most often (dates, estimates, sprints, risks, remaining work).
2. **Edit cells inline** with a widget appropriate to each field's data type, going through the existing audit/undo/save pipeline so data integrity is preserved.

## Non-goals

- Column-picker improvements beyond visibility/reorder/resize (no group collapse, no search-in-picker).
- Editing the nested project structures (`skill_splits`, `phase_status`, `risks_register`, `delivery_config`) inline. These remain detail-panel-only; the table cell becomes a clickable summary.
- Multi-cell selection, formula cells, paste-from-Excel, conditional formatting beyond existing row-tone rules.
- Per-customer column layouts. Persistence is global.

## Constraints

- Single-file app (`index.html`). No new build step, no new dependencies.
- All writes must flow through `App.updateProject(id, field, value)` so undo, audit, dirty-flag, autosave, and re-render notifications stay consistent.
- Story points are integers — use `App.toInteger` for parsing and `App.fmtPoints` for rendering (per CLAUDE.md).
- No emojis. Inline SVG icons only.
- HTML is rendered by string concatenation. Escape user input via `Dashboard.esc`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Dashboard.COLUMNS                             │
│   single declarative registry — one entry per column                 │
└───────────┬────────────────────┬───────────────────┬─────────────────┘
            │                    │                   │
            ▼                    ▼                   ▼
   Dashboard.renderHeader  Dashboard.buildRowHtml  ColumnPicker.open
   (rebuilds <thead>)      (renders each <td>)    (popover UI)
                                  │
                                  ▼
                         Dashboard.openQuickEdit
                         (dispatches on col.edit.type)
                                  │
                                  ▼
                         App.updateProject(id, field, value)
                         (undo + audit + dirty + save + notify)
```

The registry is the single source of truth. Header text, sort key, render output, edit widget, and column-picker label all derive from one entry per column. Adding a column means adding one object literal — nothing else.

This consolidates two existing renderers (`renderTable` row body and `buildRowHtml`) which currently render slightly different column sets and have drifted out of sync.

---

## Components

### 1. `Dashboard.COLUMNS` — column registry

A single array of descriptors. Shape:

```js
{
  id: 'target_date',                 // unique stable key (used for visibility/order/width prefs)
  group: 'Dates',                    // picker section: Identity | Dates | Estimates | Sprints | Risks | Remaining work
  label: 'Target',                   // header text + picker label
  width: 80,                         // default px width
  alwaysOn: false,                   // true = cannot be hidden (priority, name)
  sortable: true,                    // toggles header sort affordance
  sortField: 'target_date',          // optional override (defaults to id)
  render: (p) => fmtDate(p.target_date),    // returns innerHTML for the <td>
  cellClass: '',                     // optional extra <td> class
  edit: { type: 'date', field: 'target_date' }   // omit for read-only
}
```

**Editor `type` dispatch**:

| `type`     | Widget                                | Used for                                          |
|------------|---------------------------------------|---------------------------------------------------|
| `text`     | `<input type="text">`                 | risks (free text), assumptions, dependencies, notes (single-line preview), manager, category, name |
| `number`   | `<input type="number" min="0" step="1">` | priority, size_requirements, size_tableau, size_engineering, size_data_science, size_uat_adoption |
| `date`     | `<input type="date">`                 | start_date, target_date, hard_deadline, baseline_start, baseline_end, actual_date, product_release_date, comms_date |
| `select`   | `<select>` from `col.edit.options`    | status, deadline_type, governance_class, visibility, comms_status, budget_status, moscow |
| `textarea` | popover with `<textarea>` (commit on Cmd/Ctrl+Enter or click-outside) | notes, risks (long-form) |
| `rag`      | existing 3-dot cycle                  | rag composite cell                                |
| `sprint`   | `<select>` populated from active sprints for the project's customer | current_sprint, target_sprint |
| `derived`  | no editor — cell is read-only         | size_total, remaining points, last_updated, last_reviewed_at, recommended_priority, priority_score, WSJF |

**Validation hooks (optional per column)**:

```js
edit: {
  type: 'number',
  field: 'size_engineering',
  parse: (raw) => App.toInteger(raw),     // default per type
  validate: (n) => n >= 0,                // default = truthy
  onAfterWrite: (p) => recomputeSizeTotal(p)   // for skill sizes
}
```

### 2. `Dashboard.renderHeader()`

Rebuilds `<thead>` from the visible/ordered column list:

- Reads `Dashboard.visibleColumns` (computed from prefs + always-on).
- For each column emits a `<th>` with `data-col-id`, current width, sort affordance if `sortable`, and a resize handle (`<div class="col-resize-handle">`) on the right edge.
- Wires:
  - **Sort** click on `<th>` body → existing `Dashboard.sortBy(col.sortField || col.id)`.
  - **Resize** drag on the handle → updates `widths[col.id]`, persists on mouseup.
  - **Reorder** drag of the `<th>` itself (HTML5 DnD) → updates `order` array, persists, calls `renderHeader` + `renderTable`.

### 3. `Dashboard.buildRowHtml(p)` — single source of truth

Replaces both the inline row HTML in `renderTable` (line 9801–9817) and the existing `buildRowHtml` (line 9925–9991). Iterates `Dashboard.visibleColumns`:

```js
buildRowHtml(p) {
  const tone = p.status === 'At Risk' ? ' class="row-at-risk"'
             : p.status === 'Blocked' ? ' class="row-blocked"' : '';
  const cells = Dashboard.visibleColumns.map(col => {
    const editAttr = col.edit && col.edit.type !== 'derived'
      ? ' data-quick-edit="' + col.id + '"' : '';
    const cls = col.cellClass ? ' class="' + col.cellClass + '"' : '';
    return '<td' + cls + editAttr + '>' + col.render(p) + '</td>';
  }).join('');
  return '<tr' + tone + ' data-id="' + p.id + '" draggable="true">' + cells + '</tr>';
}
```

The fixed leading cells (drag handle, pin icon) are entries in `COLUMNS` with `alwaysOn: true`, `sortable: false`, and `hideFromPicker: true` — the loop renders them but the column picker hides them from the user (they're row chrome, not data columns).

### 4. `ColumnPicker` — toolbar popover

New component, ~150 lines. Triggered by a "Columns" button in the dashboard toolbar.

```
┌─ Columns ─────────────────────── [Reset] ─┐
│ Identity                                  │
│   ☑ # (always)         ☑ Project (always) │
│   ☑ Customer            ☐ Category        │
│   ☑ Manager             ☐ Sponsor         │
│ Dates                                     │
│   ☑ Target              ☑ Hard deadline   │
│   ☐ Start               ☐ Baseline start  │
│   ☐ Baseline end        ☐ Actual date     │
│   ☐ Product release     ☐ Comms date      │
│ Estimates                                 │
│   ☑ Est (size_total)    ☐ Req points      │
│   ☐ Tab points          ☐ DE points       │
│   ☐ DS points           ☐ UAT points      │
│ Sprints                                   │
│   ☑ Sprint range        ☐ Target sprint   │
│ Risks                                     │
│   ☑ RAG                 ☐ Risks (text)    │
│   ☐ Assumptions         ☐ Dependencies    │
│ Remaining work                            │
│   ☑ Done points         ☑ Remaining       │
└───────────────────────────────────────────┘
```

Each row has a checkbox + a drag handle (⠿) for reorder within the picker. Toggling a checkbox calls `Dashboard.setColumnVisible(id, on)`. Drag drops reorder both the picker list and the live header.

**"Reset to default"** wipes `dashboard.columns` from uiState and re-renders.

Closed by click-outside or `Esc`.

### 5. `Dashboard.openQuickEdit()` — type-dispatched editor

Extension of the existing function (line 10015). The chain of `if (field === 'status')` becomes a switch keyed off `col.edit.type`, with editor construction factored into small helpers:

```js
const editors = {
  text: (col, value) => '<input type="text" class="quick-edit-input" value="' + esc(String(value ?? '')) + '">',
  number: (col, value) => '<input type="number" class="quick-edit-input" min="0" step="1" value="' + (value ?? '') + '">',
  date: (col, value) => '<input type="date" class="quick-edit-input" value="' + (value ? String(value).slice(0, 10) : '') + '">',
  select: (col, value) => '<select class="quick-edit-input">' + col.edit.options.map(o =>
    '<option value="' + esc(o) + '"' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>'
  ).join('') + '</select>',
  textarea: (col, value) => '<textarea class="quick-edit-input quick-edit-textarea" rows="4">' + esc(String(value ?? '')) + '</textarea>',
  sprint: (col, value, p) => sprintSelectHtml(p.customer, value),
  rag: (col, value, p) => existingRagCycleHtml(p)
};
```

Commit flow stays identical to today's `commit()`: parse → validate → if changed, `App.updateProject(id, field, parsed)`. Cancel on Esc or invalid.

**Skill-size derived recompute** — when `col.edit.field` matches `/^size_(requirements|tableau|engineering|data_science|uat_adoption)$/`:

```js
App.updateProject(id, field, parsed);
const p = App.data.projects.find(x => x.id === id);
const newTotal = ['size_requirements','size_tableau','size_engineering','size_data_science','size_uat_adoption']
  .reduce((s, k) => s + (App.toInteger(p[k]) || 0), 0);
if (newTotal !== p.size_total) App.updateProject(id, 'size_total', newTotal);
```

Two separate `updateProject` calls keep the audit log explicit (skill changed *and* total recomputed) without changing the function signature.

### 6. Persistence

```js
App.uiStateSet('dashboard.columns', {
  visible: ['priority', 'name', 'customer', 'manager', 'status', 'rag', 'target_date', 'hard_deadline', 'current_sprint', 'size_total', 'size_done', 'size_remaining'],
  order:   ['priority', 'name', 'customer', 'manager', 'status', 'rag', 'target_date', 'hard_deadline', 'current_sprint', 'size_total', 'size_done', 'size_remaining'],
  widths:  { name: 280, manager: 140 }   // sparse — only overrides
});
```

- **Global**, not per-customer.
- Read on `Dashboard.init`. If missing or malformed, fall through to defaults silently and log to console.
- Written on every change (toggle, reorder, resize end). Already throttled by localStorage write batching in `App`.

### 7. Edit trigger — Excel-style

- **Double-click** a cell with `data-quick-edit` → enter edit mode.
- **Single-click** anywhere on the row → open `DetailPanel` (existing).
- **Tab** in active editor → commit + advance to next editable cell in the row.
- **Shift+Tab** → commit + previous editable cell.
- **Enter** → commit + close (no row advance — row advance felt wrong in a sortable table).
- **Esc** → cancel.

This changes today's single-click trigger. The existing `attachRowHandlers` `click` listener splits: a `dblclick` handler fires `openQuickEdit`; the `click` handler always opens the detail panel. The current accidental-edit risk goes away.

---

## Default column set

The 12 columns shown by default ("review" framing per the user):

| Order | Column        | Group         | Editable |
|-------|---------------|---------------|----------|
| 1     | Priority (#)  | Identity      | yes (number) |
| 2     | Project name  | Identity      | yes (text) |
| 3     | Customer      | Identity      | yes (select: GCC/KS/DR&I) |
| 4     | Manager       | Identity      | yes (text) |
| 5     | Status        | Identity      | yes (select) |
| 6     | RAG           | Risks         | yes (cycle) |
| 7     | Target date   | Dates         | yes (date) |
| 8     | Hard deadline | Dates         | yes (date) |
| 9     | Sprint range  | Sprints       | derived (read-only summary) |
| 10    | Est           | Estimates     | derived (auto-sum) |
| 11    | Done          | Remaining     | derived (sum of completed) |
| 12    | Remaining     | Remaining     | derived (Est − Done) |

The fixed drag handle and pin icon are technically columns 0a/0b (always-on, not in picker).

Other columns ship hidden-by-default and are enabled via the picker.

---

## Data flow

### Edit a date

```
1. User double-clicks Target cell on row GCC-001
2. openQuickEdit replaces cell innerHTML with <input type="date" value="2026-06-30">
3. User types 2026-07-15, blurs (or Tab)
4. commit() → parse '2026-07-15' (already ISO) → validate (parses as Date)
5. Equal to original? no → App.updateProject('GCC-001', 'target_date', '2026-07-15')
   - pushUndo, logChange, set p.target_date, set p.last_updated, markDirty,
     saveToLocalStorage, notifyDataChange
6. notifyDataChange listener triggers Dashboard.applyAndRender → renderTable redraws
7. Cell now shows '15 Jul'
```

### Edit a skill size (cascading)

```
1. User edits "DE points" cell on row GCC-001 from 8 → 12
2. App.updateProject('GCC-001', 'size_engineering', 12)  [audit: size_engineering 8→12]
3. onAfterWrite hook computes new total = 5+13+12+0+3 = 33
4. p.size_total was 29 → App.updateProject('GCC-001', 'size_total', 33)  [audit: size_total 29→33]
5. Re-render — Est cell updates, Remaining cell updates
```

### Toggle a column off

```
1. User opens Column Picker, unchecks Manager
2. Dashboard.setColumnVisible('manager', false):
   - prefs.visible filters out 'manager'
   - App.uiStateSet('dashboard.columns', prefs)
3. renderHeader() rebuilds <thead> without Manager
4. renderTable() rebuilds <tbody> via buildRowHtml — Manager <td> absent
```

### Reorder columns

```
1. User drags <th data-col-id="manager"> left of <th data-col-id="customer">
2. dragend handler computes new order array
3. App.uiStateSet('dashboard.columns', { ...prefs, order: newOrder })
4. renderHeader() + renderTable() redraw
```

---

## Error handling

| Case                                       | Behaviour                                                  |
|--------------------------------------------|------------------------------------------------------------|
| Invalid date input                         | revert cell, no write, `App.toast('Invalid date', 'warn')` |
| Negative or non-integer in number editor   | revert, `App.toast('Story points must be ≥ 0', 'warn')`    |
| Select editor — value not in options       | (cannot happen via `<select>`; defensive parse rejects)    |
| Unchanged value                            | no write, no audit (already today's behaviour)             |
| `alwaysOn` column toggled in picker        | checkbox disabled, `aria-disabled="true"`                  |
| `dashboard.columns` malformed in localStorage | log + fall through to defaults                          |
| Sprint select for unknown customer         | shows current value as disabled option + active sprints    |
| Customer changed inline (e.g. GCC → KS)    | write succeeds; project disappears from current view (customer-scoped). User sees toast `Moved to KS` with Undo affordance via existing global undo. |

---

## Testing

### Unit (vitest)

- **Registry shape**: every column has `id`, `group`, `label`; every editable column has `edit.type` matching a known dispatch entry.
- **Editor parse/validate**: each `parse` produces the right type; each `validate` rejects what we expect (negative numbers, non-ISO dates, non-option enum values).
- **Skill-size cascade**: editing `size_de` from 8→12 produces two `App.updateProject` calls and `size_total` reflects the new sum.
- **Visibility prefs**: `setColumnVisible` updates state + persists; `alwaysOn` columns cannot be hidden.

### Render snapshot

- Default column set produces stable HTML for a fixture project.
- Custom column set (3 hidden, 1 reordered) produces matching HTML.

### E2E (Playwright)

1. **Column picker**: open picker → uncheck "Manager" → assert no `<th data-col-id="manager">`; reload → assert still hidden (persisted).
2. **Reorder**: drag Manager `<th>` left of Customer → assert order in DOM; reload → assert restored.
3. **Resize**: drag Name resize handle by 60px → assert width attribute; reload → assert restored.
4. **Inline edit a date**: double-click Target on GCC-001 → type `2026-07-15` → Tab → assert cell shows `15 Jul` AND `App.data.projects[0].target_date === '2026-07-15'` AND localStorage `appData` reflects it.
5. **Skill cascade**: double-click DE points → set 12 → blur → assert Est cell auto-updates.
6. **Single click still opens detail panel**: single-click any non-edit cell → assert detail panel open.

### Manual smoke

- Customer switch retains column layout.
- Sort by a hidden column impossible (header gone). Sort by a visible column works.
- Drag-reorder rows still works when sorted by Priority asc.

---

## Out of scope

- Group collapse in picker.
- Search/filter inside picker.
- Multi-cell selection or copy-paste from Excel.
- Conditional formatting (cell-level RAG colour, deadline-soon highlight) beyond existing row tones.
- Per-customer column layouts.
- Cell-level undo (App-level undo already covers any column write).
- Column freezing (left-pin) beyond the always-on leading drag/pin cells.

---

## Implementation order (for the plan)

1. Build `Dashboard.COLUMNS` registry with default 12 + the rest hidden-by-default.
2. Refactor `renderTable` and `buildRowHtml` to consume the registry. Remove duplicated row code.
3. Build `Dashboard.renderHeader` from the registry. Wire sort + resize + reorder.
4. Extend `openQuickEdit` to dispatch on `edit.type`. Wire skill-size cascade.
5. Implement `ColumnPicker` popover + toolbar button. Wire visibility toggle + Reset.
6. Persist via `App.uiStateSet('dashboard.columns', …)`. Read on init.
7. Switch edit trigger from single click to double click; preserve row click → detail panel.
8. Tests: unit, snapshot, E2E.

Each step is independently testable; tests added in step 8 should be split per step in the implementation plan.
