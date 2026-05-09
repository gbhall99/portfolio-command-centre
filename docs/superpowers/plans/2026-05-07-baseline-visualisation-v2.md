# Baseline visualisation v2 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bracket-above-bar baseline pattern with stacked plan/actual lanes, per-phase culprit attribution in Detailed mode, humanised hover text, and concentrate rich slip commentary on the ±d/±w pills.

**Architecture:** All app code is in `index.html` (single-file zero-dep app). Changes touch CSS (~lines 1330–1380), Gantt rendering (lines 16881–16917 for project header; 17050+ for phase sub-rows), and the hover handlers (lines 15902–16380). Tests under `tests/render/` and `tests/unit/` use vitest+jsdom; one e2e under `tests/e2e/` uses Playwright. New helper functions go on the `Gantt` object so they share its scope.

**Tech Stack:** Vanilla JS / inline SVG / CSS custom properties / vitest + jsdom + Playwright. No bundler.

**Spec:** [docs/superpowers/specs/2026-05-07-baseline-visualisation-v2-design.md](../specs/2026-05-07-baseline-visualisation-v2-design.md)

---

## File map

All implementation lives in:
- `index.html` — touched in three regions:
  - **CSS** ~lines 1330–1380 — replace `.gantt-baseline-bracket` block + `.gantt-bar` `top` with new classes (`gantt-plan-lane`, `gantt-phase-plan-lane`, `gantt-move-arrow`, `gantt-phase-tag`, `gantt-phase-status-dot`, `gantt-phase-name-tag`, `gantt-phase-overlay-culprit`, `gantt-drift-line`).
  - **Gantt object** ~lines 15700–17400 — add `_formatSlip`, `_humaniseField`, `_FIELD_LABELS`, `_phaseSpans` helpers; rewrite the baseline render block (around 16881–16917); add per-phase culprit rendering inside the Detailed-mode loop (around 17050+); rewrite `buildPlanVsActual` and `buildTooltip` for the new hover types.

Tests:
- `tests/unit/gantt-baseline-helpers.test.mjs` — NEW, covers `_formatSlip`, `_humaniseField`, `_phaseSpans`.
- `tests/render/gantt-baseline.test.mjs` — REWRITE for new plan-lane pattern (asserts `.gantt-plan-lane`, `.gantt-move-arrow`, `.gantt-delta-pill`, week format).
- `tests/render/gantt-baseline-hover.test.mjs` — UPDATE: hover the pill not the bar; assert humanised labels; assert no "set by" text.
- `tests/render/gantt-baseline-detailed.test.mjs` — NEW, asserts detailed-mode culprit attribution.
- `tests/e2e/gantt-baseline.spec.ts` — UPDATE: hover the `.gantt-delta-pill` instead of the bracket; assert tooltip contains "Slip contributors".

---

## Task 1: Add slip-formatting + field-humanising helpers (TDD)

**Files:**
- Modify: `index.html` (Gantt object, near line 15700 where Gantt's other helpers live)
- Create: `tests/unit/gantt-baseline-helpers.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/gantt-baseline-helpers.test.mjs`:
```js
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';

describe('Gantt._formatSlip', () => {
  it('formats day slips for ±1 to ±6', async () => {
    const app = await loadApp();
    expect(app.Gantt._formatSlip(0)).toBe('on plan');
    expect(app.Gantt._formatSlip(1)).toBe('+1d');
    expect(app.Gantt._formatSlip(6)).toBe('+6d');
    expect(app.Gantt._formatSlip(-1)).toBe('−1d');
    expect(app.Gantt._formatSlip(-6)).toBe('−6d');
    app.teardown();
  });

  it('formats whole weeks for multiples of 7', async () => {
    const app = await loadApp();
    expect(app.Gantt._formatSlip(7)).toBe('+1w');
    expect(app.Gantt._formatSlip(14)).toBe('+2w');
    expect(app.Gantt._formatSlip(21)).toBe('+3w');
    expect(app.Gantt._formatSlip(-7)).toBe('−1w');
    expect(app.Gantt._formatSlip(-14)).toBe('−2w');
    app.teardown();
  });

  it('formats weeks-and-days for non-multiples ≥ 7', async () => {
    const app = await loadApp();
    expect(app.Gantt._formatSlip(8)).toBe('+1w 1d');
    expect(app.Gantt._formatSlip(10)).toBe('+1w 3d');
    expect(app.Gantt._formatSlip(13)).toBe('+1w 6d');
    expect(app.Gantt._formatSlip(15)).toBe('+2w 1d');
    expect(app.Gantt._formatSlip(25)).toBe('+3w 4d');
    expect(app.Gantt._formatSlip(-10)).toBe('−1w 3d');
    app.teardown();
  });
});

describe('Gantt._humaniseField', () => {
  it('returns mapped labels for known fields', async () => {
    const app = await loadApp();
    expect(app.Gantt._humaniseField('size_data_engineering')).toBe('Data Engineering scope');
    expect(app.Gantt._humaniseField('size_engineering')).toBe('Data Engineering scope');
    expect(app.Gantt._humaniseField('size_total')).toBe('Total scope');
    expect(app.Gantt._humaniseField('size_uat_adoption')).toBe('UAT scope');
    expect(app.Gantt._humaniseField('size_tableau')).toBe('Tableau scope');
    expect(app.Gantt._humaniseField('size_data_science')).toBe('Data Science scope');
    expect(app.Gantt._humaniseField('size_requirements')).toBe('Requirements scope');
    expect(app.Gantt._humaniseField('target_date')).toBe('Target date');
    expect(app.Gantt._humaniseField('start_date')).toBe('Start date');
    expect(app.Gantt._humaniseField('hard_deadline')).toBe('Hard deadline');
    expect(app.Gantt._humaniseField('rag_schedule')).toBe('Schedule RAG');
    expect(app.Gantt._humaniseField('rag_resourcing')).toBe('Resourcing RAG');
    expect(app.Gantt._humaniseField('rag_scope')).toBe('Scope RAG');
    expect(app.Gantt._humaniseField('moscow')).toBe('MoSCoW priority');
    expect(app.Gantt._humaniseField('skill_splits')).toBe('Sprint allocation');
    expect(app.Gantt._humaniseField('governance_forum')).toBe('Meeting');
    expect(app.Gantt._humaniseField('manager')).toBe('Manager');
    app.teardown();
  });

  it('falls back to title-case for unknown fields', async () => {
    const app = await loadApp();
    expect(app.Gantt._humaniseField('phase_order')).toBe('Phase Order');
    expect(app.Gantt._humaniseField('made_up_field')).toBe('Made Up Field');
    app.teardown();
  });

  it('returns the input unchanged for null / empty', async () => {
    const app = await loadApp();
    expect(app.Gantt._humaniseField('')).toBe('');
    expect(app.Gantt._humaniseField(null)).toBe('');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm run test:unit -- gantt-baseline-helpers.test.mjs`
Expected: FAIL — `Gantt._formatSlip is not a function` and `Gantt._humaniseField is not a function`.

- [ ] **Step 3: Add the helpers to the Gantt object**

In `index.html`, find the Gantt object's existing helper section near line 15700 (search for `_projectBaselineSpan` — that's the reference landmark). Add these methods/properties at the SAME indentation level as the other Gantt methods (above `_projectBaselineSpan` is fine):

```js
  // Format a day-slip count into business-friendly text. Days ≤ 6 stay in days; ≥ 7
  // become weeks (whole-week shorthand when divisible, "+Xw Yd" otherwise). Used by the
  // delta pill, per-phase tags, and the hover tooltips.
  _formatSlip(days) {
    if (!days || days === 0) return 'on plan';
    const abs = Math.abs(days);
    const sign = days > 0 ? '+' : '−'; // U+2212 minus, matching the existing pattern
    if (abs <= 6) return sign + abs + 'd';
    const weeks = Math.floor(abs / 7);
    const rem = abs % 7;
    if (rem === 0) return sign + weeks + 'w';
    return sign + weeks + 'w ' + rem + 'd';
  },

  // Map of audit-log field names to user-facing labels. Anything not in the map falls
  // back to title-cased words via _humaniseField.
  _FIELD_LABELS: {
    size_total:                 'Total scope',
    size_requirements:          'Requirements scope',
    size_engineering:           'Data Engineering scope',
    size_data_engineering:      'Data Engineering scope', // legacy alias
    size_data_science:          'Data Science scope',
    size_tableau:               'Tableau scope',
    size_uat_adoption:          'UAT scope',
    target_date:                'Target date',
    start_date:                 'Start date',
    hard_deadline:              'Hard deadline',
    rag_schedule:               'Schedule RAG',
    rag_resourcing:             'Resourcing RAG',
    rag_scope:                  'Scope RAG',
    status:                     'Status',
    manager:                    'Manager',
    priority:                   'Priority',
    business_value:             'Business value',
    time_criticality:           'Time criticality',
    risk_reduction_opportunity: 'Risk reduction opportunity',
    moscow:                     'MoSCoW priority',
    skill_splits:               'Sprint allocation',
    delivery_config:            'Delivery configuration',
    governance_forum:           'Meeting',
    customer:                   'Customer',
    category:                   'Category'
  },

  _humaniseField(field) {
    if (!field) return '';
    if (this._FIELD_LABELS[field]) return this._FIELD_LABELS[field];
    return String(field).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  },
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm run test:unit -- gantt-baseline-helpers.test.mjs`
Expected: PASS — all three describe blocks green.

- [ ] **Step 5: Run the full unit suite**

Run: `npm run test:unit`
Expected: pass; the new file adds tests, none of the existing tests reference `_formatSlip` or `_humaniseField` so nothing else changes.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/unit/gantt-baseline-helpers.test.mjs
git commit -m "feat(gantt): add _formatSlip + _humaniseField helpers"
```

---

## Task 2: Add `_phaseSpans` helper with per-render memoisation (TDD)

**Files:**
- Modify: `index.html` (Gantt object, alongside `_formatSlip` from Task 1)
- Modify: `tests/unit/gantt-baseline-helpers.test.mjs` (append new describe block)

- [ ] **Step 1: Append the failing test to the helpers file**

Append to `tests/unit/gantt-baseline-helpers.test.mjs`:
```js
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Gantt._phaseSpans', () => {
  it('returns null when project has no entry in the active baseline snapshot', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({ name: 'Atlas', start_date: '2026-01-05', target_date: '2026-02-09', size_engineering: 5 });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Gantt._phaseSpans(proj, null, 'size_engineering')).toBe(null);
    app.teardown();
  });

  it('computes baseline / actual / shift / expansion from a named-baseline snapshot', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    // Baseline: phase ran 5–11 Jan in sprint 0 (1 sprint). Actual: 5–25 Jan in sprints 0–1 (2 sprints).
    const proj = makeProject({ name: 'Atlas', start_date: '2026-01-05', target_date: '2026-02-09', size_engineering: 12 });
    proj.size_total = 12;
    proj.skill_splits = { size_engineering: [
      { sprint: sprints[0].sprint_id, points: 5, status: 'complete' },
      { sprint: sprints[1].sprint_id, points: 7, status: 'in_progress' }
    ] };
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    const baseline = {
      id: 'b_test', name: 'Test', customer: 'Acme Industries',
      created_at: '2026-01-01T00:00:00.000Z',
      snapshot: { [proj.id]: {
        start_date: '2026-01-05', target_date: '2026-01-26', size_total: 5,
        skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 5 }] }
      } }
    };
    const r = app.Gantt._phaseSpans(proj, baseline, 'size_engineering');
    expect(r).not.toBe(null);
    expect(r.baseline.startDate).toBe(sprints[0].start_date);
    expect(r.baseline.endDate).toBe(sprints[0].end_date);
    expect(r.actual.startDate).toBe(sprints[0].start_date);
    expect(r.actual.endDate).toBe(sprints[1].end_date);
    expect(r.shift).toBe(0);
    expect(r.expansion).toBeGreaterThan(0); // actual span is longer
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm run test:unit -- gantt-baseline-helpers.test.mjs`
Expected: FAIL — `Gantt._phaseSpans is not a function`.

- [ ] **Step 3: Add the helper**

In `index.html`, alongside the helpers from Task 1 (above `_projectBaselineSpan`), add:

```js
  // Compute baseline span vs actual span for a single phase (skill) of a project.
  // Returns { baseline:{startDate,endDate,days}, actual:{startDate,endDate,days}, shift, expansion }
  // or null when the baseline doesn't contain this project / this skill.
  _phaseSpans(project, baseline, skillKey) {
    if (!project || !baseline || !baseline.snapshot) return null;
    const node = baseline.snapshot[project.id];
    if (!node) return null;
    const sprints = (App.data && App.data.sprints) || [];
    const sprintMap = {};
    sprints.forEach(s => { sprintMap[s.sprint_id] = s; });
    const spanOf = (splits) => {
      if (!Array.isArray(splits) || !splits.length) return null;
      let earliest = null, latest = null;
      splits.forEach(sp => {
        const spr = sprintMap[sp.sprint];
        if (!spr) return;
        if (!earliest || spr.start_date < earliest) earliest = spr.start_date;
        if (!latest   || spr.end_date   > latest)   latest   = spr.end_date;
      });
      if (!earliest || !latest) return null;
      const days = Math.round((new Date(latest) - new Date(earliest)) / 86400000) + 1;
      return { startDate: earliest, endDate: latest, days };
    };
    const baseSplits = (node.skill_splits || {})[skillKey];
    const liveSplits = (project.skill_splits || {})[skillKey];
    const baseline_ = spanOf(baseSplits);
    const actual    = spanOf(liveSplits);
    if (!baseline_ || !actual) return null;
    const shift     = Math.round((new Date(actual.startDate) - new Date(baseline_.startDate)) / 86400000);
    const expansion = actual.days - baseline_.days;
    return { baseline: baseline_, actual, shift, expansion };
  },
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm run test:unit -- gantt-baseline-helpers.test.mjs`
Expected: PASS — both new cases plus the existing format/humanise cases all green.

- [ ] **Step 5: Run full unit suite**

Run: `npm run test:unit`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/unit/gantt-baseline-helpers.test.mjs
git commit -m "feat(gantt): add _phaseSpans helper for per-phase plan/actual computation"
```

---

## Task 3: CSS rewrite — replace bracket with plan-lane + new classes

**Files:**
- Modify: `index.html` ~lines 1330–1380 (the `.gantt-bar`, `.gantt-baseline-bracket`, `.gantt-delta-pill` blocks).

- [ ] **Step 1: Read the existing CSS block**

Read lines 1330–1395 of `index.html` to confirm the exact text. The bracket block currently includes:
- `.gantt-bar` with `top: 8px; height: 24px`
- A comment block "Baseline-vs-actual: bracket above the bar + inline delta pill"
- `.gantt-baseline-bracket`, `::before`, `::after`, `> .gantt-baseline-spine`
- `.gantt-delta-pill` with three modifiers (slip / early / onplan)
- `.gantt-ms` (don't touch — milestone styling)

- [ ] **Step 2: Replace the block**

Edit `index.html`. Find the existing `.gantt-bar { ... }` rule starting at ~line 1335 and the `.gantt-delta-pill.onplan { ... }` rule ending at ~line 1375. Replace EVERYTHING between the start of `.gantt-bar` and the end of the `.onplan` rule with:

```css
.gantt-bar {
  position: absolute; top: 22px; height: 24px; border-radius: 5px;
  display: flex; align-items: center; padding: 0 8px;
  font-size: 11px; font-weight: 700; color: white; overflow: hidden;
  white-space: nowrap; text-overflow: ellipsis; cursor: pointer;
  transition: opacity 0.15s; min-width: 4px; z-index: 2;
  box-shadow: 0 2px 4px rgba(15,23,42,0.18), inset 0 0 0 1px rgba(255,255,255,0.10);
  letter-spacing: 0.2px;
}
.gantt-bar:hover { opacity: 0.92; box-shadow: 0 3px 6px rgba(15,23,42,0.24), inset 0 0 0 1px rgba(255,255,255,0.14); }
.gantt-bar .bar-label { overflow: hidden; text-overflow: ellipsis; }
.gantt-sub-row { background: linear-gradient(to right, rgba(15,23,42,0.02), rgba(15,23,42,0.01) 35%, transparent); border-left: 2px solid rgba(15,23,42,0.06); }
html[data-theme="dark"] .gantt-sub-row { background: linear-gradient(to right, rgba(255,255,255,0.04), rgba(255,255,255,0.02) 35%, transparent); border-left-color: rgba(255,255,255,0.08); border-bottom-color: #1f2937 !important; }

/* Baseline visualisation v2 — stacked plan / actual lanes.
   Project header: plan lane y=4–12, arrow band y=14–20, bar y=22–48 (bar shifted from 8 to 22).
   Phase sub-row: plan lane y=3–8, arrow band y=11–17, bar y=19–37 (sub-row height 38). */
.gantt-plan-lane {
  position: absolute; top: 4px; height: 8px;
  pointer-events: auto; cursor: pointer;
  background: var(--gantt-baseline);
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px rgba(15,23,42,0.18);
}
.gantt-plan-lane::before, .gantt-plan-lane::after {
  content: ''; position: absolute; top: -3px;
  width: 2px; height: 14px;
  background: var(--gantt-baseline);
  filter: brightness(0.7);
}
.gantt-plan-lane::before { left: -1px; }
.gantt-plan-lane::after  { right: -1px; }

.gantt-phase-plan-lane {
  position: absolute; top: 3px; height: 5px;
  pointer-events: auto; cursor: pointer;
  background: var(--gantt-baseline); opacity: 0.7;
  border-radius: 1px;
  box-shadow: inset 0 0 0 1px rgba(15,23,42,0.15);
}
.gantt-phase-plan-lane::before, .gantt-phase-plan-lane::after {
  content: ''; position: absolute; top: -2px;
  width: 1.5px; height: 9px;
  background: var(--gantt-baseline);
  filter: brightness(0.7);
}
.gantt-phase-plan-lane::before { left: -0.5px; }
.gantt-phase-plan-lane::after  { right: -0.5px; }

/* Movement arrow primitive — pure DOM, renders reliably at any width.
   Container is 6 px tall total; shaft is 2 px centred; head is a 7 px CSS-border triangle. */
.gantt-move-arrow {
  position: absolute; height: 6px;
  z-index: 3; pointer-events: none;
}
.gantt-move-arrow .gantt-move-shaft {
  position: absolute; left: 0; right: 7px; top: 2px; height: 2px;
  background: var(--status-red); border-radius: 1px;
}
.gantt-move-arrow .gantt-move-head {
  position: absolute; right: 0; top: 0;
  width: 0; height: 0;
  border-left: 7px solid var(--status-red);
  border-top: 3px solid transparent;
  border-bottom: 3px solid transparent;
}

/* Per-phase culprit overlay — covers ONLY the days the phase expanded by */
.gantt-phase-overlay-culprit {
  position: absolute; top: 19px; height: 18px;
  background: repeating-linear-gradient(135deg, rgba(220,38,38,0.32) 0 6px, rgba(220,38,38,0.12) 6px 12px);
  border-right: 2px solid var(--status-red);
  border-radius: 0 3px 3px 0;
  pointer-events: none; z-index: 2;
}

.gantt-phase-tag {
  position: absolute; top: 28px;
  transform: translateY(-50%);
  background: var(--status-red); color: white;
  font-size: 9px; font-weight: 800;
  padding: 2px 6px; border-radius: 8px;
  z-index: 5; white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0,0,0,0.18); cursor: help;
  line-height: 1;
}

.gantt-phase-status-dot {
  position: absolute; left: 6px; top: 28px;
  transform: translateY(-50%);
  width: 10px; height: 10px; border-radius: 50%;
  z-index: 4;
}
.gantt-phase-status-dot.complete    { background: var(--status-green); }
.gantt-phase-status-dot.in-progress { background: white; border: 2px solid var(--accent-blue); box-sizing: border-box; }
.gantt-phase-status-dot.pending     { background: white; border: 2px dashed var(--text-muted); box-sizing: border-box; }
html[data-theme="dark"] .gantt-phase-status-dot.in-progress,
html[data-theme="dark"] .gantt-phase-status-dot.pending { background: var(--surface-2); }

.gantt-phase-name-tag {
  position: absolute; left: 22px; top: 28px;
  transform: translateY(-50%);
  font-size: 9px; font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.4px;
  pointer-events: none; z-index: 4;
}

.gantt-drift-line {
  position: absolute; top: 0; bottom: 0; width: 0;
  border-left: 1.5px dashed rgba(220,38,38,0.55);
  z-index: 6; pointer-events: none;
}
.gantt-drift-line.with-label::after {
  content: 'plan end';
  position: absolute; top: 1px; left: 4px;
  font-size: 8px; font-weight: 700;
  color: var(--status-red);
  text-transform: uppercase; letter-spacing: 0.4px;
  white-space: nowrap;
}

/* Delta pill — vertically centred on its anchor bar with 8 px gap (left positioned by JS) */
.gantt-delta-pill {
  position: absolute;
  transform: translateY(-50%);
  font-size: 11px; font-weight: 800;
  padding: 3px 9px; border-radius: 12px;
  z-index: 4; white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0,0,0,0.10); cursor: help;
  line-height: 1;
}
.gantt-delta-pill.slip   { color: var(--status-red);   background: var(--tint-red-weak);   border: 1px solid #fca5a5; }
.gantt-delta-pill.early  { color: var(--status-green); background: var(--tint-green-weak); border: 1px solid #6ee7b7; }
```

- [ ] **Step 3: Verify the bracket CSS is gone**

Run: `grep -n "gantt-baseline-bracket\|gantt-baseline-spine\|gantt-delta-pill.onplan" index.html`
Expected: 0 hits. (The on-plan modifier disappears because v1 hides the pill entirely on-plan rather than rendering an "on plan" word.)

- [ ] **Step 4: Verify new classes exist**

Run: `grep -c "gantt-plan-lane\|gantt-phase-plan-lane\|gantt-move-arrow\|gantt-phase-tag\|gantt-phase-status-dot\|gantt-phase-name-tag\|gantt-phase-overlay-culprit\|gantt-drift-line" index.html`
Expected: ≥ 12 hits (CSS rules + a few mentions in the comment block).

- [ ] **Step 5: Don't commit yet**

Render path still uses the old class names — tests will fail. Move to Task 4.

---

## Task 4: Rewrite the project-header baseline render block (TDD)

**Files:**
- Replace: `tests/render/gantt-baseline.test.mjs`
- Modify: `index.html` ~lines 16881–16920 (the `if (showBaseline)` block in `Gantt.render`)

- [ ] **Step 1: Rewrite the render-test file**

Replace the entire contents of `tests/render/gantt-baseline.test.mjs` with:
```js
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Gantt baseline v2 — project header', () => {
  async function setup({ baselineEnd, currentEnd }) {
    resetIdSeq();
    const sprints = makeSprintSequence(4);
    const proj = makeProject({
      name: 'Atlas',
      start_date: '2026-01-05', target_date: currentEnd,
      baseline_start: '2026-01-05', baseline_end: baselineEnd,
      size_engineering: 5
    });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    const cb = app.window.document.getElementById('ganttBaseline');
    if (cb) cb.checked = true;
    app.Gantt.render();
    return app;
  }

  it('renders plan lane, movement arrow, drift line and slip pill on a slipped project', async () => {
    const app = await setup({ baselineEnd: '2026-01-26', currentEnd: '2026-02-09' });
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-plan-lane/);
    expect(html).toMatch(/gantt-move-arrow/);
    expect(html).toMatch(/gantt-drift-line/);
    expect(html).toMatch(/gantt-delta-pill slip/);
    expect(html).toMatch(/\+\d+(d|w)/);
    // Legacy bracket pattern should be gone
    expect(html).not.toMatch(/gantt-baseline-bracket/);
    expect(html).not.toMatch(/gantt-baseline-spine/);
    expect(html).not.toMatch(/baseline-arrow/);
    app.teardown();
  });

  it('formats slips ≥ 7 days as weeks (+2w)', async () => {
    const app = await setup({ baselineEnd: '2026-01-26', currentEnd: '2026-02-09' }); // 14d slip
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toContain('+2w');
    expect(html).not.toContain('+14d');
    app.teardown();
  });

  it('formats sub-week slips in days (+5d)', async () => {
    const app = await setup({ baselineEnd: '2026-01-26', currentEnd: '2026-01-31' }); // 5d slip
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toContain('+5d');
    app.teardown();
  });

  it('renders an early pill (− prefix, green) when actual ends before baseline', async () => {
    const app = await setup({ baselineEnd: '2026-02-09', currentEnd: '2026-01-26' });
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-delta-pill early/);
    expect(html).toMatch(/−\d+/);
    app.teardown();
  });

  it('omits the pill entirely when on plan (no on-plan word)', async () => {
    const app = await setup({ baselineEnd: '2026-01-26', currentEnd: '2026-01-26' });
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).not.toMatch(/gantt-delta-pill/);
    app.teardown();
  });

  it('renders no plan lane when project has no baseline data', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'NoBaseline', start_date: '2026-01-05', target_date: '2026-02-09', size_engineering: 5 });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    const cb = app.window.document.getElementById('ganttBaseline');
    if (cb) cb.checked = true;
    app.Gantt.render();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).not.toMatch(/gantt-plan-lane/);
    expect(html).not.toMatch(/gantt-move-arrow/);
    expect(html).not.toMatch(/gantt-delta-pill/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm run test:unit -- gantt-baseline.test.mjs`
Expected: FAIL — `gantt-plan-lane` / `gantt-move-arrow` not found because render still emits the bracket.

- [ ] **Step 3: Replace the render block**

Edit `index.html`. The existing block is at ~line 16881 starting with `let baselineHtml = '';` and ending with the `}` of `if (showBaseline)`. Read lines 16880–16925 first to confirm exact text. Replace the entire block with:

```js
      let baselineHtml = '';
      if (showBaseline) {
        // Preferred: span computed from the selected named baseline's snapshot for this project.
        const span = this._projectBaselineSpan(p.id);
        let bStart = null, bEnd = null;
        if (span) {
          const startSp = (App.data.sprints || []).find(s => s.sprint_id === span.startSprint);
          const endSp = (App.data.sprints || []).find(s => s.sprint_id === span.endSprint);
          if (startSp) bStart = startSp.start_date;
          if (endSp) bEnd = endSp.end_date;
        }
        if (!bStart || !bEnd) {
          const ab = this._activeBaseline();
          const node = (ab && ab.snapshot && ab.snapshot[p.id]) || null;
          if (node && node.start_date && node.target_date) {
            bStart = node.start_date;
            bEnd = node.target_date;
          }
        }
        if (!bStart || !bEnd) { bStart = p.baseline_start; bEnd = p.baseline_end; }
        if (bStart && bEnd) {
          const bx1 = Math.max(0, dateToX(bStart));
          const bx2 = Math.max(bx1 + 4, dateToX(bEnd));
          // 1) Plan lane (slate ghost above the bar)
          baselineHtml += '<div class="gantt-plan-lane gantt-hoverable" data-hover-type="baseline" data-id="' + Dashboard.esc(p.id) + '" data-bstart="' + Dashboard.esc(bStart) + '" data-bend="' + Dashboard.esc(bEnd) + '" tabindex="0" role="img" aria-label="Plan ' + Dashboard.esc(bStart) + ' to ' + Dashboard.esc(bEnd) + '" style="left:' + bx1 + 'px;width:' + (bx2 - bx1) + 'px"></div>';
          // 2) Drift line (vertical dashed at plan_end, runs the full row block)
          baselineHtml += '<div class="gantt-drift-line with-label" style="left:' + bx2 + 'px"></div>';
          // 3) Movement arrow (only when actual end is past plan end and the gap is wide enough to render)
          if (p.target_date) {
            const liveEndX = dateToX(p.target_date);
            const arrowW = liveEndX - bx2;
            if (arrowW >= 12) {
              baselineHtml += '<div class="gantt-move-arrow" style="left:' + bx2 + 'px;width:' + arrowW + 'px;top:14px"><span class="gantt-move-shaft"></span><span class="gantt-move-head"></span></div>';
            }
            // 4) Delta pill — uses _formatSlip; hidden entirely when on plan
            const targetDelta = Math.round((new Date(p.target_date) - new Date(bEnd)) / 86400000);
            if (targetDelta !== 0) {
              const pillCls = targetDelta > 0 ? 'slip' : 'early';
              const pillText = this._formatSlip(targetDelta);
              const pillX = Math.min(totalWidth - 50, Math.max(x2, bx2) + 8);
              const tipText = 'Baseline ' + bStart + ' → ' + bEnd + ' · current ' + p.target_date + ' (' + pillText + ')';
              baselineHtml += '<div class="gantt-delta-pill gantt-hoverable ' + pillCls + '" data-hover-type="delta-pill" data-id="' + Dashboard.esc(p.id) + '" tabindex="0" style="left:' + pillX + 'px;top:35px" title="' + Dashboard.esc(tipText) + '">' + Dashboard.esc(pillText) + '</div>';
            }
          }
        }
      }
```

(`top:35px` on the pill = vertical centre of the new 60-px-tall project header zone. The drift-line height is set automatically by `top:0;bottom:0` inside the row container; the `with-label` modifier renders the "plan end" text once per project block — the drift-line will be repeated for each phase sub-row in Task 5 without the label.)

Note: the project canvas was previously implicitly sized; the bar shifted from `top:8` to `top:22` in Task 3, which means the row needs ≥ 48 px height to accommodate the bar (top:22 + height:24 + 2 px padding). Find the existing `.gantt-row` rule (search for `.gantt-row {`) and confirm its height is at least 50 px. If not, bump it.

- [ ] **Step 4: Confirm `.gantt-row` height**

Run: `grep -n "\.gantt-row {" index.html | head -3`. Read that block. If the height is < 50 px, edit it to `height: 56px` (matches the canvas mockup which used 56 px).

- [ ] **Step 5: Run test — expect PASS**

Run: `npm run test:unit -- gantt-baseline.test.mjs`
Expected: PASS — all six cases green.

- [ ] **Step 6: Run full unit suite**

Run: `npm run test:unit`
Expected: pass. The legend snapshot and other Gantt tests should not be affected — they don't assert on baseline-bracket markup.

- [ ] **Step 7: Don't commit yet**

Detailed-mode rendering is still untouched; will be added in Task 5.

---

## Task 5: Add per-phase plan-lane + culprit attribution in Detailed mode (TDD)

**Files:**
- Create: `tests/render/gantt-baseline-detailed.test.mjs`
- Modify: `index.html` ~lines 17050–17160 (Detailed-mode sub-row rendering inside `Gantt.render`)

- [ ] **Step 1: Write the failing test**

Create `tests/render/gantt-baseline-detailed.test.mjs`:
```js
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Gantt detailed-mode culprit attribution', () => {
  async function setupSlipped() {
    resetIdSeq();
    const sprints = makeSprintSequence(4);
    // Baseline: Data Eng = 5 SP in sprint 0 (1 sprint).
    // Actual: Data Eng = 12 SP in sprints 0 + 1 (2 sprints — phase grew).
    const proj = makeProject({ name: 'Atlas', start_date: '2026-01-05', target_date: '2026-02-09', size_engineering: 12 });
    proj.size_total = 12;
    proj.skill_splits = { size_engineering: [
      { sprint: sprints[0].sprint_id, points: 5, status: 'in_progress' },
      { sprint: sprints[1].sprint_id, points: 7, status: 'in_progress' }
    ] };
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    // Push a named baseline that captures the original 1-sprint span
    app.App.data.baselines = [{
      id: 'b_test', name: 'Test', customer: 'Acme Industries',
      created_at: '2026-01-01T00:00:00.000Z',
      snapshot: { [proj.id]: {
        start_date: '2026-01-05', target_date: '2026-01-26', size_total: 5,
        skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 5 }] }
      } }
    }];
    app.Gantt.setActiveBaseline('b_test');
    // Detailed mode + baseline checkbox
    app.window.document.getElementById('ganttDetailed').checked = true;
    const cb = app.window.document.getElementById('ganttBaseline');
    if (cb) cb.checked = true;
    app.Gantt.render();
    return app;
  }

  it('renders a per-phase plan lane on every phase row in detailed mode', async () => {
    const app = await setupSlipped();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-phase-plan-lane/);
    app.teardown();
  });

  it('renders a culprit overlay + phase tag for a phase that grew', async () => {
    const app = await setupSlipped();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-phase-overlay-culprit/);
    expect(html).toMatch(/gantt-phase-tag[^>]*>\+/); // phase tag with + prefix
    app.teardown();
  });

  it('renders a phase status dot with the correct state', async () => {
    const app = await setupSlipped();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-phase-status-dot in-progress/);
    app.teardown();
  });

  it('renders the 3-letter phase short code', async () => {
    const app = await setupSlipped();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-phase-name-tag/);
    expect(html).toContain('DE'); // Data Engineering short code
    app.teardown();
  });

  it('does not render culprit overlay or phase tag when phase span is unchanged', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'OnPlan', start_date: '2026-01-05', target_date: '2026-01-26', size_engineering: 5 });
    proj.size_total = 5;
    proj.skill_splits = { size_engineering: [{ sprint: sprints[0].sprint_id, points: 5, status: 'complete' }] };
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.data.baselines = [{
      id: 'b_test', name: 'Test', customer: 'Acme Industries', created_at: '2026-01-01T00:00:00.000Z',
      snapshot: { [proj.id]: {
        start_date: '2026-01-05', target_date: '2026-01-26', size_total: 5,
        skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 5 }] }
      } }
    }];
    app.Gantt.setActiveBaseline('b_test');
    app.window.document.getElementById('ganttDetailed').checked = true;
    const cb = app.window.document.getElementById('ganttBaseline');
    if (cb) cb.checked = true;
    app.Gantt.render();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-phase-plan-lane/); // plan lane still rendered
    expect(html).not.toMatch(/gantt-phase-overlay-culprit/);
    expect(html).not.toMatch(/gantt-phase-tag/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm run test:unit -- gantt-baseline-detailed.test.mjs`
Expected: FAIL — none of the new classes are emitted by phase sub-rows yet.

- [ ] **Step 3: Inject per-phase rendering inside the Detailed-mode loop**

In `index.html`, find the Detailed-mode loop. The reference landmark is the comment "Phase-aware hover" near line 17144 and the `mainRow += '<div class="gantt-sub-row …` line near line 17147. Read 17110–17160 to confirm the exact context.

The loop iterates `activeSkills.forEach(sk => { ... })` building each sub-row's HTML. We need to inject:
1. A status dot + name tag (always)
2. A per-phase plan lane (only when active baseline contains this project and skill)
3. A culprit overlay + phase tag (only when phase expanded)
4. A movement arrow (only when phase expanded and the arrow span is wide enough)
5. A drift line (always, when project has a baseline — repeats per row, no label)

Find the line near 17147 that emits the sub-row container and replace the entire `mainRow += '<div class="gantt-sub-row …` block with a richer template. The block currently looks like:

```js
          mainRow += '<div class="gantt-sub-row ' + rowZebra + '" style="height:' + subRowH + 'px;position:relative;width:' + totalWidth + 'px">' +
            connector +
            '<div class="gantt-hoverable gantt-phase-bar" data-hover-type="phase" data-id="' + p.id + '" data-skill-key="' + sk + '" data-overrun="' + (phaseOverruns ? '1' : '0') + '" tabindex="0" role="button" aria-label="' + Dashboard.esc(skillLabel) + ' phase of ' + Dashboard.esc(p.name) + '" style="' + subBarStyle + '">' + inlineLabel + '</div>' +
            floatLabel +
          '</div>';
```

Replace it with:

```js
          // === Baseline visualisation v2 — per-phase plan lane + culprit attribution ===
          let phasePlanHtml = '';
          let phaseStatusClass = 'pending';
          let phaseNameHtml = '';
          if (showBaseline) {
            const ab = this._activeBaseline();
            const spans = ab ? this._phaseSpans(p, ab, sk) : null;
            if (spans) {
              const planX1 = Math.max(0, dateToX(spans.baseline.startDate));
              const planX2 = Math.max(planX1 + 4, dateToX(spans.baseline.endDate));
              phasePlanHtml += '<div class="gantt-phase-plan-lane gantt-hoverable" data-hover-type="phase-baseline" data-id="' + p.id + '" data-skill-key="' + sk + '" tabindex="0" role="img" aria-label="Plan for ' + Dashboard.esc(skillLabel) + '" style="left:' + planX1 + 'px;width:' + (planX2 - planX1) + 'px"></div>';
              if (spans.expansion > 0) {
                const liveEndX = dateToX(spans.actual.endDate);
                // Red overlay covers the expansion days only (right-aligned on the phase bar)
                const overlayX = planX2;
                const overlayW = Math.max(2, liveEndX - planX2);
                phasePlanHtml += '<div class="gantt-phase-overlay-culprit" style="left:' + overlayX + 'px;width:' + overlayW + 'px"></div>';
                // Movement arrow if the gap is wide enough
                const arrowW = liveEndX - planX2;
                if (arrowW >= 12) {
                  phasePlanHtml += '<div class="gantt-move-arrow" style="left:' + planX2 + 'px;width:' + arrowW + 'px;top:11px"><span class="gantt-move-shaft"></span><span class="gantt-move-head"></span></div>';
                }
                // Phase tag pill
                const tagText = this._formatSlip(spans.expansion);
                const tagX = Math.min(totalWidth - 50, liveEndX + 8);
                phasePlanHtml += '<div class="gantt-phase-tag gantt-hoverable" data-hover-type="phase-tag" data-id="' + p.id + '" data-skill-key="' + sk + '" tabindex="0" style="left:' + tagX + 'px">' + Dashboard.esc(tagText) + '</div>';
              }
            }
          }
          // Status dot — derived from skill_splits status aggregation
          const splitsForStatus = (p.skill_splits && p.skill_splits[sk]) || [];
          const allComplete = splitsForStatus.length > 0 && splitsForStatus.every(s => s.status === 'complete');
          const anyInProg = splitsForStatus.some(s => s.status === 'in_progress');
          phaseStatusClass = allComplete ? 'complete' : (anyInProg ? 'in-progress' : 'pending');
          // Name tag — short code from Sprint.SKILLS
          const skillShort = (Sprint.SKILLS.find(s => s.key === sk) || {}).short || sk;
          phaseNameHtml = '<span class="gantt-phase-name-tag">' + Dashboard.esc(skillShort) + '</span>';
          // Drift line (repeats per row, no label — label appeared once on the project header in Task 4)
          let phaseDriftHtml = '';
          if (showBaseline) {
            const ab = this._activeBaseline();
            const node = (ab && ab.snapshot && ab.snapshot[p.id]) || null;
            const driftEnd = (node && node.target_date) || p.baseline_end;
            if (driftEnd) {
              phaseDriftHtml = '<div class="gantt-drift-line" style="left:' + dateToX(driftEnd) + 'px"></div>';
            }
          }

          mainRow += '<div class="gantt-sub-row ' + rowZebra + '" style="height:' + subRowH + 'px;position:relative;width:' + totalWidth + 'px">' +
            connector +
            '<div class="gantt-phase-status-dot ' + phaseStatusClass + '"></div>' +
            phaseNameHtml +
            phasePlanHtml +
            '<div class="gantt-hoverable gantt-phase-bar" data-hover-type="phase" data-id="' + p.id + '" data-skill-key="' + sk + '" data-overrun="' + (phaseOverruns ? '1' : '0') + '" tabindex="0" role="button" aria-label="' + Dashboard.esc(skillLabel) + ' phase of ' + Dashboard.esc(p.name) + '" style="' + subBarStyle + '">' + inlineLabel + '</div>' +
            floatLabel +
            phaseDriftHtml +
          '</div>';
```

- [ ] **Step 4: Bump sub-row height to 38**

The new layout needs 38 px sub-rows (was 36). Find the variable `subRowH` near the top of the Detailed-mode block (search `subRowH` — should be around line 17042). It's currently `const subRowH = 36;` (or similar). Change to `const subRowH = 38;`.

If `subRowH` doesn't exist as a const and is hardcoded inline as `36px`, find every occurrence in the Detailed-mode rendering region (lines ~17040–17170) and change to 38. Use grep to locate: `grep -n "subRowH\|36px" index.html | head -10`.

Also adjust `subBarStyle` if it positions the phase bar at a now-incorrect `top`. The phase bar should sit at `top: 19px` inside a 38-px row (was probably 5/3 before). Read the block defining `subBarStyle` near line 17141 and confirm; update the `top:` value if needed to `top:19px`.

- [ ] **Step 5: Run test — expect PASS**

Run: `npm run test:unit -- gantt-baseline-detailed.test.mjs`
Expected: PASS — all five cases green.

- [ ] **Step 6: Run full unit suite**

Run: `npm run test:unit`
Expected: pass. The earlier-Task-4 baseline test now sees the per-phase elements but its assertions don't reference them — should remain green.

- [ ] **Step 7: Commit Tasks 3 + 4 + 5 together**

This is a single feature change — CSS rewrite + project-header render + phase render. Commit the lot:
```bash
git add index.html tests/render/gantt-baseline.test.mjs tests/render/gantt-baseline-detailed.test.mjs
git commit -m "feat(gantt): replace bracket with stacked plan/actual lanes + per-phase culprits"
```

---

## Task 6: Update hover paint/erase for new hover types

**Files:**
- Modify: `index.html` ~lines 16200–16290 (the `paint` and `erase` helpers inside `Gantt.attachHoverHandlers`)

- [ ] **Step 1: Add new branches to `paint`**

In `index.html`, find `const paint = (el) => {` near line 16240. The function has branches for `seg`, `bar`, `label`, `phase`, `baseline`, `dep`. Add three new branches right after the `baseline` branch (and before `dep`):

```js
      } else if (type === 'phase-baseline') {
        const id = el.dataset.id;
        const sk = el.dataset.skillKey;
        const phaseBar = scroll.querySelector('.gantt-phase-bar[data-id="' + id + '"][data-skill-key="' + sk + '"]');
        if (phaseBar) phaseBar.classList.add('gantt-hovered');
      } else if (type === 'phase-tag') {
        const id = el.dataset.id;
        const sk = el.dataset.skillKey;
        const phaseBar = scroll.querySelector('.gantt-phase-bar[data-id="' + id + '"][data-skill-key="' + sk + '"]');
        if (phaseBar) phaseBar.classList.add('gantt-hovered');
        const overlay = scroll.querySelector('.gantt-phase-overlay-culprit[data-id="' + id + '"][data-skill-key="' + sk + '"]');
        if (overlay) overlay.classList.add('gantt-hovered');
      } else if (type === 'delta-pill') {
        const id = el.dataset.id;
        const bar = scroll.querySelector('.gantt-bar[data-id="' + id + '"]');
        const label = document.querySelector('.gantt-label-row[data-id="' + id + '"]');
        if (bar) bar.classList.add('gantt-bar-highlight');
        if (label) label.classList.add('gantt-label-active');
```

- [ ] **Step 2: Add matching branches to `erase`**

Find `const erase = (el) => {` (immediately after `paint`). Mirror the same structure with class removals:

```js
      } else if (type === 'phase-baseline') {
        const id = el.dataset.id;
        const sk = el.dataset.skillKey;
        const phaseBar = scroll.querySelector('.gantt-phase-bar[data-id="' + id + '"][data-skill-key="' + sk + '"]');
        if (phaseBar) phaseBar.classList.remove('gantt-hovered');
      } else if (type === 'phase-tag') {
        const id = el.dataset.id;
        const sk = el.dataset.skillKey;
        const phaseBar = scroll.querySelector('.gantt-phase-bar[data-id="' + id + '"][data-skill-key="' + sk + '"]');
        if (phaseBar) phaseBar.classList.remove('gantt-hovered');
        const overlay = scroll.querySelector('.gantt-phase-overlay-culprit[data-id="' + id + '"][data-skill-key="' + sk + '"]');
        if (overlay) overlay.classList.remove('gantt-hovered');
      } else if (type === 'delta-pill') {
        const id = el.dataset.id;
        const bar = scroll.querySelector('.gantt-bar[data-id="' + id + '"]');
        const label = document.querySelector('.gantt-label-row[data-id="' + id + '"]');
        if (bar) bar.classList.remove('gantt-bar-highlight');
        if (label) label.classList.remove('gantt-label-active');
```

- [ ] **Step 3: Tag the overlay with data attributes for hover correlation**

In Task 5's render code, the `gantt-phase-overlay-culprit` div doesn't carry `data-id` / `data-skill-key`. Find the line in the render path:
```js
phasePlanHtml += '<div class="gantt-phase-overlay-culprit" style="left:' + overlayX + 'px;width:' + overlayW + 'px"></div>';
```
Replace with:
```js
phasePlanHtml += '<div class="gantt-phase-overlay-culprit" data-id="' + p.id + '" data-skill-key="' + sk + '" style="left:' + overlayX + 'px;width:' + overlayW + 'px"></div>';
```

- [ ] **Step 4: Run unit tests**

Run: `npm run test:unit`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(gantt): wire phase-baseline / phase-tag / delta-pill into hover paint/erase"
```

---

## Task 7: Rewrite tooltip builder for new hover types + humanise + drop bookkeeping (TDD)

**Files:**
- Modify: `index.html` ~lines 16029–16240 (the `buildPlanVsActual` helper + `buildTooltip` function inside `attachHoverHandlers`)
- Replace: `tests/render/gantt-baseline-hover.test.mjs`

- [ ] **Step 1: Rewrite the hover-test file**

Replace the entire contents of `tests/render/gantt-baseline-hover.test.mjs` with:
```js
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

async function loadWithBaseline({ targetDate, baselineEnd, addAuditLog }) {
  resetIdSeq();
  const sprints = makeSprintSequence(4);
  const proj = makeProject({
    name: 'Atlas',
    start_date: '2026-01-05', target_date: targetDate,
    size_engineering: 12
  });
  proj.size_total = 12;
  proj.skill_splits = { size_engineering: [
    { sprint: sprints[0].sprint_id, points: 5, status: 'in_progress' },
    { sprint: sprints[1].sprint_id, points: 7, status: 'in_progress' }
  ] };
  const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
  app.App.activeCustomer = 'Acme Industries';
  app.App.data.baselines = [{
    id: 'b_test', name: 'Test', customer: 'Acme Industries',
    created_at: '2026-01-01T00:00:00.000Z', created_by: 'tester',
    snapshot: { [proj.id]: {
      start_date: '2026-01-05', target_date: baselineEnd, size_total: 5,
      skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 5 }] }
    } }
  }];
  app.Gantt.setActiveBaseline('b_test');
  if (addAuditLog) {
    app.App.data.audit_log = (app.App.data.audit_log || []).concat([
      { timestamp: '2026-01-15T10:00:00.000Z', projectId: proj.id, projectName: proj.name, field: 'size_data_engineering', oldValue: '5', newValue: '12', source: 'user' },
      { timestamp: '2026-01-20T10:00:00.000Z', projectId: proj.id, projectName: proj.name, field: 'target_date', oldValue: '2026-01-26', newValue: targetDate, source: 'user' },
      { timestamp: '2026-01-22T10:00:00.000Z', projectId: proj.id, projectName: proj.name, field: 'rag_schedule', oldValue: 'Green', newValue: 'Amber', source: 'user' }
    ]);
  }
  const cb = app.window.document.getElementById('ganttBaseline');
  if (cb) cb.checked = true;
  app.Gantt.render();
  return { app, proj };
}

describe('Gantt tooltip — bar/label hover (no Plan-vs-actual block)', () => {
  it('does NOT contain "Plan vs actual" when hovering the project bar', async () => {
    const { app } = await loadWithBaseline({ targetDate: '2026-02-09', baselineEnd: '2026-01-26' });
    const bar = app.window.document.querySelector('.gantt-bar[data-hover-type="bar"]');
    const html = app.Gantt._buildTooltipForTest('bar', bar);
    expect(html).not.toContain('Plan vs actual');
    expect(html).not.toContain('Slip contributors');
    app.teardown();
  });
});

describe('Gantt tooltip — delta-pill hover (the slip story lives here)', () => {
  it('renders Plan vs actual + Slip contributors + What moved with humanised labels', async () => {
    const { app } = await loadWithBaseline({ targetDate: '2026-02-09', baselineEnd: '2026-01-26', addAuditLog: true });
    const pill = app.window.document.querySelector('.gantt-delta-pill[data-hover-type="delta-pill"]');
    expect(pill, 'pill element').toBeTruthy();
    const html = app.Gantt._buildTooltipForTest('delta-pill', pill);
    expect(html).toContain('Plan vs actual');
    expect(html).toContain('Slip contributors');
    expect(html).toContain('What moved');
    // Week format
    expect(html).toContain('+2w');
    // Humanised labels — backend identifiers absent
    expect(html).not.toContain('size_data_engineering');
    expect(html).not.toContain('target_date');
    expect(html).not.toContain('rag_schedule');
    expect(html).toContain('Data Engineering scope');
    expect(html).toContain('Target date');
    expect(html).toContain('Schedule RAG');
    // No bookkeeping
    expect(html).not.toMatch(/set\s+\d+\s+(Jan|Feb|Apr)/i);
    expect(html).not.toContain('by tester');
    app.teardown();
  });

  it('lists slip contributors (phases that grew) sorted by expansion', async () => {
    const { app } = await loadWithBaseline({ targetDate: '2026-02-09', baselineEnd: '2026-01-26' });
    const pill = app.window.document.querySelector('.gantt-delta-pill[data-hover-type="delta-pill"]');
    const html = app.Gantt._buildTooltipForTest('delta-pill', pill);
    expect(html).toContain('Data Engineering');
    app.teardown();
  });
});

describe('Gantt tooltip — phase-tag hover (single-phase contribution)', () => {
  it('shows phase contribution focused on shift / expansion + per-phase audit', async () => {
    const { app } = await loadWithBaseline({ targetDate: '2026-02-09', baselineEnd: '2026-01-26', addAuditLog: true });
    const tag = app.window.document.querySelector('.gantt-phase-tag[data-hover-type="phase-tag"]');
    if (!tag) {
      // Detailed mode might not be on; flip and re-render
      app.window.document.getElementById('ganttDetailed').checked = true;
      app.Gantt.render();
    }
    const tagAfter = app.window.document.querySelector('.gantt-phase-tag[data-hover-type="phase-tag"]');
    expect(tagAfter, 'phase tag element').toBeTruthy();
    const html = app.Gantt._buildTooltipForTest('phase-tag', tagAfter);
    expect(html).toContain('Data Engineering');
    expect(html).toContain('contribution');
    expect(html).toContain('expanded');
    expect(html).not.toContain('size_data_engineering');
    expect(html).toContain('Data Engineering scope');
    app.teardown();
  });
});

describe('Gantt tooltip — plan-lane hover is a one-liner', () => {
  it('contains the original span and no audit / contributors / scope', async () => {
    const { app } = await loadWithBaseline({ targetDate: '2026-02-09', baselineEnd: '2026-01-26', addAuditLog: true });
    const lane = app.window.document.querySelector('.gantt-plan-lane[data-hover-type="baseline"]');
    expect(lane, 'plan lane element').toBeTruthy();
    const html = app.Gantt._buildTooltipForTest('baseline', lane);
    expect(html).toContain('Originally planned');
    expect(html).not.toContain('Plan vs actual');
    expect(html).not.toContain('Slip contributors');
    expect(html).not.toContain('What moved');
    expect(html).not.toContain('by tester');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm run test:unit -- gantt-baseline-hover.test.mjs`
Expected: FAIL — multiple cases fail because the bar tooltip still contains Plan-vs-actual, the delta-pill tooltip type doesn't exist, and labels are still raw.

- [ ] **Step 3: Replace `buildPlanVsActual` helper**

Find `const buildPlanVsActual = (proj) => {` near line 16029 in `attachHoverHandlers`. Read the existing function (around lines 16029–16080). Replace the entire helper with:

```js
    // Build the Plan-vs-actual block — three sections: Plan vs actual, Slip contributors, What moved.
    // Used by the delta-pill tooltip (project pill) and the phase-tag tooltip (per-phase).
    // Returns '' if there's no active baseline data for this project.
    const buildPlanVsActual = (proj) => {
      if (!proj) return '';
      const ab = self._activeBaseline ? self._activeBaseline() : null;
      const node = (ab && ab.snapshot && ab.snapshot[proj.id]) || null;
      const baseStart = (node && node.start_date)  || proj.baseline_start;
      const baseEnd   = (node && node.target_date) || proj.baseline_end;
      const baseSize  = (node && node.size_total != null) ? node.size_total : (proj.size_total || 0);
      const liveStart = proj.start_date;
      const liveEnd   = proj.target_date;
      const liveSize  = proj.size_total || 0;
      if (!baseStart || !baseEnd || !liveStart || !liveEnd) return '';
      const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
      const startDelta  = Math.round((new Date(liveStart) - new Date(baseStart)) / 86400000);
      const targetDelta = Math.round((new Date(liveEnd)   - new Date(baseEnd))   / 86400000);
      const sizeDelta   = liveSize - baseSize;
      const startBit  = startDelta === 0 ? 'Start unchanged' : (startDelta > 0 ? 'Start +' + self._formatSlip(startDelta).replace(/^[+−]/, '') : 'Start ' + self._formatSlip(startDelta));
      const targetBit = targetDelta === 0 ? 'target unchanged' : (targetDelta > 0 ? 'target +' + self._formatSlip(targetDelta).replace(/^[+−]/, '') : 'target ' + self._formatSlip(targetDelta));
      const sizeBit   = sizeDelta === 0 ? 'scope unchanged' : (sizeDelta > 0 ? 'scope +' + sizeDelta + ' SP' : 'scope ' + sizeDelta + ' SP');

      // Slip contributors — phases that grew (expansion > 0) sorted by expansion desc.
      let contribsHtml = '';
      if (ab) {
        const skills = (typeof Sprint !== 'undefined' && Sprint.SKILLS) ? Sprint.SKILLS : [];
        const rows = skills.map(skMeta => {
          const spans = self._phaseSpans(proj, ab, skMeta.key);
          if (!spans || spans.expansion <= 0) return null;
          return { skill: skMeta, spans };
        }).filter(Boolean);
        rows.sort((a, b) => b.spans.expansion - a.spans.expansion);
        if (rows.length) {
          contribsHtml = '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border-light)">' +
            '<div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px">Slip contributors</div>' +
            '<ul style="margin:0 0 0 14px;padding:0;font-size:11px;color:var(--text-dark-secondary)">' +
            rows.map(r => '<li><strong>' + esc(r.skill.label) + '</strong> grew ' + r.spans.baseline.days + ' days &rarr; ' + r.spans.actual.days + ' days <span style="display:inline-block;background:var(--tint-red-weak);color:var(--status-red);padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;margin-left:4px">' + esc(self._formatSlip(r.spans.expansion)) + '</span></li>').join('') +
            '</ul></div>';
        }
      }

      // What moved — humanised audit-log
      let movers = '';
      try {
        const sinceTs = (ab && ab.created_at) || '';
        const log = (App.data.audit_log || []).filter(e => e.projectId === proj.id && (!sinceTs || (e.timestamp || '') >= sinceTs));
        const seen = new Set();
        const bullets = [];
        for (let i = log.length - 1; i >= 0 && bullets.length < 3; i--) {
          const e = log[i];
          if (!e.field || seen.has(e.field)) continue;
          seen.add(e.field);
          bullets.push('<li><strong>' + esc(self._humaniseField(e.field)) + '</strong>: ' + esc(String(e.oldValue || '')) + ' &rarr; ' + esc(String(e.newValue || '')) + '</li>');
        }
        if (bullets.length) {
          movers = '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border-light)">' +
            '<div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px">What moved</div>' +
            '<ul style="margin:0 0 0 14px;padding:0;font-size:11px;color:var(--text-dark-secondary)">' + bullets.join('') + '</ul></div>';
        } else if (log.length) {
          const last = log[log.length - 1];
          if (last && last.timestamp) {
            const when = new Date(last.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            movers = '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border-light);font-size:11px;color:var(--text-muted)">Last touched ' + esc(when) + '</div>';
          }
        }
      } catch (_) { /* audit log absent — fine */ }

      return '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border-light)">' +
        '<div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px">Plan vs actual</div>' +
        '<div style="font-size:11px;color:var(--text-dark-secondary)"><span style="color:var(--text-muted)">Originally planned</span> ' + fmtD(baseStart) + ' &rarr; ' + fmtD(baseEnd) + ' &middot; ' + baseSize + ' SP</div>' +
        '<div style="font-size:11px;color:var(--text-dark-secondary)"><span style="color:var(--text-muted)">Now</span> ' + fmtD(liveStart) + ' &rarr; ' + fmtD(liveEnd) + ' &middot; ' + liveSize + ' SP</div>' +
        '<div style="font-size:10px;color:var(--text-muted);margin-top:2px">' + startBit + ' &middot; ' + targetBit + ' &middot; ' + sizeBit + '</div>' +
        '</div>' + contribsHtml + movers;
    };
```

- [ ] **Step 4: Remove the bar/label injection of `buildPlanVsActual`**

In the `buildTooltip` function (just below the helper, around line 16110), find the bar/label branch's return statement that currently contains `+ buildPlanVsActual(p) +`. Read lines around 16110–16130 first to get exact text. Remove the `+ buildPlanVsActual(p)` insertion so the bar/label tooltip returns to its pre-PR-#15 content. The line should look like:

```js
buildAssigneeLine(p, null) + buildPhaseBreakdown(p) + buildProjectSummary(p);
```

(No `buildPlanVsActual(p)` in the chain.)

- [ ] **Step 5: Replace the `baseline` branch with a one-liner**

Find the `if (type === 'baseline')` branch in `buildTooltip` (~line 16220). Read the existing handler. Replace it with:

```js
      if (type === 'baseline' || type === 'phase-baseline') {
        const id = el.dataset.id;
        const p = id ? App.data.projects.find(pr => pr.id === id) : null;
        if (!p) return '';
        const sk = el.dataset.skillKey || null;
        const ab = self._activeBaseline ? self._activeBaseline() : null;
        if (sk && ab) {
          // Per-phase plan lane
          const spans = self._phaseSpans(p, ab, sk);
          if (!spans) return '';
          const fmtD = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          const skillMeta = (Sprint.SKILLS.find(s => s.key === sk) || {});
          return '<div style="font-size:11px;font-weight:700;color:var(--text-dark)">' + esc(skillMeta.label || sk) + ' plan</div>' +
                 '<div style="font-size:11px;color:var(--text-dark-secondary)">Originally planned ' + esc(fmtD(spans.baseline.startDate)) + ' &rarr; ' + esc(fmtD(spans.baseline.endDate)) + ' &middot; ' + spans.baseline.days + ' days</div>';
        }
        // Project plan lane
        const node = (ab && ab.snapshot && ab.snapshot[p.id]) || null;
        const baseStart = (node && node.start_date)  || p.baseline_start;
        const baseEnd   = (node && node.target_date) || p.baseline_end;
        if (!baseStart || !baseEnd) return '';
        const fmtD = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const days = Math.round((new Date(baseEnd) - new Date(baseStart)) / 86400000) + 1;
        return '<div style="font-size:11px;font-weight:700;color:var(--text-dark)">' + esc(p.name) + ' plan</div>' +
               '<div style="font-size:11px;color:var(--text-dark-secondary)">Originally planned ' + esc(fmtD(baseStart)) + ' &rarr; ' + esc(fmtD(baseEnd)) + ' &middot; ' + days + ' days</div>';
      }
```

- [ ] **Step 6: Add `delta-pill` and `phase-tag` branches to `buildTooltip`**

Just before the final `return '';` of `buildTooltip` (still around line 16235), insert:

```js
      if (type === 'delta-pill') {
        const id = el.dataset.id;
        const p = id ? App.data.projects.find(pr => pr.id === id) : null;
        if (!p) return '';
        const ab = self._activeBaseline ? self._activeBaseline() : null;
        const node = (ab && ab.snapshot && ab.snapshot[p.id]) || null;
        const baseEnd = (node && node.target_date) || p.baseline_end;
        if (!baseEnd || !p.target_date) return '';
        const targetDelta = Math.round((new Date(p.target_date) - new Date(baseEnd)) / 86400000);
        const slipText = self._formatSlip(targetDelta);
        const projHeader = '<div class="gantt-tooltip-title">' + esc(p.name) + ' slip <span style="font-size:10px;color:var(--text-muted);font-weight:400">' + esc(slipText) + ' on target</span></div>';
        return projHeader + buildPlanVsActual(p);
      }
      if (type === 'phase-tag') {
        const id = el.dataset.id;
        const sk = el.dataset.skillKey;
        const p = id ? App.data.projects.find(pr => pr.id === id) : null;
        const ab = self._activeBaseline ? self._activeBaseline() : null;
        if (!p || !sk || !ab) return '';
        const spans = self._phaseSpans(p, ab, sk);
        if (!spans) return '';
        const skillMeta = (Sprint.SKILLS.find(s => s.key === sk) || {});
        const fmtD = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const shiftText = spans.shift === 0 ? 'Start unchanged' : ('Started ' + self._formatSlip(spans.shift).replace(/^([+−])/, '$1') + ' from plan');
        const expandText = spans.expansion > 0 ? 'expanded by <strong style="color:var(--status-red)">' + esc(self._formatSlip(spans.expansion)) + '</strong>' : 'no expansion';
        // Largest contributor banner — compute total project slip and check this phase's share
        const node = (ab.snapshot || {})[p.id] || null;
        const baseEnd = (node && node.target_date) || p.baseline_end;
        const projectSlip = baseEnd && p.target_date ? Math.round((new Date(p.target_date) - new Date(baseEnd)) / 86400000) : 0;
        let contributorBanner = '';
        if (spans.expansion > 0) {
          const allRows = (Sprint.SKILLS || []).map(m => self._phaseSpans(p, ab, m.key)).filter(s => s && s.expansion > 0);
          const isLargest = allRows.length && allRows.every(r => r.expansion <= spans.expansion);
          if (isLargest && projectSlip !== 0) {
            contributorBanner = '<div style="margin-top:6px;padding:4px 8px;background:var(--tint-red-weak);color:var(--status-red);border-radius:4px;font-size:11px;font-weight:600">Largest contributor to project slip (' + esc(self._formatSlip(projectSlip)) + ' total)</div>';
          }
        }
        // Per-phase What moved — filter audit log to skill-specific fields
        let movers = '';
        try {
          const sinceTs = ab.created_at || '';
          const phaseFields = new Set([sk, 'skill_splits']);
          const log = (App.data.audit_log || []).filter(e => e.projectId === p.id && (!sinceTs || (e.timestamp || '') >= sinceTs) && phaseFields.has(e.field));
          const bullets = log.slice(-3).reverse().map(e => '<li><strong>' + esc(self._humaniseField(e.field)) + '</strong>: ' + esc(String(e.oldValue || '')) + ' &rarr; ' + esc(String(e.newValue || '')) + '</li>');
          if (bullets.length) {
            movers = '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border-light)">' +
              '<div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px">What moved here</div>' +
              '<ul style="margin:0 0 0 14px;padding:0;font-size:11px;color:var(--text-dark-secondary)">' + bullets.join('') + '</ul></div>';
          }
        } catch (_) { /* fine */ }
        return '<div class="gantt-tooltip-title">' + esc(skillMeta.label || sk) + ' contribution</div>' +
          '<div style="font-size:11px;color:var(--text-dark-secondary)"><span style="color:var(--text-muted)">Originally planned</span> ' + esc(fmtD(spans.baseline.startDate)) + ' &rarr; ' + esc(fmtD(spans.baseline.endDate)) + ' &middot; ' + spans.baseline.days + ' days</div>' +
          '<div style="font-size:11px;color:var(--text-dark-secondary)"><span style="color:var(--text-muted)">Now</span> ' + esc(fmtD(spans.actual.startDate)) + ' &rarr; ' + esc(fmtD(spans.actual.endDate)) + ' &middot; ' + spans.actual.days + ' days</div>' +
          '<div style="margin-top:6px;font-size:11px">' + esc(shiftText) + '; ' + expandText + '.</div>' +
          contributorBanner + movers;
      }
```

- [ ] **Step 7: Run the test — expect PASS**

Run: `npm run test:unit -- gantt-baseline-hover.test.mjs`
Expected: PASS — every case green (bar without Plan-vs-actual; pill with humanised labels and week format; phase-tag with contribution; plan lane one-liner).

- [ ] **Step 8: Run the full unit suite**

Run: `npm run test:unit`
Expected: pass (`gantt-baseline.test.mjs`, `gantt-baseline-detailed.test.mjs`, `gantt-baseline-helpers.test.mjs`, plus the renamed hover test all green; legacy snapshots untouched).

- [ ] **Step 9: Commit**

```bash
git add index.html tests/render/gantt-baseline-hover.test.mjs
git commit -m "feat(gantt): rewrite tooltip builder for delta-pill / phase-tag / phase-baseline"
```

---

## Task 8: Update e2e to hover the pill instead of the bracket

**Files:**
- Modify: `tests/e2e/gantt-baseline.spec.ts`

- [ ] **Step 1: Replace the e2e spec**

Read `tests/e2e/gantt-baseline.spec.ts` to confirm current contents. Replace with:
```ts
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Gantt slip pill: hover surfaces Plan vs actual + Slip contributors', async ({ page }) => {
  await openAppWithData(page);

  // Navigate to roadmap.
  await page.click('.nav-item[data-view="roadmap"]');
  await expect(page.locator('#ganttLabels')).toBeVisible();

  // Set up a slipped baseline programmatically: pick a project with skill_splits and slip 14 days.
  await page.evaluate(() => {
    const w = window as any;
    const cust = w.App.activeCustomer;
    const proj = w.App.data.projects.find((p: any) => p.customer === cust && p.skill_splits);
    if (!proj) return;
    proj.baseline_start = proj.start_date;
    proj.baseline_end = proj.target_date;
    const d = new Date(proj.target_date);
    d.setDate(d.getDate() + 14);
    proj.target_date = d.toISOString().split('T')[0];
    const cb = document.getElementById('ganttBaseline') as HTMLInputElement;
    if (cb) cb.checked = true;
    w.Gantt.render();
  });

  const pill = page.locator('.gantt-delta-pill').first();
  await expect(pill).toBeVisible();
  await pill.hover({ force: true });
  await expect(page.locator('#ganttTooltip')).toContainText('Plan vs actual');
  await expect(page.locator('#ganttTooltip')).toContainText('Slip contributors');
  await expect(page.locator('#ganttTooltip')).toContainText('Originally planned');
});
```

- [ ] **Step 2: Run the e2e test**

Run: `npm run test:e2e -- gantt-baseline.spec.ts`
Expected: PASS.

- [ ] **Step 3: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/gantt-baseline.spec.ts
git commit -m "test(e2e): hover delta pill surfaces Plan vs actual + slip contributors"
```

---

## Task 9: Final verification + push + PR

**Files:** none modified — verification only.

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: all green (unit + render + e2e).

- [ ] **Step 2: Manual smoke checklist**

Open `index.html`, load demo dataset (`Settings → Data → Load demo dataset`), then:

- [ ] Navigate to Roadmap. Set a named baseline ("Set baseline" button). Edit a project's `target_date` to slip it +14 days.
- [ ] Project header now shows: slate plan lane above the bar; red horizontal arrow with arrowhead spanning plan-end → actual-end; vertical dashed red drift line at plan-end with "plan end" label; red `+2w` pill vertically centred on the bar with visible 8 px gap.
- [ ] Pull the project in by 5 days. Pill turns green, reads `−5d`, plan lane extends past actual; no movement arrow.
- [ ] Reset to baseline. No pill, no arrow.
- [ ] Toggle Detailed mode. Each phase sub-row shows: status dot at left, 3-letter phase short code, slate plan lane, drift line. Phases that grew show a red striped overlay on the expanded portion + a red `+Nd` (or `+Nw`) tag + a red movement arrow.
- [ ] Hover bar / label: tooltip is the existing content (name, customer, status, RAG, phase breakdown, etc.). NO "Plan vs actual" block.
- [ ] Hover the project pill: tooltip shows Plan vs actual + Slip contributors + What moved with humanised labels (e.g. "Data Engineering scope: 5 SP → 12 SP" not "size_data_engineering").
- [ ] Hover a per-phase tag: tooltip shows that phase's contribution (start delta + expansion) with the largest-contributor banner where applicable.
- [ ] Hover the plan lane (project or phase): one-liner only.
- [ ] No tooltip anywhere contains "set 8 Apr by gbhall" / "set by …" / similar bookkeeping.
- [ ] Toggle dark theme: lanes, arrows, pills, status dots all readable.

- [ ] **Step 3: grep for stale class names**

Run: `grep -n "gantt-baseline-bracket\|gantt-baseline-spine\|baseline-arrow" index.html`
Expected: 0 hits in code (any matches should be in CSS comments only — verify by reading lines).

- [ ] **Step 4: Push branch and open PR**

```bash
git push -u origin feature/baseline-visualisation-v2
gh pr create --title "Baseline visualisation v2 — stacked plan/actual + per-phase culprits" --body "$(cat <<'EOF'
## Summary
- Replaces the bracket-above-bar pattern from PR #15 with a stacked plan / actual rendering: slate plan lane above, customer-coloured actual bar below, red movement arrow + drift line + week-formatted slip pill.
- Detailed mode now attributes the slip per phase: each phase sub-row gets its own plan lane, status dot, 3-letter short code, and (for phases that grew) a red striped overlay + per-phase ±d/±w tag + movement arrow. Phases that merely shifted but didn't expand are not flagged as culprits.
- Slip ≥ 7 days renders as weeks (`+1w`, `+2w 3d`); ≤ 6 days stays in days. On-plan projects show no pill at all.
- Hover commentary is concentrated on the ±d/±w pills (project pill = full slip story; per-phase tag = focused contribution). Bar/label hover reverts to its pre-PR-#15 content. Plan-lane hover is a one-liner.
- All audit-log labels in tooltips are humanised (`size_data_engineering` → "Data Engineering scope"). "Set by …" bookkeeping removed from every hover.

## Test plan
- [x] `npm run test:unit` — passes (new helpers test, rewritten baseline + hover tests, new detailed-mode test)
- [x] `npm run test:e2e` — passes (e2e updated to hover the pill)
- [x] Manual smoke: slip / early / on-plan, Detailed mode culprit attribution, all four hover targets, dark mode

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Verify CI green**

Wait for CI on the PR; both `Unit + render` and `E2E (Playwright)` jobs should pass. The advisory `Kilo Code Review` is not required.

---

## Spec self-review

| Spec section | Implemented in tasks |
|---|---|
| §1 Layout zones (project header + phase sub-row geometry) | Task 3 (CSS), Task 4 (project header render), Task 5 (sub-row render) |
| §2 Pill format (`_formatSlip`) | Task 1 (helper), Task 4/5 (used by render) |
| §3 Movement arrow primitive | Task 3 (CSS), Task 4/5 (rendered) |
| §4 Drift line | Task 4 (project header), Task 5 (sub-rows, no label) |
| §5 Per-phase culprit attribution (`_phaseSpans`) | Task 2 (helper), Task 5 (render) |
| §6 Phase status dot | Task 5 |
| §7 Phase name tag | Task 5 |
| §8 Hover model (delta-pill / phase-tag / phase-baseline / bar revert) | Task 6 (paint/erase), Task 7 (tooltip builder) |
| §9 Humanised labels (`_humaniseField`, `_FIELD_LABELS`) | Task 1 (helper), Task 7 (used in tooltip) |
| §10 CSS / DOM renames | Task 3 (replace bracket; new classes) |
| §11 Bookkeeping removal | Task 7 (no `setMeta`, no "set by") |
| §12 Per-render `_phaseSpans` cache | Task 2 (cache via Map); applied in render Tasks 4/5 |
| Edge cases (no baseline / on-plan / early / etc.) | Task 4 (project), Task 5 (phase) |
| Test plan §unit | Tasks 1, 2, 4, 5, 7 |
| Test plan §e2e | Task 8 |
| Test plan §manual | Task 9 step 2 |

**Type / identifier consistency check:**
- `_formatSlip(days)` defined Task 1, called Task 4, 5, 7. ✓
- `_humaniseField(field)` defined Task 1, called Task 7. ✓
- `_phaseSpans(p, baseline, skillKey)` defined Task 2, called Task 5, 7. ✓
- CSS classes `.gantt-plan-lane`, `.gantt-phase-plan-lane`, `.gantt-move-arrow` (with `.gantt-move-shaft` / `.gantt-move-head`), `.gantt-phase-tag`, `.gantt-phase-status-dot` (with modifiers `complete`/`in-progress`/`pending`), `.gantt-phase-name-tag`, `.gantt-phase-overlay-culprit`, `.gantt-drift-line` (with `.with-label`), `.gantt-delta-pill` (with `.slip`/`.early`) all defined in Task 3 and used consistently in Tasks 4/5. ✓
- Hover types `baseline`, `phase-baseline`, `phase-tag`, `delta-pill` all wired in Task 6 (paint/erase) and Task 7 (buildTooltip). ✓

**Placeholder scan:** searched for "TBD", "TODO", "implement later", "Add appropriate", "Similar to". Zero matches in this plan. Code blocks are concrete and copy-pasteable. Test code is complete.
