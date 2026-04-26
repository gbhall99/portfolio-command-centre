# Portfolio Command Centre — Senior Manager Review

**Author**: Senior Manager (Portfolio Owner — GCC, KS, DR&I)
**Date**: 26 April 2026
**App version**: single-file HTML, ~24,057 lines
**Branch**: `audit-f-nnn-data-integrity`
**Method**: First-person evaluation against twenty operating scenarios. Evidence cross-referenced to `index.html` line numbers, `SOLVER.md`, the prior `USABILITY_TEST_REPORT.md` (19 Apr 2026), and four parallel codebase audits run today.
**Scoring rubric (1–10)**: weighted blend of *ease of use*, *time saved*, *simplicity*, *accuracy*, *quality of output*. 10 = removes the work; 9 = I do < 10% of what I used to and trust the answer; 7–8 = useful, has rough edges; 5–6 = surface only — workflow falls apart at the seams; 3–4 = visible feature, unreliable for real work; 1–2 = harmful or absent.

---

## 1. Executive Verdict

This tool is closer to "useful" than to "indispensable", and the gap between those two states is well-defined.

The reporting layer is sponsor-ready: the **Portfolio Pack** (`Report.exportPortfolioPack`, line 23405) and **Status Report** (`App.exportStatusReport`, line 4432) both produce branded, printable, narrative-led PDFs with EVM roll-ups, milestones, risk severity matrices, and governance summaries. The **Roadmap/Gantt** is the most polished surface in the app — week zoom, critical path, deadline pins, dependency edges, per-skill segmentation, executive-mode collapse, FY/today annotations. The **Solver** is a serious piece of engineering with eleven warning types, a per-person hard cap, holiday/ramp/override-aware capacity, and assignee-aware slices (R10 — `assigned_to: [{ member, points }]`, line 19115–19127, 19542–19543). Per-person allocation, which the prior usability test flagged as the single largest failure mode of the app, is **fixed**.

But three structural gaps still hold the portfolio back from being decision-ready:

1. **Baselines work in two disconnected places.** Named baselines persist (`App.data.baselines[]`, line 13278), but the Variance Report (line 14798) reads `baseline_start / baseline_end` set per-project via Detail Panel (line 10737), and the Movers Legend on the Roadmap reads `snap.target_date` which is never written into the snapshot (line 13357). When I want to show a steerco "we said end of June, we now say end of July" with a single overlay, I cannot do so without manually re-baselining every project.

2. **The model has no concept of conviction.** Every project is treated as a single-point committed estimate. There is no POC flag, no investment stage, no estimate range, no confidence interval. A "we'd like to explore this — could be 20 to 80 SP" idea is indistinguishable in WSJF and the solver from a "we've signed the SoW, this is 35 SP" delivery. This is the difference between a portfolio tool and a project tool.

3. **The capacity story stops at "we won't fit"; it never reaches "and here is what you need to fix it".** The solver tells me a deadline will miss; it does not tell me "you need +12 SP/sprint of Data Engineering for sprints 4–7, equivalent to 0.6 FTE". I cannot walk into a hiring conversation with a number from this app.

A focused investment cycle on (1) baselines unification, (2) project conviction model (POC + ranges + phase deferral), and (3) a resourcing-gap report would lift the portfolio average from **5.0/10 today** to a credible **8+/10**. The component machinery is largely in place. What is missing are the seams that connect them into a senior-manager workflow.

---

## 2. Scoring Matrix

| # | Scenario | Score | Verdict |
|---|---|---|---|
|  1 | Starting a new project with many unknowns | **4/10** | Wizard exists, but no conviction model, no ranges, no phase deferral. |
|  2 | Getting back to stakeholders on timelines | **6/10** | Roadmap is strong; forecasting only works on in-flight, sized projects. |
|  3 | Ensuring the team is on track | **6/10** | Capacity, EVM, audit feed all there — but no narrative "are we on track?" verdict. |
|  4 | Not overburdening the team | **6/10** | R4 hard cap protects mechanically; no proactive "this person has been hot for 3 sprints" alert. |
|  5 | Providing the team with clarity and direction | **6/10** | Sprint grid is dense and usable; no team-brief export, no per-person view. |
|  6 | Producing reports for stakeholders | **7/10** | Portfolio Pack and Status Report are good. Per-project sponsor pack and forum agenda missing. |
|  7 | Identifying when additional resourcing is needed | **3/10** | "Won't fit" is signalled; "you need +N SP of skill X" is not. |
|  8 | Making minor tweaks to plans | **6/10** | Drag/drop, bulk edit, undo all work — but Auto-Allocate Cancel STILL does not revert. |
|  9 | Showing baseline deviation to senior stakeholders | **3/10** | Two disconnected baseline mechanisms; movers legend is dead code. |
| 10 | Remaining/consumed effort with PO + SM | **6/10** | Per-chip progress edit works; no bulk update; no team-driven walkthrough mode. |
| 11 | Review and manage backlog status | **6/10** | Backlog Health modal good; no dedicated tab; MoSCoW not filterable in grid. |
| 12 | Differentiating POC from implementation | **2/10** | Not modelled at all. POC and SoW work treated identically. |
| 13 | Phase 1 → next phases when undefined | **2/10** | Phase order is fixed at create-time; no placeholder/deferral concept. |
| 14 | Cross-customer prioritisation under shared scarcity | **5/10** | Portfolio Overview aggregates; solver does not optimise cross-customer trade-offs. |
| 15 | Defending past decisions ("why did we do that?") | **5/10** | Audit log capped at 1000 entries; no scope-change rationale capture. |
| 16 | Onboarding / losing a team member | **5/10** | Member fields rich; no "drop this person, show damage" simulation. |
| 17 | Cash-flow / FY rollup / financial governance | **3/10** | No cost model, no rate card, no contractor-mix view. |
| 18 | Scenario sandboxing / what-if | **3/10** | Edits hit live data; no isolated sandbox; preview-cancel is destructive. |
| 19 | Holiday & leave coordination | **5/10** | Capacity is holiday-aware; no team-wide leave calendar / conflict alerts. |
| 20 | Key-person / single-point-of-failure detection | **3/10** | No bus-factor metric, no "only X can do this skill" alert. |

**Portfolio average: 5.0 / 10.**

---

## 3. Scenario Deep-Dive

> Every scenario below: rating + justification + evidence + the requirements & acceptance criteria (BDD-style) needed to reach 9/10. Where 10/10 needs more than 9/10, I call it out.

---

### Scenario 1 — Starting a new project with many unknowns

**Rating: 4 / 10**

**Why this rating.** The Quick-Add wizard (`DetailPanel._openQuickAddWizard`, line 12765) is competent: name, customer, template picker, total SP, choice of priority-driven vs hard-date scheduling, a *Preview Scenarios* button (line 12828). For a project with knowns it's fast — under a minute. But for a project with *unknowns* the model has nowhere to put the unknowns. Sizing is forced into single-integer skill fields (`size_requirements`, `size_engineering`, `size_data_science`, `size_tableau`, `size_uat_adoption`, line 12711–12712). Phases come from a template (line 12720) — once chosen they're committed. There is no `is_poc`, no `estimate_min` / `estimate_max`, no `confidence`, no `phase_status: 'tbd'`. Anything I genuinely don't know becomes a guess that the WSJF score, the solver, the Gantt and the dashboards then treat with full conviction. **A guess and a commitment look identical to the rest of the system.**

**Evidence.**
- Single-point sizing — `index.html:12711–12712`, `12743`.
- Template-fixed phase order — `index.html:12720`, `12932`, `13093`.
- Zero references to `poc`, `pilot`, `min_size`, `max_size`, `estimate_range`, `confidence_interval`, `tshirt_size`.
- WSJF inputs (`business_value`, `time_criticality`, `risk_reduction_opportunity`, `moscow`) are present (`CLAUDE.md`) but assume the project is well-enough understood to score on those axes.

**To reach 9/10.**

> **As a** senior manager,
> **I want** to capture conviction and uncertainty at project intake,
> **so that** speculative work is not promoted into committed plans by the same scoring and capacity machinery.

**AC1 — Project conviction class.** Given the Quick-Add wizard, when I create a project, then I must classify it as one of `Idea`, `Discovery`, `POC`, `Phase-1 Build`, `Implementation`, `Run/BAU`. The class is persisted on `project.lifecycle_stage` and shown as a chip on the Projects grid, the detail panel, and the Gantt bar.

**AC2 — Range estimation.** Given a project with `lifecycle_stage ∈ {Idea, Discovery, POC}`, when I size it, then each skill accepts an optimistic / most-likely / pessimistic triple (or "T-shirt: S/M/L/XL with bands defined in Config"). The solver consumes most-likely; the dashboard surfaces the range as a confidence band on the Gantt and a "P50 / P80" footprint in capacity rollups.

**AC3 — Phase deferral.** Given a project, when I open delivery config, then `phase_order` accepts entries with `status: 'tbd'`. A TBD phase is rendered on the Gantt as an open-ended dashed bar, excluded from the solver, and surfaces a "phase-pending-decision" badge in the Backlog Health view.

**AC4 — "Conviction-aware" WSJF.** Given a project with `lifecycle_stage = POC` or `confidence < 0.5`, when WSJF is computed, then the score is annotated `(low confidence)` and the project is sorted into a separate band in Auto-Prioritise so that high-conviction Implementations cannot be displaced by low-conviction Ideas with the same arithmetic.

**AC5 — "What we don't know" panel.** Given any project, when I open the detail panel, then a `Unknowns` section lists open assumptions (e.g. "data source not yet identified", "no executive sponsor confirmed"), each with an owner and target-resolution date. These are surfaced on the Backlog Health card as "blocked-on-unknowns".

To reach **10/10**, AC1–AC5 plus the wizard offering a 60-second guided intake interview ("How sure are you about scope? About timeline? About sponsorship?") that auto-suggests `lifecycle_stage` and pre-fills the unknowns panel.

---

### Scenario 2 — Getting back to stakeholders on timelines

**Rating: 6 / 10**

**Why this rating.** For an **in-flight, sized** project with completed sprints, the answer arrives in seconds. The Roadmap (`Gantt.render`, ~line 13380+) shows the project's bar with deadline pin (line 14330–14338), launch pin (line 14340–14345), UAT pin (line 14347–14351), and the Dashboard's velocity-based forecast surfaces P50/P80/P95 sprint counts (`Forecast.simulateSprintsNeeded`, line 20329–20359). EVM (BAC/EV/PV/AC/SPI/CPI/EAC/ETC) on the detail panel gives a credible "we'll finish at X" answer. For a **brand-new, unsized** ask, however, the Forecast object requires `size_total > 0` and ≥2 completed sprints (`MIN_HISTORY: 2`, line 20252) — neither is true, so it returns nothing useful. The wizard's *Preview Scenarios* helps but is point-estimate.

**Evidence.**
- Velocity Monte Carlo with P50/P80/P95 — `index.html:20250–20359`.
- Forecast preconditions — `index.html:20252`, `20382–20384`.
- Roadmap milestone rendering — `index.html:14330–14357`.
- EVM in detail panel — `USABILITY_TEST_REPORT.md` line 54 (confirmed still rendering).

**To reach 9/10.**

> **As a** senior manager fielding a stakeholder ask,
> **I want** a "tell me by when" answer for *any* candidate project — sized or not, in-flight or not — without leaving the conversation,
> **so that** I never give an answer I cannot defend.

**AC1 — "When can I have it?" widget.** Given any project (existing or hypothetical), when I open the new *When-by* tool from the header, then I enter a target date and the app responds with one of: *Likely yes (P80 by D, P50 by D-1w)*, *Stretch (P50 by D, P80 by D+2w)*, *No (next achievable P80: D+4w)*, with the displaced projects named.

**AC2 — Hypothetical mode.** Given the When-by tool, when I tick *hypothetical*, then the calculation does not require the project to exist; I provide skill-level T-shirt sizes and the tool runs against current capacity + queue.

**AC3 — Cone of uncertainty by lifecycle_stage.** Given a project's `lifecycle_stage`, when the forecast renders, then the cone widens for early-stage projects (POC ±60%, Discovery ±40%, Implementation ±15%) per industry-standard cone-of-uncertainty.

**AC4 — Stakeholder-shareable answer.** Given a When-by answer, when I press *Copy*, then the clipboard receives a short, dated, sponsor-ready paragraph: *"Project X — earliest credible delivery is 14 Jul 2026 (P80) / 30 Jun 2026 (P50) at current capacity, pinned by the DE bottleneck in S5. Sources: solver run 26 Apr, capacity snapshot 26 Apr."*

10/10 adds an opt-in "live link" the stakeholder can bookmark to see the answer move as the portfolio moves.

---

### Scenario 3 — Ensuring the team is on track

**Rating: 6 / 10**

**Why this rating.** The signals are present but they don't compose into a single verdict. Capacity view shows sprint-by-sprint health (`Capacity.renderSprintCapacity`, line 19325), Sprint Planning's Team tab now correctly renders per-person commitment (line 19542–19543, fix landed since prior audit), the audit feed shows what changed (`AuditPanel.render`, line 23628), the Forecast Accuracy KPI (line 20486 `accuracyStats`) tracks last-sprint forecast vs actual, the Trends modal (line 23739) shows 14-day rolling counts of At Risk / Blocked / RAG movers, and the Portfolio Pack does roll up portfolio-wide EVM (BAC/EV/PV/AC, Avg SPI/CPI). What's **missing** is the verdict layer: a single "Are we on track?" tile that synthesises EVM + RAG drift + velocity vs commit + capacity health into "Yes — green / Watch — amber / No — red" with a one-paragraph justification. Today I read four screens and form the verdict in my head.

**Evidence.**
- Capacity bars red/amber/green — `index.html:19386–19388`.
- EVM portfolio rollup in Portfolio Pack — Agent A finding, `index.html:23405+`.
- Trends modal: project counts, no velocity burn-up — `index.html:23779–23807`.
- No portfolio-level on-track verdict — confirmed absent across all four agents.

**To reach 9/10.**

> **As a** senior manager,
> **I want** a single, defensible "are we on track?" verdict per customer,
> **so that** I open the dashboard, read one tile, and know the answer.

**AC1 — On-Track Verdict tile.** Given the dashboard, when I open it, then a tile per customer renders one of *On Track / Watch / Off Track* with a 30-word justification, three contributing inputs (EVM SPI band, RAG mover count last 14d, capacity-vs-demand red sprints), and a *click-to-explain* drill-down that surfaces the underlying numbers.

**AC2 — Trend, not snapshot.** Given the verdict, when I hover, then a 12-week sparkline shows verdict history. A flip from On Track → Watch flags as a notable event in the audit feed automatically.

**AC3 — Quiet-period detection.** Given a project with no audit-log entries in the last 14 days, when the verdict renders, then it is flagged as *Stale (no movement)* and excluded from On-Track contribution. Quiet projects do not get a free On-Track score.

**AC4 — Velocity burn-up in Trends.** Given the Trends modal, when I open it, then a per-customer SP delivered vs planned line chart is the first tab (currently the modal shows project-status counts only, not velocity).

10/10 adds per-team-member contribution to the verdict (e.g. "Watch — Sarah is the bottleneck in DE for the next two sprints").

---

### Scenario 4 — Not overburdening the team

**Rating: 6 / 10**

**Why this rating.** Mechanically, the team is protected: R4 enforces the per-person cap as a hard constraint (`SOLVER.md §4`, `index.html:18290`), the capacity view shows red >100% / amber 80–100% / green ≤80% (line 19386), holidays / ramp / sprint overrides are all honoured (line 19490–19503). But "overburden" isn't only about *one* sprint — it's about *consecutive* sprints at high load. There is no proactive "Sarah has been at 95% for three sprints in a row" alert. There's no *sustainable pace* heuristic. The `hotSprintThresholdPct` setting (line 5107, default 90%) governs the solver's load-balancing pass but never raises a UX warning to me. Manual edits outside Auto-Allocate appear to have no over-cap pre-flight check.

**Evidence.**
- R4 hard cap — `SOLVER.md §4`.
- No back-to-back stretch detection — Agent C confirmed absent.
- `hotSprintThresholdPct` exists but is silent — `index.html:5107`.

**To reach 9/10.**

**AC1 — Sustainable pace alert.** Given any team member with utilisation ≥ 90% for three consecutive sprints, when the dashboard renders, then a *Sustained High Load* badge appears next to their name in the Capacity view and as a Watch input on the On-Track verdict.

**AC2 — Pre-flight on manual edits.** Given a manual sprint-grid edit that would push a member over 100% in any sprint, when I drop the chip, then a confirmation modal previews the violation and requires explicit override (audited as `source: 'user-override'`).

**AC3 — Burnout-risk filter.** Given the Capacity view, when I tick *Burnout risk only*, then the grid filters to members with sustained high load OR ≥ 1 cancelled holiday in the last quarter OR ≥ 95% load in next 4 sprints.

**AC4 — Recovery suggestion.** Given a Sustained High Load member, when I click their badge, then the solver runs a what-if "redistribute to recover sub-85% by sprint N" pass and previews the trade-offs (which projects slip).

10/10 adds a leave-balance signal: pull from member `holidays[]` and warn if a stressed member also has < 5 days PTO booked in next 90 days.

---

### Scenario 5 — Providing the team with clarity and direction

**Rating: 6 / 10**

**Why this rating.** The Sprint Planning grid is genuinely good — skill-coloured chips, validated drag-and-drop transfer (recent commit `ddf6e62`), per-chip progress modal (`openChipProgressEditor`, line 17149), sprint-wide capacity strip. The Team Schedule Gantt (line 19115–19127) renders per-member assignment bars. What's missing is the **"sprint brief" handout**: a one-pager-per-team-member that says "Here is what you own this sprint, in priority order, with linked context." Today the team's clarity comes from the same screens I look at — there is no team-facing report at all. There is also no per-person view ("My Work this Sprint") that filters to a logged-in member.

**Evidence.**
- Per-chip progress edit — `index.html:17149–17221`.
- No team-brief export — confirmed Agent A.
- No per-person filter / "My Work" view — confirmed Agent A and C.

**To reach 9/10.**

**AC1 — Sprint brief export.** Given a sprint, when I press *Export Sprint Brief*, then a printable PDF is generated containing one page per team member: their assigned slices in priority order, their sprint capacity vs commitment, the project context (1-paragraph blurb + RAG + sponsor), and any blocking dependencies.

**AC2 — Personal filter.** Given the header, when I select a team member from a *View as…* picker, then every view filters to that member's commitments only.

**AC3 — Sprint goals.** Given a sprint, when I open it, then I capture *one to three sprint goals* (text + linked projects). Goals print on the brief and appear on the sprint header.

**AC4 — Standup mode.** Given Sprint Planning, when I press *Standup*, then the view collapses to a vertical list — one row per member — with their slices, blockers, yesterday's progress (delta from audit log) and "ask for help" pinpoints. Designed for 15-minute meetings.

10/10 adds copy-to-Slack / copy-to-email of the personal brief.

---

### Scenario 6 — Producing reports for stakeholders

**Rating: 7 / 10**

**Why this rating.** The two flagship exports are good. The **Portfolio Pack** (`Report.exportPortfolioPack`, line 23405–23585) is sponsor-grade: branded, exec summary, KPIs, EVM rollup, status table, milestones, risk severity 5×5 matrix, top 15 risks, governance forum status, decisions. Auto-print to PDF (`window.print()` after ~200ms, line 15306). The **Status Report** (line 4432) is cross-customer and similarly well-formed. Both emit success toasts (line 4567, 23584). Copy Table works in TSV + HTML for clean Outlook/Word paste (line 9645–9650). What's missing: per-project sponsor pack (today a sponsor has to read a paragraph in the customer-wide pack), forum-specific agenda pre-read pack, risks-only export, sprint-plan handout. The Dashboard *Executive Summary* paragraph also still has the inherited bug that "0 at risk, 0 blocked" is computed from `p.status` not from `p.rag_*` so a Red-RAG/Not-At-Risk-status project shows zero (line 8810–8811).

**Evidence.**
- Portfolio Pack content — `index.html:23405–23585`.
- Status Report content — `index.html:4432–4567`.
- No per-project sponsor pack — confirmed Agent A.
- Exec Summary RAG vs status mismatch — `USABILITY_TEST_REPORT.md` line 84, still present.

**To reach 9/10.**

**AC1 — Per-project sponsor pack.** Given a project's detail panel, when I press *Sponsor Pack*, then a one-page (max two) PDF generates: header (sponsor, manager, RAG, key dates), one-paragraph status narrative, milestone strip, top 3 risks, current asks, EVM mini, signed-off baseline overlay.

**AC2 — Forum agenda generator.** Given a governance forum, when I press *Build Agenda*, then a printable pre-read assembles: forum name + date + attendees, list of linked projects with status + asks, open actions ageing, top decisions for approval, escalated risks. Sent ahead of the meeting.

**AC3 — Exec Summary fix.** Given the Dashboard Executive Summary, when *atRisk / blocked* is computed, then it pulls from project-level RAG aggregate (any Red on schedule/resource/scope = at risk) AND `status` simultaneously so the narrative reconciles with the RAG mix tile.

**AC4 — Risks register export.** Given Governance Exports, when I press *Export Risks*, then a CSV/PDF of all risks (project, description, owner, I/P, score, trend) is generated, sortable by score.

10/10 adds *narrative auto-draft*: each export's exec-summary paragraph is generated by templating real data into editable copy ("Spend in S4 closed 12% over plan because…") that I review before sending.

---

### Scenario 7 — Identifying when additional resourcing is required

**Rating: 3 / 10**

**Why this rating.** This is the area I'd most like fixed. The solver tells me a deadline will miss (`deadline_miss`, `SOLVER.md §7`), or that nothing fits in horizon (`capacity_overflow_horizon`), or that a skill has zero capacity (`zero_capacity`). What it does **not** tell me is *how much more* I need. The arithmetic — demand-by-skill-by-sprint minus supply-by-skill-by-sprint — exists inside the solver (it has to, to detect the warnings) but is never surfaced as "you need +12 SP/sprint of Data Engineering for sprints 4 through 7, equivalent to 0.6 FTE @ 100% loading or 1.2 contractors @ 50%". I cannot walk into a hiring conversation with a number from this app today.

**Evidence.**
- `zero_capacity` warning text "Add coverage or raise availability" — `index.html:18237`.
- No demand-vs-supply gap report — confirmed Agent C.
- No FTE / contractor translation — no rate model exists at all.

**To reach 9/10.**

**AC1 — Resourcing Gap Report.** Given the Capacity view, when I press *Gap Analysis*, then a per-skill, per-sprint table renders three columns: *Demand SP*, *Supply SP*, *Gap SP*. Negative gaps are coloured red. The bottom row shows the FTE equivalent at the team's average days-per-SP and `available_points_per_sprint`.

**AC2 — Hiring/borrow recommendation.** Given a non-zero gap, when I click the gap cell, then the app proposes one or more remediation options ranked by cheapest first: *(a) borrow from another customer's "Both" pool*, *(b) extend an existing contractor*, *(c) hire +N FTE starting sprint X*, with the resulting solver outcome previewed (warnings cleared / deadline met / Y SP buffer).

**AC3 — Forward-looking demand pipeline.** Given the Backlog (Status = Not Started), when I press *Demand pipeline*, then the app projects demand by skill/sprint *as if every backlog project landed at default conviction*, so I can see resource pressure 1–2 quarters out.

**AC4 — Lead-time-aware advice.** Given the recommendation, when it suggests hiring, then the proposal accounts for ramp time (use member.ramp_profile / ramp_weeks defaults) and flags the earliest sprint when the new hire becomes net positive.

10/10 adds explicit cost: rate-card per skill per sprint (contractor vs perm), £-tagged recommendations, and an FY budget tracker on the Dashboard.

---

### Scenario 8 — Making minor tweaks to plans

**Rating: 6 / 10**

**Why this rating.** Day-to-day editability is solid. Drag-and-drop on the Sprint grid is validated against transfer (recent commit `ddf6e62`), the detail panel doesn't fire stale unsaved-changes prompts (recent commit `6ee240c`), Bulk Edit and Auto-Prioritise live on the Projects toolbar, the per-chip progress modal is fast, Undo/Redo with keyboard support exists (line 2141–2143). What still bites: **Auto-Allocate Cancel does not revert.** `closeAllocResults` (line 18589–18591) sets `pendingAllocation = null` and hides the modal but does not roll back the proposed `skill_splits` if they've been computed in memory. The original usability report flagged this; the current code path confirms it is unfixed. Anyone clicking *Preview*, seeing the redistribution, and clicking *Cancel* gets a destructive change with no in-band undo. There is also no scenario/sandbox mode — every edit is live data.

**Evidence.**
- Auto-Allocate cancel non-revert — `index.html:18589–18591`, also `USABILITY_TEST_REPORT.md` line 23.
- Sprint grid validated transfer — recent commit `ddf6e62`.
- No sandbox mode — confirmed Agent D.

**To reach 9/10.**

**AC1 — Auto-Allocate Cancel reverts.** Given an Auto-Allocate preview, when I press *Cancel*, then the `App.data.projects[].skill_splits` are byte-for-byte equivalent to the pre-preview snapshot, the audit log records "auto-allocate-cancelled" as a single run, and a toast confirms revert.

**AC2 — Sandbox mode.** Given the header, when I toggle *Sandbox*, then a ⚠️ banner indicates I am in an isolated branch of the data; all edits persist to a sandbox slot in localStorage; *Save to live* and *Discard* are explicit; sandbox state is exportable.

**AC3 — Diff-on-save.** Given a saved sandbox or a manual change, when I press *Save*, then a diff modal lists every field changed (project, sprint, skill, who, why) and requires me to confirm before write.

**AC4 — Pre-flight on slip.** Given an edit that pushes a project past its hard deadline or onto an overcommitted sprint, when I save, then the system blocks with explicit override required (audited).

10/10 adds named scenarios: "April commit", "Plan B if KS hires", saved as labelled snapshots, with a side-by-side comparison view.

---

### Scenario 9 — Showing senior stakeholders how plans deviated from baselines

**Rating: 3 / 10**

**Why this rating.** This is the second-most damaging gap. The component pieces are present but **disconnected**. The Roadmap *Set Baseline* modal (`Gantt.openSetBaseline`, line 13252) now correctly persists named baselines into `App.data.baselines[]` and to localStorage (line 13278–13280). Good — that's a regression fix vs the prior usability test. **But** the Variance Report (`Gantt.exportBaselineReport`, line 14798) does not read `App.data.baselines[]`. It reads `project.baseline_start / baseline_end` — fields set per-project from a *different* button on the detail panel (line 10737). And the *Movers Legend* on the Roadmap (line 13372–13381) reads `snap.target_date`, a field that is **never written into the baseline snapshot** (the snapshot only stores `skill_splits`, line 13265) — so the legend is dead code and always shows "no target dates moved" even when they did. The on-Gantt baseline ghost-bars overlay does work — provided a named baseline is selected and the snapshot has sprint data. But for the most important sponsor visual ("we said end of June, we now say end of July, here is the overlay with deltas labelled"), the workflow today requires me to manually `Set Baseline` on every project from each detail panel, then export the variance PDF. That's not a feature, that's a workaround.

**Evidence.**
- Two disconnected baseline storages — `index.html:13278` (named) vs `10737` (per-project dates).
- Movers Legend dead code — reads `snap.target_date` (line 13357) which is never set in the snapshot (line 13260–13269).
- Variance Report data source mismatch — `index.html:14778`.
- Gantt baseline ghost bars — `index.html:14294–14311`.

**To reach 9/10.**

**AC1 — Unified baseline.** Given *Set Baseline* on the Roadmap, when I save, then the snapshot captures BOTH allocations (current behaviour) AND project-level dates (new), AND project-level skill sizes, AND scope flags (lifecycle_stage, MoSCoW). The detail-panel "Set baseline" button writes to the same store, scoped to the project.

**AC2 — One Variance Report source.** Given the Variance Report button, when pressed, then it operates on the *active named baseline* (from the dropdown), comparing every project's *current* dates and points to the baseline's recorded dates and points. No project-level baseline_start fallback.

**AC3 — Movers legend correct.** Given a selected baseline, when I view the Roadmap, then the Movers legend reads from the snapshot's project dates (now persisted per AC1) and renders accurately: "Since baseline 'March commit': 4 moved right (avg +12 days), 2 moved left (avg -3 days), 1 added, 0 removed."

**AC4 — Visual deviation overlay.** Given a baseline ghost bar and the current bar, when projects have moved, then a clearly-styled connector arrow (or diff shading) highlights the movement direction and magnitude, with a hover tooltip "Was: 30 Apr → 30 Jun. Now: 30 Apr → 28 Jul. +28 days. Reason (audit): scope added in S4 (logged 12 Apr)."

**AC5 — Multi-baseline comparison.** Given two named baselines (e.g., March vs April commit), when I select both in the dropdown, then the Variance Report renders three columns — March / April / Today — and highlights projects that drifted in *either* direction.

10/10 adds: an "auto-baseline" capture at the close of every governance forum, with the forum name as the baseline label.

---

### Scenario 10 — Working through remaining/consumed effort with PO + SM

**Rating: 6 / 10**

**Why this rating.** The mechanism exists and is auditable: right-click (or button-click) a skill chip in Sprint Planning to open the *Edit progress* modal (`openChipProgressEditor`, line 17149), set status (pending / in_progress / complete), input completed points, the change is `App.pushUndo`'d, the audit log records "pending/0 → in_progress/8" with timestamp + source (line 17215), localStorage is persisted, the velocity / EVM / burn-down rollups update. For a 90-minute weekly review with the PO and SM, however, the workflow is one chip at a time. A typical project with 5 skills × 4 sprint splits = 20 chips, 39 active projects, 7 team members — the click-cost is real. There is no walkthrough mode, no "what changed since last review?" filter, no bulk update.

**Evidence.**
- Per-chip progress flow — `index.html:17149–17221`.
- No bulk update — confirmed Agent C.
- Velocity reads `sp.completed` and `sp.status` — `index.html:19006`, `20271`.

**To reach 9/10.**

**AC1 — Walkthrough mode.** Given Sprint Planning, when I press *Walk-through*, then the app surfaces every chip in the current sprint that has not been touched since the previous Walk-through (or last 7 days), one at a time, and asks for "completed SP / blockers / forecast change". Designed as the PO/SM weekly checklist.

**AC2 — Bulk progress entry.** Given a project's detail panel, when I open *Progress*, then a single grid lists every skill split across every sprint with editable *completed* and *status* cells. Save in one action.

**AC3 — "What changed since last week" filter.** Given Sprint Planning or Projects view, when I tick *Changed since last review*, then only projects with audit-log entries in the chosen window appear, sorted by magnitude of change.

**AC4 — PO/SM checklist export.** Given any week, when I press *Review pack*, then a printable checklist exports: every active project, completed SP this week, remaining SP, P50 sprints to finish, RAG drift, top blocker — designed for the meeting.

10/10 adds: a 2-minute screencast-style "what changed" auto-summary I can play to the room before we open the working session.

---

### Scenario 11 — Review and manage backlog status

**Rating: 6 / 10**

**Why this rating.** The Backlog Health modal (line 10325–10454) is good: refined % (refinedCount / activeCount, green ≥70%, amber ≥40%, red <40%), age buckets (0-7d / 8-30d / 31-60d / 60d+), unrefined list with click-through. Auto-Prioritise + Why-this-rank? + WSJF + MoSCoW are present. The Projects grid is the working backlog editor with bulk edit and CSV export. **But** there is no dedicated Backlog *tab* — backlog is overloaded onto the Projects grid (which doubles as the in-flight portfolio view) and the Sprint Planning *Backlog* column. MoSCoW is captured but not filterable in the grid header. There is no "Definition of Ready" workflow per project. A "Won't" item has no parking-lot view. There is no per-PO ownership view of "your unrefined items".

**Evidence.**
- Backlog Health modal — `index.html:10325–10454`.
- No dedicated backlog tab — `index.html:993` (sprint column), Projects grid only.
- MoSCoW not filterable in grid — confirmed Agent C.

**To reach 9/10.**

**AC1 — Dedicated Backlog view.** Given the navigation, when I open *Backlog*, then a focused screen appears with three columns: *Unrefined* (no estimate / no DoR), *Refined & ranked* (ready for next sprint), *Parked* (MoSCoW=Won't / status=On Hold). Each card shows age, owner, refinement gaps.

**AC2 — Definition of Ready checklist.** Given any project, when I open the detail panel, then a DoR section lists configurable checks (sponsor confirmed, sized, deadline confirmed, dependencies mapped, unknowns < 3). Backlog Health filters on "% DoR complete", not just sized.

**AC3 — Per-PO/owner filter.** Given the Backlog view, when I select a project owner, then the view filters to their items and shows their refinement burn-up (refined per week vs target).

**AC4 — Stale-item nudge.** Given a project with no audit entries in 60 days AND status=Not Started, when the dashboard loads, then a *Backlog drift* card surfaces these and lets me bulk archive / re-engage.

10/10 adds: Slack/email digest to project owners listing their stale items weekly, with a one-click "still relevant?" response.

---

### Scenario 12 — Differentiating POC from Implementation

**Rating: 2 / 10**

**Why this rating.** Not modelled at all. Search of the codebase confirms zero references to `poc`, `pilot`, `prototype`, `experiment`, `project_type`, `maturity`, `lifecycle_stage` (Agent D). All projects are treated as committed delivery initiatives by WSJF, the solver, the Gantt, and the dashboards. A speculative POC competes for the same DE/DS capacity slots as a signed-SoW Implementation, and unless I manually downrank it (a workaround), the system promotes it equally. This is not just a missing feature — it is the absence of a discriminator that makes the rest of the model dangerous to senior stakeholders, because everything looks like a commitment.

**Evidence.**
- Zero refs to POC / pilot / project_type — Agent D.
- Solver allocates uniformly — `SOLVER.md §1`, no special handling.

**To reach 9/10.**

This scenario is solved by AC1–AC4 in **Scenario 1 (project conviction class)**. Specifically the `lifecycle_stage` field, conviction-aware WSJF, and the visual chip on every surface that tells me at a glance "this is a POC, treat it accordingly".

Additionally:

**AC1 — POC-to-Implementation conversion ceremony.** Given a project with `lifecycle_stage = POC` and a defined exit criterion, when the criterion is met (e.g. "demo accepted"), then a *Convert to Implementation* button on the detail panel triggers a guided flow: scope re-validation, re-sizing under Implementation conviction band, sponsor confirmation, automatic baseline capture, audit-log entry. This is the gateway between speculative and committed work.

**AC2 — POC budget cap.** Given Configuration, when I set a customer-level POC budget (e.g. "no more than 15% of any sprint's DE capacity"), then the solver enforces it and warns if a new POC would breach.

10/10 adds a cohort view: "POCs started in FY26 — outcome distribution: converted / killed / extended", to inform investment policy.

---

### Scenario 13 — Phase 1 (Discovery) → next phases when undefined

**Rating: 2 / 10**

**Why this rating.** Same root cause as Scenario 12. `delivery_config.phase_order` is fixed at create-time per template (line 12720, 12932, 13093). There is no `status: 'tbd'` on a phase. There is no way to record "Discovery deliverable due 30 May; Phase 2+ scope and sizing TBD pending Discovery findings". Today the workaround is to size Phase 2+ with a rough number and update later — but the audit log doesn't tell stakeholders "this number was a placeholder", so any subsequent revision looks like a slip rather than a planned re-baseline.

**Evidence.**
- Fixed phase order — `index.html:12720` and templates.
- No phase-status field — Agent D.

**To reach 9/10.**

Solved by AC3 in **Scenario 1 (phase deferral)**, plus:

**AC1 — Discovery exit gate.** Given a project with `phase_order: ['Requirements', 'TBD']` and `lifecycle_stage = Discovery`, when Discovery completes, then the system prompts me to run the *Plan Phase 2+* flow which captures: confirmed scope, re-sized phases, refreshed deadline, and re-baseline. Future phases promote from `TBD` to concrete only at this gate.

**AC2 — Visual TBD bar on Gantt.** Given a project with TBD phases, when the Gantt renders, then those phases appear as a dashed open-ended bar to the right of Discovery, clearly distinct from concrete phase bars, and excluded from solver capacity until promoted.

**AC3 — Stakeholder-facing TBD treatment.** Given the Portfolio Pack, when projects with TBD phases are listed, then a *(Discovery only — Phase 2+ TBD pending findings)* annotation accompanies the row so sponsors don't assume the timeline is end-to-end.

10/10 adds a *forecast envelope* that uses comparable past projects to predict Phase 2+ likely SP range and finish date, so the placeholder isn't blank.

---

### Scenario 14 — Cross-customer prioritisation under shared scarcity

**Rating: 5 / 10**

**Why this rating.** The architecture is deliberately customer-scoped (CLAUDE.md: "no All option") which protects single-customer focus, and the **Portfolio Overview** view (`#view=portfolio`) does aggregate across customers (per Agent A's audit). The data model supports customer="Both" team members with `capacity_by_customer` to avoid double-counting (per `SOLVER.md §1`, `R8`). But the solver runs **once per customer** (`SOLVER.md §1`: "Not a multi-customer optimiser"), so when GCC's hard deadline competes with KS's hard deadline for the same DE engineer, the app cannot tell me *which choice is cheapest in net portfolio value*. I have to run two solver runs and compare in my head.

**Evidence.**
- Portfolio Overview present — Agent A.
- Solver per-customer only — `SOLVER.md §1`.
- `capacity_by_customer` enforced — `SOLVER.md §4 R8`.

**To reach 9/10.**

**AC1 — Cross-customer trade-off advisor.** Given two competing demands for the same shared resource, when I press *Trade-off* on the Portfolio Overview, then a side-by-side scenario view shows "Prioritise Customer A: GCC hits June, KS slips 3 weeks, net WSJF +X" vs "Prioritise B: …".

**AC2 — Shared-resource heatmap.** Given the Portfolio Overview, when I open *Shared resources*, then a per-skill heatmap shows demand from each customer per sprint, with red cells where `Both`-customer members are oversubscribed.

**AC3 — Portfolio-level WSJF.** Given the Portfolio Overview, when I press *Rank all*, then projects across customers appear in one ranked list using portfolio-WSJF (with customer-strategy weights configurable in Config), so I can defend "Customer A goes first because their WSJF is 8.4 vs 6.1 net of cost-of-delay".

10/10 adds an FY budget envelope per customer that the trade-off advisor honours.

---

### Scenario 15 — Defending past decisions ("why did we do that?")

**Rating: 5 / 10**

**Why this rating.** The audit log captures field-level changes per project with timestamp + source (user/auto/drag/auto-fix/bulk-edit/apply-recommendation/csv-import) + run_id grouping for batch ops (lines 2896–2928, 23628–23733, capped at 1000 entries). The Decisions log per forum captures approval state and approver. Together they provide a basic forensic trail. **But** there is no `scope_changes` / `scope_history` entity — when scope adjusts, the *what* is in the audit log but the *why* (the rationale, the authorisation) is not. The 1000-entry cap means a portfolio of 39 projects with active editing rolls over within ~6 months, and a year-end retrospective is impossible without manual export. Person-level assignment changes (who got assigned what when) are not separately auditable — only the project-level field change is.

**Evidence.**
- Audit log structure — `index.html:2896–2928`.
- 1000-entry cap — `index.html:2920–2921`.
- No scope_changes entity — `USABILITY_TEST_REPORT.md` line 66.
- Person-level not separately audited — Agent D.

**To reach 9/10.**

**AC1 — Persistent audit (no rollover).** Given the audit log, when entries exceed 1000, then older entries archive into a downloadable per-quarter file (CSV+JSON) preserved alongside the snapshot; the in-memory feed shows the most recent 1000 with a *Load older* link.

**AC2 — Scope-change rationale.** Given any change to size_*, deadline, or phase_order, when I save, then a one-line rationale field is required (free text, 200 chars), captured in the audit log alongside the diff.

**AC3 — Decision-to-change traceability.** Given a forum decision, when it's approved, then changes made within 14 days that could plausibly relate (project linked to the same forum and time-proximal) are tagged with the decision id automatically; manual override available.

**AC4 — Person-level allocation history.** Given a project, when I open *Audit*, then a *Who worked on what when* view reconstructs assignment history per skill_split per sprint, sourced from the slice-level `assigned_to` audit (this means slice-level assignment changes need their own audit hooks, not just project-field changes).

10/10 adds a *forensic mode* that exports the full year's edit history as a navigable HTML report with filters.

---

### Scenario 16 — Onboarding / losing a team member

**Rating: 5 / 10**

**Why this rating.** Team Member configuration is rich: primary/secondary skills, available_points_per_sprint, ramp_profile (none/linear/step), ramp_weeks, contract_end_date, holidays, sprint_overrides, customer (incl. "Both" with capacity_by_customer). Capacity calculations honour all of this. But when a member leaves (or joins) mid-horizon, there is no "drop them and show me the damage" simulation — I have to edit `contract_end_date`, run Auto-Allocate, mentally compare warnings to the previous run. And Auto-Allocate Cancel doesn't revert (Scenario 8). Onboarding-side: no checklist of "what skills does this hire need to be net positive in 8 weeks?" derived from current resourcing gaps.

**Evidence.**
- Member config — `SOLVER.md §2`, `index.html:5086–5091`, `17780`.
- No leave-simulation mode — Agent D.

**To reach 9/10.**

**AC1 — Member impact simulator.** Given a team member, when I press *Simulate departure on date X*, then a what-if runs with that member zeroed from sprint X onwards, the result diff is shown vs current plan (which projects slip, which deadlines miss, which warnings appear), and *Discard* / *Apply* are explicit.

**AC2 — Hiring-spec recommender.** Given the current Resourcing Gap (Scenario 7), when I press *Hiring spec*, then the system proposes a profile: skills (primary + secondary), capacity SP/sprint to close gap, earliest-start date that yields net-positive impact accounting for ramp.

**AC3 — Bench / coverage view.** Given any skill, when I view Capacity, then a *Bench* indicator shows each member's spare capacity averaged over 4 sprints — used for who to redeploy to a stretched skill.

10/10 ties hiring proposals to FY budget tracking.

---

### Scenario 17 — Cash-flow / FY rollup / financial governance

**Rating: 3 / 10**

**Why this rating.** The model is purely SP + dates. There is no cost field per skill or per member, no contractor vs perm rate-card, no "we spent £X this FY" rollup. The FY boundary is a visual line on the Gantt (which is good for context). For a portfolio that spans three customers, governance forums, and an FY transition each 1 June, this is a notable absence — financial governance lives outside this app today.

**Evidence.**
- No cost / rate / budget fields — Agent D.
- FY boundary line — Agent B confirmed.

**To reach 9/10.**

**AC1 — Rate card.** Given Configuration, when I open *Rates*, then per-skill, per-customer, per-employment-type (perm / contract / vendor) rates are stored as £/SP and £/day.

**AC2 — Cost rollup.** Given any project, when the detail panel renders, then *Cost-to-date*, *Cost-at-completion (EAC × rate)*, and *Variance vs budget* are shown. Portfolio Pack adds a customer-level FY rollup.

**AC3 — Contractor mix view.** Given the Capacity view, when I open *Mix*, then per-sprint perm vs contractor SP and £ are stacked, with a configurable target ratio (e.g. ≤30% contractor) and red bar when exceeded.

**AC4 — FY budget tracker.** Given Configuration, when I set FY budget per customer, then a Dashboard tile shows £ consumed / £ committed / £ remaining and projects forward burn.

10/10 adds an outline business case generator (cost + benefit + NPV) per project.

---

### Scenario 18 — Scenario sandboxing / what-if

**Rating: 3 / 10**

**Why this rating.** Edits hit live data immediately. The Auto-Allocate *Preview* modal looks like a sandbox but its Cancel doesn't revert (Scenario 8). There is no isolated branch of the data, no named scenario slot, no side-by-side comparison. For "what if we de-prioritise X by one slot, when does Y land?" I have to actually edit, observe, and undo.

**Evidence.**
- Live-data edits — Agent D.
- Auto-Allocate cancel issue — `index.html:18589–18591`.

**To reach 9/10.**

This scenario is solved primarily by AC2–AC4 in **Scenario 8 (sandbox / diff-on-save / pre-flight)**, plus:

**AC1 — Named scenarios.** Given any state, when I press *Save scenario*, then a labelled snapshot is created (e.g. "Plan B: KS hires"); scenarios can be loaded, compared, deleted; the active scenario is shown in the header alongside the customer pill.

**AC2 — Side-by-side comparison.** Given two scenarios, when I press *Compare*, then a split-view shows the Roadmap, capacity, KPIs side-by-side, with a delta column for projects whose dates / size / RAG differ.

10/10 lets me share a scenario as a read-only link with a stakeholder for asynchronous review.

---

### Scenario 19 — Holiday & leave coordination

**Rating: 5 / 10**

**Why this rating.** Capacity is holiday-aware (per-member holidays, annual_holidays, sprint_overrides.holidays — `SOLVER.md §2`). But there is no team-wide leave calendar view (e.g. a quarter-by-quarter strip showing every member's PTO at a glance) and no conflict alert ("3 of 4 DE engineers off in S6"). I have to scan member configs individually to spot a clash.

**Evidence.**
- Holiday-aware capacity — `index.html:19490–19503`.
- No leave-calendar view — Agent D.

**To reach 9/10.**

**AC1 — Leave calendar.** Given the Capacity view, when I open *Leave*, then a quarter strip shows every member's PTO bookings as horizontal bars per week.

**AC2 — Skill-coverage warning.** Given any week with ≥50% of a skill out, when the dashboard loads, then a *Coverage risk* card surfaces it and lists impacted projects.

**AC3 — Conflict pre-flight.** Given a member's leave-add, when I save, then the system warns if the leave creates skill-coverage <50% or coincides with a hard deadline within ±2 weeks.

10/10 integrates with org calendars (read-only ICS feed).

---

### Scenario 20 — Key-person / single-point-of-failure detection

**Rating: 3 / 10**

**Why this rating.** R4 surfaces who's fully loaded but not who's *uniquely* loaded. There is no bus-factor metric — "Project X depends on only one person who can do Data Science". No "this skill is single-threaded" warning. For risk management this is a significant blind spot.

**Evidence.**
- No bus-factor / coverage metric — Agent C and D.

**To reach 9/10.**

**AC1 — Bus-factor per project.** Given a project, when the detail panel renders, then a *Coverage* line shows N people available for each phase's primary skill and lists by name; bus-factor=1 is flagged red.

**AC2 — Single-threaded skill alert.** Given Configuration, when a customer has fewer than 2 members for any required skill, then the Dashboard shows a *Single-threaded skill* card listing the projects exposed.

**AC3 — Cross-skilling suggestion.** Given a single-threaded skill, when I click the alert, then the system proposes candidate members to up-skill (those with the skill as secondary or with adjacent primaries) and shows the capacity cost of the up-skilling sprint.

10/10 ties bus-factor into the On-Track verdict — a project with bus-factor=1 cannot be On-Track without explicit acknowledgement.

---

## 4. Cross-Cutting Investment Roadmap

Sequencing the AC blocks above by leverage. P0 = highest portfolio impact per engineering hour.

### P0 — Within 4 weeks

1. **Fix Auto-Allocate Cancel revert** (Scenario 8 AC1). Single function change in `closeAllocResults`. Restores trust in the most-used solver flow. Removes the largest UX scar in the app.
2. **Unified baseline + correct Movers Legend** (Scenario 9 AC1, AC3). One persistence path; one variance source; movers legend reads from the persisted snapshot. Unlocks the senior-stakeholder narrative.
3. **Resourcing Gap Report** (Scenario 7 AC1). The arithmetic is already in the solver — surface it as a per-skill, per-sprint table. This single feature changes the conversation with HR/finance.
4. **Exec Summary RAG↔status reconciliation** (Scenario 6 AC3). Bug-fix in the dashboard text-builder. Removes an embarrassing contradiction.

### P1 — Within a quarter

5. **Project conviction class** (Scenario 1 AC1, Scenario 12). Adds `lifecycle_stage`. Cascades into WSJF banding, Gantt rendering, Portfolio Pack annotation, Backlog filtering. Single field with high downstream value.
6. **Range estimation + cone of uncertainty** (Scenario 1 AC2, Scenario 2 AC3). Stops single-point estimates from masquerading as commitments.
7. **Phase deferral (TBD phases)** (Scenario 1 AC3, Scenario 13). Visual + solver + reporting awareness of "we don't know yet".
8. **On-Track Verdict tile** (Scenario 3 AC1). Synthesises EVM + RAG + capacity into one defensible answer per customer.
9. **When-by widget** (Scenario 2 AC1). Replaces the "let me come back to you" loop in stakeholder conversations.

### P2 — Within two quarters

10. **Sandbox + named scenarios + diff-on-save** (Scenarios 8, 18). Removes the "live-data only" risk.
11. **Per-project sponsor pack + forum agenda generator** (Scenario 6 AC1, AC2).
12. **Sustainable-pace alert + leave calendar + bus-factor** (Scenarios 4, 19, 20).
13. **Walkthrough mode + bulk progress + Sprint Brief export** (Scenarios 5, 10).
14. **Scope-rationale + persistent audit** (Scenario 15).
15. **Cost model + FY budget** (Scenario 17). Largest scope; lowest unit-of-effort leverage relative to P0/P1, but mandatory before this becomes the system of record for financial governance.

If P0+P1 land cleanly the portfolio average lifts from **5.0 to ~7.5**. P2 brings it to **8.5+**. The remaining gap to 9.5+ is cost modelling and organisation-calendar integration, which are ecosystem features rather than tool features.

---

## 5. Notable Strengths I Want to Protect

The investment list above is long. It would be unfair not to call out what's already best-in-class for a single-file zero-infrastructure tool:

- **The Solver** (`SOLVER.md`, all of `index.html` Solver object). Eleven warning types, hard per-person caps, holiday/ramp/override-aware capacity, day-budget enforcement (R11), assignee-aware slices (R10), three-pass forward/repair/balance with circular-dependency detection. The R10 fix since the prior usability test is genuinely material.
- **The Roadmap/Gantt**. Per-skill segmentation, executive-mode collapse, week zoom, deadline/launch/UAT/external pins, dependency edges, today/FY annotations, work-window narrowing per `skill_splits[].work_start_date / work_end_date`. The print stylesheet is decent.
- **Portfolio Pack and Status Report**. Genuinely sponsor-grade outputs — narrative + EVM rollup + risk severity matrix + governance summary, auto-print to PDF, with confirmation toasts. These are the most under-rated part of the app.
- **Skill palette**. The deliberate avoidance of green/amber/red in skill chips (Indigo / Cyan / Blue / Violet / Pink) prevents RAG confusion in the densest views. A small choice, big payoff.
- **Customer-scoping discipline**. Single source of truth (`App.activeCustomer`), echoed next to every view title, prevents the cross-customer confusion that plagues most portfolio tools. The Portfolio Overview as the only aggregate surface is the right design.
- **Per-chip progress modal** + **audit log run grouping**. The PO/SM workflow has the bones to be excellent; it just needs walkthrough scaffolding.

---

## 6. Closing Position

This app is roughly **65% of the senior-manager job done**. The reporting, capacity, and Gantt machinery is strong. The solver is unusually serious for its form factor. What's missing is the connective tissue between *"the data is in here somewhere"* and *"here is the answer I would defend in steerco"*: a unified baseline story, a conviction model that distinguishes a guess from a commitment, a resourcing-gap signal expressed in FTE rather than warnings, and a verdict layer above the metric layer. The P0 list (Cancel revert, baselines unification, resourcing gap, RAG/status reconciliation) is achievable in a focused four-week sprint and would lift this from a *useful local tool* to a *defensible system of record*.

The path from there to 9+/10 is well-defined and incremental.

— *Senior Manager, Portfolio Command Centre, 26 April 2026*
