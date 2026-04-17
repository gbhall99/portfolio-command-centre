# Sprint Solver — Configuration & Rules Reference

This document is the authoritative guide to how the auto-allocation solver decides which project work lands in which sprint. It is intended to be reviewable by a senior analytics manager and by an engineer picking up the code.

The solver lives inside `index.html` as the `Solver` object and is invoked via `Sprint.autoAllocate()` → `Solver.solve(customer, settings, data, sprintModule)`.

---

## 1. Scope

- **Inputs**: one customer, the `Sprint.allocSettings` map, the global `App.data`, and the `Sprint` module (for capacity helpers and skill metadata).
- **Output**: a plan (`allocations`, `warnings`, `stats`, `utilizationGrid`) that the user previews in the Allocation Results modal and applies via "Apply Allocation".
- **Persistence**: on Apply, the plan is written into `project.skill_splits[skillKey][]`. Each slice carries `{ sprint, points, status, completed, assigned_to, reasons }`.
- **Not a multi-customer optimiser**. The solver runs once per customer. A team member tagged `customer: "Both"` must declare `capacity_by_customer: { [customerName]: points }` in their profile, otherwise their `available_points_per_sprint` is split equally across configured customers as a back-compat default.
- **Not a global optimum**. It is a greedy, priority-ordered packer with three passes (forward schedule, deadline repair, load balance). Deterministic under fixed inputs.

---

## 2. Data dependencies

Fields the solver reads (everything else is ignored):

### Project (`App.data.projects[i]`)
- `id`, `name`, `customer`, `status`, `priority`
- `hard_deadline` (ISO date; drives ordering and Pass 2)
- `target_date` (ISO date; read but not enforced)
- `dependencies[]` — objects with `type === 'blocked_by'` and `target_id`
- `size_requirements`, `size_engineering`, `size_data_science`, `size_tableau`, `size_uat_adoption`
- `delivery_config.phase_order[]` — optional; overrides the default phase sequence for this project
- `skill_splits` — read only for locked projects, to reserve their capacity

### Team member (`App.data.team_members[i]`)
- `name`, `customer` (`"GCC" | "KS" | "DR&I" | "Both"`)
- `primary_skills[]`, `secondary_skills[]` — human-readable labels that map to size keys
- `available_points_per_sprint` — per-person capacity in SP
- `capacity_by_customer: { [customerName]: points }` — required for `customer: "Both"` members to avoid double-counting
- `sprint_overrides: { [sprintId]: { available_points, holidays } }` — per-sprint tweaks
- `holidays: [{ start, end }]` — global personal leave
- `start_date`, `ramp_profile` (`"none" | "linear" | "step"`), `ramp_weeks`, `contract_end_date`

### Sprint (`App.data.sprints[i]`)
- `sprint_id` (e.g. `"CY26-S3"`)
- `start_date`, `end_date`, `hardening_start` — used to compute **dev-days** (working days from `start_date` to `hardening_start`, falling back to `end_date` if hardening_start is missing; default 20).

### Annual holidays (`App.data.annual_holidays[]`)
- `date`, `recurring`, `customers[]` — used by `calcMemberCapacityForSprint` to reduce per-member capacity.

---

## 3. Settings (`Sprint.allocSettings`)

All configurable via the **Settings** button in Sprint Planning.

| Setting | Default | Purpose |
|---|---|---|
| `maxCapacityPct` | `85` | Aggregate-skill ceiling per sprint (%). Does NOT apply to per-person caps — those are absolute. |
| `respectSkillOrder` | `true` | Phase N+1 never starts before phase N begins. Phases MAY share a sprint if the hand-off buffer and day-budget rules hold. |
| `spreadWork` | `true` | Runs Pass 3 load-balance (shifts hot→cold within constraints). |
| `lockCompleted` | `true` | Projects with status `Complete` / `Closed` are not moved; their existing `skill_splits` reserve capacity. |
| `lockInProgress` | `false` | As above for status `In Progress`. |
| `startFromSprint` | `""` | Earliest sprint in the horizon. `""` = first sprint in `App.data.sprints`. |
| `phaseBufferPoints` | `2` | Hand-off buffer between consecutive phases (expressed in SP; converted to calendar days internally). `0` disables. |
| `enforcePerPersonCap` | `true` | HARD constraint — no member ever exceeds their sprint-adjusted `available_points_per_sprint`. |
| `maxBufferSlides` | `4` | Safety stop for cascading buffer pushes (sprints). Once exceeded, the solver accepts overlap and emits `buffer_abandoned_maxslides`. |
| `priorityWeight` | `3` | Kept for back-compat; NOT currently consumed. Priority ordering is driven by `project.priority` + `hard_deadline`. |

---

## 4. Rules (R1–R11)

| # | Rule | Config | Notes |
|---|---|---|---|
| **R1** | Fill sprints earliest-to-latest | — | Enforced by the forward loop; Pass 3 never moves anything earlier. |
| **R2** | Phase-transition buffer inside a project: when phase N+1 starts in the same sprint where phase N finishes, reserve `phaseBufferPoints` SP of the project's sprint-footprint as hand-off. Enforced in **calendar days** via R11. | `phaseBufferPoints` (SP; internally × team average days/SP) | Buffer is a project-level concept, not a skill-pool concept. |
| **R3** | *(removed — Hypercare phase was retired in v1.1. Buffer now applies uniformly.)* | — | Reserved for future rule. |
| **R4** | Per-person cap: no team member exceeds `available_points_per_sprint` (after override / ramp / holiday) in any sprint | `enforcePerPersonCap` | Hard constraint. |
| **R5** | Cross-phase overlap within a sprint IS allowed when R2 (and R11) hold | `respectSkillOrder` | Replaces the old strict gate. |
| **R6** | If R2/R11 cannot be met, slide phase N+1 to the next sprint (capped at `maxBufferSlides`) | `maxBufferSlides` | Beyond the cap, allows overlap and warns. |
| **R7** | If buffer slide would force a miss past `hard_deadline`, drop the buffer, overlap, warn | — | Deadline wins. |
| **R8** | Per-person cap is **per customer run**. `customer: "Both"` members must declare `capacity_by_customer` to prevent cross-customer double-count. | `team_member.capacity_by_customer` | Fallback: equal split across configured customers. |
| **R9** | `autoPrioritise` adds graded deadline urgency: ≤7d +60, ≤14d +40, ≤30d +20, ≤60d +10. | — | See §6. |
| **R10** | Every slice carries `assigned_to: [{ member, points }]` and `reasons: string[]`. | — | UI tooltip source. |
| **R11** | Project sequential day-budget inside a sprint ≤ `devDaysForSprint(s)` (working days between `start_date` and `hardening_start`). Overruns split the offending phase across sprints. | — | **NEW** — fixes the "everything in one sprint" bug. |

### How R11 works in detail

For each project P, each sprint S, the solver maintains `projectTime[P][S] = { phaseDays: { [n]: days }, totalDays, _bufferDays }`.

- `phaseDays[n]` is the **max** of all phase-n slice durations (parallel same-phase skills ⇒ max, not sum).
- A slice's calendar days are `max over assigned_to members of (points × memberDaysPerSP)` where `memberDaysPerSP = devDays / member.available_points_per_sprint_for_this_sprint`.
- `totalDays = sum of phaseDays + _bufferDays × (number of phase transitions that land in this sprint)`.
- Before placing a slice, the solver clamps `assign` so that `totalDays + sliceDays + (possibly one new _bufferDays) ≤ devDaysForSprint(S)`. If the clamped value is `0`, the slice slides to `S+1`.
- When clamped, both halves of the slice carry `reasons: ['time-split']` and a `time_budget_split` warning is emitted.

---

## 5. Algorithm — three passes

### Setup (pre-Pass 1)
1. Clip the sprint list by `startFromSprint`.
2. Build `devDaysBySprint[sid]` from each sprint's calendar (`start_date` → `hardening_start`).
3. Build `personLedger[sid][name] = { total, remaining, skills, primarySkills, secondarySkills, daysPerSP }` using `Sprint.calcMemberCapacityForSprint`.
4. Build the aggregate `baseCap[sid][skillKey]`, apply `maxCapacityPct`.
5. Reserve locked projects' capacity (aggregate + per-person when `assigned_to` is populated).
6. Filter to allocatable projects. Detect circular dependencies; emit `circular_dependency` warning.
7. Sort projects by: deadline sprint (asc, `-1` → last) → `priority` (asc) → `id` (lex, stable).

### Pass 1 — Forward Schedule
For each project P in sorted order: call the shared `allocateProject(P, -1)` primitive.

`allocateProject`:
- For each phase group `g` (phase 1, 2, 3, …):
  - For each skill `sk` in `g`:
    - Loop sprints from `minIdx` onwards, placing slices of `sk` according to:
      1. **R2 check** — if the previous phase already landed in this sprint for P, require sprint headroom ≥ `bufferPoints + 1` SP; otherwise slide (R6) or drop buffer for deadline (R7).
      2. **Per-person check (R4)** — compute eligible members' headroom; if zero, `peopleOverCapAverted++` and slide.
      3. **R11 day-budget clamp** — compute how many days the candidate slice would consume; if it would exceed `devDaysBySprint[S] - totalDaysUsedByP`, clamp `assign` down (or slide if even 1 SP won't fit). Emits `time_budget_split` when clamped.
      4. **Commit**: assign `{sprint, points, assigned_to, reasons}`; decrement aggregate + per-person remaining; update `projectPhaseFootprint` (SP) and `projectTime` (days).
  - After all skills in `g` are placed, advance `minIdx` to the latest sprint used by any phase-g skill for P.

### Pass 2 — Deadline Repair
For each project with a `hard_deadline` that Pass 1 missed:
1. `releaseProject(P)` — hand back capacity (aggregate, per-person, projectTime).
2. Call `allocateProject(P, hard_deadline_sprint_idx)` — same primitive, bounded ceiling. Still respects R2/R4/R11.
3. If still miss, emit `deadline_miss`.

### Pass 3 — Load Balance (optional)
Only if `spreadWork === true`. Up to 3 iterations:
- For each (skill, sprint) where utilisation > 90% and next sprint < 60%:
  - Pick allocations with `points > 1`, shift half to next sprint.
  - Gated by `canShift(pid, skill, fromSid, toSid, delta, assignedTo)`, which rejects if any of:
    - Deadline breach at destination.
    - Per-person cap breach at destination.
    - Phase order breach (later phase already occupies or precedes destination).
    - Aggregate buffer violation at destination.
    - **R11 day-budget breach at destination** (new).
  - On accept: re-distribute `assigned_to` proportionally, update projectTime, log `spread-shift` reason.

---

## 6. Scoring (`App.calculateProjectPriorityScore`)

```
statusScore   = statusWeight[status] × 10    // Blocked 50, At Risk 40, In Progress 30, Not Started 20, On Hold 10, else 0
ragScore      = (rag_schedule + rag_resourcing + rag_scope weights) × 5   // Red 3, Amber 2, Green 1 each → 15–45
riskScore     = Σ (severity × probability)   // from risks_register; 0–25 per risk
sizeScore     = min(20, size_total / 5)
deadlineScore = graded ramp (R9):
                ≤7 days  → 60
                ≤14 days → 40
                ≤30 days → 20
                ≤60 days → 10
                else      0
                (0 for Complete/Closed/On Hold or missing hard_deadline)
total         = round(statusScore + ragScore + riskScore + sizeScore + deadlineScore)
```

`autoPrioritise()` re-ranks projects 1..N per customer in descending score order (stable). The solver itself sorts by `hard_deadline_sprint_idx` FIRST, then by `priority`, so imminent deadlines outrank all other factors in allocation order.

---

## 7. Warnings

Emitted on the `warnings: [ { type, project: {id,name}|null, skill: string|null, sprint: string|null, detail: string } ]` array. Grouped + deduplicated per (project, sprint, skill) in the UI.

| Type | Severity | Meaning |
|---|---|---|
| `circular_dependency` | violet | A cycle in `blocked_by` relationships; edges within the cycle are ignored. |
| `dependency_cross_customer` | amber | `blocked_by` points to a project in a different customer; treated as unblocked. |
| `zero_capacity` | red | A skill has zero total capacity in the horizon but is needed. |
| `buffer_push` | amber | Phase slid to preserve the hand-off buffer (R2). |
| `buffer_skipped_deadline` | amber | Buffer dropped for a single transition to meet a hard deadline (R7). |
| `buffer_abandoned_maxslides` | amber | Safety stop reached (R6); phase overlaps without buffer. |
| `person_over_cap_averted` | amber | Slice slid because no eligible member had remaining capacity (R4). |
| `time_budget_split` | amber | Phase slice split across sprints because the project exceeded a sprint's calendar day-budget (R11). |
| `capacity_overflow` | amber | No sprint could fit the remaining work; dumped into the horizon's last sprint. |
| `deadline_miss` | red | Hard deadline couldn't be met even after Pass 2 re-allocation. |

---

## 8. Stats (Allocation Results "Summary" tab)

| Stat | Meaning |
|---|---|
| Projects | Count of projects with ≥1 slice allocated. |
| Total Points | Sum of `project[skill_key]` across all allocated projects and skills (intended SP). |
| Sprints | Makespan = `maxSprintUsed − minSprintUsed + 1`. |
| Avg Utilisation | Mean utilisation % across all (sprint, skill) pairs that had any work. |
| Skipped | Projects with no allocatable skills (all zero size or no phase map entry). |
| Buffer Slides | Count of R2/R6 buffer-push events. |
| Over-Cap Averted | Count of R4 per-person slides. |
| Time Splits | Count of R11 day-budget clamps (slice split across sprints). |

---

## 9. Known limitations

1. **Multi-skilled aggregate double-count**. `Sprint.calcSkillCapacityForSprint` sums a multi-skilled member's `available_points_per_sprint` into every skill they list. Per-person cap (R4) is the authoritative constraint and mitigates the impact, but the aggregate skill pool shown in the Capacity view can look larger than the real deliverable throughput.
2. **Per-skill `days_per_sp` is single-valued**. `memberDaysPerSP = devDays / available_points_per_sprint`. A 1.0 days/SP member is treated as 1.0 across every skill they have — one skill can't be "slower per SP" than another for the same person. Future work if needed.
3. **Pass 3 shifts later only**. By design (preserves R1). Cannot reclaim idle capacity in early sprints from later ones.
4. **Overflow fallback bypasses R11**. When no sprint can fit the work at all, the solver dumps remainder into the last sprint with `reasons: ['overflow']` and `capacity_overflow` warning. These slices are exempt from R11 reporting (they already indicate a capacity failure).
5. **`Both`-customer split default** is an equal split across configured customers. Intentional back-compat fallback; set `capacity_by_customer` per member to override.
6. **Time-split is a slicing heuristic**, not a true calendar scheduler. Slice granularity is integer SP; a phase needing exactly 3.5 days of headroom rounds down to ~2 SP placed.

---

## 10. How to extend

- **Add a rule** — usually a new check in the inner placement loop (around the R11 clamp in `Solver.solve`), plus a new warning type in §7 and a new stat if counted.
- **Add a setting** — append to `Sprint.allocSettings`, surface in the Settings modal (`Sprint.openAllocSettings` / `saveAllocSettings`), read in `Solver.solve` where relevant.
- **Add a warning type** — emit via `this._warn(warnings, type, project, skill, sprint, detail)`. Register the type in the `typeMeta` map in `Sprint.renderAllocTab` (Summary tab warning grouping).
- **Add a new stat** — push into the return `stats` object in `Solver.solve`; render in `Sprint.renderAllocTab`'s Summary block.
- **Test it** — extend `/tmp/pcc-solver-test.js`. The existing 12 tests are a template. New invariants should be structural (e.g. "no slice X in condition Y") rather than exact-match numeric so they don't break on data changes.

---

## 11. One-page cheat sheet

- **Priority order**: `hard_deadline_sprint ASC → priority ASC → id ASC`. Stable.
- **Capacity grid per sprint**: aggregate `min(skill_cap × maxCapacityPct, sum_of_eligible_member_caps)`.
- **Per-person cap** (R4): `member.available_points_per_sprint` after override/ramp/holiday/contract-end, per sprint.
- **Day budget per sprint**: `devDays = working days from start_date to hardening_start`.
- **Buffer**: `phaseBufferPoints` SP × team avg days/SP = `bufferDays`. Added once per non-HC phase-transition inside a sprint.
- **Split semantics**: integer SP; clamp down, carry remainder to next sprint.
- **Hypercare**: retired — no longer a skill/phase in the app.
- **Assignment tiebreak**: primaries alphabetical → secondaries alphabetical, greedy fill-down.
