# User Journeys

End-to-end critical paths per persona. Priority: **P0** = core, must always work; **P1** = important;
**P2** = valuable. "Surface" names the view/module (and `navigate()` target where relevant) the journey
exercises. These are the journeys the loop tests on every cycle.

App entry for all journeys: open `index.html` (file:// or `npm run serve` → http://127.0.0.1:8000),
then **select a customer** (or "All customers" where the view supports aggregation). The e2e suite
serves on `127.0.0.1:8765`.

---

## Priya — Portfolio Lead

### J1 (P0) — Plan the portfolio with Auto-Allocate
Trigger: new/changed projects need scheduling →
1. Select customer (or All) → Sprint Planning / Solver.
2. Run Auto-Allocate.
3. Review Allocation Results: warnings, binding constraints, **critical path**.
4. Apply allocation (persists `skill_splits[].assigned_to`, critical path).
Outcome: conflict-free, deadline-aware plan; board/Gantt populate with assignees.
Abandon points: unexplained warnings; solver leaves deadlines missed without saying why.
Surface: Sprint Planning, Solver, Allocation Results.

### J2 (P0) — Read portfolio health across customers
Trigger: "are we on track?" → Header → "All customers" → Dashboard / Roadmap.
Outcome: aggregated status, RAG, WSJF, deadlines; Health Check panel lists what needs attention.
Abandon: "All" silently falls back to one customer on a non-aggregate view without explanation.
Surface: Dashboard (`view-mode-*`), Roadmap/Gantt, `HealthCheck.open()`.

### J3 (P1) — What-if in the Scenario Lab, then promote
Trigger: a deadline/headcount question → ⌘K → Scenario Lab → add hypothesis (change_deadline / resize_skill / remove_member / add_project) → compare baseline vs scenario (incl. Margin £) → Promote on confirm.
Outcome: a what-if becomes the plan only after confirmation; deltas are honest.
Surface: `ScenarioLab.openUI()`, simulate_plan.

---

## Marcus — Account Manager

### J4 (P0) — Draft, ground, and approve a SOW
Trigger: new scope to sell → project detail → SoW tab → draft section (AI-grounded) → Pull from RAID (appropriate items only) → generate quote (for "quoted" template set) → resolve flags/comments → Approve.
Outcome: figures trace to the quote; approval gated on freshness + no unresolved flags/comments; attached wireframes co-signed.
Abandon: hand-written figures that don't reconcile; stale quote blocks approval without explaining drift.
Surface: SoW tab, `Sow.validate/figuresCheck/quoteStaleReason`, Billing.

### J5 (P1) — Generate and refresh a status report
Trigger: weekly client update → Status Reports → generate (grounded in live project/RAID/billing facts) → later, "needs refresh" chip → one-click refresh (redline + re-ground).
Outcome: client-ready narrative that never invents figures and self-detects drift.
Surface: StatusReport / StatusReportSkill, `isStale/applyRefresh`.

### J6 (P1) — Compose a client/exec pack
Trigger: review meeting → Governance → Exports → Compose Pack → pick audience + toggle sections → generate.
Outcome: branded pack (Gantt pipeline, KPI band, commercial summary, charts, milestones, callouts, appendix).
Surface: `Reports.openPackComposer()/generatePack`.

---

## Sana — Capacity Planner

### J7 (P0) — Spot and resolve over-allocation
Trigger: solver warnings / heatmap → Capacity & Workload → inspect per-skill, per-sprint load → set `sprint_overrides` or adjust splits → re-run solver.
Outcome: no member double-booked (R12); utilisation balanced; warnings cleared.
Surface: Capacity, `calcSkillCapacityForSprint`, Solver settings.

### J8 (P1) — Understand the binding constraint
Trigger: "why can't this finish sooner?" → ⌘K "Ask AI" → explain_plan → read binding constraints (≥90% util), deadline misses, suggested levers + critical path.
Outcome: grounded explanation, no invented figures.
Surface: explain_plan, Assistant.

---

## Tom — Project / Sprint Lead

### J9 (P0) — Run the board (move, unblock, filter)
Trigger: standup → Board → filter (Blocked/At-risk/Stale, manager/category) → move cards (drag, ⋯ menu, or ←/→ keys) → respect WIP limits.
Outcome: status transitions audited (`board-drag`), blocked/aging/time-in-status visible, swimlanes by assignee.
Surface: Kanban, `moveCard/openCardMenu/onCardKey`.

### J10 (P0) — Keep RAID current
Trigger: new risk/issue → RAID tab → add/edit/close item → link decision to governance.
Outcome: RAID reflects reality; appropriate items feed SOW "Pull from RAID".
Surface: RAID (Risks/Assumptions/Issues/Decisions/Actions), Governance.

### J11 (P1) — Triage hygiene with the agent
Trigger: messy backlog → Assistant → tidy_portfolio → confirm per-fix proposals (duplicate-RAID closes, priority 1…N normalisation).
Outcome: clean, deterministic fixes applied as one undoable batch.
Surface: tidy_portfolio, batch card.

---

## Dev — Practitioner

### J12 (P1) — Find and progress my work
Trigger: start of day → Board → "By assignee" swimlane (my lane) → move my cards / update points → delivery tab progress.
Outcome: ownership clear post-allocation; keyboard/touch moves work.
Surface: Kanban assignee lane, project detail delivery tab.

### J13 (P1) — Build to the wireframe spec
Trigger: assigned a dashboard → Wireframe tab / wireframe_spec report → read field & calc map + acceptance checklist → (optional) compare built screenshot to spec.
Outcome: unambiguous build target; conformance + build-ready gating.
Surface: Wireframe, `fieldMap/acceptanceChecklist/buildReady`, WireframeSkill.compareToBuilt.

---

## Elena — Executive / Sponsor

### J14 (P0) — Consume a one-page truth
Trigger: steering meeting → open exec pack / Dashboard KPIs → read status, RAG, roadmap, commercial health.
Outcome: confidence without digging; no stale or invented numbers.
Surface: Reports packs, Dashboard, Forecast/commercial_forecast.

### J15 (P1) — Approve a gate / SOW with confidence
Trigger: sign-off needed → SOW approval / gate review / governance decision → approve only when fresh and conformant.
Outcome: freshness-gated, audited, undoable approval.
Surface: `Sow.setStatus('Approved')`, Governance.
