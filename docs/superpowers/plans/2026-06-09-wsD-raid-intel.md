# Workstream D — RAID Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the RAID page surface what to act on — a `RaidIntel` urgency layer (severity + time), an Attention triage panel (risks to watch / oldest open issues / aging governance decisions), and enriched urgency-sorted tables — backed by new `risk.target_date` + `issue.opened_date` signals seeded into the demo.

**Architecture:** Build on the existing `RaidView` (already has `_collect`, `_score`, `_scoreChip`, sort-by-score, customer-scoping). Add a pure-function `RaidIntel` helper, an Attention band above the tabs, target/age columns in `_renderTable`, capture in `DetailPanel.renderRisks`/issues editor, and demo-data seed.

**Tech Stack:** Vanilla single-file `index.html`; vitest + jsdom; Playwright.

**Conventions:** `:root` tokens, inline SVG (no emojis), `Dashboard.esc()`, customer-scoped, persist via `markDirty + saveToLocalStorage`. Run tests: `npm test`. NOTE: migration already defaults `risk.impact=3`/`probability=3`, and `RaidView` already shows a severity chip + sorts risks by score — D extends that with time (target/age).

---

## File Structure

- **Modify:** `index.html` — migration (~4939); new `RaidIntel` object (near `RaidView` ~37196); Attention panel in `RaidView.render`/`_renderActiveTab` (~37280); `_renderTable` columns (~37340); `DetailPanel.renderRisks` + issues editor (capture).
- **Modify:** `portfolio-data-demo.json` AND the inline `#demoDataset` block in `index.html` (demo seed — keep equal; WS-H sync-test enforces).
- **Create tests:** `tests/unit/raid-intel.test.mjs`, `tests/render/raid-attention.test.mjs`, `tests/unit/raid-seed.test.mjs`.

---

## Task D1: Data signals — migration + demo seed

**Files:** Modify `index.html` (migration ~4939), `portfolio-data-demo.json`, inline `#demoDataset`; Create `tests/unit/raid-seed.test.mjs`

- [ ] **Step 1: Write the failing test** — `tests/unit/raid-seed.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const demo = JSON.parse(readFileSync(join(root, 'portfolio-data-demo.json'), 'utf8'));

describe('D1 demo RAID seed', () => {
  it('risks have varied impact/probability and at least some target_dates', () => {
    const risks = (demo.projects || []).flatMap(p => p.risks_register || []);
    expect(risks.length).toBeGreaterThan(0);
    expect(risks.every(r => Number.isInteger(r.impact) && r.impact >= 1 && r.impact <= 5)).toBe(true);
    expect(risks.every(r => Number.isInteger(r.probability) && r.probability >= 1 && r.probability <= 5)).toBe(true);
    const severities = new Set(risks.map(r => r.impact * r.probability));
    expect(severities.size).toBeGreaterThan(1); // not all identical
    expect(risks.some(r => r.target_date)).toBe(true);
  });
  it('issues have opened_dates', () => {
    const issues = (demo.projects || []).flatMap(p => p.issues_register || []);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every(i => typeof i.opened_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(i.opened_date))).toBe(true);
  });
  it('inline #demoDataset deep-equals portfolio-data-demo.json (WS-H sync)', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const m = html.match(/<script type="application\/json" id="demoDataset">([\s\S]*?)<\/script>/);
    expect(m).toBeTruthy();
    expect(JSON.parse(m[1])).toEqual(demo);
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/unit/raid-seed.test.mjs` (risks lack impact/probability/target_date; issues lack opened_date).

- [ ] **Step 3: Migration — add the new fields defensively.** In `migrateSchema` near the risk-ensure block (~4941-4944), the risk loop already defaults impact/probability; leave that. Do NOT fabricate `target_date`/`opened_date` for user data (absence = unknown). No code change strictly required here unless a guard is missing; confirm `issues_register` exists (add `if (!p.issues_register) p.issues_register = [];` near the risks guard if not already present). Report what you found.

- [ ] **Step 4: Seed the demo data.** Write a one-off node script (run, then delete — do not commit) that, for `portfolio-data-demo.json`: gives each risk a **varied** `impact` (1–5) and `probability` (1–5) — vary across risks so severities span low/med/high (≥15 for a few) — and a `target_date` for most (a deterministic spread relative to a fixed base date `2026-06-09`: some overdue e.g. `2026-05-20`, some within 30d e.g. `2026-06-25`, some far e.g. `2026-09-30`); and gives each issue an `opened_date` (some >60d old e.g. `2026-03-15`, some recent e.g. `2026-05-28`). Use a deterministic per-index scheme (no Math.random) so the file is stable. Pretty-print with 2-space indent matching the file. Then run the SAME transform's output into the inline `#demoDataset` block (re-run the WS-H populate step: replace the island's content with the updated `portfolio-data-demo.json`). Verify both parse and are byte-equal in content.

- [ ] **Step 5: Run the seed test, verify PASS** — `npx vitest run tests/unit/raid-seed.test.mjs tests/unit/demo-dataset-inline.test.mjs` (the WS-H sync test must still pass — both demo copies updated).

- [ ] **Step 6: Regression** — `npx vitest run`. Expect green.

- [ ] **Step 7: Commit**

```bash
git add index.html portfolio-data-demo.json tests/unit/raid-seed.test.mjs
git commit -m "feat(raid): seed demo risks (impact/prob/target_date) + issues (opened_date)"
```

---

## Task D2: Capture target_date / opened_date in the RAID editor

**Files:** Modify `index.html` (`DetailPanel.renderRisks` + the issues editor)

- [ ] **Step 1: Locate the editors.** `DetailPanel.renderRisks` builds the risk edit rows (impact/probability inputs already exist — line ~9167 references it). Find the analogous issues editor (search `issues_register` render in DetailPanel). Read both.

- [ ] **Step 2: Write the failing test** — append to `tests/unit/raid-seed.test.mjs` (or a new `tests/render/raid-editor.test.mjs`), a render test: open a project's detail panel RAID tab and assert the risk editor exposes a `target_date` input and the issue editor exposes an `opened_date` input. Use the existing detail-panel test pattern (loadApp + DetailPanel.open + query the RAID tab). Concretely assert `panel.querySelector('[data-raid-field="target_date"]')` (risk) and `[data-raid-field="opened_date"]` (issue) exist after opening a project with a risk + issue. (Adapt selectors to the actual editor markup you add.)

- [ ] **Step 3: Add the inputs.** In `DetailPanel.renderRisks` risk row/edit: add a `target_date` `<input type="date" data-raid-field="target_date">` next to the existing impact/probability controls, wired to write `risk.target_date` through the existing risk-update path (mirror how impact/probability persist — `App.updateRiskScore` or the field-write + `markDirty`+`saveToLocalStorage`). In the issues editor: add an `opened_date` `<input type="date" data-raid-field="opened_date">`; when a NEW issue is created, default `opened_date` to today (`new Date().toISOString().split('T')[0]`). Token-styled, no emoji. Persist via the normal path.

- [ ] **Step 4: Run the test, verify PASS**, then **regression** — `npx vitest run`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/raid-editor.test.mjs
git commit -m "feat(raid): capture risk target_date + issue opened_date in the editor"
```

---

## Task D3: `RaidIntel` urgency helper (pure functions)

**Files:** Modify `index.html` (add `RaidIntel` near `RaidView`); Create `tests/unit/raid-intel.test.mjs`

- [ ] **Step 1: Write the failing test** — `tests/unit/raid-intel.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

const TODAY = '2026-06-09';
async function intel() { const app = await loadApp(makeDataset({})); return { R: app.RaidIntel, teardown: app.teardown }; }

describe('RaidIntel', () => {
  it('severity = impact*probability with bands', async () => {
    const { R, teardown } = await intel();
    expect(R.riskSeverity({ impact: 5, probability: 5 })).toBe(25);
    expect(R.riskSeverity({ impact: 0, probability: 5 })).toBe(0);
    expect(R.severityBand(15)).toBe('high');
    expect(R.severityBand(8)).toBe('medium');
    expect(R.severityBand(7)).toBe('low');
    teardown();
  });
  it('riskNearTarget: overdue or within 30 days', async () => {
    const { R, teardown } = await intel();
    expect(R.riskNearTarget({ target_date: '2026-05-01' }, TODAY)).toBe(true);  // overdue
    expect(R.riskNearTarget({ target_date: '2026-06-25' }, TODAY)).toBe(true);  // within 30
    expect(R.riskNearTarget({ target_date: '2026-09-30' }, TODAY)).toBe(false); // far
    expect(R.riskNearTarget({ target_date: null }, TODAY)).toBe(false);
    teardown();
  });
  it('riskUrgency escalates near-target risks above equal-severity far ones', async () => {
    const { R, teardown } = await intel();
    const near = R.riskUrgency({ impact: 3, probability: 3, target_date: '2026-06-15' }, TODAY);
    const far = R.riskUrgency({ impact: 3, probability: 3, target_date: '2026-12-01' }, TODAY);
    expect(near).toBeGreaterThan(far);
    teardown();
  });
  it('issueAgeDays + aging bands', async () => {
    const { R, teardown } = await intel();
    expect(R.issueAgeDays({ opened_date: '2026-05-10' }, TODAY)).toBe(30);
    expect(R.issueAgeDays({ opened_date: null }, TODAY)).toBe(null);
    expect(R.issueAging({ opened_date: '2026-05-10' }, TODAY)).toBe('amber'); // 30
    expect(R.issueAging({ opened_date: '2026-04-09' }, TODAY)).toBe('red');   // 61
    expect(R.issueAging({ opened_date: '2026-06-01' }, TODAY)).toBe(null);    // 8
    teardown();
  });
  it('decisionAgeDays + aging at 21d', async () => {
    const { R, teardown } = await intel();
    expect(R.decisionAgeDays({ date: '2026-05-19' }, TODAY)).toBe(21);
    expect(R.decisionAging({ date: '2026-05-19' }, TODAY)).toBe(true);
    expect(R.decisionAging({ date: '2026-06-01' }, TODAY)).toBe(false);
    teardown();
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/unit/raid-intel.test.mjs` (`RaidIntel` undefined).

- [ ] **Step 3: Add the `RaidIntel` object** (top-level `const RaidIntel = { … };`, immediately before `const RaidView = {`):

```javascript
const RaidIntel = {
  ISSUE_AMBER: 30, ISSUE_RED: 60, DECISION_AGING: 21, RISK_NEAR_DAYS: 30,
  _daysBetween(fromISO, toISO) {
    if (!fromISO || !toISO) return null;
    const a = new Date(fromISO + 'T00:00:00Z').getTime();
    const b = new Date(toISO + 'T00:00:00Z').getTime();
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
  },
  riskSeverity(r) { return (parseInt(r.impact, 10) || 0) * (parseInt(r.probability, 10) || 0); },
  severityBand(score) { return score >= 15 ? 'high' : score >= 8 ? 'medium' : 'low'; },
  riskNearTarget(r, today) {
    if (!r.target_date) return false;
    const d = this._daysBetween(today, r.target_date); // +ve = in future, -ve = overdue
    return d === null ? false : d <= this.RISK_NEAR_DAYS; // overdue (<0) or within window
  },
  riskUrgency(r, today) {
    const sev = this.riskSeverity(r);
    return this.riskNearTarget(r, today) ? sev * 2 + 100 : sev; // near/overdue floats to the top
  },
  issueAgeDays(i, today) { return i.opened_date ? this._daysBetween(i.opened_date, today) : null; },
  issueAging(i, today) {
    const age = this.issueAgeDays(i, today);
    if (age === null) return null;
    return age >= this.ISSUE_RED ? 'red' : age >= this.ISSUE_AMBER ? 'amber' : null;
  },
  decisionAgeDays(d, today) { return d.date ? this._daysBetween(d.date, today) : null; },
  decisionAging(d, today) {
    const age = this.decisionAgeDays(d, today);
    return age !== null && age >= this.DECISION_AGING;
  },
  _today() { return new Date().toISOString().split('T')[0]; }
};
```

- [ ] **Step 4: Run, verify PASS** — `npx vitest run tests/unit/raid-intel.test.mjs`. Expose `RaidIntel` in the harness (`tests/harness/loadApp.mjs`, mirror RaidView).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/unit/raid-intel.test.mjs tests/harness/loadApp.mjs
git commit -m "feat(raid): RaidIntel urgency helper (severity + target/age proximity)"
```

---

## Task D4: Attention triage panel

**Files:** Modify `index.html` (`RaidView` — add `_renderAttention()`, call from `render()`); Create `tests/render/raid-attention.test.mjs`

- [ ] **Step 1: Write the failing test** — `tests/render/raid-attention.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function boot() {
  const app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [makeProject({ id: 'P1', name: 'Proj One', customer: 'Acme Industries',
      risks_register: [{ description: 'Hot risk', impact: 5, probability: 5, target_date: '2099-01-01', owner: 'A' }],
      issues_register: [{ id: 'i1', description: 'Old issue', status: 'open', owner: 'A', opened_date: '2000-01-01' }]
    })],
    governance_forums: [{ name: 'Steering', customer: 'Acme Industries', decisions: [{ text: 'Approve scope', state: 'Proposed', date: '2000-01-01' }], actions: [] }]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

describe('D4 RAID Attention panel', () => {
  it('renders the three groups with the seeded items', async () => {
    const app = await boot();
    app.App.navigate('raid');
    const host = app.document.getElementById('raidContent') || app.document.getElementById('viewRaid');
    const html = host.innerHTML;
    expect(html).toMatch(/Attention|Risks to watch/i);
    expect(html).toMatch(/Hot risk/);     // high-severity risk surfaced
    expect(html).toMatch(/Old issue/);    // aged open issue surfaced
    expect(html).toMatch(/Approve scope/);// aging pending decision surfaced
    app.teardown();
  });
  it('shows "all clear" groups when nothing is urgent', async () => {
    const app = await loadApp(makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1' }], projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })] }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('raid');
    const host = app.document.getElementById('raidContent') || app.document.getElementById('viewRaid');
    expect(host.innerHTML).toMatch(/all clear|nothing|no /i);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/render/raid-attention.test.mjs`.

- [ ] **Step 3: Add `_renderAttention()` to `RaidView`** and render it at the top of the RAID content. It reuses `_collect('risks')`/`_collect('issues')` (customer-scoped) and a pending-decisions collector mirroring `MyActions.collect` (governance forums for the active customer, decisions with state Proposed/Discussed). Use `RaidIntel` + `RaidIntel._today()`.

```javascript
  _pendingDecisions() {
    const out = [];
    const cust = App.activeCustomer;
    ((App.data && App.data.governance_forums) || []).forEach((forum, forumIdx) => {
      if (cust && forum.customer !== cust) return;
      (forum.decisions || []).forEach((d, dIdx) => {
        const state = d.state || 'Proposed';
        if (state === 'Proposed' || state === 'Discussed') out.push({ forum, forumIdx, decision: d, dIdx });
      });
    });
    return out;
  },
  _renderAttention() {
    const esc = Dashboard.esc;
    const today = RaidIntel._today();
    const isOpen = (row) => { const s = (row.status || '').toLowerCase(); return s !== 'closed' && s !== 'resolved' && s !== 'done' && s !== 'mitigated'; };
    // Risks to watch: open, high-sev (>=15) OR (medium >=8 AND near/overdue target), by urgency.
    const risks = this._collect('risks').filter(r => isOpen(r.row))
      .map(r => ({ ...r, sev: RaidIntel.riskSeverity(r.row), urg: RaidIntel.riskUrgency(r.row, today), near: RaidIntel.riskNearTarget(r.row, today) }))
      .filter(r => r.sev >= 15 || (r.sev >= 8 && r.near))
      .sort((a, b) => b.urg - a.urg).slice(0, 5);
    // Oldest open issues: open, age >= ISSUE_AMBER, by age desc.
    const issues = this._collect('issues').filter(r => isOpen(r.row))
      .map(r => ({ ...r, age: RaidIntel.issueAgeDays(r.row, today) }))
      .filter(r => r.age !== null && r.age >= RaidIntel.ISSUE_AMBER)
      .sort((a, b) => b.age - a.age).slice(0, 5);
    // Aging decisions: pending governance decisions, age >= DECISION_AGING, by age desc.
    const decisions = this._pendingDecisions()
      .map(d => ({ ...d, age: RaidIntel.decisionAgeDays(d.decision, today) }))
      .filter(d => d.age !== null && d.age >= RaidIntel.DECISION_AGING)
      .sort((a, b) => b.age - a.age).slice(0, 5);

    const sev = RaidIntel.severityBand;
    const group = (title, count, itemsHtml, emptyMsg) =>
      '<div class="raid-attn-group" style="flex:1;min-width:200px;background:var(--surface);border:1px solid var(--border-dim);border-radius:var(--radius-md);padding:10px 12px">' +
        '<div style="font-size:var(--fs-2xs);text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);font-weight:700;margin-bottom:6px">' + esc(title) + ' <span style="color:var(--text-dark)">' + count + '</span></div>' +
        (count ? itemsHtml : '<div style="font-size:var(--fs-2xs);color:var(--text-muted)">All clear</div>') +
      '</div>';
    const riskItems = risks.map(r =>
      '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px;cursor:pointer" onclick="RaidView.openDetailPanelFor(' + esc(JSON.stringify(r.project.id)) + ',\'risks\',' + r.idx + ')">' +
        this._scoreChip(r.sev) + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(r.row.description || '') + '">' + esc((r.row.description || '').slice(0, 60)) + '</span>' +
        '<span style="font-size:var(--fs-2xs);color:' + (r.near ? 'var(--status-red)' : 'var(--text-muted)') + '">' + (r.row.target_date ? (RaidIntel._daysBetween(today, r.row.target_date) < 0 ? 'overdue' : 'in ' + RaidIntel._daysBetween(today, r.row.target_date) + 'd') : '') + '</span>' +
      '</div>').join('');
    const issueItems = issues.map(r =>
      '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px;cursor:pointer" onclick="RaidView.openDetailPanelFor(' + esc(JSON.stringify(r.project.id)) + ',\'issues\',' + r.idx + ')">' +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(r.row.description || '') + '">' + esc((r.row.description || '').slice(0, 60)) + '</span>' +
        '<span style="font-size:var(--fs-2xs);font-weight:700;color:' + (RaidIntel.issueAging(r.row, today) === 'red' ? 'var(--status-red)' : 'var(--status-amber)') + '">open ' + r.age + 'd</span>' +
      '</div>').join('');
    const decisionItems = decisions.map(d =>
      '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px;cursor:pointer" onclick="RaidView._openForum(' + d.forumIdx + ')">' +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(d.decision.text || '') + '">' + esc((d.decision.text || '').slice(0, 60)) + '</span>' +
        '<span style="font-size:var(--fs-2xs);font-weight:700;color:var(--status-amber)">pending ' + d.age + 'd</span>' +
      '</div>').join('');

    return '<div class="raid-attention" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' +
      group('Risks to watch', risks.length, riskItems) +
      group('Oldest open issues', issues.length, issueItems) +
      group('Aging decisions', decisions.length, decisionItems) +
    '</div>';
  },
  _openForum(forumIdx) {
    App.navigate('governance');
    setTimeout(() => { const cards = document.querySelectorAll('.forum-card'); if (cards[forumIdx]) cards[forumIdx].scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80);
  },
```

Then in `_renderActiveTab` (or `render`), prepend the Attention panel to the `host.innerHTML`. The cleanest: in `_renderActiveTab`, build `const attn = this._renderAttention();` and set `host.innerHTML = attn + toolbar + body;`. (The panel re-renders with each tab switch, which is fine — it's customer-scoped and cheap.)

- [ ] **Step 4: Run, verify PASS** — `npx vitest run tests/render/raid-attention.test.mjs`.

- [ ] **Step 5: Regression** — `npx vitest run`. Existing RAID tests (`raid-customer-scope`, `slot-h-nav-raid`) must stay green (the Attention panel is additive above the table). If a test asserted exact `raidContent` innerHTML, adjust it to allow the prepended panel.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/render/raid-attention.test.mjs
git commit -m "feat(raid): Attention triage panel (risks to watch / oldest issues / aging decisions)"
```

---

## Task D5: Enriched tables — target/age columns + urgency sort

**Files:** Modify `index.html` (`RaidView._renderTable` ~37340, `_sortRows`/`_score` usage); extend `tests/render/raid-attention.test.mjs` or a new `tests/render/raid-table-intel.test.mjs`

- [ ] **Step 1: Write the failing test** — create `tests/render/raid-table-intel.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function boot() {
  const app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [makeProject({ id: 'P1', customer: 'Acme Industries',
      issues_register: [
        { id: 'i1', description: 'Older', status: 'open', opened_date: '2000-01-01' },
        { id: 'i2', description: 'Newer', status: 'open', opened_date: '2099-01-01' }
      ]
    })]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

describe('D5 enriched RAID tables', () => {
  it('issues table shows an age ("open Nd") and sorts oldest-first by default', async () => {
    const app = await boot();
    app.RaidView.activeTab = 'issues';
    app.App.navigate('raid');
    const host = app.document.getElementById('raidContent');
    expect(host.innerHTML).toMatch(/open \d+d|\bAge\b/);
    // Older issue (opened 2000) appears before Newer (opened 2099) in default age-desc sort.
    const text = host.textContent;
    expect(text.indexOf('Older')).toBeLessThan(text.indexOf('Newer'));
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/render/raid-table-intel.test.mjs`.

- [ ] **Step 3: Enrich `_renderTable`.** Read `_renderTable` (~37340) first — it uses a distinct-value "populate-or-hide" column model + `<colgroup>` fixed widths + `_sortRows`. Extend it MINIMALLY:
  - **Risks:** add a `Target` column showing `overdue` / `in Nd` / `—` from `RaidIntel` (only when at least one risk has a `target_date` — follow the existing `varies()`/hasDate gating pattern). Add `'Target': '110px'` to `colWidth`.
  - **Issues:** add an `Age` column showing `open Nd` (coloured amber/red via `RaidIntel.issueAging`) from `opened_date` (gate on at least one issue having `opened_date`). Add `'Age': '110px'` to `colWidth`. Make the default issues sort **age desc** (oldest first): extend `_sortRows`'s default for `issues` to sort by `RaidIntel.issueAgeDays` desc (open, non-null first), and add an `'Age'` sortable key.
  - Keep the existing Risks score-desc default and all current columns/behaviour.
  Mirror the existing column construction exactly (headers array, colgroup, distinct-value gating, per-row `<td>`). Do not break the colgroup↔header↔cell 1:1 mapping.

- [ ] **Step 4: Run the test + regression** — `npx vitest run tests/render/raid-table-intel.test.mjs && npx vitest run`. Existing RAID render/snapshot tests must stay green; if a RAID table snapshot legitimately changes (new column), STOP and report before updating it (confirm the change is only the additive column).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/raid-table-intel.test.mjs
git commit -m "feat(raid): table target/age columns + age-sorted issues"
```

---

## Task D6: Full verification + visual pass

**Files:** none (verification only)

- [ ] **Step 1: Full suite** — `npm test`. Expect all green, 0 failures.

- [ ] **Step 2: Serve + visual** —
```bash
python3 -m http.server 8765 --bind 127.0.0.1
```
Drive `http://127.0.0.1:8765/index.html`, load demo data, pick a customer, open **RAID**. Verify at 1440px (light + dark):
- The **Attention** band shows **Risks to watch** (high-severity / near-overdue, with score chip + "overdue"/"in Nd"), **Oldest open issues** (open Nd), **Aging decisions** (pending Nd) — populated from the seed; clicking an item opens the project RAID tab / the governance forum.
- The **Risks** tab shows varied severity chips + a Target column and sorts by urgency; the **Issues** tab shows "open Nd" age chips and lists oldest first.
- A customer with no urgent items shows "All clear" groups.
- Switching customer rescopes the Attention band + tables. No console errors.

- [ ] **Step 3: Final commit if a tweak was needed** — `git add -A && git commit -m "chore: WS-D verification pass"` (skip if none).

---

## Self-Review Notes
- **Spec coverage:** D1 signals+seed → Task D1; D2 capture → Task D2; D3 RaidIntel → Task D3; D4 Attention → Task D4; D5 enriched tables → Task D5. All covered.
- **Builds on existing:** reuses `RaidView._collect`/`_score`/`_scoreChip`/customer-scoping and migration's impact/probability default; adds only target/age proximity + the Attention band + two columns.
- **Naming:** `RaidIntel` (riskSeverity/severityBand/riskNearTarget/riskUrgency/issueAgeDays/issueAging/decisionAgeDays/decisionAging/_daysBetween/_today + thresholds), `RaidView._renderAttention`/`_pendingDecisions`/`_openForum`; deterministic `today` arg for testability.
- **Demo sync:** D1 updates BOTH demo copies; the WS-H sync-test (re-run in D1 Step 5) guards equality.
- **Pattern-directed (not full code):** D2 (capture, embedded in `DetailPanel.renderRisks`/issues editor) and D5 (column add within the intricate `_renderTable` distinct-value/colgroup model) cite exact anchors + required behaviour + tests; the implementer mirrors the existing impact/probability inputs and Score/date columns. D1's seed uses a deterministic one-off script (deleted, not committed).
