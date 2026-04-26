# Team View Transfer & Capacity Consolidation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this in-session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Sprint Planning → Team toggle the canonical place for per-person sprint work, with a capacity summary surfaced inline, slice transfer available from every Team-tab chip, and a hard guard that blocks or warns on moves that violate phase order, per-person cap, skill cap, or hard-deadline constraints.

**Architecture:** Leverage the primitives already in the codebase:
- `Sprint.moveSkillToSprint(projectId, skillKey, fromSprint, toSprint, points)` is the existing slice-move primitive — we add a validator in front of it.
- `Sprint.openChipContext` / `Sprint.openChipMenu` already expose Move + Assign on every chip. The Team swimlane chips share the same class (`.sl-skill-chip`) so the context menu already works there; just confirm wiring.
- `Capacity.getCustomerUtil(customer, sprintId)` (or the inline per-sprint aggregation done by `calcSkillCapacityForSprint`) is the source of truth for utilisation %.

Fits the existing single-file pattern: all changes land inside `index.html`, scoped to the `Sprint` module (view rendering + validator), with 1 helper added to `App` for cross-module reuse.

**Tech Stack:** Single-file vanilla JS. Tests via vitest + jsdom.

**Scope boundaries (YAGNI):**
- Read-only capacity summary in Team tab — not a live editor. Edits still happen in the Capacity view (with a "Edit capacity" link into it).
- Validator returns `{ ok, warnings, hardFail }`. On `hardFail`, the move is refused with a toast. On soft warnings, a confirm dialog lists the issues before proceeding. No drag-target colouring, no live preview.
- No drag-drop between people inside Team view yet — the Move action already exists and is the minimum viable surface.

---

## File Structure

Only one file changes: `index.html`. Three logical regions:
1. A new `Sprint._validateSliceMove` method.
2. Intercept layer on `Sprint.moveSkillToSprint` + `Sprint._saveChipMove` to consult the validator.
3. A new capacity-strip render helper at the top of `Sprint.renderTeamSwimlane`.

Tests: `tests/unit/sprint-move-validator.test.mjs` (new).

---

## Task 1: Validator — unit test for hard-fail on skill capacity overflow

**Files:**
- Create: `tests/unit/sprint-move-validator.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMember, makeProject, makeSprintSequence } from '../harness/fixtures.mjs';

describe('Sprint._validateSliceMove', () => {
  it('hard-fails when destination sprint has zero skill capacity for this skill', async () => {
    const app = await loadApp(makeDataset({
      team_members: [makeMember({ name: 'Alice', available_points_per_sprint: 10, primary_skills: ['Data Engineering'] })],
      sprints: makeSprintSequence(3),
      projects: [makeProject({ id: 'GCC-A', size_engineering: 10 })]
    }));
    // Precondition: capacity for Tableau is zero (no tableau-skilled member)
    const res = app.Sprint._validateSliceMove({ projectId: 'GCC-A', skillKey: 'size_tableau', fromSprint: 'CY26-S1', toSprint: 'CY26-S2', points: 5 });
    expect(res.hardFail).toBe(true);
    expect(res.warnings.some(w => /no capacity/i.test(w))).toBe(true);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/unit/sprint-move-validator.test.mjs`
Expected: FAIL — `Sprint._validateSliceMove is not a function`.

## Task 2: Validator — unit test for soft warning on phase-order inversion

**Files:**
- Modify: `tests/unit/sprint-move-validator.test.mjs`

- [ ] **Step 1: Add the test**

```javascript
  it('emits phase-order warning when moving a later-phase slice earlier than an earlier phase', async () => {
    const app = await loadApp(makeDataset({
      team_members: [makeMember({ name: 'Alice', available_points_per_sprint: 20, primary_skills: ['Requirements', 'Data Engineering', 'UAT'] })],
      sprints: makeSprintSequence(3),
      projects: [(() => {
        const p = makeProject({
          id: 'GCC-PH',
          size_requirements: 5,
          size_engineering: 5,
          size_uat_adoption: 5,
          delivery_config: { phase_order: ['Requirements', 'Data Engineering', 'UAT'] }
        });
        p.skill_splits = {
          size_requirements: [{ sprint: 'CY26-S1', points: 5, status: 'pending' }],
          size_engineering:  [{ sprint: 'CY26-S2', points: 5, status: 'pending' }],
          size_uat_adoption: [{ sprint: 'CY26-S3', points: 5, status: 'pending' }]
        };
        return p;
      })()]
    }));
    // Moving UAT from S3 to S1 would land it before Data Engineering (S2) — phase-order violation.
    const res = app.Sprint._validateSliceMove({ projectId: 'GCC-PH', skillKey: 'size_uat_adoption', fromSprint: 'CY26-S3', toSprint: 'CY26-S1', points: 5 });
    expect(res.hardFail).toBe(false);
    expect(res.warnings.some(w => /phase order|earlier phase|before/i.test(w))).toBe(true);
    app.teardown();
  });
```

- [ ] **Step 2: Run** — expect same "function not defined" failure as Task 1.

## Task 3: Validator — unit test for hard deadline violation

**Files:**
- Modify: `tests/unit/sprint-move-validator.test.mjs`

- [ ] **Step 1: Add the test**

```javascript
  it('hard-fails when destination sprint is after the project hard deadline', async () => {
    const sprints = (() => {
      const seq = [];
      const makeSp = (i, start) => {
        const startD = new Date(start); startD.setDate(startD.getDate() + i * 35);
        const hard = new Date(startD); hard.setDate(hard.getDate() + 28);
        const end  = new Date(startD); end.setDate(end.getDate() + 34);
        return { sprint_id: 'CY26-S' + (i + 1), start_date: startD.toISOString().slice(0, 10), hardening_start: hard.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) };
      };
      for (let i = 0; i < 3; i++) seq.push(makeSp(i, '2026-01-05'));
      return seq;
    })();
    const p = makeProject({ id: 'GCC-DL', size_engineering: 5, hard_deadline: sprints[0].end_date });
    p.skill_splits = { size_engineering: [{ sprint: 'CY26-S1', points: 5, status: 'pending' }] };
    const app = await loadApp(makeDataset({
      team_members: [makeMember({ available_points_per_sprint: 10 })],
      sprints,
      projects: [p]
    }));
    const res = app.Sprint._validateSliceMove({ projectId: 'GCC-DL', skillKey: 'size_engineering', fromSprint: 'CY26-S1', toSprint: 'CY26-S3', points: 5 });
    expect(res.hardFail).toBe(true);
    expect(res.warnings.some(w => /deadline/i.test(w))).toBe(true);
    app.teardown();
  });
```

- [ ] **Step 2: Run** — expect same failure.

## Task 4: Validator — implement `Sprint._validateSliceMove`

**Files:**
- Modify: `index.html` — add new method inside the `Sprint` object, next to `moveSkillToSprint` (around line 17319).

- [ ] **Step 1: Insert the validator before `moveSkillToSprint`**

```javascript
  // Checks whether a proposed slice move would violate any of the solver's hard guards or
  // ordering conventions. Called by _saveChipMove and the Team view's move action before
  // handing the move to moveSkillToSprint. `hardFail: true` means refuse the move;
  // otherwise `warnings` lists soft issues to present via confirm().
  _validateSliceMove({ projectId, skillKey, fromSprint, toSprint, points }) {
    const out = { ok: true, hardFail: false, warnings: [] };
    const p = App.data && App.data.projects ? App.data.projects.find(pr => pr.id === projectId) : null;
    if (!p) { out.hardFail = true; out.warnings.push('Project not found'); return out; }
    const sprints = (App.data && App.data.sprints) || [];
    const sprintIdx = sid => sprints.findIndex(s => s.sprint_id === sid);
    const fromIdx = sprintIdx(fromSprint);
    const toIdx = sprintIdx(toSprint);
    if (toIdx < 0) { out.hardFail = true; out.warnings.push('Destination sprint is not in the horizon'); return out; }

    // Skill capacity at destination.
    const skillLabel = (this.SKILLS.find(s => s.key === skillKey) || {}).label || skillKey;
    const capMap = this.calcSkillCapacityForSprint(p.customer, toSprint) || {};
    const skillCap = capMap[skillKey] || 0;
    if (skillCap <= 0) {
      out.hardFail = true;
      out.warnings.push('No capacity for ' + skillLabel + ' in ' + toSprint.replace(/^CY\d+-/, '') + ' (no skilled member or all on leave).');
    }

    // Hard deadline.
    if (p.hard_deadline) {
      const dlIdx = (typeof Solver !== 'undefined' && Solver.dateToSprintIdx)
        ? Solver.dateToSprintIdx(p.hard_deadline, sprints) : -1;
      if (dlIdx >= 0 && toIdx > dlIdx) {
        out.hardFail = true;
        const dl = new Date(p.hard_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        out.warnings.push('Destination is after the hard deadline (' + dl + ').');
      }
    }

    // Phase-order check against existing sibling slices of this project.
    const phaseMap = (typeof Solver !== 'undefined' && Solver.getProjectPhaseMap) ? Solver.getProjectPhaseMap(p) : {};
    const movedPhase = phaseMap[skillKey];
    if (movedPhase) {
      Object.keys(p.skill_splits || {}).forEach(otherKey => {
        if (otherKey === skillKey) return;
        const otherPhase = phaseMap[otherKey];
        if (!otherPhase) return;
        (p.skill_splits[otherKey] || []).forEach(sp => {
          const idx = sprintIdx(sp.sprint);
          if (idx < 0) return;
          // If a LATER phase already sits at or before the destination, moving this (earlier-phase)
          // slice forward would cross the later phase. If the destination is BEFORE an earlier phase's
          // sprint, we'd invert the order the other way.
          if (otherPhase > movedPhase && idx <= toIdx) {
            out.warnings.push(skillLabel + ' would land in or after ' + (this.SKILLS.find(s => s.key === otherKey) || {}).label + ' (phase ' + otherPhase + ' in ' + sp.sprint.replace(/^CY\d+-/, '') + ').');
          }
          if (otherPhase < movedPhase && idx > toIdx) {
            out.warnings.push(skillLabel + ' would start before ' + (this.SKILLS.find(s => s.key === otherKey) || {}).label + ' finishes in ' + sp.sprint.replace(/^CY\d+-/, '') + '.');
          }
        });
      });
    }

    // Priority / recommendation mismatch: flag only if moving a higher-priority project's slice LATER
    // while a lower-priority project holds earlier slots for the same skill. Soft warning only.
    if (fromIdx >= 0 && toIdx > fromIdx) {
      const myPri = p.priority || 999;
      (App.data.projects || []).forEach(other => {
        if (other.id === p.id) return;
        if (other.customer !== p.customer) return;
        const otherPri = other.priority || 999;
        if (otherPri <= myPri) return;
        (((other.skill_splits || {})[skillKey]) || []).forEach(sp => {
          const idx = sprintIdx(sp.sprint);
          if (idx < 0 || idx >= toIdx) return;
          out.warnings.push('Lower-priority project "' + (other.name || other.id) + '" already holds ' + skillLabel + ' capacity in ' + sp.sprint.replace(/^CY\d+-/, '') + ' — moving this slice later surrenders the earlier slot.');
        });
      });
    }

    if (out.hardFail) out.ok = false;
    return out;
  },
```

- [ ] **Step 2: Run the three validator tests**

Run: `npx vitest run tests/unit/sprint-move-validator.test.mjs`
Expected: all three PASS.

## Task 5: Intercept `_saveChipMove` to consult the validator

**Files:**
- Modify: `index.html:17198–17208` (the `_saveChipMove` body).

- [ ] **Step 1: Replace the body**

```javascript
  _saveChipMove(projectId, skillKey, fromSprint) {
    const p = App.data.projects.find(pr => pr.id === projectId);
    if (!p) { this._closeChipMove(); return; }
    const targetEl = document.getElementById('chipMoveTarget');
    const toSprint = targetEl ? targetEl.value : '';
    if (!toSprint || toSprint === fromSprint) { this._closeChipMove(); return; }
    const entry = (p.skill_splits && p.skill_splits[skillKey] || []).find(sp => sp.sprint === fromSprint);
    const points = entry ? (entry.points || 0) : 0;
    const verdict = this._validateSliceMove({ projectId, skillKey, fromSprint, toSprint, points });
    if (verdict.hardFail) {
      this._closeChipMove();
      App.toast('Move refused: ' + verdict.warnings.slice(0, 2).join(' · '), 'error', 5000);
      return;
    }
    if (verdict.warnings.length) {
      const proceed = confirm('This move has warnings:\n\n• ' + verdict.warnings.join('\n• ') + '\n\nProceed anyway?');
      if (!proceed) { this._closeChipMove(); return; }
    }
    this._closeChipMove();
    this.moveSkillToSprint(projectId, skillKey, fromSprint, toSprint, points);
  },
```

- [ ] **Step 2: Sanity check with full test suite**

Run: `npm test`
Expected: 76+ unit/render + 5 e2e all pass.

## Task 6: Confirm Team-view chips surface the same context menu

**Files:**
- Inspect: `index.html` — search for `.sl-skill-chip` usage inside `renderTeamSwimlane` (around index.html:16393+).

- [ ] **Step 1: Grep + manual verify**

```bash
grep -n "sl-skill-chip" /Users/zaza/Documents/Projects/portfolio-command-centre/index.html | head
```

If Team view chips already use the same class and onclick→openChipMenu wiring as Projects view, Move is already available. If not, add the identical onclick handler so the menu opens on both views' chips.

- [ ] **Step 2: Manual test**

Open `index.html` in a browser, navigate to Sprint Planning → Team, right-click a chip. Confirm "Move to sprint…" is available and invokes the validator.

## Task 7: Capacity summary strip at the top of Team view

**Files:**
- Modify: `index.html` — inside `Sprint.renderTeamSwimlane` just after the empty-state early return (around line 16391).

- [ ] **Step 1: Emit the strip before the swimlane rows**

```javascript
    // Per-person utilisation summary — sits above the swimlane so the PM gets the headline
    // (is anyone over/under?) before they scan the cells. Read-only; the full Capacity editor
    // is one click away via the "Edit capacity" link.
    const utilRows = members.map(tm => {
      const cells = sprints.map(s => {
        const mc = this.calcMemberCapacityForSprint(tm, s.sprint_id, customer);
        const cap = mc ? mc.points : 0;
        const used = ((byPerson[tm.name] && byPerson[tm.name][s.sprint_id]) || []).reduce((sum, it) => sum + (it.points || 0), 0);
        const pct = cap > 0 ? Math.round((used / cap) * 100) : 0;
        const tone = pct > 100 ? 'var(--status-red)' : pct > 85 ? 'var(--status-amber)' : pct > 0 ? 'var(--status-green)' : 'var(--text-muted)';
        return '<div style="flex:1;min-width:0;padding:4px 6px;text-align:center;font-size:10px;color:' + tone + ';font-weight:700;border-right:1px solid var(--border-dim)">' + (cap > 0 ? used + '/' + cap : '—') + '<div style="font-size:9px;font-weight:500;opacity:0.8">' + (cap > 0 ? pct + '%' : 'no cap') + '</div></div>';
      }).join('');
      return '<div style="display:flex;align-items:stretch;border-bottom:1px solid var(--border-dim)"><div style="width:160px;padding:6px 10px;font-size:11px;font-weight:600;color:var(--text-dark);border-right:1px solid var(--border-dim);background:var(--bg-content)">' + Dashboard.esc(tm.name) + '</div>' + cells + '</div>';
    }).join('');
    const capStripHtml =
      '<div style="background:white;border:1px solid var(--border-light);border-radius:var(--radius-md);margin-bottom:12px;overflow:hidden">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border-dim);background:var(--bg-content)">' +
          '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)">Team capacity · used / total (% used)</div>' +
          '<button class="btn btn-ghost btn-sm" onclick="App.navigate(\'capacity\')" title="Open the full Capacity editor">Edit capacity</button>' +
        '</div>' +
        '<div style="display:flex;align-items:stretch;border-bottom:2px solid var(--border-light);background:var(--bg-content)">' +
          '<div style="width:160px;padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);border-right:1px solid var(--border-dim)">Member</div>' +
          sprints.map(s => '<div style="flex:1;min-width:0;padding:6px;text-align:center;font-size:10px;font-weight:700;color:var(--text-muted);border-right:1px solid var(--border-dim)">' + s.sprint_id.replace(/^CY\d+-/, '') + '</div>').join('') +
        '</div>' +
        utilRows +
      '</div>';
    board.insertAdjacentHTML('afterbegin', capStripHtml);
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: no regressions.

- [ ] **Step 3: Commit all tasks together**

```bash
git add index.html tests/unit/sprint-move-validator.test.mjs \
  docs/superpowers/plans/2026-04-20-team-view-transfer-warnings.md
git commit -m "feat(sprint): team-view capacity strip + validated slice transfer"
```

---

## Self-review

**1. Spec coverage**:
- "Move capacity into Sprint Planning → Team tab" → Task 7 emits a per-person utilisation strip at the top of Team view with an "Edit capacity" link to the full Capacity editor. ✔
- "Allow shifts from team view as well as project view" → The Move menu already works in both views (Task 6 verifies); the same primitive handles both. ✔
- "Warnings on delivery flow / capacity / priority violations" → Validator in Task 4 covers zero-capacity (hard fail), phase-order in both directions (soft warnings), hard-deadline (hard fail), and lower-priority slot-surrender (soft warning). Wired into the chip-move flow in Task 5. ✔

**2. Placeholder scan**: no TBD / "handle edge cases" / unreferenced identifiers. Every code block is complete. ✔

**3. Type consistency**: `_validateSliceMove` signature `{ projectId, skillKey, fromSprint, toSprint, points }` is used identically in every call site (Task 4 definition, Task 5 consumer, Task 6 verification). Return shape `{ ok, hardFail, warnings }` is used consistently. ✔

## Execution handoff

Plan saved at `docs/superpowers/plans/2026-04-20-team-view-transfer-warnings.md`. Two execution options:

1. **Inline execution** (recommended for this plan) — the three tasks share context and the validator is the anchor.
2. **Subagent per task** — fresher context per task at the cost of more re-reading.

Recommend inline.
