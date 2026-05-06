# Project Details Overhaul — Design

**Date:** 2026-05-06
**Status:** Approved
**Owner:** Gareth
**Scope:** Project DetailPanel — fields, sections, layout, dropdown styling, data shape

---

## Goal

Tighten the Project Details panel so it surfaces what's actively managed and removes friction in the rest. Drives ten of the user's thirteen feedback items in one PR because they touch the same panel and data shape.

After this rework:

- **Communications** section is gone. The `comms_log` array and `comms_date` field leave the data model.
- **Sponsor** is a managed dropdown, sourced from the active customer's `sponsors: []` pool with an "Add new sponsor…" affordance that updates Settings → Customers in place.
- **External dependencies** require a `label` (already in the data shape but UI didn't always require it) — clearer add-form copy + validation.
- **Assumptions** become a structured register (`assumptions_register: [{date, made_by, text, notes}]`) matching the Decisions register UI verbatim.
- **Benefits** become a structured multi-entry array (`benefits: [{type: 'time_saving' | 'cost_saving', amount, units, description}]`) replacing the freeform `benefits` string.
- **Success criteria** become a structured array (`success_criteria: [{name, target, measure, tag}]`) with `tag` from a fixed small list (Adoption / Cost / Cycle time / Quality / Revenue).
- **Dropdowns** in DetailPanel use the canonical `.field-input` styling so they match the rest of the app.
- **Dates** move out of the legacy "Dates" subsection and live inside the Delivery section. Only `hard_deadline` (external) and `target_date` are user-editable; `start_date`, `actual_date`, and `baseline_*` remain on the data model and rendered for context but lose their dedicated editors. `comms_date` and `external_delivery_date` are deleted from data + UI.
- **Single start/end sprint fields**, both read-only, both showing `<sprint_id> · <date>`. Updated automatically whenever sprint planning re-allocates.

## Non-goals

- KPI library (`kpi_library` setting). Out per Q3 — per-project criteria only.
- Cross-project sponsor lookup. Sponsors are scoped to a customer.
- Dashboard column changes. Existing column picker continues to expose all the now-deprecated fields if the user has them visible — the column picker is the escape hatch.
- Walkthrough/audit changes for renamed fields beyond what `App.updateProject` already does.

## Constraints

- Single-file `index.html`. innerHTML string concatenation; user content escaped via `Dashboard.esc`. Don't try to "improve" the pattern — established convention.
- Story points are integers (`App.toInteger`, `App.fmtPoints`).
- All writes through `App.updateProject(id, field, value)`.
- No emojis (typographic glyphs are fine).
- Schema migration runs in `migrateSchema` so existing JSON loads cleanly.

---

## Architecture

```
Project record
  ├── customer ───────────► customer.sponsors[] (Settings → Customers, new field)
  ├── sponsor (string from pool) ─── managed select with "Add new" → updates customer.sponsors
  ├── assumptions_register: [{date, made_by, text, notes}]      (NEW; replaces assumptions string)
  ├── benefits: [{type, amount, units, description}]            (NEW; replaces benefits string)
  ├── success_criteria: [{name, target, measure, tag}]          (NEW)
  ├── dependencies: [{kind: 'project'|'external', label?, target_id?, expected_date?, notes?}]
  │       (existing shape; UI now requires label for external)
  ├── current_sprint  (DERIVED on render — earliest sprint in skill_splits)
  └── target_sprint   (DERIVED on render — latest sprint in skill_splits)

Dropped from project record + UI:
  ├── comms_log          (entire structured array)
  └── comms_date         (legacy field — already migrated to comms_log; now also deleted)
  └── external_delivery_date

Settings → Customers gains:
  └── customer.sponsors: [string]         (managed list, edited via the existing customers table)
```

DetailPanel section layout (final):

```
HEALTH tab
├── EVM strip
├── Status & Health         (status, RAG x3)
├── Completion              (only when status = Complete/Closed)
├── Notes
├── Assumptions register    (structured table; mirrors Decisions)
├── Risks register
├── Decisions register
└── (no Communications section)

SETUP tab
├── Identity                (id, name, customer, category, manager)
├── Sponsor                 (managed select, "Add new")
├── Visibility / governance class
├── In-scope / Out-of-scope (existing)
├── Benefits                (structured multi-row)
└── Success criteria        (structured multi-row)

DELIVERY tab
├── Lifecycle stage         (existing chip + Advance dropdown — from prior rework)
├── Dates                   ← MOVED HERE; editors only for hard_deadline + target_date
│       Read-only context: start_date, actual_date, baseline_start, baseline_end
├── Sprint window           ← NEW
│       Start sprint (read-only): "{sprint_id} · {start_date}"
│       End sprint   (read-only): "{sprint_id} · {end_date}"
├── Sizing & skills         (existing)
├── Dependencies            (existing; external requires label)
└── Phases / delivery_config (existing)
```

## Data model changes

### New fields

```jsonc
// On project
"assumptions_register": [
  { "date": "2026-04-22", "made_by": "Sarah Thompson", "text": "Stakeholders sign-off by S5", "notes": "Confirmed verbally" }
],
"benefits": [
  { "type": "time_saving",  "amount": 200,    "units": "hours/year", "description": "Auto-generated weekly metric pack" },
  { "type": "cost_saving",  "amount": 48000,  "units": "GBP/year",   "description": "Avoided licence renewal" }
],
"success_criteria": [
  { "name": "All metrics auto-refreshed daily", "target": "100%", "measure": "Cron success rate", "tag": "Quality" }
]
```

### On customer (settings)

```jsonc
{ "name": "GCC", "color": "#3b82f6", "staleThreshold": 14, "sponsors": ["Sarah Thompson", "James Mitchell"] }
```

### Dropped fields

- `project.comms_log`         (entire array)
- `project.comms_date`        (already migrated to comms_log; now removed)
- `project.external_delivery_date`
- `project.assumptions`       (string — replaced by `assumptions_register`)
- `project.benefits`          (string — replaced by `benefits` array)

### Migration (in `migrateSchema`)

```javascript
// 1. Drop comms data entirely.
data.projects.forEach(p => {
  delete p.comms_log;
  delete p.comms_date;
  delete p.external_delivery_date;
});

// 2. Migrate assumptions string → register
data.projects.forEach(p => {
  if (typeof p.assumptions === 'string' && p.assumptions.trim() && !Array.isArray(p.assumptions_register)) {
    p.assumptions_register = [{
      date: (p.last_updated || new Date().toISOString()).slice(0, 10),
      made_by: '',
      text: p.assumptions.trim(),
      notes: ''
    }];
  }
  if (!Array.isArray(p.assumptions_register)) p.assumptions_register = [];
  delete p.assumptions;
});

// 3. Migrate benefits string → array
data.projects.forEach(p => {
  if (typeof p.benefits === 'string' && p.benefits.trim() && !Array.isArray(p.benefits)) {
    // Heuristic: keep as a single description-only entry; user re-classifies later.
    p.benefits = [{ type: 'cost_saving', amount: 0, units: '', description: p.benefits.trim() }];
  }
  if (!Array.isArray(p.benefits)) p.benefits = [];
});

// 4. Default success_criteria
data.projects.forEach(p => {
  if (!Array.isArray(p.success_criteria)) p.success_criteria = [];
});

// 5. Customer sponsors list (defaults from existing project.sponsor values)
const seenSponsorsByCustomer = {};
data.projects.forEach(p => {
  if (!p.customer || !p.sponsor) return;
  (seenSponsorsByCustomer[p.customer] = seenSponsorsByCustomer[p.customer] || new Set()).add(p.sponsor);
});
data.customers = data.customers || [];
data.customers.forEach(c => {
  if (!Array.isArray(c.sponsors)) c.sponsors = [];
  const seen = seenSponsorsByCustomer[c.name];
  if (seen) seen.forEach(s => { if (c.sponsors.indexOf(s) < 0) c.sponsors.push(s); });
});
```

## Components

### 1. `DetailPanel.renderSponsorField(p)`

Replaces today's plain `<input type="text" data-field="sponsor">` with a `<select class="field-input" data-field="sponsor">` whose options come from the active customer's `sponsors: []`. Last option is `<option value="__add__">+ Add new sponsor…</option>`. Selecting that triggers `DetailPanel.addSponsor(projectId)` which prompts for a name, appends it to the customer's pool via `App.addCustomerSponsor(customerName, sponsorName)`, and re-selects.

### 2. `DetailPanel.renderAssumptions(p)` + `addAssumption / removeAssumption / updateAssumption`

Mirror the Decisions register render. Inline-editable rows of `[date, made_by, text, notes]`. Same UX, same CSS. Reuse `risk-add-btn` styling.

### 3. `DetailPanel.renderBenefits(p)` + `addBenefit / removeBenefit / updateBenefit`

Each row is a 4-cell strip:
- `<select>` type: `time_saving | cost_saving`
- `<input type="number">` amount (integer)
- `<input type="text">` units (e.g. `hours/year`, `GBP/year`)
- `<input type="text">` description (free-text)
- delete X

`+ Add benefit` button. No template buttons.

### 4. `DetailPanel.renderSuccessCriteria(p)` + `add/remove/updateSuccessCriterion`

Each row:
- `<input type="text">` name
- `<input type="text">` target
- `<input type="text">` measure
- `<select>` tag from `['Adoption','Cost','Cycle time','Quality','Revenue']`
- delete X

### 5. `DetailPanel.renderDates(p)` (lives in Delivery tab)

Editors only for:
- `hard_deadline` (date input)
- `target_date` (date input)

Read-only badges (small grey labels) for any of:
- `start_date` (when set, format as `15 Mar`)
- `actual_date` (when set + status terminal)
- `baseline_start → baseline_end` (when both set)

No editor for the read-only set; clicking opens a tooltip "Updated automatically — see Sprint Planning / Lifecycle stage."

### 6. `DetailPanel.renderSprintWindow(p)`

Two read-only field-groups:

```
Start sprint:  CY26-S2 · 1 May
End sprint:    CY26-S5 · 15 Jul
```

Computed via `App.computeSprintWindow(p)` which scans `skill_splits` for the earliest and latest sprint with assignments, then enriches with that sprint's `start_date`/`end_date`. Falls back to `—` when no assignments.

`current_sprint` and `target_sprint` are written as a side-effect of allocation (existing flow) — those fields stay in data but the DetailPanel no longer offers manual editors. The new derived display reads from `skill_splits` directly so it stays correct even if `current_sprint`/`target_sprint` get out of sync.

### 7. Customer settings — sponsors column

Add a new column to the Customers config table (in `_renderCustomersCard`):

```
| Name | Color | Stale (days) | Sponsors                          | Actions       |
| GCC  | ⬛    | 14           | Sarah Thompson, James Mitchell ✎  | Rename Delete |
```

Click "✎" opens a small inline editor: textarea, comma-separated, trims and dedups on save. New `App.setCustomerSponsors(customerName, sponsorsArray)` handles the write.

### 8. Dropdown styling fix

Sweep DetailPanel's renders for any `<select>` not using `class="field-input"` — apply the class everywhere. Confirm cell `padding`, `border-radius`, `font-size` match `.field-input` baseline. Most likely culprits: status select, customer select, governance select, RAG selects, lifecycle Advance dropdown.

## Data flow

### Edit a sponsor (existing customer)

```
1. User opens project detail panel
2. Sponsor select renders with active customer's sponsors as <option>s + "+ Add new sponsor…"
3. User picks "Sarah Thompson" → onchange → DetailPanel.onFieldChange(this) → App.updateProject(id, 'sponsor', 'Sarah Thompson')
4. Audit + dirty + save fire as today.
```

### Add a new sponsor

```
1. User picks "+ Add new sponsor…"
2. DetailPanel.addSponsor(projectId) prompts for name
3. App.addCustomerSponsor(customerName, name) appends to customer.sponsors, persists
4. App.updateProject(projectId, 'sponsor', name)
5. DetailPanel re-renders sponsor field — new option present + selected
```

### Allocation auto-refresh of sprint window

```
1. User clicks Auto-Allocate in Sprint Planning
2. Solver writes skill_splits per assignment
3. Solver also writes current_sprint = earliest_sprint, target_sprint = latest_sprint (existing)
4. notifyDataChange() fires
5. DetailPanel re-render (if open) recomputes sprint-window display from skill_splits
```

## Error handling

| Case | Behaviour |
|---|---|
| Sponsor select changes to "" (blank) | Allowed — sponsor cleared |
| "Add new sponsor" with empty name | Toast "Sponsor name required"; revert select |
| Add benefit with `amount` non-integer | Existing `App.toInteger` coerces, 0 acceptable |
| External dependency added without label | Existing toast already fires; no change |
| Assumptions/benefits/success_criteria removal | Confirmation dialog (matches Decisions register) |
| Migration encounters a customer with no projects | sponsors array starts empty; add via UI |
| User opens detail panel for a project whose customer was deleted | Sponsor select shows current value as the only option (legacy support) |

## Testing

### Unit (vitest)

- Migration: project with `assumptions: 'foo'` → `assumptions_register: [{text:'foo', ...}]`, no `assumptions` string remaining.
- Migration: project with `comms_log` defined → `comms_log` undefined after migration.
- Migration: customer.sponsors is populated from existing project sponsor strings.
- `App.computeSprintWindow(p)` returns null/null for empty skill_splits; returns earliest/latest correctly when set; returns sprint date by sprint_id from `App.data.sprints`.
- `App.addCustomerSponsor` appends, dedups, writes via `markDirty`.
- `App.setCustomerSponsors` replaces the list.
- Sponsor field render: select includes all customer sponsors + the "Add new" option.

### Render snapshot

- DetailPanel "Health" tab snapshot post-migration (no Communications, structured Assumptions register).
- DetailPanel "Setup" tab snapshot (Sponsor select, Benefits multi-row, Success criteria multi-row).
- DetailPanel "Delivery" tab snapshot (Dates moved here; Sprint window read-only).
- Customers config card snapshot (Sponsors column).

### E2E (Playwright)

- Open detail panel — assert no "Communications" panel section visible.
- Add a benefit, set type=time_saving + amount=100 + units=hours/year — assert it persists in `App.data.projects[0].benefits`.
- Add a success criterion + tag=Quality — assert persistence.
- Sponsor: pick "+ Add new sponsor…" → enter "Test Sponsor" → assert customer.sponsors contains it AND project.sponsor === 'Test Sponsor'.
- Sprint window: stub `skill_splits` with sprints CY26-S2..CY26-S5 — assert read-only fields show "CY26-S2 · …" and "CY26-S5 · …".
- Dates editor: assert only `hard_deadline` and `target_date` `<input type="date">` editors are present in the Delivery tab (no `start_date`, `actual_date`, etc.).
- Dropdown styling: assert all `<select>` inside `#detailPanel` carry `class="field-input"`.

## Out of scope

- KPI library / cross-project KPI rollups.
- Sponsor history / approval workflow.
- Dashboard "benefits realised" rollup. (Could be a future spec.)
- Renaming `current_sprint` / `target_sprint` data fields. They keep their names; the UI just stops exposing editors.
- Cross-customer sponsor moves. (Renaming a customer cascades sponsors via the existing rename pipeline.)

## Implementation order (for the plan)

1. Schema migration in `migrateSchema` (drop comms, migrate assumptions/benefits, init success_criteria, populate customer.sponsors).
2. New project-level helpers: `App.computeSprintWindow`, `App.addCustomerSponsor`, `App.setCustomerSponsors`.
3. `_renderCustomersCard` — add Sponsors column + inline editor.
4. DetailPanel: sponsor select + Add-new flow.
5. DetailPanel: assumptions register replacing the textarea.
6. DetailPanel: benefits multi-row replacing the textarea.
7. DetailPanel: success criteria multi-row (new section).
8. DetailPanel: dates moved into Delivery tab; pruned to hard_deadline + target_date editors; rest as read-only badges.
9. DetailPanel: sprint window read-only display in Delivery.
10. Remove Communications section from DetailPanel.
11. Sweep all `<select>` in DetailPanel to use `class="field-input"`.
12. Tests across all of the above.
