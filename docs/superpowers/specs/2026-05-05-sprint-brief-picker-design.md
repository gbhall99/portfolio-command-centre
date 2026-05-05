# Sprint Brief Picker — Design

**Date:** 2026-05-05
**Status:** Approved
**Owner:** Gareth
**Scope:** Sprint Planning view → "Sprint Brief" toolbar button (`index.html:2612`)

---

## Goal

Let the user choose which sprint to generate the per-member Sprint Brief for. The current button is a one-liner IIFE that falls back to `App.data.sprints[0]` (chronologically oldest) whenever `Sprint.activeSprintId` doesn't resolve to a sprint owned by the active customer — so the brief frequently opens for a stale historical sprint.

## Non-goals

- Reworking the Sprint Brief content itself (`Report.buildSprintBriefDoc`).
- Cross-customer or multi-sprint briefs.
- Customising what fields appear in each brief.

## Constraints

- Single-file `index.html`. No new dependencies.
- All UI rendering uses `innerHTML` string concatenation; user content escaped via `Dashboard.esc`.
- Existing `Report.exportSprintBrief(customer, sprintId)` is the canonical entry point — the picker just selects `sprintId` and calls through.
- No emojis (inline SVG icons only).

---

## Architecture

```
toolbar button click
   ↓
Report.openSprintBriefPicker()
   ↓ builds + opens modal listing active customer's sprints
   ↓ user selects + clicks Generate
   ↓
Report.exportSprintBrief(App.activeCustomer, chosenSprintId)   ← unchanged
```

## Components

### 1. Toolbar button (line 2612)

Replace the inline IIFE with:

```html
<button class="btn btn-outline btn-sm"
        onclick="Report.openSprintBriefPicker()"
        title="Per-member sprint brief — printable PDF">
  <svg …>…</svg> Sprint Brief
</button>
```

### 2. `Report.openSprintBriefPicker()` — modal

Pure JS, no template. Builds and appends a fixed-position overlay matching the project's modal idiom (`#auditExportOverlay`, `#scenarioManagerOverlay`, etc.).

**Sprint list source**: `App.data.sprints` filtered to `s.customer === App.activeCustomer`, sorted by `start_date` ascending. If a sprint omits `customer`, treat as belonging to the active customer (legacy data).

**Default selection** (decided in brainstorming, option A): the sprint where `start_date <= today <= end_date`. Fallback order:
1. Sprint matching today (current sprint).
2. Earliest future sprint (`start_date > today`).
3. Most recent past sprint.
4. First in the filtered list.

**Per-row content**:

```
[radio]  CY26-S4    18 Mar – 22 Apr   12 assignments
[radio]  CY26-S5    23 Apr – 27 May    8 assignments    ← preselected (today is 5 May)
[radio]  CY26-S6    28 May – 01 Jul    0 assignments
```

Assignment count = number of `skill_splits` entries across the customer's projects whose `sprint === sprint_id` (same arithmetic the existing `buildSprintBriefDoc` already does, just totalled).

**Buttons**: `Cancel` (closes modal), `Generate Brief` (calls `Report.exportSprintBrief(App.activeCustomer, chosenId)` then closes modal).

**Closes on**: Esc, click outside, Cancel, Generate.

### 3. Empty state

If the active customer has no sprints, the modal shows:
> "No sprints configured for {customer}. Add one in **Sprints** to generate a brief."

with a single **Close** button. Clicking the link does not navigate (avoids modal-stacking edge cases); the user already has the Sprints button in the same toolbar.

## Data flow

```
1. User clicks Sprint Brief
2. openSprintBriefPicker reads App.activeCustomer + App.data.sprints
3. Filters and sorts; computes defaults; computes assignment counts
4. Builds modal HTML, appends to body
5. User picks a row, clicks Generate
6. Calls Report.exportSprintBrief(App.activeCustomer, chosenId)
   - which builds the doc + opens it via Report.open / window.print
7. Modal closes
```

## Error handling

- No customer selected → toast "Select a customer first" (defensive; `App.activeCustomer` is normally always set).
- No sprints → empty-state modal (above).
- Customer renamed mid-session → sprint list reflects current `App.activeCustomer`; nothing persists between modal opens.
- `Report.exportSprintBrief` failing internally → its existing toast handles it; the picker is closed before the call so error visibility is preserved.

## Testing

### Unit (vitest)
- `Report.openSprintBriefPicker` exists and is a function.
- Default-selection logic: given a fixture with 3 sprints (past/current/future), returns the current sprint's id.
- Default-selection fallbacks: current missing → upcoming; both missing → most recent past.

### Render snapshot
- Snapshot the picker HTML with a 3-sprint fixture for a fixed "today" date.

### E2E (Playwright)
- Click toolbar `Sprint Brief` → expect modal visible.
- The radio for the current sprint is `:checked` by default.
- Click a different sprint, click `Generate Brief` → window.open intercepted in the harness; assert it was called with a doc string containing the chosen sprint id.
- Esc closes; click outside closes; Cancel closes.

## Out of scope

- Saving "preferred sprint" between sessions.
- Generating multiple briefs at once.
- Adding a "preview" step before opening the print window.
