# Nav/IA restructure + UI fixes — design

**Date:** 2026-06-01
**Branch:** `nav-ia-ui-fixes`
**Scope:** Single-file `index.html`. No framework/build. Inline SVG only, `:root` tokens, no emojis. No behaviour/ID/`data-*` hook changes beyond the explicit renames below.

## Goal

Eight targeted changes from the user: a chronological Delivery nav restructure (with Governance and Actions folded in), an Actions owner filter, a tighter Capacity sprint window, and three visual bug fixes. Keep all working functionality intact; gate every step on the full test suite.

## 1. Navigation restructure (requests 1, 2, 4, 8)

The three top-level sections (Portfolio / Delivery / System) are unchanged. Only the **contents and order of the Delivery section** change. The Delivery section keeps its customer-scope chip on the label.

**Target structure:**

```
DELIVERY  (customer-scoped; label keeps the customer chip)
  Projects
  RAID
  Governance
  Actions
— Planning —
  Backlog
  Roadmap
  Sprint Planning
  Capacity
— Strategy —
  Strategy
  Personas
  Metrics
```

Changes vs. current:

- **Backlog** moves out of the top group into the **Planning** subsection (request 4).
- **Governance** moves up to sit as a plain Delivery item with Projects/RAID/Actions (request 1). It is no longer trailing after the Strategy group.
- **Actions** (renamed — see §2) sits with the top ungrouped items.
- The order reads chronologically as "Projects home → oversight items → Planning → Strategy" (request 2; user chose "Projects-home, then flow", then chose to ungroup the oversight items to the top).
- **Personas now precedes Metrics** (was Metrics, Personas).
- The **`.nav-strategy-group` wrapper is removed** — the vertical left-border line it draws goes away (request 8). Strategy/Personas/Metrics become plain items under a normal `— Strategy —` subsection label, matching the `— Planning —` style.
- There is **no "Oversight" subsection label** — RAID/Governance/Actions are ungrouped at the top of Delivery.

**Invariants:**

- All `data-view` keys unchanged: `dashboard`, `roadmap`, `backlog`, `raid`, `sprint`, `capacity`, `myactions`, `strategy`, `metrics`, `personas`, `governance`. So `App.navigate`, deep-links, and customer-mode redirects keep working — only DOM order, two subsection labels, and the Personas/Metrics swap change.
- Customer-mode visibility rules (`body.customer-mode .nav-item[data-view=...]`, `.nav-section-label` hiding) must continue to behave. The new `— Strategy —` / Planning labels use the existing `.nav-subsection-label` class so existing show/hide rules apply. Verify no item becomes orphaned or doubly-shown in customer mode.

## 2. Actions owner filter (request 3)

- **Rename** the nav item and page heading **"My Actions" → "Actions"**. Keep `data-view="myactions"` and `id="navMyActions"` for back-compat (mirrors the `config`/"System Settings" precedent).
- Update the customer-mode label swap (currently `"For your attention"` / `"My Actions"`) so the non-customer label is `"Actions"`.
- Add an **owner filter dropdown** to the Actions view header:
  - Default selection: **"All owners"**.
  - Options: "All owners" + each distinct owner found across the view's actionable items (team-member / action owners), sorted.
  - Filters the **Overdue actions** list and the **Open issues / high-risk (blockers)** list by `owner`. **Decisions to approve** have no owner and are always shown.
  - Selection is view-local state (re-render on change); no schema/persistence change required.
- **Nav badge** (`#navBadgeMyActions`) continues to count the unfiltered attention total for the customer, so the badge keeps its meaning regardless of the owner filter.

## 3. Capacity sprint window (request 7)

- The Capacity view currently renders a column for **every** sprint, each tagged past/current/future via `sprintPhase()`.
- Trim the rendered sprint set to: **the most recent past sprint + the current sprint + all future sprints.** Older past sprints are dropped from the columns.
  - If there is no current sprint (between cycles), fall back to the nearest upcoming sprint as the focus, still showing exactly one prior sprint.
  - If the look-ahead setting already bounds future sprints, that still applies on top.
- **Emphasise the current sprint column**: wider than the others and visually highlighted (new `.sl-sprint-current-focus` class — accent border/background, larger min-width). The single past sprint and future sprints render at normal width.
- Log nothing is silently truncated beyond the intended window (the trim is the intended behaviour, not a hidden cap).

## 4. Visual fixes (requests 5, 6)

- **Side shading (request 5):** Remove the dark edge-gradient "scroll-shadow" layers from `.persona-table-wrap` (index.html ~944-947) and `.metric-library-table-wrap` (the matching block ~1057-1065). Specifically drop the `linear-gradient(..., rgba(15,23,42,0.32), ...)` left/right layers. Keep the always-visible classic scrollbar as the overflow affordance and a plain `var(--surface)` background. The lighter white fade layers may stay or go; the dark tint that reads as "weird shading" must go.
- **Skill assignee circle overlap (request 6):** `.sl-chip-assignee` (index.html:2825) is a 16px dark circle holding 2 uppercase initials; the initials overlap. Fix by tuning size/font so two characters fit cleanly — e.g. slightly larger circle and/or smaller `font-size`, neutralised `letter-spacing`, correct `line-height`. Verify in-browser that 2-letter initials (e.g. "GH") no longer overlap, in both light and dark themes.

## Testing

- Gate on full `npm test` (vitest unit/render + Playwright e2e) after each increment.
- Expect to update nav-structure assertions:
  - `tests/unit/ia-scope-clarity.test.mjs` — section labels / item membership (the 3 top-level sections are unchanged, but item grouping/order within Delivery changes).
  - `tests/unit/slot-h-nav-raid.test.mjs` — RAID nav placement.
  - Any test asserting the literal string "My Actions" in nav/title → "Actions".
- Add/adjust coverage for: Actions owner filter (default All, filters actions/blockers, decisions unaffected), Capacity window (one past sprint max, current emphasised).
- Visual verification in-browser at 1280 and 1440 px across: nav sidebar, Actions, Capacity, Metrics, Personas.

## Out of scope

- No changes to the three top-level sections or the Portfolio/System sections.
- No schema/data-model changes.
- No auth / real "current user" concept (the Actions filter is owner-based, defaulting to All).
