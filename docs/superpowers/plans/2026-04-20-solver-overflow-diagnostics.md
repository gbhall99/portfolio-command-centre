# Solver Overflow Diagnostics Implementation Plan

> **For agentic workers:** This is a plan for inline execution in the current
> session (not subagent-driven). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single generic `capacity_overflow` warning with a
context-aware diagnostic that tells the user *why* their work couldn't be
placed and *what specific action will resolve it*, distinguishing
horizon-terminal saturation from hard-deadline-ceiling saturation.

**Architecture:** The overflow dump path at index.html:21109–21121 currently
pushes every case into one warning with one generic `action` string. Classify
the case at emit time based on (a) whether `ceilingIdx` was set and (b) whether
the dump sprint is the terminal sprint in the horizon; emit the warning with a
richer `detail` payload the UI can read. Extend the typeMeta map with two new
shapes (`capacity_overflow_horizon`, `capacity_overflow_deadline`) so the
"Action needed" column surfaces the correct advice.

**Tech Stack:** Single-file vanilla JS (index.html). Tests via vitest + jsdom
for solver unit coverage. No new dependencies.

**Scope — explicit non-goals:**
- Not changing the solver's allocation algorithm. Pass 1/2/3 behaviour is
  unchanged; only the messaging on the overflow failure case changes.
- Not adding a "try to extend horizon" or "try to shrink deadline" mutation —
  those are user decisions, not solver automation.
- Not rewriting the R11 day-budget logic or the R4 per-person guard.

---

## Root-cause analysis (diagnostic, not code)

The user's 20 warnings decompose as follows:

- **18 on `CY26-S8`** — the last sprint in the horizon. When the inner
  sprint-loop at index.html:20937 exhausts without placing anything, the fall-
  through at 21109–21121 dumps remaining points into
  `sprints[Math.min(ceilingIdx, sprints.length - 1)].sprint_id`. With no
  ceiling and no later sprint, that is always the terminal sprint. The dumped
  slice carries `assigned_to: []` — literally no one is assigned — and a
  `capacity_overflow` warning. The `action` text ("move some work to a later
  sprint") is misleading because there is no later sprint.

- **2 on `CY26-S4`** for `Wellbeing Survey Go-Live` (Tableau + UAT) — this
  project has a `hard_deadline` that sets `ceilingIdx` to S4. Work can't fit
  inside S1–S4 under the R4/R11 guards, so the dump lands at S4. The
  "move to a later sprint" advice is *actively wrong* here — S5+ would miss
  the deadline.

Both cases share a single warning type + action text today. That is the bug:
not the solver's decision, but the diagnosis it emits.

Secondary observations from code-read:

- The overflow slice has `assigned_to: []`, which means the user sees work
  "planned" in S8 but the Team tab for S8 shows no one doing it. This is
  expected given the failure case, but the connection isn't obvious unless
  the warning says so.
- `peopleOverCapAverted` already gets incremented when per-person cap blocks a
  slide. If overflow happens *because* per-person cap kept blocking, the
  diagnostic should mention it — that's a second-order hint (the headline
  remains "horizon saturated").

---

## File Structure

Only one production file changes: `index.html`. Two locations:

1. **Warning emit site**, around line 21115 inside `Solver.solve` →
   `allocateProject` → the `if (!placedThisSprint)` branch. Emit one of two
   refined warning types instead of the single legacy one, with a structured
   `detail` payload.

2. **UI typeMeta map** at line 17903 (`Sprint.renderAllocTab`'s typeMeta block)
   — add the two new types and keep `capacity_overflow` as a back-compat
   fallback so older saved plans (if any) still render.

Tests land in `tests/unit/solver-overflow.test.mjs` (new file, parallel to the
existing `solver.test.mjs` / `solver-r12.test.mjs`).

---

## Task 1: Regression test — horizon-terminal overflow

**Files:**
- Create: `tests/unit/solver-overflow.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/solver-overflow.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMember, makeProject, makeSprintSequence } from '../harness/fixtures.mjs';

describe('Solver overflow diagnostics', () => {
  it('emits capacity_overflow_horizon when horizon is saturated and no ceiling is set', async () => {
    // One member with 5 pts/sprint, two sprints, one project needing 40 pts of DE.
    // Only 10 pts fit in the whole horizon; the remaining 30 must overflow.
    const member = makeMember({ name: 'Solo', available_points_per_sprint: 5, primary_skills: ['Data Engineering'] });
    const proj = makeProject({ id: 'GCC-HUGE', name: 'Huge DE', size_engineering: 40 });
    const app = await loadApp(makeDataset({
      team_members: [member],
      sprints: makeSprintSequence(2),
      projects: [proj]
    }));
    const plan = app.Solver.solve('GCC', app.Sprint.allocSettings, app.App.data, app.Sprint);
    const overflows = plan.warnings.filter(w => w.type === 'capacity_overflow_horizon');
    expect(overflows.length).toBeGreaterThan(0);
    const w = overflows[0];
    expect(w.sprint).toBe('CY26-S2');
    expect(w.detail).toContain('CY26-S2');
    // Detail mentions the horizon is saturated — the user's fix is structural.
    expect(w.detail.toLowerCase()).toMatch(/horizon|extend|last sprint/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/solver-overflow.test.mjs`
Expected: FAIL — no warning with type `capacity_overflow_horizon` exists yet.

## Task 2: Regression test — deadline-ceiling overflow

**Files:**
- Modify: `tests/unit/solver-overflow.test.mjs`

- [ ] **Step 1: Add the test**

```javascript
  it('emits capacity_overflow_deadline when a hard deadline bounds the horizon', async () => {
    // Two sprints, hard deadline at end of sprint 1. Work doesn't fit in sprint 1 alone,
    // so it must dump at sprint 1 (the deadline sprint), not sprint 2.
    const member = makeMember({ name: 'Solo', available_points_per_sprint: 5, primary_skills: ['Data Engineering'] });
    const sprints = makeSprintSequence(2);
    const proj = makeProject({
      id: 'GCC-DL', name: 'Deadline DE', size_engineering: 30,
      hard_deadline: sprints[0].end_date
    });
    const app = await loadApp(makeDataset({
      team_members: [member],
      sprints,
      projects: [proj]
    }));
    const plan = app.Solver.solve('GCC', app.Sprint.allocSettings, app.App.data, app.Sprint);
    const overflows = plan.warnings.filter(w => w.type === 'capacity_overflow_deadline');
    expect(overflows.length).toBeGreaterThan(0);
    const w = overflows[0];
    expect(w.sprint).toBe('CY26-S1');
    expect(w.detail).toMatch(/deadline|before/i);
    // Also: no horizon-terminal overflow should fire in this case for the same project.
    const terminal = plan.warnings.filter(w2 => w2.type === 'capacity_overflow_horizon' && w2.project && w2.project.id === 'GCC-DL');
    expect(terminal.length).toBe(0);
    app.teardown();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/solver-overflow.test.mjs`
Expected: FAIL — `capacity_overflow_deadline` doesn't exist either.

## Task 3: Emit refined overflow types

**Files:**
- Modify: `index.html` around line 21109–21121 (the `if (!placedThisSprint)` branch).

- [ ] **Step 1: Replace the single-warning emit with a classified one**

Find the current block:

```javascript
            if (!placedThisSprint) {
              // Exhausted the sprint list without placing anything — overflow.
              // ALWAYS push a new slice rather than merging into an existing one: merging bumps
              // slice.points but leaves assigned_to untouched, making `points` and Σassigned_to
              // diverge (capacity view over-reports, per-person ledger under-reserves).
              allMet = false;
              const lastSid = sprints[(ceilingIdx >= 0 ? Math.min(ceilingIdx, sprints.length - 1) : sprints.length - 1)].sprint_id;
              allocations[p.id][sk.key].push({ sprint: lastSid, points: pointsLeft, assigned_to: [], reasons: ['overflow'] });
              this._warn(warnings, 'capacity_overflow', p, sk.label, lastSid,
                p.name + ': ' + sk.label + ' overflows by ' + pointsLeft + ' pts');
              pointsLeft = 0;
              break;
            }
```

Replace with:

```javascript
            if (!placedThisSprint) {
              // Exhausted the sprint list without placing anything — overflow.
              // ALWAYS push a new slice rather than merging into an existing one: merging bumps
              // slice.points but leaves assigned_to untouched, making `points` and Σassigned_to
              // diverge (capacity view over-reports, per-person ledger under-reserves).
              allMet = false;
              // Two distinct failure shapes share this fall-through:
              //   (a) horizon-terminal — no deadline ceiling, and we reached the last sprint with
              //       every sprint already saturated. "Move to a later sprint" is meaningless —
              //       the user must extend the horizon, add capacity, or cut scope.
              //   (b) deadline-ceiling — a hard_deadline bounded ceilingIdx, and the work doesn't
              //       fit before it. "Move to a later sprint" would miss the deadline — the user
              //       must extend the deadline, add capacity, or cut scope.
              const isDeadlineBounded = ceilingIdx >= 0 && ceilingIdx < sprints.length - 1;
              const lastSid = sprints[(ceilingIdx >= 0 ? Math.min(ceilingIdx, sprints.length - 1) : sprints.length - 1)].sprint_id;
              const warnType = isDeadlineBounded ? 'capacity_overflow_deadline' : 'capacity_overflow_horizon';
              const horizonFirst = sprints[0].sprint_id;
              const horizonLast = sprints[sprints.length - 1].sprint_id;
              const detail = isDeadlineBounded
                ? (p.name + ': ' + sk.label + ' — ' + pointsLeft + ' pts could not fit before hard deadline (last allowed sprint: ' + lastSid + '). Options: extend the deadline, add capacity in sprints up to ' + lastSid + ', or cut scope.')
                : (p.name + ': ' + sk.label + ' — ' + pointsLeft + ' pts could not fit anywhere in the horizon (' + horizonFirst + '..' + horizonLast + '). Options: add sprints after ' + horizonLast + ', raise per-sprint capacity, or cut scope on lower-priority projects.');
              allocations[p.id][sk.key].push({ sprint: lastSid, points: pointsLeft, assigned_to: [], reasons: ['overflow', isDeadlineBounded ? 'overflow-deadline' : 'overflow-horizon'] });
              this._warn(warnings, warnType, p, sk.label, lastSid, detail);
              pointsLeft = 0;
              break;
            }
```

- [ ] **Step 2: Run the unit tests to verify they pass**

Run: `npx vitest run tests/unit/solver-overflow.test.mjs`
Expected: PASS (both tests).

## Task 4: Surface the new types in the UI

**Files:**
- Modify: `index.html` around line 17903 (typeMeta map inside `Sprint.renderAllocTab`).

- [ ] **Step 1: Register the two refined types**

Find the existing typeMeta entry:

```javascript
      capacity_overflow:         { label: 'Skill is overloaded',              resolved: false, action: 'Too much work for this skill in this sprint. Raise the capacity ceiling, or move some work to a later sprint before re-running.' },
```

Replace with three entries (new refined types + back-compat fallback):

```javascript
      capacity_overflow_horizon: { label: 'No room in the horizon',           resolved: false, action: 'Every sprint in the horizon is already full for this skill. Add a new sprint after the last one, raise per-sprint capacity, or cut lower-priority scope.' },
      capacity_overflow_deadline:{ label: 'Won\u2019t fit before deadline',    resolved: false, action: 'This project\u2019s hard deadline caps the horizon and the work doesn\u2019t fit inside it. Extend the deadline, add capacity in the earlier sprints, or cut scope.' },
      capacity_overflow:         { label: 'Skill is overloaded',              resolved: false, action: 'No sprint in the current horizon could take this work. Raise capacity, cut scope, or extend the horizon.' },
```

- [ ] **Step 2: Also register the two refined types in the export labels map**

Find line 20553:

```javascript
      capacity_overflow: 'Capacity overflow',
```

Add entries just above it so CSV/report exports get the refined names too:

```javascript
      capacity_overflow_horizon: 'Capacity overflow (horizon)',
      capacity_overflow_deadline: 'Capacity overflow (deadline)',
      capacity_overflow: 'Capacity overflow',
```

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: all tests pass — unit/render 65+, e2e 5.

## Task 5: Snapshot — confirm the UI label reads cleanly

**Files:**
- Manual check via the browser; no automated test.

- [ ] **Step 1: Open the app with sample data and force an overflow**

Load `portfolio-data.json`, go to Sprint Planning → Auto-Allocate, run. Confirm:
- If the warnings panel shows an overflow row, the "Action needed" column reads
  either "No room in the horizon" or "Won't fit before deadline", with a
  clear action description.
- The warning mentions the specific horizon span (`CY26-S1..S8`) or the
  deadline sprint, so a user can map the advice back to a concrete structural
  change.

- [ ] **Step 2: Commit**

```bash
git add index.html tests/unit/solver-overflow.test.mjs docs/superpowers/plans/2026-04-20-solver-overflow-diagnostics.md
git commit -m "fix(solver): split capacity_overflow into horizon/deadline diagnostics with actionable messaging"
```

---

## Self-review

**1. Spec coverage**: Root-cause section names the two cases; Tasks 1–2 lock each with a test; Tasks 3–4 implement both at emit time and render time. ✔

**2. Placeholder scan**: No "TBD"/"handle edge cases"/"similar to Task N" entries; each code block is concrete. ✔

**3. Type consistency**: Warning type identifiers are used verbatim across test assertions, emit site, typeMeta map, and export labels map — no name drift. ✔

**4. What this does NOT solve**: The user's underlying "my work doesn't fit" problem is real; the plan surfaces it honestly rather than hiding it behind a vague message. A future enhancement (not in this plan) could compute total demand vs horizon capacity per skill and display the delta on the Summary tab as a banner. That is a separate piece of work.
