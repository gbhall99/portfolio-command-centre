# Workstream B — Sprint Planning window (configurable) — design

**Date:** 2026-06-03
**Branch:** `wsB-sprint-window`
**Context:** Second of five phased workstreams (A→E). Addresses issue #2: "Sprint planning should only show last sprint, current sprint (largest) and then future sprints — configurable as to what to show." Workstream A already added a fixed 1-past+current+future window to the **Capacity** "Team Workload by Sprint" cards and deliberately left the **Sprint Planning** swim-lanes showing all sprints. B applies a windowed view to Sprint Planning and makes the window configurable, driving both views from one setting.

**Scope:** Single-file `index.html`. No framework/build. `:root` tokens, inline SVG, `Dashboard.esc()`. No `data-view`/id churn. Gated by `npm test` + in-browser verification.

## Decisions (from brainstorming)

- **Config model:** past/future numeric steppers (`<select>`s), not presets.
- **Control location:** the Sprint Planning toolbar; choice persisted globally.
- **Unified scope:** one setting drives both Sprint Planning **and** the Capacity cards.
- **Past = All is allowed** (full history); wide windows must scroll horizontally, not crush columns.

## B1 — Persisted setting

A global UI-state value:

```
sprint.window = { past: <int | 'all'>, future: <int | 'all'> }
```

- **Default:** `{ past: 1, future: 'all' }`.
- Read: `App.uiStateGet('sprint.window', { past: 1, future: 'all' })`.
- Write: `App.uiStateSet('sprint.window', value)` (persists to localStorage, global — not per-customer).
- Normalisation: values are either a non-negative integer or the string `'all'`. A small reader helper coerces stored values defensively (e.g. unknown → default) so a malformed stored value can't break rendering.

## B2 — Generalised windowing helper

Extend `Sprint._windowedSprints(all, opts)` (index.html:28059). Today it is hard-coded to "last 1 past + current + all future". New signature accepts `opts = { past, future }`; when `opts` is omitted it reads the persisted `sprint.window` setting (so callers that pass nothing get the configured window).

Algorithm (unchanged classification, parameterised slicing):
1. Sort sprints ascending by `start_date`.
2. Classify each: `past` (`end_date < today`), `current` (`start_date <= today <= end_date`), else `future`.
3. Keep:
   - past: the **last `past`** past sprints (`'all'` → all; `0` → none),
   - all current sprint(s),
   - future: the **first `future`** future sprints (`'all'` → all; `0` → none).
4. `focusId` = the current sprint's id, else the nearest upcoming sprint's id (between cycles), else `null`.
5. Return `{ sprints, focusId }`.

Current is **always** shown regardless of the steppers (it is the focus, not a past/future count).

## B3 — Sprint Planning swim-lanes use the window

`Sprint.renderSwimLane` and `Sprint.renderTeamSwimlane` (both render into `#sprintBoard`, currently iterating `App.data.sprints` directly) instead derive their sprint list from `Sprint._windowedSprints(App.data.sprints)` (which reads the setting). Both the header (`thead`) and body loops use the windowed list (they already share one `sprints` variable per function).

**Current = largest:** the current column's `<th>`/`<td>` already receive the `.sl-sprint-current` class (via the per-column `sprintPhase()` classification) which gives the accent tint + 3px left border (index.html:1873-1875). Add a width emphasis so it reads as the largest column:

```css
.sprint-swimlane th.sl-sprint-hdr.sl-sprint-current { min-width: 200px; max-width: 240px; }
```

(The normal `.sl-sprint-hdr` is `min-width:130px; max-width:180px`.) No new focus class is introduced. Between cycles (no current sprint) no column is widened — acceptable; the nearest-future sprint is still the first future column shown.

**Horizontal scroll (the "must be scrollable" constraint):** `.sprint-board` already sets `overflow-x: auto` with a sticky `.sl-project-cell` first column and per-column min-widths, so a wide window (e.g. `past:'all'`) scrolls horizontally with the project column frozen — no column crushing. This is existing behaviour; B must preserve it (verified, not rebuilt). The widened current column must not break the sticky-column scroll.

## B4 — Toolbar control

Add a compact inline control to the Sprint Planning toolbar (`#viewSprint .sprint-toolbar`), near the other controls (e.g. before the "Sprints" button):

```
Sprints:  Past [1 ▾]  ·  Current  ·  Future [All ▾]
```

- Two `<select>`s styled like the existing `.toolbar-chk`/filter controls (token-based, compact).
  - **Past** options: `0, 1, 2, 3, 4, All` (default `1`).
  - **Future** options: `0, 1, 2, 3, 4, 5, 6, All` (default `All`).
- `onchange` on either select calls a handler (e.g. `Sprint.setWindow('past'|'future', value)`) that writes `sprint.window` via `uiStateSet` and re-renders the board (`Sprint.render()`).
- On load / view render, the selects reflect the persisted setting.
- The static `Current` label between them communicates that the current sprint is always shown.

## B5 — Unified with Capacity

`Capacity.renderSprintCapacity` (index.html:31682) currently calls `Sprint._windowedSprints(App.data.sprints)` with no opts — after B2 that already reads the persisted setting, so Capacity automatically follows the same window. Confirm it picks up changes (re-render Capacity when the setting changes if the Capacity view is active — the existing `setActiveCustomer`/view-render paths re-render Capacity on navigation; a setting change made on the Sprint toolbar will be reflected next time Capacity renders, which is acceptable since the control lives on Sprint Planning). The Capacity card focus (`sprint-cap-card-focus`) continues to key off `focusId`.

## Testing

- `Sprint._windowedSprints(all, opts)` unit tests (clock-relative dates; remember `validateAndLoad` forces `end_date = start_date + 34d`):
  - default `{past:1, future:'all'}` → 1 past + current + all future;
  - `{past:0, future:2}` → no past, current, 2 future;
  - `{past:'all', future:'all'}` → every sprint;
  - between-cycles (no current) → `focusId` = nearest future; past/future counts still respected.
- Setting round-trip: `uiStateSet('sprint.window', …)` then `uiStateGet` returns it; malformed value coerces to default.
- Sprint Planning: `renderSwimLane` and `renderTeamSwimlane` honour the setting (column count matches the window); current column carries `.sl-sprint-current` and the width emphasis.
- Capacity: `renderSprintCapacity` honours the same setting.
- Toolbar: the two selects render with the persisted values; changing one updates `sprint.window` and re-renders.
- Visual verify in-browser (1440px): default window on Sprint Planning (1 past + wide current + futures); set Past=All → board scrolls horizontally with the project column frozen; Capacity reflects the same window.

## Out of scope

- No change to the solver's `lookAheadSprints` KPI setting (separate concept — capacity-vs-demand horizon, not the visible column window).
- RAID intelligence (D), Reports/PDF + packs (E), holidays (C) — their own workstreams.
