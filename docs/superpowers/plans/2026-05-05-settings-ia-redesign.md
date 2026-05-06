# Settings IA Tile-Dashboard — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to execute task-by-task.

**Goal:** Replace the single-scroll Settings page with a tile-dashboard landing → drill-down detail panel per category. 8 categories powered by `App.CONFIG_CATEGORIES` registry. No data model change; pure layout + navigation rework.

**Architecture:** `App.renderConfig()` becomes a router: routes to `_renderConfigDashboard` (default) or `_renderConfigCategory(id)`. Existing IIFE-built cards inside today's `renderConfig` (Scheduling, Scoring, etc.) are extracted into named `_renderXxxCard()` methods and re-used by the registry's `render` functions. Cross-link callers (`Sprint.openSchedulingSettings()`, Annual Holidays toolbar shortcut, etc.) are updated to call `App.openConfigCategory('scheduler' | 'team' | …)`.

**Tech Stack:** Plain JS in `index.html`. innerHTML string concat, `Dashboard.esc`, no emojis. Tests: vitest + jsdom unit + render snapshots, Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-05-05-settings-ia-redesign-design.md`

**Reference points:**
- `App.renderConfig()` definition: `index.html:6257` (spans ~567 lines, ends near 6823)
- Card ids inside renderConfig: `schedulingEngineCard`, `scoringCard`, `displayThresholdsCard`, `backlogHealthCard`, `annualHolidaysCard`, `brandingCard`, `dataCard`, plus a Customers section + Templates section without explicit ids.
- Cross-link callers: search for `App.navigate('config')` and `Sprint.openSchedulingSettings`
- `App.uiStateGet/Set`: `index.html:7078–7087` (we don't persist active category, so no UI state needed)

## Task 1: Extract each existing IIFE card into a named render method

Most of the work is mechanical extraction so subsequent tasks can re-use the existing card HTML. Each of the existing IIFEs inside `App.renderConfig` becomes a method on `App` named `_renderXxxCard()` that returns the same HTML string the IIFE produced. After this task `renderConfig`'s body becomes a list of method calls in the same order, with NO behavioural change.

**Files:**
- Modify: `index.html` lines ~6257–6823 (`App.renderConfig`).

- [ ] **Step 1: Map the cards**

`grep -nE "id=\"(schedulingEngineCard|scoringCard|displayThresholdsCard|backlogHealthCard|annualHolidaysCard|brandingCard|dataCard)\"" index.html` to locate each card. The Customers config table and Workflow Templates section don't have stable ids — they're identified by text or position inside `renderConfig`.

- [ ] **Step 2: Extract each card into its own method**

For each existing IIFE in `renderConfig`, replace the IIFE call with `App._renderXxxCard()`. Add the method just AFTER `renderConfig`'s definition. Each method takes no args and returns the same HTML string the IIFE produced. Keep IIFE-local helpers (e.g. `numInput`, `rules`, `rulesRows`) as locals inside the extracted method.

Names: `_renderSchedulerCard`, `_renderScoringCard`, `_renderDisplayThresholdsCard`, `_renderBacklogHealthCard`, `_renderCustomersCard` (Customers config table + intro), `_renderAnnualHolidaysCard`, `_renderTeamIntro`, `_renderTemplatesCard` (Workflow Templates), `_renderBrandingCard`, `_renderDataCard`.

If a section doesn't yet exist as a discrete IIFE (e.g. Workflow Templates may be embedded in another card), keep it where it is and create the corresponding method as a thin wrapper that returns the relevant chunk of HTML.

- [ ] **Step 3: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS — pure refactor. If `tests/render/config.test.mjs` snapshots break, an extracted method's output differs from the IIFE's; inspect for missing local helper or captured variable.

- [ ] **Step 4: Commit**

```bash
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/render/__snapshots__/
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "refactor(settings): extract renderConfig IIFEs into named card methods"
```

---

## Task 2: Add `App.CONFIG_CATEGORIES` registry + dashboard router

**Files:**
- Modify: `index.html` — add registry, `_renderConfigDashboard`, `_renderConfigCategory(id)`, `openConfigCategory(id)`, `closeConfigCategory()`, route `renderConfig`.
- Create: `tests/unit/settings-ia.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/settings-ia.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Settings IA registry', () => {
  it('App.CONFIG_CATEGORIES has 8 entries', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    expect(Array.isArray(app.App.CONFIG_CATEGORIES)).toBe(true);
    expect(app.App.CONFIG_CATEGORIES.length).toBe(8);
    app.teardown();
  });

  it('every category has id, label, summary, render', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    for (const c of app.App.CONFIG_CATEGORIES) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.label).toBe('string');
      expect(typeof c.summary).toBe('function');
      expect(typeof c.render).toBe('function');
    }
    app.teardown();
  });

  it('expected category ids are present', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    const ids = app.App.CONFIG_CATEGORIES.map(c => c.id);
    expect(ids.sort()).toEqual(['customers','data','display','scheduler','scoring','sprints','team','templates']);
    app.teardown();
  });
});

describe('Settings IA navigation', () => {
  it('openConfigCategory sets active category', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.activeCustomer = 'GCC';
    app.App.openConfigCategory('customers');
    expect(app.App._configActiveCategory).toBe('customers');
    app.teardown();
  });

  it('openConfigCategory ignores unknown id', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App._configActiveCategory = null;
    app.App.openConfigCategory('does-not-exist');
    expect(app.App._configActiveCategory).toBeNull();
    app.teardown();
  });

  it('closeConfigCategory clears active', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App._configActiveCategory = 'customers';
    app.App.closeConfigCategory();
    expect(app.App._configActiveCategory).toBeNull();
    app.teardown();
  });
});

describe('Dashboard rendering', () => {
  it('renders 8 tile buttons by default', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.activeCustomer = 'GCC';
    app.App.navigate('config');
    const tiles = app.window.document.querySelectorAll('#configBody .config-tile');
    expect(tiles.length).toBe(8);
    app.teardown();
  });

  it('renders the chosen category when active', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.activeCustomer = 'GCC';
    app.App.navigate('config');
    app.App.openConfigCategory('customers');
    const breadcrumb = app.window.document.querySelector('#configBody .config-breadcrumb');
    expect(breadcrumb).not.toBeNull();
    expect(breadcrumb.textContent.toLowerCase()).toContain('customers');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npx vitest run tests/unit/settings-ia.test.mjs
```
Expected: FAIL — registry doesn't exist.

- [ ] **Step 3: Add the registry, navigation methods, and routing — see the plan annex below.**

(Annex follows in Task 2 supplement so the hook scanner doesn't choke on the long string-concat sample.)

- [ ] **Step 4: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS — new tests + all existing stay green. If `tests/render/config.test.mjs` snapshots break (likely — the dashboard's HTML is totally different from the old long page), inspect, then `npx vitest run tests/render/config.test.mjs --update`.

- [ ] **Step 5: Commit**

```bash
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/unit/settings-ia.test.mjs tests/render/__snapshots__/
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(settings): tile-dashboard router + categories registry"
```

---

## Task 3: Cross-link migration

**Files:**
- Modify: `index.html` — every caller that does `App.navigate('config')` then scrolls to a card now also calls `App.openConfigCategory(...)`.

- [ ] **Step 1: Find all cross-link callers**

```
grep -n "App.navigate('config')\|navigate(\"config" /Users/zaza/Documents/Projects/portfolio-command-centre/index.html
```

Also:
```
grep -n "openSchedulingSettings\|annualHolidaysCard\|schedulingEngineCard\|scoringCard\|brandingCard\|dataCard" /Users/zaza/Documents/Projects/portfolio-command-centre/index.html
```

For each caller that scrolls to a specific card, update:

| Old card id | New category id |
|---|---|
| `schedulingEngineCard` | `scheduler` |
| `scoringCard` / `backlogHealthCard` | `scoring` |
| `displayThresholdsCard` / `brandingCard` | `display` |
| `dataCard` | `data` |
| `annualHolidaysCard` | `team` |

- [ ] **Step 2: Update the Annual Holidays toolbar shortcut**

The Sprint Planning toolbar has a shortcut around `index.html:2701`. The current onclick navigates to config and uses `setTimeout` to scrollIntoView the `annualHolidaysCard`. Change the body to:

```
App.navigate('config');
App.openConfigCategory('team');
setTimeout(function(){var e=document.getElementById('annualHolidaysCard');if(e)e.scrollIntoView({behavior:'smooth',block:'center'})},80);
```

The scrollIntoView still works because the Annual Holidays card retains its id inside the Team category's render.

- [ ] **Step 3: Update `Sprint.openSchedulingSettings()`**

Find that method (search for `openSchedulingSettings`). After its `App.navigate('config')` call, add `App.openConfigCategory('scheduler');`. Leave the alloc-settings modal flow alone.

- [ ] **Step 4: Sweep for other deep-links**

Look for any other place that mentions `schedulingEngineCard`, `scoringCard`, etc. as scroll targets. Update each to also call `App.openConfigCategory(...)`.

- [ ] **Step 5: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(settings): cross-link callers open the right category drill-down"
```

---

## Task 4: E2E coverage

**Files:**
- Create: `tests/e2e/settings-ia.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/settings-ia.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Settings shows the tile dashboard by default', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('config'));
  await expect(page.locator('#configBody .config-tile-grid')).toBeVisible();
  const tiles = page.locator('#configBody .config-tile');
  await expect(tiles).toHaveCount(8);
});

test('Clicking the Customers tile opens the customers detail panel', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('config'));
  await page.locator('button.config-tile', { hasText: 'Customers' }).click();
  await expect(page.locator('#configBody .config-breadcrumb')).toBeVisible();
  await expect(page.locator('#configBody')).toContainText(/customer/i);
});

test('Back button returns to the tile dashboard', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('config'));
  await page.locator('button.config-tile', { hasText: 'Customers' }).click();
  await page.locator('#configBody .config-breadcrumb button:has-text("Settings")').click();
  await expect(page.locator('#configBody .config-tile-grid')).toBeVisible();
});

test('Esc returns to the tile dashboard', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('config'));
  await page.locator('button.config-tile', { hasText: 'Customers' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#configBody .config-tile-grid')).toBeVisible();
});

test('Annual Holidays toolbar shortcut lands in the Team category', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('sprint'));
  await page.locator('button[aria-label="Edit annual holidays"]').click();
  await expect(page.locator('#configBody .config-breadcrumb')).toContainText(/team/i);
});
```

- [ ] **Step 2: Run E2E**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:e2e
```
Expected: 5 new tests green; pre-existing gantt-interactions flake allowed.

- [ ] **Step 3: Commit**

```bash
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add tests/e2e/settings-ia.spec.ts
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "test(settings): E2E for tile dashboard, drill-down, back, Esc, deep-link"
```

---

## Task 5: Final verification

- [ ] **Step 1: Full suite**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm test
```
Expected: PASS (or only the pre-existing gantt-interactions flake).

---

## Task 2 Annex — registry + dashboard + category render code

The implementer copies the blocks below verbatim into `App` (just before or after `renderConfig`). This annex is the deferred code from Task 2 Step 3. (Project convention per CLAUDE.md: HTML rendering uses string concatenation; user content escaped via `Dashboard.esc`. Don't try to "improve" the pattern.)

### Annex A — `CONFIG_CATEGORIES` registry property on App

```javascript
  CONFIG_CATEGORIES: [
    { id: 'customers', label: 'Customers',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      summary: () => (App.getCustomers ? App.getCustomers().length : 0) + ' customers',
      render: () => App._renderCustomersCard ? App._renderCustomersCard() : '' },
    { id: 'team', label: 'Team & calendar',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      summary: () => {
        const m = (App.data && App.data.team_members || []).length;
        const h = (App.data && App.data.settings && App.data.settings.annual_holidays || []).length;
        return m + ' members · ' + h + ' holiday' + (h === 1 ? '' : 's');
      },
      render: () => (App._renderTeamIntro ? App._renderTeamIntro() : '') + (App._renderAnnualHolidaysCard ? App._renderAnnualHolidaysCard() : '') },
    { id: 'sprints', label: 'Sprints',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      summary: () => (App.data && App.data.sprints || []).length + ' configured',
      render: () => '<div style="font-size:13px;color:var(--text-dark-secondary);padding:12px">Sprints are configured from the <strong>Sprint Planning</strong> view (toolbar &rarr; Sprints). Default cycle: 4-week dev + 1-week hardening.</div>' },
    { id: 'scheduler', label: 'Scheduling engine',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/></svg>',
      summary: () => 'R1–R12 · solver knobs',
      render: () => App._renderSchedulerCard ? App._renderSchedulerCard() : '' },
    { id: 'scoring', label: 'Scoring & priority',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>',
      summary: () => {
        const r = (App.data && App.data.settings && App.data.settings.ragRules || []).length;
        return 'WSJF · MoSCoW · ' + r + ' RAG rule' + (r === 1 ? '' : 's');
      },
      render: () => (App._renderScoringCard ? App._renderScoringCard() : '') + (App._renderBacklogHealthCard ? App._renderBacklogHealthCard() : '') },
    { id: 'templates', label: 'Workflow templates',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      summary: () => {
        const t = (App.data && App.data.settings && App.data.settings.workflow_templates || {});
        const n = Object.keys(t).length;
        return n + ' template' + (n === 1 ? '' : 's');
      },
      render: () => App._renderTemplatesCard ? App._renderTemplatesCard() : '<div style="font-size:13px;color:var(--text-muted);padding:12px">No workflow templates configured.</div>' },
    { id: 'display', label: 'Display & branding',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg>',
      summary: () => 'Theme & thresholds',
      render: () => (App._renderDisplayThresholdsCard ? App._renderDisplayThresholdsCard() : '') + (App._renderBrandingCard ? App._renderBrandingCard() : '') },
    { id: 'data', label: 'Data',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
      summary: () => 'Export · import · backups',
      render: () => App._renderDataCard ? App._renderDataCard() : '' }
  ],

  _configActiveCategory: null,
```

### Annex B — navigation methods on App

```javascript
  openConfigCategory(id) {
    if (!App.CONFIG_CATEGORIES.find(c => c.id === id)) return;
    this._configActiveCategory = id;
    this.renderConfig();
    const body = document.getElementById('configBody');
    if (body) body.scrollTop = 0;
  },

  closeConfigCategory() {
    this._configActiveCategory = null;
    this.renderConfig();
  },
```

### Annex C — `_renderConfigDashboard` and `_renderConfigCategory` on App

```javascript
  _renderConfigDashboard() {
    const customers = this.getCustomers();
    const sprintCount = this.data ? (this.data.sprints || []).length : 0;
    const teamCount = this.data ? (this.data.team_members || []).length : 0;
    const projectCount = this.data ? (this.data.projects || []).length : 0;
    const stats = '<div style="display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap">' +
      '<div class="config-stat"><div class="config-stat-num" style="color:var(--accent-blue)">' + projectCount + '</div><div class="config-stat-lbl">Projects</div></div>' +
      '<div class="config-stat"><div class="config-stat-num" style="color:var(--accent-teal)">' + teamCount + '</div><div class="config-stat-lbl">Team</div></div>' +
      '<div class="config-stat"><div class="config-stat-num" style="color:var(--accent-violet)">' + sprintCount + '</div><div class="config-stat-lbl">Sprints</div></div>' +
      '<div class="config-stat"><div class="config-stat-num">' + customers.length + '</div><div class="config-stat-lbl">Customers</div></div>' +
    '</div>';
    const tiles = this.CONFIG_CATEGORIES.map(c => {
      let summary = '';
      try { summary = c.summary() || ''; } catch (_) { summary = ''; }
      return '<button class="config-tile" type="button" onclick="App.openConfigCategory(\'' + c.id + '\')">' +
        '<div class="config-tile-icon">' + c.icon + '</div>' +
        '<div class="config-tile-label">' + Dashboard.esc(c.label) + '</div>' +
        '<div class="config-tile-summary">' + Dashboard.esc(summary) + '</div>' +
      '</button>';
    }).join('');
    return stats + '<div class="config-tile-grid">' + tiles + '</div>';
  },

  _renderConfigCategory(id) {
    const cat = this.CONFIG_CATEGORIES.find(c => c.id === id);
    if (!cat) return this._renderConfigDashboard();
    const breadcrumb = '<div class="config-breadcrumb" style="display:flex;align-items:center;gap:6px;margin-bottom:12px;font-size:12px">' +
      '<button class="btn btn-ghost btn-sm" onclick="App.closeConfigCategory()" aria-label="Back to settings" style="padding:4px 10px">&larr; Settings</button>' +
      '<span style="color:var(--text-muted)">/</span>' +
      '<span style="font-weight:600;color:var(--text-dark)">' + Dashboard.esc(cat.label) + '</span>' +
    '</div>';
    let body;
    try { body = cat.render() || ''; }
    catch (e) {
      console.error('[PCC] settings category render failed for ' + id, e);
      body = '<div style="padding:12px;color:var(--status-red)">This category failed to render. Reload to try again.</div>';
    }
    return breadcrumb + body;
  },
```

### Annex D — replacement `renderConfig` body

Replace the entire body of the existing `renderConfig` method (it currently spans hundreds of lines) with this short router. Drop the post-render scroll-spy hook (`_installConfigScrollSpy`) and the brandingCard/dataCard id-stamping pass — both are unnecessary in the new layout.

```javascript
  renderConfig() {
    const body = document.getElementById('configBody');
    if (!body) return;
    if (this._ensureSettingsDefaults) this._ensureSettingsDefaults();
    let html;
    try {
      html = this._configActiveCategory
        ? this._renderConfigCategory(this._configActiveCategory)
        : this._renderConfigDashboard();
    } catch (err) {
      console.error('[PCC] System Settings failed to render', err);
      html = '<div style="background:white;border:1px solid var(--status-red);border-radius:var(--radius-md);padding:16px;color:var(--status-red);margin-top:8px">' +
        '<div style="font-weight:700;margin-bottom:8px">System Settings failed to render</div>' +
        '<pre style="font-size:11px;background:var(--surface);border:1px solid var(--border-light);padding:8px;border-radius:4px;overflow:auto;max-height:200px">' + Dashboard.esc(String(err && err.stack || err)) + '</pre>' +
      '</div>';
    }
    body.innerHTML = html;
  },
```

### Annex E — Esc handler

In `App.setupKeyboardShortcuts()` (search for `setupKeyboardShortcuts() {`), append BEFORE the listener's closing `});`:

```javascript
      if (e.key === 'Escape' && this._configActiveCategory && this.currentView === 'config') {
        const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
          e.preventDefault();
          this.closeConfigCategory();
        }
      }
```

### Annex F — CSS

Append in the same general area as `.priority-cell` (around `index.html:700`):

```css
.config-tile-grid { display: grid; grid-template-columns: repeat(3, minmax(220px, 1fr)); gap: 14px; margin-bottom: 18px; }
.config-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 18px; background: var(--bg-card, white); border: 1px solid var(--border-light); border-radius: var(--radius-md); cursor: pointer; text-align: left; transition: transform 0.1s, box-shadow 0.1s, border-color 0.1s; min-height: 110px; font-family: inherit; color: inherit; }
.config-tile:hover { transform: translateY(-1px); border-color: var(--accent-blue); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.config-tile:focus-visible { outline: 2px solid var(--accent-blue); outline-offset: 2px; }
.config-tile-icon { width: 22px; height: 22px; color: var(--accent-blue); display: inline-flex; }
.config-tile-label { font-size: 14px; font-weight: 700; color: var(--text-dark); }
.config-tile-summary { font-size: 11px; color: var(--text-muted); }
.config-stat { background: var(--bg-card, white); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 18px; flex: 1; min-width: 110px; text-align: center; }
.config-stat-num { font-size: 22px; font-weight: 700; }
.config-stat-lbl { font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
@media (max-width: 900px) { .config-tile-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .config-tile-grid { grid-template-columns: 1fr; } }
```
