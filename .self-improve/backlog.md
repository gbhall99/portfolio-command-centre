# Improvement Backlog

Prioritised, well-formed items for the autonomous loop. Ordered by priority score (desc).
Each: id · title · category · persona/journey · acceptance criterion · effort (S/M/L) · priority (0–100).

**Guardrails (from config.json `outOfBounds`):** do NOT modify billing/cost math (`Billing.*`,
`App.computeProjectCost`, rate cards/tables, prepaid arrangements) or AI/Tableau credential handling
(`pcc_ai_settings`/`pcc_tableau_settings` and their transport). Reads of those areas are fine.

Categories: `bug` · `ux` · `feature` · `journey` · `perf` · `a11y` · `tech-debt`.
Items framed as "audit/verify" still ship a concrete change (fix found issues, or a test that proves
the behaviour and a note in features.md). No item is "investigate only".

---

### P0 / near-term (highest leverage)

- **SI-001 · Accessibility audit of primary navigation & board** · a11y · Tom/Dev (J9), Priya (J2)
  - AC: keyboard-only user can reach every sidebar view and move a Kanban card end-to-end; all interactive controls have discernible names; visible focus rings throughout; an e2e/a11y check covers the board move + nav. No regressions in `tests/e2e`.
  - Effort: M · Priority: 90

- **SI-002 · "All customers" fallback is explained, never silent** · ux · Priya (J2)
  - AC: on a non-aggregate view while "All" is selected, the titlebar/affordance clearly states it's showing one customer and why (already partially present: "· this page shows one customer") — verify it is visible, consistent across all non-`ALL_CAPABLE_VIEWS`, and covered by a render test.
  - Effort: S · Priority: 88

- **SI-003 · Solver warnings carry plain-language "why + fix"** · ux/journey · Sana (J7), Priya (J1)
  - AC: each Allocation Results warning links to the binding constraint and a suggested lever (reuse `explain_plan` levers); a user can go warning → cause → action without reading SOLVER.md. Snapshot/render test asserts the explanatory text.
  - Effort: M · Priority: 86

- **SI-004 · Empty/first-run states guide the next action** · ux/journey · new users (J1, J4)
  - AC: every primary view with no data shows a concise, icon-led empty state with one clear CTA (e.g. "Add your first project", "Run Auto-Allocate"). No emojis. Render tests for 2–3 key empty states.
  - Effort: M · Priority: 84

- **SI-005 · Agent quick-action: "What needs my attention?" one-shot** · feature/ux · Priya (J2) · principle 6
  - AC: a scope-aware ⌘K/assistant intent runs HealthCheck.collect + briefing and returns a ranked, deep-linked attention list in one step (read-only, no model invention). Covered by an AI test using the mock adapter.
  - Effort: M · Priority: 82

### P1 / strong value

- **SI-006 · RAID hygiene surfaced proactively in-view** · ux/journey · Tom (J10, J11)
  - AC: RAID view shows a non-blocking banner when `tidy_portfolio` would propose fixes (duplicates/priority drift), one click opens the confirm batch. Reuses existing deterministic scan; no new mutation path.
  - Effort: M · Priority: 78

- **SI-007 · Board filter/sort state persists & is shareable via URL hash** · feature · Tom (J9)
  - AC: active quick-filters/sort/collapse persist per customer (already partly via `board.*` uiState) AND serialise to the URL hash so a view can be linked; restored on load. E2E covers round-trip.
  - Effort: M · Priority: 76

- **SI-008 · Stale-document nudges are consistent across SOW/Status/Wireframe** · ux/journey · Marcus (J4, J5)
  - AC: a single consistent "needs refresh" chip pattern + tooltip explaining the drift reason across SOW (`Sow.isStale`), Status Reports (`isStale`), and wireframe-grounded SOWs. Render test for each surface.
  - Effort: M · Priority: 74

- **SI-009 · Keyboard-first project quick-add** · ux/journey · Priya (J1)
  - AC: ProjectWizard fully operable by keyboard incl. per-slot answers and "field: value" paste; focus management verified; resumes draft per customer. E2E happy path.
  - Effort: S · Priority: 72

- **SI-010 · Critical-path clarity on Roadmap** · ux · Priya (J1), Elena (J14)
  - AC: critical-path toggle has a legend + hover explaining "longest blocked_by chain"; faded/critical styling meets contrast; matches solver's persisted path. Update `tests/render/gantt-cleanup.test.mjs` expectations.
  - Effort: S · Priority: 70

- **SI-011 · Scenario Lab deltas read in plain English** · ux · Priya (J3)
  - AC: each scenario row gets a one-line narration of the £ and schedule delta vs baseline (grounded, no invented figures), alongside the numeric columns. Render test.
  - Effort: S · Priority: 68

- **SI-012 · "By assignee" lane usable before allocation** · ux/journey · Dev (J12)
  - AC: pre-allocation, the swimlane shows a clear "Unassigned — run Auto-Allocate" affordance rather than a bare empty lane; populates after `assigned_to` persists. Render test for both states.
  - Effort: S · Priority: 66

- **SI-013 · Performance pass on the Projects table & board at scale** · perf · Priya, Tom (J2, J9)
  - AC: with ~200 projects, initial render and a single inline edit/card move stay responsive (measure + record a budget); avoid full re-render where a targeted DOM update suffices. Add a perf smoke note to features.md. No behaviour change.
  - Effort: L · Priority: 64

- **SI-014 · Audit untrusted-string rendering for double-quote onclick risk** · bug/tech-debt · all
  - AC: scan for any untrusted value interpolated into double-quoted inline handlers (per CLAUDE.md `esc()` caveat); convert offenders to index-based handlers; add a render test asserting safe handling for a hostile project name.
  - Effort: M · Priority: 62

- **SI-015 · Consistent icon set & remove any stray emoji** · ux/tech-debt · all · principle 1
  - AC: verify no emoji anywhere in UI/docs/generated output; ensure inline SVG icons are used consistently (size/stroke). Add a guard test that fails on emoji in `index.html` UI strings.
  - Effort: S · Priority: 60

### P2 / opportunistic

- **SI-016 · Metric-insight narration surfaced in Strategy view** · feature · Marcus/Elena
  - AC: `Metrics.movementSummary` shown inline on each metric (grounded in actuals/targets only); empty when no actuals. Render test.
  - Effort: S · Priority: 56

- **SI-017 · Pack composer remembers last audience/section choices** · ux · Marcus/Elena (J6)
  - AC: composer pre-selects the last-used audience + section toggles per customer (uiState); excluded ids still dropped before `toHtml`. E2E round-trip.
  - Effort: S · Priority: 54

- **SI-018 · Documentation currency check** · tech-debt · all · principle 4
  - AC: a script/test that flags obvious drift between `definitions/` and embedded data islands is already present (skills sync); extend the spirit with a CONTRIBUTING note + a check that CLAUDE.md module list matches the JS module objects. Lightweight.
  - Effort: M · Priority: 50

- **SI-019 · Reduce duplication in render helpers** · tech-debt · all · principle 3
  - AC: identify 2–3 copy-paste render blocks (e.g. chip/badge builders) and consolidate into a shared helper without changing output (snapshots unchanged). Net LOC down.
  - Effort: M · Priority: 48

- **SI-020 · Onboarding tour for first-time users** · feature/journey · new users
  - AC: a dismissible, no-emoji guided tour (reusing `Onboarding` tooltips) walks a first-time user through select-customer → add-project → allocate → board. Persisted as seen. E2E that it shows once and dismisses.
  - Effort: L · Priority: 46

---

## Maintenance notes for the loop
- Every change must pass the QA gate: `npm run test:unit` (224 specs) **and** `npm run test:e2e` (32 specs). Update snapshots intentionally (`npm run test:update-snapshots`), never blindly.
- After any edit under `definitions/`, run `node scripts/embed-definitions.mjs` or the skills sync test fails.
- Documentation is part of the change (principle 4): update `CLAUDE.md` and this `.self-improve/` knowledge base when behaviour/features move.
- Respect integer story points (`App.toInteger`/`fmtPoints`) and the untrusted-content escaping rules.
- Re-score and re-order this backlog at the start of each cycle; keep 15–30 live items so the loop never starves.
