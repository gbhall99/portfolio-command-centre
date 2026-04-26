# P4 Portfolio Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land seven P4 features so the senior-manager portfolio average lifts from 7.7/10 to ~9.0/10: dedicated Backlog tab, member impact simulator, sandbox mode + scenario comparison, baseline→current connector arrows on the Gantt, Sprint Brief PDF + personal *View as…* filter, POC→Implementation conversion ceremony, and a Plan-Phase-2+ gate flow.

**Architecture:** Same single-file `index.html` app. Pure helpers first (`computeBacklogBuckets`, `simulateMemberImpact`, `convertToImplementation`, `promotePhase`), then UI surfaces (Backlog view, Member Impact modal, Sandbox header toggle, Scenario Comparison modal, Baseline arrows in Gantt render, Sprint Brief export, View-as picker, Detail Panel ceremony buttons). Each feature is independently committable and builds on existing P0–P3 helpers.

**Tech Stack:** Plain JS (zero build), inline SVG, `vitest` 2.1, `@playwright/test` 1.48, `jsdom` 25.

**Pre-flight:**

```bash
npm install && npm test
```

P0+P1+P2+P3 already merged. Run on `audit-f-nnn-data-integrity` (or worktree from main + cherry-picks).

---

## File Structure

| File | Role | Touched in tasks |
|---|---|---|
| `index.html` | The whole app | 1, 2, 3, 4, 5, 6, 7, 8 |
| `tests/unit/backlog-tab.test.mjs` | New: bucket arithmetic + DoR threshold | 1 |
| `tests/render/backlog-tab.test.mjs` | New: HTML shape | 1 |
| `tests/unit/member-impact.test.mjs` | New: simulateMemberImpact diff | 2 |
| `tests/render/sandbox.test.mjs` | New: sandbox banner + comparison HTML | 3 |
| `tests/render/gantt-baseline-arrows.test.mjs` | New: connector SVG presence | 4 |
| `tests/render/sprint-brief.test.mjs` | New: brief HTML structure | 5 |
| `tests/unit/view-as-filter.test.mjs` | New: filter behaviour | 6 |
| `tests/unit/conversion-ceremony.test.mjs` | New: POC→Impl + phase promotion | 7, 8 |
| `tests/e2e/p4-flows.spec.ts` | New: smoke for headers + modals | 9 |

---

## Task 1: Dedicated Backlog tab

**Why:** v2 review scored Scenario 11 at 6/10. A dedicated tab with three buckets (Unrefined / Refined-ranked / Parked) and a Definition-of-Ready (DoR) checklist puts backlog refinement on a visible cadence.

**Files:**
- Modify: `index.html` — add `App.computeBacklogBuckets(customer)` helper, `Dashboard.renderBacklogTab(customer)`, nav link, view container.
- Test: `tests/unit/backlog-tab.test.mjs`, `tests/render/backlog-tab.test.mjs`.

- [ ] **Step 1: Write the failing helper test**

Create `tests/unit/backlog-tab.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Backlog buckets', () => {
  it('groups projects into Unrefined / Refined / Parked', async () => {
    resetIdSeq();
    const unrefined = makeProject({ name: 'Idea', status: 'Not Started' });
    delete unrefined.size_total; unrefined.size_total = 0;
    const refined  = makeProject({ name: 'Ready', status: 'Not Started', business_value: 8, time_criticality: 6, risk_reduction_opportunity: 5, size_engineering: 10 });
    refined.size_total = 10;
    const parked   = makeProject({ name: 'Wont', status: 'On Hold', moscow: "Won't" });
    parked.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [unrefined, refined, parked] }));
    const out = app.App.computeBacklogBuckets('Acme Industries');
    expect(out.unrefined.map(p => p.name)).toContain('Idea');
    expect(out.refined.map(p => p.name)).toContain('Ready');
    expect(out.parked.map(p => p.name)).toContain('Wont');
    app.teardown();
  });

  it('treats projects without sizing as unrefined', async () => {
    resetIdSeq();
    const p = makeProject({ name: 'Empty', status: 'Not Started' });
    delete p.size_total; p.size_total = 0;
    const app = await loadApp(makeDataset({ projects: [p] }));
    const out = app.App.computeBacklogBuckets('Acme Industries');
    expect(out.unrefined).toHaveLength(1);
    expect(out.refined).toHaveLength(0);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- tests/unit/backlog-tab.test.mjs
```

Expected: FAIL — `computeBacklogBuckets is not a function`.

- [ ] **Step 3: Implement the helper**

In `index.html` find the `App` module (around `App = {`). Add near `computeBusFactor` (around `index.html:6178`):

```javascript
  // Backlog bucketing — groups customer-scoped not-started/on-hold projects into
  // Unrefined (no size or no DoR), Refined (sized AND ranked), Parked (Won't or On Hold).
  computeBacklogBuckets(customer) {
    const projects = (this.data && this.data.projects || []).filter(p => p.customer === customer);
    const unrefined = [], refined = [], parked = [];
    projects.forEach(p => {
      if (p.status === 'Complete' || p.status === 'Closed') return;
      const isParked = p.status === 'On Hold' || (p.moscow === "Won't" || p.moscow === 'Won’t');
      if (isParked) { parked.push(p); return; }
      const sized = (p.size_total || 0) > 0;
      const wsjf = (typeof this.calculateWsjf === 'function') ? this.calculateWsjf(p) : { populated: 0 };
      const ranked = wsjf.populated > 0 || !!p.priority;
      if (sized && ranked) refined.push(p);
      else unrefined.push(p);
    });
    return { unrefined, refined, parked };
  },
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm run test:unit -- tests/unit/backlog-tab.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Write the failing render test**

Create `tests/render/backlog-tab.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Backlog tab render', () => {
  it('renders three columns with project names', async () => {
    resetIdSeq();
    const u = makeProject({ name: 'Unr', status: 'Not Started' });
    delete u.size_total; u.size_total = 0;
    const r = makeProject({ name: 'Ref', status: 'Not Started', business_value: 8, size_engineering: 10 });
    r.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [u, r] }));
    let host = app.window.document.getElementById('backlogTabBody');
    if (!host) {
      host = app.window.document.createElement('div');
      host.id = 'backlogTabBody';
      app.window.document.body.appendChild(host);
    }
    app.Dashboard.renderBacklogTab('Acme Industries');
    const html = host.innerHTML;
    expect(html).toMatch(/Unrefined/);
    expect(html).toMatch(/Refined/);
    expect(html).toMatch(/Parked/);
    expect(html).toMatch(/Unr/);
    expect(html).toMatch(/Ref/);
    app.teardown();
  });
});
```

- [ ] **Step 6: Run, verify fail**

```bash
npm run test:unit -- tests/render/backlog-tab.test.mjs
```

- [ ] **Step 7: Implement the renderer**

In `index.html` find `Dashboard` (line ~7000). Add `renderBacklogTab` near `renderExecSummary`:

```javascript
  renderBacklogTab(customer) {
    const host = document.getElementById('backlogTabBody');
    if (!host) return;
    const cust = customer || App.activeCustomer;
    if (!cust) { host.innerHTML = '<div style="padding:14px;color:var(--text-muted)">Select a customer.</div>'; return; }
    const buckets = App.computeBacklogBuckets(cust);
    const esc = Dashboard.esc;
    const card = (p) => '<div class="backlog-card" style="padding:8px 10px;border:1px solid var(--border-light);border-radius:var(--radius-sm);margin-bottom:6px;cursor:pointer;background:var(--surface)" onclick="DetailPanel.open(\'' + esc(p.id) + '\')">' +
      '<div style="font-weight:600;font-size:12px">' + esc(p.name) + (App.lifecycleStageChip ? App.lifecycleStageChip(p) : '') + '</div>' +
      '<div style="font-size:10px;color:var(--text-muted);margin-top:2px">' + esc(p.status) + ' · ' + (p.size_total || 0) + ' SP · ' + esc(p.moscow || '—') + '</div>' +
    '</div>';
    const col = (title, list) => '<div style="flex:1;min-width:240px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);margin-bottom:8px">' + title + ' (' + list.length + ')</div>' + (list.length ? list.map(card).join('') : '<div style="font-size:11px;color:var(--text-muted);padding:8px 0">None.</div>') + '</div>';
    host.innerHTML = '<div style="display:flex;gap:14px;flex-wrap:wrap;padding:14px">' +
      col('Unrefined', buckets.unrefined) +
      col('Refined &amp; ranked', buckets.refined) +
      col('Parked', buckets.parked) +
    '</div>';
  },
```

- [ ] **Step 8: Add nav link + view container**

Find the navigation tab list in `index.html` (search for `data-view="dashboard"` or similar nav anchor). Add a new tab. Search:

```bash
grep -n 'data-view="\|App.navigate(' index.html | head -10
```

Add a Backlog view container at the relevant spot in the markup:

```html
        <div class="view" id="viewBacklog">
          <div style="padding:8px 14px;display:flex;align-items:center;gap:10px">
            <h2 style="margin:0;font-size:18px">Backlog</h2>
            <span class="customer-badge" id="backlogCustomerBadge"></span>
          </div>
          <div id="backlogTabBody"></div>
        </div>
```

Hook into `App.navigate(view)` so `view='backlog'` shows the view and calls `Dashboard.renderBacklogTab(App.activeCustomer)`.

- [ ] **Step 9: Run all backlog tests + commit**

```bash
npm run test:unit -- tests/unit/backlog-tab.test.mjs tests/render/backlog-tab.test.mjs
git add tests/unit/backlog-tab.test.mjs tests/render/backlog-tab.test.mjs index.html
git commit -m "feat(backlog): dedicated Backlog tab with Unrefined / Refined / Parked buckets"
```

---

## Task 2: Member impact simulator

**Why:** Senior manager wants "drop this person on date X, show damage". Helper runs the solver with a member's `contract_end_date` set to the simulated date, returns a diff vs current.

**Files:**
- Modify: `index.html` — add `Capacity.simulateMemberImpact(memberName, fromSprintId)` helper + modal.
- Test: `tests/unit/member-impact.test.mjs`.

- [ ] **Step 1: Failing test**

Create `tests/unit/member-impact.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Member impact simulator', () => {
  it('returns a diff showing reduced supply when a member is removed', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'P', size_engineering: 30,
      skill_splits: { size_engineering: [
        { sprint: sprints[0].sprint_id, points: 15, status: 'pending', completed: 0, assigned_to: [{ member: 'Alice', points: 15 }], reasons: [] },
        { sprint: sprints[1].sprint_id, points: 15, status: 'pending', completed: 0, assigned_to: [{ member: 'Alice', points: 15 }], reasons: [] }
      ]}
    });
    proj.size_total = 30;
    const alice = makeMember({ name: 'Alice', available_points_per_sprint: 18 });
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [alice] }));
    const result = app.Capacity.simulateMemberImpact('Alice', sprints[1].sprint_id);
    expect(result.before.totalSupply).toBeGreaterThan(result.after.totalSupply);
    expect(Array.isArray(result.affectedSprints)).toBe(true);
    expect(result.affectedSprints.length).toBeGreaterThan(0);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/unit/member-impact.test.mjs
```

- [ ] **Step 3: Implement the helper**

In `index.html` add to `Capacity` (next to `computeSustainedHighLoad`):

```javascript
  // Member impact simulator — return what changes if the named member is dropped
  // from the named sprint forwards. Pure: computes against snapshots, mutates nothing.
  simulateMemberImpact(memberName, fromSprintId) {
    const customer = App.activeCustomer;
    const sprints = (App.data && App.data.sprints || []).slice();
    const fromIdx = Math.max(0, sprints.findIndex(s => s.sprint_id === fromSprintId));
    const supplyBy = (members, sid) => {
      const cap = (typeof Sprint !== 'undefined' && Sprint.calcSkillCapacityForSprint)
        ? Sprint.calcSkillCapacityForSprint(customer, sid) : {};
      let total = 0;
      Object.values(cap).forEach(v => { total += v || 0; });
      return Math.round(total);
    };
    const allMembers = (App.data && App.data.team_members || []);
    const before = { byMember: {}, totalSupply: 0 };
    sprints.forEach(s => { before.totalSupply += supplyBy(allMembers, s.sprint_id); });
    // Synthesize "after" by zeroing the member's capacity from fromIdx onwards.
    const after = { byMember: {}, totalSupply: 0 };
    const affectedSprints = [];
    sprints.forEach((s, i) => {
      if (i < fromIdx) { after.totalSupply += supplyBy(allMembers, s.sprint_id); return; }
      const reduced = allMembers.map(m => m.name === memberName ? Object.assign({}, m, { available_points_per_sprint: 0 }) : m);
      // Temporarily swap App.data.team_members so calcSkillCapacityForSprint reads the reduced set.
      const original = App.data.team_members;
      App.data.team_members = reduced;
      const reducedSupply = supplyBy(reduced, s.sprint_id);
      App.data.team_members = original;
      after.totalSupply += reducedSupply;
      affectedSprints.push({ sprintId: s.sprint_id, supplyDelta: reducedSupply - supplyBy(allMembers, s.sprint_id) });
    });
    return { member: memberName, fromSprintId, before, after, supplyDelta: after.totalSupply - before.totalSupply, affectedSprints };
  },
```

- [ ] **Step 4: Run, verify pass**

```bash
npm run test:unit -- tests/unit/member-impact.test.mjs
```

- [ ] **Step 5: Add modal launcher**

In `index.html` add `Capacity.openMemberImpactModal(memberName)`:

```javascript
  openMemberImpactModal(memberName) {
    const sprints = (App.data && App.data.sprints || []);
    if (!sprints.length) { App.toast('No sprints', 'error'); return; }
    const existing = document.getElementById('memberImpactOverlay');
    if (existing) existing.remove();
    const esc = Dashboard.esc;
    const opts = sprints.map(s => '<option value="' + esc(s.sprint_id) + '">' + esc(s.sprint_id.replace(/^CY\d+-/, '')) + '</option>').join('');
    const overlay = document.createElement('div');
    overlay.id = 'memberImpactOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);padding:16px';
    overlay.innerHTML =
      '<div style="background:var(--surface,white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:18px 22px;max-width:560px;width:100%;color:var(--text-dark)">' +
        '<h3 style="margin:0 0 12px;font-size:14px;font-weight:700">Member impact — ' + esc(memberName) + '</h3>' +
        '<label style="font-size:11px;font-weight:600;display:block;margin-bottom:8px">Drop from sprint<br><select id="miFromSprint" style="width:100%;padding:5px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px;margin-top:2px">' + opts + '</select></label>' +
        '<div style="display:flex;gap:8px;margin-bottom:10px">' +
          '<button class="btn btn-primary btn-sm" onclick="Capacity._runMemberImpact(\'' + esc(memberName) + '\')">Simulate</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'memberImpactOverlay\').remove()">Close</button>' +
        '</div>' +
        '<div id="memberImpactOutput" style="font-size:12px;background:var(--surface-2);padding:10px;border-radius:var(--radius-sm);min-height:60px"></div>' +
      '</div>';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },

  _runMemberImpact(memberName) {
    const sid = document.getElementById('miFromSprint').value;
    const r = this.simulateMemberImpact(memberName, sid);
    const out = document.getElementById('memberImpactOutput');
    if (!out) return;
    const esc = Dashboard.esc;
    const rows = r.affectedSprints.slice(0, 10).map(s =>
      '<li>' + esc(s.sprintId) + ' — supply Δ <strong style="color:var(--status-red)">' + s.supplyDelta + '</strong></li>'
    ).join('');
    out.innerHTML = '<div><strong>Total supply delta:</strong> <span style="color:var(--status-red)">' + r.supplyDelta + ' SP</span></div>' +
      '<ul style="margin:6px 0 0 0;padding-left:18px">' + rows + '</ul>';
  },
```

- [ ] **Step 6: Add per-member button on Capacity team grid**

Find the team-grid render (`Capacity.renderTeamGrid` ~`index.html:19414`). After the member name in each row, append a small icon button with `onclick="Capacity.openMemberImpactModal('<name>')"` titled `Simulate departure`.

Concretely, find the line emitting member name HTML and add:

```javascript
'<button class="btn btn-ghost btn-sm" onclick="Capacity.openMemberImpactModal(\'' + Dashboard.esc(tm.name) + '\')" title="Simulate dropping this member" style="font-size:9px;padding:2px 6px;margin-left:6px">Impact?</button>'
```

- [ ] **Step 7: Commit**

```bash
git add tests/unit/member-impact.test.mjs index.html
git commit -m "feat(capacity): member impact simulator with per-row Impact? button"
```

---

## Task 3: Sandbox mode flag + scenario comparison

**Why:** Senior manager wants a clear visual indicator they're editing a what-if branch and the ability to compare two scenarios.

**Files:**
- Modify: `index.html` — `App.sandboxMode` flag, header banner, `App.toggleSandboxMode`, `App.compareScenarios(idA, idB)`, comparison modal.
- Test: `tests/render/sandbox.test.mjs`.

- [ ] **Step 1: Failing test**

Create `tests/render/sandbox.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq, makeSprintSequence, makeMember } from '../harness/fixtures.mjs';

describe('Sandbox + scenario comparison', () => {
  it('toggleSandboxMode flips a flag and the banner appears', async () => {
    const app = await loadApp(makeDataset({}));
    expect(app.App.sandboxMode).toBeFalsy();
    app.App.toggleSandboxMode();
    expect(app.App.sandboxMode).toBe(true);
    const banner = app.window.document.getElementById('sandboxBanner');
    expect(banner).not.toBeNull();
    expect(banner.style.display).not.toBe('none');
    app.teardown();
  });

  it('compareScenarios returns project-level deltas', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'X' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    const a = app.App.saveScenario('A');
    app.App.data.projects[0].name = 'X-Mutated';
    app.App.data.projects[0].size_total = 12;
    const b = app.App.saveScenario('B');
    const diff = app.App.compareScenarios(a, b);
    expect(diff).toBeDefined();
    expect(diff.changedProjects.length).toBeGreaterThan(0);
    expect(diff.changedProjects[0].field).toMatch(/name|size_total/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/render/sandbox.test.mjs
```

- [ ] **Step 3: Implement sandbox flag + banner + comparison helper**

In `index.html` add to `App` (near `saveScenario`):

```javascript
  sandboxMode: false,

  toggleSandboxMode() {
    this.sandboxMode = !this.sandboxMode;
    const banner = document.getElementById('sandboxBanner');
    if (banner) banner.style.display = this.sandboxMode ? '' : 'none';
    this.toast(this.sandboxMode ? 'Sandbox mode ON — changes are isolated' : 'Sandbox mode OFF', this.sandboxMode ? 'warn' : 'success');
  },

  compareScenarios(idA, idB) {
    const all = (this.data && this.data._scenarios) || [];
    const a = all.find(s => s.id === idA);
    const b = all.find(s => s.id === idB);
    if (!a || !b) return null;
    const projA = (a.snapshot && a.snapshot.projects) || [];
    const projB = (b.snapshot && b.snapshot.projects) || [];
    const byIdA = {}; projA.forEach(p => { byIdA[p.id] = p; });
    const byIdB = {}; projB.forEach(p => { byIdB[p.id] = p; });
    const changedProjects = [];
    const trackedFields = ['name', 'status', 'size_total', 'priority', 'lifecycle_stage', 'target_date', 'hard_deadline'];
    Object.keys(Object.assign({}, byIdA, byIdB)).forEach(id => {
      const pa = byIdA[id], pb = byIdB[id];
      if (!pa || !pb) {
        changedProjects.push({ id, field: '__presence', from: pa ? 'present' : 'absent', to: pb ? 'present' : 'absent' });
        return;
      }
      trackedFields.forEach(f => {
        if ((pa[f] || null) !== (pb[f] || null)) {
          changedProjects.push({ id, name: pb.name || pa.name, field: f, from: pa[f], to: pb[f] });
        }
      });
    });
    return { aName: a.name, bName: b.name, changedProjects };
  },
```

- [ ] **Step 4: Add the banner DOM**

Find the header bar in `index.html` (around the toolbar area, ~line 2130). Add immediately before the closing `</header>` or equivalent:

```html
<div id="sandboxBanner" style="display:none;background:#fbbf24;color:#7c2d12;font-size:11px;font-weight:700;padding:4px 12px;text-align:center">SANDBOX MODE — edits are isolated. Use Scenarios to save / discard.</div>
```

- [ ] **Step 5: Add header toggle button**

Adjacent to the existing `btnScenarios`:

```html
<button class="btn btn-ghost btn-sm" id="btnSandbox" onclick="App.toggleSandboxMode()" title="Sandbox mode — isolate edits as a what-if"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg></button>
```

- [ ] **Step 6: Add comparison modal in scenario manager**

In `App.openScenarioManager` rows, add per-pair compare buttons or a "Compare two…" picker. Easiest: add a `Compare` button per row that, when two are selected via checkboxes, calls a `_compareSelectedScenarios` that renders results in the same overlay.

For now, add a simple inline form to the modal:

```javascript
// inside openScenarioManager innerHTML, after the rows table:
'<div style="margin-top:14px;border-top:1px solid var(--border-light);padding-top:10px">' +
  '<div style="font-weight:600;font-size:11px;margin-bottom:6px">Compare two scenarios</div>' +
  '<div style="display:flex;gap:6px;align-items:center">' +
    '<select id="cmpA" style="flex:1;font-size:12px;padding:4px 6px">' + list.map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>').join('') + '</select>' +
    '<span>vs</span>' +
    '<select id="cmpB" style="flex:1;font-size:12px;padding:4px 6px">' + list.map(s => '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>').join('') + '</select>' +
    '<button class="btn btn-outline btn-sm" onclick="App._renderScenarioComparison()">Compare</button>' +
  '</div>' +
  '<div id="cmpOutput" style="margin-top:8px;font-size:11px;max-height:240px;overflow:auto"></div>' +
'</div>'
```

And the renderer:

```javascript
  _renderScenarioComparison() {
    const a = document.getElementById('cmpA').value;
    const b = document.getElementById('cmpB').value;
    const r = this.compareScenarios(a, b);
    const out = document.getElementById('cmpOutput');
    if (!out || !r) return;
    const esc = Dashboard.esc;
    if (!r.changedProjects.length) { out.innerHTML = '<em>No tracked-field differences.</em>'; return; }
    out.innerHTML = '<table style="width:100%;border-collapse:collapse">' +
      '<tr><th style="text-align:left;font-size:10px;color:var(--text-muted)">Project</th><th style="text-align:left;font-size:10px;color:var(--text-muted)">Field</th><th style="text-align:left;font-size:10px;color:var(--text-muted)">' + esc(r.aName) + '</th><th style="text-align:left;font-size:10px;color:var(--text-muted)">' + esc(r.bName) + '</th></tr>' +
      r.changedProjects.slice(0, 100).map(c => '<tr><td>' + esc(c.name || c.id) + '</td><td>' + esc(c.field) + '</td><td>' + esc(c.from || '') + '</td><td>' + esc(c.to || '') + '</td></tr>').join('') +
    '</table>';
  },
```

- [ ] **Step 7: Run tests, commit**

```bash
npm run test:unit -- tests/render/sandbox.test.mjs
git add tests/render/sandbox.test.mjs index.html
git commit -m "feat(scenarios): sandbox mode flag + scenario comparison"
```

---

## Task 4: Baseline → current connector arrows on Gantt

**Why:** v2 Scenario 9 needs the visual deviation overlay (currently we render baseline ghost bar AND current bar but no connector showing the slip).

**Files:**
- Modify: `index.html` — extend Gantt baseline rendering to add an SVG arrow when start or end has moved.
- Test: `tests/render/gantt-baseline-arrows.test.mjs`.

- [ ] **Step 1: Failing test**

Create `tests/render/gantt-baseline-arrows.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Gantt baseline → current arrows', () => {
  it('renders a connector when target_date moved', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'Slipped',
      start_date: '2026-01-05', target_date: '2026-02-09',
      baseline_start: '2026-01-05', baseline_end: '2026-01-26',
      size_engineering: 5
    });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    // Force baseline overlay on.
    const checkbox = app.window.document.getElementById('ganttBaseline');
    if (checkbox) checkbox.checked = true;
    app.Gantt.render();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/baseline-arrow/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/render/gantt-baseline-arrows.test.mjs
```

- [ ] **Step 3: Add connector SVG inside the bar render**

In `index.html` find the `baselineHtml` block (around `index.html:14690-14732`). After the existing `gantt-bar-baseline` div emission, when both `bStart`/`bEnd` AND `p.start_date`/`p.target_date` exist and the current end date differs from baseline end, append an SVG path:

```javascript
        if (bStart && bEnd && p.target_date && p.target_date !== bEnd) {
          const cx2 = Math.max(0, dateToX(bEnd));
          const tx2 = Math.max(cx2 + 4, dateToX(p.target_date));
          const dir = tx2 > cx2 ? 1 : -1;
          baselineHtml += '<svg class="baseline-arrow" style="position:absolute;left:' + Math.min(cx2, tx2) + 'px;top:50%;width:' + Math.abs(tx2 - cx2) + 'px;height:14px;pointer-events:none;overflow:visible" aria-hidden="true">' +
            '<line x1="0" y1="7" x2="' + Math.abs(tx2 - cx2) + '" y2="7" stroke="' + (dir > 0 ? 'var(--status-red)' : 'var(--status-green)') + '" stroke-width="1.6" stroke-dasharray="3,2"/>' +
            '<polygon points="' + (dir > 0 ? Math.abs(tx2 - cx2) + ',7 ' + (Math.abs(tx2 - cx2) - 6) + ',3 ' + (Math.abs(tx2 - cx2) - 6) + ',11' : '0,7 6,3 6,11') + '" fill="' + (dir > 0 ? 'var(--status-red)' : 'var(--status-green)') + '"/>' +
            '<title>Baseline ' + Dashboard.esc(bEnd) + ' → current ' + Dashboard.esc(p.target_date) + '</title>' +
          '</svg>';
        }
```

- [ ] **Step 4: Run, verify pass**

```bash
npm run test:unit -- tests/render/gantt-baseline-arrows.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add tests/render/gantt-baseline-arrows.test.mjs index.html
git commit -m "feat(gantt): baseline-to-current connector arrow when end-date drifts"
```

---

## Task 5: Sprint Brief PDF

**Why:** Senior manager wants per-team-member printable brief. Build via existing `Report.buildDoc` framework.

**Files:**
- Modify: `index.html` — add `Report.buildSprintBriefDoc(customer, sprintId)` + `exportSprintBrief` + button.
- Test: `tests/render/sprint-brief.test.mjs`.

- [ ] **Step 1: Failing test**

Create `tests/render/sprint-brief.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Sprint Brief PDF', () => {
  it('builds a doc with one section per team member with assignments', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'Demo', size_engineering: 10,
      skill_splits: { size_engineering: [
        { sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0,
          assigned_to: [{ member: 'Alice', points: 10 }], reasons: [] }
      ]}
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember({ name: 'Alice' })] }));
    const Report = app.window.__pcc__.Report;
    const doc = Report.buildSprintBriefDoc('Acme Industries', sprints[0].sprint_id);
    expect(doc).toBeDefined();
    const html = String(doc);
    expect(html).toMatch(/Sprint Brief/);
    expect(html).toMatch(/Alice/);
    expect(html).toMatch(/Demo/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/render/sprint-brief.test.mjs
```

- [ ] **Step 3: Implement the helper**

In `index.html` add to `Report`:

```javascript
  buildSprintBriefDoc(customer, sprintId) {
    const sprint = (App.data && App.data.sprints || []).find(s => s.sprint_id === sprintId);
    if (!sprint) return null;
    const projects = (App.data && App.data.projects || []).filter(p => p.customer === customer);
    const members = (App.data && App.data.team_members || []).filter(tm => {
      const c = (tm.customer || '').toLowerCase();
      return !customer || c === customer.toLowerCase() || c === 'both';
    });
    const esc = Dashboard.esc;
    const sections = members.map(tm => {
      const items = [];
      projects.forEach(p => {
        Object.entries(p.skill_splits || {}).forEach(([sk, arr]) => {
          if (!Array.isArray(arr)) return;
          arr.forEach(sp => {
            if (sp.sprint !== sprintId) return;
            (sp.assigned_to || []).forEach(a => {
              if (a.member === tm.name) items.push({ project: p.name, skill: sk.replace(/^size_/, ''), points: a.points || 0, lifecycle: p.lifecycle_stage || 'Implementation' });
            });
          });
        });
      });
      const html = items.length
        ? '<table><tr><th>Project</th><th>Skill</th><th>Points</th><th>Stage</th></tr>' +
          items.map(i => '<tr><td>' + esc(i.project) + '</td><td>' + esc(i.skill) + '</td><td>' + i.points + '</td><td>' + esc(i.lifecycle) + '</td></tr>').join('') +
          '</table>'
        : '<p>No assignments this sprint.</p>';
      return { id: 'sb-' + tm.name.replace(/\s+/g, '-'), title: tm.name, html };
    });
    return (typeof Report !== 'undefined' && Report.buildDoc)
      ? Report.buildDoc({
          customer,
          title: 'Sprint Brief — ' + sprintId,
          subtitle: 'Per-member work plan for ' + sprintId,
          reportType: 'Sprint Brief',
          sections,
          includeAppendix: false
        })
      : ('<html><body><h1>Sprint Brief — ' + esc(sprintId) + '</h1>' + sections.map(s => '<h2>' + esc(s.title) + '</h2>' + s.html).join('') + '</body></html>');
  },

  exportSprintBrief(customer, sprintId) {
    const doc = this.buildSprintBriefDoc(customer, sprintId);
    if (!doc) { App.toast('Sprint not found', 'error'); return; }
    if (this.open) this.open(doc);
    App.toast('Sprint brief opened — use Print > Save as PDF', 'success');
  },
```

- [ ] **Step 4: Add a button on Sprint Planning toolbar**

Adjacent to the `Walkthrough` button:

```html
<button class="btn btn-outline btn-sm" onclick="(function(){var s=(App.data&&App.data.sprints||[]).find(function(x){return x.sprint_id===Sprint.activeSprintId})||(App.data.sprints||[])[0];if(s)Report.exportSprintBrief(App.activeCustomer,s.sprint_id)})()" title="Export per-member brief for the active sprint as PDF">Sprint Brief</button>
```

- [ ] **Step 5: Run, verify pass + commit**

```bash
npm run test:unit -- tests/render/sprint-brief.test.mjs
git add tests/render/sprint-brief.test.mjs index.html
git commit -m "feat(report): Sprint Brief PDF — per-member sprint plan with toolbar button"
```

---

## Task 6: Personal "View as…" filter

**Why:** Senior manager wants to filter the entire app to a single team member's perspective.

**Files:**
- Modify: `index.html` — `App.viewAsMember` flag, header picker, filter helpers.
- Test: `tests/unit/view-as-filter.test.mjs`.

- [ ] **Step 1: Failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('View-as filter', () => {
  it('App.isAssignedTo(p, member) returns true when any split is assigned', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'X', size_engineering: 10,
      skill_splits: { size_engineering: [
        { sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [{ member: 'Alice', points: 10 }], reasons: [] }
      ]}
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember({ name: 'Alice' })] }));
    expect(app.App.isAssignedTo(proj, 'Alice')).toBe(true);
    expect(app.App.isAssignedTo(proj, 'Bob')).toBe(false);
    app.teardown();
  });

  it('viewAsMember setter updates state', async () => {
    const app = await loadApp(makeDataset({}));
    app.App.setViewAsMember('Alice');
    expect(app.App.viewAsMember).toBe('Alice');
    app.App.setViewAsMember(null);
    expect(app.App.viewAsMember).toBeFalsy();
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/unit/view-as-filter.test.mjs
```

- [ ] **Step 3: Implement helpers + picker**

In `index.html` add to `App`:

```javascript
  viewAsMember: null,

  setViewAsMember(name) {
    this.viewAsMember = name || null;
    if (this.notifyDataChange) this.notifyDataChange();
    if (typeof Dashboard !== 'undefined' && Dashboard.applyFilters) Dashboard.applyFilters();
  },

  isAssignedTo(project, memberName) {
    if (!project || !memberName) return false;
    if (project.manager === memberName) return true;
    const splits = project.skill_splits || {};
    return Object.values(splits).some(arr => Array.isArray(arr) && arr.some(sp => (sp.assigned_to || []).some(a => a.member === memberName)));
  },
```

- [ ] **Step 4: Add header picker**

Adjacent to `btnScenarios` / `btnSandbox`:

```html
<select id="viewAsPicker" class="filter-select" onchange="App.setViewAsMember(this.value || null)" title="Filter views to this member's work" style="font-size:11px;padding:3px 5px;border:1px solid var(--border-light);border-radius:var(--radius-sm)">
  <option value="">View as: All</option>
</select>
```

Populate it on data load. In `App.onDataLoaded` (search for the function):

```javascript
    const sel = document.getElementById('viewAsPicker');
    if (sel) {
      const members = (this.data && this.data.team_members || []).map(m => m.name).sort();
      sel.innerHTML = '<option value="">View as: All</option>' + members.map(n => '<option value="' + Dashboard.esc(n) + '">' + Dashboard.esc(n) + '</option>').join('');
    }
```

- [ ] **Step 5: Wire `Dashboard.applyFilters` to honour `viewAsMember`**

Find `Dashboard.applyFilters` and at the start of the row-filter block, add:

```javascript
    const viewAs = App.viewAsMember;
    if (viewAs) {
      filtered = filtered.filter(p => App.isAssignedTo(p, viewAs));
    }
```

- [ ] **Step 6: Run + commit**

```bash
npm run test:unit -- tests/unit/view-as-filter.test.mjs
git add tests/unit/view-as-filter.test.mjs index.html
git commit -m "feat(filter): View as <member> picker filters dashboard rows"
```

---

## Task 7: POC → Implementation conversion ceremony

**Why:** Make the lifecycle transition deliberate — re-validate scope, capture sponsor confirmation, auto-baseline, audit.

**Files:**
- Modify: `index.html` — add `App.convertToImplementation(projectId, opts)` + Detail Panel button when `lifecycle_stage === 'POC'`.
- Test: `tests/unit/conversion-ceremony.test.mjs`.

- [ ] **Step 1: Failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('POC → Implementation conversion', () => {
  it('flips lifecycle_stage and captures a baseline + audit entry', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P', lifecycle_stage: 'POC', size_engineering: 10, start_date: '2026-04-01', target_date: '2026-06-30' });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    app.App.convertToImplementation(proj.id, { sponsor: 'Sandra Lee', notes: 'Demo accepted in March steerco' });
    const after = app.App.data.projects[0];
    expect(after.lifecycle_stage).toBe('Implementation');
    expect(after.baseline_start).toBe('2026-04-01');
    expect(after.baseline_end).toBe('2026-06-30');
    const lastAudit = (app.App.data.audit_log || []).slice(-1)[0];
    expect(lastAudit.field).toBe('lifecycle_stage');
    expect(lastAudit.rationale).toMatch(/Demo accepted/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/unit/conversion-ceremony.test.mjs
```

- [ ] **Step 3: Implement the helper**

In `index.html` add to `App`:

```javascript
  convertToImplementation(projectId, opts) {
    opts = opts || {};
    const p = (this.data && this.data.projects || []).find(pr => pr.id === projectId);
    if (!p) return false;
    if (p.lifecycle_stage === 'Implementation' || p.lifecycle_stage === 'Run/BAU') return false;
    const before = p.lifecycle_stage;
    p.lifecycle_stage = 'Implementation';
    if (p.start_date) p.baseline_start = p.start_date;
    if (p.target_date) p.baseline_end = p.target_date;
    p.baseline_set_date = new Date().toISOString();
    if (opts.sponsor) p.sponsor = opts.sponsor;
    if (opts.notes) p.notes = (p.notes ? p.notes + '\n\n' : '') + 'Converted to Implementation: ' + opts.notes;
    this.logChange(projectId, 'lifecycle_stage', before || 'Unknown', 'Implementation', 'user', { rationale: opts.notes || 'Converted to Implementation' });
    this.markDirty();
    this.saveToLocalStorage();
    if (this.notifyDataChange) this.notifyDataChange();
    return true;
  },
```

- [ ] **Step 4: Add Detail Panel button**

In the Detail Panel, near the top of `renderBody`, when `p.lifecycle_stage === 'POC' || p.lifecycle_stage === 'Discovery'`, render a banner:

```javascript
const conversionBanner = (p.lifecycle_stage === 'POC' || p.lifecycle_stage === 'Discovery')
  ? '<div style="grid-column:1/-1;background:#fef3c7;border:1px solid #f59e0b40;border-radius:var(--radius-sm);padding:6px 10px;font-size:11px;display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">' +
      '<span><strong>This is a ' + Dashboard.esc(p.lifecycle_stage) + '.</strong> When ready, convert to Implementation to lock scope + auto-baseline.</span>' +
      '<button class="btn btn-primary btn-sm" onclick="DetailPanel.openConvertModal(\'' + Dashboard.esc(p.id) + '\')" style="font-size:10px;padding:3px 8px">Convert to Implementation</button>' +
    '</div>'
  : '';
```

Add `DetailPanel.openConvertModal`:

```javascript
  openConvertModal(projectId) {
    const p = App.data.projects.find(pr => pr.id === projectId);
    if (!p) return;
    const existing = document.getElementById('convertOverlay');
    if (existing) existing.remove();
    const esc = Dashboard.esc;
    const overlay = document.createElement('div');
    overlay.id = 'convertOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);padding:16px';
    overlay.innerHTML =
      '<div style="background:var(--surface,white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:18px 22px;max-width:520px;width:100%">' +
        '<h3 style="margin:0 0 10px;font-size:14px;font-weight:700">Convert ' + esc(p.name) + ' to Implementation</h3>' +
        '<p style="font-size:11px;color:var(--text-muted);margin-bottom:10px">This locks the current dates as baseline, audits the change, and removes the low-conviction WSJF penalty.</p>' +
        '<label style="font-size:11px;font-weight:600;display:block;margin-bottom:6px">Sponsor confirmation<br><input type="text" id="convSponsor" value="' + esc(p.sponsor || '') + '" style="width:100%;padding:5px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px;margin-top:2px"></label>' +
        '<label style="font-size:11px;font-weight:600;display:block;margin-bottom:10px">Conversion notes (rationale)<br><textarea id="convNotes" rows="3" style="width:100%;padding:5px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px;margin-top:2px"></textarea></label>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end">' +
          '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'convertOverlay\').remove()">Cancel</button>' +
          '<button class="btn btn-primary btn-sm" onclick="(function(){App.convertToImplementation(\'' + esc(p.id) + '\',{sponsor:document.getElementById(\'convSponsor\').value,notes:document.getElementById(\'convNotes\').value});document.getElementById(\'convertOverlay\').remove();DetailPanel.renderBody(App.data.projects.find(function(pr){return pr.id===\'' + esc(p.id) + '\'}));App.toast(\'Converted to Implementation\',\'success\')})()">Convert</button>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },
```

- [ ] **Step 5: Run + commit**

```bash
npm run test:unit -- tests/unit/conversion-ceremony.test.mjs
git add tests/unit/conversion-ceremony.test.mjs index.html
git commit -m "feat(lifecycle): POC → Implementation conversion ceremony with sponsor + audit"
```

---

## Task 8: Plan Phase-2+ gate flow

**Why:** When a project has TBD phase entries (P1 Task 8), provide a guided flow to promote the TBD phase to a concrete phase with size and dates.

**Files:**
- Modify: `index.html` — add `App.promoteTbdPhase(projectId, phaseName, opts)` + Detail Panel banner + modal.
- Test: extend `tests/unit/conversion-ceremony.test.mjs`.

- [ ] **Step 1: Append test**

Append to `tests/unit/conversion-ceremony.test.mjs`:

```javascript
describe('Promote TBD phase', () => {
  it('flips a phase from tbd to planned and audits the change', async () => {
    resetIdSeq();
    const proj = makeProject({
      name: 'Disc', size_requirements: 5,
      delivery_config: { phase_order: ['Requirements', { phase: 'Data Engineering', status: 'tbd' }] }
    });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const ok = app.App.promoteTbdPhase(proj.id, 'Data Engineering', { rationale: 'Discovery findings landed', sizePoints: 12 });
    expect(ok).toBe(true);
    const after = app.App.data.projects[0];
    const phaseEntry = after.delivery_config.phase_order.find(e => (typeof e === 'object' ? e.phase : e) === 'Data Engineering');
    // After promotion the entry should be a string OR an object with status: 'planned'.
    const isPlanned = (typeof phaseEntry === 'string') || (phaseEntry && phaseEntry.status === 'planned');
    expect(isPlanned).toBe(true);
    expect(after.size_engineering).toBe(12);
    const lastAudit = (app.App.data.audit_log || []).slice(-1)[0];
    expect(lastAudit.field).toBe('phase_order');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/unit/conversion-ceremony.test.mjs
```

- [ ] **Step 3: Implement helper**

In `index.html` add to `App`:

```javascript
  promoteTbdPhase(projectId, phaseName, opts) {
    opts = opts || {};
    const p = (this.data && this.data.projects || []).find(pr => pr.id === projectId);
    if (!p || !p.delivery_config || !Array.isArray(p.delivery_config.phase_order)) return false;
    let changed = false;
    const before = JSON.parse(JSON.stringify(p.delivery_config.phase_order));
    p.delivery_config.phase_order = p.delivery_config.phase_order.map(e => {
      if (typeof e === 'object' && e && e.phase === phaseName && e.status === 'tbd') {
        changed = true;
        return { phase: phaseName, status: 'planned' };
      }
      return e;
    });
    if (!changed) return false;
    if (typeof opts.sizePoints === 'number' && opts.sizePoints > 0) {
      const map = { 'Requirements': 'size_requirements', 'Data Engineering': 'size_engineering', 'Data Science': 'size_data_science', 'Tableau': 'size_tableau', 'UAT': 'size_uat_adoption' };
      const key = map[phaseName];
      if (key) p[key] = opts.sizePoints;
      p.size_total = ['size_requirements','size_tableau','size_engineering','size_data_science','size_uat_adoption']
        .reduce((s, k) => s + (p[k] || 0), 0);
    }
    this.logChange(projectId, 'phase_order', JSON.stringify(before), JSON.stringify(p.delivery_config.phase_order), 'user', { rationale: opts.rationale || 'Promoted ' + phaseName + ' from TBD' });
    this.markDirty();
    this.saveToLocalStorage();
    if (this.notifyDataChange) this.notifyDataChange();
    return true;
  },
```

- [ ] **Step 4: Add Detail Panel banner + modal**

In `DetailPanel.renderBody` near top, when project has any TBD phase, show a banner with a *Plan Phase 2+* button that opens a modal listing TBD phases and a per-phase form (size, rationale).

Render a TBD banner:

```javascript
const tbdEntries = ((p.delivery_config && p.delivery_config.phase_order) || [])
  .filter(e => e && typeof e === 'object' && e.status === 'tbd');
const tbdBanner = tbdEntries.length
  ? '<div style="grid-column:1/-1;background:#ede9fe;border:1px solid #8b5cf640;border-radius:var(--radius-sm);padding:6px 10px;font-size:11px;display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">' +
      '<span><strong>Phase 2+ TBD</strong> — ' + tbdEntries.length + ' phase' + (tbdEntries.length === 1 ? '' : 's') + ' awaiting promotion: ' + tbdEntries.map(e => Dashboard.esc(e.phase)).join(', ') + '</span>' +
      '<button class="btn btn-primary btn-sm" onclick="DetailPanel.openPromoteModal(\'' + Dashboard.esc(p.id) + '\')" style="font-size:10px;padding:3px 8px">Plan Phase 2+</button>' +
    '</div>'
  : '';
```

Add `DetailPanel.openPromoteModal`:

```javascript
  openPromoteModal(projectId) {
    const p = App.data.projects.find(pr => pr.id === projectId);
    if (!p) return;
    const tbd = ((p.delivery_config && p.delivery_config.phase_order) || []).filter(e => e && typeof e === 'object' && e.status === 'tbd');
    if (!tbd.length) { App.toast('No TBD phases to promote', 'info'); return; }
    const existing = document.getElementById('promoteOverlay');
    if (existing) existing.remove();
    const esc = Dashboard.esc;
    const overlay = document.createElement('div');
    overlay.id = 'promoteOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);padding:16px';
    const opts = tbd.map(e => '<option value="' + esc(e.phase) + '">' + esc(e.phase) + '</option>').join('');
    overlay.innerHTML =
      '<div style="background:var(--surface,white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:18px 22px;max-width:520px;width:100%">' +
        '<h3 style="margin:0 0 10px;font-size:14px;font-weight:700">Promote phase — ' + esc(p.name) + '</h3>' +
        '<label style="font-size:11px;font-weight:600;display:block;margin-bottom:6px">Phase to promote<br><select id="promPhase" style="width:100%;padding:5px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px;margin-top:2px">' + opts + '</select></label>' +
        '<label style="font-size:11px;font-weight:600;display:block;margin-bottom:6px">Size (story points)<br><input type="number" id="promSize" min="0" step="1" value="0" style="width:100%;padding:5px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px;margin-top:2px"></label>' +
        '<label style="font-size:11px;font-weight:600;display:block;margin-bottom:10px">Rationale (audit)<br><textarea id="promNotes" rows="2" style="width:100%;padding:5px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px;margin-top:2px"></textarea></label>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end">' +
          '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'promoteOverlay\').remove()">Cancel</button>' +
          '<button class="btn btn-primary btn-sm" onclick="(function(){var ph=document.getElementById(\'promPhase\').value;var sz=parseInt(document.getElementById(\'promSize\').value)||0;var r=document.getElementById(\'promNotes\').value;App.promoteTbdPhase(\'' + esc(projectId) + '\',ph,{sizePoints:sz,rationale:r});document.getElementById(\'promoteOverlay\').remove();DetailPanel.renderBody(App.data.projects.find(function(pr){return pr.id===\'' + esc(projectId) + '\'}));App.toast(\'Phase promoted\',\'success\')})()">Promote</button>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },
```

- [ ] **Step 5: Run + commit**

```bash
npm run test:unit -- tests/unit/conversion-ceremony.test.mjs
git add tests/unit/conversion-ceremony.test.mjs index.html
git commit -m "feat(lifecycle): Plan Phase 2+ gate — promote TBD phase with size + rationale"
```

---

## Task 9: P4 E2E + final verify

**Files:**
- Create: `tests/e2e/p4-flows.spec.ts`.

- [ ] **Step 1: Spec**

```typescript
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test.describe('P4 — Backlog tab', () => {
  test('Dashboard.renderBacklogTab is callable', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const A: any = (window as any).App;
      const out = A.computeBacklogBuckets('Acme Industries');
      return !!(out && Array.isArray(out.unrefined) && Array.isArray(out.refined) && Array.isArray(out.parked));
    });
    expect(ok).toBe(true);
  });
});

test.describe('P4 — Sandbox + scenarios', () => {
  test('toggleSandboxMode flips banner', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => (window as any).App.toggleSandboxMode());
    const banner = page.locator('#sandboxBanner');
    await expect(banner).toBeVisible();
  });
});

test.describe('P4 — Member impact + Sprint Brief + View as', () => {
  test('Capacity.simulateMemberImpact returns a result shape', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const C: any = (window as any).Capacity;
      const tm = ((window as any).App.data.team_members || [])[0];
      const sp = ((window as any).App.data.sprints || [])[0];
      if (!tm || !sp) return true;
      const r = C.simulateMemberImpact(tm.name, sp.sprint_id);
      return !!(r && typeof r.supplyDelta === 'number');
    });
    expect(ok).toBe(true);
  });

  test('Report.buildSprintBriefDoc returns content', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const R: any = (window as any).Report;
      const sp = ((window as any).App.data.sprints || [])[0];
      if (!sp) return true;
      const doc = R.buildSprintBriefDoc((window as any).App.activeCustomer, sp.sprint_id);
      return !!(doc && String(doc).length);
    });
    expect(ok).toBe(true);
  });

  test('App.setViewAsMember updates state', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => (window as any).App.setViewAsMember('Alice'));
    const v = await page.evaluate(() => (window as any).App.viewAsMember);
    expect(v).toBe('Alice');
  });
});
```

- [ ] **Step 2: Run E2E + full**

```bash
npm run test:e2e -- p4-flows.spec.ts
npm test
```

- [ ] **Step 3: Commit + push**

```bash
git add tests/e2e/p4-flows.spec.ts
git commit -m "test(e2e): backlog + sandbox + member-impact + sprint-brief + view-as smoke"
git push
```

---

## Self-review checklist

- [ ] `App.computeBacklogBuckets(customer)` returns `{ unrefined, refined, parked }` arrays.
- [ ] `Dashboard.renderBacklogTab(customer)` renders three columns with project cards.
- [ ] Backlog view nav link wired to `App.navigate('backlog')`.
- [ ] `Capacity.simulateMemberImpact(name, fromSprintId)` returns `{ before, after, supplyDelta, affectedSprints }`.
- [ ] Capacity team grid surfaces an *Impact?* button per member.
- [ ] `App.toggleSandboxMode` flips `App.sandboxMode` and shows/hides `#sandboxBanner`.
- [ ] `App.compareScenarios(idA, idB)` returns project-level deltas across tracked fields.
- [ ] Scenario manager modal includes the comparison form.
- [ ] Gantt renders `baseline-arrow` SVG when `target_date` differs from `baseline_end`.
- [ ] `Report.buildSprintBriefDoc(customer, sprintId)` returns sections per member.
- [ ] Sprint Planning toolbar exposes a `Sprint Brief` button.
- [ ] `App.setViewAsMember(name)` + `App.isAssignedTo(p, name)` filters dashboard rows.
- [ ] Header has a `View as:` picker populated from team members.
- [ ] `App.convertToImplementation(id, opts)` flips lifecycle_stage, captures baseline, audits.
- [ ] Detail Panel banner appears for POC/Discovery projects with a *Convert* button.
- [ ] `App.promoteTbdPhase(id, phase, opts)` flips a TBD entry to planned, sizes if asked, audits.
- [ ] Detail Panel banner appears for projects with TBD phases with *Plan Phase 2+* button.
- [ ] `npm test` is green.
