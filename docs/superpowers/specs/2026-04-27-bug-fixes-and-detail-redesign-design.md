# Bug Fixes + Detail Panel Redesign — Design

**Authors**: Senior Manager (Portfolio Owner) + Senior UX Designer
**Date**: 27 April 2026
**Branch**: `walkthrough-bug-fixes-and-detail-redesign` (off `main`)
**Endorsement bar**: Each issue resolved to a high standard, no regressions, both roles satisfied that nothing rough remains.

---

## 1. The brief — eight issues

| # | Issue | Type |
|---|---|---|
| 1 | Opening a project (no edits) → "unsaved changes in 'ownership'" warning | Bug |
| 2 | Verdict card on Projects view renders incorrectly | Bug / styling |
| 3 | Quick-edit visible columns in the Projects table without opening detail | Feature |
| 4 | Sprint names overrun project-name column when scrolling far-right | Layout bug |
| 5 | Remove Critical Path / Executive / Confidence toggles + priority recommendation chips from Gantt | Cleanup |
| 6 | Project label column in Gantt should be 2× current default width | Layout |
| 7 | "Implementation" word floats over Gantt bars — remove + explain | Bug + clarification |
| 8 | Sprint Planning > Team — remove team capacity table; Gantt-only; fix sprint title overrun | Layout + cleanup |
| 9 | Detail panel feels overwhelming — reorganise by data lifecycle | Major UX redesign |

---

## 2. Root-cause notes (per issue)

### Issue 1 — phantom unsaved-changes on `ownership`

The Quick-Add wizard's `_confirmWizard` writes `ownership: 'We Own'` into every new project (`index.html:13730`). When the detail panel opens an existing project that lacks `ownership` (legacy data), the field is rendered with the default. The unsaved-changes detector compares current vs original snapshot and sees `'We Own'` ≠ `undefined`, so the prompt fires. **Fix**: migrate missing `ownership` to `'We Own'` at load time, OR exclude `ownership` from dirty detection when neither side has been touched. We'll do both — schema migration is the right answer.

### Issue 2 — Verdict tile graphics

`Dashboard.renderKpiCards` prepends a verdict tile via `cards.unshift` with `border-top: 3px solid <colour>`, but the tile's `.kpi-card-value` is a plain text colour without the icon, sizing, and sub-line treatment that the other cards use. Inline-styled `border-top` in particular doesn't survive dark-mode contrast tokens. **Fix**: rewrite the tile to use the same DOM structure as `.kpi-card` siblings, swap the inline border for a class, render a small SVG marker instead of the bare top-border, and preserve hover.

### Issue 3 — Quick-edit Projects table

The Projects table renders one row per project via `Dashboard.buildRowHtml`. To enable quick edit per visible cell:
- **Status, Manager, Priority, Sprint, Size, RAG dots** are already structured and easy to swap to inputs.
- We add a `data-quick-edit="<field>"` attribute on each cell, plus a click handler that swaps the cell's inner HTML for an inline editor (input/select/RAG-cycle). Save on blur or Enter; revert on Escape. Calls existing `App.updateProject(id, field, value)`.
- All edits hit the audit log via existing field-save dispatcher.

### Issue 4 — Sprint name overrun in Sprint grid

The sprint chip badges (`alloc-sprint-badge`) and column headers don't have `overflow: hidden; text-overflow: ellipsis`. **Fix**: add to the sprint column header CSS + cap with `min-width` to keep the column from sliding under the project-name column.

### Issue 5 — Strip Gantt toggles + priority chip from Gantt

Remove the three checkbox toggles from the Gantt toolbar HTML (`#ganttCriticalPath`, `#ganttExecutive`, `#ganttConfidence`) and the underlying state defaults in the Gantt module. Remove the recommendation chip ("→#3") from the Gantt label hover/tooltip if present. Keep the helpers (`computeRecommendedPriority`, etc.) since they're still used elsewhere — just stop surfacing the overlay/chip in the Gantt.

### Issue 6 — Gantt label column 2× wider

The CSS variable `--gantt-labels-width` defaults to `220px` (line 1217). Change to `440px`.

### Issue 7 — "Implementation" floating over Gantt bars

The Gantt bar render at `index.html:15334` appends `App.lifecycleStageChip(p)` to every bar's label. The chip text is the `lifecycle_stage` value (most projects default to `'Implementation'`). When rendered inside a 60+px bar the chip floats with the bar's name, which is what the user sees as "Implementation on top of all bars."

**What it's for**: the lifecycle chip distinguishes `Idea` / `Discovery` / `POC` / `Phase-1 Build` / `Implementation` / `Run/BAU`. It's helpful in the Projects table and the Detail Panel. On the Gantt, where space is precious and most projects are the default Implementation, the chip is noise.

**Fix**: remove the chip from the Gantt bar label. Keep it on the Projects table and Detail Panel. Add a one-time legend explanation: "Lifecycle stage indicates the project's commitment maturity — visible in the Projects table and Detail Panel."

### Issue 8 — Sprint Planning > Team view

Remove the `tv-cap-strip` table; keep only the per-member assignment Gantt-style timeline (`renderTeamSchedule`). Apply the same sprint-name overrun fix as Issue 4.

### Issue 9 — Detail Panel reorganisation (major UX work)

The panel today renders one giant scrolling form with everything: name, sponsor, dates, ragas, sizes per skill, dependencies, risks, issues, comms log, baseline, EVM, audit. The senior manager + UX designer's analysis: **three data lifecycles**.

| Lifecycle | Examples | When updated |
|---|---|---|
| **Setup** (once-off) | Name, customer, sponsor, manager, lifecycle_stage, governance_forum, dependencies, baseline, MoSCoW, business value / time crit / risk reduction | Project intake + occasional changes |
| **Health** (constant review) | RAG dots, status, current_sprint, target_sprint, last_updated, EVM tile, BF1 coverage chip, top risks | Weekly walkthrough |
| **Delivery** (constant updating) | Skill sizes (per skill), skill_splits / chip progress, completed SP, story-point velocity, issues_register, comms_log | Daily / per-sprint by team |

**Design**: three tabs at the top of the detail panel — `Setup · Health · Delivery`. Default tab = `Health` (the most common reason to open a project). Each tab renders only its slice of the panel. The audit-log strip is shown beneath all tabs as a "Recent activity" rail (collapsed by default).

The existing helpers (`renderEvm`, `renderRisks`, `renderIssues`, etc.) are reused; just routed by tab. Schema unchanged.

---

## 3. Architecture — what changes

### Helpers (new + extended)

```
App.migrateSchema            extended  — seed missing project.ownership = 'We Own'
Dashboard.renderKpiCards     refactored — verdict tile uses .kpi-card structure
Dashboard.buildRowHtml       extended  — adds data-quick-edit attributes
Dashboard.openQuickEdit      NEW       — swap cell to inline editor + save handler
Gantt.* (toolbar / state)    edited    — remove ganttCriticalPath/Executive/Confidence, recommendation chip
Gantt CSS                    edited    — --gantt-labels-width: 440px
Gantt bar label              edited    — drop App.lifecycleStageChip(p)
Sprint.renderTeamView        edited    — drop tv-cap-strip; only the schedule Gantt remains
DetailPanel.renderBody       refactored — three tabs (Setup / Health / Delivery)
DetailPanel.activeTab        NEW       — 'health' default
DetailPanel.switchTab        NEW
```

### Tab division (concrete fields by tab)

**Setup** (the once-off):
- Identity (name, customer, sponsor, manager, lifecycle_stage)
- Classification (category, MoSCoW, business_value, time_criticality, risk_reduction_opportunity)
- Plan (start_date, target_date, hard_deadline, baseline)
- Structure (delivery_config phases, dependencies, governance_forum)

**Health** (weekly review surface):
- RAG dots editor (S/R/Sc) + Status select
- EVM strip (existing) — BAC/EV/PV/AC/SPI/CPI
- Coverage strip — BF1 badges (existing)
- Risk register summary (top 3 by score, with "show all" → opens Delivery tab)
- "What changed in last 7 days" — pulled from audit log

**Delivery** (daily ops):
- Skill sizes per phase (with point + max inputs — existing)
- Sprint allocation table per skill (skill_splits)
- Risks register full list (add/edit/delete)
- Issues register full list
- Comms log

### Tests

| Test file | New cases |
|---|---|
| `tests/unit/migration.test.mjs` | extend — `ownership` defaulted on legacy projects |
| `tests/render/dashboard.test.mjs` (or new render test) | verdict tile uses `.kpi-card` structure (no inline border-top) |
| `tests/render/projects-quick-edit.test.mjs` (NEW) | rows expose `data-quick-edit` per editable column |
| `tests/render/gantt.test.mjs` | toolbar no longer renders the three toggles or recommendation chip; bar label has no lifecycle chip |
| `tests/render/sprint-team-view.test.mjs` (NEW) | team view doesn't render `tv-cap-strip` |
| `tests/render/detail-tabs.test.mjs` (NEW) | three tabs render; switching tabs shows only that tab's content |

E2E: `tests/e2e/bug-fixes.spec.ts` — open project (no edits) → close → no unsaved-changes dialog; click status cell in Projects table → inline select appears.

---

## 4. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Tabbed detail panel breaks deep links / scroll-to-section URLs | Default to Health; if a `?tab=` hash present, honour it |
| Quick-edit on Projects table corrupts data (e.g. type errors) | Reuse the same field validation as `App.updateProject` (already validated). Save-on-blur with revert-on-Escape |
| Removing Gantt toggles deletes still-referenced helpers | Keep `computeCriticalPath` / `computeExecutiveOverlay` / etc. — only remove the toolbar entries + render hooks |
| Detail-panel split misses a field | Spec lists every field; review pass verifies each has a tab |
| Migration writes `ownership` when no projects have it | Idempotent — only writes when missing |

---

## 5. Implementation order

1. **Schema fix** — `migrateSchema` defaults `ownership`. Eliminates the false dirty flag.
2. **Verdict tile rewrite** — class-based; visually consistent.
3. **Quick-edit** in Projects table — schema unchanged, just UX.
4. **Sprint-name overrun** in Sprint Planning grid + Sprint Team view.
5. **Gantt cleanup** — remove toggles + chip + priority recommendation overlay; widen labels column.
6. **Sprint Team view** — strip capacity table.
7. **Detail Panel tabs** — Setup / Health / Delivery split.
8. Full test pass.
9. Senior-manager + UX designer endorsement loop.
10. Merge to main.

Each issue is independently committable.

---

## 6. MD-endorsement criteria (Definition of Done)

1. ✅ Open any project, close without editing → no unsaved-changes prompt.
2. ✅ Verdict tile on Projects view visually matches sibling KPI cards.
3. ✅ Every visible Projects-table column can be edited inline; saves persist.
4. ✅ Sprint Planning grid never lets sprint names overflow the project-name column.
5. ✅ Gantt has no Critical Path / Executive / Confidence toggles, no priority chips, no lifecycle chip on bars.
6. ✅ Gantt labels column is 440px by default.
7. ✅ Sprint Planning Team view shows only the per-member Gantt; capacity table gone.
8. ✅ Detail panel renders Setup / Health / Delivery tabs with reasonable field placement.
9. ✅ Senior manager AND UX designer both say "yes, ship it."
10. ✅ All tests green; merged to main.

---

**Status**: Approved by senior manager + UX designer (per Auto mode + user instruction). Proceeding to implementation plan.
