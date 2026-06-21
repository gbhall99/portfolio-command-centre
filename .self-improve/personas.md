# Personas

Grounded in the actual product: Velocity is a single-file, client-side portfolio/delivery
management app for a **data & analytics delivery team/consultancy** running projects across
multiple customer accounts. The five delivery skills it tracks (Requirements, Data Engineering,
Data Science, Tableau, UAT) and the SOW/quote/billing surfaces make the target clear: a services
team that plans, allocates, governs, and bills analytics delivery. Personas below are derived from
the modules in `CLAUDE.md` and the data model, not generic PM marketing archetypes.

Maturity legend for "success feels like": what good looks like for that user inside Velocity today.

---

## P1 — Priya, Delivery / Portfolio Lead (primary)
- **Archetype:** Head of delivery owning the whole multi-customer portfolio. Velocity's default user (`App.activeCustomer` + the "All customers" aggregate filter exist for her).
- **Goals:** Keep every customer's projects on track; balance one team across accounts; run auto-allocation and govern the plan; answer "are we on track and profitable?" instantly.
- **Context of use:** Daily. Desktop browser, often the "All customers" view. Lives in Dashboard, Roadmap/Gantt, Capacity, Solver/Allocation Results, Scenario Lab, Health Check.
- **Pain points:** Capacity conflicts across customers; stale plans after data drifts; knowing which deadlines are at risk and why; explaining trade-offs to stakeholders.
- **Success feels like:** One Auto-Allocate run produces a conflict-free, deadline-aware plan with a clear critical path; the Health Check panel surfaces exactly what needs attention; a scenario can be promoted into the plan on confirm.
- **Technical sophistication:** High on domain, medium on tooling. Wants agentic shortcuts, not config.

## P2 — Marcus, Engagement / Account Manager
- **Archetype:** Owns one or more customer relationships commercially.
- **Goals:** Produce credible SOWs and quotes; keep prepaid balances and margin healthy; send periodic status reports the client trusts.
- **Context of use:** Per-customer scope. Detail panel (SoW, Value, Billing tabs), Status Reports, Documents, Reports/Pack composer.
- **Pain points:** Hand-written figures drifting from the real plan; SOWs going stale; assembling client-ready packs; knowing when a quote no longer matches scope.
- **Success feels like:** SOW figures always trace to a generated quote (`Sow.figuresCheck`), stale docs flag themselves and refresh in one click, and a governed pack is composed in minutes.
- **Technical sophistication:** Low-medium. Cares about polish and trust, not internals.

## P3 — Sana, Resource / Capacity Planner
- **Archetype:** Runs the team — who is available, for which skill, in which sprint.
- **Goals:** Maximise utilisation without overloading anyone; honour holidays and per-sprint overrides; resolve the solver's concurrency/capacity warnings.
- **Context of use:** Capacity & Workload, Sprint Planning, Team Members config, Solver settings.
- **Pain points:** Hidden over-allocation; the R12 concurrent-person guard firing unexpectedly; understanding why a member is the binding constraint.
- **Success feels like:** Capacity heatmaps make over/under instantly visible; the solver explains binding constraints (`explain_plan`); per-sprint overrides are quick to set.
- **Technical sophistication:** Medium. Comfortable with sprints, points, allocation rules.

## P4 — Tom, Project / Sprint Lead
- **Archetype:** Runs the day-to-day for a slice of projects — board, backlog, RAID, sprints.
- **Goals:** Keep work flowing; unblock dependencies; keep RAID current; hit sprint commitments.
- **Context of use:** Kanban Board, Backlog, Sprint Planning, RAID tabs, project detail panel.
- **Pain points:** Stale cards; blocked/aging work not surfacing; WIP creep; RAID hygiene (duplicates, unresolved items).
- **Success feels like:** The board shows blocked/aging/time-in-status at a glance, WIP limits hold, and `tidy_portfolio` clears duplicate RAID and renormalises priorities on confirm.
- **Technical sophistication:** Medium. Agile-literate.

## P5 — Dev, Delivery Practitioner (Engineer / Analyst / Tableau dev)
- **Archetype:** The person assigned to a `skill_split`, doing the build.
- **Goals:** See what's assigned to me, update progress/points, move my cards, not get double-booked.
- **Context of use:** "By assignee" swimlane on the board, card actions, project detail delivery tab.
- **Pain points:** Unassigned/unclear ownership before allocation; keyboard/touch friction moving cards; understanding the field/calc map for a wireframe they must build.
- **Success feels like:** Their avatar/lane populates after allocation, cards move via keyboard or the ⋯ menu, and the wireframe spec gives an unambiguous build checklist + field map.
- **Technical sophistication:** High on craft, low patience for ceremony.

## P6 — Elena, Executive Sponsor / Reviewer (read-mostly)
- **Archetype:** Senior stakeholder (internal exec or client sponsor) who consumes, signs off, and steers.
- **Goals:** Trust the numbers; see status, risk, roadmap, and commercial health without digging; approve gates and SOWs.
- **Context of use:** Reports/Packs, Roadmap, Dashboard KPIs, SOW approval/sign-off, governance decisions.
- **Pain points:** Information overload; needing a one-page truth; signing off without confidence the doc is fresh and grounded.
- **Success feels like:** Exec KPI bands, status/RAG charts, milestone ribbon, and "asks + top risks" callouts in a clean pack; approval gated on freshness so a signed SOW is never stale.
- **Technical sophistication:** Low. Wants clarity and confidence, nothing else.
