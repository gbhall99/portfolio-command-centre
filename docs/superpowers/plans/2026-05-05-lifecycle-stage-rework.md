# Lifecycle Stage Rework — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to execute task-by-task.

**Goal:** Drop the WSJF "conviction penalty" so a Discovery/POC isn't punished for being early-stage; collapse `'Phase-1 Build'` → `'Implementation'`; replace the "Convert to Implementation" CTA with a generic "Advance stage" dropdown + an optional baseline-reset prompt; rename "conviction class" copy to "Lifecycle stage" everywhere.

**Architecture:** All changes live in `index.html`. New `App.advanceStage(id, nextStage)` is the canonical transition entry. `App.lifecycleConvictionPenalty` is deleted and its callers (in `App.calculateScore` and `App.calculateWsjf`) lose the term. Migration in `migrateSchema` coerces the dropped stage. Detail-panel banner + button refactor stays close to existing markup. (Conventions per CLAUDE.md: string-concat HTML, escape via Dashboard.esc, no emojis.)

**Tech Stack:** Plain JS, vitest + jsdom unit, Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-05-05-lifecycle-stage-rework-design.md`

**Reference points:**
- `App.LIFECYCLE_STAGES`: `index.html:2965`
- `App.lifecycleConvictionPenalty`: `index.html:7395`
- `App.lifecycleStageChip`: `index.html:7380`
- `App.convertToImplementation`: `index.html:5316`
- Detail panel conversion banner: `index.html:12585`
- `migrateSchema`: search for `migrateSchema` near line 3300
- Score callers: `index.html:7428`, `index.html:7442`

## Task 1: Constants + migration + delete penalty

**Files:**
- Modify: `index.html` — `App.LIFECYCLE_STAGES`, `migrateSchema`, delete `App.lifecycleConvictionPenalty`, remove its callers.
- Create: `tests/unit/lifecycle-rework.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/lifecycle-rework.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Lifecycle constants + migration', () => {
  it('LIFECYCLE_STAGES no longer contains Phase-1 Build', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    expect(app.App.LIFECYCLE_STAGES).toEqual(['Idea', 'Discovery', 'POC', 'Implementation', 'Run/BAU']);
    app.teardown();
  });

  it('legacy Phase-1 Build value is migrated to Implementation', async () => {
    const p = makeProject({ id: 'LEGACY', lifecycle_stage: 'Phase-1 Build' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const got = app.App.data.projects.find(x => x.id === 'LEGACY');
    expect(got.lifecycle_stage).toBe('Implementation');
    app.teardown();
  });

  it('unknown stage values fall back to default', async () => {
    const p = makeProject({ id: 'BOGUS', lifecycle_stage: 'WhateverThisIs' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const got = app.App.data.projects.find(x => x.id === 'BOGUS');
    expect(got.lifecycle_stage).toBe('Implementation');
    app.teardown();
  });
});

describe('Lifecycle WSJF penalty removed', () => {
  it('lifecycleConvictionPenalty function no longer exists', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    expect(app.App.lifecycleConvictionPenalty).toBeUndefined();
    app.teardown();
  });

  it('two projects with identical inputs but different stages get equal WSJF score', async () => {
    const a = makeProject({
      id: 'A', lifecycle_stage: 'Implementation',
      business_value: 8, time_criticality: 5, risk_reduction_opportunity: 3, size_total: 10
    });
    const b = makeProject({
      id: 'B', lifecycle_stage: 'POC',
      business_value: 8, time_criticality: 5, risk_reduction_opportunity: 3, size_total: 10
    });
    const app = await loadApp(makeDataset({ projects: [a, b] }));
    const sa = app.App.calculateWsjf ? app.App.calculateWsjf(a) : null;
    const sb = app.App.calculateWsjf ? app.App.calculateWsjf(b) : null;
    if (sa && sb && typeof sa === 'object') {
      expect(sa.wsjf).toBe(sb.wsjf);
    } else {
      expect(sa).toBe(sb);
    }
    app.teardown();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npx vitest run tests/unit/lifecycle-rework.test.mjs
```
Expected: FAIL on at least the constants test (still has 'Phase-1 Build').

- [ ] **Step 3: Update LIFECYCLE_STAGES**

Find `App.LIFECYCLE_STAGES` (around `index.html:2965`). Replace:

```javascript
  LIFECYCLE_STAGES: ['Idea', 'Discovery', 'POC', 'Phase-1 Build', 'Implementation', 'Run/BAU'],
```

with:

```javascript
  LIFECYCLE_STAGES: ['Idea', 'Discovery', 'POC', 'Implementation', 'Run/BAU'],
```

The `LIFECYCLE_STAGE_DEFAULT` line stays at `'Implementation'`.

- [ ] **Step 4: Add migration step**

Find `migrateSchema` (search for `migrateSchema(data)` or `migrateSchema:` — the function lives near `index.html:3300`). Inside the function body, near the existing block that defaults `lifecycle_stage`:

```javascript
    // Always-run: default missing lifecycle_stage to Implementation so legacy projects
    (data.projects || []).forEach(p => {
      if (!p.lifecycle_stage || App.LIFECYCLE_STAGES.indexOf(p.lifecycle_stage) < 0) {
        p.lifecycle_stage = App.LIFECYCLE_STAGE_DEFAULT;
      }
    });
```

Just BEFORE that loop, add a coercion for the dropped stage:

```javascript
    // Lifecycle rework (2026-05): collapse 'Phase-1 Build' into 'Implementation'.
    (data.projects || []).forEach(p => {
      if (p.lifecycle_stage === 'Phase-1 Build') p.lifecycle_stage = 'Implementation';
    });
```

The existing default loop will then ensure any other invalid value falls back to default.

- [ ] **Step 5: Delete `App.lifecycleConvictionPenalty` and its callers**

Find `lifecycleConvictionPenalty(project)` (around `index.html:7395`). Delete the entire method (5–10 lines including the comment above it).

Then search for `lifecycleConvictionPenalty(` to find each call site. There are typically two — both inside scoring functions (`calculateScore`, `calculateWsjf`). For each call, remove the term. Example before:

```javascript
return Math.round(wsjfScore + deadlineScore + depScore - this.lifecycleConvictionPenalty(project));
```

Becomes:

```javascript
return Math.round(wsjfScore + deadlineScore + depScore);
```

Same shape for the legacy hybrid scoring path.

- [ ] **Step 6: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: all tests pass — the new lifecycle tests AND all existing tests stay green. If an existing scoring test breaks because it expected the penalty, update the test fixture/expectation to reflect the post-rework score (penalty removed).

- [ ] **Step 7: Commit**

```bash
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/unit/lifecycle-rework.test.mjs
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(lifecycle): drop Phase-1 Build stage and WSJF conviction penalty"
```

---

## Task 2: Generic `App.advanceStage`; keep `convertToImplementation` as shim

**Files:**
- Modify: `index.html` — replace `App.convertToImplementation`, add `App.advanceStage`.
- Modify: `tests/unit/lifecycle-rework.test.mjs`

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/lifecycle-rework.test.mjs`:

```javascript
describe('App.advanceStage', () => {
  it('exists as a function', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    expect(typeof app.App.advanceStage).toBe('function');
    app.teardown();
  });

  it('writes via updateProject and audits the transition', async () => {
    const p = makeProject({ id: 'X', lifecycle_stage: 'Discovery' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const ok = app.App.advanceStage('X', 'POC');
    expect(ok).toBe(true);
    const got = app.App.data.projects.find(x => x.id === 'X');
    expect(got.lifecycle_stage).toBe('POC');
    app.teardown();
  });

  it('returns false for invalid stage', async () => {
    const p = makeProject({ id: 'Y', lifecycle_stage: 'Discovery' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const ok = app.App.advanceStage('Y', 'Bogus');
    expect(ok).toBe(false);
    expect(app.App.data.projects[0].lifecycle_stage).toBe('Discovery');
    app.teardown();
  });

  it('returns false when stage unchanged (no-op)', async () => {
    const p = makeProject({ id: 'Z', lifecycle_stage: 'POC' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const ok = app.App.advanceStage('Z', 'POC');
    expect(ok).toBe(false);
    app.teardown();
  });

  it('does NOT auto-snapshot baseline (decoupled from stage)', async () => {
    const p = makeProject({
      id: 'NB', lifecycle_stage: 'POC',
      start_date: '2026-04-01', target_date: '2026-06-30',
      baseline_start: null, baseline_end: null
    });
    const app = await loadApp(makeDataset({ projects: [p] }));
    app.App.advanceStage('NB', 'Implementation');
    const got = app.App.data.projects.find(x => x.id === 'NB');
    expect(got.lifecycle_stage).toBe('Implementation');
    expect(got.baseline_start).toBeNull();
    expect(got.baseline_end).toBeNull();
    app.teardown();
  });
});

describe('App.convertToImplementation backwards-compat shim', () => {
  it('still exists and flips stage to Implementation', async () => {
    const p = makeProject({ id: 'C', lifecycle_stage: 'POC' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    expect(typeof app.App.convertToImplementation).toBe('function');
    const ok = app.App.convertToImplementation('C');
    expect(ok).toBe(true);
    expect(app.App.data.projects[0].lifecycle_stage).toBe('Implementation');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npx vitest run tests/unit/lifecycle-rework.test.mjs
```
Expected: `advanceStage is not a function`.

- [ ] **Step 3: Replace `convertToImplementation` with `advanceStage` + shim**

Find `convertToImplementation(projectId, opts)` (around `index.html:5316`). Replace the entire method with:

```javascript
  advanceStage(projectId, nextStage, opts) {
    opts = opts || {};
    if (this.LIFECYCLE_STAGES.indexOf(nextStage) < 0) return false;
    const p = (this.data && this.data.projects || []).find(pr => pr.id === projectId);
    if (!p) return false;
    const before = p.lifecycle_stage || this.LIFECYCLE_STAGE_DEFAULT;
    if (before === nextStage) return false;
    this.pushUndo('Advance stage on ' + (p.name || projectId) + ' (' + before + ' -> ' + nextStage + ')');
    this.logChange(projectId, 'lifecycle_stage', before, nextStage, 'user', { rationale: opts.rationale || '' });
    p.lifecycle_stage = nextStage;
    p.last_updated = new Date().toISOString();
    this.markDirty();
    this.saveToLocalStorage();
    if (this.notifyDataChange) this.notifyDataChange();
    return true;
  },

  // Backwards-compat shim for older callers / external integrations. Kept thin so removal later is trivial.
  convertToImplementation(projectId, opts) {
    return this.advanceStage(projectId, 'Implementation', opts);
  },
```

- [ ] **Step 4: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS — new advanceStage tests AND all existing tests.

If existing tests broke because they relied on `convertToImplementation` auto-snapshotting baseline: that auto-snapshot is intentionally removed by this rework. The detail-panel flow (Task 4) handles baseline as a separate prompt. Update affected tests to either (a) call `App.setBaseline(id)` explicitly before asserting baseline values, or (b) drop the baseline assertion and assert only stage transition. Note any updated tests in your report.

- [ ] **Step 5: Commit**

```bash
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/unit/lifecycle-rework.test.mjs
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(lifecycle): advanceStage replaces convertToImplementation; baseline decoupled"
```

---

## Task 3: Run/BAU exclusion from active scoring views

**Files:**
- Modify: `index.html` — find score callers / sort views and exclude `Run/BAU`.
- Modify: `tests/unit/lifecycle-rework.test.mjs`

- [ ] **Step 1: Map current Run/BAU handling**

Search:
```
grep -n "Run/BAU\|lifecycle_stage === 'Run" index.html
```

Identify all places where Run/BAU is filtered or scored. Currently `App.calculateScore` returns -1000 for Run/BAU which is a heavy-handed way to push them to the bottom. We replace that with explicit filtering.

- [ ] **Step 2: Write a guarding test**

Append to `tests/unit/lifecycle-rework.test.mjs`:

```javascript
describe('Run/BAU treatment', () => {
  it('Run/BAU project keeps natural WSJF (no -1000 hack)', async () => {
    const p = makeProject({
      id: 'BAU', lifecycle_stage: 'Run/BAU',
      business_value: 8, time_criticality: 5, risk_reduction_opportunity: 3, size_total: 10
    });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const score = app.App.calculateScore ? app.App.calculateScore(p) : null;
    if (typeof score === 'number') {
      expect(score).toBeGreaterThan(-100);
    }
    app.teardown();
  });
});
```

- [ ] **Step 3: Remove the -1000 special case**

Find:
```javascript
if (p.lifecycle_stage === 'Run/BAU') score -= 1000;
```
and any equivalents (legacy hybrid path may have its own). Remove these lines entirely. Run/BAU projects now score by their actual inputs; Run/BAU is excluded from active sort views by the existing filter pipeline (status filters, customer scoping, etc.) — the user typically views them separately.

- [ ] **Step 4: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/unit/lifecycle-rework.test.mjs
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(lifecycle): drop -1000 Run/BAU score hack; treat as a normal stage"
```

---

## Task 4: Detail-panel banner + Advance-stage dropdown

**Files:**
- Modify: `index.html` — the `conversionBanner` block and the "Convert to Implementation" button (around line 12585).
- Modify: `tests/render/detailpanel.test.mjs` (regenerate snapshot if affected)

- [ ] **Step 1: Locate and replace the conversion banner**

Find:
```javascript
const conversionBanner = (p.lifecycle_stage === 'POC' || p.lifecycle_stage === 'Discovery' || p.lifecycle_stage === 'Idea')
```

The block builds a fixed banner with a "Convert to Implementation" button. Replace with a stage-aware banner + an Advance-stage dropdown:

```javascript
const stageBannerCopy = {
  'Idea':           'Captured as an Idea — promote to Discovery to start exploring.',
  'Discovery':      'Currently in Discovery — set or update the baseline when scope is firm enough to track.',
  'POC':            'Currently a POC — set or update the baseline when scope is firm enough to track.',
  'Run/BAU':        'Running — excluded from active scoring views.'
};
const stageMsg = stageBannerCopy[p.lifecycle_stage] || '';
const stageOpts = App.LIFECYCLE_STAGES
  .filter(s => s !== p.lifecycle_stage)
  .map(s => '<option value="' + esc(s) + '">' + esc(s) + '</option>')
  .join('');
const conversionBanner = stageMsg
  ? '<div class="evm-banner evm-banner-info" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<span>' + esc(stageMsg) + '</span>' +
      '<select id="advanceStageSelect-' + esc(p.id) + '" style="font-size:11px;padding:3px 6px;border:1px solid var(--border-light);border-radius:var(--radius-sm)"><option value="">Advance to…</option>' + stageOpts + '</select>' +
      '<button class="btn btn-primary btn-sm" onclick="DetailPanel.confirmAdvanceStage(\'' + esc(p.id) + '\')" style="font-size:10px;padding:3px 8px">Advance stage</button>' +
    '</div>'
  : '';
```

- [ ] **Step 2: Add `DetailPanel.confirmAdvanceStage`**

Find `DetailPanel.openConvertModal` (search for `openConvertModal:` or `openConvertModal(`). Near it, add:

```javascript
  confirmAdvanceStage(projectId) {
    const sel = document.getElementById('advanceStageSelect-' + projectId);
    if (!sel || !sel.value) { App.toast('Choose a stage', 'warn'); return; }
    const nextStage = sel.value;
    const p = (App.data && App.data.projects || []).find(x => x.id === projectId);
    if (!p) return;
    const priorStage = p.lifecycle_stage;
    const ok = App.advanceStage(projectId, nextStage);
    if (!ok) { App.toast('Could not advance stage', 'error'); return; }
    if (nextStage === 'Implementation') {
      const hasFreshBaseline = !!(p.baseline_start && p.baseline_end && p.baseline_set_date && p.baseline_set_date >= (p.last_updated || ''));
      if (!hasFreshBaseline) {
        const choice = window.confirm('Re-set baseline to current dates?\n\nOK = set baseline now\nCancel = revert stage change');
        if (choice && typeof DetailPanel.setBaseline === 'function') {
          DetailPanel.setBaseline(projectId);
        } else if (!choice) {
          App.advanceStage(projectId, priorStage);
          App.toast('Stage advance cancelled', 'info');
        }
      }
    }
    if (typeof DetailPanel.refresh === 'function') DetailPanel.refresh(projectId);
  },
```

If `DetailPanel.setBaseline(projectId)` doesn't exist verbatim, find the existing baseline-snapshot helper (search for `baseline_set_date = new Date()`) and use that name.

- [ ] **Step 3: Remove the old `Convert to Implementation` button**

The old block emitted `<button … onclick="DetailPanel.openConvertModal('id')">Convert to Implementation</button>`. The new conversionBanner replaces it. Search for `openConvertModal` callers — leave the modal itself intact for now (still callable directly), but the inline button comes out.

- [ ] **Step 4: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS. Render snapshots in `tests/render/detailpanel.test.mjs` may change — if so, inspect the diff (should be the new banner shape), regenerate with `npx vitest run tests/render/detailpanel.test.mjs --update`.

- [ ] **Step 5: Commit**

```bash
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/render/__snapshots__/
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(lifecycle): Advance-stage dropdown replaces Convert button; stage-aware banner"
```

---

## Task 5: Rename "conviction" copy + update chip helper

**Files:**
- Modify: `index.html` — rename helper from `lifecycleStageChip` to `lifecycleStageBadge` (the chip is shown in DetailPanel header now, not next to project name); update `title` attribute and any "Project conviction class" copy.

- [ ] **Step 1: Sweep for "conviction"**

```
grep -n "conviction" /Users/zaza/Documents/Projects/portfolio-command-centre/index.html
```

For each match, replace "conviction" with "lifecycle stage" in user-facing copy. Code-only references (e.g. function names that no longer exist) need no change at this point because Task 1 already deleted them.

- [ ] **Step 2: Update the chip helper title**

Find `lifecycleStageChip(project)` in `App` (around `index.html:7380`). Change the `title=` attribute from `"Project conviction class"` to `"Lifecycle stage"`. Leave the function name as-is for now (renaming is invasive; defer to a future cleanup unless trivial).

- [ ] **Step 3: Update the score-explainer modal**

Search for any "Conviction" string in the score-explainer. Common locations: `App.openWhyRank` body, `App.scoreExplainer`, anywhere a row labelled "Conviction adjustment" or "Conviction class" renders. Remove those rows entirely (the underlying penalty is gone).

- [ ] **Step 4: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/render/__snapshots__/
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(lifecycle): rename conviction copy to lifecycle stage; remove score-explainer penalty row"
```

---

## Task 6: E2E coverage

**Files:**
- Create: `tests/e2e/lifecycle-rework.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/lifecycle-rework.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Advance-stage from POC to Implementation requests baseline reset', async ({ page }) => {
  await openAppWithData(page);
  // Find or create a POC project
  const targetId = await page.evaluate(() => {
    const App = (window as any).App;
    const p = App.data.projects.find((x: any) => x.lifecycle_stage === 'POC') || App.data.projects[0];
    p.lifecycle_stage = 'POC';
    return p.id;
  });
  // Open the detail panel for that project
  await page.evaluate((id) => (window as any).DetailPanel.open(id), targetId);
  await expect(page.locator('#detailPanel.open')).toBeVisible();
  // Stub window.confirm to accept the baseline reset
  page.on('dialog', dialog => dialog.accept());
  // Pick Implementation in the advance dropdown and click the button
  const sel = page.locator('select[id^="advanceStageSelect-"]').first();
  await sel.selectOption('Implementation');
  await page.locator('button:has-text("Advance stage")').first().click();
  // Assert the stage flipped
  const after = await page.evaluate((id) => {
    return (window as any).App.data.projects.find((p: any) => p.id === id).lifecycle_stage;
  }, targetId);
  expect(after).toBe('Implementation');
});

test('"conviction" copy does not appear in detail panel', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => {
    const App = (window as any).App;
    (window as any).DetailPanel.open(App.data.projects[0].id);
  });
  await expect(page.locator('#detailPanel.open')).toBeVisible();
  const text = await page.locator('#detailPanel').innerText();
  expect(text.toLowerCase()).not.toContain('conviction');
});
```

- [ ] **Step 2: Run E2E**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:e2e
```
Expected: PASS — the 2 new tests green. (Pre-existing gantt-interactions flake is allowed.)

- [ ] **Step 3: Commit**

```bash
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add tests/e2e/lifecycle-rework.spec.ts
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "test(lifecycle): E2E for advance-stage flow + no-conviction-copy"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full suite**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm test
```
Expected: PASS (or only the pre-existing gantt-interactions flake).

- [ ] **Step 2: Sanity-check copy with grep**

```
grep -n "conviction" /Users/zaza/Documents/Projects/portfolio-command-centre/index.html
```
Expected: zero matches in user-facing strings. (Code identifiers may remain temporarily; not a blocker.)

If any user-visible "conviction" survives, scrub it.
