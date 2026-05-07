# Baseline visualisation v2

**Status:** Design approved 2026-05-07
**Owner:** gbhall
**Scope:** Roadmap/Gantt — replace the bracket-above-bar baseline pattern with a stacked plan/actual rendering, add per-phase culprit attribution in Detailed mode, humanise hover text. No data-model changes.

## Problem

The bracket-above-bar pattern shipped in PR #15 doesn't read well. Users report "it's difficult to see the changes, both in the overview and in detailed". Specific issues:

1. **Visual subtlety.** A 6 px caliper above a 24 px bar is easy to miss against busy chart noise (sprint dashes, today line, milestones, dependency arrows).
2. **No detailed-mode story.** The bracket only renders on the project header row. Phase sub-rows have no baseline reference, so users can't see *which phases* drove a slip.
3. **Hover content leaks backend identifiers.** "What moved" shows `size_data_engineering`, `target_date`, `rag_schedule` — raw field keys, not user language.
4. **"Last items always look red" trap.** Marking phases as "culprits" purely because they extend past the project's plan_end falsely accuses end-of-pipeline phases that were merely pushed by earlier slips. Real culprits are phases whose own span grew vs their own baseline span.
5. **Tooltip surfaces bookkeeping.** "Set 8 Apr by gbhall" is in every Plan-vs-actual tooltip. Useful for audit, noise for everyday reading.

## Goals

- Stacked plan-lane (slate) + actual-bar (customer colour) on the project header — slip is the offset between the two.
- Per-phase plan lane + per-phase actual bar + per-phase culprit attribution in Detailed mode.
- Red shaft + arrowhead spans plan-end → actual-end on the project header AND every phase that moved, in a dedicated y-band that never overlaps another element.
- Phase culprit logic compares each phase against its **own** baseline span — only phases that grew get a red overlay + `+Nd`/`+Nw` tag.
- ±d/±w pills are vertically centred on the bar with an 8 px gap, week-formatted past 6 days, with all rich Plan-vs-actual hover content concentrated on them.
- Bar / label hover stays minimal (today's content, no Plan-vs-actual block).
- Plan lane hover is a one-liner: "Originally planned 5 Jan → 26 Jan".
- Hover text humanised — no field-name underscores anywhere.
- "Set by …" metadata removed from every hover.

## Non-goals

- No solver / allocation changes.
- No baseline data-model changes — `App.data.baselines[]` snapshot shape stays as-is. `created_at` and `created_by` are still stored, just not surfaced.
- No changes to the milestone glyphs, today line, sprint markers, FY markers, or critical-path styling.
- No new e2e flows beyond bracket-replacement coverage.

## Design

### 1. Layout zones

#### Project header row (60 px canvas)

| Zone | y-range | Contents |
|---|---|---|
| Plan lane | 4–12 | 8 px slate bar with 14 px ticks at start/end |
| Arrow band | 14–20 | 6 px clear band for the red movement arrow |
| Live bar | 22–48 | 26 px customer-coloured bar (existing `.gantt-bar`, `top` shifted from 8 → 22) |
| Pill | centred at y 35 | `transform:translateY(-50%)` from `top:50%` of the canvas |

The 2 px gaps between zones (12→14, 20→22) ensure the arrowhead never touches the plan lane or the bar even at maximum bleed.

#### Phase sub-row (38 px, was 36)

| Zone | y-range | Contents |
|---|---|---|
| Phase plan lane | 3–8 | 5 px slate bar with 9 px ticks |
| Arrow band | 11–17 | 6 px clear band |
| Phase bar | 19–37 | 18 px skill-coloured bar |
| Status dot + name | centred y 28 | left:6 + left:22 |
| Phase tag (±Nd / ±Nw) | centred y 28 | absolute right of bar + 8 px |

Net row-height delta: +2 px per phase sub-row, +4 px per project header. For a 4-phase project: +12 px total. Acceptable for the readability win.

### 2. Pill format

Helper `Gantt._formatSlip(days)` returns the human-readable string:

| Input (days) | Output |
|---|---|
| 0 | (no pill — caller hides it) |
| 1 ≤ |d| ≤ 6 | `+Nd` / `−Nd` |
| 7, 14, 21 (multiples of 7) | `+Nw` / `−Nw` |
| Other ≥ 7 | `+Xw Yd` (e.g. `+1w 3d` for 10 days) |

Sign uses `+` for positive (slip) and Unicode minus `−` for negative (early), matching the existing bracket implementation.

Pill styling:
- Slip: `color:var(--status-red)`, `background:var(--tint-red-weak)`, border `1px solid #fca5a5`
- Early: `color:var(--status-green)`, `background:var(--tint-green-weak)`, border `1px solid #6ee7b7`
- On-plan: hidden (no pill rendered)

Pill positioning uses `top:50%; transform:translateY(-50%); left:calc(barRightPx + 8px)`, clamped to `Math.min(totalWidth - 50, …)` so it never spills past the chart's right edge.

### 3. Movement arrow primitive

Simple HTML/CSS shaft + head — pure DOM, renders reliably at any width:

```html
<div class="gantt-move-arrow" style="left:Xpx;width:Wpx;top:Ypx">
  <span class="shaft"></span>
  <span class="head"></span>
</div>
```

Shaft: 2 px red horizontal bar with `left:0; right:7px` (leaves room for the head).
Head: 7 px red triangle drawn with CSS borders (`border-left:7px solid #dc2626; border-top:3px solid transparent; border-bottom:3px solid transparent`).

Container is 6 px tall total (head spans 6 px from border-top + border-bottom). The shaft is centred in the band at `top:2px; height:2px`.

The legend swatch is the same primitive at fixed 36 px width, so what shows in the legend is exactly what renders on the chart.

Render rule: an arrow is drawn for a span (whether project-wide or per-phase) if `actual_end_x > plan_end_x` (the span moved later). Arrow span: from `plan_end_x` to `actual_end_x`. No arrow for phases that didn't move; no arrow for early projects (in v1 — the green pill carries that signal).

### 4. Drift line

Vertical dashed red line at the project's `plan_end` x-coord, runs through the entire project block (project header + all phase sub-rows). The "plan end" label appears **only on the project header instance** — phase rows inherit the line silently.

CSS: `.gantt-drift-line { position:absolute; top:0; bottom:0; width:0; border-left:1.5px dashed rgba(220,38,38,0.55); z-index:6 }`. Label via a `.with-label::after` pseudo-element on the header instance only.

### 5. Per-phase culprit attribution

A phase is a **culprit** only if its actual span is longer than its baseline span — i.e. the phase grew. Phases that merely shifted later (pushed by an earlier slip) are **victims**, not culprits.

#### Computing phase spans

`Gantt._phaseSpans(project, baseline, skillKey)` returns:

```js
{
  baseline: { startDate, endDate, days },  // from baseline.snapshot[p.id].skill_splits[skillKey]
  actual:   { startDate, endDate, days },  // from project.skill_splits[skillKey]
  shift:    actual.startDate - baseline.startDate,   // in days
  expansion: actual.days - baseline.days             // in days
}
```

Span dates are derived from sprint start/end dates referenced by `skill_splits[].sprint`. If `skill_splits[].work_start_date`/`work_end_date` are set on a split, those override the sprint span (matching the existing Detailed-mode rendering logic).

A phase is a culprit when `expansion > 0`. Render:
- Red striped overlay on the actual bar covering exactly the expansion days (right-aligned; `left = baseline_end_x; width = actual_end_x − baseline_end_x`).
- Red `phase-tag` pill with `_formatSlip(expansion)` text positioned 8 px right of `actual_end_x`, vertically centred on the phase bar.
- Red movement arrow in the arrow band from `baseline_end_x` to `actual_end_x` (covers shift + expansion combined).

A phase that shifted but didn't expand (`expansion === 0 && shift > 0`) gets:
- No striped overlay.
- No `phase-tag` pill.
- No movement arrow. The shift is implicit from the offset between the plan lane and the actual bar. Adding a second arrow colour would add visual noise. v1 only draws arrows on phases that grew (i.e. on culprits).

A phase whose start AND end are unchanged gets nothing extra — just the plan lane + actual bar in the same place.

### 6. Phase status dot

Small (10 px) circle at the left of each phase sub-row (`left:6px`, vertically centred at y 28 of a 38 px row):

| Status | Visual |
|---|---|
| Complete | Solid teal `#0d9488` fill |
| In progress | White fill, 2 px solid blue ring |
| Pending | White fill, 2 px dashed grey ring |

Status comes from the same source as today's tooltip: aggregate `skill_splits[skill][].status` for the phase (`complete` if all complete; `in_progress` if any in-progress; `pending` otherwise).

### 7. Phase name tag

3-letter uppercase short code (`REQ`, `ENG`, `DS`, `TAB`, `UAT`) at `left:22px`, vertically centred on bar mid. Source: `Sprint.SKILLS[i].short`. Helps the user identify the phase at a glance even when the bar is too narrow to display the inline label.

### 8. Hover model

Rich hover content is concentrated on the **±d / ±w pills** (project pill and per-phase tag). Other elements get focused, minimal tooltips.

#### Project bar / label hover

Unchanged from today's existing tooltip — name, customer, status, RAG dots, manager, sprint range, total points, assignees, phase breakdown, project summary (risks/issues count).

**Removed:** the "Plan vs actual" block that PR #15 added to bar/label tooltips. It moves entirely to the pill.

#### Project ±Nd / ±Nw pill hover

The full slip story — three sections separated by 1 px dashed top borders:

```
Project Atlas slip                +2w on target

Plan vs actual
Originally planned   5 Jan → 26 Jan · 38 SP
Now                  5 Jan → 9 Feb · 43 SP
Start unchanged · target +2 weeks · scope +5 SP

Slip contributors
• Data Engineering grew 1 week → 2 weeks  +1w
• UAT grew 4 days → 8 days  +4d
• Tableau grew 4 days → 7 days  +3d

What moved
• Data Engineering scope: 5 SP → 12 SP
• Target date: 26 Jan → 9 Feb
• Schedule RAG: Green → Amber
```

Sources:
- Plan vs actual rows: `baseline.snapshot[p.id].{start_date,target_date,size_total}` vs live `p.{start_date,target_date,size_total}`.
- Diff line: text-formatted day and SP deltas using `_formatSlip` for date diffs.
- Slip contributors: `_phaseSpans` for every skill, sorted by `expansion` descending. Show only phases with `expansion > 0`.
- What moved: `App.data.audit_log` filtered by `e.projectId === p.id && e.timestamp >= baseline.created_at`, top 3 distinct fields by recency, run through `_humaniseField`.

Falls back gracefully when audit log has no entries: shows `Last touched DD MMM` (no "by USER" — see §11).

#### Per-phase ±Nd / ±Nw tag hover

Focused on a single phase's contribution:

```
Data Engineering contribution

Originally planned   12 Jan → 18 Jan · 1 week
Now                  12 Jan → 25 Jan · 2 weeks
Start unchanged; expanded by +1w.

Largest contributor to project slip (+2w total)

What moved here
• Data Engineering scope: 5 SP → 12 SP
• Sprint allocation: 1 sprint → 2 sprints
```

Sources: `_phaseSpans(p, baseline, skillKey)` for the dates/durations; the project's audit log filtered by `e.field` matching the phase's relevant fields (`size_<skill>`, skill_splits keys for that skill).

Banner colour: red if this phase is the largest contributor; amber if mid-tier; muted if it's a single-day overrun.

#### Plan-lane hover (project header AND phase plan lane)

Both the project plan lane (`.gantt-plan-lane`) and per-phase plan lanes (`.gantt-phase-plan-lane`) carry `data-hover-type="baseline"` for the project lane and `data-hover-type="phase-baseline"` for phase lanes. Both render a one-liner — "Originally planned 5 Jan → 26 Jan · 3 weeks" (project) or "Originally planned 12 Jan → 18 Jan · 1 week" (phase). No bookkeeping, no scope detail, no audit log.

#### Drift-line hover

Optional micro-tooltip: "Plan end was 26 Jan". v1 uses the existing `title` attribute for this (browser-native).

### 9. Humanised hover text

A static map `Gantt._fieldLabels` translates audit-log field keys to readable labels:

```js
{
  size_total:           'Total scope',
  size_requirements:    'Requirements scope',
  size_engineering:     'Data Engineering scope',
  size_data_engineering: 'Data Engineering scope',  // alias for legacy data
  size_data_science:    'Data Science scope',
  size_tableau:         'Tableau scope',
  size_uat_adoption:    'UAT scope',
  target_date:          'Target date',
  start_date:           'Start date',
  hard_deadline:        'Hard deadline',
  rag_schedule:         'Schedule RAG',
  rag_resourcing:       'Resourcing RAG',
  rag_scope:            'Scope RAG',
  status:               'Status',
  manager:              'Manager',
  priority:             'Priority',
  business_value:       'Business value',
  time_criticality:     'Time criticality',
  risk_reduction_opportunity: 'Risk reduction opportunity',
  moscow:               'MoSCoW priority',
  skill_splits:         'Sprint allocation',
  delivery_config:      'Delivery configuration',
  governance_forum:     'Meeting',
  customer:             'Customer',
  category:             'Category'
}
```

Helper: `Gantt._humaniseField(field)` returns the mapped label, falling back to `field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())` for unknown keys.

`oldValue` / `newValue` are rendered as-is (already user-friendly strings).

### 10. Field renames in CSS / DOM

Old (PR #15) → new:

| Old | New | Notes |
|---|---|---|
| `.gantt-baseline-bracket` | `.gantt-plan-lane` | Plan lane on project header |
| `.gantt-baseline-spine` | (removed) | No spine in plan-lane pattern |
| (none) | `.gantt-phase-plan-lane` | Per-phase plan lane in Detailed mode |
| `.gantt-delta-pill` | `.gantt-delta-pill` | Kept; CSS adjusted for centring |
| (none) | `.gantt-move-arrow` | Movement arrow primitive |
| (none) | `.gantt-phase-tag` | Per-phase ±Nd tag |
| (none) | `.gantt-phase-status-dot` | Per-phase status indicator |
| (none) | `.gantt-phase-name-tag` | Per-phase 3-letter short code |
| (none) | `.gantt-drift-line` | Vertical dashed line at plan_end |

`data-hover-type="baseline"` stays for the project plan lane. New hover types added: `phase-baseline` (per-phase plan lane), `phase-tag` (per-phase ±Nd hover), and `delta-pill` (project pill — replaces the old generic baseline hover for the slip story).

### 11. Bookkeeping removal

The "set 8 Apr by gbhall" / "set by gbhall" annotations are removed from every hover. Specifically:

- The `setMeta` variable in `buildPlanVsActual` is dropped.
- The plan-lane tooltip drops the "set by" line.
- The project pill tooltip header shows just the project name + "+2w on target", no small-text metadata.

The underlying `baseline.created_at` / `baseline.created_by` fields stay in the data model — they just stop rendering. (Useful for forensic audit later.)

### 12. Implementation notes

#### Per-phase span computation (single-pass)

`_phaseSpans` is called repeatedly during render (once per phase per row). To avoid re-iterating every project's `skill_splits` and sprint lookup tables for every phase, build a memoised cache per render pass:

```js
const phaseSpanCache = new Map();   // key: p.id|skillKey, value: spans object
function spans(p, skillKey) {
  const key = p.id + '|' + skillKey;
  if (phaseSpanCache.has(key)) return phaseSpanCache.get(key);
  const v = _computePhaseSpans(p, activeBaseline, skillKey);
  phaseSpanCache.set(key, v);
  return v;
}
```

Cache lives for the duration of `Gantt.render()` and is dropped at the end.

#### Time-axis math

The mockup uses a constant px-per-day. Production uses the existing `dateToX(date)` projector — so phase positions and arrow spans translate directly: `arrow.left = dateToX(baselineEnd); arrow.width = dateToX(actualEnd) - dateToX(baselineEnd)`. No new projection logic needed.

## Edge cases

| Case | Behaviour |
|---|---|
| No active baseline | No plan lane, no arrow, no pill, no drift line — current chart unchanged. |
| Project not in baseline snapshot | Same as above — falls through to legacy `p.baseline_start`/`baseline_end` fallback. If those are also unset, no plan lane renders. |
| Project on plan exactly | Plan lane and actual bar coincide; no pill, no arrow. |
| Project early (`actual_end < baseline_end`) | Plan lane extends past actual; green pill `−Nd` / `−Nw`; no movement arrow (in v1, no left-pointing arrow). |
| Phase missing from baseline (added after baseline) | No phase plan lane for that phase; phase bar renders normally. Tooltip notes "Added after baseline." |
| Phase removed since baseline | Phase plan lane shows; no actual bar for that skill; tooltip notes "Removed". (Edge case; rare.) |
| Detailed-mode toggled off | Per-phase elements never render. Project header still shows plan lane + arrow + pill. |
| Single phase only | Sub-rows still render (one row); arrow + pill behave as for multi-phase. |
| `dateToX` returns negative (date before chart) | Clamp to chart left edge with `Math.max(0, …)`; off-edge tick fades to opacity 0.3. |
| Arrow shorter than the arrowhead width (8 px or so) | Arrow doesn't render; the pill alone carries the signal. Threshold: `arrow.width < 12px`. |

## Test plan

### Unit + render (vitest)

- `_formatSlip` — boundary cases: 0, 6, 7, 13, 14, 21, 25, −1, −7, −10. Snapshot expected outputs.
- `_humaniseField` — all keys in `_fieldLabels` plus the fallback path for an unknown key.
- `_phaseSpans` — given fixture `p.skill_splits` + `baseline.snapshot[p.id].skill_splits`, returns expected `baseline`, `actual`, `shift`, `expansion`.
- HTML snapshot: `Gantt.render()` for slipped project with named baseline → contains `.gantt-plan-lane`, `.gantt-move-arrow`, `.gantt-delta-pill.slip`, `.gantt-drift-line.with-label`.
- HTML snapshot: detailed mode → expanded phase contains `.gantt-phase-tag`, `.gantt-phase-overlay-culprit`, `.gantt-move-arrow`; non-expanded phase has none of these.
- `buildPlanVsActual` for a project pill hover contains "Slip contributors" with phases sorted by expansion desc.
- Tooltip text for `What moved` does NOT contain raw underscore field keys.

### E2E (Playwright)

- Existing `tests/e2e/gantt-baseline.spec.ts` updated: hover the `.gantt-delta-pill` (project pill) instead of the bracket; assert tooltip contains "Plan vs actual" and "Slip contributors".
- New: hover a per-phase `.gantt-phase-tag`; assert tooltip contains "contribution" and the phase name.

### Manual

- Load demo dataset, set named baseline, slip a project's target by 14 days. Verify:
  - Project header has plan lane + red arrow + `+2w` pill; pill is vertically centred on the bar with visible 8 px gap.
  - Detailed mode: each phase has its own plan lane; expanded phases have red overlay + arrow + pill.
  - Hover project pill: full Plan vs actual + Slip contributors + What moved (humanised).
  - Hover phase tag: focused contribution tooltip.
  - Hover plan lane: one-liner.
  - Hover bar: today's existing tooltip with no Plan-vs-actual block.
  - Toggle dark mode: lanes, arrows, pills all readable.
- Pull a project in by 5 days: green `−5d` pill; no arrow; plan lane extends past actual.
- Reset to baseline: no pill at all; plan lane and bar coincide.

## Build order

1. **Helpers** — `_formatSlip`, `_humaniseField`, `_fieldLabels`, `_phaseSpans` (with cache).
2. **CSS** — new classes `.gantt-plan-lane` (rename from bracket), `.gantt-phase-plan-lane`, `.gantt-move-arrow`, `.gantt-phase-tag`, `.gantt-phase-status-dot`, `.gantt-phase-name-tag`, `.gantt-drift-line`. Adjust `.gantt-bar { top: 22px }` for the project header (was 8 from PR #15). Adjust `.gantt-delta-pill` for centring + gap.
3. **Render path — project header** — replace bracket emission with plan lane + movement arrow + pill (existing pill logic adapted to `_formatSlip`). Add drift line.
4. **Render path — phase sub-rows** — add per-phase plan lane, status dot, name tag, movement arrow (when applicable), red overlay (culprit), phase tag pill (culprit only).
5. **Hover** — extend `attachHoverHandlers`:
   - Add `paint`/`erase` branch for `phase-tag` and `delta-pill`.
   - Update `buildTooltip` for `bar`/`label` (revert to pre-PR-#15 content; remove `buildPlanVsActual` call).
   - Update `buildTooltip` for `baseline` (the plan lane) → one-liner.
   - Add `buildTooltip` for `delta-pill` → full Plan vs actual + Slip contributors + What moved.
   - Add `buildTooltip` for `phase-tag` → focused phase contribution.
   - Use `_humaniseField` for all audit-log entry rendering.
   - Drop `setMeta` everywhere.
6. **Tests** — update existing snapshots, add new render + hover tests, update e2e.
7. **Verification** — full suite green, manual smoke on slip / early / on-plan / detailed-mode.

## Risks

- **Per-phase span computation cost.** Per render, every phase of every visible project does a `_phaseSpans` lookup. With 50 visible projects × 5 phases = 250 lookups, each iterating skill_splits and sprint lookups. Mitigation: per-render memoisation cache (§12). Spec acceptance: profile shows render time < 50 ms on a 100-project customer.
- **Row-height shift breaks PDF/PNG export.** The 4 px header growth + 2 px per phase row may invalidate hard-coded pixel maths in `exportPDF` / `exportPNG` / `exportCustomerRoadmap`. Mitigation: search those functions for row-height assumptions and update if needed; print-styled PDF uses table layout (less risky) but PNG image export may need recalibration.
- **Removing `buildPlanVsActual` from bar/label tooltip is a regression for some users.** Mitigation: the same content still exists, just one cursor-target away. Documentation note in legend ("hover the pill for slip details").
- **The phase-tag pill is only ~24 px wide ("+1w"); hover target may be small.** Mitigation: use `cursor: help` so the user knows it's interactive; the underlying culprit overlay also responds to hover (could be wired to the same tooltip).
