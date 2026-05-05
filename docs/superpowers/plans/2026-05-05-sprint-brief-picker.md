# Sprint Brief Picker — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to execute task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the inline IIFE on the Sprint Planning toolbar's `Sprint Brief` button with a small picker modal so the user chooses which sprint to generate the per-member brief for. Default selection is the sprint containing today's date.

**Architecture:** Add `Report.openSprintBriefPicker()` that builds a fixed-position modal listing the active customer's sprints (chronological, with assignment counts), with a default selection chosen by date. On Generate, the existing `Report.exportSprintBrief(customer, sprintId)` is called.

**Tech Stack:** Plain JS in `index.html` (project conventions per CLAUDE.md: string-concat HTML, escape via Dashboard.esc, no emojis). Tests: vitest + jsdom (unit), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-05-05-sprint-brief-picker-design.md`

**Reference points:**
- Toolbar button: `index.html:2612` (the inline IIFE we replace)
- `Report.exportSprintBrief`: `index.html:26580`
- `Report.buildSprintBriefDoc`: `index.html:26539`
- Test harness: `tests/harness/loadApp.mjs`, `tests/harness/fixtures.mjs`
- E2E helpers: `tests/e2e/helpers.ts`

## Task 1: Replace toolbar IIFE with `Report.openSprintBriefPicker()`

**Files:**
- Modify: `index.html:2612` — replace the inline IIFE on the Sprint Brief button.
- Modify: `index.html` — add `Report.openSprintBriefPicker()` near `Report.exportSprintBrief` (around line 26580).
- Test: `tests/unit/sprint-brief-picker.test.mjs` (new)

- [ ] **Step 1: Write failing test for `openSprintBriefPicker` existence**

Create `tests/unit/sprint-brief-picker.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence } from '../harness/fixtures.mjs';

describe('Report.openSprintBriefPicker', () => {
  it('exists as a function', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()], sprints: makeSprintSequence(3) }));
    expect(typeof app.window.Report.openSprintBriefPicker).toBe('function');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npx vitest run tests/unit/sprint-brief-picker.test.mjs
```
Expected: FAIL — `Report.openSprintBriefPicker is not a function`.

- [ ] **Step 3: Add `Report.openSprintBriefPicker` and helpers**

Find `exportSprintBrief(customer, sprintId) {` in `index.html` (around line 26580). Immediately above it, add the new properties. Each render path uses string-concat HTML escaped via `Dashboard.esc`, matching project convention.

```javascript
  openSprintBriefPicker() {
    if (!App.data || !App.activeCustomer) {
      App.toast('Select a customer first', 'error');
      return;
    }
    const all = (App.data.sprints || []).filter(s => !s.customer || s.customer === App.activeCustomer);
    const sprints = all.slice().sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
    if (!sprints.length) {
      Report._renderSprintBriefPicker({ empty: true, customer: App.activeCustomer });
      return;
    }
    const todayIso = new Date().toISOString().slice(0, 10);
    let chosenId = null;
    for (const s of sprints) {
      if (s.start_date && s.end_date && s.start_date <= todayIso && todayIso <= s.end_date) { chosenId = s.sprint_id; break; }
    }
    if (!chosenId) {
      const future = sprints.find(s => s.start_date && s.start_date > todayIso);
      if (future) chosenId = future.sprint_id;
    }
    if (!chosenId) {
      const past = sprints.slice().reverse().find(s => s.end_date && s.end_date < todayIso);
      if (past) chosenId = past.sprint_id;
    }
    if (!chosenId) chosenId = sprints[0].sprint_id;
    Report._renderSprintBriefPicker({ sprints, chosenId, customer: App.activeCustomer });
  },

  _renderSprintBriefPicker(opts) {
    const esc = Dashboard.esc;
    const customer = opts.customer || '';
    const existing = document.getElementById('sprintBriefPickerOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sprintBriefPickerOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9000;display:flex;align-items:center;justify-content:center';
    overlay.onclick = (e) => { if (e.target === overlay) Report._closeSprintBriefPicker(); };

    let bodyHtml;
    if (opts.empty) {
      bodyHtml = '<div style="font-size:13px;color:var(--text-dark-secondary);margin-bottom:12px">No sprints configured for ' + esc(customer) + '. Add one in <strong>Sprints</strong> to generate a brief.</div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-primary btn-sm" onclick="Report._closeSprintBriefPicker()">Close</button></div>';
    } else {
      const sprints = opts.sprints || [];
      const chosenId = opts.chosenId;
      const fmtRange = (s) => {
        const fmt = (iso) => {
          if (!iso) return '—';
          try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
          catch (_) { return iso; }
        };
        return fmt(s.start_date) + ' – ' + fmt(s.end_date);
      };
      const countAssignments = (sprintId) => {
        let n = 0;
        (App.data.projects || []).forEach(p => {
          if (p.customer !== customer) return;
          Object.values(p.skill_splits || {}).forEach(arr => {
            if (!Array.isArray(arr)) return;
            arr.forEach(sp => { if (sp.sprint === sprintId) n++; });
          });
        });
        return n;
      };
      const rows = sprints.map(s => {
        const checked = s.sprint_id === chosenId ? ' checked' : '';
        const count = countAssignments(s.sprint_id);
        return '<label class="sb-picker-row" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--border-light);border-radius:var(--radius-sm);margin-bottom:6px;cursor:pointer;font-size:12px">' +
          '<input type="radio" name="sb-picker-sprint" value="' + esc(s.sprint_id) + '"' + checked + '>' +
          '<span style="font-weight:700;font-family:var(--font-mono);min-width:90px">' + esc(s.sprint_id) + '</span>' +
          '<span style="color:var(--text-dark-secondary);min-width:130px">' + esc(fmtRange(s)) + '</span>' +
          '<span style="color:var(--text-muted);font-size:11px">' + count + ' assignment' + (count === 1 ? '' : 's') + '</span>' +
        '</label>';
      }).join('');
      bodyHtml =
        '<div style="font-size:12px;color:var(--text-dark-secondary);margin-bottom:10px">Choose a sprint to generate a per-member brief.</div>' +
        '<div style="max-height:50vh;overflow-y:auto;margin-bottom:12px">' + rows + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end">' +
          '<button class="btn btn-ghost btn-sm" onclick="Report._closeSprintBriefPicker()">Cancel</button>' +
          '<button class="btn btn-primary btn-sm" onclick="Report._generateSprintBriefFromPicker()">Generate Brief</button>' +
        '</div>';
    }

    overlay.innerHTML = '<div style="background:var(--surface);border-radius:12px;padding:20px;max-width:480px;width:90%;box-shadow:var(--shadow-lg)" role="dialog" aria-label="Choose sprint for brief">' +
      '<h3 style="font-size:14px;font-weight:700;color:var(--text-dark);margin-bottom:12px">Sprint Brief — ' + esc(customer) + '</h3>' +
      bodyHtml +
    '</div>';

    document.body.appendChild(overlay);
    document.addEventListener('keydown', Report._sprintBriefPickerEsc);
  },

  _sprintBriefPickerEsc(e) {
    if (e.key === 'Escape') Report._closeSprintBriefPicker();
  },

  _closeSprintBriefPicker() {
    const el = document.getElementById('sprintBriefPickerOverlay');
    if (el) el.remove();
    document.removeEventListener('keydown', Report._sprintBriefPickerEsc);
  },

  _generateSprintBriefFromPicker() {
    const sel = document.querySelector('#sprintBriefPickerOverlay input[name="sb-picker-sprint"]:checked');
    if (!sel) { App.toast('Pick a sprint', 'warn'); return; }
    const sprintId = sel.value;
    Report._closeSprintBriefPicker();
    Report.exportSprintBrief(App.activeCustomer, sprintId);
  },
```

(Watch the trailing comma — these are properties of the existing `Report` object literal.)

- [ ] **Step 4: Run test to verify existence passes**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npx vitest run tests/unit/sprint-brief-picker.test.mjs
```
Expected: PASS.

- [ ] **Step 5: Replace the toolbar button's IIFE**

At `index.html:2612`, replace the entire button line with:

```html
          <button class="btn btn-outline btn-sm" onclick="Report.openSprintBriefPicker()" title="Per-member sprint brief — printable PDF"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg> Sprint Brief</button>
```

- [ ] **Step 6: Run full unit suite**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/unit/sprint-brief-picker.test.mjs
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(sprint-brief): picker modal with date-aware default sprint"
```

---

## Task 2: Default-selection unit tests

**Files:**
- Modify: `tests/unit/sprint-brief-picker.test.mjs`

- [ ] **Step 1: Add tests covering each default-selection branch**

Append to `tests/unit/sprint-brief-picker.test.mjs`:

```javascript
import { makeMember } from '../harness/fixtures.mjs';

describe('Sprint picker default selection', () => {
  function fixedDate(iso) {
    const realDate = Date;
    const fixed = new Date(iso + 'T12:00:00Z');
    global.Date = class extends realDate {
      constructor(...args) { return args.length ? new realDate(...args) : new realDate(fixed); }
      static now() { return fixed.getTime(); }
    };
    return () => { global.Date = realDate; };
  }

  it('picks the sprint containing today', async () => {
    const sprints = [
      { sprint_id: 'CY26-S1', customer: 'Acme Industries', start_date: '2026-04-01', end_date: '2026-04-28' },
      { sprint_id: 'CY26-S2', customer: 'Acme Industries', start_date: '2026-04-29', end_date: '2026-05-26' },
      { sprint_id: 'CY26-S3', customer: 'Acme Industries', start_date: '2026-05-27', end_date: '2026-06-23' }
    ];
    const restore = fixedDate('2026-05-05');
    try {
      const app = await loadApp(makeDataset({ projects: [makeProject({ customer: 'Acme Industries' })], sprints, team_members: [makeMember()] }));
      app.App.activeCustomer = 'Acme Industries';
      app.window.Report.openSprintBriefPicker();
      const checked = app.window.document.querySelector('#sprintBriefPickerOverlay input[name="sb-picker-sprint"]:checked');
      expect(checked).not.toBeNull();
      expect(checked.value).toBe('CY26-S2');
      app.teardown();
    } finally { restore(); }
  });

  it('falls back to next future sprint when today is between sprints', async () => {
    const sprints = [
      { sprint_id: 'CY26-S1', customer: 'Acme Industries', start_date: '2026-04-01', end_date: '2026-04-15' },
      { sprint_id: 'CY26-S2', customer: 'Acme Industries', start_date: '2026-05-10', end_date: '2026-05-30' }
    ];
    const restore = fixedDate('2026-05-05');
    try {
      const app = await loadApp(makeDataset({ projects: [makeProject({ customer: 'Acme Industries' })], sprints, team_members: [makeMember()] }));
      app.App.activeCustomer = 'Acme Industries';
      app.window.Report.openSprintBriefPicker();
      const checked = app.window.document.querySelector('#sprintBriefPickerOverlay input[name="sb-picker-sprint"]:checked');
      expect(checked.value).toBe('CY26-S2');
      app.teardown();
    } finally { restore(); }
  });

  it('falls back to last past sprint when no future sprint exists', async () => {
    const sprints = [
      { sprint_id: 'CY26-S1', customer: 'Acme Industries', start_date: '2026-01-01', end_date: '2026-01-28' },
      { sprint_id: 'CY26-S2', customer: 'Acme Industries', start_date: '2026-02-01', end_date: '2026-02-28' }
    ];
    const restore = fixedDate('2026-05-05');
    try {
      const app = await loadApp(makeDataset({ projects: [makeProject({ customer: 'Acme Industries' })], sprints, team_members: [makeMember()] }));
      app.App.activeCustomer = 'Acme Industries';
      app.window.Report.openSprintBriefPicker();
      const checked = app.window.document.querySelector('#sprintBriefPickerOverlay input[name="sb-picker-sprint"]:checked');
      expect(checked.value).toBe('CY26-S2');
      app.teardown();
    } finally { restore(); }
  });

  it('shows empty state when no sprints exist', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject({ customer: 'Acme Industries' })], sprints: [], team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.window.Report.openSprintBriefPicker();
    const overlay = app.window.document.getElementById('sprintBriefPickerOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toContain('No sprints configured');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npx vitest run tests/unit/sprint-brief-picker.test.mjs
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add tests/unit/sprint-brief-picker.test.mjs
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "test(sprint-brief): default-sprint selection branches"
```

---

## Task 3: E2E tests

**Files:**
- Create: `tests/e2e/sprint-brief-picker.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/sprint-brief-picker.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Sprint Brief picker opens with a default selection', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('sprint'));
  await page.locator('button[onclick*="Report.openSprintBriefPicker"]').click();
  await expect(page.locator('#sprintBriefPickerOverlay')).toBeVisible();
  const checked = page.locator('#sprintBriefPickerOverlay input[name="sb-picker-sprint"]:checked');
  await expect(checked).toHaveCount(1);
});

test('Sprint Brief picker closes on Cancel', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('sprint'));
  await page.locator('button[onclick*="Report.openSprintBriefPicker"]').click();
  await expect(page.locator('#sprintBriefPickerOverlay')).toBeVisible();
  await page.locator('#sprintBriefPickerOverlay button:has-text("Cancel")').click();
  await expect(page.locator('#sprintBriefPickerOverlay')).toHaveCount(0);
});

test('Sprint Brief picker closes on Esc', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('sprint'));
  await page.locator('button[onclick*="Report.openSprintBriefPicker"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#sprintBriefPickerOverlay')).toHaveCount(0);
});

test('Generate Brief invokes exportSprintBrief with chosen id', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('sprint'));
  await page.evaluate(() => {
    (window as any).__lastBrief = null;
    (window as any).Report.exportSprintBrief = function (customer: string, sprintId: string) {
      (window as any).__lastBrief = { customer, sprintId };
    };
  });
  await page.locator('button[onclick*="Report.openSprintBriefPicker"]').click();
  const chosenId = await page.evaluate(() => {
    const r = document.querySelector('#sprintBriefPickerOverlay input[name="sb-picker-sprint"]:checked') as HTMLInputElement;
    return r ? r.value : null;
  });
  expect(chosenId).not.toBeNull();
  await page.locator('#sprintBriefPickerOverlay button:has-text("Generate Brief")').click();
  const captured = await page.evaluate(() => (window as any).__lastBrief);
  expect(captured.sprintId).toBe(chosenId);
  await expect(page.locator('#sprintBriefPickerOverlay')).toHaveCount(0);
});
```

- [ ] **Step 2: Run E2E**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:e2e
```
Expected: PASS — 4 new specs green. (The pre-existing gantt-interactions flake is allowed.)

- [ ] **Step 3: Commit**

```bash
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add tests/e2e/sprint-brief-picker.spec.ts
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "test(sprint-brief): E2E coverage for picker open/close/generate"
```

---

## Task 4: Final verification

- [ ] **Step 1: Run full suite**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm test
```
Expected: PASS (or only the pre-existing gantt-interactions flake — same failure as on main).

If a real failure surfaces, STOP and report.
