# Gantt clarity + Forums → Governance Meetings rename

**Status:** Design approved 2026-05-07
**Owner:** gbhall
**Scope:** Roadmap/Gantt visual rework + UI rename; no data-model changes.

## Problem

Two unrelated UX issues, bundled because they touch the same view family:

1. **Gantt readability.** Milestone glyphs use four different colour pairs (violet calendar, amber rocket, cyan doc, violet diamond) which compete with the customer/RAG/skill colour layers and make it hard to tell *what* is being marked at a glance. The baseline-vs-actual signal is even weaker — a 3 px dashed strip below the bar plus a small SVG slip-arrow — and slipped projects are not visually obvious. There is also no narrative explaining *what changed* since the baseline was set.
2. **Naming.** Internal users now refer to these recurring touchpoints as "meetings", not "forums". The label in nav, headings, modals, and detail panel all still say "Forum(s)".

## Goals

- Every milestone glyph reads as **black-on-white**; meaning is carried by shape, not colour.
- Confirm each milestone is still wired to live data and document its trigger condition (no removals planned — see relevance verdict below).
- Replace the dashed-strip baseline with a **bracket-above-bar** pattern + an inline **delta pill** so plan-vs-actual is instantly readable from across the room.
- Hover on a Gantt bar/label/baseline-bracket shows a **Plan vs actual** block with concrete numbers and a top-3 "what moved" narrative pulled from the audit log.
- Rename **Forums → Governance Meetings** in every user-facing string, with **zero data-model churn** so existing JSON files load unchanged.

## Non-goals

- No solver/allocation changes.
- No baseline data-model changes — `App.data.baselines[]` snapshot shape stays as-is.
- No rename of `governance_forum` / `governance_forums` JSON keys, JS function names (`openForum`, `saveForum`, etc.), CSS class fragments (`forum-modal`), or DOM IDs (`forumModalOverlay`, `navBadgeForums`, `govForumsContent`). UI-string-only rename.
- No new milestone types, no removal of existing milestone types.

## Design

### 1. Milestone icons → black

All four milestone glyphs are repainted as outlined black-on-white SVGs. Shape continues to differentiate them:

| Glyph | Shape | Trigger | Colours (light theme) |
|---|---|---|---|
| Deadline | Calendar with `!` | `project.hard_deadline` | fill `#ffffff`, stroke `#0f172a`, accent `#0f172a` |
| Launch | Rocket | `category === 'Product Release' && product_release_date` | fill `#ffffff`, stroke `#0f172a`, accent `#0f172a` |
| UAT release | Document with check | `data_sourcing.type !== 'Internal' && data_sourcing.uat_release_date` | fill `#ffffff`, stroke `#0f172a`, accent `#0f172a` |
| External-dep gate | Diamond with `!` | `dependency.kind === 'external' && type === 'blocked_by' && expected_date` | fill `#ffffff`, stroke `#0f172a`, accent `#0f172a` |

Dark theme:
- Stroke + accents: `#e2e8f0`
- Fill: `var(--surface-2)` (the chart background's darker companion) so glyphs contrast against both light and dark bars.

Implementation:
- Two new CSS custom properties: `--gantt-ms-stroke` and `--gantt-ms-fill`, defined in both `:root` and `html[data-theme="dark"]`.
- Inline-SVG bodies in `Gantt.render()` (deadline / launch / uat / external) and the four mirrored SVGs in `Gantt.renderLegend()` switch to those tokens.
- The existing `--gantt-fy-marker` and `--gantt-milestone-stroke` variables are no longer used by milestones — keep them; they still drive FY column rendering.

Reference lines unchanged:
- Today line stays accent-blue (it's a live cursor, not a milestone).
- Sprint dashed lines stay muted blue.
- FY lines stay muted purple.
- Slip arrow (`baseline-arrow` SVG, lines 16812–16816) is **removed** — replaced by the bracket + delta pill in §2.

Relevance verdict: all four milestone types are still wired and conditional. Launch and UAT happen to fire only when project category / data-sourcing make them relevant, so most demo rows won't show them — that is correct and intended, not dead code.

### 2. Baseline-vs-actual: bracket + delta pill

**Replaces** the existing `gantt-bar-baseline` strip and the `baseline-arrow` SVG.

#### Geometry

Row layout (current → new):

```
Current:                              New:
                                      ┌──────┐ baseline tick (start)
                                      │
   ████████ live bar (top:6, h:24)    │      ······· caliper spine ·······      ┐
   ··········· dashed strip (top:33)                                            │ baseline tick (end)
                                                                                │
                                       ████████████████ live bar (top:8, h:24)  │ +12d
                                                                                ┘
```

- Live bar: shifts from `top:6` to `top:8` to make room for a 5–6 px bracket above.
- Bracket: 1.5 px stroke in `var(--gantt-baseline)`; 5 px vertical ticks at baseline start and end x-coords; 1 px horizontal spine connecting them.
- Row height grows by ~3 px to absorb the change. `gantt-row` minimum height bumped accordingly.
- When `baseline.start === current.start AND baseline.end === current.end`: bracket renders directly above the bar at identical span. Pill says "on plan".

#### Delta pill

Rendered to the right of the live bar end (or at the row's right edge if the bar runs long), absolutely positioned within the row:

| Condition | Text | Colours |
|---|---|---|
| `current.target > baseline.target` | `+Nd` | text `var(--status-red)`, bg `var(--tint-red-weak)` |
| `current.target < baseline.target` | `−Nd` | text `var(--status-green)`, bg `var(--tint-green-weak)` |
| Equal | `on plan` | text `var(--text-muted)`, bg none |
| No active baseline OR project not in snapshot | (hidden) | — |

Pill width clamped to row width; if the bar already extends past the chart's right edge, the pill is anchored to the row's right edge instead of the bar's right edge.

#### Edge cases

- Baseline has only `start_date`: render the start tick alone, no spine, no end tick, pill hidden.
- Baseline span overflows the visible chart: fade the off-edge tick (opacity 0.3) and clip the spine at the chart bound.
- Project in `executiveMode`: bracket + pill render exactly the same — executive mode is one row per project so they fit naturally.
- Project added after baseline (no entry in `snapshot`): no bracket, no pill. The "added" status is already conveyed by the existing movers legend.

### 3. Plan vs actual hover card

#### When it fires

The existing `buildTooltip(type, el)` in `Gantt.attachHoverHandlers()` gains a new "Plan vs actual" section when **both** are true:

- An active baseline (`Gantt._activeBaseline()`) exists, AND
- That baseline's snapshot contains this project (`baseline.snapshot[p.id]`).

Triggers:
- `data-hover-type="bar"` (existing) — appended to the existing tooltip body.
- `data-hover-type="label"` (existing) — appended.
- `data-hover-type="baseline"` (new) — bracket itself is now hoverable; tooltip is the focused Plan-vs-actual content with a minimal project header.

#### Content

```
─────────────────
Plan vs actual                       set 12 Apr by gbhall
Baseline    14 Apr → 26 Jun          38 SP
Current     14 Apr →  8 Jul          43 SP
            start unchanged · +12d on target · +5 SP

What moved
  • Data Science phase added (5 SP)
  • Tableau target sprint pushed by 2 sprints
  • Last touched 4 May by gbhall
```

Source mapping:
- **Baseline row:** `snapshot[p.id].start_date`, `.target_date`, sum of size_* fields, `baseline.created_at`, `baseline.created_by` (best-effort; falls back to "—" if absent on legacy baselines).
- **Current row:** live `p.start_date`, `p.target_date`, `p.size_total`.
- **Diff line:** computed from those two — `+Nd`/`unchanged` per date, `±N SP` for scope.
- **What moved bullets:** read `App.data.audit_log` filtered by `project_id === p.id && timestamp >= baseline.created_at`. Top 3 distinct field changes by recency, formatted as human strings ("Tableau target sprint pushed by 2 sprints", "DS phase added", etc.). Fall back to a single "Last touched DD MMM by USER" line when no qualifying audit entries exist. If audit-log scraping proves expensive on large datasets (>5 ms in profiling), reduce to that single fallback line for v1.

#### Layout

The block is a `<div>` appended after the existing `buildPhaseBreakdown()` output and before `buildProjectSummary()`, separated by a 1 px dashed top border to mirror the existing breakdown style. Font sizes match the existing tooltip (10–11 px). The tooltip's `max-width` is bumped from 300 px to 360 px so the two date columns ("Baseline" / "Current") fit cleanly without wrapping.

### 4. Forums → Governance Meetings rename (UI-only)

Visible string changes — find-and-replace on the rendered text only. Code identifiers untouched.

| Location | Before | After |
|---|---|---|
| Top nav badge | `Forums` | `Meetings` |
| Page heading | `Governance Forums` | `Governance Meetings` |
| Governance tab | `Forums` | `Meetings` |
| Modal title (add) | `Add Forum` | `Add Meeting` |
| Modal title (edit) | `Edit Forum` | `Edit Meeting` |
| Save button | `Save Forum` | `Save Meeting` |
| Detail-panel field label | `Forum` | `Meeting` |
| Detail-panel select option `— unchanged —` | (unchanged) | (unchanged) |
| Spotlight group label | `Forums` | `Meetings` |
| Spotlight meta prefix | `Forum · …` | `Meeting · …` |
| Import report row label | `Governance Forums` | `Governance Meetings` |
| Toast: "X forum(s) in the next 7 days" | `forum`/`forums` | `meeting`/`meetings` |
| Aria-labels: `Open this forum` | `Open this forum` | `Open this meeting` |
| View name map (`activity card titles`) | `Governance Forums` | `Governance Meetings` |

Untouched (load-compatibility / refactor-scope):
- JSON keys: `governance_forums`, `governance_forum`.
- JS function names: `Governance.switchTab`, `Governance.openForum`, `Governance.saveForum`, `Governance.closeForumModal`, `Governance.completeForumAction`, `Governance.deferForumAction`, `MyActions.openForum`.
- CSS classes / class fragments: any `*-forum*` or `*Forum*`.
- DOM IDs: `forumModalOverlay`, `forumModalTitle`, `navBadgeForums`, `govForumsContent`, `govForumCount`.
- Local variable names: `existingForumMap`, `forums`, `f`.

## Test plan

### Unit + render (vitest)
- HTML snapshot for `Gantt.render()` with no baseline: bracket and delta pill absent.
- HTML snapshot with active baseline + slipped project: bracket + delta pill rendered, pill text matches expected `+Nd`.
- HTML snapshot with active baseline + on-plan project: pill text `on plan`.
- Milestone SVGs use new tokens (`--gantt-ms-stroke`, `--gantt-ms-fill`) — assert via stroke attribute on rendered SVG.
- Tooltip builder: `buildTooltip('bar', …)` for a project in baseline contains the "Plan vs actual" header.
- Existing snapshots that contain "Forums" / "Governance Forums" UI strings updated to "Meetings" / "Governance Meetings".

### E2E (Playwright)
- Navigation test: click nav item, assert label "Meetings" (was "Forums").
- Hover an active baseline bracket: tooltip becomes visible and contains "Plan vs actual".

### Manual
- Load demo dataset → set a named baseline → edit project target by +14 days → verify bracket + `+14d` pill render and bar hover surfaces the new section.
- Toggle dark mode: milestone glyphs remain legible on bars.
- Project with no baseline entry: bracket / pill / hover section absent.

## Build order

1. **Rename:** Forums → Governance Meetings (UI strings only, including snapshot regeneration). Smallest, isolated diff.
2. **Milestone icons:** add `--gantt-ms-*` tokens, repaint 4 inline SVGs in `Gantt.render()` and the 4 mirrors in `Gantt.renderLegend()`. Remove now-unused fill colours from those SVGs.
3. **Baseline bracket + delta pill:** new render path in `Gantt.render()`, retire `baseline-arrow` and the dashed-strip `gantt-bar-baseline`. Adjust row height + bar `top` accordingly.
4. **Hover card:** extend `buildTooltip` for `bar`/`label`, add `baseline` hover-type with element + handlers.
5. **Tests:** regenerate snapshots, add new asserts for bracket / pill / hover card and renamed UI strings.

## Risks

- **Audit-log scraping cost.** On large customers with long audit histories, filtering for "what moved" bullets every hover could be slow. Mitigation: cache per-project audit slice keyed by `(p.id, baseline.id)`, invalidated when the baseline changes. v1 fallback: single "Last touched" line with no bullets if profiling shows >5 ms hover delay.
- **Row-height shift may break Gantt PDF/PNG export pixel maths.** Mitigation: search `exportPDF`, `exportPNG`, `exportCustomerRoadmap` for hard-coded row heights and update if needed.
- **Snapshot test churn from rename + bracket.** Expected — explicitly call out in the PR that snapshot diffs are intentional.
