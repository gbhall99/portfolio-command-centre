# Scratch — Reports & Documentation Audit (working file)

## Iteration log
- v1 inventory + draft: in progress
- PO pass: pending
- SM pass: pending
- Data engineer pass: pending
- UX pass: pending
- Consensus: pending

---

## A. Inventory of report outputs

Every user-facing document/pack/export the app can produce.

| # | Output | Trigger location | Entry function | Doc template | Scope |
|---|---|---|---|---|---|
| 1 | Sponsor Pack (1-page brief per project) | DetailPanel banner button "Sponsor Pack" | `Report.exportProjectPack(projectId)` | `Report.buildProjectPackDoc` → `Report.buildDoc` | single project |
| 2 | Business Case (cost / benefit / NPV / WSJF) | DetailPanel banner button "Business Case" | `Report.exportBusinessCase(projectId)` | `Report.buildBusinessCaseDoc` → `Report.buildDoc` | single project |
| 3 | Walkthrough Minutes | Walkthrough top bar "Export minutes" | `Report.exportWalkthroughMinutes(walkthroughId)` | `Report.buildWalkthroughMinutesDoc` → `Report.buildDoc` | one walkthrough session |
| 4 | Sprint Brief (per-member load) | Capacity view "Sprint Brief" button + picker | `Report.exportSprintBrief(customer, sprintId)` | `Report.buildSprintBriefDoc` → `Report.buildDoc` | one customer × one sprint |
| 5 | Customer Pack (customer-facing update) | Walkthrough right-rail "Open pack" | `Report.exportCustomerPack(customer)` | `Report.buildCustomerPackDoc` → **inline HTML, NOT buildDoc** | one customer |
| 6 | Portfolio Pack (branded multi-section) | Governance view + Cmd+K | `Report.exportPortfolioPack(customer)` | inline-composed sections → `Report.buildDoc` | one customer, multi-project |
| 7 | Meeting Agenda / Forum Pack | Walkthrough → forum action; Governance buttons | `Governance.exportForumAgenda(forumId)` → `Governance.buildAgendaDoc` → `Report.buildDoc` | one governance forum |
| 8 | Portfolio Status Report (cross-customer) | Governance "Status Report" button + Cmd+K | `App.exportStatusReport()` | **inline HTML, NOT buildDoc** | all customers |

**Two outputs (#5 Customer Pack and #8 Status Report) bypass `Report.buildDoc` entirely.** They emit their own cover pages, their own footers, their own styles, their own classification handling (or lack of). Everything else routes through `Report.buildDoc`.

### Template flow

`Report.buildDoc({customer, title, subtitle, sections, bodyHtml, reportType, includeAppendix})` produces:
- `Report._baseStyles(brand)` — shared print stylesheet (A4, page-break rules, RAG colours, KPI cards, cover page, TOC, section-numbered headers)
- `Report._coverPage(...)` — branded cover (logo, customer chip, generated date, sections count, classification chip)
- `Report._tocPage(sections)` — auto-numbered Contents list
- One `<div class="page" id={section.id}>` per section
- `Report._appendix(customer)` — Glossary + Report Metadata (schema version, generated timestamp, project count, source)
- Print toolbar (Print + Close buttons, hidden on print)
- Auto-`window.print()` on load

The `Report.branding(customer)` lookup pulls per-customer `logo`, `primaryColor`, `secondaryColor`, `companyName`, `footerText` from `App.data.settings.branding[customer]` with sensible defaults.

---

## B. Data sources used by reports

Every field/derivation that flows into at least one report, grouped by canonical-vs-report-only.

### B1. Canonical project fields used by reports (these are live state, not report-only)

| Field | Used by reports | Used elsewhere? |
|---|---|---|
| `project.name`, `customer`, `id` | all 8 | everywhere |
| `project.status` | all 8 | DetailPanel, Dashboard, Walkthrough, Solver |
| `project.rag_schedule`, `rag_resourcing`, `rag_scope` | 1, 5, 6, 7, 8 | DetailPanel, Walkthrough, Dashboard |
| `project.sponsor`, `manager` | 1, 7, 8 | DetailPanel, Governance |
| `project.start_date`, `target_date`, `hard_deadline` | 1, 6, 8 | DetailPanel, Gantt, Solver |
| `project.priority`, `lifecycle_stage`, `ownership` | 6, 8, 7, 5 | Backlog, DetailPanel |
| `project.notes` | 6, 8 | DetailPanel |
| `project.size_total`, `skill_splits[].completed` | 4, 6, 8 | Solver, Sprint Planning, Capacity |
| `project.current_sprint`, `target_sprint` | 6, 8 | Sprint Planning |
| `project.risks_register[]` (all fields) | 1, 5, 6, 7 | DetailPanel RAID, Walkthrough |
| `project.governance_forum` | 7 | Governance |
| `project.benefit_annual_gbp`, `benefit_horizon_years` | 2 | DetailPanel (Outcomes register, after IA refactor) |

These are fine — they exist for product use, reports consume them.

### B2. Canonical narrative fields used by reports (live state, NOT report-only)

| Field | Stored on | Read by | Notes |
|---|---|---|---|
| `narrative.headline` | `project.narrative` | Sponsor Pack #1, Customer Pack #5, Forum Agenda #7, Walkthrough card subtitle, Walkthrough composer | Already in IA refactor as the **PO weekly caption**. One source. |
| `narrative.updated_at`, `narrative.updated_by_walkthrough_id` | `project.narrative` | (not currently rendered in any report) | Metadata only; useful for "as-of" footers in Customer Pack |

### B3. Schema fields that exist *primarily* to support reports

These are the red-flag items the user asked about.

| Field | Stored on | Used in | Verdict |
|---|---|---|---|
| `narrative.wins[]` | `project.narrative` | Customer Pack #5, Forum Agenda #7 only | **Pack-composition only.** Captured in Walkthrough right-rail. Never surfaces in Detail panel. Genuinely report-coupled. |
| `narrative.asks[]` | `project.narrative` | Customer Pack #5, Forum Agenda #7 only | Same as wins. |
| `narrative.customer_visible_risk_ids[]` | `project.narrative` | Customer Pack #5 only | Same — selects which risks to show externally. |
| `walkthrough.minutes_html` | `App.data.walkthroughs[]` | **Written on `completeWalkthrough`; NEVER READ BY JS** | **Anti-pattern.** Denormalised snapshot. Could be re-generated from canonical fields any time. Schema bloat for nothing. |
| `walkthrough.data_updates[]` | `App.data.walkthroughs[]` | Walkthrough Minutes #3 | Parallels `App.data.audit_log[]` filtered by `walkthrough_id` (which already has `source='walkthrough'`). **Redundant.** |
| `walkthrough.attendees[]` | `App.data.walkthroughs[]` | Walkthrough Minutes #3 | Session metadata. Reasonable to keep; only place it's captured. |
| `walkthrough.section_notes` | `App.data.walkthroughs[]` | Walkthrough Minutes #3 only | Captured during walkthrough; never surfaces in Detail panel. **Possibly report-coupled — should these be Decisions register entries instead?** |
| `walkthrough.decisions[]` | `App.data.walkthroughs[]` | Walkthrough Minutes #3 | Parallel register to `project.decisions_register` (which IS in the Detail panel IA refactor). **Likely duplication.** |
| `walkthrough.actions[]` | `App.data.walkthroughs[]` | Walkthrough Minutes #3 | Parallels `forum.actions[]` — `recordWalkthroughAction` copies to forum. **Live duplication, drift waiting to happen.** |
| `App.data.settings.branding[customer]` | `App.data.settings` | All `buildDoc` reports | Live config for report appearance. Reasonable. But not surfaced anywhere except the Configure Branding modal — could leak. |
| `App.data.schema_version` | `App.data` | Appendix only | Versioning metadata. Useful for forensics. Reasonable. |

### B4. Derived / computed (NOT stored, fine)

These run on demand from canonical fields:
- `App.computeCustomerPackData(customer)` — shapes Customer Pack #5 data
- `App.computeWalkthroughCards(customer)` — shapes Walkthrough UI cards
- `App.computeProjectAttentionScore(p)` — derived score for ordering
- `Forecast.earnedValue(p)` — EVM derivations (BAC, EV, PV, AC, SPI, CPI)
- `App.calculateWsjf(p)` — WSJF / CoD derivations
- `App.computeProjectCost(p)` — cost roll-up for business case
- `App.ragColor(rag)`, `App.customerColor(customer)` — styling
- `App.execSummaryHtml(customer)` — exec narrative paragraph

These are correct architecture: compute at render time, no schema bloat.

---

## C. Friction points & inconsistencies

### C1. Template inconsistency (the headline issue)

| Output | Cover | TOC | Section numbering | Appendix | Branding | Footer | Classification |
|---|---|---|---|---|---|---|---|
| #1 Sponsor Pack | ✓ `buildDoc` | ✓ | ✓ | (opted out) | ✓ | ✓ | ✓ |
| #2 Business Case | ✓ `buildDoc` | ✓ | ✓ | (opted out) | ✓ | ✓ | ✓ |
| #3 Walkthrough Minutes | ✓ `buildDoc` | ✓ | ✓ | (opted out) | ✓ | ✓ | ✓ |
| #4 Sprint Brief | ✓ `buildDoc` | ✓ | ✓ | (opted out) | ✓ | ✓ | ✓ |
| #5 Customer Pack | ✗ **bespoke HTML** | ✗ none | ✗ none | ✗ none | ✗ none | ✗ none | ✗ **missing classification** |
| #6 Portfolio Pack | ✓ `buildDoc` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| #7 Forum Agenda | ✓ `buildDoc` | ✓ | ✓ | (opted out) | ✓ | ✓ | ✓ |
| #8 Status Report | ✗ **bespoke HTML** | ✗ none | ✗ none | ✗ none | ✗ none | ⚠ ad-hoc | ✗ **missing classification** |

**Two anomalies on the list of 8.** The Customer Pack is the worst offender because it's the most likely to be sent externally to a customer — and it has no classification footer ("Confidential", "Internal Use Only"). Status Report is cross-customer and has its own bespoke styling.

### C2. Field rendering inconsistencies

Same data, different presentation across reports.

| Field | Sponsor Pack | Portfolio Pack | Status Report | Walkthrough Minutes | Forum Agenda | Customer Pack |
|---|---|---|---|---|---|---|
| Status | string | row class (red/amber) + string | badge + string | n/a | string | n/a |
| RAG triple | `S=G R=A P=R` | 3 dots via `_ragDot` | 3 dots via inline `ragDot` | from→to delta only | `G/A/R` shorthand | mix counts only |
| Risk score | I × P table | heatmap + table | not shown | from→to delta | top-N list | desc + score in summary |
| Sprint id | `current_sprint` raw | strips `CY\d+-` prefix | strips `CY\d+-` prefix | n/a | n/a | `next_sprint_id` raw |
| Dates | dd MMM yyyy | dd MMM yyyy + days-left | dd MMM yyyy + days-left | ISO | none | "Period to <date>" |
| Currency | n/a | n/a | n/a | n/a | n/a | n/a (only in #2) |

The renderers are reinvented per report. There's no shared `formatStatus(p)`, `formatRag(p)`, `formatSprintId(id)`, `formatRiskScore(r)`, `formatDate(d, style)` library. Six different status formatters live in six different files.

### C3. Trigger-location inconsistency

Where does the user go to export a report?

| Report | Triggered from |
|---|---|
| Sponsor Pack | DetailPanel banner button |
| Business Case | DetailPanel banner button |
| Walkthrough Minutes | Walkthrough top bar |
| Sprint Brief | Capacity view + Walkthrough right-rail "Open pack" picker |
| Customer Pack | Walkthrough right-rail "Open pack" picker |
| Portfolio Pack | Governance view (after relocation), Cmd+K |
| Forum Agenda | Governance view, Walkthrough → forum action |
| Status Report | Governance view (after relocation), Cmd+K |

There's no **single Reports/Exports surface** where a user can see "what can I generate?" — instead, you have to know where each report's button lives. The Walkthrough right-rail "Open pack" picker is the closest thing, but it only offers Customer Pack + Sprint Brief.

### C4. The `minutes_html` snapshot anti-pattern

When a walkthrough is marked Done, `App.completeWalkthrough(id)` calls `Report.buildWalkthroughMinutesDoc(id)` and stores the entire HTML output on `wt.minutes_html`. This field is **never read** by JS — it's exported again on demand by re-calling the builder.

Cost: every completed walkthrough carries ~5–50 KB of HTML in the JSON blob. With the 52-walkthrough cap + archive, that's potentially MB of redundant data in localStorage.

Risk: snapshot vs. canonical drift. If a project's name changes after the walkthrough ends, the stored HTML is stale, but a regenerated minutes doc would have the new name. Which is correct? Both have a case, but the schema doesn't make it explicit.

### C5. The `wt.data_updates` parallel audit log

`walkthrough.data_updates[]` records type/dimension/from/to/rationale for every change made during a walkthrough session. But `App.data.audit_log[]` already records *every* change with `source` and (for walkthroughs) `walkthroughId` in its `meta`. The minutes doc reads `wt.data_updates` — but it could equally read `audit_log.filter(e => e.meta && e.meta.walkthroughId === id)`.

Cost: duplicate writes on every change during a walkthrough (one to `wt.data_updates`, one to `audit_log`).

### C6. The `wt.decisions[]` / `wt.actions[]` parallel registers

When a Decision or Action is captured during a walkthrough:
- It's written to `wt.decisions[]` or `wt.actions[]` (walkthrough-scoped)
- Actions are *also* copied into `forum.actions[]` of the linked governance forum (cross-write)
- Decisions are *not* written to `project.decisions_register[]` even though the IA refactor adds Decisions as a first-class RAID register

This is the silent-drift case: a Decision captured in a walkthrough never surfaces in the project's RAID tab. A future user looking at the project decisions register sees an incomplete history.

### C7. Branding configuration leakage

`Report.configureBranding(customer)` (line 8821 in App.applyCustomer + line 13850 in Cmd+K) is the only path to set per-customer branding. There's no:
- "Preview brand" affordance
- Default brand for the org/portfolio (only per-customer)
- Way to apply the same brand to multiple customers
- Validation that uploaded logos are reasonable size
- Indication when branding falls back to defaults

Low priority but it's the kind of thing that bites at the customer-pack moment.

### C8. No report-output side-effect tracking

There is no "Report X was generated on date Y by user Z" log. The portfolio-pack contains a "Generated <timestamp>" in the cover and appendix, but it's not persisted anywhere. If a sponsor disputes "you sent me X on date Y", there's no record other than the recipient's copy.

Probably out of scope for client-side single-file app, but worth flagging.

---

## D. Three core principles (proposed)

Distilled from the user's three asks (consistency, no schema bloat, consistent data points):

1. **One template, one render path.** Every printable report routes through `Report.buildDoc` (or a successor with the same contract). No more bespoke HTML in `App.exportStatusReport` or `Report.buildCustomerPackDoc`. Same cover, same TOC, same appendix, same branding, same classification.

2. **No schema field exists solely to support a report.** Reports are pure derivations from canonical state + session state + audit log. If a field is *only* ever read by a report builder, it must justify its existence as live state — otherwise delete it and re-derive at report time.

3. **One shared rendering library.** Every report uses the same `formatStatus(p)`, `formatRag(p)`, `formatSprintId(id)`, `formatRiskScore(r)`, `formatDate(d, style)`, `formatCurrency(n, ccy)`, `formatPercent(n)`, `formatPersonChip(name)`. No field gets reformatted differently in two reports.

---

## E. Proposed unification (draft v1)

### E1. Reports gain a first-class namespace

Today `Report` is a single object. Split into:

- `Reports.Doc` — `buildDoc`, `_coverPage`, `_tocPage`, `_appendix`, `_baseStyles`, `_logoHtml`, `open`. The template engine. Unchanged contract, becomes the only path.
- `Reports.Format` — pure formatters: `status(p)`, `rag(p, {style:'dots'|'shorthand'|'verbose'})`, `sprintId(id, {strip:true})`, `riskScore(r)`, `date(d, {style:'short'|'long'|'iso'|'days-left'})`, `currency(n, ccy)`, `percent(n)`, `personChip(name)`, `lifecycleStage(p)`. Used by every doc builder + by Detail panel + Walkthrough where they overlap.
- `Reports.Brand` — `for(customer)`, `set(customer, patch)`, `configureModal(customer)`, `previewModal(customer)`, `defaultsForPortfolio()`.
- `Reports.Catalogue` — the list of available reports + per-report metadata: `id`, `title`, `scope` (`'project'|'customer'|'portfolio'|'walkthrough'|'sprint'|'forum'`), `requiresScopeArg`, `entry(arg)`, `requiresFields` (for readiness check). Used by the new Reports surface (E3).
- `Reports.Builders` — each doc builder: `projectPack`, `businessCase`, `walkthroughMinutes`, `sprintBrief`, `customerPack`, `portfolioPack`, `forumAgenda`, `statusReport`. All return `{title, subtitle, sections, reportType, includeAppendix}` consumed by `Reports.Doc.buildDoc`.

### E2. Bespoke HTML reports get re-templated

- **Customer Pack** rewritten to use `Reports.Doc.buildDoc`. Gains classification footer, branded cover, TOC, appendix.
- **Status Report** rewritten the same way. Gains classification footer (currently has nothing), branded cover, appendix with schema version.

This is purely a refactor — no new functionality, just consistency. Visual diff: cover + footer added, section content unchanged.

### E3. Single Reports/Exports surface

Add a `Reports` view (or panel) accessible from the sidebar + Cmd+K. Renders `Reports.Catalogue` as a grid of cards, grouped by scope:

- **Per-project** — Sponsor Pack, Business Case (requires project selection or active project)
- **Per-customer** — Customer Pack, Portfolio Pack (requires active customer)
- **Per-session** — Walkthrough Minutes (requires walkthrough id), Sprint Brief (requires sprint id)
- **Per-forum** — Meeting Agenda (requires forum id)
- **Cross-customer** — Status Report

Each card: title, one-line description, "Generate" button (or "Pick X to generate" if scope arg needed). When generated, the system logs `App.audit_log` with `field: 'report_generated', meta: {report_type, args}` so we get the "who/when/which" trail (C8).

Detail panel keeps its banner buttons (#1, #2) and Walkthrough keeps its top-bar export (#3) as quick paths for context-specific actions, but they all route through the same catalogue.

### E4. Schema reductions (the no-bloat ask)

These changes delete report-coupled fields and re-derive them at report time.

#### E4.1 Remove `walkthrough.minutes_html` (anti-pattern)

- **Before:** stored on `completeWalkthrough`, never read by JS, ~5–50 KB per walkthrough.
- **After:** delete the field. `Reports.Builders.walkthroughMinutes(walkthroughId)` recomputes from canonical state every time. The "what did the minutes look like when the meeting closed" use case is served by audit-log filtering (every state change has timestamps; we can replay).
- Migration: drop `minutes_html` from existing data; no data loss because the source state is still on the walkthrough record.

#### E4.2 Replace `walkthrough.data_updates[]` with audit-log filtering

- **Before:** every change during a walkthrough writes twice (once to `audit_log`, once to `wt.data_updates`).
- **After:** write once to `audit_log` with `meta.walkthroughId` set. `Reports.Builders.walkthroughMinutes` reads `audit_log.filter(e => e.meta && e.meta.walkthroughId === id)` and renders the same minutes section.
- Migration: drop `wt.data_updates[]` on load; existing entries fold into audit_log (with retroactive walkthrough_id stamp).

#### E4.3 Promote `walkthrough.decisions[]` to `project.decisions_register[]`

- **Before:** Decisions captured during a walkthrough live only on the walkthrough record; never surface in the project's RAID tab.
- **After:** every walkthrough decision is also written to `project.decisions_register[]` with `meta.walkthrough_id` to mark its origin. The walkthrough minutes render the same Decision rows (filtered by `meta.walkthrough_id`).
- Migration: backfill — for every `wt.decisions[]` row with a `project_id`, add a corresponding `project.decisions_register[]` entry. Mark `wt.decisions` deprecated; remove in v2.

#### E4.4 Consolidate `walkthrough.actions[]` ↔ `forum.actions[]`

- **Before:** Actions captured in a walkthrough write to BOTH `wt.actions[]` AND `forum.actions[]` (with `source: 'walkthrough:<id>'`). Drift-prone.
- **After:** single source of truth on `forum.actions[]` (already keyed by `source`). `wt.actions[]` becomes a derived view (filter by `source === 'walkthrough:<wt.id>'`).
- Migration: dedupe — when both registers have the same action, keep the forum copy; drop from `wt.actions`. Walkthrough UI reads forum.actions filtered.

#### E4.5 Promote `walkthrough.section_notes` to walkthrough-scoped audit notes

Open question. Section notes are per-project freeform notes captured during a walkthrough. They're never read again outside minutes. Options:

- (a) Keep as walkthrough-scoped session state; it's genuinely session-only.
- (b) Promote to `project.session_notes[]` with `meta.walkthrough_id` so the notes surface in the Detail panel's History tab too — useful audit trail.
- (c) Convert to Decision register entries (only if the note crosses a "this changed something" threshold; user decides at capture time).

Recommend (b) — promotes audit transparency without changing what gets captured.

#### E4.6 Keep `walkthrough.attendees[]` and `walkthrough.section_status[]`

These ARE genuinely session-only. Attendees ≠ project state; reviewed-status flags ≠ project state. Keep on walkthrough record.

#### E4.7 Keep `narrative.headline`, `narrative.wins`, `narrative.asks`, `narrative.customer_visible_risk_ids`

Already in the IA refactor. `headline` becomes the canonical "PO weekly caption" used on Overview + reports. Wins/asks/customer-visible-risks stay walkthrough/pack-composition only — they don't pollute project state because they're never read outside walkthrough+customer-pack flows. Genuine pack-composition fields are OK if they have one capture surface and never duplicate.

### E5. Field rendering library (Reports.Format)

Single source for every formatted value. Examples:

```
Reports.Format.status(p) →
  { label: 'In Progress', cls: 'pcc-status-in-progress', tone: 'neutral' }

Reports.Format.rag(p, {style: 'dots'}) →
  '<span class="rp-dot rp-green"></span><span class="rp-dot rp-amber"></span><span class="rp-dot rp-red"></span>'

Reports.Format.rag(p, {style: 'shorthand'}) →
  'G/A/R'

Reports.Format.sprintId(id, {strip: true}) →
  'S26' (from 'CY26-S26')

Reports.Format.riskScore(r) →
  { score: 12, cls: 'rp-amber', label: '12 (Medium)' }

Reports.Format.date(d, {style: 'days-left'}) →
  '14d' or '3d overdue'

Reports.Format.currency(amount, 'GBP') →
  '£12,000'
```

Every report (and Detail panel + Walkthrough where they overlap) uses these. No more six different status formatters.

### E6. Audit-trail entry for report generation

Every successful `Reports.*.export*` call appends to `audit_log`:

```
{ ts, field: 'report_generated', meta: { report_type, scope_arg, output_size_bytes? } }
```

Gives forensic record of "Sponsor Pack for project X was generated at time T". No PII leak (we don't log the rendered HTML, just metadata).

### E7. Classification & branding completeness

Every report includes the classification footer from `brand.footerText`. The Customer Pack and Status Report — currently shipping without classification — get it for free once they route through `buildDoc`.

Branding configuration gains:
- `Reports.Brand.defaultsForPortfolio()` — org-level defaults (logo, colour, classification text)
- `Reports.Brand.previewModal(customer)` — preview render before sending

---

## F. Build sequence (proposed)

Independent of the existing 8 phases in the main plan. Sits in a sibling Phase 4.5 (or maps to a new Phase 9).

| Sub-phase | Change | Why |
|---|---|---|
| **R0** | Extract `Reports.Format` formatters and migrate Detail Panel + Walkthrough call-sites in parallel. No new reports, no schema changes. | Pure refactor; rest of the work depends on these. |
| **R1** | Re-template Customer Pack via `Reports.Doc.buildDoc`. | Closes the C1 anomaly. Lowest risk because the data is already prepared via `computeCustomerPackData`. |
| **R2** | Re-template Status Report via `Reports.Doc.buildDoc`. | Same as R1; cross-customer doc gets the same chrome. |
| **R3** | Promote `walkthrough.decisions[]` to `project.decisions_register[]` (E4.3). | Single biggest data-integrity win — decisions never disappear after a walkthrough closes. |
| **R4** | Consolidate `walkthrough.actions[]` → `forum.actions[]` view (E4.4). | Drop the duplicate write. |
| **R5** | Replace `walkthrough.data_updates[]` with audit-log filter (E4.2). | Drop the duplicate audit trail. |
| **R6** | Drop `walkthrough.minutes_html` field, recompute on export (E4.1). | Pure schema reduction. |
| **R7** | Add `Reports.Catalogue` + Reports view + Cmd+K integration. | Single discoverable surface. |
| **R8** | Add audit-log entry on every report generation (E6). | Forensic trail. |
| **R9** | (Optional) Promote `walkthrough.section_notes` to `project.session_notes[]` (E4.5). | Audit transparency. Defer until user tests with (b) approach. |

Each sub-phase is independently shippable and revertable.

---

(Personas — critique below.)

## G. PO critique

1. **Ask:** Customer Pack re-template via `buildDoc` must preserve the per-stage headlines grouping (Idea / Discovery / POC / Build / UAT / Live / Hypercare) as numbered sections in the same order, plus the "We need from you" asks block as its own visible section (not folded into Risks).
   **Why:** Today the Customer Pack is the *only* output sponsors actually read; the lifecycle-stage grouping is how they navigate it ("show me what's at POC"). A generic `sections: [...]` flatten will read like a status report and the asks will drown.
   **Severity:** must

2. **Ask:** Lock down the "What's next" sprint roadmap section in the Customer Pack spec — date range, projects committed to next sprint, named owner. The proposal lists it nowhere in E1/E2.
   **Why:** This is the section sponsors quote back in steering committees. If it disappears in the refactor we lose customer trust in 1 cycle.
   **Severity:** must

3. **Ask:** Visual diff sign-off step before R1 ships — generate today's Customer Pack and tomorrow's `buildDoc`-templated one side-by-side, walk through with PO, confirm every block carries over before deleting the bespoke path.
   **Why:** "Purely a refactor" claims in E2 are how content silently disappears. Two anomalies on a list of 8 became anomalies because nobody held them to a baseline.
   **Severity:** must

4. **Ask:** Decision-history promotion (E4.3) must also lift the *minute-of-decision* (who said yes, who dissented, what was the context) into `project.decisions_register`, not just the bare decision text. Schema: `{ id, decision, rationale, context, decided_by, dissented_by[], walkthrough_id, ts }`.
   **Why:** PO question is never "did we decide X" — it's "did we decide X *and was [stakeholder] in the room*". Lifting only the decision text re-creates the same gap one layer down.
   **Severity:** must

5. **Ask:** Backfill on R3 must surface walkthrough decisions with NO `project_id` (cross-project / portfolio-level decisions captured in a walkthrough) — proposal silently drops these. Land them in a new `customer.decisions_register` or `portfolio.decisions_register`.
   **Why:** Today, sponsor-level decisions ("we'll defer all H2 starts by 4 weeks") get captured in walkthroughs against the customer not a single project. E4.3 as written loses them.
   **Severity:** should

6. **Ask:** PO must be able to edit `narrative.wins / asks / customer_visible_risk_ids` from the Detail panel, not only inside an active walkthrough session. Add an "Edit customer narrative" affordance on Overview > PO weekly caption that opens these three lists in a side-drawer.
   **Why:** Walkthroughs are weekly; customer pack composition often happens mid-week before a sponsor call. Forcing the PO to "start a walkthrough" to fix a typo in an Ask is bad. Walkthrough-only capture in E4.7 is half right.
   **Severity:** must

7. **Ask:** Business Case template (#2) needs cost breakdown (`cost_items[]`: { category, year, amount }), year-by-year cashflow derivation (NPV inputs not just outputs), and a sensitivity stub (`sensitivity_low_gbp`, `sensitivity_high_gbp`). Current `benefit_annual_gbp` + `benefit_horizon_years` produces a single NPV number with no defensibility.
   **Why:** Business Cases get rejected at gate review because they show a number with no working. The current model assumes a flat annuity which finance teams won't sign off.
   **Severity:** must

8. **Ask:** Add `business_case_status` (Draft / In Review / Approved / Rejected / Superseded) + `approved_by` + `approved_date` + `supersedes_business_case_id` to the canonical project schema. Reports should render status prominently.
   **Why:** Without these, "show me the approved business case as of decision date X" is unanswerable. Audit trail on financial commitments matters more than audit trail on RAG.
   **Severity:** must

9. **Ask:** Reports view (E3) is necessary but not sufficient. Add inline "Generate report" entry points on (a) each Project's Detail panel header (already present for Sponsor Pack/Business Case — keep + extend to Customer Pack scoped to active customer), (b) each Walkthrough card (Minutes + Customer Pack), (c) each Forum row in Governance (Agenda).
   **Why:** A central Reports surface helps discoverability for new users; veteran POs export from context. Don't strip the contextual buttons in the name of consolidation.
   **Severity:** must

10. **Ask:** Add a "Last generated" stamp visible on each Report card in the Reports view, reading from the new `audit_log` entry (E6). E.g. "Customer Pack — last generated 2 days ago by you".
    **Why:** Half the PO use of reports is "did I already send this version this week". A discoverable catalogue without "last shipped" forces the PO to remember.
    **Severity:** should

11. **Ask:** Classification footer per-customer (E7) must support a non-default value at the *report-instance* level, not just per-customer default. e.g. "Confidential — Acme Industries Only" for a customer pack, "Internal Use Only" for an internal status report on the same customer.
    **Why:** Same brand, different audience, different classification. A single `brand.footerText` flattens this.
    **Severity:** should

12. **Ask:** Don't drop `walkthrough.minutes_html` (E4.1) without first adding a "minutes as of session close" replay function that reads `audit_log` filtered by `walkthroughId` AND clipped to `walkthrough.completed_at`. Otherwise re-exporting an old walkthrough after the project name changes silently rewrites history.
    **Why:** The snapshot vs canonical drift case in C4 is a real PO concern — a customer disputes "you sent me X on date Y"; re-generated minutes with current names is not evidence. The fix is point-in-time replay, not deletion.
    **Severity:** must

13. **Ask:** Reports.Catalogue must explicitly list, per report, a "Does NOT include" line (e.g. Customer Pack does NOT include internal risk scores). Surface this on the Reports view card.
    **Why:** The single highest-cost mistake in customer comms is sending the wrong audience the wrong report. A visible negation builds confidence faster than a positive description.
    **Severity:** should

14. **Ask:** Migration tests for R3 (decisions promotion) and R6 (minutes_html drop) must replay a real `portfolio-data.json` from before the migration through the migration and assert zero net loss of decision rows and zero net loss of minute content (regenerable from audit_log).
    **Why:** Schema reductions advertised as "no data loss" need to be proven, not asserted. The data engineer should write these tests; the PO must enforce them.
    **Severity:** must

15. **Ask:** Add a "Preview before generate" affordance on every Reports.Catalogue card (one-pane render of cover + TOC + first section, no print). Saves a print-cycle when branding/classification is wrong.
    **Why:** Today the only way to QA a pack is to print-preview it then close. Preview-first reduces the "I sent the wrong logo" failure mode.
    **Severity:** nice

---

## H. SM critique

Lens: Scrum Master / Delivery Lead. I run the 30-min sponsor walkthrough weekly, capture RAID live, export minutes within the hour, chase actions for 6 weeks after. Severity: S1 (red line) / S2 (must-fix pre R-phase) / S3 (nice-to-have).

1. **Ask:** Keep an immutable "minutes-as-sent" snapshot path on `completeWalkthrough`, even after E4.1 removes `minutes_html` from live state. **Why:** "the minutes we showed the sponsor last week" is a compliance artefact, not a render. Replaying from audit-log returns *today's* values, not what the sponsor saw — breaks evidentiary chain when scope disputes hit. **Severity:** S1.
2. **Ask:** Add `walkthrough.exported_minutes[]` ledger — `{ts, sha256, size, exported_by}` — even if we drop the HTML body. **Why:** lightweight "we generated minutes at T" record answers "did you send it?" without re-introducing the 5–50 KB blob. Pairs with E6 audit entry. **Severity:** S2.
3. **Ask:** Confirm `audit_log` retention policy and document it in the plan before R5 ships. **Why:** if audit_log archives past 1000 entries, walkthrough #54+ minutes lose their data_updates source. Either lift the cap for `meta.walkthroughId`-tagged entries, or pin them to a `walkthrough_audit[]` partition. **Severity:** S1.
4. **Ask:** Backfill `audit_log` with `meta.walkthroughId` during R5 migration, not just new writes. **Why:** otherwise minutes for walkthroughs completed *before* R5 render empty "Data updates" sections. Migration must stamp historic entries by joining `wt.data_updates[]` → existing audit rows. **Severity:** S2.
5. **Ask:** Surface a derived "Captured this session" view (`forum.actions` filtered by `source==='walkthrough:<id>'`) in the walkthrough top bar AND in the minutes doc, distinct from the forum's full backlog. **Why:** in-meeting I need "we just captured 4 actions" at a glance, not an 80-row forum table. E4.4's view-only treatment must ship with this affordance. **Severity:** S1.
6. **Ask:** Tag Decisions register entries with `meta.origin: 'walkthrough'|'detail'|'governance'` and add an origin filter on the RAID Decisions table. **Why:** E4.3 promotes every walkthrough decision to `project.decisions_register[]`, which bloats the register with low-value "we discussed deferring X" chatter. Filter-by-origin separates signal from chatter without losing trail. **Severity:** S2.
7. **Ask:** Require `decision_type` at walkthrough quick-add — "Noted" / "Agreed" / "Governance-binding". Only "Agreed"+"Governance-binding" promote to `project.decisions_register[]`; "Noted" stays walkthrough-scoped. **Why:** stops register-bloat at source. SM is gatekeeper, not a downstream filter. **Severity:** S2.
8. **Ask:** Sprint Brief (#4) needs `Reports.Format.memberLoad(member, sprintId)` in R0 — points allocated vs available, holiday-adjusted via `calcSkillCapacityForSprint`. **Why:** member-load formatting is sprint-specific and lives nowhere else. Without it in R0, Sprint Brief reinvents the formatter and per-report drift returns. Lifecycle chip + sprintId-strip are covered; this one isn't. **Severity:** S2.
9. **Ask:** Sprint Brief readiness (E3 `requiresFields`) validates ≥1 allocated skill_split AND sprint not ended. Catalogue card greys out + tooltip otherwise. **Why:** I've watched leads export Sprint Brief for closed sprints and confuse the team next standup. **Severity:** S3.
10. **Ask:** Section notes — pick E4.5 option **(a)** keep walkthrough-scoped, NOT (b) promote to `project.session_notes[]`. **Why:** section notes are stream-of-consciousness during a 4-min-per-project walkthrough — "check with finance", half-sentences. Promoting to project state pollutes every project record. Surface them in History tab via `walkthrough_id` link for transparency; don't persist on the project. **Severity:** S2.
11. **Ask:** Pin display values during an active walkthrough session — no live re-render from canonical state for the 30-min window. **Why:** if minutes regenerate from canonical and a PO edits a project name on their laptop mid-meeting, exported minutes carry the new name though we never showed it. Combine with #1 snapshot for defensibility. **Severity:** S1.
12. **Ask:** Reports view (E3) offers two buttons for Walkthrough Minutes: "Re-export as-of session close" (audit-log replay) and "Re-export current values" (live regen). **Why:** combined with #1+#11 this gives both the legal-defensible record and the follow-up working doc. One report, two modes, no ambiguity. **Severity:** S2.
13. **Ask:** E6 audit-log report-generation entry includes `walkthrough_id` when generated during an active walkthrough (any report type, not just minutes). **Why:** lets me reconstruct "at session close we exported these 3 docs". Without it, E6 records metadata but loses session context. **Severity:** S3.
14. **Ask:** Red line — R3/R4/R5 migrations run on load in <500 ms for a 100-project customer, never block the Walkthrough overlay opening. **Why:** if migration fires synchronously on `loadData` and SM's first click is Walkthrough, a 3-second migration kills the 30-min cadence. Test combined cold-load before shipping R3+R4+R5. **Severity:** S1.
15. **Ask:** Defer R6 (drop `minutes_html`) until R0–R5 have run for 2 weeks of real walkthroughs AND #1's snapshot path is proven. **Why:** `minutes_html` is the only frozen-snapshot escape hatch today. Remove it last. Accept the 5–50 KB cost until then — cheaper than a sponsor dispute we can't answer. **Severity:** S2.

---

## J. UX critique

Lens: senior UX, enterprise doc/pack generation. 13 asks against §3.8 + §6 of the parent IA plan and sections A–F of this audit.

1. **Ask:** Reports view (E3) should be a left-rail destination plus a single "+ Generate report" launcher (Smartsheet/Monday hybrid), not a flat 8-card grid. Group outputs under three scope buckets ("This project / This customer / Cross-portfolio") and surface a Recent list with re-run.
   **Why:** Linear ships nothing; Asana's flat Reports tab dead-ends; Jira buries reports under a never-clicked tab. Eight cards in a grid reads as feature-dump. Bucketed catalogue + recent list = scent + repeat-use affordance.
   **Severity:** High.

2. **Ask:** Add `density: 'compact' | 'standard' | 'full'` to `buildDoc`. Sponsor Pack (1 page) defaults `compact` (no TOC, no appendix; cover collapses to a header band). Portfolio Pack defaults `full`.
   **Why:** Forcing TOC + cover + appendix onto a 1-page brief turns it into 4 pages and sponsors quit at page 1. `includeAppendix` is half the answer; density names the intent.
   **Severity:** High — this is the load-bearing call in E1/E2.

3. **Ask:** Preview-before-Generate on the Reports view path. Render into an iframe overlay with "Print" / "Download PDF" / "Copy link" / "Back to args" buttons. Detail-panel quick-action buttons (#1, #2) skip preview by default to preserve one-click.
   **Why:** Today every export immediately fires `window.print()`. Wrong sprint/customer/forum picked = cancel print, re-find button, retry. 200 ms preview is the standard recovery (Smartsheet, Confluence, Notion).
   **Severity:** High.

4. **Ask:** Classification is per-report at generate time, NOT per-customer. Add `classification: 'Public'|'Internal'|'Confidential'|'Restricted'` to the Generate dialog, seeded from `brand.defaultClassification`, sticky per-report-type.
   **Why:** "Sponsor Pack Confidential, Status Report Internal" is the realistic split. A customer-wide setting forces a wrong default on half the outputs. Sticky per-report default is the compliance-correct pattern.
   **Severity:** High — compliance red line.

5. **Ask:** Surface report-generation history in the Reports view as a Recent list (last 20: who, when, args, "Re-generate") backed by `audit_log`. Mirror inside Detail panel History tab as a "Reports" sub-list.
   **Why:** Purely forensic E6 = invisible to the user. Visible recent-list = forensic + usability win for zero schema cost; "regenerate last week's Sponsor Pack" is the #1 sponsor-meeting need.
   **Severity:** Medium.

6. **Ask:** Replace hard-coded Print + Close with **Download PDF** (primary; html2pdf-style), **Print**, **Copy link** (deep-link back to scope that generated it), **Close**. Skip Email until backend exists.
   **Why:** Print-as-only-export is a 2010 affordance. macOS "Save as PDF" via print dialog is 4 clicks for the primary need. html2pdf ~50 KB turns export into one click. Copy-link is the table-stakes "share this view" affordance.
   **Severity:** Medium.

7. **Ask:** `Reports.Format` exposes **named presets** (`rag.dots`, `rag.shorthand`, `rag.verbose`), not a free options bag. Document them in `CLAUDE.md`. Builders call `Format.rag(p, 'dots')` — no per-call overrides.
   **Why:** Centralised formatting is a consistency win only if the API is closed. "Pass any options" → each builder tweaks options until visuals match its old look → drift returns. Presets force "we need a new preset" upstream.
   **Severity:** Medium.

8. **Ask:** Detail-panel quick-action buttons (Sponsor Pack, Business Case) keep one-click → print. Shift-click opens Preview. Document in tooltip.
   **Why:** The "Sponsor Pack button → PDF in 2 s" flow is sacred. Any UX work that slows it is a regression. Shift-modifier gives power users preview without taxing the common path.
   **Severity:** High — red line.

9. **Ask:** Reports view cards show a readiness indicator ("Status Report: 2 of 5 RAGs missing — Generate anyway / Fix data") driven by `Reports.Catalogue[].requiresFields`.
   **Why:** Eight cards without state is overwhelming. State turns the catalogue from a menu into a queue (blocked vs ready). Same readiness-gate pattern as Detail panel §3.6 — users learn it once.
   **Severity:** Medium.

10. **Ask:** Cover is suppressible per-report-type, not just by density. `coverPage: 'full' | 'header-band' | 'none'` on builder return shape. Sprint Brief defaults to header-band; Customer Pack to full.
    **Why:** Cover-for-everything is the bureaucratic-doc anti-pattern. Internal docs want a band, customer-facing want a cover. One switch, one decision per builder.
    **Severity:** Medium.

11. **Ask:** Classification footer renders with a visual treatment (Confidential = red top+bottom band; Internal = grey band; Public = none). Use `print-color-adjust: exact`.
    **Why:** A small "Confidential" string gets ignored. The visual band is what stops someone forwarding the PDF without thinking. Standard FS/pharma compliance pattern.
    **Severity:** Medium.

12. **Ask:** Sidebar entry sits below Governance, above Configuration. Cmd+K verb: "Generate report…", not "Reports".
    **Why:** Reports are a verb (generate), not a destination (browse). Verb-named Cmd+K matches Linear/Notion patterns and removes "what is this page?" confusion.
    **Severity:** Low.

13. **Ask:** First-run empty state on Reports view shows a "Start with Sponsor Pack" worked example against demo data. No "you have no reports" empty state.
    **Why:** Eight cold options = paralysis. Worked example = scent. Same pattern as Notion's template gallery on a blank workspace.
    **Severity:** Low.

## I. Data engineer critique

Anchored on the three principles I'd actually defend: **idempotent generation, replayable derivations, write/read-model separation**. The section-D triad misses these. Reports must be a pure function of (canonical state, event stream, render-time clock) — anything else is a denormalised snapshot in disguise.

1. **Ask:** Add a 4th principle: *report generation is idempotent and replayable from canonical state + audit_log at any point in time*. **Why:** §D principles 1–3 are about output shape, not data lineage. Without replayability, E4.1 (drop minutes_html) is unsafe — you can't reconstruct what a Nov walkthrough looked like if a project name has since changed. **Severity:** high.
2. **Ask:** Make explicit the read-model vs write-model split. `Reports.Builders.*` are read-model projections over an event log. Document `Reports.Format` + `Reports.Builders` as **derivation layer only, never source of truth**. **Why:** today the line is blurred (minutes_html is a write to canonical state from a render path). Codify it or it'll regrow. **Severity:** high.
3. **Ask:** Block E4.1 (drop `walkthrough.minutes_html`) until **point-in-time replay** is proven. Either keep the snapshot OR introduce a `walkthrough.closed_state_hash` + ability to replay audit_log to that point. Re-deriving from *current* canonical state is a different document from what was signed off. **Severity:** critical — silent semantic change.
4. **Ask:** For E4.2 audit_log filtering — spec what happens when audit_log is truncated/archived. The current code rotates at N entries; older walkthroughs lose their `data_updates` derivation. Need a `walkthrough.audit_snapshot[]` materialised at `completeWalkthrough` time, OR keep audit_log uncapped for entries with `meta.walkthroughId`. **Severity:** critical — spec gap.
5. **Ask:** E4.3 (Decision promotion) — pick one register, not two. `project.decisions_register[]` with `meta.walkthrough_id` (nullable) is the canonical store; `walkthrough.decisions` becomes a derived view via filter. Don't dual-write. Document this as single-table inheritance (one table, discriminator = `origin`). **Severity:** high — dual-write = drift, the very problem you're solving.
6. **Ask:** E4.4 (actions consolidation) — same pattern. One register on `forum.actions[]`, walkthrough view is a filter. Specify the migration's dedupe key explicitly (`source + created_at + title`?); ambiguous dedupe corrupts data. **Severity:** high.
7. **Ask:** Every migration in E4.1–E4.5 needs a **down-migration** + a `schema_version` bump + a rejection path for files newer than supported. Today a v5 file loaded into v4 code silently drops fields. **Severity:** high — data corruption risk.
8. **Ask:** Keep deprecated fields under `legacy_*` for **two** schema versions, not one (§E4.3 says "remove in v2"). One release is not enough for users who only open the app monthly. **Severity:** medium.
9. **Ask:** Rename `audit_log.field` to `audit_log.event_type` and make it a closed vocabulary (`field_change`, `report_generated`, `walkthrough_opened`, `walkthrough_closed`, `migration_applied`). `field` only makes sense for `field_change` events. **Why:** E6 already puts non-field events in there (`report_generated`); the schema is lying. **Severity:** medium.
10. **Ask:** Split `audit_log` into two streams: `audit_log` (state changes, replayable) and `app_events` (report generations, view loads, exports — operational telemetry). Mixing them makes both jobs harder — replay has to skip non-state events; analytics has to skip state noise. **Severity:** medium.
11. **Ask:** `Reports.Format` is **view layer**, not data model. Place it adjacent to `DetailPanel` / `Walkthrough` render code, NOT inside the `Reports` namespace alone — Detail panel & Walkthrough must call the same formatters (per §C2). Naming should reflect this: `Format.*` at top level, used by both `Reports.Builders` and panel renderers. **Severity:** medium.
12. **Ask:** Branding (E7) needs a 3-tier resolution: `settings.branding.portfolio_default` → `settings.branding[customer]` → hardcoded fallback. Document the merge as a deep-merge (not a replace) so a customer override of only `primaryColor` still inherits the portfolio logo. **Severity:** medium.
13. **Ask:** Branding writes need an audit_log entry (`event_type: 'branding_updated'`). Today, customer pack appearance can change with no trace. **Severity:** low.
14. **Ask:** E4.5 (section_notes promotion) — option (b) creates a new register `project.session_notes[]` with no defined size cap. Cap it (e.g. last 200 per project) with rollover into archive; otherwise it grows unboundedly in localStorage. **Severity:** medium.
15. **Ask:** Red line — never delete a field from a loaded portfolio JSON without writing it back as `legacy_<name>` first, AND emitting a `migration_applied` audit_log entry. Current migration runner silently mutates `App.data`. A migration with a bug = unrecoverable user data unless the user kept their JSON. **Severity:** critical.

---

## K. Reconciliation (v2)

Resolves every red line and must-fix from sections G–J. Severity convention: 🔴 critical / 🟠 must / 🟡 should.

### K1. Four principles (replaces section D)

1. **One template, one render path.** Every printable doc routes through `Reports.Doc.buildDoc`. No bespoke HTML in any builder.
2. **No schema field exists solely to support a report.** With one named exception: **immutable compliance snapshots** (see K3.1). Reports are derivations from canonical state + event stream + clock.
3. **One shared formatter library** — top-level `Format.*` namespace called by Reports.Builders, DetailPanel, AND Walkthrough. Named presets only, no options bag.
4. **Report generation is idempotent and replayable.** Any report can be regenerated at any time from `{canonical state, audit_log + archive, render clock}`. Where regeneration would silently rewrite history (signed-off documents), a frozen snapshot is captured at sign-off time. *(DataEng I#1, I#2)*

### K2. The minutes_html resolution — both modes, one report

The proposal to drop `walkthrough.minutes_html` (old E4.1) was a red line for PO/SM/DataEng. **Reversed: keep it, but recast its purpose.**

| Mode | Source | When used | UI label |
|---|---|---|---|
| **As-sent** (immutable snapshot) | `walkthrough.minutes_html` written ONCE at `completeWalkthrough` | Compliance, audit, "what did the sponsor actually see" | "Re-export as-sent" |
| **Current values** (live derivation) | `Reports.Builders.walkthroughMinutes(id)` over canonical state + audit_log clipped to `completed_at` | Follow-up working doc, post-meeting updates | "Re-export current values" |

Both modes are surfaced as two buttons in the Reports view and in the walkthrough top bar. *(SM H#1, H#12 / PO G#12 / DataEng I#3)*

`minutes_html` is documented as an **immutable compliance artifact** — written once on `completeWalkthrough`, never overwritten, never regenerated. The exception under principle K1.2. Schema gains `walkthrough.minutes_sha256` + `walkthrough.minutes_size_bytes` so the integrity of the stored blob can be verified.

### K3. Audit-log strategy

#### K3.1 Closed event-type vocabulary

Add `event_type` field to audit_log alongside legacy `field`. Closed vocabulary: `field_change`, `report_generated`, `walkthrough_opened`, `walkthrough_closed`, `branding_updated`, `migration_applied`, `report_snapshot_taken`. Legacy `field` remains populated only when `event_type === 'field_change'`. *(DataEng I#9)*

We do NOT split into two streams (`audit_log` vs `app_events`) in this iteration — single stream with `event_type` filter is enough. Reserve the split for a future iteration if telemetry volume warrants. *(DataEng I#10 deferred, documented)*

#### K3.2 Walkthrough audit-snapshot materialisation

On `completeWalkthrough(id)`:
- Materialise `walkthrough.audit_snapshot[]` — the slice of `audit_log` entries with `meta.walkthroughId === id` that exist at session-close time.
- Materialise `walkthrough.minutes_html` (as today) — also immutable.

`walkthrough.audit_snapshot[]` is the input for "current values" mode (K2) when audit_log has since archived old entries. *(DataEng I#4 + SM H#3, H#4)*

R5's audit-log filter approach becomes: query union of `audit_log` + `walkthrough.audit_snapshot` (for completed walkthroughs) + `audit_log_archive`. No data loss after rotation.

#### K3.3 Branding audit

Every `Reports.Brand.set(customer, patch)` emits an audit_log entry with `event_type: 'branding_updated'`, `meta: { customer, patch_keys, prev_values_hash }`. No silent brand-drift. *(DataEng I#13)*

### K4. Single canonical store per register (no dual-writes)

#### K4.1 Decisions

- **Canonical store:** `project.decisions_register[]` for project-scoped decisions; **new** `customer.decisions_register[]` for cross-project / portfolio-level decisions captured in walkthroughs against the customer rather than a single project. *(PO G#5)*
- **Schema:** `{ id, decision, rationale, context, decided_by, dissented_by[], decision_type, walkthrough_id, forum_id, project_id, customer, ts, meta: { origin } }` where `decision_type ∈ {'Noted', 'Agreed', 'Governance-binding'}` and `origin ∈ {'detail', 'walkthrough', 'governance'}`. *(PO G#4 + SM H#6, H#7)*
- **Promotion rule:** at walkthrough quick-add, the user picks `decision_type`. Only `Agreed` and `Governance-binding` write to the canonical register; `Noted` stays walkthrough-scoped (filterable view). *(SM H#7 — register-bloat gatekeeping)*
- **Walkthrough view** = filter the canonical register by `meta.walkthrough_id === <id>`. `walkthrough.decisions[]` is removed as a stored field; replaced by the filtered view at render time.
- **Migration:** existing `walkthrough.decisions[]` rows backfill into the canonical register. Rows with no `project_id` AND a customer-level scope land in `customer.decisions_register[]`. Stamped with `meta.origin = 'walkthrough'`. Legacy field renamed `legacy_decisions[]` and retained for **2 schema versions**. *(DataEng I#8)*

#### K4.2 Actions

- **Canonical store:** `forum.actions[]` (already exists). `source: 'walkthrough:<id>'` already tags walkthrough origins.
- **Walkthrough view** = `forum.actions.filter(a => a.source === 'walkthrough:' + wt.id)` rendered as the "Captured this session" strip in the walkthrough top bar AND in the minutes doc. *(SM H#5)*
- **Migration dedupe key:** `{description, owner, due_date, source}` — composite key. Documented. *(DataEng I#6)*

#### K4.3 Risks

Already canonical on `project.risks_register[]` with `added_by_walkthrough_id`. No change required.

### K5. Migration safety contract

Every schema migration in the Reports work (R0–R9) ships with:

- **`up(data)` and `down(data)` functions** where logically reversible. Up is mandatory; down is best-effort but must be implemented if a field is being deleted. *(DataEng I#7)*
- **`schema_version` bump** on every migration. Format: `{major}.{minor}.{patch}`.
- **Version-rejection on load**: if loaded data has `schema_version` newer than the app's, refuse to mutate and show a clear "This file was saved by a newer version" dialog with a download-snapshot escape hatch. No silent field drop. *(DataEng I#7, I#15)*
- **Legacy retention 2 schema versions**, not 1. *(DataEng I#8)*
- **`migration_applied` audit entry** on every migration run, with before-hash, after-hash, rows-touched count.
- **Never delete a field without writing `legacy_<name>` first.** Red line from DataEng I#15.
- **Migration runs in <500 ms for a 100-project portfolio**, never blocks the Walkthrough overlay. *(SM H#14)* Tested as part of R3/R4/R5 acceptance.
- **R6 defer**: dropping `minutes_html` (K2 reversal) — we KEEP this field; R6 in the original sequence is reframed in K8 as "tighten minutes_html contract", not delete it.

### K6. Customer Pack content preservation

The Customer Pack re-template (R1) is governed by a **visual-diff sign-off step** *(PO G#3)*: generate today's Customer Pack and the `buildDoc`-templated version side-by-side; PO confirms parity before deleting the bespoke path.

Specifically preserved:
- Per-stage lifecycle headlines grouping (Idea / Discovery / POC / Phase-1 Build / Implementation / Run/BAU), each as a numbered section. *(PO G#1)*
- "Wins" block, per-project bullets.
- "We need from you" asks block as its own visible section, NOT folded into Risks. *(PO G#1)*
- "Risks we're managing" block (uses `narrative.customer_visible_risk_ids` to filter).
- "What's next" sprint roadmap section — date range, projects committed to next sprint, named owner. *(PO G#2)*

The `buildDoc` `density` switch (K7) defaults Customer Pack to `'full'` with full cover, full TOC, full appendix.

### K7. Document template controls

`Reports.Doc.buildDoc` accepts:

| Option | Values | Default behaviour |
|---|---|---|
| `density` | `'compact'` \| `'standard'` \| `'full'` | Sponsor Pack `compact`; Sprint Brief `compact`; Forum Agenda `standard`; Customer Pack `full`; Portfolio Pack `full`; Status Report `full`; Business Case `standard` |
| `coverPage` | `'full'` \| `'header-band'` \| `'none'` | Compact density → `header-band`; full density → `full`; standard → `full` |
| `tocPage` | `boolean` | Compact → off; standard/full → on if ≥ 3 sections |
| `includeAppendix` | `boolean` | Compact → off; standard → off; full → on |
| `classification` | `'Public'` \| `'Internal'` \| `'Confidential'` \| `'Restricted'` | Sponsor/Customer Pack → `Confidential`; Status Report → `Internal`; chosen at generate-time, sticky last-choice per report-type. *(UX J#4, J#11)* |

Classification renders as a visual band (top + bottom) on every page, colour-coded: `Confidential` red, `Restricted` purple, `Internal` grey, `Public` none. Uses `print-color-adjust: exact` for print fidelity. *(UX J#11)*

### K8. Reports module structure (replaces E1)

| Namespace | Responsibility |
|---|---|
| `Reports.Doc` | Template engine. `buildDoc({...})`, `_coverPage`, `_tocPage`, `_appendix`, `_baseStyles`. Returns HTML string. |
| `Reports.Builders` | Per-report builders. Each returns `{title, subtitle, sections, density, coverPage, classification, reportType}` consumed by `Reports.Doc.buildDoc`. **Read-only over canonical state + audit_log + Format.** *(DataEng I#2)* |
| `Reports.Brand` | `for(customer)` (3-tier deep-merge: portfolio → customer → hardcoded), `set(...)`, `configureModal(...)`, `previewModal(...)`, `defaultsForPortfolio()`. *(DataEng I#12)* |
| `Reports.Catalogue` | Metadata-only list of available reports — `{id, title, description, scope, requiresFields[], requiresScopeArg, defaultClassification, doesNotInclude}`. Drives the Reports view. *(PO G#13)* |
| `Reports.View` | The new sidebar view — bucketed catalogue + Recent list + Preview overlay. *(UX J#1, J#13)* |
| `Format` (top-level) | Named-preset formatters: `Format.statusBadge(p)`, `Format.ragDots(p)`, `Format.ragShorthand(p)`, `Format.ragVerbose(p)`, `Format.sprintId(id)`, `Format.riskScore(r)`, `Format.dateShort(d)`, `Format.dateDaysLeft(d)`, `Format.currency(n, ccy)`, `Format.percent(n)`, `Format.personChip(name)`, `Format.lifecycleStage(p)`, `Format.memberLoad(member, sprintId)`. **No options bag** — callers pick a preset. Used by DetailPanel + Walkthrough + Reports.Builders. *(UX J#7 + DataEng I#11 + SM H#8)* |

### K9. Reports view UX

- **Sidebar entry** below Governance, above Configuration. Cmd+K verb: `"Generate report…"`. *(UX J#12)*
- **Bucketed grid**: This project / This customer / Cross-portfolio. Each bucket lists the reports in scope. *(UX J#1)*
- **Recent list** (right rail or below the grid): last 20 generated reports, with "Re-generate" affordance. Backed by `audit_log` filtered by `event_type: 'report_generated'`. Mirrored as a "Reports" sub-list inside Detail Panel History tab. *(UX J#5 + PO G#10)*
- **Per-card metadata**: title, one-line description, scope-arg picker if needed, **"Last generated" stamp**, **readiness state** (matches §3.6 readiness-gate pattern — greyed-out + tooltip when required fields missing), **"Does NOT include"** line (e.g. "Customer Pack does NOT include internal risk scores"). *(PO G#10, G#13 + UX J#9)*
- **First-run empty state**: worked example against demo data ("Start with Sponsor Pack"). *(UX J#13)*
- **Preview overlay**: iframe render of cover + TOC + first section. Buttons: "Download PDF" / "Print" / "Copy link" / "Back to args". Always-on path from Reports view; quick-action buttons in Detail Panel and Walkthrough top bar remain one-click; **Shift-click on a quick-action opens preview instead**. *(UX J#3, J#6, J#8)*
- **Classification picker** in Preview overlay, seeded from per-report sticky default. *(UX J#4)*

### K10. Mid-week narrative edit (no walkthrough required)

PO can edit `narrative.wins / asks / customer_visible_risk_ids` from the Detail panel's Overview tab — opens an "Edit customer narrative" side-drawer that shows the same three lists the Walkthrough right-rail exposes. Same fields, same canonical store; just a second editing surface. *(PO G#6)*

This is the missing piece in §3.8.3 of the parent plan — wins/asks/customer-visible-risks are no longer walkthrough-only-editable. They're walkthrough-only-defaulting-captured but always-editable.

### K11. Business Case schema expansion

Replace the current single-flat `benefit_annual_gbp + benefit_horizon_years` model with a richer canonical structure:

```
project.business_case = {
  cost_items[]: [{ id, category, year, amount, currency }],
  benefit_items[]: [{ id, type: 'cashable'|'non-cashable'|'avoidance', year_from, year_to, annual_amount, currency, ramp_curve? }],
  assumptions[]: [{ id, text, sensitivity_low_gbp?, sensitivity_high_gbp? }],
  discount_rate,           // override of settings.business_case_discount_rate
  status: 'Draft'|'In Review'|'Approved'|'Rejected'|'Superseded',
  approved_by, approved_at, approval_meeting_id?,
  version,                 // monotonic int
  supersedes_business_case_id?,
  legacy_benefit_annual_gbp?, legacy_benefit_horizon_years?    // back-compat shim
}
```

Business Case report renders status prominently, shows year-by-year cashflow table, derives NPV with working shown, surfaces sensitivity envelope. *(PO G#7, G#8)*

Migration: `benefit_annual_gbp + benefit_horizon_years` lift into a single `benefit_items[0]` row with `type: 'cashable'`, `year_from: now`, `year_to: now + horizon`, `annual_amount: <legacy>`. Legacy fields retained as `legacy_*` per K5.

### K12. Section notes — keep walkthrough-scoped (SM wins)

Reverses old E4.5 option (b). Keep `walkthrough.section_notes` as walkthrough-scoped session state. Surface in Detail panel History tab via the walkthrough_id link (read-only reference), but do NOT promote to `project.session_notes[]`. *(SM H#10 over PO silence — SM owns the workflow that captures these)*

### K13. Sprint Brief readiness + memberLoad formatter

- `Format.memberLoad(member, sprintId)` is in the R0 R0 formatter library — points allocated vs available, holiday-adjusted via `calcSkillCapacityForSprint`. *(SM H#8)*
- Sprint Brief readiness validates `≥1 allocated skill_split AND sprint not ended`. Catalogue card greys out + tooltip otherwise. *(SM H#9)*

### K14. Test coverage (replaces / extends §6 of parent plan)

- **Migration replays**: take a real `portfolio-data.json` from pre-Reports-work, run every R-phase migration end-to-end, assert: zero decision rows lost, zero minutes content lost (regenerable from audit_log + minutes_html for completed walkthroughs), zero risk rows lost, business case values preserved or lifted into new shape. *(PO G#14)*
- **Walkthrough overlay cold-load <500 ms** after R3+R4+R5 migrations on a 100-project, 52-walkthrough fixture. *(SM H#14)*
- **as-sent vs current-values minutes parity**: for a fresh walkthrough closed today, both modes produce byte-identical output. Diverge only after canonical state changes. *(K2)*
- **Down-migration round-trip**: every up() must round-trip through down()+up() with no semantic change for fixtures the app supports.
- **Classification band print fidelity**: snapshot test against Chromium headless print.
- **Format library**: every preset has a unit test with at least 3 inputs (happy path, empty/null, edge case).

### K15. Updated build sequence (replaces section F)

| Phase | What | Depends on | Risk |
|---|---|---|---|
| **R0** | Top-level `Format.*` library with named presets. Migrate DetailPanel + Walkthrough + existing Report.* call-sites to use it. No schema change. | nothing | low |
| **R1** | Reports namespace skeleton: `Reports.Doc` (today's `Report.buildDoc` + `density`/`coverPage`/`tocPage`/`includeAppendix`/`classification` controls + visual classification band). `Reports.Brand` (3-tier deep-merge + branding audit log). `Reports.Catalogue` (metadata). | R0 | low |
| **R2** | Re-template **Customer Pack** via `Reports.Doc.buildDoc`. PO visual-diff sign-off gate. | R1 | medium — content parity |
| **R3** | Re-template **Status Report** via `Reports.Doc.buildDoc`. | R1 | low |
| **R4** | `event_type` field on audit_log + closed vocabulary + back-compat. Branding audit. | R1 | low |
| **R5** | Decisions consolidation: single canonical store with `meta.origin` + `decision_type` + new `customer.decisions_register[]`. Walkthrough view = filter. Migration retains `legacy_decisions` for 2 versions. | R4 | high — schema + data |
| **R6** | Actions consolidation: `forum.actions[]` is canonical, walkthrough view = filter. "Captured this session" strip. | R4 | medium |
| **R7** | Walkthrough audit_snapshot materialisation at `completeWalkthrough`. minutes_html tightened to "immutable compliance snapshot" with sha256/size. R5 audit-log filter approach now safe. | R4 + R5 | medium |
| **R8** | **Reports view** — sidebar entry, bucketed catalogue, Recent list, readiness state, preview overlay, classification picker, "Does NOT include" lines, first-run worked example. Cmd+K verb. | R1 + R4 | medium |
| **R9** | Detail-panel inline narrative editor for wins/asks/customer-visible-risks (K10). Mid-week narrative edit no longer requires a walkthrough. | parent §3.8 + R1 | low |
| **R10** | Business Case schema expansion (K11): cost_items / benefit_items / assumptions / status / approved_by / supersedes_id. New report renders year-by-year cashflow + sensitivity. Migration of legacy fields. | R5 + R7 | high — schema + data |
| **R11** | Audit-log report-generation entries (`event_type: 'report_generated'` + `walkthrough_id` when active). Recent list reads from these. | R4 + R8 | low |

R6 in the original sequence ("drop minutes_html") is gone — replaced by R7 (tighten its contract). All other reductions preserved.

### K16. Out-of-scope (deferred to future iteration)

- Splitting `audit_log` into `audit_log` + `app_events` two streams *(DataEng I#10 deferred)*.
- Email delivery from Print toolbar *(UX J#6 deferred — needs backend)*.
- html2pdf-style direct PDF download — investigation, not commitment, in R8 *(UX J#6 partial)*.

### K17. Persona-mapping summary

Every red line and must-fix in G/H/I/J is resolved above. Mapping:

| Persona ask | Resolution |
|---|---|
| PO G#1, G#2, G#3 (Customer Pack content parity + visual diff sign-off) | K6 |
| PO G#4 (who-with-whom decision) | K4.1 schema |
| PO G#5 (portfolio-level decisions) | K4.1 `customer.decisions_register[]` |
| PO G#6 (mid-week narrative edit) | K10 |
| PO G#7, G#8 (Business Case schema) | K11 |
| PO G#9 (contextual entry points) | K9 — quick-action buttons preserved |
| PO G#10 (Last generated stamp) | K9 |
| PO G#11 (per-report classification) | K7 classification at generate time |
| PO G#12 (minutes drift) | K2 as-sent vs current-values |
| PO G#13 (Does NOT include line) | K9 |
| PO G#14 (migration replay tests) | K14 |
| PO G#15 (preview before generate) | K9 |
| SM H#1, H#11, H#12, H#15 (minutes snapshot defensibility) | K2 + K5 (KEEP minutes_html) |
| SM H#2 (export ledger) | K9 Recent list + K11 R11 audit entries |
| SM H#3, H#4 (audit_log retention + backfill) | K3.2 walkthrough.audit_snapshot |
| SM H#5 (captured this session strip) | K4.2 |
| SM H#6, H#7 (decision origin + decision_type) | K4.1 schema |
| SM H#8, H#9 (Sprint Brief formatter + readiness) | K13 |
| SM H#10 (section notes option a) | K12 |
| SM H#13 (walkthrough_id on report_generated) | K11 R11 |
| SM H#14 (migration <500ms) | K5 + K14 |
| DataEng I#1 (4th principle) | K1.4 |
| DataEng I#2 (read/write split) | K8 Reports.Builders is read-only |
| DataEng I#3, I#4 (replay safety) | K2 + K3.2 |
| DataEng I#5, I#6 (single canonical store) | K4.1, K4.2 |
| DataEng I#7, I#8, I#15 (migration safety) | K5 |
| DataEng I#9, I#10 (event_type) | K3.1 (split deferred) |
| DataEng I#11 (Format placement) | K8 top-level `Format.*` |
| DataEng I#12, I#13 (branding 3-tier + audit) | K8 Reports.Brand + K3.3 |
| DataEng I#14 (section_notes cap) | K12 — kept walkthrough-scoped, no cap needed |
| UX J#1, J#13 (bucketed catalogue + worked example) | K9 |
| UX J#2, J#10 (density + coverPage) | K7 |
| UX J#3, J#8 (preview + quick-action one-click) | K9 |
| UX J#4, J#11 (classification per-report + visual band) | K7 |
| UX J#5 (Recent list visible) | K9 |
| UX J#6 (PDF/Print/Copy/Close) | K9 preview overlay |
| UX J#7 (named presets only) | K8 `Format.*` |
| UX J#9 (readiness state on cards) | K9 |
| UX J#12 (sidebar verb-named) | K9 |

## L. PO sign-off (v2)

| Ask | Status | Note |
|---|---|---|
| G#1 (lifecycle stage grouping + asks block) | ✓ resolved | K6 names per-stage sections and "We need from you" as its own block. |
| G#2 ("What's next" sprint roadmap) | ✓ resolved | K6 explicitly preserves date range, committed projects, named owner. |
| G#3 (visual-diff sign-off before R1 ships) | ✓ resolved | K6 + R2 phase gate names me as the sign-off. |
| G#4 (decision minute: who said yes/dissented) | ✓ resolved | K4.1 schema includes decided_by, dissented_by[], context, rationale. |
| G#5 (cross-project walkthrough decisions) | ✓ resolved | K4.1 adds customer.decisions_register[] with migration rule. |
| G#6 (mid-week narrative edit, no walkthrough) | ✓ resolved | K10 detail-panel side-drawer over same canonical store. |
| G#7 (Business Case cost/cashflow/sensitivity) | ✓ resolved | K11 cost_items/benefit_items/assumptions with sensitivity envelope. |
| G#8 (BC status + approved_by + supersedes) | ✓ resolved | K11 status enum, approved_by/at, supersedes_business_case_id. |
| G#9 (contextual entry points retained) | ⚠ partial | K9 keeps quick-action buttons but Forum-row Agenda entry not explicitly named. |
| G#10 ("Last generated" stamp on cards) | ✓ resolved | K9 per-card "Last generated" + K11 R11 audit_log source. |
| G#11 (per-instance classification, not just default) | ✓ resolved | K7 generate-time picker, sticky last-choice per report-type. |
| G#12 (point-in-time minutes replay) | ✓ resolved | K2 keeps minutes_html as immutable as-sent snapshot. |
| G#13 ("Does NOT include" line per report) | ✓ resolved | K9 per-card field + Reports.Catalogue.doesNotInclude. |
| G#14 (migration replay tests with real data) | ✓ resolved | K14 first bullet covers decisions, minutes, risks, BC. |
| G#15 (preview before generate) | ✓ resolved | K9 preview overlay with cover + TOC + first section. |

**Final verdict: Sign off with conditions.**

Conditions:
1. R8 spec must name the Governance Forum-row "Generate Agenda" button alongside Detail-panel and Walkthrough quick-actions (G#9 completeness).
2. R2 acceptance must list me (PO) by name as the visual-diff sign-off owner, not "a PO" — closes the ambiguity in K6.

---

## M. SM sign-off (v2)

| Ask | Status | Note |
|---|---|---|
| H#1 immutable minutes snapshot | ✓ resolved | K2 reverses delete; `minutes_html` kept immutable, sha256+size added. |
| H#2 exported_minutes ledger | ⚠ partial | K9 Recent list + R11 `report_generated` audit cover "did we send it?"; no dedicated ledger array, acceptable substitute. |
| H#3 audit_log retention policy | ✓ resolved | K3.2 materialises `walkthrough.audit_snapshot[]` at close; rotation can't lose walkthrough rows. |
| H#4 backfill walkthroughId on migration | ⚠ partial | K3.2 covers go-forward snapshotting; explicit historic-row stamping during R4 not spelled out. |
| H#5 "Captured this session" view | ✓ resolved | K4.2 filtered strip in walkthrough top bar AND minutes doc. |
| H#6 origin tag + filter | ✓ resolved | K4.1 schema includes `meta.origin`. |
| H#7 decision_type gatekeeper | ✓ resolved | K4.1 promotion rule — only Agreed/Governance-binding promote. |
| H#8 Format.memberLoad in R0 | ✓ resolved | K8 + K13 + K15 R0 explicitly lists it. |
| H#9 Sprint Brief readiness | ✓ resolved | K13 — ≥1 split AND sprint not ended, grey-out + tooltip. |
| H#10 section notes walkthrough-scoped | ✓ resolved | K12 reverses promotion, keeps walkthrough-scoped. |
| H#11 pin display values mid-session | ⚠ partial | K2 gives as-sent at close; in-session pinning during the 30-min window not explicitly specced. |
| H#12 two re-export modes | ✓ resolved | K2 table — as-sent vs current-values, two buttons. |
| H#13 walkthrough_id on report_generated | ✓ resolved | K15 R11 + K17 mapping confirm. |
| H#14 migration <500ms red line | ✓ resolved | K5 + K14 acceptance on 100-project, 52-walkthrough fixture. |
| H#15 defer R6 drop | ✓ resolved | K15 — original R6 removed; `minutes_html` kept permanently. |

**Final verdict: Sign off with conditions.**

Conditions:
1. H#4 — R4 acceptance must explicitly stamp historic audit_log rows with `meta.walkthroughId` by joining `wt.data_updates[]`, not only snapshot at completeWalkthrough going forward.
2. H#11 — add a one-line spec: during an open walkthrough overlay, the minutes-derivation view pins to canonical state as-of overlay-open (or manual refresh), not live re-render from cross-tab edits.
3. H#2 — document in K9 the sanctioned "did we send minutes?" query (`event_type:report_generated AND reportType:walkthroughMinutes`) so SMs don't reinvent it.

---

## O. UX sign-off (v2)

| Ask | Status | Note |
|---|---|---|
| J#1 bucketed catalogue + Recent | ✓ resolved | K9 — three buckets, Recent list, sidebar destination |
| J#2 density compact/standard/full | ✓ resolved | K7 row 1 — defaults assigned per report-type |
| J#3 preview-before-generate | ✓ resolved | K9 preview overlay with Download/Print/Copy/Back |
| J#4 per-report classification, sticky | ✓ resolved | K7 row 5 — generate-time, sticky per report-type |
| J#5 Recent list visible | ✓ resolved | K9 — last 20, mirrored in Detail History |
| J#6 PDF/Print/Copy/Close | ⚠ partial | K9 has Print + Copy + Back; html2pdf is "investigation" in K16, Email deferred |
| J#7 named presets only, no options bag | ✓ resolved | K8 Format row — "No options bag" explicit |
| J#8 quick-action one-click, Shift=preview | ✓ resolved | K9 preserves one-click; Shift opens preview |
| J#9 readiness state on cards | ✓ resolved | K9 — greyed-out + tooltip via requiresFields |
| J#10 coverPage per builder | ✓ resolved | K7 row 2 — full/header-band/none |
| J#11 classification visual band | ✓ resolved | K7 — red/purple/grey, print-color-adjust: exact |
| J#12 sidebar verb-named, Cmd+K "Generate report" | ✓ resolved | K9 first bullet |
| J#13 first-run worked example | ✓ resolved | K9 — "Start with Sponsor Pack" demo |

**Final verdict: Sign off with conditions.**

Conditions:
1. R8 acceptance must commit or defer html2pdf — "investigation, not commitment" in K16 leaves the primary export ambiguous; print-only is a 2010 affordance.
2. Spec the Copy-link URL shape in K9 — must encode report-id + scope-args + classification so re-open lands on identical Preview state.
3. Recent list "Re-generate" must re-open Preview with original args pre-filled, not silently fire — confirm in R8/R11 acceptance.

---

## N. Data engineer sign-off (v2)

| Ask | Status | Note |
|---|---|---|
| I#1 4th principle (idempotent + replayable) | ✓ resolved | K1.4 codifies it verbatim. |
| I#2 read-model vs write-model split | ✓ resolved | K8 names `Reports.Builders` read-only over canonical + audit_log. |
| I#3 block drop of `minutes_html` until replay proven | ✓ resolved | K2 reverses the drop; kept immutable with sha256/size. |
| I#4 audit_log truncation / walkthrough.audit_snapshot[] | ✓ resolved | K3.2 materialises snapshot at completeWalkthrough; R5 unions with archive. |
| I#5 single canonical decisions register | ✓ resolved | K4.1 single store + filtered view; project + customer scopes. |
| I#6 actions dedupe key | ✓ resolved | K4.2 specifies `{description, owner, due_date, source}` composite. |
| I#7 down-migrations + schema_version + reject newer | ✓ resolved | K5 contract — up/down, version bump, version-rejection dialog. |
| I#8 legacy_* retained for 2 versions | ✓ resolved | K5 explicit; K4.1 applies to legacy_decisions[]. |
| I#9 rename `field` → `event_type` closed vocab | ✓ resolved | K3.1 closed vocabulary; legacy `field` kept for `field_change`. |
| I#10 split audit_log vs app_events | ⚠ partial | Deferred (K3.1, K16) — documented, not done. |
| I#11 Format.* at top level, shared by panel + walkthrough | ✓ resolved | K8 top-level `Format.*`; R0 migrates DetailPanel + Walkthrough call-sites. |
| I#12 branding 3-tier deep-merge | ✓ resolved | K8 Reports.Brand.for(customer) — portfolio → customer → hardcoded. |
| I#13 branding audit entry | ✓ resolved | K3.3 emits `branding_updated` with prev_values_hash. |
| I#14 section_notes size cap | ✓ resolved | K12 reverses promotion — stays walkthrough-scoped, cap moot. |
| I#15 never delete a field; migration_applied entry | ✓ resolved | K5 red line preserved + before/after-hash on migration entry. |

**Final verdict: Sign off with conditions.**

Conditions:
1. K3.1 must spell out the back-compat read path for legacy `field` consumers until R5 lands — otherwise current audit-log filters break on R4.
2. K5 `migration_applied` schema needs explicit `from_version` + `to_version` fields, not just before/after hashes — replay diagnostics depend on it.
3. K16 deferral of I#10 must specify a re-evaluation trigger (e.g. "revisit when audit_log exceeds 10k entries per portfolio") or the deferral rots.

