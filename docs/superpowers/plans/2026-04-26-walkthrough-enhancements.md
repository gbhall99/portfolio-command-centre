# Walkthrough Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat chip-list `Sprint.openWalkthrough` with a 9-section ritual: pre-loaded signals, persistent session, decision/action capture, auto-generated minutes — usable as the senior manager's MD-endorseable weekly portfolio review.

**Architecture:** Single `index.html`. Pure helpers first (`App.computeWalkthroughAgenda`, session lifecycle on App, minutes builder on Report). UI then re-skins `Sprint.openWalkthrough` to read from those helpers. Persistence in `App.data.walkthroughs[]` (capped 52 → `walkthroughs_archive[]`).

**Tech Stack:** Plain JS (zero build), inline SVG, `vitest` 2.1, `@playwright/test` 1.48, `jsdom` 25.

**Spec**: `docs/superpowers/specs/2026-04-26-walkthrough-enhancements-design.md` — read it first.

---

## File Structure

| File | Role |
|---|---|
| `index.html` | All app code |
| `tests/unit/walkthrough-agenda.test.mjs` | Agenda compute helper |
| `tests/unit/walkthrough-session.test.mjs` | Session lifecycle (start/record/complete/archive) |
| `tests/render/walkthrough.test.mjs` | Existing — extend for new sectioned render |
| `tests/unit/walkthrough-minutes.test.mjs` | Minutes builder |
| `tests/e2e/walkthrough.spec.ts` | End-to-end open → record → complete |

---

## Task 1: `App.computeWalkthroughAgenda(customer)`

**Files:**
- Modify: `index.html` — add helper to `App` near `computeBacklogBuckets`.
- Test: `tests/unit/walkthrough-agenda.test.mjs` (create).

- [ ] **Step 1: Failing test**

Create `tests/unit/walkthrough-agenda.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.computeWalkthroughAgenda', () => {
  it('returns nine sections in stable order', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ name: 'X' })] }));
    const a = app.App.computeWalkthroughAgenda('GCC');
    const ids = a.sections.map(s => s.id);
    expect(ids).toEqual(['whats_changed', 'rag_movers', 'risks', 'issues', 'actions_due', 'chip_progress', 'backlog', 'capacity', 'decisions']);
  });

  it('signals are arrays scoped to the customer', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Red', status: 'Blocked', rag_schedule: 'Red' });
    proj.size_total = 5;
    proj.risks_register = [{ description: 'Big risk', impact: 5, probability: 5 }];
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const a = app.App.computeWalkthroughAgenda('GCC');
    const issues = a.sections.find(s => s.id === 'issues');
    expect(issues.signals.some(s => s.projectName === 'Red')).toBe(true);
    const risks = a.sections.find(s => s.id === 'risks');
    expect(risks.signals.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/unit/walkthrough-agenda.test.mjs
```

- [ ] **Step 3: Implement**

In `index.html` add to `App` (next to `computeBacklogBuckets`):

```javascript
  computeWalkthroughAgenda(customer) {
    const projects = (this.data && this.data.projects || []).filter(p => p.customer === customer);
    const lastWt = ((this.data && this.data.walkthroughs) || []).filter(w => w.customer === customer).slice(-1)[0];
    const sinceTs = lastWt ? lastWt.started_at : null;
    const since = sinceTs ? new Date(sinceTs).toISOString() : null;
    const log = (this.data && this.data.audit_log) || [];
    const customerIds = new Set(projects.map(p => p.id));
    const recent = since ? log.filter(e => e.timestamp > since && customerIds.has(e.projectId)) : [];

    // 1. What's changed
    const fieldCount = {};
    recent.forEach(e => { fieldCount[e.field] = (fieldCount[e.field] || 0) + 1; });
    const topFields = Object.entries(fieldCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // 2. RAG movers — entries where field starts with rag_
    const ragFlips = recent.filter(e => /^rag_/.test(e.field));

    // 3. Top risks (impact * probability)
    const allRisks = [];
    projects.forEach(p => (p.risks_register || []).forEach(r => {
      allRisks.push({ projectId: p.id, projectName: p.name, description: r.description, score: (r.impact || 0) * (r.probability || 0), addedAt: r.added_at || null });
    }));
    allRisks.sort((a, b) => b.score - a.score);
    const topRisks = allRisks.slice(0, 5);
    const newRisks = since ? allRisks.filter(r => r.addedAt && r.addedAt > since) : [];

    // 4. Issues + blocked
    const blocked = projects.filter(p => p.status === 'Blocked');
    const openIssues = [];
    projects.forEach(p => (p.issues_register || []).forEach(i => openIssues.push({ projectId: p.id, projectName: p.name, description: i.description, owner: i.owner })));

    // 5. Governance actions due ≤ 7 days
    const todayMs = Date.now();
    const sevenMs = 7 * 86400000;
    const actionsDue = [];
    ((this.data && this.data.governance_forums) || []).forEach(f => {
      (f.actions || []).forEach(a => {
        if (a.status === 'Done') return;
        if (!a.due_date) return;
        const due = new Date(a.due_date).getTime();
        if (due - todayMs <= sevenMs) {
          actionsDue.push({ forumId: f.id || f.name, forumName: f.name, description: a.description, owner: a.owner, dueDate: a.due_date });
        }
      });
    });

    // 6. Chip progress — open chips in next-future sprint
    const sprints = (this.data && this.data.sprints || []).slice();
    const now = new Date();
    const activeSprint = sprints.find(s => !s.end_date || new Date(s.end_date) >= now);
    const chips = [];
    if (activeSprint) {
      projects.forEach(p => {
        Object.entries(p.skill_splits || {}).forEach(([sk, arr]) => {
          if (!Array.isArray(arr)) return;
          arr.forEach(sp => {
            if (sp.sprint !== activeSprint.sprint_id) return;
            if (sp.status === 'complete') return;
            const remaining = (sp.points || 0) - (sp.completed || 0);
            if (remaining <= 0) return;
            chips.push({ projectId: p.id, projectName: p.name, skill: sk.replace(/^size_/, ''), remaining, sprintId: activeSprint.sprint_id });
          });
        });
      });
    }

    // 7. Backlog — unrefined + stale
    const buckets = (typeof this.computeBacklogBuckets === 'function') ? this.computeBacklogBuckets(customer) : { unrefined: [], refined: [], parked: [] };
    const stale = projects.filter(p => {
      if (p.status === 'Complete' || p.status === 'Closed' || p.status === 'On Hold') return false;
      const lastTouch = p.last_updated ? new Date(p.last_updated).getTime() : 0;
      return (todayMs - lastTouch) > 30 * 86400000;
    });

    // 8. Capacity & leave
    const sustained = (typeof Capacity !== 'undefined' && Capacity.computeSustainedHighLoad)
      ? Capacity.computeSustainedHighLoad(customer) : [];
    const upcomingPto = [];
    const contractEnds = [];
    ((this.data && this.data.team_members) || []).forEach(tm => {
      const c = (tm.customer || '').toLowerCase();
      if (c !== customer.toLowerCase() && c !== 'both') return;
      (tm.holidays || []).forEach(h => {
        const start = new Date(h.start).getTime();
        if (start - todayMs > 0 && start - todayMs <= 14 * 86400000) {
          upcomingPto.push({ member: tm.name, start: h.start, end: h.end });
        }
      });
      if (tm.contract_end_date) {
        const end = new Date(tm.contract_end_date).getTime();
        if (end - todayMs > 0 && end - todayMs <= 30 * 86400000) {
          contractEnds.push({ member: tm.name, endDate: tm.contract_end_date });
        }
      }
    });

    return {
      customer,
      lastWalkthroughAt: sinceTs,
      sections: [
        { id: 'whats_changed', title: "What's changed", signals: recent.slice(0, 50), summary: topFields.map(([f, n]) => f + ' ×' + n).join(', ') || (since ? 'No changes since last walkthrough.' : 'First walkthrough — no prior baseline.') },
        { id: 'rag_movers', title: 'RAG movers', signals: ragFlips, summary: ragFlips.length + ' RAG flip' + (ragFlips.length === 1 ? '' : 's') },
        { id: 'risks', title: 'Top risks + new', signals: topRisks, summary: topRisks.length + ' top risks' + (newRisks.length ? ', ' + newRisks.length + ' new this week' : '') },
        { id: 'issues', title: 'Issues & blocked projects', signals: blocked.map(p => ({ projectId: p.id, projectName: p.name, status: p.status })).concat(openIssues), summary: blocked.length + ' blocked, ' + openIssues.length + ' open issues' },
        { id: 'actions_due', title: 'Governance actions due ≤ 7 days', signals: actionsDue, summary: actionsDue.length + ' due' },
        { id: 'chip_progress', title: 'Chip progress (active sprint)', signals: chips, summary: (activeSprint ? activeSprint.sprint_id + ' — ' : '') + chips.length + ' open chips' },
        { id: 'backlog', title: 'Backlog refinement', signals: { unrefined: buckets.unrefined.length, refined: buckets.refined.length, parked: buckets.parked.length, stale: stale.length, staleProjects: stale.slice(0, 10) }, summary: buckets.unrefined.length + ' unrefined, ' + stale.length + ' stale (>30d)' },
        { id: 'capacity', title: 'Capacity & leave', signals: { sustained, upcomingPto, contractEnds }, summary: sustained.length + ' sustained-load, ' + upcomingPto.length + ' PTO ≤ 14d, ' + contractEnds.length + ' contract ends ≤ 30d' },
        { id: 'decisions', title: 'Decisions & actions (capture)', signals: [], summary: 'Capture decisions + actions taken in this session.' }
      ]
    };
  },
```

- [ ] **Step 4: Run, verify pass**

```bash
npm run test:unit -- tests/unit/walkthrough-agenda.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/walkthrough-agenda.test.mjs index.html
git commit -m "feat(walkthrough): computeWalkthroughAgenda — 9 sections with pre-loaded signals"
```

---

## Task 2: Session lifecycle helpers

**Files:**
- Modify: `index.html` — add `App.startWalkthrough`, `recordWalkthroughDecision`, `recordWalkthroughAction`, `completeWalkthrough`, `getActiveWalkthrough`.
- Test: `tests/unit/walkthrough-session.test.mjs`.

- [ ] **Step 1: Failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Walkthrough session', () => {
  it('startWalkthrough creates a row with id + started_at', async () => {
    const app = await loadApp(makeDataset({}));
    const id = app.App.startWalkthrough('GCC', ['SM', 'PO']);
    expect(id).toMatch(/^wt_/);
    expect(app.App.data.walkthroughs).toHaveLength(1);
    expect(app.App.data.walkthroughs[0].started_at).toBeTruthy();
    expect(app.App.data.walkthroughs[0].attendees).toEqual(['SM', 'PO']);
    app.teardown();
  });

  it('recordWalkthroughDecision appends to session AND audit log', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'X' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const id = app.App.startWalkthrough('GCC', []);
    app.App.recordWalkthroughDecision(id, { projectId: proj.id, text: 'Defer DE', rationale: 'Sponsor concern' });
    const wt = app.App.data.walkthroughs[0];
    expect(wt.decisions).toHaveLength(1);
    expect(wt.decisions[0].text).toBe('Defer DE');
    const audit = app.App.data.audit_log.slice(-1)[0];
    expect(audit.field).toBe('walkthrough_decision');
    expect(audit.rationale).toBe('Sponsor concern');
    app.teardown();
  });

  it('recordWalkthroughAction appends to session AND to forum', async () => {
    const forum = { id: 'GovBoard', name: 'Governance Board', actions: [] };
    const app = await loadApp(makeDataset({ governance_forums: [forum] }));
    const id = app.App.startWalkthrough('GCC', []);
    app.App.recordWalkthroughAction(id, { description: 'Confirm Veena availability', owner: 'PO', due_date: '2026-04-30', forumId: 'GovBoard' });
    expect(app.App.data.walkthroughs[0].actions).toHaveLength(1);
    expect(app.App.data.governance_forums[0].actions).toHaveLength(1);
    expect(app.App.data.governance_forums[0].actions[0].description).toBe('Confirm Veena availability');
    app.teardown();
  });

  it('completeWalkthrough sets completed_at and minutes_html', async () => {
    const app = await loadApp(makeDataset({}));
    const id = app.App.startWalkthrough('GCC', []);
    app.App.completeWalkthrough(id);
    const wt = app.App.data.walkthroughs[0];
    expect(wt.completed_at).toBeTruthy();
    expect(typeof wt.minutes_html).toBe('string');
    expect(wt.minutes_html.length).toBeGreaterThan(0);
    app.teardown();
  });

  it('archives entries past 52 into walkthroughs_archive[]', async () => {
    const app = await loadApp(makeDataset({}));
    for (let i = 0; i < 55; i++) {
      const id = app.App.startWalkthrough('GCC', []);
      app.App.completeWalkthrough(id);
    }
    expect(app.App.data.walkthroughs.length).toBeLessThanOrEqual(52);
    expect(Array.isArray(app.App.data.walkthroughs_archive)).toBe(true);
    expect(app.App.data.walkthroughs_archive.length).toBeGreaterThan(0);
    app.teardown();
  });

  it('getActiveWalkthrough returns the in-progress session for a customer', async () => {
    const app = await loadApp(makeDataset({}));
    expect(app.App.getActiveWalkthrough('GCC')).toBeNull();
    const id = app.App.startWalkthrough('GCC', []);
    expect(app.App.getActiveWalkthrough('GCC').id).toBe(id);
    app.App.completeWalkthrough(id);
    expect(app.App.getActiveWalkthrough('GCC')).toBeNull();
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/unit/walkthrough-session.test.mjs
```

- [ ] **Step 3: Implement**

In `index.html` add to `App` (next to `computeWalkthroughAgenda`):

```javascript
  startWalkthrough(customer, attendees) {
    if (!this.data) return null;
    if (!Array.isArray(this.data.walkthroughs)) this.data.walkthroughs = [];
    const id = 'wt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    this.data.walkthroughs.push({
      id, customer, started_at: new Date().toISOString(), completed_at: null,
      attendees: Array.isArray(attendees) ? attendees.slice() : [],
      section_notes: {}, section_status: {}, decisions: [], actions: [], minutes_html: null
    });
    this.markDirty();
    this.saveToLocalStorage();
    return id;
  },

  getActiveWalkthrough(customer) {
    return ((this.data && this.data.walkthroughs) || []).slice().reverse()
      .find(w => w.customer === customer && !w.completed_at) || null;
  },

  _findWalkthrough(id) {
    return ((this.data && this.data.walkthroughs) || []).find(w => w.id === id) || null;
  },

  recordWalkthroughDecision(walkthroughId, opts) {
    const wt = this._findWalkthrough(walkthroughId);
    if (!wt) return false;
    opts = opts || {};
    const entry = { project_id: opts.projectId || null, text: String(opts.text || '').slice(0, 400), rationale: String(opts.rationale || '').slice(0, 400), recorded_at: new Date().toISOString() };
    wt.decisions.push(entry);
    if (typeof this.logChange === 'function') {
      this.logChange(opts.projectId || null, 'walkthrough_decision', '', entry.text, 'walkthrough', { rationale: entry.rationale });
    }
    this.markDirty();
    this.saveToLocalStorage();
    return true;
  },

  recordWalkthroughAction(walkthroughId, opts) {
    const wt = this._findWalkthrough(walkthroughId);
    if (!wt) return false;
    opts = opts || {};
    const action = {
      description: String(opts.description || '').slice(0, 200),
      owner: String(opts.owner || '').slice(0, 80),
      due_date: opts.due_date || null,
      status: 'Open',
      created_at: new Date().toISOString(),
      walkthrough_id: walkthroughId
    };
    wt.actions.push(action);
    // Also push into the named forum's actions[] so it surfaces in the Governance view.
    if (opts.forumId) {
      const forum = ((this.data && this.data.governance_forums) || []).find(f => f.id === opts.forumId || f.name === opts.forumId);
      if (forum) {
        if (!Array.isArray(forum.actions)) forum.actions = [];
        forum.actions.push({ description: action.description, owner: action.owner, due_date: action.due_date, status: 'Open', source: 'walkthrough:' + walkthroughId });
      }
    }
    this.markDirty();
    this.saveToLocalStorage();
    return true;
  },

  completeWalkthrough(walkthroughId) {
    const wt = this._findWalkthrough(walkthroughId);
    if (!wt) return false;
    wt.completed_at = new Date().toISOString();
    if (typeof Report !== 'undefined' && Report.buildWalkthroughMinutesDoc) {
      try { wt.minutes_html = Report.buildWalkthroughMinutesDoc(walkthroughId); } catch (e) { wt.minutes_html = '<html><body><h1>Minutes</h1><p>' + (this.toast ? '' : '') + '</p></body></html>'; }
    } else {
      wt.minutes_html = '<html><body><h1>Walkthrough — ' + (wt.customer || '') + '</h1><p>Completed ' + wt.completed_at + '</p></body></html>';
    }
    // Cap walkthroughs at 52, archive surplus.
    if (this.data.walkthroughs.length > 52) {
      if (!Array.isArray(this.data.walkthroughs_archive)) this.data.walkthroughs_archive = [];
      const overflow = this.data.walkthroughs.length - 52;
      const archived = this.data.walkthroughs.splice(0, overflow);
      Array.prototype.push.apply(this.data.walkthroughs_archive, archived);
    }
    this.markDirty();
    this.saveToLocalStorage();
    return true;
  },

  setWalkthroughSectionStatus(walkthroughId, sectionId, status) {
    const wt = this._findWalkthrough(walkthroughId);
    if (!wt) return false;
    wt.section_status[sectionId] = status;
    this.markDirty();
    this.saveToLocalStorage();
    return true;
  },

  setWalkthroughSectionNote(walkthroughId, sectionId, note) {
    const wt = this._findWalkthrough(walkthroughId);
    if (!wt) return false;
    wt.section_notes[sectionId] = String(note || '').slice(0, 2000);
    this.markDirty();
    this.saveToLocalStorage();
    return true;
  },
```

- [ ] **Step 4: Run, verify pass**

```bash
npm run test:unit -- tests/unit/walkthrough-session.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/walkthrough-session.test.mjs index.html
git commit -m "feat(walkthrough): session lifecycle helpers + 52-row archive cap"
```

---

## Task 3: `Report.buildWalkthroughMinutesDoc(walkthroughId)`

**Files:**
- Modify: `index.html` — add to `Report`.
- Test: `tests/unit/walkthrough-minutes.test.mjs`.

- [ ] **Step 1: Failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Walkthrough minutes', () => {
  it('builds a doc with attendees, decisions, and actions sections', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'X' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const id = app.App.startWalkthrough('GCC', ['SM', 'PO']);
    app.App.recordWalkthroughDecision(id, { projectId: proj.id, text: 'Defer DE', rationale: 'Sponsor concern' });
    app.App.recordWalkthroughAction(id, { description: 'Confirm Veena', owner: 'PO', due_date: '2026-04-30' });
    const Report = app.window.__pcc__.Report;
    const html = Report.buildWalkthroughMinutesDoc(id);
    expect(typeof html).toBe('string');
    expect(html).toMatch(/Walkthrough/i);
    expect(html).toMatch(/SM/);
    expect(html).toMatch(/Defer DE/);
    expect(html).toMatch(/Confirm Veena/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/unit/walkthrough-minutes.test.mjs
```

- [ ] **Step 3: Implement**

In `index.html` add to `Report` (next to `buildSprintBriefDoc`):

```javascript
  buildWalkthroughMinutesDoc(walkthroughId) {
    const wt = ((App.data && App.data.walkthroughs) || []).find(w => w.id === walkthroughId);
    if (!wt) return null;
    const esc = Dashboard.esc;
    const attendees = (wt.attendees || []).map(esc).join(', ') || '<em>(none recorded)</em>';
    const decisionsHtml = wt.decisions.length
      ? '<table><tr><th>Project</th><th>Decision</th><th>Rationale</th></tr>' +
        wt.decisions.map(d => '<tr><td>' + esc(d.project_id || '—') + '</td><td>' + esc(d.text) + '</td><td>' + esc(d.rationale) + '</td></tr>').join('') +
        '</table>'
      : '<p>No decisions recorded.</p>';
    const actionsHtml = wt.actions.length
      ? '<table><tr><th>Action</th><th>Owner</th><th>Due</th></tr>' +
        wt.actions.map(a => '<tr><td>' + esc(a.description) + '</td><td>' + esc(a.owner) + '</td><td>' + esc(a.due_date || '—') + '</td></tr>').join('') +
        '</table>'
      : '<p>No actions recorded.</p>';
    const sectionNotesHtml = Object.keys(wt.section_notes || {}).length
      ? '<ul>' + Object.entries(wt.section_notes).filter(([, v]) => v).map(([k, v]) => '<li><strong>' + esc(k) + ':</strong> ' + esc(v) + '</li>').join('') + '</ul>'
      : '<p>No per-section notes.</p>';
    const headerHtml = '<p><strong>Customer:</strong> ' + esc(wt.customer) + '</p>' +
      '<p><strong>Started:</strong> ' + esc(wt.started_at) + (wt.completed_at ? ' &middot; <strong>Completed:</strong> ' + esc(wt.completed_at) : '') + '</p>' +
      '<p><strong>Attendees:</strong> ' + attendees + '</p>';
    return (typeof Report !== 'undefined' && Report.buildDoc)
      ? Report.buildDoc({
          customer: wt.customer,
          title: 'Weekly Walkthrough — ' + wt.customer,
          subtitle: 'Started ' + wt.started_at,
          reportType: 'Walkthrough',
          sections: [
            { id: 'wt-header', title: 'Session', html: headerHtml },
            { id: 'wt-decisions', title: 'Decisions', html: decisionsHtml },
            { id: 'wt-actions', title: 'Actions', html: actionsHtml },
            { id: 'wt-notes', title: 'Section notes', html: sectionNotesHtml }
          ],
          includeAppendix: false
        })
      : ('<html><body><h1>Walkthrough — ' + esc(wt.customer) + '</h1>' + headerHtml + '<h2>Decisions</h2>' + decisionsHtml + '<h2>Actions</h2>' + actionsHtml + '<h2>Section notes</h2>' + sectionNotesHtml + '</body></html>');
  },

  exportWalkthroughMinutes(walkthroughId) {
    const html = this.buildWalkthroughMinutesDoc(walkthroughId);
    if (!html) { App.toast('Walkthrough not found', 'error'); return; }
    if (this.open) this.open(html);
    App.toast('Minutes opened — use Print > Save as PDF', 'success');
  },
```

- [ ] **Step 4: Run, verify pass**

```bash
npm run test:unit -- tests/unit/walkthrough-minutes.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/walkthrough-minutes.test.mjs index.html
git commit -m "feat(report): buildWalkthroughMinutesDoc — printable session minutes"
```

---

## Task 4: Refactored sectioned overlay

**Files:**
- Modify: `index.html:18429+` — replace `Sprint.openWalkthrough` body with sectioned render.
- Test: `tests/render/walkthrough.test.mjs` — extend.

- [ ] **Step 1: Failing test**

Append to `tests/render/walkthrough.test.mjs`:

```javascript
describe('Walkthrough — sectioned overlay', () => {
  it('renders all 9 section headers in order', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'P' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Sprint.openWalkthrough();
    const overlay = app.window.document.getElementById('walkthroughOverlay');
    expect(overlay).not.toBeNull();
    const html = overlay.innerHTML;
    [
      "What's changed", 'RAG movers', 'Top risks', 'Issues', 'Governance actions',
      'Chip progress', 'Backlog refinement', 'Capacity & leave', 'Decisions'
    ].forEach(s => { expect(html).toContain(s); });
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/render/walkthrough.test.mjs
```

- [ ] **Step 3: Replace `Sprint.openWalkthrough`**

In `index.html` find `openWalkthrough()` (line ~18429) and replace its body with:

```javascript
  openWalkthrough() {
    if (!App.data) return;
    const customer = App.activeCustomer;
    if (!customer) { App.toast('Select a customer first', 'error'); return; }
    const existing = document.getElementById('walkthroughOverlay');
    if (existing) existing.remove();
    let active = App.getActiveWalkthrough(customer);
    if (!active) {
      const id = App.startWalkthrough(customer, []);
      active = App.getActiveWalkthrough(customer) || App._findWalkthrough(id);
    }
    const agenda = App.computeWalkthroughAgenda(customer);
    const esc = Dashboard.esc;
    const overlay = document.createElement('div');
    overlay.id = 'walkthroughOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:flex-start;justify-content:center;background:rgba(15,23,42,0.55);padding:24px 16px;overflow:auto';
    const sectionHtml = (sec) => {
      const status = (active.section_status || {})[sec.id] || 'pending';
      const chip = status === 'covered' ? '<span style="font-size:9px;background:var(--status-green);color:white;padding:1px 6px;border-radius:999px;margin-left:6px">Covered</span>' :
                   status === 'skipped' ? '<span style="font-size:9px;background:var(--text-muted);color:white;padding:1px 6px;border-radius:999px;margin-left:6px">Skipped</span>' : '';
      let signalsHtml = '';
      if (Array.isArray(sec.signals)) {
        signalsHtml = sec.signals.length
          ? '<ul style="margin:0;padding-left:18px;font-size:11px">' + sec.signals.slice(0, 10).map(s => {
              if (s.projectName) return '<li>' + esc(s.projectName) + (s.description ? ' — ' + esc(s.description) : '') + (s.score ? ' (score ' + s.score + ')' : '') + (s.dueDate ? ' (due ' + esc(s.dueDate) + ')' : '') + (s.remaining ? ' — ' + s.remaining + ' SP remaining' : '') + (s.field ? ' — ' + esc(s.field) : '') + '</li>';
              if (s.member) return '<li><strong>' + esc(s.member) + '</strong>' + (s.start ? ' off ' + esc(s.start) + ' → ' + esc(s.end) : '') + (s.endDate ? ' contract ends ' + esc(s.endDate) : '') + '</li>';
              if (s.field) return '<li>' + esc(s.field) + ': ' + esc(s.oldValue) + ' → ' + esc(s.newValue) + '</li>';
              if (s.forumName) return '<li>' + esc(s.forumName) + ' — ' + esc(s.description) + ' (' + esc(s.owner || '—') + ', due ' + esc(s.dueDate) + ')</li>';
              return '<li>' + esc(JSON.stringify(s).slice(0, 120)) + '</li>';
            }).join('') + '</ul>'
          : '<p style="margin:0;color:var(--text-muted);font-size:11px">Nothing to surface.</p>';
      } else if (sec.signals && typeof sec.signals === 'object') {
        // Object-shaped (capacity, backlog)
        signalsHtml = '<div style="font-size:11px;color:var(--text-dark-secondary)">' +
          Object.entries(sec.signals).filter(([k]) => !Array.isArray(sec.signals[k]) || k === 'staleProjects' || k === 'sustained' || k === 'upcomingPto' || k === 'contractEnds').map(([k, v]) => {
            if (Array.isArray(v) && v.length) return '<div><strong>' + esc(k) + ':</strong> ' + v.length + '</div>';
            if (typeof v !== 'object') return '<div><strong>' + esc(k) + ':</strong> ' + esc(String(v)) + '</div>';
            return '';
          }).filter(Boolean).join('') +
          '</div>';
      }
      const note = (active.section_notes || {})[sec.id] || '';
      const decisionForm = sec.id === 'decisions'
        ? '<div style="margin-top:8px;border-top:1px dashed var(--border-light);padding-top:8px">' +
            '<div style="font-weight:600;font-size:11px;margin-bottom:4px">Add decision</div>' +
            '<input type="text" id="wtDecText" placeholder="Decision (e.g. Defer DE Phase to S6)" style="width:100%;padding:4px 6px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:11px;margin-bottom:4px">' +
            '<input type="text" id="wtDecRationale" placeholder="Rationale (audit trail)" style="width:100%;padding:4px 6px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:11px;margin-bottom:4px">' +
            '<button class="btn btn-outline btn-sm" style="font-size:10px;padding:3px 8px" onclick="Sprint._wtAddDecision(\'' + esc(active.id) + '\')">Add decision</button>' +
            '<div style="font-weight:600;font-size:11px;margin:10px 0 4px">Add action</div>' +
            '<input type="text" id="wtActDesc" placeholder="Action description" style="width:100%;padding:4px 6px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:11px;margin-bottom:4px">' +
            '<input type="text" id="wtActOwner" placeholder="Owner" style="width:100%;padding:4px 6px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:11px;margin-bottom:4px">' +
            '<input type="date" id="wtActDue" style="width:100%;padding:4px 6px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:11px;margin-bottom:4px">' +
            '<button class="btn btn-outline btn-sm" style="font-size:10px;padding:3px 8px" onclick="Sprint._wtAddAction(\'' + esc(active.id) + '\')">Add action</button>' +
            '<div id="wtCapturedList" style="margin-top:8px;font-size:11px">' + Sprint._renderCaptured(active) + '</div>' +
          '</div>'
        : '';
      return '<details ' + (status === 'covered' ? '' : 'open') + ' style="border:1px solid var(--border-light);border-radius:var(--radius-sm);margin-bottom:8px;background:var(--surface)">' +
        '<summary style="padding:8px 10px;cursor:pointer;font-weight:600;font-size:12px;display:flex;align-items:center;gap:8px">' +
          '<span>' + esc(sec.title) + chip + '</span>' +
          '<span style="margin-left:auto;font-size:10px;color:var(--text-muted);font-weight:400">' + esc(sec.summary || '') + '</span>' +
        '</summary>' +
        '<div style="padding:6px 12px 10px">' +
          signalsHtml +
          '<textarea data-wt-section="' + esc(sec.id) + '" placeholder="Notes for this section…" oninput="Sprint._wtSaveNote(\'' + esc(active.id) + '\',\'' + esc(sec.id) + '\',this.value)" style="width:100%;margin-top:6px;padding:5px 6px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:11px;font-family:inherit;resize:vertical;min-height:36px">' + esc(note) + '</textarea>' +
          '<div style="margin-top:6px;display:flex;gap:6px">' +
            '<button class="btn btn-outline btn-sm" style="font-size:10px;padding:3px 8px" onclick="Sprint._wtMarkCovered(\'' + esc(active.id) + '\',\'' + esc(sec.id) + '\')">Mark covered</button>' +
            '<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px" onclick="Sprint._wtMarkSkipped(\'' + esc(active.id) + '\',\'' + esc(sec.id) + '\')">Skip</button>' +
          '</div>' +
          decisionForm +
        '</div>' +
      '</details>';
    };
    overlay.innerHTML =
      '<div style="background:var(--surface,white);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:18px 22px;max-width:780px;width:100%;color:var(--text-dark);max-height:92vh;overflow:auto">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;gap:10px">' +
          '<div>' +
            '<h3 style="margin:0;font-size:15px;font-weight:700">Weekly Walkthrough — ' + esc(customer) + '</h3>' +
            '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">' +
              'Started ' + esc(active.started_at) + ' · ' +
              (agenda.lastWalkthroughAt ? 'last session ' + esc(agenda.lastWalkthroughAt) : 'first session') +
            '</div>' +
          '</div>' +
          '<button onclick="document.getElementById(\'walkthroughOverlay\').remove()" style="background:transparent;border:none;font-size:22px;line-height:1;cursor:pointer;color:var(--text-muted)" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div style="margin-bottom:10px">' +
          '<input type="text" id="wtAttendees" placeholder="Attendees (comma-separated)" value="' + esc((active.attendees || []).join(', ')) + '" oninput="Sprint._wtSaveAttendees(\'' + esc(active.id) + '\',this.value)" style="width:100%;padding:5px 8px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:12px">' +
        '</div>' +
        agenda.sections.map(sectionHtml).join('') +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:10px;border-top:1px solid var(--border-light);gap:8px">' +
          '<div style="font-size:11px;color:var(--text-muted)">Decisions: <strong id="wtDecCount">' + active.decisions.length + '</strong> · Actions: <strong id="wtActCount">' + active.actions.length + '</strong></div>' +
          '<div style="display:flex;gap:6px">' +
            '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'walkthroughOverlay\').remove()">Save &amp; Close</button>' +
            '<button class="btn btn-outline btn-sm" onclick="Report.exportWalkthroughMinutes(\'' + esc(active.id) + '\')">Export minutes</button>' +
            '<button class="btn btn-primary btn-sm" onclick="Sprint._wtComplete(\'' + esc(active.id) + '\')">Mark Done</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },

  _renderCaptured(wt) {
    const esc = Dashboard.esc;
    const decs = (wt.decisions || []).map(d => '<li><strong>Decision:</strong> ' + esc(d.text) + (d.rationale ? ' — <em>' + esc(d.rationale) + '</em>' : '') + '</li>').join('');
    const acts = (wt.actions || []).map(a => '<li><strong>Action:</strong> ' + esc(a.description) + ' (' + esc(a.owner || '—') + ', due ' + esc(a.due_date || '—') + ')</li>').join('');
    return (decs || acts) ? '<ul style="margin:0;padding-left:18px">' + decs + acts + '</ul>' : '<em style="color:var(--text-muted)">Nothing captured yet.</em>';
  },

  _wtSaveAttendees(id, raw) {
    const wt = App._findWalkthrough(id);
    if (!wt) return;
    wt.attendees = String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
    App.markDirty();
    App.saveToLocalStorage();
  },

  _wtSaveNote(id, sectionId, note) {
    App.setWalkthroughSectionNote(id, sectionId, note);
  },

  _wtMarkCovered(id, sectionId) {
    App.setWalkthroughSectionStatus(id, sectionId, 'covered');
    Sprint.openWalkthrough();
  },

  _wtMarkSkipped(id, sectionId) {
    App.setWalkthroughSectionStatus(id, sectionId, 'skipped');
    Sprint.openWalkthrough();
  },

  _wtAddDecision(id) {
    const text = document.getElementById('wtDecText');
    const rationale = document.getElementById('wtDecRationale');
    if (!text || !text.value.trim()) { App.toast('Decision text required', 'error'); return; }
    App.recordWalkthroughDecision(id, { text: text.value, rationale: rationale ? rationale.value : '' });
    Sprint.openWalkthrough();
  },

  _wtAddAction(id) {
    const desc = document.getElementById('wtActDesc');
    const owner = document.getElementById('wtActOwner');
    const due = document.getElementById('wtActDue');
    if (!desc || !desc.value.trim()) { App.toast('Action description required', 'error'); return; }
    App.recordWalkthroughAction(id, { description: desc.value, owner: owner ? owner.value : '', due_date: due ? due.value : null });
    Sprint.openWalkthrough();
  },

  _wtComplete(id) {
    App.completeWalkthrough(id);
    App.toast('Walkthrough completed — minutes generated', 'success');
    document.getElementById('walkthroughOverlay').remove();
    Report.exportWalkthroughMinutes(id);
  },
```

- [ ] **Step 4: Run, verify pass**

```bash
npm run test:unit -- tests/render/walkthrough.test.mjs
```

- [ ] **Step 5: Run full unit suite**

```bash
npm run test:unit
```

- [ ] **Step 6: Commit**

```bash
git add tests/render/walkthrough.test.mjs index.html
git commit -m "feat(walkthrough): sectioned overlay with notes, decisions, actions, complete flow"
```

---

## Task 5: E2E spec + final verify + push

**Files:**
- Create: `tests/e2e/walkthrough.spec.ts`.

- [ ] **Step 1: Write spec**

```typescript
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test.describe('Walkthrough — full ritual', () => {
  test('open → record decision → record action → complete', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const A: any = (window as any).App;
      const id = A.startWalkthrough('GCC', ['SM']);
      A.recordWalkthroughDecision(id, { text: 'E2E decision', rationale: 'E2E rationale' });
      A.recordWalkthroughAction(id, { description: 'E2E action', owner: 'PO', due_date: '2026-04-30' });
      const completed = A.completeWalkthrough(id);
      const wt = A.data.walkthroughs.find((w: any) => w.id === id);
      return completed && !!wt.completed_at && wt.decisions.length === 1 && wt.actions.length === 1 && (typeof wt.minutes_html === 'string') && wt.minutes_html.length > 0;
    });
    expect(ok).toBe(true);
  });

  test('Sprint.openWalkthrough renders sectioned overlay', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => (window as any).Sprint.openWalkthrough());
    await expect(page.locator('#walkthroughOverlay')).toContainText(/Weekly Walkthrough/);
    await expect(page.locator('#walkthroughOverlay')).toContainText(/Decisions/);
  });
});
```

- [ ] **Step 2: Run E2E + full suite**

```bash
npm run test:e2e -- walkthrough.spec.ts
npm test
```

- [ ] **Step 3: Commit + push**

```bash
git add tests/e2e/walkthrough.spec.ts
git commit -m "test(e2e): walkthrough — open, record decision/action, complete, minutes"
git push
```

---

## Self-review checklist (MD-endorsement bar)

- [ ] `App.computeWalkthroughAgenda(customer)` returns 9 sections in stable order.
- [ ] Each section has typed signals derived from real data (audit log, risks, status, forums, sprints, capacity).
- [ ] `App.startWalkthrough` → `App.recordWalkthroughDecision` → `App.recordWalkthroughAction` → `App.completeWalkthrough` lifecycle persists into `App.data.walkthroughs[]`.
- [ ] `recordWalkthroughDecision` writes an audit-log entry tagged `walkthrough_decision` with rationale.
- [ ] `recordWalkthroughAction` pushes the action into the named forum's `actions[]`.
- [ ] `completeWalkthrough` sets `completed_at` and `minutes_html`.
- [ ] 53rd entry archives the oldest into `walkthroughs_archive[]`.
- [ ] `Report.buildWalkthroughMinutesDoc(id)` returns an HTML doc with attendees, decisions, actions, section notes.
- [ ] `Sprint.openWalkthrough()` renders 9 section headers in order, with notes textareas, Mark covered / Skip toggles, and a Decisions form.
- [ ] Reopening with an in-progress session resumes the same walkthrough (`getActiveWalkthrough` finds it).
- [ ] `npm test` is green.
- [ ] Senior manager can describe the walkthrough in one paragraph without naming code symbols.
