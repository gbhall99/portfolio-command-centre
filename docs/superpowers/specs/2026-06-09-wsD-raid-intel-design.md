# Workstream D — RAID intelligence — design

**Date:** 2026-06-09
**Branch:** `wsD-raid-intel`
**Context:** User request (#8) — "Make the RAID page more actionable and intelligent … focus on resolving and highlighting the most important issues: when risks are about to materialise, how long issues are open for, what decisions are blocking / taking long." Today the RAID page is four flat tables (Risks/Assumptions/Issues/Decisions), customer-scoped, with no urgency surfacing.

**Key constraint (from exploration):** the data to power urgency is largely uncaptured — in the demo, 0/14 risks have impact/probability, risks have no target/review date, issues have no opened date. So D adds a thin data layer + seeds the demo, then builds the intelligence + redesign on top.

**Scope:** Single-file `index.html` + the two demo JSON copies (inline `#demoDataset` + `portfolio-data-demo.json`, kept in sync). `:root` tokens, inline SVG, no emojis, `Dashboard.esc()`, customer-scoped. Gated by `npm test`.

## Decisions (from brainstorming)
- Data: **add fields + capture + seed demo.** Urgency: **severity + time.** Layout: **Attention panel + enriched tabs.**
- Thresholds (tunable constants): issue aging amber ≥30d / red ≥60d; decision pending aging ≥21d; risk "near" target window = within 30 days (or overdue).
- "Aging decisions" = **pending governance-forum decisions** (state Proposed/Discussed) for the active customer — the items awaiting a call — not the recorded decisions_register log.

## D1 — Data signals (model + migration + demo seed)

- **Risk** (`project.risks_register[]`): ensure `impact` and `probability` (integers 1–5); add `target_date` (ISO `YYYY-MM-DD`, nullable — when the risk could materialise / next review). Existing fields (`description`, `action`, `owner`, `resolution_date`) unchanged.
- **Issue** (`project.issues_register[]`): add `opened_date` (ISO, nullable). New issues created in-app default `opened_date` to today.
- **Migration** (`migrateSchema`): for each risk, leave `impact`/`probability`/`target_date` as-is if present, else absent (no fabricated values for user data); for each issue, leave `opened_date` as-is (existing = unknown). No destructive changes. (No array-default needed beyond the existing register guards.)
- **Demo seed:** in BOTH `portfolio-data-demo.json` AND the inline `#demoDataset` island, backfill every risk with `impact` (1–5), `probability` (1–5), and a `target_date` (varied: some overdue, some within 30d, some far out); backfill every issue with an `opened_date` (varied: some >60d old, some recent). The WS-H sync-test asserts the two demo copies stay equal — update both together.

## D2 — Capture in the RAID editor

In the project detail-panel RAID tab edit forms:
- **Risk** edit: inputs for `impact` (1–5) and `probability` (1–5) — wire through the existing `App.updateRiskScore` path if present, else add to the risk edit form — plus a `target_date` date input.
- **Issue** edit/add: a `opened_date` date input, pre-filled to today on a new issue (editable).
Token-styled, consistent with the existing RAID entry UI. Persist via the normal update path (`markDirty` + `saveToLocalStorage`).

## D3 — Urgency compute (`RaidIntel` helper)

A small helper object (`RaidIntel`, pure functions, unit-testable) computing, relative to a `today` argument (so tests are deterministic):
- `riskSeverity(risk)` → `impact * probability` (0 if either missing). Bands: ≥15 high, 8–14 medium, <8 low (matches the existing `_scoreChip`).
- `riskNearTarget(risk, today)` → true if `target_date` is overdue or within 30 days.
- `riskUrgency(risk, today)` → a numeric score: severity, escalated (e.g. ×1.5 or +bonus) when `riskNearTarget`. Used for "Risks to watch" selection + sort.
- `issueAgeDays(issue, today)` → `today − opened_date` (null if no opened_date). `issueAging(issue, today)` band: ≥60 red, ≥30 amber, else none.
- `decisionAgeDays(decision, today)` and `decisionAging` (≥21d) for pending governance decisions.
- Thresholds as named constants at the top of `RaidIntel` (ISSUE_AMBER=30, ISSUE_RED=60, DECISION_AGING=21, RISK_NEAR_DAYS=30) so they're easy to tune.

## D4 — Attention panel (top of the RAID page)

A triage band rendered at the top of `#raidContent` (or above the tabs in `#viewRaid`), customer-scoped, with three groups:
- **Risks to watch** — open risks (not resolved) that are high-severity (≥15) OR (medium-severity ≥8 AND near/overdue target), sorted by `riskUrgency` desc; show severity chip + target ("overdue" / "in Nd").
- **Oldest open issues** — open issues with `opened_date`, age ≥30d, sorted by age desc; show "open Nd".
- **Aging decisions** — pending governance-forum decisions (Proposed/Discussed) for the active customer, age ≥21d, sorted by age desc; show "pending Nd".
Each row is clickable: risks/issues → `DetailPanel.open(projectId, {tab:'raid', …})`; decisions → open the governance forum (mirror MyActions' `openForum`). Show top ~5 per group with a count; an empty group renders a muted "all clear" line. The panel is collapsible/compact so it doesn't dominate.

## D5 — Enriched tables + urgency sort

The existing R/A/I/D tables (`RaidView._renderTable`) gain:
- **Risks:** a severity chip (reuse `_scoreChip`) + a `target` cell ("overdue"/"in Nd"/date); default sort by `riskUrgency` desc.
- **Issues:** an "open Nd" age chip (amber/red per bands); default sort by age desc (open first).
- **Decisions** (recorded log): a recency/date column; sort by date desc (most recent first).
- Assumptions: unchanged (no urgency dimension).
The existing row-click → detail-panel behaviour and customer-scoping stay.

## Testing

- **`RaidIntel` unit tests** (deterministic `today`): severity + bands; near-target (overdue/within/after 30d); riskUrgency escalation; issue age + aging bands (29/30/59/60); decision aging (20/21); null/missing-date handling.
- **Attention panel render:** with seeded data, the three groups list the right items/counts and sort correctly; empty groups show "all clear"; rows link correctly; customer-scoped (other customers' items excluded; pending decisions filtered to the customer).
- **Enriched tables:** severity/age chips present; urgency sort order; existing RAID tests (`slot-h-nav-raid`, `raid-customer-scope`) stay green.
- **Migration + demo seed:** risks have impact/probability/target_date and issues have opened_date in the demo; the inline `#demoDataset` deep-equals `portfolio-data-demo.json` (WS-H sync-test).
- **Visual:** in-browser — Attention band shows risks-to-watch/oldest-issues/aging-decisions; tables show chips + urgency order; clicking an attention item opens the right place; light + dark.

## Out of scope
- No new RAID entry types or workflow; no notifications/email.
- Assumptions get no urgency layer (no time/severity dimension requested).
- E (Reports/packs) — its own workstream.
