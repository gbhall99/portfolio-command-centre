# P0 Portfolio Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land four high-leverage fixes that lift the senior-manager portfolio review average from 5.0/10 to ~6.5/10: Auto-Allocate Cancel revert, unified baseline persistence + correct Movers Legend, a Resourcing Gap Report, and Executive Summary RAG/status reconciliation.

**Architecture:** All changes live inside the single-file `index.html` app. Tests live in the existing `vitest`+`jsdom` harness (`tests/unit/`, `tests/render/`, `tests/e2e/`). Helpers are added to existing modules (`Sprint`, `Gantt`, `Capacity`, `Dashboard`); no new modules are introduced. Each task is independently committable.

**Tech Stack:** Plain JS in a single HTML file (zero build), inline SVG, `vitest` 2.1, `@playwright/test` 1.48, `jsdom` 25.

**Pre-flight:** Ensure tests pass on a clean working tree before starting:

```bash
npm install
npm test
```

If you want isolation, run this plan in a worktree (see `superpowers:using-git-worktrees`). Otherwise, work directly on the current branch (`audit-f-nnn-data-integrity`) and commit per task.

---

## File Structure

| File | Role | Touched in tasks |
|---|---|---|
| `index.html` | The whole app | 1, 2, 3, 4, 5, 6, 7, 8, 9 |
| `tests/unit/auto-allocate-revert.test.mjs` | New: snapshot + restore invariants for the alloc preview | 1, 2 |
| `tests/unit/baseline-snapshot.test.mjs` | New: named-baseline persistence shape, variance, movers legend | 3, 4, 5 |
| `tests/unit/resourcing-gap.test.mjs` | New: gap arithmetic + FTE conversion | 6 |
| `tests/render/resourcing-gap.test.mjs` | New: HTML shape of the Gap tab | 7 |
| `tests/render/exec-summary.test.mjs` | New: assert RAG/status reconciliation | 9 |
| `tests/e2e/p0-flows.spec.ts` | New: cancel-revert + Gap user flows | 10 |

---

## Task 1: Auto-Allocate Cancel revert — snapshot helper

**Why:** `Sprint.closeAllocResults` (`index.html:18589-18592`) currently only nulls `pendingAllocation`. Although the current code paths through `runAllocationFromOptions` and `applyAllocation` keep `App.data.projects[*].skill_splits` untouched until apply, the back-compat `Sprint.showAllocResults` (`index.html:18306`), the scenario-apply flow, and any future caller could mutate live data before opening the overlay. We add a defensive snapshot-on-open / restore-on-cancel pair so Cancel is byte-for-byte safe regardless of how the modal was reached.

**Files:**
- Modify: `index.html` — add helpers near `Sprint.pendingAllocation` (`index.html:18094`).
- Test: `tests/unit/auto-allocate-revert.test.mjs` (create).

- [ ] **Step 1: Write the failing test for the snapshot helpers**

Create `tests/unit/auto-allocate-revert.test.mjs`:

```javascript
// Auto-Allocate Cancel must restore App.data.projects[*].skill_splits to the exact
// snapshot taken when the alloc results overlay opened. Defensive: covers the case
// where any preview path mutates live data before the user clicks Cancel.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function setup() {
  resetIdSeq();
  const sprints = makeSprintSequence(3);
  const proj = makeProject({
    name: 'Pre-existing splits',
    size_engineering: 10,
    skill_splits: {
      size_engineering: [
        { sprint: sprints[0].sprint_id, points: 6, status: 'pending', completed: 0, assigned_to: [], reasons: [] },
        { sprint: sprints[1].sprint_id, points: 4, status: 'pending', completed: 0, assigned_to: [], reasons: [] }
      ]
    }
  });
  proj.size_total = 10;
  const member = makeMember({ name: 'Alice', available_points_per_sprint: 12 });
  const app = await loadApp(makeDataset({
    projects: [proj], sprints, team_members: [member]
  }));
  return { app, proj };
}

describe('Auto-Allocate Cancel — snapshot/restore helpers', () => {
  it('Sprint._snapshotSkillSplits returns a deep clone scoped to active customer', async () => {
    const { app, proj } = await setup();
    const before = app.Sprint._snapshotSkillSplits();
    proj.skill_splits.size_engineering[0].points = 999;
    expect(before[proj.id].size_engineering[0].points).toBe(6);
    app.teardown();
  });

  it('Sprint._restoreSkillSplits writes the snapshot back into App.data', async () => {
    const { app, proj } = await setup();
    const snap = app.Sprint._snapshotSkillSplits();
    proj.skill_splits = { size_engineering: [{ sprint: 'CY26-S3', points: 99, status: 'pending', completed: 0, assigned_to: [], reasons: [] }] };
    app.Sprint._restoreSkillSplits(snap);
    expect(proj.skill_splits.size_engineering).toHaveLength(2);
    expect(proj.skill_splits.size_engineering[0].points).toBe(6);
    expect(proj.skill_splits.size_engineering[1].points).toBe(4);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/unit/auto-allocate-revert.test.mjs
```

Expected: FAIL with `app.Sprint._snapshotSkillSplits is not a function`.

- [ ] **Step 3: Implement the snapshot/restore helpers in `index.html`**

Find the line `pendingAllocation: null,` in the `Sprint` module (currently at `index.html:18094`). Immediately after that line, insert:

```javascript
  // Defensive snapshot of every project's skill_splits taken when the alloc results
  // overlay opens. Restored byte-for-byte by closeAllocResults so Cancel is safe
  // regardless of which preview path mutates live data.
  _allocPreviewSnapshot: null,

  _snapshotSkillSplits() {
    const snap = {};
    (App.data && App.data.projects ? App.data.projects : []).forEach(p => {
      snap[p.id] = JSON.parse(JSON.stringify(p.skill_splits || {}));
    });
    return snap;
  },

  _restoreSkillSplits(snap) {
    if (!snap || !App.data || !App.data.projects) return;
    App.data.projects.forEach(p => {
      if (Object.prototype.hasOwnProperty.call(snap, p.id)) {
        p.skill_splits = JSON.parse(JSON.stringify(snap[p.id]));
      }
    });
  },

```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test:unit -- tests/unit/auto-allocate-revert.test.mjs
```

Expected: PASS — both `it` blocks green.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/auto-allocate-revert.test.mjs index.html
git commit -m "feat(sprint): add skill_splits snapshot/restore helpers for alloc preview"
```

---

## Task 2: Wire snapshot/restore into the alloc-results modal lifecycle

**Files:**
- Modify: `index.html:18096-18111` (`Sprint.autoAllocate`)
- Modify: `index.html:18306-18315` (`Sprint.showAllocResults` — back-compat path)
- Modify: `index.html:18164-18220` (`Sprint.applyAllocation` — clear snapshot on commit)
- Modify: `index.html:18589-18592` (`Sprint.closeAllocResults` — restore on cancel)
- Test: `tests/unit/auto-allocate-revert.test.mjs` (extend)

- [ ] **Step 1: Extend the test file with the lifecycle invariants**

Append to `tests/unit/auto-allocate-revert.test.mjs`:

```javascript
describe('Auto-Allocate Cancel — lifecycle', () => {
  it('autoAllocate captures a snapshot, closeAllocResults restores it', async () => {
    const { app, proj } = await setup();
    const originalLen = proj.skill_splits.size_engineering.length;

    app.Sprint.autoAllocate();
    expect(app.Sprint._allocPreviewSnapshot).not.toBeNull();
    expect(app.Sprint._allocPreviewSnapshot[proj.id]).toBeDefined();

    proj.skill_splits = {};

    app.Sprint.closeAllocResults();
    expect(app.Sprint._allocPreviewSnapshot).toBeNull();
    expect(proj.skill_splits.size_engineering).toHaveLength(originalLen);
    app.teardown();
  });

  it('applyAllocation clears the snapshot (commit semantics, no rollback)', async () => {
    const { app, proj } = await setup();
    app.Sprint.autoAllocate();
    app.Sprint.pendingAllocation = {
      allocations: { [proj.id]: { size_engineering: [{ sprint: 'CY26-S1', points: 10, status: 'pending', completed: 0, assigned_to: [], reasons: [] }] } },
      warnings: [],
      stats: { projectsAllocated: 1, makespan: 1, totalPoints: 10, avgUtilization: 0 }
    };
    app.Sprint.applyAllocation();
    expect(app.Sprint._allocPreviewSnapshot).toBeNull();
    expect(proj.skill_splits.size_engineering[0].points).toBe(10);
    app.teardown();
  });

  it('showAllocResults (back-compat path) also captures a snapshot', async () => {
    const { app } = await setup();
    const fakeResult = {
      allocations: {}, warnings: [],
      stats: { projectsAllocated: 0, makespan: 0, totalPoints: 0, avgUtilization: 0 },
      utilizationGrid: {}
    };
    app.Sprint.showAllocResults(fakeResult);
    expect(app.Sprint._allocPreviewSnapshot).not.toBeNull();
    app.Sprint.closeAllocResults();
    expect(app.Sprint._allocPreviewSnapshot).toBeNull();
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test:unit -- tests/unit/auto-allocate-revert.test.mjs
```

Expected: FAIL — three `lifecycle` cases fail because `autoAllocate` does not yet snapshot, `closeAllocResults` does not yet restore, and `applyAllocation` does not yet clear the snapshot.

- [ ] **Step 3: Wire snapshot capture into `Sprint.autoAllocate`**

In `index.html` find the body of `autoAllocate` and locate the line `this.pendingAllocation = null;` (around `index.html:18105`). Replace it with:

```javascript
    this.pendingAllocation = null;
    this._allocPreviewSnapshot = this._snapshotSkillSplits();
```

- [ ] **Step 4: Wire snapshot capture into `Sprint.showAllocResults`**

In `index.html` find the body of `showAllocResults` (around `index.html:18306`). Replace the first body line (`this.pendingAllocation = result;`) with:

```javascript
    if (this._allocPreviewSnapshot == null) {
      this._allocPreviewSnapshot = this._snapshotSkillSplits();
    }
    this.pendingAllocation = result;
```

(The guard avoids overwriting a snapshot already taken by `autoAllocate`.)

- [ ] **Step 5: Clear the snapshot on `applyAllocation`**

In `index.html` find `applyAllocation()` and locate the line `this.pendingAllocation = null;` (around `index.html:18192`). Immediately after that line add:

```javascript
    this._allocPreviewSnapshot = null;
```

- [ ] **Step 6: Restore the snapshot on `closeAllocResults`**

In `index.html` find:

```javascript
  closeAllocResults() {
    this.pendingAllocation = null;
    document.getElementById('allocResultsOverlay').classList.remove('open');
  },
```

Replace with:

```javascript
  closeAllocResults() {
    if (this._allocPreviewSnapshot) {
      this._restoreSkillSplits(this._allocPreviewSnapshot);
      this._allocPreviewSnapshot = null;
      if (typeof App !== 'undefined' && App.notifyDataChange) App.notifyDataChange();
    }
    this.pendingAllocation = null;
    const ov = document.getElementById('allocResultsOverlay');
    if (ov) ov.classList.remove('open');
  },
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
npm run test:unit -- tests/unit/auto-allocate-revert.test.mjs
```

Expected: PASS — all five `it` blocks green.

- [ ] **Step 8: Run the full unit suite to catch regressions**

```bash
npm run test:unit
```

Expected: PASS — full suite green.

- [ ] **Step 9: Commit**

```bash
git add tests/unit/auto-allocate-revert.test.mjs index.html
git commit -m "fix(sprint): Auto-Allocate Cancel restores skill_splits to pre-preview state"
```

---

## Task 3: Baseline — extend the snapshot to include project dates and sizes

**Why:** `Gantt.openSetBaseline` (`index.html:13252-13283`) currently snapshots `p.skill_splits` only. The Movers Legend (`Gantt._renderMoversLegendHtml`, `index.html:13345-13382`) reads `snap.target_date` which is never written, so it always says "no target dates moved". The Variance Report (`Gantt.exportBaselineReport`, `index.html:14798`) reads `p.baseline_start / p.baseline_end` — set by a separate Detail Panel button (`DetailPanel.setProjectBaseline`, `index.html:10727`) — so a Roadmap baseline never feeds the variance machinery. We unify both: every named baseline now captures dates and sizes per project, so a single Set Baseline action drives every variance surface.

**Files:**
- Modify: `index.html:13252-13283` (`Gantt.openSetBaseline` — extend snapshot fields)
- Test: `tests/unit/baseline-snapshot.test.mjs` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/baseline-snapshot.test.mjs`:

```javascript
// Named baselines must capture per-project dates and sizes alongside skill_splits,
// so a single Set Baseline drives the variance report AND the movers legend.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function setup() {
  resetIdSeq();
  const sprints = makeSprintSequence(3);
  const proj = makeProject({
    name: 'Dated project',
    size_engineering: 10,
    start_date: '2026-04-01',
    target_date: '2026-06-30',
    hard_deadline: '2026-07-15',
    skill_splits: {
      size_engineering: [
        { sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [], reasons: [] }
      ]
    }
  });
  proj.size_total = 10;
  const app = await loadApp(makeDataset({
    projects: [proj], sprints, team_members: [makeMember()]
  }));
  app.window.App.prompt = async () => 'April commit';
  return { app, proj };
}

describe('Named baseline — extended snapshot', () => {
  it('captures dates and sizes per project, not just skill_splits', async () => {
    const { app, proj } = await setup();
    await app.Gantt.openSetBaseline();
    const baselines = app.App.data.baselines || [];
    expect(baselines).toHaveLength(1);
    const snap = baselines[0].snapshot[proj.id];
    expect(snap).toBeDefined();
    expect(snap.skill_splits).toBeDefined();
    expect(snap.start_date).toBe('2026-04-01');
    expect(snap.target_date).toBe('2026-06-30');
    expect(snap.hard_deadline).toBe('2026-07-15');
    expect(snap.size_total).toBe(10);
    expect(snap.size_engineering).toBe(10);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/unit/baseline-snapshot.test.mjs
```

Expected: FAIL — `snap.start_date` is undefined.

- [ ] **Step 3: Extend the snapshot shape in `Gantt.openSetBaseline`**

In `index.html` find the snapshot construction block in `openSetBaseline` (`index.html:13260-13269`). Replace:

```javascript
    const snapshot = {};
    let count = 0;
    App.data.projects.forEach(p => {
      if (p.customer !== customer) return;
      if (!p.skill_splits || !Object.keys(p.skill_splits).length) return;
      snapshot[p.id] = JSON.parse(JSON.stringify(p.skill_splits));
      count++;
      // Also populate legacy single-baseline field so existing variance exports keep working.
      p.allocation_baseline = snapshot[p.id];
    });
```

With:

```javascript
    const snapshot = {};
    let count = 0;
    App.data.projects.forEach(p => {
      if (p.customer !== customer) return;
      if (!p.skill_splits || !Object.keys(p.skill_splits).length) return;
      snapshot[p.id] = {
        skill_splits: JSON.parse(JSON.stringify(p.skill_splits)),
        start_date:    p.start_date    || null,
        target_date:   p.target_date   || null,
        hard_deadline: p.hard_deadline || null,
        size_total:           p.size_total           || 0,
        size_requirements:    p.size_requirements    || 0,
        size_tableau:         p.size_tableau         || 0,
        size_engineering:     p.size_engineering     || 0,
        size_data_science:    p.size_data_science    || 0,
        size_uat_adoption:    p.size_uat_adoption    || 0,
        moscow:        p.moscow        || null,
        priority:      p.priority      || null
      };
      count++;
      // Keep legacy per-project allocation_baseline alive for any callers that read it directly.
      p.allocation_baseline = snapshot[p.id].skill_splits;
    });
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test:unit -- tests/unit/baseline-snapshot.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/baseline-snapshot.test.mjs index.html
git commit -m "feat(gantt): named baselines capture dates and sizes alongside skill_splits"
```

---

## Task 4: Baseline — fix downstream consumers of the snapshot shape

**Why:** Two existing functions iterate the snapshot assuming the old shape (`snap` = skill_splits map directly). After Task 3, the shape is `{ skill_splits, start_date, target_date, ... }`. We update both consumers and confirm the Movers Legend now works.

**Files:**
- Modify: `index.html:13287-13301` (`Gantt._projectBaselineSpan`)
- Modify: `index.html:14305-14306` (Gantt baseline ghost-bar fallback)
- Test: `tests/unit/baseline-snapshot.test.mjs` (extend)

- [ ] **Step 1: Extend the test with movers-legend invariants**

Append to `tests/unit/baseline-snapshot.test.mjs`:

```javascript
describe('Movers legend — reads snapshot.target_date', () => {
  it('detects projects whose target_date moved since the baseline', async () => {
    const { app, proj } = await setup();
    await app.Gantt.openSetBaseline();
    proj.target_date = '2026-07-28';
    app.Gantt.renderLegend();
    const legend = app.window.document.getElementById('ganttLegend');
    expect(legend).not.toBeNull();
    expect(legend.innerHTML).toMatch(/Since baseline/);
    expect(legend.innerHTML).toMatch(/1 moved right/);
    expect(legend.innerHTML).not.toMatch(/no target dates moved/);
    app.teardown();
  });

  it('reports "no target dates moved" only when nothing actually moved', async () => {
    const { app } = await setup();
    await app.Gantt.openSetBaseline();
    app.Gantt.renderLegend();
    const legend = app.window.document.getElementById('ganttLegend');
    expect(legend.innerHTML).toMatch(/no target dates moved/);
    app.teardown();
  });
});

describe('Gantt._projectBaselineSpan — tolerates new shape', () => {
  it('reads sprint span from snapshot.skill_splits (new shape)', async () => {
    const { app, proj } = await setup();
    await app.Gantt.openSetBaseline();
    const span = app.Gantt._projectBaselineSpan(proj.id);
    expect(span).not.toBeNull();
    expect(span.startSprint).toBe('CY26-S1');
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

```bash
npm run test:unit -- tests/unit/baseline-snapshot.test.mjs
```

Expected: FAIL — `_projectBaselineSpan` iterates `Object.values(splits)` but `splits` is now an object with `skill_splits`/`start_date`/etc., so `Array.isArray(arr)` is false for every value and span is null.

- [ ] **Step 3: Update `_projectBaselineSpan` to read the new shape**

In `index.html` find:

```javascript
  _projectBaselineSpan(projectId) {
    const b = this._activeBaseline();
    if (!b || !b.snapshot || !b.snapshot[projectId]) return null;
    const splits = b.snapshot[projectId];
    let earliest = null, latest = null;
    Object.values(splits).forEach(arr => {
      if (!Array.isArray(arr)) return;
      arr.forEach(sp => {
        if (!earliest || sp.sprint < earliest) earliest = sp.sprint;
        if (!latest || sp.sprint > latest) latest = sp.sprint;
      });
    });
    if (!earliest || !latest) return null;
    return { startSprint: earliest, endSprint: latest };
  },
```

Replace with:

```javascript
  _projectBaselineSpan(projectId) {
    const b = this._activeBaseline();
    if (!b || !b.snapshot || !b.snapshot[projectId]) return null;
    // Snapshot shape is now { skill_splits, start_date, target_date, hard_deadline, size_*, ... }.
    // Tolerate the pre-Task-3 shape (skill_splits at top level) for any older baselines.
    const node = b.snapshot[projectId];
    const splits = (node && node.skill_splits) ? node.skill_splits : node;
    let earliest = null, latest = null;
    Object.values(splits || {}).forEach(arr => {
      if (!Array.isArray(arr)) return;
      arr.forEach(sp => {
        if (!earliest || sp.sprint < earliest) earliest = sp.sprint;
        if (!latest || sp.sprint > latest) latest = sp.sprint;
      });
    });
    if (!earliest || !latest) return null;
    return { startSprint: earliest, endSprint: latest };
  },
```

- [ ] **Step 4: Patch the legacy ghost-bar fallback**

In `index.html` find (around `index.html:14306`):

```javascript
        if (!bStart || !bEnd) { bStart = p.baseline_start; bEnd = p.baseline_end; }
```

Replace with:

```javascript
        // Prefer the named baseline's project-level dates (Task 3); legacy fields are a final fallback.
        if (!bStart || !bEnd) {
          const ab = this._activeBaseline();
          const node = (ab && ab.snapshot && ab.snapshot[p.id]) || null;
          if (node && node.start_date && node.target_date) {
            bStart = node.start_date;
            bEnd = node.target_date;
          }
        }
        if (!bStart || !bEnd) { bStart = p.baseline_start; bEnd = p.baseline_end; }
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm run test:unit -- tests/unit/baseline-snapshot.test.mjs
```

Expected: PASS — all four `it` blocks green.

- [ ] **Step 6: Run the full unit suite to catch regressions**

```bash
npm run test:unit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/baseline-snapshot.test.mjs index.html
git commit -m "fix(gantt): baseline span + ghost-bar fallback read new snapshot shape"
```

---

## Task 5: Variance Report reads from active named baseline (single source of truth)

**Why:** `Gantt.getBaselineVariance` (`index.html:14775-14796`) currently reads `p.baseline_start / p.baseline_end` only. It ignores `App.data.baselines[]`. Now that named baselines carry dates (Task 3), variance should prefer the active named baseline; per-project fields become the fallback.

**Files:**
- Modify: `index.html:14775-14796` (`Gantt.getBaselineVariance`)
- Test: `tests/unit/baseline-snapshot.test.mjs` (extend)

- [ ] **Step 1: Extend the test**

Append to `tests/unit/baseline-snapshot.test.mjs`:

```javascript
describe('Variance Report — reads named baseline first', () => {
  it('returns drift relative to the active named baseline, not p.baseline_start/end', async () => {
    const { app, proj } = await setup();
    await app.Gantt.openSetBaseline();
    proj.target_date = '2026-07-28';
    const variance = app.Gantt.getBaselineVariance();
    expect(variance).toHaveLength(1);
    expect(variance[0].endDrift).toBe(28);
    expect(variance[0].trend).toBe('slipping');
    app.teardown();
  });

  it('falls back to p.baseline_start/end when no named baseline is active', async () => {
    const { app, proj } = await setup();
    proj.baseline_start = '2026-04-01';
    proj.baseline_end = '2026-06-30';
    proj.target_date = '2026-07-28';
    const variance = app.Gantt.getBaselineVariance();
    expect(variance).toHaveLength(1);
    expect(variance[0].endDrift).toBe(28);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify the first case fails**

```bash
npm run test:unit -- tests/unit/baseline-snapshot.test.mjs
```

Expected: FAIL — first case fails because `getBaselineVariance` filters on `p.baseline_start && p.baseline_end`.

- [ ] **Step 3: Replace `Gantt.getBaselineVariance`**

In `index.html` find the existing function (`index.html:14775-14796`) and replace with:

```javascript
  // Baseline variance — prefers the active named baseline (Task 3 shape) and
  // falls back to legacy per-project p.baseline_start / p.baseline_end fields.
  getBaselineVariance() {
    if (!App.data) return [];
    const named = this._activeBaseline();
    return App.data.projects
      .map(p => {
        let planStart = null, planEnd = null, source = null;
        if (named && named.snapshot && named.snapshot[p.id]) {
          const node = named.snapshot[p.id];
          if (node.start_date && node.target_date) {
            planStart = new Date(node.start_date);
            planEnd = new Date(node.target_date);
            source = 'named:' + named.name;
          }
        }
        if (!planStart || !planEnd) {
          if (!p.baseline_start || !p.baseline_end) return null;
          planStart = new Date(p.baseline_start);
          planEnd = new Date(p.baseline_end);
          source = 'project';
        }
        if (!p.start_date || !p.target_date) return null;
        const actualStart = new Date(p.start_date);
        const actualEnd = new Date(p.target_date);
        const startDrift = Math.round((actualStart - planStart) / (1000 * 60 * 60 * 24));
        const endDrift = Math.round((actualEnd - planEnd) / (1000 * 60 * 60 * 24));
        const planDuration = Math.round((planEnd - planStart) / (1000 * 60 * 60 * 24));
        const actualDuration = Math.round((actualEnd - actualStart) / (1000 * 60 * 60 * 24));
        return {
          id: p.id, name: p.name, customer: p.customer,
          startDrift, endDrift, planDuration, actualDuration,
          durationVariance: actualDuration - planDuration,
          trend: endDrift > 7 ? 'slipping' : endDrift < -7 ? 'ahead' : 'on-track',
          source
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.endDrift - a.endDrift);
  },
```

- [ ] **Step 4: Run the tests**

```bash
npm run test:unit -- tests/unit/baseline-snapshot.test.mjs
```

Expected: PASS — both new cases green.

- [ ] **Step 5: Run the full unit suite**

```bash
npm run test:unit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/baseline-snapshot.test.mjs index.html
git commit -m "fix(gantt): variance report reads active named baseline first"
```

---

## Task 6: Resourcing Gap — pure compute helper

**Why:** Today `Capacity.renderSprintCapacity` (`index.html:19325`) shows demand/capacity per skill per sprint. The arithmetic to surface "you need +N SP of skill X" already exists per cell, but no aggregation report exists. Add a pure `Capacity.computeResourcingGap(customer)` returning per-skill rows, per-sprint cells, total gap, and FTE conversion.

**Files:**
- Modify: `index.html` — add helper to the `Capacity` module just before `renderSprintCapacity`
- Test: `tests/unit/resourcing-gap.test.mjs` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/resourcing-gap.test.mjs`:

```javascript
// Resourcing Gap — surfaces demand vs supply per skill per sprint and
// translates the gap into FTE so a manager can walk into a hiring conversation
// with a number.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function setup() {
  resetIdSeq();
  const sprints = makeSprintSequence(2);
  const proj = makeProject({
    name: 'Hungry',
    size_engineering: 50,
    skill_splits: {
      size_engineering: [
        { sprint: sprints[0].sprint_id, points: 30, status: 'pending', completed: 0, assigned_to: [], reasons: [] },
        { sprint: sprints[1].sprint_id, points: 20, status: 'pending', completed: 0, assigned_to: [], reasons: [] }
      ]
    }
  });
  proj.size_total = 50;
  const member = makeMember({ name: 'Alice', available_points_per_sprint: 18 });
  const app = await loadApp(makeDataset({
    projects: [proj], sprints, team_members: [member]
  }));
  return { app, sprints };
}

describe('Capacity.computeResourcingGap', () => {
  it('returns per-skill, per-sprint demand / supply / gap rows', async () => {
    const { app, sprints } = await setup();
    const result = app.Capacity.computeResourcingGap('GCC');
    const de = result.bySkill.find(r => r.skillKey === 'size_engineering');
    expect(de).toBeDefined();
    expect(de.bySprint).toHaveLength(2);
    expect(de.bySprint[0]).toMatchObject({
      sprintId: sprints[0].sprint_id, demand: 30, supply: 18, gap: -12
    });
    expect(de.bySprint[1]).toMatchObject({
      sprintId: sprints[1].sprint_id, demand: 20, supply: 18, gap: -2
    });
    app.teardown();
  });

  it('aggregates total gap SP and FTE equivalent across the deficit window', async () => {
    const { app } = await setup();
    const result = app.Capacity.computeResourcingGap('GCC');
    const de = result.bySkill.find(r => r.skillKey === 'size_engineering');
    expect(de.totalGap).toBe(-14);
    expect(de.gapFte).toBeGreaterThan(0.3);
    expect(de.gapFte).toBeLessThan(0.5);
    app.teardown();
  });

  it('returns zero-FTE rows when supply meets demand', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(1);
    const proj = makeProject({
      name: 'Easy', size_engineering: 10,
      skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [], reasons: [] }] }
    });
    proj.size_total = 10;
    const member = makeMember({ name: 'Alice', available_points_per_sprint: 18 });
    const app = await loadApp(makeDataset({
      projects: [proj], sprints, team_members: [member]
    }));
    const result = app.Capacity.computeResourcingGap('GCC');
    const de = result.bySkill.find(r => r.skillKey === 'size_engineering');
    expect(de.totalGap).toBe(8);
    expect(de.gapFte).toBe(0);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/unit/resourcing-gap.test.mjs
```

Expected: FAIL with `app.Capacity.computeResourcingGap is not a function`.

- [ ] **Step 3: Implement the helper**

Find the `Capacity` module declaration in `index.html` (search for `const Capacity = {` or `Capacity = {`). Locate `renderSprintCapacity` (`index.html:19325`). Insert immediately before that method:

```javascript
  // Resourcing Gap — for each skill, for each sprint in horizon, compute
  // demand (sum of skill_splits points) minus supply (Sprint.calcSkillCapacityForSprint),
  // and translate the aggregated negative gap into an FTE-equivalent at the team's
  // average available_points_per_sprint for members who can do that skill.
  computeResourcingGap(customer) {
    const horizonSprints = (App.data && App.data.sprints) ? App.data.sprints.slice() : [];
    const projects = (App.data && App.data.projects)
      ? App.data.projects.filter(p => !customer || p.customer === customer)
      : [];
    const members = (App.data && App.data.team_members) ? App.data.team_members : [];

    const skills = (typeof Sprint !== 'undefined' && Sprint.SKILLS) ? Sprint.SKILLS : [];
    const skillLabelToKey = {};
    skills.forEach(sk => { skillLabelToKey[sk.label] = sk.key; });

    const bySkill = skills.map(sk => {
      const bySprint = horizonSprints.map(s => {
        const capMap = Sprint.calcSkillCapacityForSprint(customer, s.sprint_id) || {};
        const supply = Math.round(capMap[sk.key] || 0);
        let demand = 0;
        projects.forEach(p => {
          const arr = (p.skill_splits || {})[sk.key];
          if (!Array.isArray(arr)) return;
          arr.forEach(sp => { if (sp.sprint === s.sprint_id) demand += sp.points || 0; });
        });
        return { sprintId: s.sprint_id, demand, supply, gap: supply - demand };
      });
      const totalGap = bySprint.reduce((sum, row) => sum + row.gap, 0);
      const eligible = members.filter(tm => {
        if (customer) {
          const c = (tm.customer || '').toLowerCase();
          if (c !== customer.toLowerCase() && c !== 'both') return false;
        }
        const all = (tm.primary_skills || []).concat(tm.secondary_skills || []);
        return all.some(label => skillLabelToKey[label] === sk.key);
      });
      const avgMemberCap = eligible.length
        ? eligible.reduce((sum, tm) => sum + (tm.available_points_per_sprint || 0), 0) / eligible.length
        : 0;
      const sprintsWithGap = bySprint.filter(r => r.gap < 0).length || 1;
      const gapFte = totalGap < 0 && avgMemberCap > 0
        ? Math.round((Math.abs(totalGap) / sprintsWithGap / avgMemberCap) * 100) / 100
        : 0;
      return {
        skillKey: sk.key,
        skillLabel: sk.label,
        skillShort: sk.short,
        bySprint,
        totalGap,
        gapFte,
        avgMemberCap: Math.round(avgMemberCap * 10) / 10
      };
    });

    return { customer, horizonSprints: horizonSprints.map(s => s.sprint_id), bySkill };
  },

```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test:unit -- tests/unit/resourcing-gap.test.mjs
```

Expected: PASS — all three `it` blocks green.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/resourcing-gap.test.mjs index.html
git commit -m "feat(capacity): computeResourcingGap returns per-skill demand/supply/gap + FTE"
```

---

## Task 7: Resourcing Gap — render the report inside Capacity view

**Files:**
- Modify: `index.html` — add `Capacity.renderResourcingGap()` immediately after `computeResourcingGap` from Task 6
- Modify: `index.html` — add the host element + button to the Capacity view markup
- Test: `tests/render/resourcing-gap.test.mjs` (create)

- [ ] **Step 1: Write the failing render test**

Create `tests/render/resourcing-gap.test.mjs`:

```javascript
// Asserts the gap panel renders with skill rows, sprint cells, total gap and FTE columns.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

describe('Capacity.renderResourcingGap', () => {
  it('renders a gap table with skill rows, sprint cells, FTE column', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({
      name: 'Hungry', size_engineering: 50,
      skill_splits: {
        size_engineering: [
          { sprint: sprints[0].sprint_id, points: 30, status: 'pending', completed: 0, assigned_to: [], reasons: [] },
          { sprint: sprints[1].sprint_id, points: 20, status: 'pending', completed: 0, assigned_to: [], reasons: [] }
        ]
      }
    });
    proj.size_total = 50;
    const member = makeMember({ name: 'Alice', available_points_per_sprint: 18 });
    const app = await loadApp(makeDataset({
      projects: [proj], sprints, team_members: [member]
    }));
    const host = app.window.document.createElement('div');
    host.id = 'capacityGapPanel';
    app.window.document.body.appendChild(host);
    app.Capacity.renderResourcingGap('GCC');
    expect(host.innerHTML).toMatch(/Resourcing Gap/);
    expect(host.innerHTML).toMatch(/Data Engineering/);
    expect(host.innerHTML).toMatch(/-14/);
    expect(host.innerHTML).toMatch(/FTE/);
    expect(host.innerHTML).toMatch(/-12/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/render/resourcing-gap.test.mjs
```

Expected: FAIL with `app.Capacity.renderResourcingGap is not a function`.

- [ ] **Step 3: Implement the renderer**

In `index.html` insert immediately after `computeResourcingGap` (Task 6):

```javascript
  renderResourcingGap(customer) {
    const host = document.getElementById('capacityGapPanel');
    if (!host) return;
    const cust = customer || App.activeCustomer;
    if (!cust) {
      host.innerHTML = '<div style="padding:14px;color:var(--text-muted);font-size:12px">Select a customer to see gap analysis.</div>';
      return;
    }
    const result = this.computeResourcingGap(cust);
    const sprints = result.horizonSprints;
    const esc = Dashboard.esc;

    let html = '<div style="padding:6px 0 12px"><div style="font-size:13px;font-weight:700">Resourcing Gap — ' + esc(cust) + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted)">Demand minus supply per skill per sprint. Negative numbers are red and indicate where you need more capacity. <strong>FTE</strong> = average extra full-time engineer needed across the deficit window.</div></div>';

    html += '<div style="overflow-x:auto"><table class="alloc-plan-table" style="width:100%;border-collapse:collapse;font-size:12px">' +
      '<thead><tr style="background:var(--surface-2);border-bottom:1px solid var(--border-light)">' +
        '<th style="padding:8px 10px;text-align:left;width:18%">Skill</th>';
    sprints.forEach(sid => {
      html += '<th style="padding:8px 10px;text-align:center">' + esc(sid.replace(/^CY\d+-/, '')) + '</th>';
    });
    html += '<th style="padding:8px 10px;text-align:center">Total gap (SP)</th>' +
            '<th style="padding:8px 10px;text-align:center">FTE</th>' +
            '</tr></thead><tbody>';

    result.bySkill.forEach(row => {
      const color = (Sprint.SKILL_COLORS && Sprint.SKILL_COLORS[row.skillKey]) || '#666';
      html += '<tr><td style="padding:8px 10px;font-weight:600;color:' + color + '">' + esc(row.skillLabel) + '</td>';
      row.bySprint.forEach(cell => {
        let bg, fg;
        if (cell.demand === 0 && cell.supply === 0) { bg = 'transparent'; fg = 'var(--text-muted)'; }
        else if (cell.gap < 0) { bg = 'var(--tint-red-weak)'; fg = 'var(--status-red)'; }
        else if (cell.gap < cell.supply * 0.2) { bg = 'var(--tint-amber-weak)'; fg = 'var(--status-amber)'; }
        else { bg = 'var(--tint-green-weak)'; fg = 'var(--status-green)'; }
        const display = (cell.demand === 0 && cell.supply === 0)
          ? '—'
          : (cell.gap < 0 ? cell.gap : '+' + cell.gap) + '<div style="font-size:9px;font-weight:400;color:var(--text-muted)">' + cell.demand + '/' + cell.supply + '</div>';
        html += '<td style="padding:6px 10px;text-align:center;background:' + bg + ';color:' + fg + ';font-weight:700">' + display + '</td>';
      });
      const totalCls = row.totalGap < 0 ? 'var(--status-red)' : 'var(--status-green)';
      html += '<td style="padding:8px 10px;text-align:center;font-weight:700;color:' + totalCls + '">' + (row.totalGap < 0 ? row.totalGap : '+' + row.totalGap) + '</td>';
      html += '<td style="padding:8px 10px;text-align:center;font-weight:700">' + (row.gapFte > 0 ? '+' + row.gapFte.toFixed(2) : '—') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    host.innerHTML = html;
  },

```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test:unit -- tests/render/resourcing-gap.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Add the host element + button to the Capacity view markup**

In `index.html` find the Capacity view's markup container (search for `<div id="sprintCapGrid"`). After the closing `</div>` of the section that contains `sprintCapGrid`, insert:

```html
        <div style="margin-top:18px">
          <button class="btn btn-outline btn-sm" onclick="Capacity.renderResourcingGap()">Gap Analysis</button>
          <div id="capacityGapPanel" style="margin-top:10px"></div>
        </div>
```

- [ ] **Step 6: Wire the auto-render on Capacity.render**

Find the `Capacity` module's top-level render method (the one that calls `renderSprintCapacity()` and `renderTeamGrid()`). Immediately after those two calls, add:

```javascript
    if (document.getElementById('capacityGapPanel')) {
      this.renderResourcingGap(App.activeCustomer);
    }
```

- [ ] **Step 7: Manual smoke test**

Open `index.html` in a browser, load `portfolio-data.json`, switch to Capacity. Verify:
1. *Gap Analysis* button is visible.
2. Clicking it (or simply switching customer) renders a per-skill table with at least one red cell (sample data has known deficit).
3. FTE column shows a numeric value for the deficit skill.

- [ ] **Step 8: Commit**

```bash
git add tests/render/resourcing-gap.test.mjs index.html
git commit -m "feat(capacity): Resourcing Gap report — per-skill demand/supply/gap with FTE"
```

---

## Task 8: Executive Summary — at-risk count includes Red RAG

**Why:** `Dashboard.renderExecSummary` (`index.html:8810-8811`) computes `atRisk` and `blocked` purely from `p.status`. A project with Red `rag_schedule` but `In Progress` status reads as zero-at-risk in the narrative while the RAG-mix tile shows reds. We unify: at-risk includes any Red RAG OR `status === 'At Risk'`. Blocked stays operational (`status === 'Blocked'`).

**Files:**
- Modify: `index.html:8810-8811`
- Test: `tests/render/exec-summary.test.mjs` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/render/exec-summary.test.mjs`:

```javascript
// Executive Summary at-risk count must include Red RAG, not only status=At Risk.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function bootstrap(project) {
  resetIdSeq();
  const sprints = makeSprintSequence(2);
  const app = await loadApp(makeDataset({
    projects: [project], sprints, team_members: [makeMember()]
  }));
  const host = app.window.document.createElement('div');
  host.id = 'execSummary';
  app.window.document.body.appendChild(host);
  app.App.activeCustomer = 'GCC';
  app.Dashboard.renderExecSummary();
  return { app, host };
}

describe('Dashboard.renderExecSummary — RAG/status reconciliation', () => {
  it('counts a Red-RAG / In-Progress project as "at risk"', async () => {
    const proj = makeProject({
      name: 'Red on schedule', status: 'In Progress',
      rag_schedule: 'Red', rag_resourcing: 'Green', rag_scope: 'Green'
    });
    proj.size_total = 5;
    const { app, host } = await bootstrap(proj);
    expect(host.innerHTML).not.toMatch(/0 at risk/);
    expect(host.innerHTML).toMatch(/1 at risk/);
    app.teardown();
  });

  it('still counts status=At Risk projects as at risk (back-compat)', async () => {
    const proj = makeProject({ name: 'Status at risk', status: 'At Risk' });
    proj.size_total = 5;
    const { app, host } = await bootstrap(proj);
    expect(host.innerHTML).toMatch(/1 at risk/);
    app.teardown();
  });

  it('does not double-count when status=At Risk AND RAG=Red', async () => {
    const proj = makeProject({
      name: 'Both', status: 'At Risk', rag_schedule: 'Red'
    });
    proj.size_total = 5;
    const { app, host } = await bootstrap(proj);
    expect(host.innerHTML).toMatch(/1 at risk/);
    expect(host.innerHTML).not.toMatch(/2 at risk/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/render/exec-summary.test.mjs
```

Expected: FAIL — first case fails ("0 at risk" present).

- [ ] **Step 3: Update the at-risk computation**

In `index.html` find:

```javascript
    const atRisk = active.filter(p => p.status === 'At Risk').length;
    const blocked = active.filter(p => p.status === 'Blocked').length;
```

Replace with:

```javascript
    // A project is at-risk if any RAG dimension is Red OR status is At Risk.
    // De-duplicated by id so a Red-RAG / At-Risk project counts once.
    const atRisk = active.filter(p =>
      p.status === 'At Risk' ||
      p.rag_schedule === 'Red' ||
      p.rag_resourcing === 'Red' ||
      p.rag_scope === 'Red'
    ).length;
    const blocked = active.filter(p => p.status === 'Blocked').length;
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test:unit -- tests/render/exec-summary.test.mjs
```

Expected: PASS — all three `it` blocks green.

- [ ] **Step 5: Run the full unit suite**

```bash
npm run test:unit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/render/exec-summary.test.mjs index.html
git commit -m "fix(dashboard): exec summary at-risk count includes Red RAG, not only status"
```

---

## Task 9: End-to-end smoke (Playwright) — Cancel-revert + Gap Analysis

**Files:**
- Create: `tests/e2e/p0-flows.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/p0-flows.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test.describe('P0 — Auto-Allocate Cancel revert', () => {
  test('cancel restores skill_splits to pre-preview state', async ({ page }) => {
    await openAppWithData(page);
    const before = await page.evaluate(() => {
      return JSON.stringify(window.App.data.projects.map(p => ({ id: p.id, splits: p.skill_splits })));
    });
    await page.evaluate(() => window.Sprint.autoAllocate());
    await page.evaluate(() => window.Sprint.runAllocationFromOptions());
    await page.evaluate(() => window.Sprint.closeAllocResults());
    const after = await page.evaluate(() => {
      return JSON.stringify(window.App.data.projects.map(p => ({ id: p.id, splits: p.skill_splits })));
    });
    expect(after).toBe(before);
  });
});

test.describe('P0 — Resourcing Gap report renders', () => {
  test('gap panel shows skill rows after clicking Gap Analysis', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => window.App.navigate('capacity'));
    await page.locator('button:has-text("Gap Analysis")').first().click();
    const panel = page.locator('#capacityGapPanel');
    await expect(panel).toContainText(/Resourcing Gap/);
    await expect(panel).toContainText(/FTE/);
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
npm run test:e2e -- p0-flows.spec.ts
```

Expected: PASS — both tests green.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/p0-flows.spec.ts
git commit -m "test(e2e): cancel revert + Gap Analysis smoke covers P0 user flows"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run the full suite**

```bash
npm test
```

Expected: PASS — unit + e2e.

- [ ] **Step 2: Manual verification**

Open `index.html` in a browser. Confirm:
1. Auto-Allocate → run → Cancel leaves the Sprint Planning grid identical to before.
2. Set Baseline on the Roadmap, then change a project's `target_date` and re-render — Movers Legend shows the project with a non-zero day delta.
3. Capacity view shows a *Gap Analysis* button; clicking it renders a per-skill / per-sprint table with FTE column.
4. Dashboard Executive Summary, on a project with Red `rag_schedule` and `In Progress` status, says "1 at risk" not "0 at risk".

- [ ] **Step 3: Push (if working on a feature branch)**

Only if the user has explicitly said to push. Otherwise stop after the local commits.

---

## Self-review checklist

- [ ] Auto-Allocate: open the alloc modal, run, cancel — `App.data.projects[*].skill_splits` byte-equal to pre-open state.
- [ ] Auto-Allocate: open the alloc modal, run, apply — `pendingAllocation` and `_allocPreviewSnapshot` both nulled and the new splits persisted.
- [ ] Set Baseline (Roadmap) writes `start_date`, `target_date`, `hard_deadline`, `size_total`, and per-skill sizes into the snapshot for every customer-scoped project.
- [ ] Movers Legend, with one project's `target_date` slipped, says "1 moved right" with a day delta.
- [ ] Variance Report, with the same setup, returns the slipped project at top with the correct `endDrift`.
- [ ] Capacity view *Gap Analysis* button renders a table; sample-data deficit cell is red; FTE column is numeric.
- [ ] Executive Summary on a Red-RAG / In-Progress project says "1 at risk" not "0 at risk".
- [ ] `npm test` is green.
