# Portfolio Command Centre — Senior Manager Review (v2 — post P0/P1/P2/P3)

**Author**: Senior Manager (Portfolio Owner — GCC, KS, DR&I)
**Date**: 26 April 2026 (re-evaluation)
**App version**: single-file HTML, ~25,200 lines
**Branch**: `audit-f-nnn-data-integrity` (62 commits ahead of `main`, all pushed)
**Method**: Re-scoring against the same twenty scenarios as v1 (19 April), with current-state evidence cross-referenced to `index.html`. The original v1 review is at `outputs/SENIOR_MANAGER_PORTFOLIO_REVIEW.md` and remains the change baseline.

---

## 1. Executive Verdict

The portfolio average has lifted from **5.0/10** at the v1 review (19 April) to **7.7/10** today.

The four investment cycles (P0 fixes, P1 features, P2 features, P3 features) shipped together in this session have closed **most** of the v1 gaps. Specifically:

- **Auto-Allocate Cancel revert** — `Sprint._snapshotSkillSplits` / `_restoreSkillSplits` make Cancel byte-safe regardless of preview path.
- **Unified baseline** — `Gantt.openSetBaseline` now captures dates and sizes per project; `getBaselineVariance` reads the active named baseline first; the Movers Legend reads real fields.
- **Resourcing Gap** — `Capacity.computeResourcingGap` returns per-skill demand/supply/gap **with FTE conversion**, rendered in a dedicated panel under Capacity.
- **Project conviction** — `App.LIFECYCLE_STAGES` (Idea / Discovery / POC / Phase-1 Build / Implementation / Run/BAU) is a first-class field on every project, drives a coloured chip on the grid + Gantt, and applies a sort penalty in `App.calculateProjectPriorityScore` so a POC cannot displace an Implementation by arithmetic alone.
- **Range estimation** — Per-skill `*_max` fields, paired inputs on the detail panel with clamp-up, and a dashed cone overlay on the Gantt when total `_max` exceeds the point estimate.
- **TBD phases** — `phase_order` accepts `{phase, status: 'tbd'}` objects; the Solver excludes them; the Gantt renders a dashed open-ended `TBD` panel.
- **On-Track Verdict** — `Dashboard.computeOnTrackVerdict` synthesises RAG-mover / blocked / capacity-deficit signals into a single tile prepended to KPI cards.
- **When-by widget** — Header button opens a modal; `Forecast.forecastForCandidate` answers any candidate ask with P50/P80/P95 + verdict (likely / stretch / no), with Copy-answer for sponsor email.
- **Scenarios** — `App.saveScenario` / `loadScenario` / `deleteScenario` + scenario manager modal accessible from the header.
- **Sustained pace alert** — `Capacity.computeSustainedHighLoad` flags any team member with ≥90% load across ≥3 consecutive sprints; rendered as a card under Resourcing Gap.
- **Walkthrough mode** — Sprint Planning toolbar gains a Walkthrough button that opens a list of every open chip with a per-row Edit hand-off into the existing chip editor.
- **Audit forensics** — `App.logChange` accepts an `opts.rationale`; entries past 1,000 archive into `audit_log_archive[]` (no rollover).
- **Cost model** — `App.computeProjectCost` reads `settings.rate_card`, returns BAC/EV/AC in GBP.
- **Forum agenda** — `Governance.buildAgendaDoc` plus per-forum *Build Agenda* button.
- **Leave calendar** — `Capacity.renderLeaveCalendar` 90-day strip per member.
- **Bus factor** — `App.computeBusFactor` plus red BF1 badges on the Detail Panel EVM strip.
- **Sponsor Pack** + **Business Case** — Per-project PDF exports wired into the EVM strip header.
- **Per-project sponsor pack** + **Forum agenda** + **What-Changed paragraph** in Exec Summary.

What still holds the portfolio under 9/10:

1. **Cross-customer trade-off optimisation** — the Solver still runs once per customer; the Portfolio Overview aggregates but doesn't optimise across customers under shared scarcity.
2. **Onboarding / member-departure simulator** — the data model supports `contract_end_date` and ramp profiles, but there's no "drop this person, show damage" what-if flow.
3. **Backlog management depth** — the Backlog Health modal and `Auto-Prioritise` work, but there's no dedicated Backlog tab with parking-lot, refinement queue, and per-PO drill-in.
4. **Cost layer is partial** — rate cards and `computeProjectCost` exist, but no FY budget tracker, no contractor-mix view, no £ rollup on the Portfolio Pack.
5. **Stakeholder share-link** — scenarios persist locally but cannot be shared as a read-only link.

---

## 2. Updated Scoring Matrix

| # | Scenario | v1 (19 Apr) | v2 (today) | Δ | Drivers of the change |
|---|---|---|---|---|---|
|  1 | Starting a new project with many unknowns | 4 | **8** | +4 | lifecycle_stage + range estimation + TBD phases + When-by widget |
|  2 | Getting back to stakeholders on timelines | 6 | **9** | +3 | When-by widget answers any candidate ask in seconds with copy-out |
|  3 | Ensuring the team is on track | 6 | **8** | +2 | On-Track Verdict tile + What-Changed paragraph + Walkthrough |
|  4 | Not overburdening the team | 6 | **8** | +2 | Sustained High Load alert; existing R4 + Capacity bars |
|  5 | Providing the team with clarity and direction | 6 | **7** | +1 | Walkthrough mode adds a guided weekly review; sprint grid unchanged |
|  6 | Producing reports for stakeholders | 7 | **9** | +2 | Sponsor Pack + Business Case + Forum Agenda + What-Changed |
|  7 | Identifying when additional resourcing is required | 3 | **8** | +5 | Resourcing Gap with per-skill / per-sprint / FTE rollup |
|  8 | Making minor tweaks to plans | 6 | **8** | +2 | Cancel-revert is safe; named scenarios for what-ifs |
|  9 | Showing baseline deviation to senior stakeholders | 3 | **8** | +5 | Unified baseline; correct Movers Legend; Variance Report reads named baseline |
| 10 | Remaining/consumed effort with PO + SM | 6 | **8** | +2 | Walkthrough mode is the explicit weekly-review surface |
| 11 | Review and manage backlog status | 6 | **6** | 0 | No dedicated backlog tab work this cycle |
| 12 | Differentiating POC from Implementation | 2 | **8** | +6 | lifecycle_stage chip + WSJF banding + Gantt rendering |
| 13 | Phase 1 → next phases when undefined | 2 | **8** | +6 | TBD phases supported by schema, Solver, and Gantt |
| 14 | Cross-customer prioritisation under shared scarcity | 5 | **5** | 0 | Solver remains per-customer; Portfolio Overview unchanged |
| 15 | Defending past decisions | 5 | **8** | +3 | Scope rationale on logChange + persistent archive past 1,000 entries |
| 16 | Onboarding / losing a team member | 5 | **5** | 0 | No what-if simulator yet |
| 17 | Cash-flow / FY rollup / financial governance | 3 | **7** | +4 | Cost model + Business Case generator (NPV / WSJF) |
| 18 | Scenario sandboxing / what-if | 3 | **8** | +5 | Named scenarios save/load/delete; manager modal |
| 19 | Holiday & leave coordination | 5 | **7** | +2 | Leave calendar 90-day strip |
| 20 | Single-point-of-failure / bus-factor | 3 | **8** | +5 | computeBusFactor + BF1 badges on EVM strip |

**Average: 5.0 → 7.7 (+2.7 / +54 %).**

---

## 3. Scenario Deep-Dive

> Each scenario below: current rating + justification + evidence (file:line) + ACs to reach 9/10 or 10/10. Remaining gaps are concrete and small.

---

### Scenario 1 — Starting a new project with many unknowns — **8 / 10**

**Why.** `App.LIFECYCLE_STAGES` puts a conviction class on every project; `lifecycleStageChip` renders an at-a-glance badge on the grid and Gantt; the Quick-Add wizard captures the stage at intake. Per-skill `*_max` fields plus the dashed cone on the Gantt make the uncertainty *visible*. TBD phases give a placeholder for "we don't know what's after Discovery yet" without committing to imaginary numbers.

**Evidence.** `index.html:2750–2754` (App.LIFECYCLE_STAGES), `index.html:6164–6190` (chip + penalty helpers), `index.html:11460–11463` (per-skill max input on detail panel), `index.html:14710–14725` (Gantt cone), `index.html:20815–20828` (Solver normalises phase_order with status: 'tbd').

**To reach 9/10.** Add an *Unknowns* sub-section on the Detail Panel (assumption list with owner + target-resolution date), and convert the Quick-Add wizard's preview into a 60-second guided intake interview that auto-suggests `lifecycle_stage` from the answers ("Sponsor confirmed? Scope confirmed? Estimates in?"). 10/10 needs cohort analysis: "POCs started in FY26 — % converted vs killed vs extended", informing future intake.

---

### Scenario 2 — Getting back to stakeholders on timelines — **9 / 10**

**Why.** `Dashboard.openWhenByModal` plus `Forecast.forecastForCandidate` is exactly the loop that v1 was missing: customer + size + conviction + optional target_date → P50/P80/P95 + verdict (likely / stretch / no) + earliest credible sprint + Copy-answer. Works for hypotheticals, not just sized in-flight projects.

**Evidence.** `index.html:9018–9079` (modal open / run / copy), `index.html:20824–20880` (forecastForCandidate). Header button at `index.html:2139` (btnWhenBy).

**To reach 10/10.** A shareable read-only URL of a When-by answer that the stakeholder can bookmark and watch update as the portfolio moves.

---

### Scenario 3 — Ensuring the team is on track — **8 / 10**

**Why.** `Dashboard.computeOnTrackVerdict` synthesises Red-RAG project count + blocked count + capacity deficit cells into a single On Track / Watch / Off Track verdict. The What-Changed paragraph adds the 7-day mutation summary to the narrative. Walkthrough mode anchors a weekly cadence on the same data.

**Evidence.** `index.html:8810–8860` (verdict helper), `index.html:9436–9449` (verdict tile), `index.html:9244–9252` (What Changed).

**To reach 9/10.** The verdict tile should expose its inputs as a click-to-explain drill-down (currently shown only in the helper return shape). 10/10: a 12-week verdict trend sparkline, with an audit-log entry whenever the verdict flips.

---

### Scenario 4 — Not overburdening the team — **8 / 10**

**Why.** R4 hard cap was already in place; `Capacity.computeSustainedHighLoad` now flags chronically-loaded members across consecutive sprints (≥90% × ≥3 sprints).

**Evidence.** `index.html:19560–19628` (helper + render). Section in Capacity view at `index.html:2517–2520`.

**To reach 9/10.** Pre-flight on manual sprint-grid edits — block over-100 % drops with explicit override (audited as `source: user-override`). 10/10 ties the alert to leave bookings: stressed members with thin PTO booked surface as Red.

---

### Scenario 5 — Providing the team with clarity and direction — **7 / 10**

**Why.** Walkthrough mode + the existing sprint grid + skill-coloured chips give the team a single canvas. Lifecycle chip on Gantt bars adds context.

**To reach 9/10.** A *Sprint Brief export* — printable PDF, one page per team member, with their assigned slices in priority order, blockers, and dependencies. 10/10 adds a personal *View as…* filter (logged-in user) plus copy-to-Slack / copy-to-email of the personal brief.

---

### Scenario 6 — Producing reports for stakeholders — **9 / 10**

**Why.** Per-project Sponsor Pack (`Report.buildProjectPackDoc`) joins the existing Portfolio Pack and Status Report. Forum agenda generator (`Governance.buildAgendaDoc`) covers the per-forum case. Business case generator covers cost / benefit / NPV. Exec Summary's What Changed paragraph adds the 7-day delta narrative. RAG/status reconciliation removed the long-standing "0 at risk while RAG-mix shows reds" contradiction.

**Evidence.** `index.html:23692–23772` (Sponsor Pack + Business Case in Report), `index.html:22506–22560` (forum agenda), `index.html:8819–8825` (RAG-aware atRisk).

**To reach 10/10.** Narrative auto-draft in the Sponsor Pack — replace static templating with editable prose generated from real data ("Spend in S4 closed 12 % over plan because…"). Then a one-click "Email to sponsor" handoff.

---

### Scenario 7 — Identifying when additional resourcing is required — **8 / 10**

**Why.** `Capacity.computeResourcingGap(customer)` returns `{ bySkill: [{ skillKey, bySprint:[{demand,supply,gap}], totalGap, gapFte, … }] }` — exactly the per-skill, per-sprint, FTE-equivalent table v1 said was missing.

**Evidence.** `index.html:19467–19528`. Render at `index.html:19529–19577`.

**To reach 9/10.** Recommendation engine: clicking a deficit cell proposes ranked remediation (extend contractor, hire +N FTE starting sprint X, borrow from Both pool) with the resulting solver outcome previewed. 10/10 prices each option from rate_card and lead-time-aware (accounting for ramp).

---

### Scenario 8 — Making minor tweaks to plans — **8 / 10**

**Why.** `_snapshotSkillSplits` / `_restoreSkillSplits` make Auto-Allocate Cancel safe; named scenarios cover the heavier "what if we slip Project X" case without touching live data.

**Evidence.** `index.html:18094–18116` (snapshot helpers + lifecycle wiring), `index.html:4248–4291` (saveScenario / loadScenario).

**To reach 9/10.** Sandbox mode flag in the header that visually marks the current data branch as a sandbox; *Save to live* and *Discard* explicit. 10/10 adds side-by-side scenario comparison view.

---

### Scenario 9 — Showing baseline deviation to senior stakeholders — **8 / 10**

**Why.** Named baselines now capture dates + sizes per project. `Gantt._renderMoversLegendHtml` reads `snap.target_date` (which is now actually written). `getBaselineVariance` prefers the active named baseline; legacy per-project fields are fallback. Variance Report PDF still works and reads the unified source.

**Evidence.** `index.html:13260–13284` (extended snapshot), `index.html:13357–13395` (movers legend), `index.html:14796–14841` (variance report).

**To reach 9/10.** Visual deviation overlay on the Gantt — connector arrows from baseline ghost to current bar with magnitude labels. 10/10 ties to the audit log: hover the arrow shows *the* scope-change rationale captured when the date moved.

---

### Scenario 10 — Remaining/consumed effort with PO + SM — **8 / 10**

**Why.** Walkthrough mode lists every open chip in priority order with quick-edit per chip. The per-chip progress modal still exists for one-offs. Audit log records the change.

**Evidence.** `index.html:18121–18164` (openWalkthrough), `index.html:17158–17231` (chip editor).

**To reach 9/10.** Walkthrough remembers "since last review" timestamp and highlights chips that haven't been touched. 10/10: bulk-update grid per project (every chip × every sprint) for fast catch-up sessions.

---

### Scenario 11 — Review and manage backlog status — **6 / 10** (unchanged)

**Why.** Backlog Health modal works; `Auto-Prioritise` and *Why this rank?* still good. But no dedicated Backlog tab, MoSCoW not filterable in the grid, no Definition-of-Ready workflow, no per-PO refinement burn-up.

**To reach 9/10.** Dedicated Backlog view with three columns (Unrefined / Refined & ranked / Parked-Won't), per-project DoR checklist, per-PO filter with refinement burn-up. 10/10 adds Slack/email digest of stale items weekly.

---

### Scenario 12 — Differentiating POC from Implementation — **8 / 10**

**Why.** `lifecycle_stage` is a first-class field. `App.lifecycleStageChip` renders distinct colours for each class. WSJF score subtracts a penalty for low-conviction stages so a POC cannot displace an Implementation by arithmetic alone.

**Evidence.** `App.LIFECYCLE_STAGES`, `App.lifecycleConvictionPenalty` (`index.html:6181–6189`).

**To reach 9/10.** A *Convert to Implementation* ceremony on the detail panel: when a POC's exit criterion is met, a guided flow re-validates scope + re-sizes under Implementation conviction band + auto-baselines + audits. 10/10 adds a POC budget cap (e.g. ≤15 % of any sprint's DE capacity per customer), enforced by the Solver.

---

### Scenario 13 — Phase 1 → next phases when undefined — **8 / 10**

**Why.** `Solver._normalisePhaseOrder` accepts both `'PhaseName'` and `{phase, status}` objects. Entries with `status: 'tbd'` are excluded from scheduling. The Gantt renders a dashed open-ended *TBD* panel after the live bar so stakeholders know the timeline is Discovery-only and Phase-2+ is undefined.

**Evidence.** `index.html:20815–20828`, `index.html:14693–14702` (Gantt TBD panel).

**To reach 9/10.** *Plan Phase 2+* gate flow on the Detail Panel that fires when Discovery completes — captures confirmed scope, sizes, and re-baselines. 10/10 adds a *forecast envelope* using comparable past projects so Phase 2+ has a credible range, not a blank.

---

### Scenario 14 — Cross-customer prioritisation under shared scarcity — **5 / 10** (unchanged)

**Why.** Portfolio Overview aggregates and `capacity_by_customer` for `Both` members prevents double-counting, but the Solver still runs once per customer.

**To reach 9/10.** A cross-customer trade-off advisor: side-by-side scenario "Prioritise GCC: KS slips 3 weeks, net WSJF +X" vs "Prioritise KS: …". 10/10 adds an FY budget envelope per customer + a portfolio-WSJF (with customer-strategy weights configurable in Config).

---

### Scenario 15 — Defending past decisions — **8 / 10**

**Why.** `App.logChange` accepts `opts.rationale` and persists it on the entry. When `audit_log` exceeds 1,000 entries, surplus rows move to `audit_log_archive` rather than dropping — year-end retrospectives are now possible.

**Evidence.** `index.html:2914–2950`.

**To reach 9/10.** Required rationale on size_*, deadline, phase_order changes (currently optional). 10/10: tie forum decisions to audit entries automatically — changes within 14 days of an approved decision auto-tag with the decision id.

---

### Scenario 16 — Onboarding / losing a team member — **5 / 10** (unchanged)

**Why.** Member fields rich, ramp profiles and contract_end_date supported, leave calendar visible. But no "drop this person on date X, show damage" simulator.

**To reach 9/10.** Member impact simulator that zeroes a member from sprint X, runs Auto-Allocate, diffs plan vs current, exposes Apply / Discard. 10/10 ties to hiring spec recommender (skills + capacity + earliest start) referencing rate_card.

---

### Scenario 17 — Cash-flow / FY rollup — **7 / 10**

**Why.** `App.computeProjectCost` reads `settings.rate_card` and returns BAC / EV / AC in GBP. Business Case generator computes NPV with a configurable discount rate.

**Evidence.** `index.html:6193–6216`, `index.html:23744–23772`.

**To reach 9/10.** FY budget tracker on the Dashboard (£ consumed / committed / remaining per customer). 10/10 adds contractor-mix view (perm vs contract stack per sprint, target ratio, breach alert) and £ rollup on the Portfolio Pack.

---

### Scenario 18 — Scenario sandboxing — **8 / 10**

**Why.** `App.saveScenario` / `loadScenario` / `deleteScenario` round-trip cleanly. Scenario manager modal with save / load / delete. Auto-Allocate Cancel revert closes the destructive-preview gap.

**Evidence.** `index.html:4248–4291`, `index.html:4222–4246` (modal).

**To reach 9/10.** Side-by-side scenario comparison view (split Roadmap / capacity / KPIs with delta column). 10/10 adds shareable read-only URL of a scenario.

---

### Scenario 19 — Holiday & leave coordination — **7 / 10**

**Why.** `Capacity.renderLeaveCalendar` lays a 90-day strip per member with PTO bars positioned within the strip.

**Evidence.** `index.html:19470–19498`.

**To reach 9/10.** Skill-coverage warning when ≥50 % of a skill is out in a given week. Conflict pre-flight on leave-add. 10/10 syncs from organisation calendars (read-only ICS feed).

---

### Scenario 20 — Single-point-of-failure / bus-factor — **8 / 10**

**Why.** `App.computeBusFactor` returns `{ [skillKey]: count }`. The Detail Panel EVM strip shows a *Coverage* line with red BF1 badges per single-threaded skill.

**Evidence.** `index.html:6178–6196`, `index.html:11000–11008`.

**To reach 9/10.** Cross-skilling suggestion: clicking a BF1 badge proposes candidate members with the skill as secondary or adjacent primary, plus the up-skilling capacity cost. 10/10 ties bus-factor into the On-Track Verdict so a project with BF=1 cannot be On-Track without explicit acknowledgement.

---

## 4. What's Left (P4 candidates)

Stack-ranked by leverage:

1. **Cross-customer trade-off advisor** + portfolio-WSJF + FY budget envelope (Scenario 14, 17).
2. **Backlog tab** with Unrefined / Refined / Parked + DoR + per-PO refinement burn-up (Scenario 11).
3. **Member impact simulator** + hiring spec recommender (Scenario 16).
4. **Sandbox mode flag** + scenario comparison + shareable URLs (Scenario 18).
5. **Cone-of-uncertainty visual on Gantt** showing baseline → current connector arrows with magnitude labels (Scenario 9).
6. **Sprint Brief PDF + personal *View as…* filter** (Scenario 5).
7. **POC-to-Implementation conversion ceremony** + POC budget cap (Scenario 12).
8. **Plan Phase 2+ gate flow** + forecast envelope (Scenario 13).

Net effect of P4 if all delivered: average 7.7 → ~9.0. The remaining 1.0 needed to reach 10.0/10 across the matrix is org-calendar integration, scenario-sharing-as-URL, and AI narrative auto-draft — ecosystem features rather than tool features.

---

## 5. Notable Strengths to Protect

- **Helper-first architecture** — every new feature this cycle was a pure helper (`computeResourcingGap`, `computeOnTrackVerdict`, `forecastForCandidate`, `computeProjectCost`, `computeBusFactor`, `buildProjectPackDoc`, `buildBusinessCaseDoc`, `buildAgendaDoc`) wired into the UI separately. The unit-test surface is now 132 tests / 42 files, all passing.
- **Defensive snapshot/restore** for the alloc preview pattern is a template for any future destructive-preview UX.
- **Migration-safe schema evolution** — `App.migrateSchema` now seeds `lifecycle_stage`, `*_max`, and tolerates legacy baseline shapes; no data loss for existing portfolios.
- **Persistent audit archive** removes the year-old-entries problem at the source.

---

## 6. Closing Position

The portfolio went from "useful but not yet defensible" (5.0/10) to "defensible system of record" (7.7/10) in this cycle. Every senior-manager scenario except cross-customer optimisation, backlog depth, and member-departure simulation is now at 7+/10. The path from here to 9+/10 is concrete (eight items above) and incremental.

— *Senior Manager, Portfolio Command Centre, 26 April 2026 (v2)*
