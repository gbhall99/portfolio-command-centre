# Walkthrough Data-Update Ritual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the weekly walkthrough the single ritual that brings every project's RAG, completed SP, status, and risk register up to date — not just a governance log.

**Architecture:** Five pure helpers on `App` mutate project / risk / split state and write `source: 'walkthrough'` audit entries. Each call also pushes a typed entry into `walkthroughs[i].data_updates[]`. Inline editors in `Sprint.openWalkthrough` per section call those helpers. Minutes get a new "Data updates" section.

**Tech Stack:** Plain JS (zero build), inline SVG, `vitest` 2.1, `@playwright/test` 1.48, `jsdom` 25.

**Spec:** `docs/superpowers/specs/2026-04-27-walkthrough-data-updates-design.md`

---

## File Structure

| File | Role |
|---|---|
| `index.html` | All app code |
| `tests/unit/walkthrough-data-updates.test.mjs` | Helpers (RAG, risk, status, chip) |
| `tests/render/walkthrough.test.mjs` | Extend — assert inline editors render |
| `tests/unit/walkthrough-minutes.test.mjs` | Extend — assert "Data updates" section |
| `tests/e2e/walkthrough.spec.ts` | Extend — full data-update flow |

---

## Task 1: `App.updateProjectRag` helper

**Files:**
- Modify: `index.html` — add helper near the existing walkthrough helpers (after `setWalkthroughSectionNote`).
- Test: `tests/unit/walkthrough-data-updates.test.mjs` (create).

- [ ] **Step 1: Failing test**

Create `tests/unit/walkthrough-data-updates.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.updateProjectRag', () => {
  it('updates the project RAG, audit-logs with walkthrough source, records data_update', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P', rag_schedule: 'Green' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const wid = app.App.startWalkthrough('GCC', []);
    app.App.updateProjectRag(proj.id, 'schedule', 'Red', wid, 'Sponsor escalation');
    const after = app.App.data.projects[0];
    expect(after.rag_schedule).toBe('Red');
    const audit = app.App.data.audit_log.slice(-1)[0];
    expect(audit.field).toBe('rag_schedule');
    expect(audit.source).toBe('walkthrough');
    expect(audit.rationale).toBe('Sponsor escalation');
    const wt = app.App.data.walkthroughs[0];
    expect(wt.data_updates).toHaveLength(1);
    expect(wt.data_updates[0]).toMatchObject({ kind: 'rag', project_id: proj.id, dimension: 'schedule', from: 'Green', to: 'Red' });
    app.teardown();
  });

  it('rejects invalid dimensions', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const wid = app.App.startWalkthrough('GCC', []);
    expect(app.App.updateProjectRag(proj.id, 'bogus', 'Red', wid, '')).toBe(false);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/unit/walkthrough-data-updates.test.mjs
```

Expected: FAIL — `updateProjectRag is not a function`.

- [ ] **Step 3: Implement**

In `index.html` find `setWalkthroughSectionNote` (search for that name). Immediately after the closing `},` of that helper, insert:

```javascript
  _walkthroughLogUpdate(walkthroughId, entry) {
    const wt = this._findWalkthrough(walkthroughId);
    if (!wt) return;
    if (!Array.isArray(wt.data_updates)) wt.data_updates = [];
    wt.data_updates.push(Object.assign({ recorded_at: new Date().toISOString() }, entry));
  },

  updateProjectRag(projectId, dimension, value, walkthroughId, rationale) {
    if (['schedule', 'resourcing', 'scope'].indexOf(dimension) < 0) return false;
    if (['Red', 'Amber', 'Green'].indexOf(value) < 0) return false;
    const p = (this.data && this.data.projects || []).find(pr => pr.id === projectId);
    if (!p) return false;
    const field = 'rag_' + dimension;
    const before = p[field] || null;
    if (before === value) return true;
    p[field] = value;
    p.last_updated = new Date().toISOString();
    if (typeof this.logChange === 'function') {
      this.logChange(projectId, field, before || '', value, 'walkthrough', { rationale: rationale || '' });
    }
    if (walkthroughId) this._walkthroughLogUpdate(walkthroughId, { kind: 'rag', project_id: projectId, dimension, from: before, to: value, rationale: rationale || '' });
    this.markDirty();
    this.saveToLocalStorage();
    return true;
  },
```

- [ ] **Step 4: Run, verify pass**

```bash
npm run test:unit -- tests/unit/walkthrough-data-updates.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/walkthrough-data-updates.test.mjs index.html
git commit -m "feat(walkthrough): updateProjectRag helper — RAG flips with audit + data_updates"
```

---

## Task 2: `App.updateProjectStatus` helper

**Files:**
- Modify: `index.html` — add helper next to `updateProjectRag`.
- Test: extend `tests/unit/walkthrough-data-updates.test.mjs`.

- [ ] **Step 1: Append test**

```javascript
describe('App.updateProjectStatus', () => {
  it('updates the project status with audit + data_update', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P', status: 'In Progress' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const wid = app.App.startWalkthrough('GCC', []);
    app.App.updateProjectStatus(proj.id, 'Blocked', wid, 'Dep slipped');
    expect(app.App.data.projects[0].status).toBe('Blocked');
    const audit = app.App.data.audit_log.slice(-1)[0];
    expect(audit.field).toBe('status');
    expect(audit.source).toBe('walkthrough');
    const wt = app.App.data.walkthroughs[0];
    expect(wt.data_updates[0]).toMatchObject({ kind: 'status', project_id: proj.id, from: 'In Progress', to: 'Blocked' });
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/unit/walkthrough-data-updates.test.mjs
```

- [ ] **Step 3: Implement**

In `index.html` after `updateProjectRag`:

```javascript
  updateProjectStatus(projectId, newStatus, walkthroughId, rationale) {
    const p = (this.data && this.data.projects || []).find(pr => pr.id === projectId);
    if (!p) return false;
    const before = p.status || '';
    if (before === newStatus) return true;
    p.status = newStatus;
    p.last_updated = new Date().toISOString();
    if (typeof this.logChange === 'function') {
      this.logChange(projectId, 'status', before, newStatus, 'walkthrough', { rationale: rationale || '' });
    }
    if (walkthroughId) this._walkthroughLogUpdate(walkthroughId, { kind: 'status', project_id: projectId, from: before, to: newStatus, rationale: rationale || '' });
    this.markDirty();
    this.saveToLocalStorage();
    return true;
  },
```

- [ ] **Step 4: Run, verify pass**

```bash
npm run test:unit -- tests/unit/walkthrough-data-updates.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/walkthrough-data-updates.test.mjs index.html
git commit -m "feat(walkthrough): updateProjectStatus helper"
```

---

## Task 3: `App.updateRiskStatus` + `updateRiskScore` helpers

**Files:**
- Modify: `index.html` — add after `updateProjectStatus`.
- Test: extend `tests/unit/walkthrough-data-updates.test.mjs`.

- [ ] **Step 1: Append tests**

```javascript
describe('App.updateRiskStatus / updateRiskScore', () => {
  it('closes a risk with audit + data_update', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P' });
    proj.risks_register = [{ description: 'R1', impact: 4, probability: 3, status: 'open' }];
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const wid = app.App.startWalkthrough('GCC', []);
    app.App.updateRiskStatus(proj.id, 0, 'closed', wid, 'Mitigation landed');
    expect(app.App.data.projects[0].risks_register[0].status).toBe('closed');
    const wt = app.App.data.walkthroughs[0];
    expect(wt.data_updates[0]).toMatchObject({ kind: 'risk_status', project_id: proj.id, risk_index: 0, from: 'open', to: 'closed' });
    app.teardown();
  });

  it('rescores a risk', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P' });
    proj.risks_register = [{ description: 'R1', impact: 4, probability: 3, status: 'open' }];
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const wid = app.App.startWalkthrough('GCC', []);
    app.App.updateRiskScore(proj.id, 0, 5, 5, wid);
    expect(app.App.data.projects[0].risks_register[0].impact).toBe(5);
    expect(app.App.data.projects[0].risks_register[0].probability).toBe(5);
    const wt = app.App.data.walkthroughs[0];
    expect(wt.data_updates[0].kind).toBe('risk_score');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/unit/walkthrough-data-updates.test.mjs
```

- [ ] **Step 3: Implement**

In `index.html` after `updateProjectStatus`:

```javascript
  updateRiskStatus(projectId, riskIndex, newStatus, walkthroughId, rationale) {
    if (['open', 'closed', 'accepted'].indexOf(newStatus) < 0) return false;
    const p = (this.data && this.data.projects || []).find(pr => pr.id === projectId);
    if (!p || !Array.isArray(p.risks_register)) return false;
    const r = p.risks_register[riskIndex];
    if (!r) return false;
    const before = r.status || 'open';
    if (before === newStatus) return true;
    r.status = newStatus;
    p.last_updated = new Date().toISOString();
    if (typeof this.logChange === 'function') {
      this.logChange(projectId, 'risk_status:' + riskIndex, before, newStatus, 'walkthrough', { rationale: rationale || '' });
    }
    if (walkthroughId) this._walkthroughLogUpdate(walkthroughId, { kind: 'risk_status', project_id: projectId, risk_index: riskIndex, description: r.description || '', from: before, to: newStatus, rationale: rationale || '' });
    this.markDirty();
    this.saveToLocalStorage();
    return true;
  },

  updateRiskScore(projectId, riskIndex, impact, probability, walkthroughId) {
    const i = parseInt(impact, 10), pr = parseInt(probability, 10);
    if (!(i >= 1 && i <= 5) || !(pr >= 1 && pr <= 5)) return false;
    const proj = (this.data && this.data.projects || []).find(p => p.id === projectId);
    if (!proj || !Array.isArray(proj.risks_register)) return false;
    const r = proj.risks_register[riskIndex];
    if (!r) return false;
    const beforeI = r.impact, beforeP = r.probability;
    r.impact = i;
    r.probability = pr;
    proj.last_updated = new Date().toISOString();
    if (typeof this.logChange === 'function') {
      this.logChange(projectId, 'risk_score:' + riskIndex, beforeI + '×' + beforeP, i + '×' + pr, 'walkthrough');
    }
    if (walkthroughId) this._walkthroughLogUpdate(walkthroughId, { kind: 'risk_score', project_id: projectId, risk_index: riskIndex, description: r.description || '', from: { impact: beforeI, probability: beforeP }, to: { impact: i, probability: pr } });
    this.markDirty();
    this.saveToLocalStorage();
    return true;
  },
```

- [ ] **Step 4: Run, verify pass**

```bash
npm run test:unit -- tests/unit/walkthrough-data-updates.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/walkthrough-data-updates.test.mjs index.html
git commit -m "feat(walkthrough): updateRiskStatus + updateRiskScore helpers"
```

---

## Task 4: `App.updateChipProgress` helper

**Files:**
- Modify: `index.html` — add after `updateRiskScore`.
- Test: extend `tests/unit/walkthrough-data-updates.test.mjs`.

- [ ] **Step 1: Append test**

```javascript
describe('App.updateChipProgress', () => {
  it('updates the chip completed value with audit + data_update', async () => {
    resetIdSeq();
    const sprints = [{ sprint_id: 'CY26-S1', start_date: '2026-04-01', end_date: '2026-05-05', hardening_start: '2026-05-01' }];
    const proj = makeProject({ name: 'P', size_engineering: 10,
      skill_splits: { size_engineering: [{ sprint: 'CY26-S1', points: 10, status: 'pending', completed: 2, assigned_to: [], reasons: [] }] }
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints }));
    const wid = app.App.startWalkthrough('GCC', []);
    app.App.updateChipProgress(proj.id, 'size_engineering', 'CY26-S1', 8, wid);
    expect(app.App.data.projects[0].skill_splits.size_engineering[0].completed).toBe(8);
    const wt = app.App.data.walkthroughs[0];
    expect(wt.data_updates[0]).toMatchObject({ kind: 'progress', project_id: proj.id, skill: 'size_engineering', sprint: 'CY26-S1', from: 2, to: 8 });
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/unit/walkthrough-data-updates.test.mjs
```

- [ ] **Step 3: Implement**

In `index.html` after `updateRiskScore`:

```javascript
  updateChipProgress(projectId, skillKey, sprintId, completedSp, walkthroughId) {
    const c = parseInt(completedSp, 10);
    if (!(c >= 0)) return false;
    const p = (this.data && this.data.projects || []).find(pr => pr.id === projectId);
    if (!p) return false;
    const splits = (p.skill_splits || {})[skillKey];
    if (!Array.isArray(splits)) return false;
    const sp = splits.find(s => s.sprint === sprintId);
    if (!sp) return false;
    const before = sp.completed || 0;
    const clamped = Math.min(c, sp.points || 0);
    if (before === clamped) return true;
    sp.completed = clamped;
    if (clamped >= (sp.points || 0)) sp.status = 'complete';
    else if (clamped > 0) sp.status = 'in_progress';
    p.last_updated = new Date().toISOString();
    if (typeof this.logChange === 'function') {
      this.logChange(projectId, 'progress:' + skillKey + ':' + sprintId, String(before), String(clamped), 'walkthrough');
    }
    if (walkthroughId) this._walkthroughLogUpdate(walkthroughId, { kind: 'progress', project_id: projectId, skill: skillKey, sprint: sprintId, from: before, to: clamped });
    this.markDirty();
    this.saveToLocalStorage();
    return true;
  },
```

- [ ] **Step 4: Run, verify pass**

```bash
npm run test:unit -- tests/unit/walkthrough-data-updates.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/walkthrough-data-updates.test.mjs index.html
git commit -m "feat(walkthrough): updateChipProgress helper"
```

---

## Task 5: Inline editors in walkthrough overlay

**Files:**
- Modify: `index.html` — extend `Sprint.openWalkthrough` to render inline editors per section.
- Test: extend `tests/render/walkthrough.test.mjs`.

- [ ] **Step 1: Append test**

```javascript
describe('Walkthrough — inline data-update editors', () => {
  it('renders RAG selectors in the rag_movers section + status dropdowns in issues + completed-SP inputs in chip_progress + risk action buttons in risks', async () => {
    resetIdSeq();
    const sprints = [{ sprint_id: 'CY26-S1', start_date: '2026-04-01', end_date: '2026-05-05', hardening_start: '2026-05-01' }];
    const proj = makeProject({ name: 'P', status: 'Blocked', rag_schedule: 'Amber', size_engineering: 10,
      skill_splits: { size_engineering: [{ sprint: 'CY26-S1', points: 10, status: 'pending', completed: 2, assigned_to: [], reasons: [] }] }
    });
    proj.risks_register = [{ description: 'R1', impact: 5, probability: 5, status: 'open' }];
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Sprint.openWalkthrough();
    const overlay = app.window.document.getElementById('walkthroughOverlay');
    const html = overlay.innerHTML;
    expect(html).toMatch(/data-wt-rag/);
    expect(html).toMatch(/data-wt-status/);
    expect(html).toMatch(/data-wt-chip-completed/);
    expect(html).toMatch(/data-wt-risk-action/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/render/walkthrough.test.mjs
```

- [ ] **Step 3: Extend `Sprint.openWalkthrough`**

The current overlay renders signals as a generic bullet list. We need section-aware rendering for `rag_movers`, `issues`, `chip_progress`, `risks`. Add a helper `Sprint._wtRenderSignals(sec, active)` that switches on `sec.id` and emits inline editors. Modify the overlay's signalsHtml line to call it.

In `index.html` find the existing section render inside `Sprint.openWalkthrough` (look for `sec.id === 'decisions'` — there's a generic signals branch above it). Replace the signals-rendering block with:

```javascript
      let signalsHtml = Sprint._wtRenderSignals(sec, active);
```

Then add as a new method on `Sprint`:

```javascript
  _wtRenderSignals(sec, active) {
    const esc = Dashboard.esc;
    const wid = active.id;
    const customer = App.activeCustomer;
    if (sec.id === 'rag_movers') {
      // Show every active project in the customer with three RAG dropdowns.
      const projects = (App.data && App.data.projects || []).filter(p => p.customer === customer && p.status !== 'Complete' && p.status !== 'Closed');
      if (!projects.length) return '<p style="margin:0;color:var(--text-muted);font-size:11px">No active projects.</p>';
      const sel = (pid, dim, val) => '<select data-wt-rag="' + esc(pid) + ':' + dim + '" onchange="Sprint._wtRagChange(\'' + esc(wid) + '\',\'' + esc(pid) + '\',\'' + dim + '\',this.value)" style="font-size:10px;padding:1px 3px">' +
        ['Green', 'Amber', 'Red'].map(v => '<option value="' + v + '"' + (val === v ? ' selected' : '') + '>' + v.charAt(0) + '</option>').join('') +
      '</select>';
      return '<table style="width:100%;font-size:11px;border-collapse:collapse">' +
        '<tr style="color:var(--text-muted);font-size:10px"><th style="text-align:left;padding:2px 4px">Project</th><th style="padding:2px 4px">S</th><th style="padding:2px 4px">R</th><th style="padding:2px 4px">Sc</th></tr>' +
        projects.slice(0, 30).map(p => '<tr><td style="padding:2px 4px">' + esc(p.name) + '</td><td style="padding:2px 4px">' + sel(p.id, 'schedule', p.rag_schedule || 'Green') + '</td><td style="padding:2px 4px">' + sel(p.id, 'resourcing', p.rag_resourcing || 'Green') + '</td><td style="padding:2px 4px">' + sel(p.id, 'scope', p.rag_scope || 'Green') + '</td></tr>').join('') +
      '</table>';
    }
    if (sec.id === 'issues') {
      const projects = (App.data && App.data.projects || []).filter(p => p.customer === customer && p.status !== 'Complete' && p.status !== 'Closed');
      if (!projects.length) return '<p style="margin:0;color:var(--text-muted);font-size:11px">No active projects.</p>';
      const statuses = ['Not Started', 'In Progress', 'On Hold', 'At Risk', 'Blocked', 'Complete'];
      return '<table style="width:100%;font-size:11px;border-collapse:collapse">' +
        '<tr style="color:var(--text-muted);font-size:10px"><th style="text-align:left;padding:2px 4px">Project</th><th style="padding:2px 4px">Status</th></tr>' +
        projects.slice(0, 30).map(p => '<tr><td style="padding:2px 4px">' + esc(p.name) + '</td><td style="padding:2px 4px"><select data-wt-status="' + esc(p.id) + '" onchange="Sprint._wtStatusChange(\'' + esc(wid) + '\',\'' + esc(p.id) + '\',this.value)" style="font-size:10px;padding:1px 3px">' + statuses.map(s => '<option value="' + s + '"' + (p.status === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></td></tr>').join('') +
      '</table>';
    }
    if (sec.id === 'chip_progress') {
      if (!Array.isArray(sec.signals) || !sec.signals.length) return '<p style="margin:0;color:var(--text-muted);font-size:11px">No open chips this sprint.</p>';
      return '<table style="width:100%;font-size:11px;border-collapse:collapse">' +
        '<tr style="color:var(--text-muted);font-size:10px"><th style="text-align:left;padding:2px 4px">Project</th><th style="padding:2px 4px">Skill</th><th style="padding:2px 4px">Done / Total</th></tr>' +
        sec.signals.slice(0, 30).map(c => {
          const p = (App.data.projects || []).find(pr => pr.id === c.projectId);
          const split = p && (p.skill_splits || {})[('size_' + c.skill)] && (p.skill_splits['size_' + c.skill] || []).find(sp => sp.sprint === c.sprintId);
          const done = split ? (split.completed || 0) : 0;
          const total = split ? (split.points || 0) : 0;
          return '<tr><td style="padding:2px 4px">' + esc(c.projectName) + '</td><td style="padding:2px 4px">' + esc(c.skill) + '</td><td style="padding:2px 4px"><input type="number" min="0" max="' + total + '" value="' + done + '" data-wt-chip-completed="' + esc(c.projectId) + ':size_' + esc(c.skill) + ':' + esc(c.sprintId) + '" onchange="Sprint._wtChipChange(\'' + esc(wid) + '\',\'' + esc(c.projectId) + '\',\'size_' + esc(c.skill) + '\',\'' + esc(c.sprintId) + '\',this.value)" style="width:50px;font-size:10px;padding:1px 3px"> / ' + total + '</td></tr>';
        }).join('') +
      '</table>';
    }
    if (sec.id === 'risks') {
      if (!Array.isArray(sec.signals) || !sec.signals.length) return '<p style="margin:0;color:var(--text-muted);font-size:11px">No risks.</p>';
      return '<table style="width:100%;font-size:11px;border-collapse:collapse">' +
        '<tr style="color:var(--text-muted);font-size:10px"><th style="text-align:left;padding:2px 4px">Project</th><th style="padding:2px 4px">Risk</th><th style="padding:2px 4px">Score</th><th style="padding:2px 4px">Action</th></tr>' +
        sec.signals.slice(0, 10).map((r, idx) => {
          const p = (App.data.projects || []).find(pr => pr.id === r.projectId);
          if (!p) return '';
          const ri = (p.risks_register || []).findIndex(x => x.description === r.description);
          if (ri < 0) return '';
          return '<tr><td style="padding:2px 4px">' + esc(r.projectName) + '</td><td style="padding:2px 4px">' + esc(r.description) + '</td><td style="padding:2px 4px">' + r.score + '</td><td style="padding:2px 4px"><button data-wt-risk-action="close" class="btn btn-outline btn-sm" style="font-size:9px;padding:1px 6px;margin-right:2px" onclick="Sprint._wtRiskAction(\'' + active.id + '\',\'' + r.projectId + '\',' + ri + ',\'closed\')">Close</button><button data-wt-risk-action="accept" class="btn btn-outline btn-sm" style="font-size:9px;padding:1px 6px" onclick="Sprint._wtRiskAction(\'' + active.id + '\',\'' + r.projectId + '\',' + ri + ',\'accepted\')">Accept</button></td></tr>';
        }).join('') +
      '</table>';
    }
    // Default: bulleted signal list (the existing branch).
    if (Array.isArray(sec.signals)) {
      return sec.signals.length
        ? '<ul style="margin:0;padding-left:18px;font-size:11px">' + sec.signals.slice(0, 10).map(s => {
            if (s.projectName) return '<li>' + esc(s.projectName) + (s.description ? ' — ' + esc(s.description) : '') + (s.score ? ' (score ' + s.score + ')' : '') + (s.dueDate ? ' (due ' + esc(s.dueDate) + ')' : '') + (s.remaining ? ' — ' + s.remaining + ' SP remaining' : '') + (s.field ? ' — ' + esc(s.field) : '') + '</li>';
            if (s.member) return '<li><strong>' + esc(s.member) + '</strong>' + (s.start ? ' off ' + esc(s.start) + ' → ' + esc(s.end) : '') + (s.endDate ? ' contract ends ' + esc(s.endDate) : '') + '</li>';
            if (s.field) return '<li>' + esc(s.field) + ': ' + esc(String(s.oldValue || '')) + ' → ' + esc(String(s.newValue || '')) + '</li>';
            if (s.forumName) return '<li>' + esc(s.forumName) + ' — ' + esc(s.description) + ' (' + esc(s.owner || '—') + ', due ' + esc(s.dueDate) + ')</li>';
            return '<li>' + esc(JSON.stringify(s).slice(0, 120)) + '</li>';
          }).join('') + '</ul>'
        : '<p style="margin:0;color:var(--text-muted);font-size:11px">Nothing to surface.</p>';
    }
    if (sec.signals && typeof sec.signals === 'object') {
      return '<div style="font-size:11px;color:var(--text-dark-secondary)">' +
        Object.entries(sec.signals).map(([k, v]) => {
          if (Array.isArray(v)) return v.length ? '<div><strong>' + esc(k) + ':</strong> ' + v.length + '</div>' : '';
          return '<div><strong>' + esc(k) + ':</strong> ' + esc(String(v)) + '</div>';
        }).filter(Boolean).join('') +
      '</div>';
    }
    return '';
  },

  _wtRagChange(wid, pid, dim, val) {
    App.updateProjectRag(pid, dim, val, wid, '');
    App.toast('RAG updated', 'success');
  },

  _wtStatusChange(wid, pid, val) {
    App.updateProjectStatus(pid, val, wid, '');
    App.toast('Status updated', 'success');
  },

  _wtChipChange(wid, pid, skillKey, sprintId, val) {
    App.updateChipProgress(pid, skillKey, sprintId, val, wid);
    App.toast('Progress updated', 'success');
  },

  _wtRiskAction(wid, pid, ri, status) {
    App.updateRiskStatus(pid, ri, status, wid, '');
    App.toast('Risk ' + status, 'success');
    Sprint.openWalkthrough();
  },
```

- [ ] **Step 4: Run, verify pass**

```bash
npm run test:unit -- tests/render/walkthrough.test.mjs
```

- [ ] **Step 5: Run full suite**

```bash
npm run test:unit
```

- [ ] **Step 6: Commit**

```bash
git add tests/render/walkthrough.test.mjs index.html
git commit -m "feat(walkthrough): inline RAG / status / chip / risk editors per section"
```

---

## Task 6: Minutes Data updates section

**Files:**
- Modify: `index.html` — `Report.buildWalkthroughMinutesDoc` adds a "Data updates" section.
- Test: extend `tests/unit/walkthrough-minutes.test.mjs`.

- [ ] **Step 1: Append test**

```javascript
describe('Walkthrough minutes — data updates', () => {
  it('lists data_updates with their type, project, before/after', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P', rag_schedule: 'Green' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const wid = app.App.startWalkthrough('GCC', []);
    app.App.updateProjectRag(proj.id, 'schedule', 'Red', wid, 'urgent');
    const Report = app.window.__pcc__.Report;
    const html = Report.buildWalkthroughMinutesDoc(wid);
    expect(html).toMatch(/Data updates/);
    expect(html).toMatch(/rag_schedule|schedule/);
    expect(html).toMatch(/Green/);
    expect(html).toMatch(/Red/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/unit/walkthrough-minutes.test.mjs
```

- [ ] **Step 3: Extend the minutes builder**

In `index.html` find `buildWalkthroughMinutesDoc`. Replace the `sections: [...]` array passed to `Report.buildDoc` with:

```javascript
    const updates = wt.data_updates || [];
    const updatesHtml = updates.length
      ? '<table><tr><th>Type</th><th>Project</th><th>Detail</th></tr>' +
        updates.map(u => {
          let detail = '';
          if (u.kind === 'rag') detail = u.dimension + ': ' + esc(u.from || '') + ' → ' + esc(u.to || '') + (u.rationale ? ' (' + esc(u.rationale) + ')' : '');
          else if (u.kind === 'status') detail = esc(u.from || '') + ' → ' + esc(u.to || '') + (u.rationale ? ' (' + esc(u.rationale) + ')' : '');
          else if (u.kind === 'risk_status') detail = 'Risk "' + esc(u.description || '') + '": ' + esc(u.from || '') + ' → ' + esc(u.to || '');
          else if (u.kind === 'risk_score') detail = 'Risk "' + esc(u.description || '') + '": ' + (u.from && u.from.impact) + 'x' + (u.from && u.from.probability) + ' → ' + (u.to && u.to.impact) + 'x' + (u.to && u.to.probability);
          else if (u.kind === 'progress') detail = esc(u.skill || '') + ' / ' + esc(u.sprint || '') + ': ' + (u.from || 0) + ' → ' + (u.to || 0) + ' SP';
          else detail = esc(JSON.stringify(u));
          return '<tr><td>' + esc(u.kind) + '</td><td>' + esc(u.project_id || '') + '</td><td>' + detail + '</td></tr>';
        }).join('') +
        '</table>'
      : '<p>No data updates this session.</p>';
```

Then in the `Report.buildDoc` call's `sections` array, add a new section right before `wt-notes`:

```javascript
            { id: 'wt-data-updates', title: 'Data updates', html: updatesHtml },
```

- [ ] **Step 4: Run, verify pass**

```bash
npm run test:unit -- tests/unit/walkthrough-minutes.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/walkthrough-minutes.test.mjs index.html
git commit -m "feat(walkthrough): minutes — Data updates section enumerates RAG/status/risk/progress changes"
```

---

## Task 7: E2E + final verify + push + merge

**Files:**
- Modify: `tests/e2e/walkthrough.spec.ts` — extend.

- [ ] **Step 1: Append spec**

```typescript
test.describe('Walkthrough — data updates roundtrip', () => {
  test('flip a RAG, close a risk, update a chip — all persist + minutes show them', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const A: any = (window as any).App;
      const p = A.data.projects[0];
      const wid = A.startWalkthrough(p.customer, ['SM']);
      const ragOk = A.updateProjectRag(p.id, 'schedule', 'Red', wid, 'E2E flip');
      const statusOk = A.updateProjectStatus(p.id, p.status === 'Blocked' ? 'In Progress' : 'Blocked', wid, 'E2E status');
      let riskOk = true;
      if ((p.risks_register || []).length) {
        riskOk = A.updateRiskStatus(p.id, 0, 'closed', wid, 'E2E close');
      }
      let progOk = true;
      const arr = ((p.skill_splits || {}).size_engineering || (p.skill_splits || {}).size_requirements || []);
      if (arr.length) {
        progOk = A.updateChipProgress(p.id, Object.keys(p.skill_splits)[0], arr[0].sprint, (arr[0].completed || 0) + 1, wid);
      }
      A.completeWalkthrough(wid);
      const wt = A.data.walkthroughs.find((w: any) => w.id === wid);
      return ragOk && statusOk && riskOk && progOk && Array.isArray(wt.data_updates) && wt.data_updates.length >= 1 && wt.minutes_html.indexOf('Data updates') >= 0;
    });
    expect(ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run E2E + full**

```bash
npm run test:e2e -- walkthrough.spec.ts
npm test
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/walkthrough.spec.ts
git commit -m "test(e2e): walkthrough data-updates roundtrip"
```

- [ ] **Step 4: Push feature branch**

```bash
git push -u origin walkthrough-data-updates
```

- [ ] **Step 5: Merge to main**

```bash
git checkout main
git merge walkthrough-data-updates --no-ff -m "Merge walkthrough-data-updates: walkthrough as data-update ritual"
npm test
git push origin main
```

---

## Self-review checklist (MD-endorsement bar)

- [ ] `App.updateProjectRag(projectId, dimension, value, walkthroughId, rationale)` mutates project, audits with `source: walkthrough`, logs to `data_updates[]`.
- [ ] `App.updateProjectStatus(projectId, newStatus, walkthroughId, rationale)` ditto.
- [ ] `App.updateRiskStatus(projectId, riskIndex, newStatus, walkthroughId, rationale)` ditto.
- [ ] `App.updateRiskScore(projectId, riskIndex, impact, probability, walkthroughId)` ditto.
- [ ] `App.updateChipProgress(projectId, skillKey, sprintId, completedSp, walkthroughId)` clamps to ≤ points, sets status to `complete` when filled.
- [ ] Walkthrough overlay renders RAG selectors per project, status dropdowns, chip-completed inputs, and Close/Accept risk buttons.
- [ ] Minutes PDF includes a `Data updates` section listing every change.
- [ ] Full test suite green.
- [ ] Branch merged into main.
