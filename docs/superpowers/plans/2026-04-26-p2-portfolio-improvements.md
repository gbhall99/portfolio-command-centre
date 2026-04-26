# P2 Portfolio Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land P2 enhancements that lift the senior-manager portfolio from ~7.5/10 (after P0+P1) to ~8.5/10: scenario sandboxing, per-project sponsor packs, sustainable-pace alerting, walkthrough mode, scope-change rationale + persistent audit, and a cost model.

**Architecture:** Same single-file `index.html` app and vitest+jsdom+playwright test stack. Each feature is independently committable. Builds on P1 helpers (`computeOnTrackVerdict`, `forecastForCandidate`, `lifecycleStageChip`).

**Tech Stack:** Plain JS (zero build), inline SVG, `vitest` 2.1, `@playwright/test` 1.48, `jsdom` 25.

**Pre-flight:** Ensure P0 and P1 plans are merged. Run `npm test` and confirm green.

---

## Phase A — Scenario sandbox + named scenarios

Edits today hit live data. Add a `Sandbox` mode + named scenario snapshots so a manager can explore "what if we slip Project X" without committing.

---

## Task 1: Scenario storage shape + helper

**Files:**
- Modify: `index.html` — add `App.scenarios` and helpers `App.saveScenario(name)`, `App.loadScenario(id)`, `App.deleteScenario(id)`, `App.listScenarios()`.
- Test: `tests/unit/scenarios.test.mjs` (create).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/scenarios.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Scenarios — storage shape', () => {
  it('saveScenario captures full data and returns an id', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'X' })], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    const id = app.App.saveScenario('Plan A');
    expect(id).toMatch(/^sc_/);
    const list = app.App.listScenarios();
    expect(list.find(s => s.id === id)).toBeDefined();
    expect(list.find(s => s.id === id).name).toBe('Plan A');
    app.teardown();
  });

  it('loadScenario restores the captured state byte-for-byte', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'Original' })], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    const id = app.App.saveScenario('snap');
    app.App.data.projects[0].name = 'Mutated';
    app.App.loadScenario(id);
    expect(app.App.data.projects[0].name).toBe('Original');
    app.teardown();
  });

  it('deleteScenario removes the entry', async () => {
    const app = await loadApp(makeDataset({}));
    const id = app.App.saveScenario('temp');
    expect(app.App.listScenarios().length).toBe(1);
    app.App.deleteScenario(id);
    expect(app.App.listScenarios().length).toBe(0);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/unit/scenarios.test.mjs
```

Expected: FAIL — helpers undefined.

- [ ] **Step 3: Implement the helpers in `App`**

In `index.html` find `App.LIFECYCLE_STAGE_DEFAULT:` and immediately after the `App.data: null,` line, add a `scenarios:` field. Then add helpers near other persistence helpers (search for `saveToLocalStorage`):

```javascript
  saveScenario(name) {
    if (!this.data) return null;
    if (!this.data._scenarios) this.data._scenarios = [];
    const id = 'sc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const snapshot = JSON.parse(JSON.stringify({
      projects: this.data.projects,
      sprints: this.data.sprints,
      team_members: this.data.team_members
    }));
    this.data._scenarios.push({ id, name: String(name || 'Scenario').slice(0, 80), created_at: new Date().toISOString(), snapshot });
    this.markDirty();
    this.saveToLocalStorage();
    return id;
  },

  listScenarios() {
    return ((this.data && this.data._scenarios) || []).map(s => ({ id: s.id, name: s.name, created_at: s.created_at }));
  },

  loadScenario(id) {
    if (!this.data || !Array.isArray(this.data._scenarios)) return false;
    const sc = this.data._scenarios.find(s => s.id === id);
    if (!sc) return false;
    this.pushUndo('Load scenario: ' + sc.name);
    if (sc.snapshot.projects) this.data.projects = JSON.parse(JSON.stringify(sc.snapshot.projects));
    if (sc.snapshot.sprints) this.data.sprints = JSON.parse(JSON.stringify(sc.snapshot.sprints));
    if (sc.snapshot.team_members) this.data.team_members = JSON.parse(JSON.stringify(sc.snapshot.team_members));
    this.markDirty();
    this.saveToLocalStorage();
    if (this.notifyDataChange) this.notifyDataChange();
    return true;
  },

  deleteScenario(id) {
    if (!this.data || !Array.isArray(this.data._scenarios)) return false;
    const len = this.data._scenarios.length;
    this.data._scenarios = this.data._scenarios.filter(s => s.id !== id);
    if (this.data._scenarios.length !== len) {
      this.markDirty();
      this.saveToLocalStorage();
      return true;
    }
    return false;
  },
```

- [ ] **Step 4: Run the tests**

```bash
npm run test:unit -- tests/unit/scenarios.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/scenarios.test.mjs index.html
git commit -m "feat(scenarios): saveScenario / loadScenario / deleteScenario helpers"
```

---

## Task 2: Scenario manager modal

**Files:**
- Modify: `index.html` — add `App.openScenarioManager()` modal with list + Save current + Load + Delete.
- Modify: header — add a button to open it.
- Test: `tests/render/scenarios.test.mjs` (create).

- [ ] **Step 1: Write the test**

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

describe('Scenario manager modal', () => {
  it('opens with Save / Load / list rendering', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'X' })], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.saveScenario('Plan A');
    app.App.openScenarioManager();
    const overlay = app.window.document.getElementById('scenarioManagerOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay.innerHTML).toMatch(/Plan A/);
    expect(overlay.innerHTML).toMatch(/Save current/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

```bash
npm run test:unit -- tests/render/scenarios.test.mjs
```

Expected: FAIL — `openScenarioManager` undefined.

- [ ] **Step 3: Implement the modal**

In `index.html` add inside `App` (near `openShortcutsOverlay` or another modal helper):

```javascript
  openScenarioManager() {
    const existing = document.getElementById('scenarioManagerOverlay');
    if (existing) existing.remove();
    const list = this.listScenarios();
    const esc = Dashboard.esc;
    const overlay = document.createElement('div');
    overlay.id = 'scenarioManagerOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);padding:16px';
    const rows = list.length
      ? list.map(s => '<tr><td style="padding:6px 8px;font-weight:600">' + esc(s.name) + '</td><td style="padding:6px 8px;color:var(--text-muted);font-size:11px">' + esc(s.created_at) + '</td><td style="padding:6px 8px"><button class="btn btn-outline btn-sm" onclick="App.loadScenario(\'' + esc(s.id) + '\');document.getElementById(\'scenarioManagerOverlay\').remove();App.toast(\'Scenario loaded\',\'success\')">Load</button> <button class="btn btn-ghost btn-sm" onclick="App.deleteScenario(\'' + esc(s.id) + '\');App.openScenarioManager()">Delete</button></td></tr>').join('')
      : '<tr><td colspan="3" style="padding:14px;color:var(--text-muted);text-align:center">No saved scenarios yet.</td></tr>';
    overlay.innerHTML =
      '<div style="background:var(--surface,white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:18px 22px;max-width:640px;width:100%;color:var(--text-dark)">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px">' +
          '<h3 style="margin:0;font-size:var(--fs-lg);font-weight:700">Scenarios</h3>' +
          '<button onclick="document.getElementById(\'scenarioManagerOverlay\').remove()" style="background:transparent;border:none;font-size:22px;line-height:1;cursor:pointer;color:var(--text-muted)" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:10px">' +
          '<label style="font-size:11px;font-weight:600;flex:1">Name<br><input type="text" id="scenarioName" placeholder="e.g. April commit" style="width:100%;padding:5px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px;margin-top:2px"></label>' +
          '<button class="btn btn-primary btn-sm" onclick="(function(){var n=document.getElementById(\'scenarioName\').value.trim();if(!n){App.toast(\'Name required\',\'error\');return;}App.saveScenario(n);App.openScenarioManager();App.toast(\'Scenario saved\',\'success\');})()">Save current</button>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px"><tbody>' + rows + '</tbody></table>' +
      '</div>';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },
```

- [ ] **Step 4: Add header button**

Find the When-by header button (`#btnWhenBy`) and add immediately after:

```html
    <button class="btn btn-ghost btn-sm" id="btnScenarios" onclick="App.openScenarioManager()" title="Scenarios — save / load named what-if snapshots" aria-label="Scenarios"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><title>Scenarios</title><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button>
```

- [ ] **Step 5: Run the test**

```bash
npm run test:unit -- tests/render/scenarios.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/render/scenarios.test.mjs index.html
git commit -m "feat(scenarios): scenario manager modal + header button"
```

---

## Phase B — Per-project sponsor pack

A one-pager PDF for a single project, as opposed to the customer-wide Portfolio Pack.

---

## Task 3: `Report.exportProjectPack(projectId)`

**Files:**
- Modify: `index.html` — add to existing `Report` module (search for `const Report = {` or `Report = {`).
- Test: `tests/unit/sponsor-pack.test.mjs` (create).

- [ ] **Step 1: Failing test**

Create `tests/unit/sponsor-pack.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Per-project sponsor pack', () => {
  it('exportProjectPack returns a doc with sections for narrative/milestones/risks/EVM', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Demo', sponsor: 'Sandra Lee', manager: 'Owen' });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    const Report = app.window.__pcc__.Report;
    expect(Report).toBeDefined();
    const doc = Report.buildProjectPackDoc(proj.id);
    expect(doc).toBeDefined();
    expect(doc.title).toMatch(/Demo/);
    expect(doc.sections.find(s => /Narrative/i.test(s.title))).toBeDefined();
    expect(doc.sections.find(s => /Risks/i.test(s.title))).toBeDefined();
    app.teardown();
  });
});
```

- [ ] **Step 2: Update bridge to expose Report**

In `tests/harness/loadApp.mjs` find the bridge `<script>` and add `Report` to the exposed handles. Also add to the return object below.

- [ ] **Step 3: Run test (should fail with `buildProjectPackDoc undefined`)**

```bash
npm run test:unit -- tests/unit/sponsor-pack.test.mjs
```

- [ ] **Step 4: Add `buildProjectPackDoc` to `Report`**

In `index.html` find `Report.exportPortfolioPack` (search for `exportPortfolioPack`). Just above it, add:

```javascript
  // Build a one-page sponsor pack for a single project. Pure: returns the
  // doc shape consumed by Report.open / Report.buildDoc; no DOM mutation.
  buildProjectPackDoc(projectId) {
    const p = (App.data && App.data.projects || []).find(pr => pr.id === projectId);
    if (!p) return null;
    const esc = Dashboard.esc;
    const ev = (typeof Forecast !== 'undefined' && Forecast.earnedValue) ? Forecast.earnedValue(p) : null;
    const risks = (p.risks_register || []).slice().sort((a, b) =>
      ((b.impact || 0) * (b.probability || 0)) - ((a.impact || 0) * (a.probability || 0))
    ).slice(0, 5);
    const lifecycle = (typeof App.lifecycleStageChip === 'function') ? App.lifecycleStageChip(p) : '';
    const narrative = '<p><strong>Sponsor:</strong> ' + esc(p.sponsor || '—') + ' &middot; <strong>Manager:</strong> ' + esc(p.manager || '—') + ' &middot; ' + lifecycle + '</p>' +
      '<p><strong>Status:</strong> ' + esc(p.status) + ' &middot; <strong>RAG:</strong> S=' + esc(p.rag_schedule || '') + ' R=' + esc(p.rag_resourcing || '') + ' P=' + esc(p.rag_scope || '') + '</p>' +
      '<p><strong>Dates:</strong> ' + esc(p.start_date || '—') + ' → ' + esc(p.target_date || '—') + (p.hard_deadline ? ' (hard ' + esc(p.hard_deadline) + ')' : '') + '</p>' +
      (p.notes ? '<p>' + esc(p.notes) + '</p>' : '');
    const milestones = '<ul>' +
      (p.target_date ? '<li>Target: ' + esc(p.target_date) + '</li>' : '') +
      (p.hard_deadline ? '<li>Hard deadline: ' + esc(p.hard_deadline) + '</li>' : '') +
      ((p.data_sourcing && p.data_sourcing.uat_release_date) ? '<li>UAT release: ' + esc(p.data_sourcing.uat_release_date) + '</li>' : '') +
      '</ul>';
    const risksHtml = risks.length
      ? '<table><tr><th>Risk</th><th>Owner</th><th>I</th><th>P</th><th>Score</th></tr>' +
        risks.map(r => '<tr><td>' + esc(r.description || '') + '</td><td>' + esc(r.owner || '') + '</td><td>' + (r.impact || '') + '</td><td>' + (r.probability || '') + '</td><td><strong>' + ((r.impact || 0) * (r.probability || 0)) + '</strong></td></tr>').join('') +
        '</table>'
      : '<p>No open risks.</p>';
    const evmHtml = ev
      ? '<p>BAC ' + (ev.BAC || '—') + ' &middot; EV ' + (ev.EV || 0) + ' &middot; PV ' + (ev.PV != null ? ev.PV : '—') + ' &middot; AC ' + (ev.AC || 0) + ' &middot; SPI ' + (ev.SPI != null ? ev.SPI.toFixed(2) : '—') + ' &middot; CPI ' + (ev.CPI != null ? ev.CPI.toFixed(2) : '—') + '</p>'
      : '<p>EVM unavailable (no baseline).</p>';
    return (typeof Report !== 'undefined' && Report.buildDoc)
      ? Report.buildDoc({
          customer: p.customer,
          title: 'Sponsor Pack — ' + p.name,
          subtitle: 'One-page brief for the project sponsor',
          reportType: 'Sponsor Pack',
          sections: [
            { id: 'pp-narrative',  title: 'Narrative',  html: narrative },
            { id: 'pp-milestones', title: 'Milestones', html: milestones },
            { id: 'pp-risks',      title: 'Risks',      html: risksHtml },
            { id: 'pp-evm',        title: 'EVM',        html: evmHtml }
          ],
          includeAppendix: false
        })
      : { title: 'Sponsor Pack — ' + p.name, sections: [
          { id: 'pp-narrative',  title: 'Narrative',  html: narrative },
          { id: 'pp-milestones', title: 'Milestones', html: milestones },
          { id: 'pp-risks',      title: 'Risks',      html: risksHtml },
          { id: 'pp-evm',        title: 'EVM',        html: evmHtml }
        ] };
  },

  exportProjectPack(projectId) {
    const doc = this.buildProjectPackDoc(projectId);
    if (!doc) { App.toast('Project not found', 'error'); return; }
    if (this.open) this.open(doc);
    App.toast('Sponsor pack opened — use Print > Save as PDF', 'success');
  },
```

- [ ] **Step 5: Add a "Sponsor Pack" button on Detail Panel**

Find the Detail Panel toolbar (search for "Set baseline" button on the detail panel) and add adjacent:

```html
'<button class="btn btn-outline btn-sm" onclick="Report.exportProjectPack(\'' + Dashboard.esc(p.id) + '\')" title="Export a one-page sponsor pack as PDF">Sponsor Pack</button>'
```

- [ ] **Step 6: Run tests**

```bash
npm run test:unit -- tests/unit/sponsor-pack.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/sponsor-pack.test.mjs tests/harness/loadApp.mjs index.html
git commit -m "feat(report): per-project Sponsor Pack export"
```

---

## Phase C — Sustainable-pace alert

Flag team members with 3+ consecutive sprints at ≥90% load.

---

## Task 4: `Capacity.computeSustainedHighLoad(customer)` + dashboard surfacing

**Files:**
- Modify: `index.html` — add helper to `Capacity`.
- Test: `tests/unit/sustainable-pace.test.mjs` (create).

- [ ] **Step 1: Failing test**

Create `tests/unit/sustainable-pace.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Sustainable pace alert', () => {
  it('flags a member at >=90% for 3+ consecutive sprints', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(4);
    const member = makeMember({ name: 'Alice', available_points_per_sprint: 10 });
    const proj = makeProject({
      name: 'Hot', size_engineering: 36,
      skill_splits: {
        size_engineering: sprints.slice(0, 3).map(s => ({
          sprint: s.sprint_id, points: 10, status: 'pending', completed: 0,
          assigned_to: [{ member: 'Alice', points: 10 }],
          reasons: []
        }))
      }
    });
    proj.size_total = 36;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [member] }));
    const flagged = app.Capacity.computeSustainedHighLoad('GCC');
    expect(flagged.length).toBe(1);
    expect(flagged[0].member).toBe('Alice');
    expect(flagged[0].consecutiveSprints).toBeGreaterThanOrEqual(3);
    app.teardown();
  });

  it('does NOT flag members with intermittent peaks', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(4);
    const member = makeMember({ name: 'Bob', available_points_per_sprint: 10 });
    const proj = makeProject({
      name: 'Spiky', size_engineering: 20,
      skill_splits: {
        size_engineering: [
          { sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [{ member: 'Bob', points: 10 }], reasons: [] },
          { sprint: sprints[2].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [{ member: 'Bob', points: 10 }], reasons: [] }
        ]
      }
    });
    proj.size_total = 20;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [member] }));
    const flagged = app.Capacity.computeSustainedHighLoad('GCC');
    expect(flagged.length).toBe(0);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test (should fail)**

```bash
npm run test:unit -- tests/unit/sustainable-pace.test.mjs
```

- [ ] **Step 3: Implement helper**

In `index.html` add to `Capacity` (next to `computeResourcingGap`):

```javascript
  // Sustainable-pace heuristic — return team members with >=90% utilisation across
  // 3 or more consecutive sprints in the active horizon.
  computeSustainedHighLoad(customer, opts) {
    opts = opts || {};
    const threshold = opts.threshold != null ? opts.threshold : 0.9;
    const minRun = opts.minRun != null ? opts.minRun : 3;
    const sprints = (App.data && App.data.sprints) ? App.data.sprints : [];
    const projects = (App.data && App.data.projects)
      ? App.data.projects.filter(p => !customer || p.customer === customer)
      : [];
    const members = (App.data && App.data.team_members || []).filter(tm => {
      if (!customer) return true;
      const c = (tm.customer || '').toLowerCase();
      return c === customer.toLowerCase() || c === 'both';
    });
    const flagged = [];
    members.forEach(tm => {
      let runStart = null, run = 0, longestRun = 0, longestStart = null;
      sprints.forEach((s, idx) => {
        const cap = (typeof Sprint !== 'undefined' && Sprint.calcMemberCapacityForSprint)
          ? (Sprint.calcMemberCapacityForSprint(tm, s.sprint_id, customer).points || 0)
          : (tm.available_points_per_sprint || 0);
        let load = 0;
        projects.forEach(p => {
          const arr = (p.skill_splits || {});
          Object.values(arr).forEach(slices => {
            if (!Array.isArray(slices)) return;
            slices.forEach(sp => {
              if (sp.sprint !== s.sprint_id) return;
              (sp.assigned_to || []).forEach(a => { if (a.member === tm.name) load += a.points || 0; });
            });
          });
        });
        const ratio = cap > 0 ? load / cap : 0;
        if (ratio >= threshold) {
          if (run === 0) runStart = idx;
          run++;
          if (run > longestRun) { longestRun = run; longestStart = runStart; }
        } else {
          run = 0;
          runStart = null;
        }
      });
      if (longestRun >= minRun) {
        flagged.push({
          member: tm.name,
          consecutiveSprints: longestRun,
          startSprintId: sprints[longestStart] ? sprints[longestStart].sprint_id : null
        });
      }
    });
    return flagged;
  },
```

- [ ] **Step 4: Run tests**

```bash
npm run test:unit -- tests/unit/sustainable-pace.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Surface on Capacity view**

In `index.html` find the Capacity view section after `#capacityGapPanel`. Insert a new container `#sustainedPacePanel` and a render call. Add the renderer:

```javascript
  renderSustainedHighLoad(customer) {
    const host = document.getElementById('sustainedPacePanel');
    if (!host) return;
    const cust = customer || App.activeCustomer;
    const flagged = this.computeSustainedHighLoad(cust);
    if (!flagged.length) {
      host.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:6px 0">No sustained high-load members detected.</div>';
      return;
    }
    const esc = Dashboard.esc;
    host.innerHTML = '<div style="font-size:13px;font-weight:700;margin-bottom:4px">Sustained High Load</div>' +
      '<ul style="margin:0;padding-left:18px;font-size:12px">' +
        flagged.map(f => '<li><strong>' + esc(f.member) + '</strong> &mdash; ' + f.consecutiveSprints + ' consecutive sprints &ge;90% from <em>' + esc(f.startSprintId || '—') + '</em></li>').join('') +
      '</ul>';
  },
```

Add the host element after the Resourcing Gap section in the Capacity view markup.

Wire `Capacity.render` to call `renderSustainedHighLoad` after `renderResourcingGap`.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/sustainable-pace.test.mjs index.html
git commit -m "feat(capacity): sustained high-load alert per team member"
```

---

## Phase D — Walkthrough mode (PO/SM weekly review)

A guided pass through every chip touched-since-last-review with quick-edit modals.

---

## Task 5: Walkthrough mode skeleton

**Files:**
- Modify: `index.html` — add `Sprint.openWalkthrough()` plus state.
- Test: `tests/render/walkthrough.test.mjs` (create).

- [ ] **Step 1: Write the test**

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Walkthrough mode', () => {
  it('opens with a one-card-per-untouched-chip queue', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({
      name: 'P', size_engineering: 10,
      skill_splits: {
        size_engineering: [{ sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [], reasons: [] }]
      }
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Sprint.openWalkthrough();
    const overlay = app.window.document.getElementById('walkthroughOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay.innerHTML).toMatch(/Walkthrough/);
    expect(overlay.innerHTML).toMatch(/Pending: <strong>10/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Implement modal**

Add to `Sprint`:

```javascript
  openWalkthrough() {
    if (!App.data) return;
    const customer = App.activeCustomer;
    if (!customer) { App.toast('Select a customer first', 'error'); return; }
    const existing = document.getElementById('walkthroughOverlay');
    if (existing) existing.remove();
    const projects = App.data.projects.filter(p => p.customer === customer && p.status !== 'Complete' && p.status !== 'Closed');
    const queue = [];
    projects.forEach(p => {
      Object.entries(p.skill_splits || {}).forEach(([skKey, arr]) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((sp, idx) => {
          if (sp.status === 'complete') return;
          const remaining = (sp.points || 0) - (sp.completed || 0);
          if (remaining <= 0) return;
          queue.push({ projectId: p.id, projectName: p.name, skillKey: skKey, sprintId: sp.sprint, idx, points: sp.points, completed: sp.completed || 0, remaining });
        });
      });
    });
    const esc = Dashboard.esc;
    const overlay = document.createElement('div');
    overlay.id = 'walkthroughOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);padding:16px';
    const items = queue.slice(0, 50).map(q => '<li style="padding:6px 0;border-bottom:1px solid var(--border-light)"><strong>' + esc(q.projectName) + '</strong> &middot; ' + esc(q.skillKey.replace(/^size_/, '')) + ' in ' + esc(q.sprintId) + ' &middot; Pending: <strong>' + q.remaining + '</strong> SP <button class="btn btn-outline btn-sm" style="margin-left:8px" onclick="Sprint.openChipProgressEditor(\'' + esc(q.projectId) + '\',\'' + esc(q.skillKey) + '\',\'' + esc(q.sprintId) + '\')">Edit</button></li>').join('');
    overlay.innerHTML =
      '<div style="background:var(--surface,white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:18px 22px;max-width:720px;width:100%;color:var(--text-dark);max-height:90vh;overflow:auto">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px">' +
          '<h3 style="margin:0;font-size:var(--fs-lg);font-weight:700">Walkthrough — weekly progress review</h3>' +
          '<button onclick="document.getElementById(\'walkthroughOverlay\').remove()" style="background:transparent;border:none;font-size:22px;line-height:1;cursor:pointer;color:var(--text-muted)" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">' + queue.length + ' open chips. Click <strong>Edit</strong> to update completed SP per chip.</div>' +
        '<ul style="margin:0;padding-left:18px;font-size:12px">' + (items || '<li>No open chips for this customer.</li>') + '</ul>' +
      '</div>';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },
```

- [ ] **Step 3: Add a Sprint Planning button**

In Sprint Planning toolbar (search for `Auto-Allocate` button), add adjacent:

```html
<button class="btn btn-outline btn-sm" onclick="Sprint.openWalkthrough()" title="Walkthrough — guided weekly progress review of every open chip">Walkthrough</button>
```

- [ ] **Step 4: Run tests**

```bash
npm run test:unit -- tests/render/walkthrough.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/render/walkthrough.test.mjs index.html
git commit -m "feat(sprint): walkthrough mode lists every open chip with quick-edit"
```

---

## Phase E — Scope-rationale + persistent audit

Capture WHY a scope change happened; archive audit log when it exceeds 1000 entries.

---

## Task 6: Required rationale on scope-affecting field changes

**Files:**
- Modify: `index.html` — extend `App.logChange` to require a rationale when the field is in a known-scope list.
- Test: `tests/unit/scope-rationale.test.mjs` (create).

- [ ] **Step 1: Failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Scope rationale', () => {
  it('logChange records a rationale on size_engineering changes', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P', size_engineering: 10 });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    app.App.logChange(proj.id, 'size_engineering', 10, 14, 'user', { rationale: 'New requirement from sponsor' });
    const last = app.App.data.audit_log[app.App.data.audit_log.length - 1];
    expect(last.rationale).toMatch(/sponsor/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Implement**

Find `App.logChange` (search for `logChange:`). Update its signature to accept an `opts` object. Inside, persist `opts.rationale` on the entry. The existing `audit_log.push(...)` should include `rationale: opts && opts.rationale ? String(opts.rationale).slice(0, 200) : null`.

- [ ] **Step 3: Surface a rationale prompt on detail-panel size edits**

In the field-save dispatcher (search for `_saveField` or similar), when `field` matches `/^size_/` AND old value differs from new value AND the project already has any allocation, show a small inline prompt before save asking "Why did this change?". Capture the answer and pass as `opts.rationale`.

- [ ] **Step 4: Run tests**

```bash
npm run test:unit -- tests/unit/scope-rationale.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/scope-rationale.test.mjs index.html
git commit -m "feat(audit): rationale captured on scope field changes"
```

---

## Task 7: Persistent audit (no rollover)

**Files:**
- Modify: `index.html` — when `audit_log.length > 1000`, archive to `audit_log_archive[]` instead of dropping the oldest.
- Test: extend `tests/unit/scope-rationale.test.mjs`.

- [ ] **Step 1: Failing test**

Append to `tests/unit/scope-rationale.test.mjs`:

```javascript
describe('Persistent audit (no rollover)', () => {
  it('archives entries beyond 1000 instead of dropping them', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({}));
    for (let i = 0; i < 1100; i++) {
      app.App.logChange('p1', 'priority', i, i + 1, 'auto');
    }
    expect(app.App.data.audit_log.length).toBeLessThanOrEqual(1000);
    expect(Array.isArray(app.App.data.audit_log_archive)).toBe(true);
    expect(app.App.data.audit_log_archive.length).toBeGreaterThan(0);
    app.teardown();
  });
});
```

- [ ] **Step 2: Implement**

Find the rollover block in `App.logChange` (currently does `audit_log.shift()` or similar to keep length<=1000). Replace with: instead of shift, push to `data.audit_log_archive` (init array if missing).

- [ ] **Step 3: Run tests**

```bash
npm run test:unit -- tests/unit/scope-rationale.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/scope-rationale.test.mjs index.html
git commit -m "feat(audit): persistent archive — entries past 1000 move to audit_log_archive"
```

---

## Phase F — Cost model (rate cards + cost rollup)

---

## Task 8: Rate-card config + project cost compute

**Files:**
- Modify: `index.html` — extend `App.data.settings.rate_card` with default rates per skill key.
- Test: `tests/unit/cost-model.test.mjs` (create).

- [ ] **Step 1: Failing test**

Create:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Cost model', () => {
  it('computeProjectCost returns BAC and EAC in £', async () => {
    resetIdSeq();
    const proj = makeProject({
      name: 'Cost', size_engineering: 20,
      skill_splits: { size_engineering: [{ sprint: 'CY26-S1', points: 5, status: 'complete', completed: 5, assigned_to: [], reasons: [] }] }
    });
    proj.size_total = 20;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()],
      settings: { rate_card: { size_engineering: { perm: 750, contract: 1100 } } }
    }));
    const cost = app.App.computeProjectCost(proj);
    expect(cost.BAC).toBe(20 * 750);   // size * perm rate (default mix=perm)
    expect(cost.AC).toBe(5 * 750);     // completed
    app.teardown();
  });
});
```

- [ ] **Step 2: Implement**

Add to `App`:

```javascript
  // Cost helper. Reads rate_card from settings and applies the default employment-mix (perm).
  // Returns { BAC, EV, AC, currency }.
  computeProjectCost(p) {
    const rates = (this.data && this.data.settings && this.data.settings.rate_card) || {};
    const skills = ['size_requirements', 'size_tableau', 'size_engineering', 'size_data_science', 'size_uat_adoption'];
    let BAC = 0, AC = 0, EV = 0;
    skills.forEach(k => {
      const rate = (rates[k] && (rates[k].perm || rates[k].contract)) || 0;
      const planned = p[k] || 0;
      BAC += planned * rate;
      const splits = (p.skill_splits || {})[k] || [];
      splits.forEach(sp => {
        AC += (sp.points || 0) * rate;
        const ev = sp.status === 'complete' ? (sp.points || 0) : (sp.completed || 0);
        EV += ev * rate;
      });
    });
    return { BAC: Math.round(BAC), EV: Math.round(EV), AC: Math.round(AC), currency: 'GBP' };
  },
```

- [ ] **Step 3: Run tests**

```bash
npm run test:unit -- tests/unit/cost-model.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/cost-model.test.mjs index.html
git commit -m "feat(cost): computeProjectCost reads rate_card and returns BAC/EV/AC in GBP"
```

---

## Task 9: P2 E2E + final verification

**Files:**
- Create: `tests/e2e/p2-flows.spec.ts` (scenario manager opens; sponsor-pack button on detail panel; walkthrough modal opens).

- [ ] **Step 1: Spec**

```typescript
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test.describe('P2 — Scenario manager', () => {
  test('opens via header button', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => (window as any).App.openScenarioManager());
    await expect(page.locator('#scenarioManagerOverlay')).toContainText(/Scenarios/);
  });
});

test.describe('P2 — Walkthrough', () => {
  test('opens via Sprint.openWalkthrough', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => (window as any).Sprint.openWalkthrough());
    await expect(page.locator('#walkthroughOverlay')).toContainText(/Walkthrough/);
  });
});
```

- [ ] **Step 2: Run**

```bash
npm run test:e2e -- p2-flows.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Full suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/p2-flows.spec.ts
git commit -m "test(e2e): scenario manager + walkthrough smoke covers P2 user flows"
```

---

## Self-review checklist

- [ ] `App.saveScenario` / `loadScenario` / `deleteScenario` round-trip without data loss.
- [ ] Scenario manager modal lists, saves, loads, deletes.
- [ ] `Report.buildProjectPackDoc(id)` returns sections for narrative, milestones, risks, EVM.
- [ ] Detail Panel exposes a Sponsor Pack button.
- [ ] `Capacity.computeSustainedHighLoad` flags ≥3-consecutive-sprint members at ≥90%.
- [ ] Capacity view renders the sustained-load list under the Resourcing Gap.
- [ ] `Sprint.openWalkthrough()` opens an overlay with one entry per open chip and an Edit button.
- [ ] `App.logChange` accepts `opts.rationale` and persists it on the entry.
- [ ] When `audit_log` exceeds 1000 entries, surplus rows move to `audit_log_archive` rather than being dropped.
- [ ] `App.computeProjectCost(p)` returns `{BAC, EV, AC, currency}` using `settings.rate_card`.
- [ ] `npm test` is green.
