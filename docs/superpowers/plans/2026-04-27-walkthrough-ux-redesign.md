# Walkthrough UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the section-bundled walkthrough overlay with project-bundled cards: each project gets one card with everything (RAG, status, chips, risks, notes), cards are ordered by attention score, and the visual rewards completion.

**Architecture:** Two pure helpers (`computeProjectAttentionScore`, `computeWalkthroughCards`) precompute card data + ordering. `Sprint.openWalkthrough` renders a header strip + card list using new per-card render. CSS additions for state colours, RAG dots, progress strip. Reviewed-state persists on `walkthroughs[i].section_status['proj:'+id] = 'reviewed'`.

**Tech Stack:** Plain JS (zero build), CSS custom properties, vitest 2.1, @playwright/test 1.48, jsdom 25.

**Spec:** `docs/superpowers/specs/2026-04-27-walkthrough-ux-redesign-design.md`

---

## File Structure

| File | Role |
|---|---|
| `index.html` | All app code |
| `tests/unit/walkthrough-attention-score.test.mjs` | Score helper |
| `tests/unit/walkthrough-cards.test.mjs` | Card composer + ordering |
| `tests/render/walkthrough.test.mjs` | Extend — card render assertions |
| `tests/e2e/walkthrough.spec.ts` | Extend — Reviewed flow |

---

## Task 1: `App.computeProjectAttentionScore`

**Files:**
- Modify: `index.html` — add helper near `computeWalkthroughAgenda`.
- Test: `tests/unit/walkthrough-attention-score.test.mjs` (create).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/walkthrough-attention-score.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.computeProjectAttentionScore', () => {
  it('Blocked + 2 Red dimensions outranks a Green Implementation', async () => {
    resetIdSeq();
    const blocked = makeProject({ name: 'B', status: 'Blocked', rag_schedule: 'Red', rag_resourcing: 'Red', size_total: 5 });
    const green   = makeProject({ name: 'G', status: 'In Progress', rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green', size_total: 5 });
    const app = await loadApp(makeDataset({ projects: [blocked, green] }));
    expect(app.App.computeProjectAttentionScore(blocked)).toBeGreaterThan(app.App.computeProjectAttentionScore(green));
    app.teardown();
  });

  it('Run/BAU sinks below all other lifecycle stages', async () => {
    resetIdSeq();
    const bau    = makeProject({ name: 'BAU', status: 'In Progress', rag_schedule: 'Green', lifecycle_stage: 'Run/BAU', size_total: 5 });
    const idea   = makeProject({ name: 'IDEA', status: 'Not Started', rag_schedule: 'Green', lifecycle_stage: 'Idea', size_total: 5 });
    const app = await loadApp(makeDataset({ projects: [bau, idea] }));
    expect(app.App.computeProjectAttentionScore(bau)).toBeLessThan(app.App.computeProjectAttentionScore(idea));
    app.teardown();
  });

  it('open risks add to score (capped at 5 risks)', async () => {
    resetIdSeq();
    const noRisk = makeProject({ name: 'A', status: 'In Progress', rag_schedule: 'Green' });
    const withRisks = makeProject({ name: 'B', status: 'In Progress', rag_schedule: 'Green' });
    withRisks.risks_register = [
      { description: 'r1', impact: 5, probability: 5, status: 'open' },
      { description: 'r2', impact: 4, probability: 4, status: 'open' }
    ];
    const app = await loadApp(makeDataset({ projects: [noRisk, withRisks] }));
    expect(app.App.computeProjectAttentionScore(withRisks)).toBeGreaterThan(app.App.computeProjectAttentionScore(noRisk));
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/unit/walkthrough-attention-score.test.mjs
```

- [ ] **Step 3: Implement**

In `index.html` find `computeWalkthroughAgenda` and add immediately above it:

```javascript
  // Walkthrough attention score — drives card ordering. Higher = more attention needed.
  // Components (per spec):
  //   1000 × #Red RAG dimensions
  //    500 × Blocked
  //    200 × At Risk
  //    100 × #Amber RAG dimensions
  //     50 × min(open_risks, 5)
  //     10 × min(days_since_last_updated, 30)
  //   +size_total × 0.5 (tiebreak)
  //   −1000 × Run/BAU (sinks)
  computeProjectAttentionScore(project) {
    if (!project) return 0;
    let score = 0;
    const reds = ['rag_schedule', 'rag_resourcing', 'rag_scope'].filter(f => project[f] === 'Red').length;
    const ambers = ['rag_schedule', 'rag_resourcing', 'rag_scope'].filter(f => project[f] === 'Amber').length;
    score += 1000 * reds;
    if (project.status === 'Blocked') score += 500;
    if (project.status === 'At Risk') score += 200;
    score += 100 * ambers;
    const openRisks = (project.risks_register || []).filter(r => (r.status || 'open') === 'open').length;
    score += 50 * Math.min(openRisks, 5);
    const lastTouchMs = project.last_updated ? new Date(project.last_updated).getTime() : 0;
    const daysSince = lastTouchMs ? Math.min(30, Math.round((Date.now() - lastTouchMs) / 86400000)) : 30;
    score += 10 * daysSince;
    score += (project.size_total || 0) * 0.5;
    if (project.lifecycle_stage === 'Run/BAU') score -= 1000;
    return Math.round(score);
  },
```

- [ ] **Step 4: Run, verify pass**

```bash
npm run test:unit -- tests/unit/walkthrough-attention-score.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/walkthrough-attention-score.test.mjs index.html
git commit -m "feat(walkthrough): computeProjectAttentionScore — drives card ordering"
```

---

## Task 2: `App.computeWalkthroughCards`

**Files:**
- Modify: `index.html` — add helper near `computeProjectAttentionScore`.
- Test: `tests/unit/walkthrough-cards.test.mjs` (create).

- [ ] **Step 1: Failing test**

Create `tests/unit/walkthrough-cards.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.computeWalkthroughCards', () => {
  it('returns one card per active project, sorted by attention desc', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const blocked = makeProject({ name: 'B', status: 'Blocked', rag_schedule: 'Red', size_total: 5 });
    const green   = makeProject({ name: 'G', status: 'In Progress', rag_schedule: 'Green', size_total: 5 });
    const app = await loadApp(makeDataset({ projects: [green, blocked], sprints, team_members: [makeMember()] }));
    const cards = app.App.computeWalkthroughCards('GCC');
    expect(cards).toHaveLength(2);
    expect(cards[0].project.name).toBe('B');
    expect(cards[1].project.name).toBe('G');
  });

  it('classifies state correctly', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const critical = makeProject({ name: 'C', status: 'In Progress', rag_schedule: 'Red', size_total: 5 });
    const watch    = makeProject({ name: 'W', status: 'In Progress', rag_schedule: 'Amber', size_total: 5 });
    const steady   = makeProject({ name: 'S', status: 'In Progress', rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green', size_total: 5 });
    const app = await loadApp(makeDataset({ projects: [critical, watch, steady], sprints }));
    const cards = app.App.computeWalkthroughCards('GCC');
    const c = cards.find(c => c.project.name === 'C');
    const w = cards.find(c => c.project.name === 'W');
    const s = cards.find(c => c.project.name === 'S');
    expect(c.state).toBe('critical');
    expect(w.state).toBe('watch');
    expect(s.state).toBe('steady');
  });

  it('excludes Complete and Closed projects', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const done = makeProject({ name: 'D', status: 'Complete', size_total: 5 });
    const live = makeProject({ name: 'L', status: 'In Progress', size_total: 5 });
    const app = await loadApp(makeDataset({ projects: [done, live], sprints }));
    const cards = app.App.computeWalkthroughCards('GCC');
    expect(cards.map(c => c.project.name)).toEqual(['L']);
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/unit/walkthrough-cards.test.mjs
```

- [ ] **Step 3: Implement**

Add to `App` (next to `computeProjectAttentionScore`):

```javascript
  computeWalkthroughCards(customer) {
    const projects = (this.data && this.data.projects || []).filter(p => p.customer === customer && p.status !== 'Complete' && p.status !== 'Closed');
    const sprints = (this.data && this.data.sprints || []).slice();
    const now = new Date();
    const activeSprint = sprints.find(s => !s.end_date || new Date(s.end_date) >= now);
    const cards = projects.map(p => {
      const reds = ['rag_schedule', 'rag_resourcing', 'rag_scope'].filter(f => p[f] === 'Red').length;
      const ambers = ['rag_schedule', 'rag_resourcing', 'rag_scope'].filter(f => p[f] === 'Amber').length;
      let state;
      if (reds > 0 || p.status === 'Blocked') state = 'critical';
      else if (ambers > 0 || p.status === 'At Risk') state = 'watch';
      else state = 'steady';
      const openRisks = (p.risks_register || []).filter(r => (r.status || 'open') === 'open').slice(0, 5);
      const chips = [];
      if (activeSprint) {
        Object.entries(p.skill_splits || {}).forEach(([sk, arr]) => {
          if (!Array.isArray(arr)) return;
          arr.forEach(sp => {
            if (sp.sprint !== activeSprint.sprint_id) return;
            if (sp.status === 'complete') return;
            chips.push({ skillKey: sk, skill: sk.replace(/^size_/, ''), points: sp.points || 0, completed: sp.completed || 0, sprintId: sp.sprint });
          });
        });
      }
      const lastTouchMs = p.last_updated ? new Date(p.last_updated).getTime() : 0;
      const lastUpdatedDays = lastTouchMs ? Math.round((Date.now() - lastTouchMs) / 86400000) : null;
      return {
        project: p,
        attentionScore: this.computeProjectAttentionScore(p),
        state,
        ragSummary: { schedule: p.rag_schedule || 'Green', resourcing: p.rag_resourcing || 'Green', scope: p.rag_scope || 'Green' },
        status: p.status,
        openRisks,
        chips,
        lastUpdatedDays,
        activeSprintId: activeSprint ? activeSprint.sprint_id : null
      };
    });
    cards.sort((a, b) => b.attentionScore - a.attentionScore);
    return cards;
  },
```

- [ ] **Step 4: Run, verify pass**

```bash
npm run test:unit -- tests/unit/walkthrough-cards.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/walkthrough-cards.test.mjs index.html
git commit -m "feat(walkthrough): computeWalkthroughCards — per-project bundled signals"
```

---

## Task 3: CSS additions for card states + RAG dots + progress strip

**Files:**
- Modify: `index.html` — add styles in the existing `<style>` block.

- [ ] **Step 1: Locate insertion point + add styles**

Find the line `</style>` in `index.html` (last occurrence inside the head). Just above it, insert:

```css
/* === Walkthrough redesign — project cards === */
.wt-overlay-shell { background: var(--surface, white); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); padding: 0; max-width: 920px; width: 100%; color: var(--text-dark); max-height: 92vh; display: flex; flex-direction: column; }
.wt-header-strip { padding: 14px 18px; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.wt-progress-bar { flex: 1; min-width: 220px; height: 8px; background: var(--surface-2); border-radius: 4px; overflow: hidden; position: relative; }
.wt-progress-fill { height: 100%; background: linear-gradient(90deg, var(--status-green), #22c55e); transition: width 0.4s ease; }
.wt-cohort-pill { font-size: 11px; padding: 3px 8px; border-radius: 999px; font-weight: 600; }
.wt-cohort-critical { background: var(--tint-red-weak); color: var(--status-red); }
.wt-cohort-watch { background: var(--tint-amber-weak); color: var(--status-amber); }
.wt-cohort-steady { background: var(--tint-green-weak); color: var(--status-green); }
.wt-up-next { font-size: 11px; color: var(--text-dark-secondary); padding: 3px 8px; background: var(--surface-2); border-radius: 999px; }
.wt-card-list { padding: 14px 18px; overflow-y: auto; flex: 1; }
.wt-card { border-radius: var(--radius-md); margin-bottom: 10px; transition: max-height 0.3s ease, opacity 0.3s ease, background 0.2s ease; overflow: hidden; }
.wt-card-critical { background: linear-gradient(135deg, var(--tint-red-weak), transparent 50%); border-left: 4px solid var(--status-red); }
.wt-card-watch { background: linear-gradient(135deg, var(--tint-amber-weak), transparent 50%); border-left: 4px solid var(--status-amber); }
.wt-card-steady { background: var(--surface); border-left: 3px solid var(--border-light); }
.wt-card-done { background: var(--surface-2); border-left: 3px solid var(--status-green); opacity: 0.85; }
.wt-card-reviewed { background: var(--surface); border-left: 3px solid var(--status-green); }
.wt-card-reviewed .wt-card-body { display: none; }
.wt-card-header { padding: 10px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; }
.wt-card-name { font-size: 13px; font-weight: 700; color: var(--text-dark); flex: 1; }
.wt-card-attention { font-size: 10px; padding: 2px 6px; border-radius: 3px; background: var(--surface-2); color: var(--text-dark-secondary); font-weight: 700; }
.wt-card-actions { display: flex; gap: 4px; }
.wt-card-action-btn { background: transparent; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 3px 8px; font-size: 10px; cursor: pointer; color: var(--text-dark-secondary); }
.wt-card-action-btn:hover { background: var(--surface-2); }
.wt-card-action-btn.pinned { background: var(--accent-blue); color: white; border-color: var(--accent-blue); }
.wt-card-action-btn.review { background: var(--status-green); color: white; border-color: var(--status-green); }
.wt-card-body { padding: 4px 14px 14px; display: grid; gap: 10px; }
.wt-rag-dots { display: inline-flex; gap: 6px; align-items: center; }
.wt-rag-dot { width: 22px; height: 22px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: white; transition: background 0.2s ease, transform 0.15s ease; }
.wt-rag-dot:hover { transform: scale(1.08); }
.wt-rag-Green { background: var(--status-green); }
.wt-rag-Amber { background: var(--status-amber); }
.wt-rag-Red { background: var(--status-red); }
.wt-card-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 11px; }
.wt-card-row > strong { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; min-width: 64px; }
.wt-chip-row { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; padding: 4px 0; font-size: 11px; }
.wt-chip-bar { height: 8px; background: var(--surface-2); border-radius: 4px; overflow: hidden; }
.wt-chip-bar-fill { height: 100%; background: var(--accent-blue); transition: width 0.3s ease; }
.wt-risk-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 11px; }
.wt-risk-row.closed { text-decoration: line-through; color: var(--text-muted); }
.wt-card-footer-strip { padding: 10px 18px 14px; border-top: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; background: var(--surface); }
.wt-reviewed-confirm { padding: 4px 14px; font-size: 11px; color: var(--text-muted); }
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "style(walkthrough): card states, RAG dots, progress strip, micro-animations"
```

---

## Task 4: Replace `Sprint.openWalkthrough` body with card-based render

**Files:**
- Modify: `index.html` — replace the body of `Sprint.openWalkthrough`.
- Test: `tests/render/walkthrough.test.mjs` — extend.

- [ ] **Step 1: Append failing test**

Append to `tests/render/walkthrough.test.mjs`:

```javascript
describe('Walkthrough — card-based redesign', () => {
  it('renders one card per project with RAG dots, status select, attention chip', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'P', status: 'Blocked', rag_schedule: 'Red', size_engineering: 10,
      skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 2, assigned_to: [], reasons: [] }] }
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Sprint.openWalkthrough();
    const overlay = app.window.document.getElementById('walkthroughOverlay');
    expect(overlay).not.toBeNull();
    const html = overlay.innerHTML;
    expect(html).toMatch(/wt-card/);
    expect(html).toMatch(/wt-rag-dots/);
    expect(html).toMatch(/wt-progress-bar/);
    expect(html).toMatch(/Attention/);
    app.teardown();
  });

  it('exposes Reviewed + Pin buttons on every card', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ name: 'P' })] }));
    app.App.activeCustomer = 'GCC';
    app.Sprint.openWalkthrough();
    const html = app.window.document.getElementById('walkthroughOverlay').innerHTML;
    expect(html).toMatch(/data-wt-card-review/);
    expect(html).toMatch(/data-wt-card-pin/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify fail**

```bash
npm run test:unit -- tests/render/walkthrough.test.mjs
```

- [ ] **Step 3: Replace `Sprint.openWalkthrough` body**

Use this Python helper to swap the function body deterministically. Save to `/tmp/swap-walkthrough.py` and run it:

```python
import re
path = 'index.html'
with open(path) as f: c = f.read()
m = re.search(r'  openWalkthrough\(\) \{[\s\S]*?\n  \},\n\n  _renderCaptured', c)
assert m, "openWalkthrough block not found"
new = open('/tmp/new-openwalkthrough.txt').read()
c = c[:m.start()] + new + c[m.end():]
open(path, 'w').write(c)
```

Save the new body to `/tmp/new-openwalkthrough.txt`:

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
      active = App._findWalkthrough(id);
    }
    const cards = App.computeWalkthroughCards(customer);
    const reviewed = (active.section_status || {});
    const reviewedCount = cards.filter(c => reviewed['proj:' + c.project.id] === 'reviewed').length;
    const totalCount = cards.length;
    const pct = totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0;
    const cohort = { critical: 0, watch: 0, steady: 0 };
    cards.forEach(c => { cohort[c.state] = (cohort[c.state] || 0) + 1; });
    const upNext = cards.find(c => reviewed['proj:' + c.project.id] !== 'reviewed');
    const esc = Dashboard.esc;
    const overlay = document.createElement('div');
    overlay.id = 'walkthroughOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:flex-start;justify-content:center;background:rgba(15,23,42,0.55);padding:24px 16px;overflow:auto';
    const headerStrip = '<div class="wt-header-strip">' +
      '<h3 style="margin:0;font-size:15px;font-weight:700">Weekly Walkthrough — ' + esc(customer) + '</h3>' +
      '<div class="wt-progress-bar" title="' + reviewedCount + ' of ' + totalCount + ' reviewed"><div class="wt-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div style="font-size:11px;color:var(--text-dark-secondary);font-weight:600">' + reviewedCount + ' / ' + totalCount + ' reviewed</div>' +
      '<span class="wt-cohort-pill wt-cohort-critical">' + cohort.critical + ' critical</span>' +
      '<span class="wt-cohort-pill wt-cohort-watch">' + cohort.watch + ' watch</span>' +
      '<span class="wt-cohort-pill wt-cohort-steady">' + cohort.steady + ' steady</span>' +
      (upNext ? '<span class="wt-up-next">Up next: ' + esc(upNext.project.name) + '</span>' : '<span class="wt-up-next" style="color:var(--status-green);font-weight:700">All caught up ✓</span>') +
      '<button onclick="document.getElementById(\'walkthroughOverlay\').remove()" style="background:transparent;border:none;font-size:22px;line-height:1;cursor:pointer;color:var(--text-muted);margin-left:auto" aria-label="Close">&times;</button>' +
    '</div>';
    const body = '<div class="wt-card-list">' + cards.map(card => Sprint._wtRenderCard(card, active)).join('') + '</div>';
    const footer = '<div class="wt-card-footer-strip">' +
      '<div style="font-size:11px;color:var(--text-muted)">Decisions: <strong>' + active.decisions.length + '</strong> · Actions: <strong>' + active.actions.length + '</strong></div>' +
      '<div style="display:flex;gap:6px">' +
        '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'walkthroughOverlay\').remove()">Save &amp; Close</button>' +
        '<button class="btn btn-outline btn-sm" onclick="Report.exportWalkthroughMinutes(\'' + esc(active.id) + '\')">Export minutes</button>' +
        '<button class="btn btn-primary btn-sm" onclick="Sprint._wtComplete(\'' + esc(active.id) + '\')">Mark Done</button>' +
      '</div>' +
    '</div>';
    overlay.innerHTML = '<div class="wt-overlay-shell">' + headerStrip + body + footer + '</div>';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },

  _wtRenderCard(card, active) {
    const esc = Dashboard.esc;
    const p = card.project;
    const wid = active.id;
    const reviewedKey = 'proj:' + p.id;
    const isReviewed = (active.section_status || {})[reviewedKey] === 'reviewed';
    const isPinned = !!Sprint._wtPinned[p.id];
    if (isReviewed && !isPinned) {
      return '<div class="wt-card wt-card-reviewed" data-wt-card="' + esc(p.id) + '"><div class="wt-card-header" onclick="Sprint._wtUnreview(\'' + esc(wid) + '\',\'' + esc(p.id) + '\')"><div class="wt-card-name">✓ ' + esc(p.name) + ' reviewed</div><span class="wt-card-attention">Score ' + card.attentionScore + '</span></div></div>';
    }
    const lifeChip = (App.lifecycleStageChip ? App.lifecycleStageChip(p) : '');
    const ragDot = (dim, val) => '<div class="wt-rag-dot wt-rag-' + val + '" data-wt-card-rag="' + dim + '" title="' + dim + ' (click to cycle)" onclick="event.stopPropagation();Sprint._wtCycleRag(\'' + esc(wid) + '\',\'' + esc(p.id) + '\',\'' + dim + '\')">' + dim.charAt(0).toUpperCase() + '</div>';
    const statusOpts = ['Not Started', 'In Progress', 'On Hold', 'At Risk', 'Blocked', 'Complete'].map(s => '<option value="' + s + '"' + (p.status === s ? ' selected' : '') + '>' + s + '</option>').join('');
    const chipsHtml = card.chips.length
      ? card.chips.map(ch => {
          const total = ch.points || 0;
          const done = ch.completed || 0;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          return '<div class="wt-chip-row">' +
            '<div><strong>' + esc(ch.skill) + '</strong> <span style="color:var(--text-muted)">(' + esc(ch.sprintId) + ')</span></div>' +
            '<div class="wt-chip-bar" style="width:120px"><div class="wt-chip-bar-fill" style="width:' + pct + '%"></div></div>' +
            '<input type="number" min="0" max="' + total + '" value="' + done + '" onchange="Sprint._wtCardChipChange(\'' + esc(wid) + '\',\'' + esc(p.id) + '\',\'' + esc(ch.skillKey) + '\',\'' + esc(ch.sprintId) + '\',this.value)" style="width:54px;font-size:11px;padding:2px 4px"> / ' + total +
          '</div>';
        }).join('')
      : '<div style="font-size:11px;color:var(--text-muted)">No open chips this sprint.</div>';
    const risksHtml = card.openRisks.length
      ? card.openRisks.map(r => {
          const score = (r.impact || 0) * (r.probability || 0);
          const ri = (p.risks_register || []).findIndex(x => x === r);
          return '<div class="wt-risk-row"><span style="flex:1">' + esc(r.description || '') + ' <span style="color:var(--text-muted)">(score ' + score + ')</span></span>' +
            '<button class="wt-card-action-btn" onclick="Sprint._wtCardRisk(\'' + esc(wid) + '\',\'' + esc(p.id) + '\',' + ri + ',\'closed\')">Close</button>' +
            '<button class="wt-card-action-btn" onclick="Sprint._wtCardRisk(\'' + esc(wid) + '\',\'' + esc(p.id) + '\',' + ri + ',\'accepted\')">Accept</button>' +
          '</div>';
        }).join('')
      : '<div style="font-size:11px;color:var(--text-muted)">No open risks.</div>';
    const note = (active.section_notes || {})['proj:' + p.id] || '';
    return '<div class="wt-card wt-card-' + esc(card.state) + '" data-wt-card="' + esc(p.id) + '">' +
      '<div class="wt-card-header">' +
        '<div class="wt-card-name">' + esc(p.name) + lifeChip + '</div>' +
        '<span class="wt-card-attention">Attention ' + card.attentionScore + '</span>' +
        '<div class="wt-card-actions">' +
          '<button class="wt-card-action-btn' + (isPinned ? ' pinned' : '') + '" data-wt-card-pin="' + esc(p.id) + '" title="Pin to keep open" onclick="event.stopPropagation();Sprint._wtTogglePin(\'' + esc(p.id) + '\')">📌</button>' +
          '<button class="wt-card-action-btn review" data-wt-card-review="' + esc(p.id) + '" title="Mark reviewed" onclick="event.stopPropagation();Sprint._wtMarkProjectReviewed(\'' + esc(wid) + '\',\'' + esc(p.id) + '\')">✓ Reviewed</button>' +
        '</div>' +
      '</div>' +
      '<div class="wt-card-body">' +
        '<div class="wt-card-row">' +
          '<strong>Status</strong><select onchange="Sprint._wtStatusChange(\'' + esc(wid) + '\',\'' + esc(p.id) + '\',this.value)" style="font-size:11px;padding:2px 4px">' + statusOpts + '</select>' +
          '<strong style="margin-left:14px">RAG</strong><div class="wt-rag-dots">' + ragDot('schedule', card.ragSummary.schedule) + ragDot('resourcing', card.ragSummary.resourcing) + ragDot('scope', card.ragSummary.scope) + '</div>' +
          '<span style="margin-left:auto;font-size:10px;color:var(--text-muted)">Last updated ' + (card.lastUpdatedDays != null ? card.lastUpdatedDays + 'd ago' : 'never') + '</span>' +
        '</div>' +
        '<div><strong style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px">This sprint</strong>' + chipsHtml + '</div>' +
        '<div><strong style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px">Risks</strong>' + risksHtml + '</div>' +
        '<textarea placeholder="Notes for this project…" oninput="App.setWalkthroughSectionNote(\'' + esc(wid) + '\',\'proj:' + esc(p.id) + '\',this.value)" style="width:100%;padding:5px 6px;border:1px solid var(--border-light);border-radius:var(--radius-sm);font-size:11px;font-family:inherit;resize:vertical;min-height:36px">' + esc(note) + '</textarea>' +
      '</div>' +
    '</div>';
  },

  _wtPinned: {},

  _wtTogglePin(pid) {
    Sprint._wtPinned[pid] = !Sprint._wtPinned[pid];
    Sprint.openWalkthrough();
  },

  _wtCycleRag(wid, pid, dim) {
    const p = (App.data.projects || []).find(pr => pr.id === pid);
    if (!p) return;
    const field = 'rag_' + dim;
    const order = ['Green', 'Amber', 'Red'];
    const cur = p[field] || 'Green';
    const next = order[(order.indexOf(cur) + 1) % 3];
    App.updateProjectRag(pid, dim, next, wid, '');
    Sprint.openWalkthrough();
  },

  _wtCardChipChange(wid, pid, skillKey, sprintId, val) {
    App.updateChipProgress(pid, skillKey, sprintId, val, wid);
    if (App.toast) App.toast('Progress updated', 'success');
  },

  _wtCardRisk(wid, pid, ri, status) {
    App.updateRiskStatus(pid, ri, status, wid, '');
    if (App.toast) App.toast('Risk ' + status, 'success');
    Sprint.openWalkthrough();
  },

  _wtMarkProjectReviewed(wid, pid) {
    App.setWalkthroughSectionStatus(wid, 'proj:' + pid, 'reviewed');
    Sprint.openWalkthrough();
  },

  _wtUnreview(wid, pid) {
    App.setWalkthroughSectionStatus(wid, 'proj:' + pid, 'pending');
    Sprint.openWalkthrough();
  },

  _renderCaptured
```

(The trailing `_renderCaptured` keeps the file's existing helper attached.)

- [ ] **Step 4: Apply the swap**

```bash
cat <<'TXT' > /tmp/new-openwalkthrough.txt
<paste exactly the new body shown in step 3 above (without the trailing "_renderCaptured" line — that's a marker for the swap script to know where the new block ends and the old code resumes)>
TXT
```

To make this concrete and avoid the marker dance, use the simpler Python in-place edit:

```python
import re
p = 'index.html'
c = open(p).read()
m = re.search(r'  openWalkthrough\(\) \{[\s\S]*?\n  \},\n\n  _renderCaptured', c)
new_open_walkthrough = '''<paste the new openWalkthrough + helpers block>'''
c = c[:m.start()] + new_open_walkthrough + '\n  _renderCaptured' + c[m.end():]
open(p, 'w').write(c)
```

Run the python after pasting the new block string into the script.

- [ ] **Step 5: Run tests**

```bash
npm run test:unit -- tests/render/walkthrough.test.mjs
```

- [ ] **Step 6: Run full suite**

```bash
npm run test:unit
```

- [ ] **Step 7: Commit**

```bash
git add tests/render/walkthrough.test.mjs index.html
git commit -m "feat(walkthrough): card-based render — project-bundled, attention-ordered"
```

---

## Task 5: E2E + final verify + push + merge

**Files:**
- Modify: `tests/e2e/walkthrough.spec.ts` — extend.

- [ ] **Step 1: Append spec**

```typescript
test.describe('Walkthrough — card UX', () => {
  test('cards render, can be marked reviewed, and stay collapsed', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => (window as any).Sprint.openWalkthrough());
    const overlay = page.locator('#walkthroughOverlay');
    await expect(overlay).toContainText(/Weekly Walkthrough/);
    await expect(overlay.locator('.wt-card').first()).toBeVisible();
    // Mark first card reviewed
    const firstReview = overlay.locator('[data-wt-card-review]').first();
    const cardId = await firstReview.getAttribute('data-wt-card-review');
    await firstReview.click();
    // After click, overlay re-renders; same card should now be in reviewed (collapsed) state
    await expect(overlay.locator('.wt-card[data-wt-card="' + cardId + '"]')).toHaveClass(/wt-card-reviewed/);
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
git add tests/e2e/walkthrough.spec.ts docs/superpowers/plans/2026-04-27-walkthrough-ux-redesign.md
git commit -m "test(e2e): walkthrough — card UX (render + reviewed-state collapse)"
```

- [ ] **Step 4: Push + merge to main**

```bash
git push -u origin walkthrough-ux-redesign
git checkout main
git pull origin main --ff-only
git merge walkthrough-ux-redesign --no-ff -m "Merge walkthrough-ux-redesign: project-bundled, priority-ordered cards"
npm test
git push origin main
```

---

## Self-review checklist (MD-endorsement bar)

- [ ] `App.computeProjectAttentionScore(p)` returns a deterministic number per project; Blocked > Red > Amber > size; Run/BAU sinks.
- [ ] `App.computeWalkthroughCards(customer)` returns one card per active project, sorted by score desc, with state classification.
- [ ] CSS additions render Critical / Watch / Steady / Done card states with correct gradients + left-border accents.
- [ ] `Sprint.openWalkthrough` renders a header strip (progress bar + cohort pills + Up-next), card list, footer.
- [ ] Each card has: name + lifecycle chip + attention chip + Pin + Reviewed buttons.
- [ ] Card body has: status select, three RAG dots (clickable to cycle), chip rows with mini progress bars, risk rows with Close/Accept, notes textarea.
- [ ] Pressing Reviewed collapses the card to a one-line confirmation; the same project re-opens on click.
- [ ] All inline edits still call the existing `App.update*` helpers (no behaviour regression).
- [ ] `npm test` is green.
- [ ] Branch merged into main.
