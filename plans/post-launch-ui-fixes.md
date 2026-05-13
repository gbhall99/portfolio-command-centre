# Post-launch UI fixes — plan

**Drafted:** 2026-05-13 (after Phases 0–8 + R0–R11 landed on `main`).

15 user-reported items rolled into 7 independently-shippable commits. Each item below has: problem, proposed solution, acceptance criteria, files to touch. Build sequence + risks at the end.

The original user-numbered list had duplicates (two "5"s, two "10"s) — items renumbered 1–17 here for clarity, with the user's wording preserved in the **Problem** line.

---

## 1. Wizard uses the same reference data as the Detail panel (selectboxes, not free text)

**User wording:** *"The new project process needs to use the same reference data to fill in the data as the project page, with the same kind of UI elements, i.e. selection boxes, dropdowns and not default free text."*

**Current state:** `DetailPanel._openCreateWizard` (~line 21622) renders Step 2 + Step 3 with free-text `<input>`s for sponsor, strategy linkage, phase flow.

**Fix:**
- **Sponsor** → reuse `DetailPanel.renderSponsorField(p)` (line 20084) — dropdown sourced from `App.data.customers[customer].sponsors` with "+ Add new" affordance.
- **Strategy linkage** (metrics / objectives / personas) → reuse the compact checkbox picker from item #6 below (so this commit waits on #6, or we ship a temporary multi-select).
- **Phase flow** → reuse the phase-toggle row from `renderBody`'s Delivery Setup section (line ~19227) — checkboxes + reorder arrows, not free text.
- **Governance forum** → already a dropdown; keep as is.
- **Target date / hard deadline** → already `type=date`; keep as is.

**AC:**
- **AC-1.1** No `<input type="text">` survives on Step 2 or Step 3 of the wizard — verified by `wiz.querySelectorAll('[data-wiz-step="2"] input[type="text"], [data-wiz-step="3"] input[type="text"]').length === 0`.
- **AC-1.2** Sponsor field is the same DOM as `DetailPanel.renderSponsorField` (snapshot test).
- **AC-1.3** Phase-flow widget renders one toggle per phase from the canonical 6-phase list (Requirements / Data Sourcing / Data Engineering / Data Science / Tableau / UAT).
- **AC-1.4** Strategy linkage uses the compact picker from #6.

**Files:** `index.html` — wizard render block.

---

## 2. RAID in order + EVM moves to Walkthrough

**User wording:** *"The RAID section of the project should be in order. The EVM stats of the project should be in the walkthrough and not the project area."*

**Current state:**
- RAID tab section order today: Assumptions, Risks, Decisions, Issues — that's **A-R-D-I**, not RAID.
- `renderEvmStrip(p)` is pushed onto `overviewSections` in `renderBody` (line ~18499).

**Fix:**
- Reorder the RAID tab pushes so the visual order is **Risks → Assumptions → Issues → Decisions**.
- Remove the EVM section from Overview.
- Add a new tile in `Walkthrough._renderCenter` (around the Health / Trajectory tile cluster, ~line 25243) that calls a shared `Overview.renderEvmStrip(p)` extracted from `DetailPanel.renderEvmStrip`. Same byte-identical pattern we used in Phase 6.

**AC:**
- **AC-2.1** `[data-dp-tab="raid"]` sections appear in order Risks → Assumptions → Issues → Decisions.
- **AC-2.2** Overview tab no longer renders the `.evm-strip` element.
- **AC-2.3** Walkthrough center pane renders a `[data-wt-tile="evm"]` block containing the same `.evm-cell` rows previously on Overview.
- **AC-2.4** Shared `Overview.renderEvmStrip(p)` returns byte-identical HTML from both surfaces.

**Files:** `index.html` — `renderBody` (RAID push order + Overview drop), `Walkthrough._renderCenter`, new `Overview.renderEvmStrip`.

---

## 3. Drop the Overview Identity strip; add sponsor pill at the top

**User wording:** *"The Identity section of the project should be removed, because all the identity information is at the top title area — simply just add a sponsor pill at the top as its the only info missing."*

**User clarification (2026-05-13):** *"I don't want that dropped, I just want the display dropped from the overview section as it's already in the scope and value section and at the top of the project page."*

**Current state:**
- Overview tab has a read-only `dp-identity-strip` (customer / sponsor / forum) — added in Phase 3 AC-3.5.
- Scope & Value tab has the full editable Identity section — **stays as-is**.
- Sticky header row 1 already shows customer chip + status + RAG + readiness — no sponsor.

**Fix (scope reduced after clarification):**
- Delete the Overview `dp-identity-strip` block only.
- Add a `dp-sponsor-pill` to `_refreshStickyMeta` row 1 showing the project's sponsor name.
- Scope & Value tab's Identity section: untouched.
- Manager / Category / Visibility / DevOps / WFA / Lifecycle stage all stay where they are.

**AC:**
- **AC-3.1** No `.dp-identity-strip` element renders inside `[data-dp-tab="overview"]`.
- **AC-3.2** Scope tab still renders the full editable Identity section (snapshot test verifies the existing field grid is intact).
- **AC-3.3** Sticky header row 1 renders a `.dp-sponsor-pill` with the project's sponsor name; click jumps to Scope > Identity > Sponsor input.
- **AC-3.4** When `project.sponsor` is empty, the pill renders "Sponsor: —" (consistent with other empty chips).

**Files:** `index.html` — drop the `overviewSections.push((function() { … dp-identity-strip … })())` block in `renderBody`, add the pill to `_refreshStickyMeta`.

**Risk:** trivial — Phase 3's AC-3.5 test will need its assertion flipped from "strip exists" to "strip does not exist on Overview".

---

## 4. Objectives before Metrics, always

**User wording:** *"Objectives should always be presented before metrics whenever shown together."*

**Current state:** Several places render Metrics before Objectives (Strategy section, Strategy linkage, cascade strip, persona/metric tables).

**Fix:** Find every co-render of Metrics + Objectives and swap order. Searchable surfaces:
- `DetailPanel.renderStrategySection(p)` (line ~17748)
- `DetailPanel.renderStrategyEditFields(p)` (line ~17700)
- Metrics cascade strip (rendered in `MetricsView`)
- Persona/Metric tables under Personas/Metrics view

**AC:**
- **AC-4.1** Wherever both Objectives and Metrics are listed in the same UI block, Objectives appears first (verified by `indexOf('Objectives') < indexOf('Metrics')` on the rendered HTML).
- **AC-4.2** Test exercises 4 surfaces: Strategy section, Strategy linkage, cascade strip, Personas/Metrics tabular view.

**Files:** `index.html` — multiple render functions; single-line swaps per location.

---

## 5. Milestone management on both surfaces (Project page AND Walkthrough)

**User wording:** *"Milestone reviews and status changes should be in the walkthrough."*

**User clarification (2026-05-13):** *"Allow adding milestones in the project page and in the walkthrough, allow status edits in both too."*

**Current state:** Customer Milestones is fully editable on Delivery (`renderBody` line ~18876) AND on Walkthrough (`Walkthrough._renderMilestones`, line 25370 — already wired with status edit via `Delivery.setMilestoneStatus`).

**Fix (revised):**
- Both surfaces remain **equal-priority editing surfaces** — no demotion to read-only.
- Confirm both call the same `Delivery.setMilestoneStatus` / `addCustomerMilestone` flow so edits in either surface immediately appear in the other.
- Add a **"Mark reviewed"** affordance on the Walkthrough row only (this is the walkthrough-specific bit) — stamps `milestone.reviewed_at` + `milestone.reviewed_by_walkthrough_id` analogous to project-level `bumpProjectReviewed`. The Delivery row displays the reviewed-state badge but doesn't initiate the review.

**AC:**
- **AC-5.1** Adding a milestone on the Delivery tab makes it visible in the Walkthrough's milestones tile on next render (no walkthrough refresh required).
- **AC-5.2** Adding a milestone in the Walkthrough makes it visible in Delivery > Customer Milestones on next render.
- **AC-5.3** Changing milestone status in either surface persists and is visible on the other surface.
- **AC-5.4** Walkthrough milestone rows have a "Mark reviewed" button that stamps `milestone.reviewed_at` + `milestone.reviewed_by_walkthrough_id`.
- **AC-5.5** Delivery rows render a `reviewed` badge when `milestone.reviewed_at` is set (read-only display of the walkthrough-emitted stamp).

**Files:** `index.html` — `Walkthrough._renderMilestones` (add review button + add-milestone form), `App.markMilestoneReviewed` (new), no breaking changes to Delivery's milestone register.

---

## 6. Metric / Persona selectors: compact checkboxes, collapsed by default

**User wording:** *"The metric and persona selection in the scope and value area needs to have selection check boxes that isn't something that is auto-expanded, and takes up less real estate."*

**Current state:** `DetailPanel.renderStrategyEditFields` uses `<details>` blocks with the picker list visible by default; takes significant vertical space.

**Fix:**
- Render each picker (Metrics / Objectives / Personas) as a single-row chip strip showing selected items + a "+" button.
- Click "+" → small dropdown overlay with checkbox list (filterable by search).
- Selected items render as removable chips inline.
- Default: collapsed; only chips + "+" visible.

**AC:**
- **AC-6.1** No `<details>` element inside Scope > Strategy linkage opens by default (`open` attribute absent from initial render).
- **AC-6.2** Initial render of the strategy linkage block fits within a single row per picker (~28 px height).
- **AC-6.3** Clicking "+" opens a popover with `<input type="checkbox">` rows, one per option.
- **AC-6.4** Toggling a checkbox updates the inline chip strip without reloading the panel.

**Files:** `index.html` — `renderStrategyEditFields`, new CSS for `.dp-strategy-chip` / `.dp-strategy-add` / `.dp-strategy-popover`.

---

## 7. Issues in the Walkthrough

**User wording:** *"Issues should be added to the walkthrough."*

**Current state:** Issues live only in RAID > Issues (`renderIssues`, line 20324). Walkthrough `_renderOpenLists` (~line 25445) shows risks + actions only.

**Fix:**
- Extend `_renderOpenLists` to also render an "Open issues" tile (mirrors risks structure: row per issue, with Close + Open-in-Detail buttons).
- Inline quick-add same as risks.

**AC:**
- **AC-7.1** Walkthrough open-lists panel renders a `[data-wt-tile="issues"]` block.
- **AC-7.2** Issues tile lists every entry in `project.issues_register[]` filtered to open status.
- **AC-7.3** Quick-add issue from walkthrough lands in `project.issues_register[]` and shows in RAID without reload.

**Files:** `index.html` — `Walkthrough._renderOpenLists`, possibly new `RAID.renderIssueRow` shared helper.

---

## 8. Open pack: select first, then click

**User wording:** *"The open pack option in the walkthrough should have a selection box before clicking on the report creation."*

**Current state:** `Walkthrough._openPackPicker` (line 25606) uses `window.prompt()` to pick pack type — clunky.

**Fix:** Replace prompt with a `<select>` (Customer / Sponsor / Meeting / Portfolio) inline with the "Open pack" button. Button is disabled until a value is picked.

**AC:**
- **AC-8.1** Walkthrough right rail renders `[data-wt-pack-select]` `<select>` + adjacent button.
- **AC-8.2** Button is `disabled` until a pack type is selected.
- **AC-8.3** Clicking the button opens the corresponding `Reports.Builders.*` preview (no prompt dialog fires).

**Files:** `index.html` — `Walkthrough._renderCustomerPanel` (right rail), `_openPackPicker` rewired.

---

## 9. Walkthrough scope / effort adjustment tile

**User wording:** *"The walkthrough should allow for scope / effort adjustment processes."*

**Current state:** No scope-edit surface in the walkthrough; sizing changes today only via Delivery > Delivery Phases.

**Fix:**
- New tile `[data-wt-tile="scope-effort"]` in `_renderCenter` with:
  - `size_total` read-only header
  - Per-phase points (inline `<input type=number>` for size_requirements / size_engineering / size_tableau / size_data_science / size_uat_adoption)
  - Net-delta chip showing `±N pts vs baseline` when baseline exists
- Changes route through Phase 5's `_captureChangeReason({ tag: 'scope-change' })` flow → reason modal → auto-Decision tagged `scope-change` with `meta.delta`.

**AC:**
- **AC-9.1** Walkthrough renders a tile labelled "Scope & effort" with one row per phase.
- **AC-9.2** Editing a phase points input opens the existing scope-change reason modal (Phase 5 / AC-5.3 — already built; reused as-is).
- **AC-9.3** Confirming the modal creates a Decision tagged `scope-change` AND fires the undo toast.

**Files:** `index.html` — `Walkthrough._renderCenter` (new tile), no new logic (reuses Phase 5 reason capture).

---

## 10. Status dropdown — its own section with a title

**User wording:** *"The selection box for the status currently situated by the RAG should have a title and its own section."*

**Current state:** In `Walkthrough._renderCenter`'s Health tile, the project status `<select>` sits next to the RAG triplet without a label, inside the same `<div class="wt-rags-row">`.

**Fix:** Extract status into its own labelled block:
```html
<div class="wt-tile" data-wt-tile="status">
  <h6>Status</h6>
  <select class="wt-status-sel">…</select>
</div>
```

The Health tile shrinks back to RAG-only (its original role).

**AC:**
- **AC-10.1** A tile with `[data-wt-tile="status"]` and an `<h6>Status</h6>` heading is rendered separately from the Health tile.
- **AC-10.2** Health tile no longer contains a `<select class="wt-status-sel">`.
- **AC-10.3** Identical wiring (`App.updateProjectStatus` callback) is preserved.

**Files:** `index.html` — `Walkthrough._renderCenter`.

---

## 11. Governance forum: remove the add-action / add-decision UI entirely

**User wording:** *"When building out a governance forum, don't have separate actions or decisions outside the project itself."*

**User clarification (2026-05-13):** *"Don't allow these to be added here, only allow them to be added in the project areas that already exist."*

**Current state:**
- `Governance.addAction` (~line 32778) — creates actions inside the forum view.
- `Governance.addDecision` (~line 33014) — creates decisions inside the forum view.
- Both are reachable from forum-row "+ Add action" / "+ Add decision" controls in the Governance view.
- Project areas already have RAID > Decisions (Detail panel) and forum-linked actions visible there.

**Fix (revised — stricter than original):**
- **Remove** the "+ Add action" / "+ Add decision" controls from the Governance forum view entirely.
- Keep `Governance.addAction` / `addDecision` as functions for back-compat (used by R5/R6 migration code + walkthrough capture), but no UI button surfaces them in the forum view.
- The Governance view becomes a **read-only display** of project-authored items, filtered by forum.
- Detail panel RAID > Decisions stays as the authoring surface.
- Add a new project-scoped "Meeting actions" affordance to RAID alongside Decisions (where users currently can't author them from inside a project). If the project already supports this via the Walkthrough quick-add (Phase 6 / R6), confirm that flow is the canonical one and link to it from the Governance row instead.

**AC:**
- **AC-11.1** Governance forum view DOES NOT render any "+ Add action" or "+ Add decision" buttons (grep `governance-add-action` / `governance-add-decision` returns zero in rendered HTML).
- **AC-11.2** Existing forum actions / decisions remain visible in the Governance view — read-only display preserved.
- **AC-11.3** Every action and decision in the rendered Governance forum list has a `projectId` (or `linkedProjects[]` with ≥1 entry) — orphan rows are surfaced with a `_unscoped` badge + a one-time toast on first load post-migration explaining where to re-author them.
- **AC-11.4** Detail panel RAID > Decisions can author Decisions tagged with a governance forum (existing) — verified by smoke test.
- **AC-11.5** Walkthrough capture (RAID quick-add Decision / Action) still works and tags with `forum_id` where appropriate.

**Files:** `index.html` — Governance view render: remove the add controls; keep functions; new migration to flag orphans; toast on first post-migration load.

**Risk:** users with existing in-forum authoring habits will need a redirect. Mitigated by: (a) keeping read-only display in place; (b) adding a small "Add via project" link on the forum row that opens the Detail panel RAID tab; (c) one-time toast.

---

## 12. Project table — customer pill / manager column overlap

**User wording:** *"In the project table, the customer name pill overlaps with the manager name within the table."*

**Current state:** `Dashboard.COLUMNS` customer column (~line 14487) renders a `.badge.badge-customer` at fixed width 80 px; manager column (~line 14499) is 120 px with text-overflow ellipsis. When the customer name is long, the pill overflows its cell visually.

**Fix:**
- Constrain the pill to its own cell via `overflow: hidden` on the cell + `max-width: 100%` + `text-overflow: ellipsis` on the pill.
- Bump customer cell default width to 100 px (column picker can still resize per user pref).
- Verify with the 3 longest customer names in the fixture (e.g. "Acme Industries").

**AC:**
- **AC-12.1** With a 24-char customer name + a 24-char manager name, the rendered HTML shows the pill text truncated with `…` and no visual overlap (verified by computed-style check in jsdom).
- **AC-12.2** Column-picker widths persist as before.

**Files:** `index.html` — CSS for `.badge.badge-customer`, `.manager-cell` adjustment if needed.

---

## 13. MoSCoW help tooltip

**User wording:** *"Provide some help details on what MoSCoW means in a helper question mark button on the project settings."*

**Current state:** Prioritisation section in Scope & Value has a MoSCoW dropdown with `title="MoSCoW classification partitions priority bands…"` but no explicit `?` button.

**Fix:** Add an inline `?` icon next to the MoSCoW label, click → small popover explaining:
- **Must** — required for this release, business-critical
- **Should** — important but not blocking
- **Could** — nice-to-have, can be deferred
- **Won't** — explicitly out of scope

**AC:**
- **AC-13.1** The MoSCoW label renders a sibling `<button class="field-help-btn" data-field="moscow">?</button>`.
- **AC-13.2** Click opens a popover containing 4 list items (Must / Should / Could / Won't) with the standard descriptions.
- **AC-13.3** Same pattern can be applied to other field-help buttons in future (helper is a reusable widget).

**Files:** `index.html` — Prioritisation section render; new `DetailPanel._showFieldHelp(field)` method.

---

## 14. Country-scoped holidays + member country (with sub-locations for India)

**User wording:** *"When setting a team holiday, assign it to a country and ensure each team member has a country assigned to it."*

**User clarification (2026-05-13):** *"US, UK, India, Netherlands, Canada, Malaysia. Have sub locations for India too, Hyderabad and Bangalore."*

**Current state:**
- `App.data.annual_holidays[]` rows shape: `{ name, date, recurring, customers: [] }` — scoped by customer, not country.
- `team_member` rows have **no** `country` field today.
- `calcMemberCapacityForSprint` filters annual holidays by `customers` membership.

**Country list (locked):**
```js
const LOCATIONS = [
  { country: 'UK',          code: 'GB', sub_locations: [] },
  { country: 'US',          code: 'US', sub_locations: [] },
  { country: 'India',       code: 'IN', sub_locations: ['Hyderabad', 'Bangalore'] },
  { country: 'Netherlands', code: 'NL', sub_locations: [] },
  { country: 'Canada',      code: 'CA', sub_locations: [] },
  { country: 'Malaysia',    code: 'MY', sub_locations: [] }
];
```
Default country on migration: `UK` (preserves prior behaviour for the existing fixture team).

**Fix:**
- **Schema additions:**
  - `team_member.country` (one of the 6 names above)
  - `team_member.sub_location` (optional; only valid when `country === 'India'`)
  - `annual_holidays[i].country` (one of the 6)
  - `annual_holidays[i].sub_location` (optional; same constraint as members)
- **Migration:** add `country: 'UK'` to every existing member + holiday; preserve `customers[]` on holidays for back-compat for 2 versions.
- **Capacity logic:** `calcMemberCapacityForSprint` applies a holiday to a member iff `holiday.country === member.country` AND (holiday has no `sub_location`, OR `holiday.sub_location === member.sub_location`). A national India holiday (no sub_location) hits both Hyderabad + Bangalore; a Bangalore-only holiday hits Bangalore members only.
- **UI:**
  - Settings → Team Members: country `<select>` + (conditional) sub-location `<select>` shown only when country = India.
  - Settings → Holidays: same conditional dropdown pair.

**AC:**
- **AC-14.1** `LOCATIONS` constant exposes the 6 entries in the order specified; India entry includes the 2 sub-locations.
- **AC-14.2** Schema migration: every existing member without a `country` field defaults to `'UK'` on load; same for holidays.
- **AC-14.3** Capacity calc: a UK holiday is not applied to a US-country member (US member's available SP for that day is unchanged).
- **AC-14.4** Capacity calc: a Bangalore-scoped India holiday IS applied to a Bangalore India member and IS NOT applied to a Hyderabad India member.
- **AC-14.5** Capacity calc: a country-only India holiday (no sub_location) applies to both Hyderabad AND Bangalore members.
- **AC-14.6** Settings UI shows sub-location picker only when the selected country = India (the picker is hidden / disabled otherwise).
- **AC-14.7** Down-migration round-trip preserves country + sub_location.
- **AC-14.8** Solver tests using existing fixtures keep passing (no `country` field on legacy data → defaults applied → no behavioural change).

**Files:** `index.html` — `LOCATIONS` constant, schema migration step, `calcMemberCapacityForSprint`, two Settings render methods (Team Members + Holidays).

**Risk:** medium — touches capacity math. Mitigated by tight unit tests for the 4 location/sub-location matrix cells (UK vs IN-Hyd, IN-Hyd vs IN-Bglr, country-only India, US vs UK).

---

## 15. Customer milestones on Gantt + diamond icon + legend entry

**User wording:** *"Ensure any additional milestones are added to the gantt with a generic milestone icon, ensure there is a legend for it in the same style as others."*

**Current state:** `Gantt.renderLegend()` (lines 22336-22375) renders Deadline / Launch / UAT / External-dep entries. Customer milestones aren't on the Gantt today.

**Fix:**
- New SVG builder `msMilestone(date, name)` — diamond, default colour `var(--text-dark-secondary)`, hover-tooltip with name.
- In `Gantt.render`, loop `p.customer_milestones` and call `msWrap(msMilestone(...))` for each, positioned via existing `dateToX(milestone.date)`.
- Legend entry: add a 5th `<span class="gantt-legend-item">` between External-deps and the end — same diamond SVG.

**AC:**
- **AC-15.1** Project with 2 customer_milestones renders 2 `[data-gantt-milestone]` diamonds at the correct X positions.
- **AC-15.2** Legend includes a "Milestone" entry with the diamond SVG.
- **AC-15.3** Hover/click on a diamond shows the milestone name.

**Files:** `index.html` — `Gantt.renderLegend`, `Gantt.render` (~line 23603 area), new `msMilestone` helper.

---

## 16. Unallocated skill assignments visible on Gantt

**User wording:** *"If there are any unallocated skill assignments to a sprint, ensure this is visually visible on the gantt."*

**Current state:** Gantt overview-mode iterates `p.skill_splits[sk]` and `if (!splits.length) return` — projects with `size_engineering=10` but empty `skill_splits.size_engineering[]` are silently omitted.

**Fix:**
- Detect unallocated skills: for each skill `sk` where `p[sk] > 0` and `(p.skill_splits[sk] || []).length === 0`, render a **dashed** segment at the end of the bar showing the unallocated points.
- Dashed pattern uses `stroke-dasharray` on a `<rect>` background or a CSS `background-image` of a striped pattern.
- Tooltip: `"10 SP unallocated — Data Engineering"`.
- Legend entry: 6th legend item "Unallocated" with the dashed pattern.

**AC:**
- **AC-16.1** Project with `size_engineering=10` and empty splits renders a `[data-gantt-unallocated][data-skill="size_engineering"]` segment with the dashed pattern.
- **AC-16.2** Hovering the segment shows the SP count + skill name.
- **AC-16.3** Legend includes an "Unallocated" entry.
- **AC-16.4** When the skill IS allocated, no unallocated segment renders for that skill.

**Files:** `index.html` — `Gantt.render` (skill loop), CSS for `.gantt-segment-unallocated`, `Gantt.renderLegend`.

---

## 17. Gantt label inconsistency + subtle status visualization

**User wording:** *"Check why some projects have the project name written on the gantt bar across all skill colours, and some don't and some have some white gaps between them — if there are any bugs, or inconsistencies, please fix them, please also find a way to visually represent the status of each section in a subtle but clear way."*

**Current state (from recon):**
- Overview-mode label: `if (w > 60) barLabel = '<span class="bar-label">' + p.name + '</span>'` (line 23566) — label only renders when bar width > 60 px. Short bars get no label; long bars do — that's the visible inconsistency.
- White gaps between segments: each segment width is `Math.max(2, Math.round(segX2 - segX1))` (line 23553). When a skill has no splits in a given timespan, the segment width falls to the 2 px fallback, creating visible gaps.

**Fix (in two parts):**

### 17a. Label consistency
- Drop the `w > 60` gate. Always render the label.
- If `w < 60`, position the label outside the bar (to the right of the rightmost segment) instead of inside — same pattern as the detailed-mode floatLabel.
- Truncate with ellipsis when label width > bar width.

### 17b. No more white gaps
- Replace the 2 px fallback with a continuous "spacer" segment that uses the same `var(--bg-content)` background — visually invisible against the row but still occupies space, so segments stay flush.
- Alternative: drop the inner `<span>` for empty skills entirely and let the next segment butt up.

### 17c. Subtle per-section status indicator
- Per the user's "subtle but clear" ask — add a thin border (1 px) on each segment whose `phaseStatusClass === 'complete'` (a slightly darker shade of the segment colour) — this matches how the current phase-dot uses class-based shading.
- Add a thin diagonal-stripe pattern overlay for `'in-progress'` segments.
- "Not Started" segments stay flat (no extra adornment) — that becomes the visual baseline.

**AC:**
- **AC-17.1** Every Gantt project bar with `p.name` non-empty renders a `.bar-label` element regardless of bar width.
- **AC-17.2** No `.gantt-segment` element has a computed width of 2 px when the project has skill splits on either side of it — verified by snapshot.
- **AC-17.3** A "Complete" phase segment has class `gantt-segment-complete` (CSS adds a 1 px inset darker border).
- **AC-17.4** An "In Progress" phase segment has class `gantt-segment-in-progress` (CSS adds a subtle diagonal stripe).
- **AC-17.5** "Not Started" segments retain today's flat appearance.
- **AC-17.6** Visual regression smoke test: 5 representative projects render the same overall colour palette as before.

**Files:** `index.html` — `Gantt.render` (label + segment logic, ~lines 23542-23615), CSS for `.gantt-segment-complete` / `.gantt-segment-in-progress` / `.bar-label-outside`.

---

## Build sequence

Each row independently shippable. Tests written alongside.

| Slot | Items | Commit msg | Risk | Notes |
|---|---|---|---|---|
| **A** | 12, 13, 10 | "ui: pill overlap fix + MoSCoW help + status section" | low | Pure CSS / tiny render tweaks |
| **B** | 1, 6 | "feat(wizard): reference-data parity + compact strategy pickers" | low | #6 unlocks the strategy linkage path in #1 |
| **C** | 3, 2, 4 | "feat(detail): drop Identity strip, RAID order, Objectives-before-Metrics" | medium | Touches Phase 3 IA — updates `plans/detail-panel-ia-refactor.md` §3.13 footnote |
| **D** | 5, 7, 8, 9, 2 (EVM half) | "feat(walkthrough): EVM + Issues + scope-effort + pack picker + milestone reviews" | medium | Largest single commit — biggest walkthrough expansion since Phase 6 |
| **E** | 11 | "feat(governance): require project scope on every action + decision" | medium | Has migration; gate via `enforceProjectScope` setting flag, default ON |
| **F** | 14 | "feat(team): country-scoped holidays + member country attribute" | medium | Schema + capacity math — test against existing solver fixtures |
| **G** | 15, 16, 17 | "feat(gantt): milestone diamonds + unallocated viz + label + status" | medium | Three Gantt-render changes; one combined visual-snapshot test |

**Estimated test deltas:** ~40 new AC tests across the 7 slots. Existing 548 unit + 56 e2e tests must stay green.

---

## Cross-cutting risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Slot C drops the Identity section that Phase 3's §3.13 migration map called canonical | medium | This plan supersedes that map for the Identity row. Add a footnote to `detail-panel-ia-refactor.md` §3.13 referencing this plan. |
| Slot D bloats `Walkthrough._renderCenter` past readability | low | Compose from existing render functions (Phase 6 pattern). New tiles call shared `Overview.*` / `RAID.*` helpers. |
| Slot E migration flags orphans rather than auto-fixing — user may not notice the `_unscoped` rows | medium | Add a one-time toast on first load post-migration listing the count + link to a cleanup view. |
| Slot F country migration applies wrong default for non-UK teams | medium | Default `GB` is documented; first thing the user sees after migration is the country picker on their first team-member edit. Could also gate via Settings toast: "We've defaulted team members to GB — review and adjust". |
| Slot G #17 fix changes the visual look of every Gantt bar | medium | Take a screenshot snapshot of the current Gantt against `portfolio-data.json` before edit; manual sign-off on the new render before merging Slot G. |

---

## Decisions resolved (2026-05-13)

All 5 open questions answered by the user:

1. **Item 3 (Identity):** Don't restructure. Just drop the Overview Identity strip; keep the Scope & Value Identity section intact. Sticky-header sponsor pill is the only addition. *(Plan updated above — Item 3 scope reduced.)*
2. **Item 5 (Milestones):** Both Delivery AND Walkthrough are equal-priority editing surfaces (add + status edit on both). Walkthrough adds a "Mark reviewed" affordance on top. *(Plan updated above.)*
3. **Item 11 (Governance scoping):** Stricter than the original proposal — **remove** the add-action / add-decision controls from the Governance forum view entirely. Forum becomes read-only display. Authoring moves to project areas only. *(Plan updated above.)*
4. **Item 14 (Country):** Locked country list = `UK / US / India / Netherlands / Canada / Malaysia`. India has sub-locations: Hyderabad, Bangalore. *(Plan updated above with the full `LOCATIONS` constant.)*
5. **Item 17 (Status visualization):** Approved — diagonal stripe for in-progress, inset darker border for complete, flat for not-started.

Plan ready to execute.
