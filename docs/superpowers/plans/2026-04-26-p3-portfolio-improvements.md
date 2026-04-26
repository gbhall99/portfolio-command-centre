# P3 Portfolio Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land P3 long-tail enhancements that lift the senior-manager portfolio average from ~8.5/10 (after P0+P1+P2) to ~9.5/10: forum agenda generator, narrative auto-draft on the Executive Summary, leave calendar view, bus-factor metric, and a business-case generator. These features are user-visible polish on top of the data model that P0–P2 establish.

**Architecture:** Same single-file `index.html`; same vitest+jsdom+playwright stack. Each task is independently committable. Builds on P2's scenario, sponsor-pack, and cost-model helpers.

**Tech Stack:** Plain JS (zero build), inline SVG, `vitest` 2.1, `@playwright/test` 1.48, `jsdom` 25.

**Pre-flight:** Ensure P0, P1, and P2 plans are merged. Run `npm test` and confirm green.

---

## Phase A — Forum agenda generator

A pre-read pack assembled per governance forum, with linked projects + open actions + escalated risks.

---

## Task 1: `Governance.buildAgendaDoc(forumId)` helper

**Files:**
- Modify: `index.html` — add helper to `Governance` (search for `const Governance = {`).
- Test: `tests/unit/forum-agenda.test.mjs` (create).

- [ ] **Step 1: Failing test**

Create `tests/unit/forum-agenda.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Forum agenda generator', () => {
  it('builds an agenda doc with linked projects and open actions', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Linked', governance_forum: 'GovBoard' });
    proj.size_total = 5;
    const forum = {
      id: 'GovBoard', name: 'Governance Board', cadence: 'Monthly',
      next_date: '2026-05-15',
      actions: [{ description: 'Approve scope', owner: 'Alice', due_date: '2026-05-01', status: 'Open' }],
      decisions: []
    };
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()],
      governance_forums: [forum]
    }));
    const Governance = app.window.__pcc__.Governance;
    expect(Governance).toBeDefined();
    const doc = Governance.buildAgendaDoc('GovBoard');
    expect(doc).toBeDefined();
    expect(doc.title).toMatch(/Governance Board/);
    expect(JSON.stringify(doc.sections)).toMatch(/Linked/);
    expect(JSON.stringify(doc.sections)).toMatch(/Approve scope/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Implement**

In `index.html` add to `Governance`:

```javascript
  buildAgendaDoc(forumId) {
    const forum = (App.data && App.data.governance_forums || []).find(f => f.id === forumId || f.name === forumId);
    if (!forum) return null;
    const esc = Dashboard.esc;
    const linkedProjects = (App.data && App.data.projects || []).filter(p =>
      p.governance_forum === forum.id || p.governance_forum === forum.name
    );
    const projectsHtml = linkedProjects.length
      ? '<ul>' + linkedProjects.map(p => '<li><strong>' + esc(p.name) + '</strong> &mdash; ' + esc(p.status) + ' &middot; ' +
          'RAG ' + esc(p.rag_schedule || '') + '/' + esc(p.rag_resourcing || '') + '/' + esc(p.rag_scope || '') +
        '</li>').join('') + '</ul>'
      : '<p>No projects linked to this forum.</p>';
    const actions = forum.actions || [];
    const openActions = actions.filter(a => a.status !== 'Done');
    const actionsHtml = openActions.length
      ? '<table><tr><th>Action</th><th>Owner</th><th>Due</th></tr>' +
        openActions.map(a => '<tr><td>' + esc(a.description || '') + '</td><td>' + esc(a.owner || '') + '</td><td>' + esc(a.due_date || '—') + '</td></tr>').join('') +
        '</table>'
      : '<p>No open actions.</p>';
    const escalated = [];
    linkedProjects.forEach(p => (p.risks_register || []).forEach(r => {
      if ((r.escalation_severity || '').toLowerCase() === 'high' || ((r.impact || 0) * (r.probability || 0)) >= 16) {
        escalated.push({ project: p.name, description: r.description, score: (r.impact || 0) * (r.probability || 0) });
      }
    }));
    const risksHtml = escalated.length
      ? '<ul>' + escalated.sort((a, b) => b.score - a.score).slice(0, 10).map(r => '<li><strong>' + esc(r.project) + '</strong>: ' + esc(r.description || '') + ' (score ' + r.score + ')</li>').join('') + '</ul>'
      : '<p>No escalated risks.</p>';
    return (typeof Report !== 'undefined' && Report.buildDoc)
      ? Report.buildDoc({
          customer: linkedProjects[0] ? linkedProjects[0].customer : '',
          title: 'Forum Agenda — ' + forum.name,
          subtitle: forum.next_date ? ('Next meeting ' + forum.next_date) : 'Pre-read',
          reportType: 'Forum Agenda',
          sections: [
            { id: 'fa-projects', title: 'Linked projects', html: projectsHtml },
            { id: 'fa-actions',  title: 'Open actions',   html: actionsHtml },
            { id: 'fa-risks',    title: 'Escalated risks', html: risksHtml }
          ],
          includeAppendix: false
        })
      : { title: 'Forum Agenda — ' + forum.name, sections: [
          { id: 'fa-projects', title: 'Linked projects', html: projectsHtml },
          { id: 'fa-actions',  title: 'Open actions',   html: actionsHtml },
          { id: 'fa-risks',    title: 'Escalated risks', html: risksHtml }
        ] };
  },

  exportForumAgenda(forumId) {
    const doc = this.buildAgendaDoc(forumId);
    if (!doc) { App.toast('Forum not found', 'error'); return; }
    if (typeof Report !== 'undefined' && Report.open) Report.open(doc);
    App.toast('Forum agenda opened — use Print > Save as PDF', 'success');
  },
```

- [ ] **Step 3: Update bridge to expose Governance**

The harness already exposes `Governance`; verify the unit test reads it correctly via `app.window.__pcc__.Governance` or `app.Governance`.

- [ ] **Step 4: Add per-forum "Build Agenda" button**

In Governance view markup, add a button next to each forum: `<button class="btn btn-outline btn-sm" onclick="Governance.exportForumAgenda('FORUM_ID')">Build Agenda</button>`.

- [ ] **Step 5: Run tests**

```bash
npm run test:unit -- tests/unit/forum-agenda.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/forum-agenda.test.mjs index.html
git commit -m "feat(governance): forum agenda generator + per-forum Build Agenda button"
```

---

## Phase B — Narrative auto-draft on Executive Summary

The Exec Summary's three sentences are already templated. Add a "What changed" paragraph that pulls from the audit log of the last 7 days.

---

## Task 2: `Dashboard.execSummaryWhatChanged(customer)` + render

**Files:**
- Modify: `index.html` — add helper + integrate into `renderExecSummary`.
- Test: `tests/render/exec-summary.test.mjs` (extend).

- [ ] **Step 1: Failing test**

Append to `tests/render/exec-summary.test.mjs`:

```javascript
describe('Exec Summary — What Changed', () => {
  it('renders a 7-day change summary when the audit log has entries', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P', status: 'In Progress' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.App.logChange(proj.id, 'priority', 5, 1, 'user');
    let host = app.window.document.getElementById('execSummary');
    if (!host) {
      host = app.window.document.createElement('div');
      host.id = 'execSummary';
      app.window.document.body.appendChild(host);
    }
    app.Dashboard.renderExecSummary();
    expect(host.innerHTML).toMatch(/changed in the last 7 days/i);
    app.teardown();
  });
});
```

- [ ] **Step 2: Implement helper**

In `index.html` find `renderExecSummary` and at the end (just before `el.innerHTML = ...`) compute:

```javascript
    // What-changed sentence — pulls last-7-day audit entries scoped to active customer.
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const customerProjectIds = new Set(all.map(p => p.id));
    const changes7d = (App.data.audit_log || []).filter(e => e.timestamp >= sevenDaysAgo && customerProjectIds.has(e.projectId));
    if (changes7d.length) {
      const fields = {};
      changes7d.forEach(e => { fields[e.field] = (fields[e.field] || 0) + 1; });
      const topFields = Object.entries(fields).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, n]) => f + ' ×' + n);
      parts.push('<strong>' + changes7d.length + ' changes</strong> in the last 7 days (' + topFields.join(', ') + ').');
    }
```

- [ ] **Step 3: Run tests**

```bash
npm run test:unit -- tests/render/exec-summary.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/render/exec-summary.test.mjs index.html
git commit -m "feat(dashboard): What Changed paragraph on Executive Summary"
```

---

## Phase C — Leave calendar

A team-wide quarter-strip showing every member's PTO at a glance.

---

## Task 3: `Capacity.renderLeaveCalendar()`

**Files:**
- Modify: `index.html` — add helper + host element in Capacity view.
- Test: `tests/render/leave-calendar.test.mjs` (create).

- [ ] **Step 1: Failing test**

Create `tests/render/leave-calendar.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeMember, makeDataset } from '../harness/fixtures.mjs';

describe('Leave calendar', () => {
  it('renders one row per member with their PTO bars', async () => {
    const tm = makeMember({ name: 'Alice', holidays: [{ start: '2026-05-04', end: '2026-05-08' }] });
    const app = await loadApp(makeDataset({ team_members: [tm] }));
    let host = app.window.document.getElementById('leaveCalendarPanel');
    if (!host) {
      host = app.window.document.createElement('div');
      host.id = 'leaveCalendarPanel';
      app.window.document.body.appendChild(host);
    }
    app.Capacity.renderLeaveCalendar('GCC');
    expect(host.innerHTML).toMatch(/Leave/);
    expect(host.innerHTML).toMatch(/Alice/);
    expect(host.innerHTML).toMatch(/leave-bar/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Implement**

Add to `Capacity`:

```javascript
  renderLeaveCalendar(customer) {
    const host = document.getElementById('leaveCalendarPanel');
    if (!host) return;
    const cust = customer || App.activeCustomer;
    const members = (App.data && App.data.team_members || []).filter(tm => {
      if (!cust) return true;
      const c = (tm.customer || '').toLowerCase();
      return c === cust.toLowerCase() || c === 'both';
    });
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(start); end.setMonth(end.getMonth() + 3);
    const totalMs = end - start;
    const esc = Dashboard.esc;
    const rows = members.map(tm => {
      const bars = (tm.holidays || []).map(h => {
        const s = new Date(h.start), e = new Date(h.end);
        if (e < start || s > end) return '';
        const left = Math.max(0, ((Math.max(s, start) - start) / totalMs) * 100);
        const width = Math.max(0.5, ((Math.min(e, end) - Math.max(s, start)) / totalMs) * 100);
        return '<div class="leave-bar" title="' + esc(tm.name) + ' off ' + esc(h.start) + ' → ' + esc(h.end) + '" style="position:absolute;left:' + left.toFixed(2) + '%;width:' + width.toFixed(2) + '%;height:14px;top:4px;background:var(--accent-amber,#f59e0b);border-radius:3px;opacity:0.85"></div>';
      }).join('');
      return '<div class="leave-row" style="display:grid;grid-template-columns:140px 1fr;align-items:center;gap:8px;padding:4px 0">' +
        '<span style="font-size:12px;font-weight:600">' + esc(tm.name) + '</span>' +
        '<div style="position:relative;height:22px;background:var(--surface-2);border-radius:3px">' + bars + '</div>' +
      '</div>';
    }).join('');
    host.innerHTML = '<div style="font-size:13px;font-weight:700;margin-bottom:6px">Leave (next 90 days)</div>' + rows;
  },
```

Add `<div id="leaveCalendarPanel" style="margin-top:14px"></div>` after the Resourcing Gap panel in the Capacity view markup. Wire `Capacity.render` to call `renderLeaveCalendar(App.activeCustomer)`.

- [ ] **Step 3: Run tests**

```bash
npm run test:unit -- tests/render/leave-calendar.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/render/leave-calendar.test.mjs index.html
git commit -m "feat(capacity): team-wide leave calendar (next 90 days)"
```

---

## Phase D — Bus-factor metric

Surface single-threaded skills per project on the detail panel and on a Dashboard alert tile.

---

## Task 4: `App.computeBusFactor(project)`

**Files:**
- Modify: `index.html` — add helper.
- Test: `tests/unit/bus-factor.test.mjs` (create).

- [ ] **Step 1: Failing test**

Create:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Bus factor', () => {
  it('returns N=1 for skills with only one eligible member', async () => {
    resetIdSeq();
    const proj = makeProject({ size_engineering: 10 });
    proj.size_total = 10;
    const lone = makeMember({ name: 'Solo', primary_skills: ['Data Engineering'] });
    const app = await loadApp(makeDataset({ projects: [proj], team_members: [lone] }));
    const bf = app.App.computeBusFactor(proj);
    expect(bf.size_engineering).toBe(1);
    app.teardown();
  });

  it('returns N=2 when two members can do the skill', async () => {
    resetIdSeq();
    const proj = makeProject({ size_engineering: 10 });
    proj.size_total = 10;
    const a = makeMember({ name: 'Alice', primary_skills: ['Data Engineering'] });
    const b = makeMember({ name: 'Bob', primary_skills: ['Data Engineering'] });
    const app = await loadApp(makeDataset({ projects: [proj], team_members: [a, b] }));
    const bf = app.App.computeBusFactor(proj);
    expect(bf.size_engineering).toBe(2);
    app.teardown();
  });
});
```

- [ ] **Step 2: Implement**

Add to `App`:

```javascript
  // Bus-factor per skill — count eligible team members per skill needed by the project.
  // Returns { [skillKey]: N }.
  computeBusFactor(project) {
    const skills = ['size_requirements', 'size_tableau', 'size_engineering', 'size_data_science', 'size_uat_adoption'];
    const skillKeyToLabel = { size_requirements: 'Requirements', size_tableau: 'Tableau', size_engineering: 'Data Engineering', size_data_science: 'Data Science', size_uat_adoption: 'UAT' };
    const members = (this.data && this.data.team_members || []).filter(tm => {
      const c = (tm.customer || '').toLowerCase();
      return c === (project.customer || '').toLowerCase() || c === 'both';
    });
    const out = {};
    skills.forEach(k => {
      if (!project[k]) return;
      const label = skillKeyToLabel[k];
      const count = members.filter(tm =>
        (tm.primary_skills || []).indexOf(label) >= 0 || (tm.secondary_skills || []).indexOf(label) >= 0
      ).length;
      out[k] = count;
    });
    return out;
  },
```

- [ ] **Step 3: Run tests**

```bash
npm run test:unit -- tests/unit/bus-factor.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Surface as a chip on the Detail Panel**

In Detail Panel render, just under the size fields, show a `Coverage` line: for each skill where bus-factor=1, render a red badge "BF1: <skillLabel>". Use `App.computeBusFactor(p)` to compute.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/bus-factor.test.mjs index.html
git commit -m "feat(coverage): computeBusFactor + BF1 badges on detail panel"
```

---

## Phase E — Outline business case generator

A Markdown export per project with cost (from P2's rate-card) + benefit + NPV proxy.

---

## Task 5: `Report.buildBusinessCaseDoc(projectId)`

**Files:**
- Modify: `index.html` — add to `Report`.
- Test: `tests/unit/business-case.test.mjs` (create).

- [ ] **Step 1: Failing test**

Create:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Business case generator', () => {
  it('produces a doc with cost, benefit, and NPV sections', async () => {
    resetIdSeq();
    const proj = makeProject({
      name: 'Cost', size_engineering: 10,
      business_value: 8, time_criticality: 6, risk_reduction_opportunity: 4
    });
    proj.size_total = 10;
    proj.benefit_annual_gbp = 250000;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()],
      settings: { rate_card: { size_engineering: { perm: 750 } }, business_case_discount_rate: 0.07 }
    }));
    const Report = app.window.__pcc__.Report;
    const doc = Report.buildBusinessCaseDoc(proj.id);
    expect(doc).toBeDefined();
    expect(JSON.stringify(doc.sections)).toMatch(/Cost/);
    expect(JSON.stringify(doc.sections)).toMatch(/Benefit/);
    expect(JSON.stringify(doc.sections)).toMatch(/NPV/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Implement**

Add to `Report`:

```javascript
  buildBusinessCaseDoc(projectId) {
    const p = (App.data && App.data.projects || []).find(pr => pr.id === projectId);
    if (!p) return null;
    const cost = (App.computeProjectCost ? App.computeProjectCost(p) : { BAC: 0, currency: 'GBP' });
    const benefitAnnual = Number(p.benefit_annual_gbp || 0);
    const horizonYears = Number(p.benefit_horizon_years || 3);
    const rate = Number((App.data.settings && App.data.settings.business_case_discount_rate) || 0.07);
    let npv = -cost.BAC;
    for (let y = 1; y <= horizonYears; y++) npv += benefitAnnual / Math.pow(1 + rate, y);
    const wsjf = (typeof App.calculateWsjf === 'function') ? App.calculateWsjf(p) : { wsjf: 0, populated: 0 };
    const esc = Dashboard.esc;
    const costHtml = '<p>BAC: <strong>£' + Number(cost.BAC).toLocaleString('en-GB') + '</strong></p>';
    const benefitHtml = '<p>Annual benefit: <strong>£' + benefitAnnual.toLocaleString('en-GB') + '</strong> over ' + horizonYears + ' year' + (horizonYears === 1 ? '' : 's') + '</p>';
    const npvHtml = '<p>Discount rate: <strong>' + (rate * 100).toFixed(1) + '%</strong></p>' +
      '<p>NPV: <strong>£' + Math.round(npv).toLocaleString('en-GB') + '</strong></p>' +
      '<p>WSJF: <strong>' + (wsjf.wsjf || 0) + '</strong> (CoD ' + (wsjf.cod || 0) + ' / size ' + (wsjf.size || 1) + ', ' + wsjf.populated + ' inputs populated)</p>';
    return (typeof Report !== 'undefined' && Report.buildDoc)
      ? Report.buildDoc({
          customer: p.customer,
          title: 'Business Case — ' + p.name,
          subtitle: 'Outline: cost / benefit / NPV / WSJF',
          reportType: 'Business Case',
          sections: [
            { id: 'bc-cost',    title: 'Cost',    html: costHtml },
            { id: 'bc-benefit', title: 'Benefit', html: benefitHtml },
            { id: 'bc-npv',     title: 'NPV',     html: npvHtml }
          ],
          includeAppendix: false
        })
      : { title: 'Business Case — ' + p.name, sections: [
          { id: 'bc-cost',    title: 'Cost',    html: costHtml },
          { id: 'bc-benefit', title: 'Benefit', html: benefitHtml },
          { id: 'bc-npv',     title: 'NPV',     html: npvHtml }
        ] };
  },

  exportBusinessCase(projectId) {
    const doc = this.buildBusinessCaseDoc(projectId);
    if (!doc) { App.toast('Project not found', 'error'); return; }
    if (this.open) this.open(doc);
    App.toast('Business case opened — use Print > Save as PDF', 'success');
  },
```

- [ ] **Step 3: Add a button on Detail Panel**

Next to the Sponsor Pack button (P2 Task 3 Step 5), add:

```html
'<button class="btn btn-outline btn-sm" onclick="Report.exportBusinessCase(\'' + Dashboard.esc(p.id) + '\')" title="Outline business case (cost + benefit + NPV)">Business Case</button>'
```

- [ ] **Step 4: Run tests**

```bash
npm run test:unit -- tests/unit/business-case.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/business-case.test.mjs index.html
git commit -m "feat(report): outline business case generator (cost / benefit / NPV)"
```

---

## Task 6: P3 E2E + final verification

**Files:**
- Create: `tests/e2e/p3-flows.spec.ts`.

- [ ] **Step 1: Spec**

```typescript
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test.describe('P3 — Forum agenda', () => {
  test('Governance.exportForumAgenda is callable', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const G: any = (window as any).Governance;
      const f = ((window as any).App.data.governance_forums || [])[0];
      if (!f) return true;
      const doc = G.buildAgendaDoc(f.id || f.name);
      return !!(doc && doc.title);
    });
    expect(ok).toBe(true);
  });
});

test.describe('P3 — Bus factor + business case', () => {
  test('App.computeBusFactor returns a map', async ({ page }) => {
    await openAppWithData(page);
    const bf = await page.evaluate(() => {
      const App: any = (window as any).App;
      const p = App.data.projects[0];
      return App.computeBusFactor(p);
    });
    expect(typeof bf).toBe('object');
  });

  test('Report.buildBusinessCaseDoc returns sections', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const Report: any = (window as any).Report;
      const App: any = (window as any).App;
      const p = App.data.projects[0];
      const doc = Report.buildBusinessCaseDoc(p.id);
      return !!(doc && doc.title);
    });
    expect(ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run E2E**

```bash
npm run test:e2e -- p3-flows.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Full suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/p3-flows.spec.ts
git commit -m "test(e2e): forum agenda + bus factor + business case smoke covers P3 user flows"
```

---

## Self-review checklist

- [ ] `Governance.buildAgendaDoc(forumId)` produces a doc with linked-projects, open-actions, and escalated-risks sections.
- [ ] Per-forum "Build Agenda" button visible on the Governance view.
- [ ] Executive Summary shows a "What Changed in last 7 days" paragraph when audit log has entries.
- [ ] Capacity view renders a leave calendar bar per team member for the next 90 days.
- [ ] `App.computeBusFactor(p)` returns `{ [skillKey]: count }`.
- [ ] Detail panel shows BF1 badges for single-threaded skills.
- [ ] `Report.buildBusinessCaseDoc(id)` returns sections for cost, benefit, NPV.
- [ ] Detail panel exposes a Business Case button.
- [ ] `npm test` is green.
