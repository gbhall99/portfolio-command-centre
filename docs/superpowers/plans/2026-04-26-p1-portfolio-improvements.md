# P1 Portfolio Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land five quarter-scoped improvements that lift the senior-manager portfolio average from ~6.5/10 (after P0) to ~7.5/10 — by introducing a *project conviction model*, *uncertainty-aware estimation*, *deferred phase planning*, a *single On-Track verdict per customer*, and a *When-by stakeholder widget*.

**Architecture:** All changes live inside the single-file `index.html` app. Tests use the existing `vitest`+`jsdom` harness with the `App` / `Sprint` / `Gantt` / `Capacity` / `Dashboard` / `Forecast` modules. New schema fields are migration-safe — older portfolios continue to load. Every feature is independently committable; phases can ship in any order, but the listed order minimises rework.

**Tech Stack:** Plain JS (zero build), inline SVG, `vitest` 2.1, `@playwright/test` 1.48, `jsdom` 25.

**Pre-flight:**

```bash
npm install
npm test
```

P0 plan should be merged before starting (Task 5 of P1 references the unified baseline shape from P0 Task 3).

---

## Phase A — Project Conviction (`lifecycle_stage`)

Add a first-class field that distinguishes a POC from a signed Implementation. Cascades into WSJF, Gantt rendering, Backlog Health, and Portfolio Pack annotations.

---

## Task 1: Schema + migration for `lifecycle_stage`

**Files:**
- Modify: `index.html` — extend the project schema in `quickAdd` (`index.html:12698-12730`) and the `_buildCandidateFromWizard` (`index.html:12915-12950`).
- Modify: `index.html` — extend `App.migrateSchema` (search for `migrateSchema:` or `migrateSchema(` in `index.html`).
- Test: `tests/unit/lifecycle-stage.test.mjs` (create).

- [ ] **Step 1: Write the failing schema test**

Create `tests/unit/lifecycle-stage.test.mjs`:

```javascript
// lifecycle_stage is a first-class field with a fixed enum and a migration
// path that defaults legacy projects to 'Implementation'.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

describe('lifecycle_stage — schema and migration', () => {
  it('exposes the canonical enum on App.LIFECYCLE_STAGES', async () => {
    const app = await loadApp(makeDataset({}));
    expect(app.App.LIFECYCLE_STAGES).toEqual(['Idea', 'Discovery', 'POC', 'Phase-1 Build', 'Implementation', 'Run/BAU']);
    app.teardown();
  });

  it('migrateSchema defaults missing lifecycle_stage to "Implementation"', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Legacy' });
    delete proj.lifecycle_stage;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    expect(app.App.data.projects[0].lifecycle_stage).toBe('Implementation');
    app.teardown();
  });

  it('migrateSchema does NOT overwrite an existing lifecycle_stage', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'POC', lifecycle_stage: 'POC' });
    const app = await loadApp(makeDataset({ projects: [proj] }));
    expect(app.App.data.projects[0].lifecycle_stage).toBe('POC');
    app.teardown();
  });

  it('quickAdd creates new projects with lifecycle_stage = "Implementation" by default', async () => {
    const app = await loadApp(makeDataset({}));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.quickAdd('blank');
    const created = app.App.data.projects[app.App.data.projects.length - 1];
    expect(created.lifecycle_stage).toBe('Implementation');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/unit/lifecycle-stage.test.mjs
```

Expected: FAIL — `App.LIFECYCLE_STAGES` undefined.

- [ ] **Step 3: Add the enum constant on `App`**

In `index.html` find `const App = {` and the early constants (search for `App = {` and look for top-of-module constants like `App.activeCustomer` initialiser). Insert near the top of the App object (before `data:`):

```javascript
  // Project conviction classes — sorts low-conviction work into a separate WSJF band so
  // an Idea cannot displace an Implementation by virtue of arithmetic alone.
  LIFECYCLE_STAGES: ['Idea', 'Discovery', 'POC', 'Phase-1 Build', 'Implementation', 'Run/BAU'],
  LIFECYCLE_STAGE_DEFAULT: 'Implementation',
```

- [ ] **Step 4: Extend `App.migrateSchema`**

In `index.html` search for `migrateSchema` and locate the per-project migration loop. Add (inside the loop body, before any closing brace):

```javascript
      if (!p.lifecycle_stage || App.LIFECYCLE_STAGES.indexOf(p.lifecycle_stage) < 0) {
        p.lifecycle_stage = App.LIFECYCLE_STAGE_DEFAULT;
      }
```

- [ ] **Step 5: Default `lifecycle_stage` in `quickAdd`**

In `index.html` find the `newProject` literal in `DetailPanel.quickAdd` (`index.html:12699-12730`). After `category: 'General',` add:

```javascript
      lifecycle_stage: App.LIFECYCLE_STAGE_DEFAULT,
```

Also update `_buildCandidateFromWizard` (`index.html:12928`). After `priority: 1,` add:

```javascript
      lifecycle_stage: App.LIFECYCLE_STAGE_DEFAULT,
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npm run test:unit -- tests/unit/lifecycle-stage.test.mjs
```

Expected: PASS — all four `it` blocks green.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/lifecycle-stage.test.mjs index.html
git commit -m "feat(schema): lifecycle_stage field with migration default Implementation"
```

---

## Task 2: Wizard input + Detail Panel field for `lifecycle_stage`

**Files:**
- Modify: `index.html:12793-12798` (wizard grid) — add a `lifecycle_stage` select.
- Modify: `index.html` — wherever `_confirmWizard` reads form values, capture lifecycle_stage and assign on the new project.
- Modify: `index.html` — DetailPanel detail body where category / status are rendered.
- Test: extend `tests/unit/lifecycle-stage.test.mjs`.

- [ ] **Step 1: Write the test**

Append to `tests/unit/lifecycle-stage.test.mjs`:

```javascript
describe('lifecycle_stage — wizard capture', () => {
  it('reads lifecycle_stage from the wizard select on Create', async () => {
    const app = await loadApp(makeDataset({}));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel._openQuickAddWizard();
    const sel = app.window.document.getElementById('qaLifecycleStage');
    expect(sel).not.toBeNull();
    sel.value = 'POC';
    app.window.document.getElementById('qaName').value = 'A POC';
    app.DetailPanel._confirmWizard();
    const created = app.App.data.projects.find(p => p.name === 'A POC');
    expect(created).toBeDefined();
    expect(created.lifecycle_stage).toBe('POC');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/unit/lifecycle-stage.test.mjs
```

Expected: FAIL — `qaLifecycleStage` element does not exist.

- [ ] **Step 3: Add the select to the wizard grid**

In `index.html` find the four-cell grid in `_openQuickAddWizard` (`index.html:12793-12798`). Replace the closing `</div>` of that grid (the line that ends the `display:grid;grid-template-columns:1fr 1fr` block) with:

```javascript
          '<label style="font-size:11px;font-weight:600">Conviction<br><select id="qaLifecycleStage" style="width:100%;padding:5px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px;margin-top:2px">' +
            App.LIFECYCLE_STAGES.map(s => '<option value="' + Dashboard.esc(s) + '"' + (s === App.LIFECYCLE_STAGE_DEFAULT ? ' selected' : '') + '>' + Dashboard.esc(s) + '</option>').join('') +
          '</select><div style="font-size:10px;color:var(--text-muted);margin-top:2px">Idea / Discovery / POC are sorted into a low-conviction band.</div></label>' +
        '</div>' +
```

- [ ] **Step 4: Read the select on confirm**

In `index.html` find `_confirmWizard` (search for `DetailPanel._confirmWizard`). Locate the line where `quickAdd(template_or_blank)` is called or where the new project assigns its template fields. Just before the project is added (i.e. before `App.addProject(...)` or its equivalent), find the place where `name` is captured and add immediately after:

```javascript
    const lifecycleEl = document.getElementById('qaLifecycleStage');
    const lifecycleVal = lifecycleEl ? lifecycleEl.value : App.LIFECYCLE_STAGE_DEFAULT;
```

Then, where the new project record is built or mutated, set:

```javascript
    newProject.lifecycle_stage = lifecycleVal;
```

(Adjust variable name to match the actual one in `_confirmWizard`.)

- [ ] **Step 5: Render the field on the Detail Panel**

In `index.html` find `DetailPanel.renderBody` and locate the section that renders `Category`. Just below the Category field, insert an analogous select for `lifecycle_stage` using `App.LIFECYCLE_STAGES`:

```javascript
      // Lifecycle stage — conviction class, drives WSJF band and Gantt chip.
      const stageOptions = App.LIFECYCLE_STAGES.map(s =>
        '<option value="' + Dashboard.esc(s) + '"' + (p.lifecycle_stage === s ? ' selected' : '') + '>' + Dashboard.esc(s) + '</option>'
      ).join('');
      // Insert near other inline edit selects following the existing pattern (look at category select markup).
      // The field-input class wires onchange to App.updateField with field='lifecycle_stage'.
```

The actual markup follows the same pattern as the category select. Locate the existing `data-field="category"` markup and clone it for `data-field="lifecycle_stage"` using `stageOptions`.

- [ ] **Step 6: Run the tests**

```bash
npm run test:unit -- tests/unit/lifecycle-stage.test.mjs
```

Expected: PASS — including the new wizard-capture test.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/lifecycle-stage.test.mjs index.html
git commit -m "feat(detail-panel): lifecycle_stage editable in wizard and detail panel"
```

---

## Task 3: Lifecycle chip + WSJF banding

**Files:**
- Modify: `index.html` — add `App.lifecycleStageChip(p)` helper.
- Modify: `index.html` — Projects grid `buildRowHtml` (search for `buildRowHtml`) — render chip in the project name cell.
- Modify: `index.html` — Gantt bar render block (`index.html:14282-14290`) — append chip to bar label when `w > 60`.
- Modify: `index.html` — `App.calculateProjectPriorityScore` (`index.html:6138`) and / or solver sort comparator — apply low-conviction band penalty.
- Test: extend `tests/unit/lifecycle-stage.test.mjs` and `tests/unit/scoring.test.mjs`.

- [ ] **Step 1: Write the test**

Append to `tests/unit/lifecycle-stage.test.mjs`:

```javascript
describe('lifecycleStageChip + WSJF banding', () => {
  it('renders a colour-coded chip for each stage', async () => {
    const app = await loadApp(makeDataset({}));
    expect(app.App.lifecycleStageChip({ lifecycle_stage: 'POC' })).toMatch(/POC/);
    expect(app.App.lifecycleStageChip({ lifecycle_stage: 'Implementation' })).toMatch(/Implementation/);
    expect(app.App.lifecycleStageChip({})).toMatch(/Implementation/); // default
    app.teardown();
  });

  it('low-conviction projects sort below high-conviction projects within the same WSJF band', async () => {
    resetIdSeq();
    // Two projects with the same WSJF inputs; one is POC, one is Implementation.
    const poc = makeProject({
      name: 'A POC', lifecycle_stage: 'POC',
      business_value: 8, time_criticality: 6, risk_reduction_opportunity: 5,
      size_engineering: 10
    });
    poc.size_total = 10;
    const impl = makeProject({
      name: 'An impl', lifecycle_stage: 'Implementation',
      business_value: 8, time_criticality: 6, risk_reduction_opportunity: 5,
      size_engineering: 10
    });
    impl.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [poc, impl] }));
    const pocScore = app.App.calculateProjectPriorityScore(poc, 0);
    const implScore = app.App.calculateProjectPriorityScore(impl, 0);
    expect(implScore).toBeGreaterThan(pocScore);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test:unit -- tests/unit/lifecycle-stage.test.mjs
```

Expected: FAIL — `App.lifecycleStageChip` undefined; banding not applied.

- [ ] **Step 3: Implement the chip helper**

In `index.html` find `App.priorityWarningChip` (`index.html:6118`). Just below it, insert:

```javascript
  // One-line chip rendered next to project names everywhere a conviction class matters.
  // Returns inline-styled HTML (everything escaped) so it can be interpolated directly.
  lifecycleStageChip(project) {
    const stage = (project && project.lifecycle_stage) || App.LIFECYCLE_STAGE_DEFAULT;
    const palette = {
      'Idea':           { bg: '#f1f5f9', fg: '#475569' },
      'Discovery':      { bg: '#ede9fe', fg: '#5b21b6' },
      'POC':            { bg: '#fef3c7', fg: '#b45309' },
      'Phase-1 Build':  { bg: '#dbeafe', fg: '#1d4ed8' },
      'Implementation': { bg: '#dcfce7', fg: '#166534' },
      'Run/BAU':        { bg: '#e0f2fe', fg: '#075985' }
    };
    const c = palette[stage] || palette[App.LIFECYCLE_STAGE_DEFAULT];
    return '<span class="lifecycle-chip" style="display:inline-block;padding:1px 6px;border-radius:3px;background:' + c.bg + ';color:' + c.fg + ';font-size:10px;font-weight:700;letter-spacing:0.3px;margin-left:4px" title="Project conviction class — affects WSJF band and Gantt visual treatment">' + Dashboard.esc(stage) + '</span>';
  },

  // Low-conviction stages (Idea, Discovery, POC) sort BELOW high-conviction within the same priority band.
  lifecycleConvictionPenalty(project) {
    const stage = (project && project.lifecycle_stage) || App.LIFECYCLE_STAGE_DEFAULT;
    if (stage === 'Idea')      return 25;
    if (stage === 'Discovery') return 15;
    if (stage === 'POC')       return 10;
    return 0;
  },

```

- [ ] **Step 4: Apply the conviction penalty in `calculateProjectPriorityScore`**

In `index.html` find `calculateProjectPriorityScore` (`index.html:6138`). At the very end, replace `return Math.round(score);` (or `return score;`, look at the actual function tail) with:

```javascript
    const penalty = this.lifecycleConvictionPenalty(project);
    return Math.round((typeof score === 'number' ? score : 0) - penalty);
```

(`score` is the local computed total in that function — replace with the actual variable name if different.)

- [ ] **Step 5: Render the chip on the Projects grid row**

In `index.html` find `Dashboard.buildRowHtml` (search for `buildRowHtml`). Locate the cell that renders the project name. Append `+ App.lifecycleStageChip(p)` after the existing project-name HTML.

- [ ] **Step 6: Render the chip on the Gantt bar**

In `index.html` find the `barLabel` block (`index.html:14282-14283`):

```javascript
      let barLabel = '';
      if (w > 60) barLabel = '<span class="bar-label" style="position:relative;z-index:1">' + Dashboard.esc(p.name) + '</span>';
```

Replace with:

```javascript
      let barLabel = '';
      if (w > 60) barLabel = '<span class="bar-label" style="position:relative;z-index:1">' + Dashboard.esc(p.name) + App.lifecycleStageChip(p) + '</span>';
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
npm run test:unit -- tests/unit/lifecycle-stage.test.mjs tests/unit/scoring.test.mjs
```

Expected: PASS. The existing scoring tests must not regress — the conviction penalty does not apply when `lifecycle_stage` is `Implementation` (the default after migration), so legacy fixtures are unaffected.

- [ ] **Step 8: Commit**

```bash
git add tests/unit/lifecycle-stage.test.mjs index.html
git commit -m "feat(scoring): conviction-aware WSJF banding + lifecycle chip on grid and Gantt"
```

---

## Phase B — Range Estimation + Cone of Uncertainty

Replace single-point estimates with a (most-likely, max) pair per skill. The solver continues to consume the most-likely. The Gantt overlays a dashed cone to the right showing the worst case. The Forecast cone widens for early-stage projects.

---

## Task 4: Schema for per-skill estimate ranges

**Files:**
- Modify: `index.html` — extend project schema in `quickAdd`, `_buildCandidateFromWizard`, and `migrateSchema`.
- Test: `tests/unit/range-estimation.test.mjs` (create).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/range-estimation.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

describe('Range estimation — schema', () => {
  it('migrateSchema seeds *_max fields equal to their point estimate when missing', async () => {
    resetIdSeq();
    const proj = makeProject({ size_engineering: 10, size_tableau: 5 });
    delete proj.size_engineering_max;
    delete proj.size_tableau_max;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    expect(app.App.data.projects[0].size_engineering_max).toBe(10);
    expect(app.App.data.projects[0].size_tableau_max).toBe(5);
    app.teardown();
  });

  it('does not overwrite an explicit *_max if already set', async () => {
    resetIdSeq();
    const proj = makeProject({ size_engineering: 10 });
    proj.size_engineering_max = 24;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    expect(app.App.data.projects[0].size_engineering_max).toBe(24);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/unit/range-estimation.test.mjs
```

Expected: FAIL — `size_engineering_max` undefined after migration.

- [ ] **Step 3: Extend `App.migrateSchema`**

In `index.html` inside `migrateSchema`'s per-project loop, add:

```javascript
      ['size_requirements', 'size_tableau', 'size_engineering', 'size_data_science', 'size_uat_adoption'].forEach(k => {
        const maxKey = k + '_max';
        if (typeof p[maxKey] !== 'number' || p[maxKey] < (p[k] || 0)) {
          p[maxKey] = p[k] || 0;
        }
      });
```

- [ ] **Step 4: Default the *_max fields in `quickAdd`**

In `index.html` find `newProject` literal (`index.html:12711-12712`):

```javascript
      size_requirements: 0, size_tableau: 0, size_engineering: 0,
      size_data_science: 0, size_uat_adoption: 0, size_total: 0,
```

Replace with:

```javascript
      size_requirements: 0, size_tableau: 0, size_engineering: 0,
      size_data_science: 0, size_uat_adoption: 0, size_total: 0,
      size_requirements_max: 0, size_tableau_max: 0, size_engineering_max: 0,
      size_data_science_max: 0, size_uat_adoption_max: 0,
```

(Apply the same insertion to `_buildCandidateFromWizard` `index.html:12933`.)

- [ ] **Step 5: Run the tests**

```bash
npm run test:unit -- tests/unit/range-estimation.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/range-estimation.test.mjs index.html
git commit -m "feat(schema): per-skill *_max estimate fields with safe migration default"
```

---

## Task 5: Detail Panel inputs for `*_max`

**Files:**
- Modify: `index.html` — in `DetailPanel.renderBody`, find the per-skill point-estimate input(s). Pair each with a `_max` input directly to the right.
- Test: extend `tests/unit/range-estimation.test.mjs`.

- [ ] **Step 1: Write the test**

Append:

```javascript
describe('Range estimation — detail panel input', () => {
  it('renders a *_max input for every sized skill', async () => {
    resetIdSeq();
    const proj = makeProject({
      name: 'Ranged', size_engineering: 10, size_engineering_max: 24
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    app.DetailPanel.open(proj.id);
    const html = app.window.document.getElementById('detailBody').innerHTML;
    expect(html).toMatch(/data-field="size_engineering_max"/);
    expect(html).toMatch(/value="24"/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/unit/range-estimation.test.mjs
```

Expected: FAIL — no `size_engineering_max` field-input in the rendered detail panel.

- [ ] **Step 3: Extend the detail panel skill rows**

In `index.html` find the skill-size rendering inside `DetailPanel.renderBody` (search for `data-field="size_engineering"`). For each of the five sizing fields, render a partner `_max` input immediately after the existing input. Pattern:

```javascript
      // Existing point-estimate input — leave as-is, then immediately after, add:
      '<label style="display:flex;flex-direction:column;font-size:10px;color:var(--text-muted);margin-left:6px">Worst case' +
        '<input type="number" class="field-input" data-field="size_engineering_max" data-pid="' + Dashboard.esc(p.id) + '" value="' + (p.size_engineering_max || p.size_engineering || 0) + '" min="0" step="1" style="width:60px;padding:3px 5px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:11px;margin-top:2px">' +
      '</label>'
```

Apply for all five skills: `size_requirements`, `size_tableau`, `size_engineering`, `size_data_science`, `size_uat_adoption`.

- [ ] **Step 4: Update field-save logic to clamp `_max` ≥ point estimate**

In `index.html` find the field-save dispatcher (search for `data-field="size_engineering"` save handler — typically `App.updateField` or similar). When saving a `*_max` field, clamp:

```javascript
    if (field.endsWith('_max')) {
      const baseField = field.replace(/_max$/, '');
      const baseVal = Number(p[baseField] || 0);
      if (Number(value) < baseVal) value = baseVal;
    }
```

Add this clamp in the same code path that currently parses numeric size fields.

- [ ] **Step 5: Run the tests**

```bash
npm run test:unit -- tests/unit/range-estimation.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/range-estimation.test.mjs index.html
git commit -m "feat(detail-panel): per-skill worst-case (*_max) input with clamp"
```

---

## Task 6: Gantt cone-of-uncertainty overlay

**Files:**
- Modify: `index.html:14282-14315` (the bar-label / segments / baseline block in `Gantt.render`).
- Test: `tests/render/gantt-cone.test.mjs` (create).

- [ ] **Step 1: Write the failing render test**

Create `tests/render/gantt-cone.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

describe('Gantt cone of uncertainty', () => {
  it('renders a dashed extension when *_max exceeds point estimate', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'Ranged',
      start_date: '2026-01-05', target_date: '2026-02-09',
      size_engineering: 10, size_engineering_max: 24
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints, team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Gantt.render();
    const html = app.window.document.getElementById('ganttBody').innerHTML;
    expect(html).toMatch(/gantt-cone/);
    app.teardown();
  });

  it('does not render a cone when *_max equals point estimate', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'No cone', start_date: '2026-01-05', target_date: '2026-02-09',
      size_engineering: 10, size_engineering_max: 10
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints, team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Gantt.render();
    const html = app.window.document.getElementById('ganttBody').innerHTML;
    expect(html).not.toMatch(/gantt-cone/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/render/gantt-cone.test.mjs
```

Expected: FAIL — `gantt-cone` class not yet emitted.

- [ ] **Step 3: Compute cone fraction and emit overlay**

In `index.html` find the bar-render block in `Gantt.render`. Locate the `let baselineHtml = '';` line (`index.html:14294`). Just before it, insert:

```javascript
      let coneHtml = '';
      const coneTotal = ['size_requirements','size_tableau','size_engineering','size_data_science','size_uat_adoption']
        .reduce((sum, k) => sum + (p[k] || 0), 0);
      const coneTotalMax = ['size_requirements','size_tableau','size_engineering','size_data_science','size_uat_adoption']
        .reduce((sum, k) => sum + Math.max(p[k + '_max'] || 0, p[k] || 0), 0);
      if (coneTotalMax > coneTotal && coneTotal > 0) {
        const coneFrac = (coneTotalMax - coneTotal) / coneTotal;
        const coneW = Math.max(8, Math.round(w * coneFrac));
        coneHtml = '<div class="gantt-cone" style="position:absolute;left:' + w + 'px;top:0;bottom:0;width:' + coneW + 'px;border:1px dashed ' + color + ';border-left:none;background:repeating-linear-gradient(45deg,' + color + '12,' + color + '12 4px,transparent 4px,transparent 8px);opacity:0.8" title="Worst case: +' + (coneTotalMax - coneTotal) + ' SP"></div>';
      }
```

Then, where `barContent` is assembled into the bar markup (a few lines below where it's currently used), make sure `coneHtml` is appended to the same wrapper as `baselineHtml` (typically an outer `<div>` per project row).

Concretely, find where the bar wrapper is rendered (the line like `<div class="gantt-bar" ...>` before/after `barContent`). After the existing wrapper `<div>` that contains the bar, add `coneHtml` adjacent to it. If you cannot identify the exact concat point, append `+ coneHtml` to the same string the function returns for that bar.

- [ ] **Step 4: Run the tests**

```bash
npm run test:unit -- tests/render/gantt-cone.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/render/gantt-cone.test.mjs index.html
git commit -m "feat(gantt): cone-of-uncertainty extension when *_max > point estimate"
```

---

## Task 7: Forecast — cone widens by `lifecycle_stage`

**Files:**
- Modify: `index.html:20377-20396` (`Forecast.projectForecast`).
- Test: extend `tests/unit/range-estimation.test.mjs`.

- [ ] **Step 1: Write the test**

Append to `tests/unit/range-estimation.test.mjs`:

```javascript
describe('Forecast cone widens by lifecycle_stage', () => {
  it('returns a wider P95 for a POC than for an Implementation with identical inputs', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(6);
    const sized = (stage) => {
      const p = makeProject({
        name: stage, lifecycle_stage: stage,
        size_engineering: 30,
        skill_splits: {
          size_engineering: [
            { sprint: sprints[0].sprint_id, points: 10, status: 'complete', completed: 10, assigned_to: [], reasons: [] },
            { sprint: sprints[1].sprint_id, points: 10, status: 'complete', completed: 10, assigned_to: [], reasons: [] }
          ]
        }
      });
      p.size_total = 30;
      return p;
    };
    const poc = sized('POC');
    const impl = sized('Implementation');
    const app = await loadApp(makeDataset({
      projects: [poc, impl], sprints, team_members: [makeMember({ available_points_per_sprint: 10 })]
    }));
    const pocFc = app.Forecast.projectForecast(poc);
    const implFc = app.Forecast.projectForecast(impl);
    expect(pocFc.distribution).toBeTruthy();
    expect(implFc.distribution).toBeTruthy();
    expect(pocFc.distribution.p95).toBeGreaterThanOrEqual(implFc.distribution.p95);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/unit/range-estimation.test.mjs
```

Expected: FAIL — POC and Implementation produce identical distributions.

- [ ] **Step 3: Apply a lifecycle-stage cone widener in `Forecast.projectForecast`**

In `index.html` find:

```javascript
    const useValues = (perProjectVelocity.reduce((a, b) => a + b, 0) > 0) ? perProjectVelocity : stats.values;
    const distribution = this.simulateSprintsNeeded(remaining, useValues, opts.runs);
```

Replace with:

```javascript
    const useValues = (perProjectVelocity.reduce((a, b) => a + b, 0) > 0) ? perProjectVelocity : stats.values;
    // Cone of uncertainty widens by lifecycle_stage. Lower-conviction stages widen the
    // velocity sample range so P80 / P95 tail farther.
    const stageWideners = {
      'Idea':           1.6,
      'Discovery':      1.4,
      'POC':            1.6,
      'Phase-1 Build':  1.25,
      'Implementation': 1.0,
      'Run/BAU':        1.0
    };
    const widener = stageWideners[project.lifecycle_stage] || 1.0;
    const widened = useValues.map(v => v / widener);
    const distribution = this.simulateSprintsNeeded(remaining, widened, opts.runs);
```

(The widener divides the per-sprint velocity, which extends the simulated number of sprints needed — matching the wider cone interpretation.)

- [ ] **Step 4: Run the tests**

```bash
npm run test:unit -- tests/unit/range-estimation.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/range-estimation.test.mjs index.html
git commit -m "feat(forecast): cone of uncertainty widens by lifecycle_stage"
```

---

## Phase C — Phase Deferral (TBD phases)

`delivery_config.phase_order` accepts string entries OR objects of shape `{ phase, status }`. `status: 'tbd'` excludes the entry from the solver and renders it as a dashed open-ended Gantt bar.

---

## Task 8: Phase entry shape + solver exclusion

**Files:**
- Modify: `index.html` — `Solver.solve` setup pass (search for `phase_order` in `Solver`).
- Test: `tests/unit/tbd-phases.test.mjs` (create).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/tbd-phases.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

describe('TBD phases — solver exclusion', () => {
  it('a phase_order entry with status: tbd does not get scheduled', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'Discovery only', size_requirements: 5, size_engineering: 10,
      delivery_config: {
        phase_order: ['Requirements', { phase: 'Data Engineering', status: 'tbd' }]
      }
    });
    proj.size_total = 15;
    const member = makeMember({ name: 'Alice', primary_skills: ['Requirements', 'Data Engineering'], available_points_per_sprint: 20 });
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [member] }));
    const plan = app.Solver.solve('Acme Industries', app.Sprint.allocSettings, app.App.data, app.Sprint);
    const reqSlices = (plan.allocations[proj.id] && plan.allocations[proj.id].size_requirements) || [];
    const deSlices = (plan.allocations[proj.id] && plan.allocations[proj.id].size_engineering) || [];
    expect(reqSlices.length).toBeGreaterThan(0);
    expect(deSlices.length).toBe(0);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/unit/tbd-phases.test.mjs
```

Expected: FAIL — solver still places `size_engineering` slices because the phase_order entry shape isn't recognised.

- [ ] **Step 3: Add a normaliser in the Solver**

In `index.html` find the place inside `Solver.solve` that consumes `phase_order` (typically inside `allocateProject` or its setup). Insert at the top of `Solver` (or inside `solve` near other helpers):

```javascript
  // Normalise phase_order entries — accept strings OR { phase, status }. Returns
  // an array of { phase, status } with status defaulting to 'planned'. Entries with
  // status 'tbd' are excluded from scheduling but preserved for Gantt rendering.
  _normalisePhaseOrder(phaseOrder) {
    if (!Array.isArray(phaseOrder)) return [];
    return phaseOrder.map(e => {
      if (typeof e === 'string') return { phase: e, status: 'planned' };
      if (e && typeof e === 'object') return { phase: e.phase, status: e.status || 'planned' };
      return null;
    }).filter(Boolean);
  },

  _activePhaseOrder(phaseOrder) {
    return this._normalisePhaseOrder(phaseOrder).filter(e => e.status !== 'tbd').map(e => e.phase);
  },
```

- [ ] **Step 4: Apply the filter at the Solver's `phase_order` read**

Locate the Solver's primary `phase_order` read (currently at `index.html:13532`):

```javascript
      const phaseOrder = (proj.delivery_config.phase_order || []);
```

Replace with:

```javascript
      const phaseOrder = Solver._activePhaseOrder((proj.delivery_config && proj.delivery_config.phase_order) || []);
```

Confirm no other Solver-internal reads exist by running:

```bash
awk '/const Solver = \{/,/^\};/' index.html | grep -n "phase_order"
```

If the awk returns additional sites inside the `Solver` block, wrap each one identically. **Do NOT modify** the detail-panel and Gantt reads (`index.html` lines 11037, 11081, 12411, 12523, 12578, 13109). Those MUST keep the full `phase_order` so TBD entries can render — only the Solver iterates the filtered list.

- [ ] **Step 5: Run the tests**

```bash
npm run test:unit -- tests/unit/tbd-phases.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run the full unit suite (regression check)**

```bash
npm run test:unit
```

Expected: PASS — solver R1–R12 invariants stay green.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/tbd-phases.test.mjs index.html
git commit -m "feat(solver): phase_order accepts {phase,status} objects; tbd phases excluded"
```

---

## Task 9: Gantt — dashed bar for TBD phases

**Files:**
- Modify: `index.html:14282-14315` (Gantt bar render block).
- Test: `tests/render/gantt-cone.test.mjs` (extend).

- [ ] **Step 1: Write the test**

Append to `tests/render/gantt-cone.test.mjs`:

```javascript
describe('Gantt — TBD phase bar', () => {
  it('renders a dashed open-ended bar for projects with a tbd phase', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'Discovery only',
      start_date: '2026-01-05', target_date: '2026-02-09',
      size_requirements: 5,
      delivery_config: { phase_order: ['Requirements', { phase: 'Data Engineering', status: 'tbd' }] }
    });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints, team_members: [makeMember({ primary_skills: ['Requirements'] })]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Gantt.render();
    const html = app.window.document.getElementById('ganttBody').innerHTML;
    expect(html).toMatch(/gantt-tbd/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/render/gantt-cone.test.mjs
```

Expected: FAIL — `gantt-tbd` class not yet emitted.

- [ ] **Step 3: Render the dashed open-ended bar**

In `index.html` inside the `Gantt.render` per-project loop (just before or after the cone overlay from Task 6), insert:

```javascript
      // TBD phase indicator — draws an open-ended dashed bar to the right of the live bar
      // showing that future phases exist but are not yet scheduled.
      let tbdHtml = '';
      const phaseEntries = Array.isArray(p.delivery_config && p.delivery_config.phase_order) ? p.delivery_config.phase_order : [];
      const hasTbd = phaseEntries.some(e => e && typeof e === 'object' && e.status === 'tbd');
      if (hasTbd) {
        tbdHtml = '<div class="gantt-tbd" style="position:absolute;left:' + (w + (coneHtml ? 0 : 0)) + 'px;top:6px;bottom:6px;width:60px;border:2px dashed ' + color + ';border-left:none;background:transparent;opacity:0.7;display:flex;align-items:center;justify-content:center;font-size:9px;color:' + color + ';font-weight:700" title="Phase 2+ TBD pending Discovery findings">TBD</div>';
      }
```

Then append `tbdHtml` to the same outer wrapper that contains the bar (alongside `coneHtml` and `baselineHtml`).

- [ ] **Step 4: Run the tests**

```bash
npm run test:unit -- tests/render/gantt-cone.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/render/gantt-cone.test.mjs index.html
git commit -m "feat(gantt): dashed open-ended bar for tbd phases"
```

---

## Phase D — On-Track Verdict tile

A single tile per customer that synthesises EVM SPI band + RAG mover count + capacity-vs-demand red sprints into one of *On Track* / *Watch* / *Off Track* with a 30-word justification.

---

## Task 10: `Dashboard.computeOnTrackVerdict` helper

**Files:**
- Modify: `index.html` — add helper to `Dashboard`.
- Test: `tests/unit/on-track-verdict.test.mjs` (create).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/on-track-verdict.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function setup(projects) {
  resetIdSeq();
  const sprints = makeSprintSequence(2);
  const app = await loadApp(makeDataset({
    projects, sprints, team_members: [makeMember()]
  }));
  return app;
}

describe('Dashboard.computeOnTrackVerdict', () => {
  it('returns On Track when all signals are clean', async () => {
    const proj = makeProject({ status: 'In Progress', rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green' });
    proj.size_total = 5;
    const app = await setup([proj]);
    const v = app.Dashboard.computeOnTrackVerdict('Acme Industries');
    expect(v.verdict).toBe('On Track');
    expect(v.justification.length).toBeGreaterThan(0);
    expect(Array.isArray(v.inputs)).toBe(true);
    app.teardown();
  });

  it('returns Off Track when 2+ signals are red', async () => {
    const proj = makeProject({ status: 'Blocked', rag_schedule: 'Red', rag_resourcing: 'Red', rag_scope: 'Red' });
    proj.size_total = 5;
    const app = await setup([proj]);
    const v = app.Dashboard.computeOnTrackVerdict('Acme Industries');
    expect(v.verdict).toBe('Off Track');
    app.teardown();
  });

  it('returns Watch when one signal is red or amber', async () => {
    const proj = makeProject({ status: 'In Progress', rag_schedule: 'Amber', rag_resourcing: 'Green', rag_scope: 'Green' });
    proj.size_total = 5;
    const app = await setup([proj]);
    const v = app.Dashboard.computeOnTrackVerdict('Acme Industries');
    expect(v.verdict).toBe('Watch');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/unit/on-track-verdict.test.mjs
```

Expected: FAIL — helper missing.

- [ ] **Step 3: Implement the helper**

In `index.html` find `Dashboard.renderExecSummary` (`index.html:8801`). Just before that method add:

```javascript
  // On-Track Verdict — combines EVM-style SPI proxy, RAG mover count, and capacity
  // pressure into a single defensible verdict per customer. Returns:
  //   { verdict: 'On Track' | 'Watch' | 'Off Track', justification, inputs: [...] }
  computeOnTrackVerdict(customer) {
    const all = (App.data && App.data.projects ? App.data.projects : []).filter(p => p.customer === customer);
    const active = all.filter(p => p.status !== 'Complete' && p.status !== 'Closed');
    if (!active.length) {
      return { verdict: 'On Track', justification: 'No active projects.', inputs: [] };
    }
    const redRagCount = active.filter(p =>
      p.rag_schedule === 'Red' || p.rag_resourcing === 'Red' || p.rag_scope === 'Red'
    ).length;
    const blockedCount = active.filter(p => p.status === 'Blocked').length;
    // Capacity-pressure signal: any sprint where any skill cell is red.
    let redCapacityCells = 0;
    if (typeof Capacity !== 'undefined' && Capacity.computeResourcingGap) {
      const gap = Capacity.computeResourcingGap(customer);
      gap.bySkill.forEach(row => {
        row.bySprint.forEach(cell => { if (cell.gap < 0) redCapacityCells++; });
      });
    }
    const inputs = [
      { name: 'Red RAG projects', value: redRagCount, threshold: 0 },
      { name: 'Blocked projects', value: blockedCount, threshold: 0 },
      { name: 'Capacity deficit cells', value: redCapacityCells, threshold: 0 }
    ];
    let redSignals = 0;
    if (redRagCount > 0) redSignals++;
    if (blockedCount > 0) redSignals++;
    if (redCapacityCells > 0) redSignals++;
    let verdict, justification;
    if (redSignals >= 2) {
      verdict = 'Off Track';
      justification = 'Multiple red signals: ' + (redRagCount ? redRagCount + ' Red RAG, ' : '') + (blockedCount ? blockedCount + ' blocked, ' : '') + (redCapacityCells ? redCapacityCells + ' capacity deficit cells' : '');
    } else if (redSignals === 1) {
      verdict = 'Watch';
      justification = redRagCount ? (redRagCount + ' projects with Red RAG.') : blockedCount ? (blockedCount + ' projects blocked.') : (redCapacityCells + ' sprint capacity deficits.');
    } else {
      // Could still be Watch if any RAG is Amber.
      const amberCount = active.filter(p =>
        p.rag_schedule === 'Amber' || p.rag_resourcing === 'Amber' || p.rag_scope === 'Amber'
      ).length;
      if (amberCount > 0) {
        verdict = 'Watch';
        justification = amberCount + ' projects with Amber RAG. No reds.';
      } else {
        verdict = 'On Track';
        justification = active.length + ' active projects, all green, no capacity deficit.';
      }
    }
    return { verdict, justification: justification.replace(/, $/, '.'), inputs };
  },

```

- [ ] **Step 4: Run the tests**

```bash
npm run test:unit -- tests/unit/on-track-verdict.test.mjs
```

Expected: PASS — all three `it` blocks green.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/on-track-verdict.test.mjs index.html
git commit -m "feat(dashboard): computeOnTrackVerdict synthesises RAG/blocked/capacity into one verdict"
```

---

## Task 11: On-Track Verdict tile rendering

**Files:**
- Modify: `index.html` — find KPI cards block (`index.html:8954-9200+`) — add a verdict tile as the first card.
- Test: `tests/render/on-track-tile.test.mjs` (create).

- [ ] **Step 1: Write the test**

Create `tests/render/on-track-tile.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

describe('On-Track Verdict tile', () => {
  it('renders into the dashboard with the verdict and justification', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Solid', status: 'In Progress', rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'Acme Industries';
    // Provide kpiCards host (the test harness usually has it; create defensively).
    if (!app.window.document.getElementById('kpiCards')) {
      const host = app.window.document.createElement('div');
      host.id = 'kpiCards';
      app.window.document.body.appendChild(host);
    }
    app.Dashboard.renderKpiCards();
    const html = app.window.document.getElementById('kpiCards').innerHTML;
    expect(html).toMatch(/On Track/);
    expect(html).toMatch(/all green/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/render/on-track-tile.test.mjs
```

Expected: FAIL — tile not yet rendered.

- [ ] **Step 3: Render the tile in `renderKpiCards`**

In `index.html` find `Dashboard.renderKpiCards` (`index.html:8954`). Locate the first tile rendered (the 'On Track %' tile). Replace that tile's HTML with the verdict-aware variant. Concretely, find the line that opens the on-track section (`// 1. % On Track`) and replace the block from `// 1. % On Track` through the line that closes the % tile with:

```javascript
    // 1. On-Track Verdict tile (replaces % on-track number with a synthesised verdict).
    const verdict = this.computeOnTrackVerdict(customer);
    const verdictColor = verdict.verdict === 'On Track' ? 'var(--status-green)'
      : verdict.verdict === 'Watch' ? 'var(--status-amber)'
      : 'var(--status-red)';
    const onTrackTile = '<div class="kpi-card" style="border-top:3px solid ' + verdictColor + '">' +
      '<div class="kpi-card-label">Verdict</div>' +
      '<div class="kpi-card-value" style="color:' + verdictColor + '">' + Dashboard.esc(verdict.verdict) + '</div>' +
      '<div class="kpi-card-sub" style="font-size:11px;color:var(--text-muted);margin-top:4px">' + Dashboard.esc(verdict.justification) + '</div>' +
    '</div>';
```

Then ensure `onTrackTile` is included in the final `el.innerHTML = ...` concatenation in place of the previous % on-track tile.

- [ ] **Step 4: Run the tests**

```bash
npm run test:unit -- tests/render/on-track-tile.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run the full unit + render suite (catch regressions)**

```bash
npm run test:unit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/render/on-track-tile.test.mjs index.html
git commit -m "feat(dashboard): On-Track Verdict tile replaces raw % on-track KPI"
```

---

## Phase E — When-by widget

A header-launched modal that answers "can you have it by date X?" for any candidate project, sized or not, in-flight or not.

---

## Task 12: `Forecast.forecastForCandidate` helper

**Files:**
- Modify: `index.html:20240-20440` (`Forecast` module — add helper).
- Test: `tests/unit/when-by.test.mjs` (create).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/when-by.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function withVelocityHistory() {
  resetIdSeq();
  const sprints = makeSprintSequence(6);
  // History: 2 prior sprints with completed work to satisfy MIN_HISTORY=2.
  const histProj = makeProject({
    name: 'History', size_engineering: 60,
    skill_splits: {
      size_engineering: [
        { sprint: sprints[0].sprint_id, points: 30, status: 'complete', completed: 30, assigned_to: [], reasons: [] },
        { sprint: sprints[1].sprint_id, points: 30, status: 'complete', completed: 30, assigned_to: [], reasons: [] }
      ]
    }
  });
  histProj.size_total = 60;
  const member = makeMember({ available_points_per_sprint: 30 });
  const app = await loadApp(makeDataset({
    projects: [histProj], sprints, team_members: [member]
  }));
  // Fake "now" so the harness sees those sprints as completed.
  return { app, sprints };
}

describe('Forecast.forecastForCandidate', () => {
  it('returns a P50 / P80 / P95 sprint count for an unsized hypothetical', async () => {
    const { app } = await withVelocityHistory();
    const result = app.Forecast.forecastForCandidate({
      customer: 'Acme Industries',
      sizeBySkill: { size_engineering: 30 },
      lifecycle_stage: 'Implementation'
    });
    expect(result.distribution).toBeTruthy();
    expect(result.distribution.p50).toBeGreaterThan(0);
    expect(result.distribution.p80).toBeGreaterThanOrEqual(result.distribution.p50);
    expect(result.distribution.p95).toBeGreaterThanOrEqual(result.distribution.p80);
    app.teardown();
  });

  it('classifies achievability against a target_date', async () => {
    const { app } = await withVelocityHistory();
    const farFuture = app.Forecast.forecastForCandidate({
      customer: 'Acme Industries',
      sizeBySkill: { size_engineering: 30 },
      lifecycle_stage: 'Implementation',
      target_date: '2026-12-31'
    });
    expect(['likely', 'stretch', 'no']).toContain(farFuture.verdict);
    app.teardown();
  });

  it('respects lifecycle_stage cone widener', async () => {
    const { app } = await withVelocityHistory();
    const impl = app.Forecast.forecastForCandidate({ customer: 'Acme Industries', sizeBySkill: { size_engineering: 30 }, lifecycle_stage: 'Implementation' });
    const poc = app.Forecast.forecastForCandidate({ customer: 'Acme Industries', sizeBySkill: { size_engineering: 30 }, lifecycle_stage: 'POC' });
    expect(poc.distribution.p95).toBeGreaterThanOrEqual(impl.distribution.p95);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/unit/when-by.test.mjs
```

Expected: FAIL — helper missing.

- [ ] **Step 3: Implement the helper**

In `index.html` add inside `Forecast` (immediately before the closing `}` of the `Forecast` object):

```javascript
  // Forecast a hypothetical or unsized project. Returns:
  //   { distribution: {p50,p80,p95,...}, verdict: 'likely'|'stretch'|'no', earliestSprintId, narrative }
  // No data is mutated; this is decision-support only.
  forecastForCandidate(candidate) {
    candidate = candidate || {};
    const customer = candidate.customer;
    const lifecycle_stage = candidate.lifecycle_stage || 'Implementation';
    const sizeBySkill = candidate.sizeBySkill || {};
    const target_date = candidate.target_date || null;
    const total = Object.values(sizeBySkill).reduce((s, v) => s + (v || 0), 0);
    const history = this.velocityHistory(customer);
    const stats = this.velocityStats(history);
    if (stats.count < this.MIN_HISTORY) {
      return { distribution: null, verdict: 'unknown', earliestSprintId: null, narrative: 'Not enough velocity history to forecast (need ≥ ' + this.MIN_HISTORY + ' completed sprints with commitment).', remaining: total };
    }
    const stageWideners = {
      'Idea': 1.6, 'Discovery': 1.4, 'POC': 1.6, 'Phase-1 Build': 1.25, 'Implementation': 1.0, 'Run/BAU': 1.0
    };
    const widener = stageWideners[lifecycle_stage] || 1.0;
    const widened = stats.values.map(v => v / widener);
    const distribution = this.simulateSprintsNeeded(total, widened, candidate.runs);
    const earliestSprintId = this.sprintsFromNow(customer, distribution.p80);
    let verdict = 'likely';
    let narrative = '';
    if (target_date && earliestSprintId) {
      const targetMs = new Date(target_date).getTime();
      const sprintObj = (App.data && App.data.sprints || []).find(s => s.sprint_id === earliestSprintId);
      const sprintEndMs = sprintObj && sprintObj.end_date ? new Date(sprintObj.end_date).getTime() : null;
      if (sprintEndMs == null) {
        verdict = 'unknown';
        narrative = 'Cannot resolve sprint end date for forecast.';
      } else if (sprintEndMs <= targetMs) {
        verdict = 'likely';
        narrative = 'Earliest credible delivery is ' + earliestSprintId + ' at P80 (' + distribution.p80 + ' sprints), which lands before the target date.';
      } else {
        // Check P95 — if still over, "no". If only P80 is over, "stretch".
        const p95SprintId = this.sprintsFromNow(customer, distribution.p95);
        const p95Sprint = (App.data && App.data.sprints || []).find(s => s.sprint_id === p95SprintId);
        const p95EndMs = p95Sprint && p95Sprint.end_date ? new Date(p95Sprint.end_date).getTime() : null;
        if (p95EndMs && p95EndMs <= targetMs) {
          verdict = 'stretch';
          narrative = 'P50 lands by ' + earliestSprintId + ' but P80 misses the target. Stretch.';
        } else {
          verdict = 'no';
          narrative = 'Even P95 (' + distribution.p95 + ' sprints) does not meet the target. Earliest credible: ' + earliestSprintId + '.';
        }
      }
    } else {
      narrative = 'Earliest credible delivery: ' + earliestSprintId + ' (P80, ' + distribution.p80 + ' sprints). P50: ' + distribution.p50 + ', P95: ' + distribution.p95 + '.';
    }
    return { distribution, verdict, earliestSprintId, narrative, remaining: total, lifecycle_stage };
  },

```

- [ ] **Step 4: Run the tests**

```bash
npm run test:unit -- tests/unit/when-by.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/when-by.test.mjs index.html
git commit -m "feat(forecast): forecastForCandidate answers 'when by' for hypothetical projects"
```

---

## Task 13: When-by modal UI

**Files:**
- Modify: `index.html` — header toolbar — add *When by?* button.
- Modify: `index.html` — add `Dashboard.openWhenByModal()` and supporting render/close functions.
- Test: `tests/render/when-by.test.mjs` (create).

- [ ] **Step 1: Write the failing test**

Create `tests/render/when-by.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

describe('When-by modal', () => {
  it('opens with input fields and renders an answer when computed', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(6);
    const histProj = makeProject({
      name: 'History', size_engineering: 60,
      skill_splits: {
        size_engineering: [
          { sprint: sprints[0].sprint_id, points: 30, status: 'complete', completed: 30, assigned_to: [], reasons: [] },
          { sprint: sprints[1].sprint_id, points: 30, status: 'complete', completed: 30, assigned_to: [], reasons: [] }
        ]
      }
    });
    histProj.size_total = 60;
    const app = await loadApp(makeDataset({ projects: [histProj], sprints, team_members: [makeMember({ available_points_per_sprint: 30 })] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Dashboard.openWhenByModal();
    const overlay = app.window.document.getElementById('whenByOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay.innerHTML).toMatch(/When by\?/);
    // Drive a forecast.
    const sizeInput = app.window.document.getElementById('wbSize');
    sizeInput.value = '30';
    app.Dashboard._runWhenBy();
    const out = app.window.document.getElementById('whenByOutput');
    expect(out.innerHTML).toMatch(/sprints/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/render/when-by.test.mjs
```

Expected: FAIL — `openWhenByModal` undefined.

- [ ] **Step 3: Implement modal open/close/run**

In `index.html` add inside `Dashboard`:

```javascript
  openWhenByModal() {
    const existing = document.getElementById('whenByOverlay');
    if (existing) existing.remove();
    const customers = App.getCustomers ? App.getCustomers() : ['Acme Industries'];
    const stages = App.LIFECYCLE_STAGES || ['Implementation'];
    const overlay = document.createElement('div');
    overlay.id = 'whenByOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);padding:16px';
    overlay.innerHTML =
      '<div style="background:var(--surface,white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:18px 22px;max-width:560px;width:100%;color:var(--text-dark)">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px">' +
          '<h3 style="margin:0;font-size:var(--fs-lg);font-weight:700">When by? — Forecast a candidate ask</h3>' +
          '<button onclick="Dashboard.closeWhenByModal()" style="background:transparent;border:none;font-size:22px;line-height:1;cursor:pointer;color:var(--text-muted)" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
          '<label style="font-size:11px;font-weight:600">Customer<br><select id="wbCustomer" style="width:100%;padding:5px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px;margin-top:2px">' +
            customers.map(c => '<option value="' + Dashboard.esc(c) + '"' + (c === App.activeCustomer ? ' selected' : '') + '>' + Dashboard.esc(c) + '</option>').join('') +
          '</select></label>' +
          '<label style="font-size:11px;font-weight:600">Conviction<br><select id="wbStage" style="width:100%;padding:5px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px;margin-top:2px">' +
            stages.map(s => '<option value="' + Dashboard.esc(s) + '"' + (s === App.LIFECYCLE_STAGE_DEFAULT ? ' selected' : '') + '>' + Dashboard.esc(s) + '</option>').join('') +
          '</select></label>' +
          '<label style="font-size:11px;font-weight:600">Total size (SP)<br><input type="number" id="wbSize" min="0" step="1" value="20" style="width:100%;padding:5px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px;margin-top:2px"></label>' +
          '<label style="font-size:11px;font-weight:600">Target date (optional)<br><input type="date" id="wbTarget" style="width:100%;padding:5px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px;margin-top:2px"></label>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:12px">' +
          '<button class="btn btn-primary btn-sm" onclick="Dashboard._runWhenBy()">Forecast</button>' +
          '<button class="btn btn-outline btn-sm" onclick="Dashboard._copyWhenByAnswer()">Copy answer</button>' +
        '</div>' +
        '<div id="whenByOutput" style="font-size:12px;background:var(--surface-2);padding:10px;border-radius:var(--radius-sm);min-height:60px;color:var(--text-dark)"></div>' +
      '</div>';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },

  closeWhenByModal() {
    const ov = document.getElementById('whenByOverlay');
    if (ov) ov.remove();
  },

  _runWhenBy() {
    const cust = document.getElementById('wbCustomer').value;
    const stage = document.getElementById('wbStage').value;
    const size = Number(document.getElementById('wbSize').value) || 0;
    const target = document.getElementById('wbTarget').value || null;
    const result = Forecast.forecastForCandidate({
      customer: cust,
      sizeBySkill: { size_engineering: size },
      lifecycle_stage: stage,
      target_date: target
    });
    const out = document.getElementById('whenByOutput');
    if (!out) return;
    if (!result.distribution) {
      out.innerHTML = '<strong>Insufficient history.</strong> ' + Dashboard.esc(result.narrative);
      this._lastWhenBy = null;
      return;
    }
    const verdictColor = result.verdict === 'likely' ? 'var(--status-green)'
      : result.verdict === 'stretch' ? 'var(--status-amber)'
      : result.verdict === 'no' ? 'var(--status-red)' : 'var(--text-muted)';
    out.innerHTML =
      '<div style="font-size:14px;font-weight:700;color:' + verdictColor + ';margin-bottom:6px">' + Dashboard.esc(result.verdict.toUpperCase()) + '</div>' +
      '<div>P50: ' + result.distribution.p50 + ' sprints · P80: ' + result.distribution.p80 + ' · P95: ' + result.distribution.p95 + '</div>' +
      '<div style="margin-top:6px">Earliest credible delivery: <strong>' + Dashboard.esc(result.earliestSprintId || '—') + '</strong></div>' +
      '<div style="margin-top:8px;color:var(--text-dark-secondary)">' + Dashboard.esc(result.narrative) + '</div>';
    this._lastWhenBy = result;
  },

  _copyWhenByAnswer() {
    const r = this._lastWhenBy;
    if (!r) { App.toast('Run a forecast first', 'error'); return; }
    const text = 'When-by forecast: ' + r.verdict.toUpperCase() + '. P50 ' + r.distribution.p50 + ' sprints, P80 ' + r.distribution.p80 + ', P95 ' + r.distribution.p95 + '. Earliest credible: ' + (r.earliestSprintId || '—') + '. ' + r.narrative;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => App.toast('When-by answer copied', 'success'));
    } else {
      App.toast('Clipboard unavailable', 'error');
    }
  },

```

- [ ] **Step 4: Add the header button**

Find the header toolbar markup in `index.html` (search for `Boardroom mode` or other header buttons). Add a button:

```html
        <button class="btn btn-icon" onclick="Dashboard.openWhenByModal()" title="When by? Forecast any candidate ask" aria-label="When by? forecast">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </button>
```

- [ ] **Step 5: Run the tests**

```bash
npm run test:unit -- tests/render/when-by.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/render/when-by.test.mjs index.html
git commit -m "feat(dashboard): When-by modal answers any candidate ask with P50/P80/P95"
```

---

## Task 14: End-to-end smoke (Playwright) — verdict + when-by

**Files:**
- Create: `tests/e2e/p1-flows.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/p1-flows.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test.describe('P1 — On-Track Verdict tile', () => {
  test('renders a verdict word in the dashboard', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => window.App.navigate('dashboard'));
    const tile = page.locator('#kpiCards');
    await expect(tile).toContainText(/On Track|Watch|Off Track/);
  });
});

test.describe('P1 — When-by modal', () => {
  test('opens, computes a forecast, copy button is present', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => window.Dashboard.openWhenByModal());
    await page.locator('#wbSize').fill('30');
    await page.locator('button:has-text("Forecast")').click();
    const out = page.locator('#whenByOutput');
    await expect(out).toContainText(/sprints/);
    await expect(page.locator('button:has-text("Copy answer")')).toBeVisible();
  });
});

test.describe('P1 — Lifecycle chip on grid', () => {
  test('every project row shows a lifecycle chip', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => window.App.navigate('dashboard'));
    const chip = page.locator('.lifecycle-chip').first();
    await expect(chip).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the spec**

```bash
npm run test:e2e -- p1-flows.spec.ts
```

Expected: PASS — three tests green.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/p1-flows.spec.ts
git commit -m "test(e2e): verdict tile + When-by + lifecycle chip smoke"
```

---

## Task 15: Final verification

- [ ] **Step 1: Run the full suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Manual smoke**

Open `index.html` in a browser. Confirm each phase's user-visible signal:
1. **Phase A**: Open Quick-Add wizard — Conviction select is present. Detail panel shows the field. Grid rows show a coloured chip; Gantt bars show the chip when wide enough. Setting two projects to identical WSJF inputs but different conviction makes the POC sort below the Implementation in Auto-Prioritise.
2. **Phase B**: Detail panel shows a *Worst case* input next to each skill size. Setting `size_engineering_max` higher than `size_engineering` renders a dashed cone to the right of the bar on the Gantt.
3. **Phase C**: Editing `delivery_config.phase_order` to include `{phase: 'Data Engineering', status: 'tbd'}` (via JSON edit on Configuration view, or by hand in localStorage for the smoke) causes Auto-Allocate to skip the DE phase AND a dashed `TBD` panel to appear after the live bar on the Gantt.
4. **Phase D**: Dashboard's first KPI tile says *On Track* / *Watch* / *Off Track* with a one-line justification.
5. **Phase E**: Header *When by?* button opens the modal; entering a size and pressing *Forecast* produces a verdict and P50/P80/P95 line; *Copy answer* copies a one-line summary.

- [ ] **Step 3: Push only if explicitly asked**

Stop after local commits unless the user requests a push.

---

## Self-review checklist

- [ ] `App.LIFECYCLE_STAGES` enumerates the six conviction classes; `migrateSchema` defaults missing fields to `Implementation`.
- [ ] Quick-Add wizard captures `lifecycle_stage`; Detail Panel renders an editable select.
- [ ] Lifecycle chip appears on Projects grid rows and on Gantt bars (when bar width permits).
- [ ] `App.calculateProjectPriorityScore` subtracts a conviction penalty: POC=10, Discovery=15, Idea=25, others=0.
- [ ] `migrateSchema` seeds per-skill `*_max` fields equal to point estimate; clamp on save prevents `*_max < estimate`.
- [ ] Gantt renders a dashed cone overlay when total `*_max` > total point estimate.
- [ ] `Forecast.projectForecast` widens P95 by stage (Idea/POC ×1.6, Discovery ×1.4, Phase-1 ×1.25, others ×1.0).
- [ ] `Solver._normalisePhaseOrder` accepts strings or `{phase, status}` objects; `tbd` entries excluded from scheduling.
- [ ] Gantt renders a dashed open-ended *TBD* panel next to projects with at least one tbd phase.
- [ ] `Dashboard.computeOnTrackVerdict` returns `{verdict, justification, inputs}`; rules: ≥2 red signals = Off Track, 1 = Watch, 0 reds with any Amber = Watch, otherwise On Track.
- [ ] Dashboard KPI cards include the verdict tile with verdict-coloured top border.
- [ ] `Forecast.forecastForCandidate({customer, sizeBySkill, lifecycle_stage, target_date})` returns `{distribution, verdict, earliestSprintId, narrative}` and respects MIN_HISTORY.
- [ ] When-by modal opens from header button; *Forecast* populates output; *Copy answer* writes a one-line summary to clipboard.
- [ ] `npm test` is green.
