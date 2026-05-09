# Personas, Objectives & Metrics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Personas, Objectives, and Metrics as first-class customer-scoped entities in the single-file portfolio app, surface them through a new top-level "Strategy" view with three tabs, and link them to existing Projects via a metrics-primary picker.

**Architecture:** Five new plain-JS modules (`Personas`, `Objectives`, `Metrics`, `MetricGroups`, `Strategy`) added to `index.html`'s single `<script>` block, alongside `Dashboard`, `Sprint`, etc. Data lives in **top-level arrays** (`data.personas`, `data.objectives`, `data.metrics`, `data.metric_groups`) each filtered by `customer === App.activeCustomer` — matching the existing convention used by `data.projects` and `data.team_members` (NOT nested under each `data.customers[i]`). Persona holdings are nested on the persona record (`persona.metric_holdings[]`). Migration is additive only; no breaking changes.

**Tech Stack:** Vanilla JS modules in `index.html`; vitest + jsdom for unit/render tests; Playwright + chromium-headless-shell for E2E. No new dependencies.

**Spec:** `docs/specs/2026-05-09-personas-objectives-metrics-design.md` (commit `00269fd`).

## Modal / popover convention

Several tasks include `_showAddForm()`, `_edit()`, `_openConfig()`, `_addHoldingPrompt()`, `_editHolding()`, and `_showRaciPopover()` methods. These are intentionally not spelled out step-by-step because the existing app already has a modal pattern that all of them must follow:

- Find an existing modal in `index.html` (e.g., search for `Dashboard.openModal`, `showAddProject`, or similar). Mirror its structure: build an HTML string for the modal body, inject into a positioned overlay, wire `Save`/`Cancel` buttons to call back into the relevant module's `add`/`update` method then call `App.renderActiveView()` to refresh the screen.
- Form fields use plain `<input>`, `<select>`, `<textarea>`, and persona/metric pickers reuse `DetailPanel.renderStrategyEditFields`-style multi-select markup (Task 20).
- For popovers (`_showRaciPopover`), use the same overlay div approach but position it near the click target and dismiss on outside click.

Implementations are short (~20-40 lines each); the engineer must mirror existing patterns rather than inventing a new modal system. If the codebase has multiple inconsistent modal patterns, pick the one used most recently (check `git log` for the newest `*Modal` or `*Form` addition).

---

## File Structure

**New files:**
- `tests/unit/migration-strategy.test.mjs` — migration tests for the new arrays + default groups
- `tests/unit/personas.test.mjs` — hierarchy, validation, holdings
- `tests/unit/objectives.test.mjs` — CRUD invariants
- `tests/unit/metrics.test.mjs` — definitions + groups + dimensions
- `tests/unit/holdings.test.mjs` — filter validation + targets
- `tests/unit/rollups.test.mjs` — Personas/Objectives/Metrics rollup pure functions
- `tests/render/strategy-personas.test.mjs` — snapshot of Personas tab list
- `tests/render/strategy-objectives.test.mjs` — snapshot of Objectives tab list
- `tests/render/strategy-metrics.test.mjs` — snapshot of Metrics tab two-pane
- `tests/render/project-strategy-section.test.mjs` — snapshot of Strategy section in project detail
- `tests/e2e/strategy-flow.spec.ts` — full create→assign→link round-trip
- `tests/e2e/projects-filter-by-metric.spec.ts` — filter projects by metric

**Modified files:**
- `index.html` — single source of truth for runtime: migration logic (~line 3438 `App.migrateSchema`), new `Personas` / `Objectives` / `Metrics` / `MetricGroups` / `Strategy` module declarations alongside other `const X = {}` modules (~line 9720 `Dashboard`, etc.); `Dashboard.COLUMNS` (~line 9776) gains two optional columns; new `'multi-select'` edit type added to inline editor dispatch; `DetailPanel` gains a Strategy section; navigation/router gains a "Strategy" view between Dashboard and Projects.
- `tests/harness/fixtures.mjs` — gains `makePersona()`, `makeObjective()`, `makeMetric()`, `makeMetricGroup()`, `makeHolding()`.
- `portfolio-data.json` and `portfolio-data-demo.json` — seed personas/objectives/metrics for the three demo customers, plus 2-3 cascade examples.

---

## Phase 1 — Data model + migration

### Task 1: Migration adds top-level arrays + default metric_groups

**Files:**
- Modify: `index.html:3438` (extend `App.migrateSchema`)
- Test: `tests/unit/migration-strategy.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/migration-strategy.test.mjs
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

describe('migration: strategy arrays', () => {
  it('adds empty personas/objectives/metrics arrays if missing', async () => {
    const data = makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }] });
    delete data.personas; delete data.objectives; delete data.metrics; delete data.metric_groups;
    const app = await loadApp(data);
    expect(Array.isArray(app.App.data.personas)).toBe(true);
    expect(Array.isArray(app.App.data.objectives)).toBe(true);
    expect(Array.isArray(app.App.data.metrics)).toBe(true);
    expect(Array.isArray(app.App.data.metric_groups)).toBe(true);
    app.teardown();
  });

  it('seeds three default metric_groups per customer if metric_groups is empty', async () => {
    const data = makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }] });
    data.metric_groups = [];
    const app = await loadApp(data);
    const acmeGroups = app.App.data.metric_groups.filter(g => g.customer === 'Acme Industries');
    expect(acmeGroups.map(g => g.id).sort()).toEqual(['customer', 'operations', 'performance']);
    expect(acmeGroups.find(g => g.id === 'customer').name).toBe('Customer');
    expect(acmeGroups.find(g => g.id === 'performance').swatch).toBe('#c89dde');
    app.teardown();
  });

  it('does not overwrite existing metric_groups', async () => {
    const data = makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }] });
    data.metric_groups = [{ id: 'custom', name: 'Custom', swatch: '#000', customer: 'Acme Industries' }];
    const app = await loadApp(data);
    const acmeGroups = app.App.data.metric_groups.filter(g => g.customer === 'Acme Industries');
    expect(acmeGroups).toHaveLength(1);
    expect(acmeGroups[0].id).toBe('custom');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/migration-strategy.test.mjs`
Expected: FAIL — `data.personas` is undefined.

- [ ] **Step 3: Add migration block in App.migrateSchema**

Locate the end of `migrateSchema` (just before its `return data;` near line 3770). Insert:

```javascript
// Always-run: Strategy entities (personas/objectives/metrics) — additive.
if (!Array.isArray(data.personas))      data.personas      = [];
if (!Array.isArray(data.objectives))    data.objectives    = [];
if (!Array.isArray(data.metrics))       data.metrics       = [];
if (!Array.isArray(data.metric_groups)) data.metric_groups = [];

// Default metric_groups per customer if none defined for that customer
const DEFAULT_METRIC_GROUPS = [
  { id: 'customer',    name: 'Customer',    swatch: '#66d9e8' },
  { id: 'operations',  name: 'Operations',  swatch: '#8fb4ff' },
  { id: 'performance', name: 'Performance', swatch: '#c89dde' },
];
(data.customers || []).forEach(c => {
  const has = data.metric_groups.some(g => g.customer === c.name);
  if (!has) {
    DEFAULT_METRIC_GROUPS.forEach(g => {
      data.metric_groups.push({ ...g, customer: c.name });
    });
  }
});

// Seed metric_holdings on personas if missing
data.personas.forEach(p => {
  if (!Array.isArray(p.metric_holdings)) p.metric_holdings = [];
  if (!Array.isArray(p.business_questions)) p.business_questions = [];
});

// Seed metric.dimensions / objective_ids / raci / actuals if missing
data.metrics.forEach(m => {
  if (!Array.isArray(m.dimensions))   m.dimensions = [];
  if (!Array.isArray(m.objective_ids)) m.objective_ids = [];
  if (!m.raci) m.raci = { accountable: [], responsible: [], consulted: [], informed: [] };
  if (!Array.isArray(m.actuals)) m.actuals = [];
});

// Project additions
(data.projects || []).forEach(p => {
  if (!Array.isArray(p.metric_ids))  p.metric_ids  = [];
  if (!Array.isArray(p.persona_ids)) p.persona_ids = [];
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/migration-strategy.test.mjs`
Expected: PASS — all three tests green.

- [ ] **Step 5: Run the existing migration test to verify nothing broke**

Run: `npx vitest run tests/unit/migration.test.mjs tests/unit/_smoke.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/migration-strategy.test.mjs index.html
git commit -m "feat(strategy): migration adds personas/objectives/metrics arrays + default groups"
```

---

### Task 2: Fixture builders for new entities

**Files:**
- Modify: `tests/harness/fixtures.mjs`
- Test: covered indirectly by later tasks; add a smoke test.

- [ ] **Step 1: Write the failing test**

```javascript
// Append to tests/unit/_smoke.test.mjs
import { makePersona, makeObjective, makeMetric, makeMetricGroup, makeHolding } from '../harness/fixtures.mjs';

describe('strategy fixtures', () => {
  it('makePersona returns persona with required fields', () => {
    const p = makePersona({ name: 'Sarah Chen', role_title: 'CFO' });
    expect(p.id).toBeTruthy();
    expect(p.name).toBe('Sarah Chen');
    expect(p.customer).toBe('Acme Industries');
    expect(Array.isArray(p.metric_holdings)).toBe(true);
  });

  it('makeMetric returns metric with default group_id and dimensions', () => {
    const m = makeMetric({ name: 'Revenue' });
    expect(m.group_id).toBe('performance');
    expect(m.status).toBe('live');
    expect(Array.isArray(m.dimensions)).toBe(true);
    expect(Array.isArray(m.objective_ids)).toBe(true);
    expect(m.raci).toBeDefined();
  });

  it('makeHolding returns holding with empty filter and targets', () => {
    const h = makeHolding({ metric_id: 'M-001' });
    expect(h.id).toBeTruthy();
    expect(h.metric_id).toBe('M-001');
    expect(h.filter).toEqual({});
    expect(h.targets).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/_smoke.test.mjs`
Expected: FAIL — imports do not exist.

- [ ] **Step 3: Add fixture builders**

Append to `tests/harness/fixtures.mjs`:

```javascript
export function makePersona(overrides = {}) {
  return {
    id: nextId('PER'),
    customer: 'Acme Industries',
    name: 'Test Persona',
    role_title: '',
    definition: '',
    key_responsibilities: '',
    parent_persona_id: null,
    metric_holdings: [],
    business_questions: [],
    notes: '',
    ...overrides,
  };
}

export function makeObjective(overrides = {}) {
  return {
    id: nextId('OBJ'),
    customer: 'Acme Industries',
    name: 'Test Objective',
    description: '',
    status: 'active',
    time_horizon: { start_date: null, target_date: null },
    notes: '',
    ...overrides,
  };
}

export function makeMetric(overrides = {}) {
  return {
    id: nextId('MET'),
    customer: 'Acme Industries',
    name: 'Test Metric',
    definition: '',
    pseudo_logic: '',
    unit: '',
    direction: 'higher_is_better',
    group_id: 'performance',
    source: '',
    status: 'live',
    dimensions: [],
    objective_ids: [],
    raci: { accountable: [], responsible: [], consulted: [], informed: [] },
    actuals: [],
    notes: '',
    ...overrides,
  };
}

export function makeMetricGroup(overrides = {}) {
  return {
    id: nextId('GRP').toLowerCase(),
    customer: 'Acme Industries',
    name: 'Test Group',
    swatch: '#888',
    ...overrides,
  };
}

export function makeHolding(overrides = {}) {
  return {
    id: nextId('HLD'),
    metric_id: '',
    filter: {},
    targets: [],
    notes: '',
    ...overrides,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/_smoke.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/harness/fixtures.mjs tests/unit/_smoke.test.mjs
git commit -m "test(harness): add persona/objective/metric/holding fixture builders"
```

---

## Phase 2 — Pure logic modules

### Task 3: Personas module — CRUD + hierarchy traversal

**Files:**
- Modify: `index.html` (add `const Personas = {...}` block alongside other modules around line 8747)
- Test: `tests/unit/personas.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/personas.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

describe('Personas module', () => {
  it('list() returns personas filtered by active customer', async () => {
    resetIdSeq();
    const acme = [makePersona({ customer: 'Acme Industries', name: 'Sarah' })];
    const globex = [makePersona({ customer: 'Globex', name: 'Other' })];
    const app = await loadApp(makeDataset({
      customers: [
        { name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 },
        { name: 'Globex', color: '#10b981', staleThreshold: 14 },
      ],
      personas: [...acme, ...globex],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const list = app.Personas.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Sarah');
    app.teardown();
  });

  it('descendants() walks parent_persona_id transitively', async () => {
    resetIdSeq();
    const ceo  = makePersona({ id: 'P1', name: 'CEO', parent_persona_id: null });
    const cfo  = makePersona({ id: 'P2', name: 'CFO', parent_persona_id: 'P1' });
    const finM = makePersona({ id: 'P3', name: 'Fin Mgr', parent_persona_id: 'P2' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [ceo, cfo, finM],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const desc = app.Personas.descendants('P1');
    expect(desc.map(p => p.id).sort()).toEqual(['P2', 'P3']);
    app.teardown();
  });

  it('cycleCheck() rejects self-parent and indirect cycles', async () => {
    resetIdSeq();
    const a = makePersona({ id: 'P1', parent_persona_id: null });
    const b = makePersona({ id: 'P2', parent_persona_id: 'P1' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [a, b],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Personas.cycleCheck('P1', 'P1')).toBe(false);   // self-parent rejected
    expect(app.Personas.cycleCheck('P1', 'P2')).toBe(false);   // would create cycle (P1→P2→P1)
    expect(app.Personas.cycleCheck('P2', 'P1')).toBe(true);    // valid (P2's parent stays P1)
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/personas.test.mjs`
Expected: FAIL — `Personas` module does not exist.

- [ ] **Step 3: Add Personas module to index.html**

After `const Validator = {...};` block (~line 8747), add:

```javascript
// ===== Personas module =====
const Personas = {
  list() {
    if (!App.data || !Array.isArray(App.data.personas)) return [];
    const cust = App.activeCustomer;
    return App.data.personas.filter(p => p.customer === cust);
  },

  byId(id) {
    return (App.data.personas || []).find(p => p.id === id) || null;
  },

  descendants(personaId) {
    const all = this.list();
    const out = [];
    const seen = new Set();
    const walk = (id) => {
      const children = all.filter(p => p.parent_persona_id === id);
      children.forEach(c => {
        if (seen.has(c.id)) return;
        seen.add(c.id);
        out.push(c);
        walk(c.id);
      });
    };
    walk(personaId);
    return out;
  },

  ancestors(personaId) {
    const all = this.list();
    const out = [];
    let cur = this.byId(personaId);
    const seen = new Set();
    while (cur && cur.parent_persona_id && !seen.has(cur.parent_persona_id)) {
      seen.add(cur.parent_persona_id);
      const parent = all.find(p => p.id === cur.parent_persona_id);
      if (!parent) break;
      out.push(parent);
      cur = parent;
    }
    return out;
  },

  // Returns true if assigning `parentId` as the parent of `personaId` is valid (no cycle, not self).
  cycleCheck(personaId, parentId) {
    if (!parentId) return true;             // null parent always valid
    if (personaId === parentId) return false; // self-parent
    // Walk parentId's ancestors; if we encounter personaId, cycle
    const seen = new Set();
    let cur = this.byId(parentId);
    while (cur && cur.parent_persona_id && !seen.has(cur.parent_persona_id)) {
      if (cur.parent_persona_id === personaId) return false;
      seen.add(cur.parent_persona_id);
      cur = this.byId(cur.parent_persona_id);
    }
    return true;
  },

  add(persona) {
    if (!App.data.personas) App.data.personas = [];
    const rec = { ...persona, customer: persona.customer || App.activeCustomer };
    if (!rec.id) rec.id = 'PER-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    if (!Array.isArray(rec.metric_holdings)) rec.metric_holdings = [];
    if (!Array.isArray(rec.business_questions)) rec.business_questions = [];
    App.data.personas.push(rec);
    if (App._save) App._save();
    return rec;
  },

  update(id, patch) {
    const p = this.byId(id);
    if (!p) return null;
    Object.assign(p, patch);
    if (App._save) App._save();
    return p;
  },

  remove(id) {
    const idx = (App.data.personas || []).findIndex(p => p.id === id);
    if (idx < 0) return false;
    App.data.personas.splice(idx, 1);
    // Re-parent any orphaned children to null
    (App.data.personas || []).forEach(p => {
      if (p.parent_persona_id === id) p.parent_persona_id = null;
    });
    if (App._save) App._save();
    return true;
  },
};
```

Then update the harness bridge so tests can access it. In `tests/harness/loadApp.mjs`, find the bridge script and add `Personas` to the `window.__pcc__` object. (Bridge script is in the loadApp helper — see existing bridge for pattern.)

- [ ] **Step 4: Update bridge script in loadApp.mjs**

Locate the bridge injection in `tests/harness/loadApp.mjs` (look for `window.__pcc__`). Add `Personas` to the assigned object. The existing entries include App, Solver, Sprint, Dashboard, Gantt, Capacity, Governance, DetailPanel, AuditPanel.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/personas.test.mjs`
Expected: PASS — all three tests green.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/harness/loadApp.mjs tests/unit/personas.test.mjs
git commit -m "feat(personas): module with CRUD + hierarchy traversal + cycle check"
```

---

### Task 4: Objectives module — CRUD

**Files:**
- Modify: `index.html` (add `const Objectives = {...}` after Personas)
- Test: `tests/unit/objectives.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/objectives.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeObjective, resetIdSeq } from '../harness/fixtures.mjs';

describe('Objectives module', () => {
  it('list() returns objectives filtered by active customer', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [
        { name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 },
        { name: 'Globex', color: '#10b981', staleThreshold: 14 },
      ],
      objectives: [
        makeObjective({ customer: 'Acme Industries', name: 'A' }),
        makeObjective({ customer: 'Globex', name: 'B' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const list = app.Objectives.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('A');
    app.teardown();
  });

  it('add() seeds default status=active and time_horizon shape', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const obj = app.Objectives.add({ name: 'Reduce opex' });
    expect(obj.status).toBe('active');
    expect(obj.time_horizon).toEqual({ start_date: null, target_date: null });
    app.teardown();
  });

  it('update() patches a single field without clobbering others', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      objectives: [makeObjective({ id: 'O1', name: 'Original', description: 'desc' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Objectives.update('O1', { status: 'achieved' });
    const o = app.Objectives.byId('O1');
    expect(o.name).toBe('Original');
    expect(o.description).toBe('desc');
    expect(o.status).toBe('achieved');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/objectives.test.mjs`
Expected: FAIL — `Objectives` module does not exist.

- [ ] **Step 3: Add Objectives module**

After the `Personas` module in `index.html`, add:

```javascript
// ===== Objectives module =====
const Objectives = {
  list() {
    if (!App.data || !Array.isArray(App.data.objectives)) return [];
    return App.data.objectives.filter(o => o.customer === App.activeCustomer);
  },

  byId(id) {
    return (App.data.objectives || []).find(o => o.id === id) || null;
  },

  add(objective) {
    if (!App.data.objectives) App.data.objectives = [];
    const rec = {
      status: 'active',
      time_horizon: { start_date: null, target_date: null },
      description: '',
      notes: '',
      ...objective,
      customer: objective.customer || App.activeCustomer,
    };
    if (!rec.id) rec.id = 'OBJ-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    if (!rec.time_horizon) rec.time_horizon = { start_date: null, target_date: null };
    App.data.objectives.push(rec);
    if (App._save) App._save();
    return rec;
  },

  update(id, patch) {
    const o = this.byId(id);
    if (!o) return null;
    Object.assign(o, patch);
    if (App._save) App._save();
    return o;
  },

  remove(id) {
    const idx = (App.data.objectives || []).findIndex(o => o.id === id);
    if (idx < 0) return false;
    App.data.objectives.splice(idx, 1);
    // Unlink from all metrics that reference it
    (App.data.metrics || []).forEach(m => {
      if (Array.isArray(m.objective_ids)) {
        m.objective_ids = m.objective_ids.filter(oid => oid !== id);
      }
    });
    if (App._save) App._save();
    return true;
  },
};
```

Add `Objectives` to the bridge in `loadApp.mjs`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/objectives.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/harness/loadApp.mjs tests/unit/objectives.test.mjs
git commit -m "feat(objectives): module with CRUD + cascade-clean delete"
```

---

### Task 5: MetricGroups module — CRUD with default protection

**Files:**
- Modify: `index.html` (add `const MetricGroups = {...}` after Objectives)
- Test: `tests/unit/metrics.test.mjs` (initial groups tests; full file across tasks 5–6)

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/metrics.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makeMetricGroup, resetIdSeq } from '../harness/fixtures.mjs';

describe('MetricGroups module', () => {
  it('list() returns groups for the active customer', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const groups = app.MetricGroups.list();
    expect(groups.map(g => g.id).sort()).toEqual(['customer', 'operations', 'performance']);
  });

  it('add() rejects duplicate id within the same customer', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const r = app.MetricGroups.add({ id: 'customer', name: 'Dup', swatch: '#000' });
    expect(r).toBe(null);
  });

  it('remove() refuses to remove a group with metrics still in it', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [makeMetric({ group_id: 'operations', name: 'Cost per ticket' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const ok = app.MetricGroups.remove('operations');
    expect(ok).toBe(false);
    expect(app.MetricGroups.byId('operations')).not.toBe(null);
  });

  it('remove() succeeds when no metrics reference the group', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.MetricGroups.add({ id: 'extra', name: 'Extra', swatch: '#888' });
    const ok = app.MetricGroups.remove('extra');
    expect(ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/metrics.test.mjs`
Expected: FAIL — `MetricGroups` module does not exist.

- [ ] **Step 3: Add MetricGroups module**

After `Objectives` module in `index.html`:

```javascript
// ===== MetricGroups module =====
const MetricGroups = {
  list() {
    if (!App.data || !Array.isArray(App.data.metric_groups)) return [];
    return App.data.metric_groups.filter(g => g.customer === App.activeCustomer);
  },

  byId(id) {
    return this.list().find(g => g.id === id) || null;
  },

  add(group) {
    if (!App.data.metric_groups) App.data.metric_groups = [];
    const cust = group.customer || App.activeCustomer;
    const exists = App.data.metric_groups.some(g => g.customer === cust && g.id === group.id);
    if (exists) return null;
    const rec = { swatch: '#888', ...group, customer: cust };
    App.data.metric_groups.push(rec);
    if (App._save) App._save();
    return rec;
  },

  update(id, patch) {
    const g = this.byId(id);
    if (!g) return null;
    if (patch.id && patch.id !== id) return null; // id is immutable
    Object.assign(g, patch);
    if (App._save) App._save();
    return g;
  },

  remove(id) {
    const cust = App.activeCustomer;
    const idx = (App.data.metric_groups || []).findIndex(g => g.customer === cust && g.id === id);
    if (idx < 0) return false;
    // Block deletion if any metric in the customer still references this group
    const inUse = (App.data.metrics || []).some(m => m.customer === cust && m.group_id === id);
    if (inUse) return false;
    App.data.metric_groups.splice(idx, 1);
    if (App._save) App._save();
    return true;
  },
};
```

Add `MetricGroups` to the bridge.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/metrics.test.mjs`
Expected: PASS — all four MetricGroups tests green.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/harness/loadApp.mjs tests/unit/metrics.test.mjs
git commit -m "feat(metrics): MetricGroups module with default protection on remove"
```

---

### Task 6: Metrics module — CRUD on definitions

**Files:**
- Modify: `index.html` (add `const Metrics = {...}` after MetricGroups)
- Test: extend `tests/unit/metrics.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// Append to tests/unit/metrics.test.mjs
describe('Metrics module', () => {
  it('list() returns metrics for active customer', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [
        { name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 },
        { name: 'Globex', color: '#10b981', staleThreshold: 14 },
      ],
      metrics: [
        makeMetric({ name: 'Revenue', customer: 'Acme Industries' }),
        makeMetric({ name: 'Other', customer: 'Globex' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Metrics.list().map(m => m.name)).toEqual(['Revenue']);
  });

  it('add() seeds defaults for status, dimensions, raci, group_id', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const m = app.Metrics.add({ name: 'New metric' });
    expect(m.status).toBe('draft');
    expect(m.group_id).toBe('performance'); // first available default group
    expect(Array.isArray(m.dimensions)).toBe(true);
    expect(m.raci).toEqual({ accountable: [], responsible: [], consulted: [], informed: [] });
  });

  it('add() rejects metric whose group_id is unknown for the customer', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const m = app.Metrics.add({ name: 'Bad', group_id: 'nonexistent' });
    expect(m).toBe(null);
  });

  it('remove() removes any holdings of the deleted metric from all personas', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [makeMetric({ id: 'M1', name: 'Doomed' })],
      personas: [{
        id: 'P1', customer: 'Acme Industries', name: 'Holder',
        metric_holdings: [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }],
        parent_persona_id: null, business_questions: [],
      }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Metrics.remove('M1');
    expect(app.Personas.byId('P1').metric_holdings).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/metrics.test.mjs`
Expected: FAIL — `Metrics` module does not exist.

- [ ] **Step 3: Add Metrics module**

After `MetricGroups`:

```javascript
// ===== Metrics module =====
const Metrics = {
  list() {
    if (!App.data || !Array.isArray(App.data.metrics)) return [];
    return App.data.metrics.filter(m => m.customer === App.activeCustomer);
  },

  byId(id) {
    return (App.data.metrics || []).find(m => m.id === id) || null;
  },

  add(metric) {
    if (!App.data.metrics) App.data.metrics = [];
    const cust = metric.customer || App.activeCustomer;
    const groups = (App.data.metric_groups || []).filter(g => g.customer === cust);
    const defaultGroup = groups.find(g => g.id === 'performance') || groups[0];
    const groupId = metric.group_id || (defaultGroup && defaultGroup.id);
    if (!groupId || !groups.some(g => g.id === groupId)) return null;
    const rec = {
      definition: '', pseudo_logic: '', unit: '', direction: 'higher_is_better',
      source: '', status: 'draft', dimensions: [], objective_ids: [],
      raci: { accountable: [], responsible: [], consulted: [], informed: [] },
      actuals: [], notes: '',
      ...metric,
      customer: cust, group_id: groupId,
    };
    if (!rec.id) rec.id = 'MET-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    App.data.metrics.push(rec);
    if (App._save) App._save();
    return rec;
  },

  update(id, patch) {
    const m = this.byId(id);
    if (!m) return null;
    if (patch.group_id && patch.group_id !== m.group_id) {
      const groups = (App.data.metric_groups || []).filter(g => g.customer === m.customer);
      if (!groups.some(g => g.id === patch.group_id)) return null;
    }
    Object.assign(m, patch);
    if (App._save) App._save();
    return m;
  },

  remove(id) {
    const idx = (App.data.metrics || []).findIndex(m => m.id === id);
    if (idx < 0) return false;
    App.data.metrics.splice(idx, 1);
    // Remove from all persona holdings
    (App.data.personas || []).forEach(p => {
      if (Array.isArray(p.metric_holdings)) {
        p.metric_holdings = p.metric_holdings.filter(h => h.metric_id !== id);
      }
    });
    // Remove from all project links
    (App.data.projects || []).forEach(pr => {
      if (Array.isArray(pr.metric_ids)) {
        pr.metric_ids = pr.metric_ids.filter(mid => mid !== id);
      }
    });
    if (App._save) App._save();
    return true;
  },
};
```

Add `Metrics` to the bridge.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/metrics.test.mjs`
Expected: PASS — all 8 tests (4 from Task 5 + 4 here).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/harness/loadApp.mjs tests/unit/metrics.test.mjs
git commit -m "feat(metrics): Metrics module with cascade-clean delete"
```

---

### Task 7: Holdings helpers — assign / edit / remove on personas

**Files:**
- Modify: `index.html` (extend `Personas` module with holding helpers)
- Test: `tests/unit/holdings.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/holdings.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Holdings helpers', () => {
  it('addHolding rejects unknown metric_id', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'P1' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const h = app.Personas.addHolding('P1', { metric_id: 'NOPE' });
    expect(h).toBe(null);
  });

  it('addHolding rejects filter keys not in metric.dimensions', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'P1' })],
      metrics: [makeMetric({ id: 'M1', dimensions: ['region'] })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const h = app.Personas.addHolding('P1', { metric_id: 'M1', filter: { product: 'X' } });
    expect(h).toBe(null);
  });

  it('addHolding succeeds with valid filter and assigns id', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'P1' })],
      metrics: [makeMetric({ id: 'M1', dimensions: ['region'] })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const h = app.Personas.addHolding('P1', { metric_id: 'M1', filter: { region: 'North' }, targets: [{ period: '2026', value: 100, period_type: 'annual' }] });
    expect(h).toBeTruthy();
    expect(h.id).toBeTruthy();
    expect(app.Personas.byId('P1').metric_holdings).toHaveLength(1);
  });

  it('updateHolding replaces filter and targets', async () => {
    resetIdSeq();
    const persona = makePersona({ id: 'P1' });
    persona.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: { region: 'North' }, targets: [], notes: '' }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona],
      metrics: [makeMetric({ id: 'M1', dimensions: ['region'] })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Personas.updateHolding('P1', 'H1', { filter: { region: 'South' } });
    expect(app.Personas.byId('P1').metric_holdings[0].filter.region).toBe('South');
  });

  it('removeHolding removes the holding by id', async () => {
    resetIdSeq();
    const persona = makePersona({ id: 'P1' });
    persona.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [], notes: '' }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [persona],
      metrics: [makeMetric({ id: 'M1' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Personas.removeHolding('P1', 'H1');
    expect(app.Personas.byId('P1').metric_holdings).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/holdings.test.mjs`
Expected: FAIL — `addHolding` not defined.

- [ ] **Step 3: Extend Personas module with holding helpers**

Inside the `Personas` block in `index.html`, before the closing `};`, add:

```javascript
  // ----- Holdings helpers -----
  addHolding(personaId, holding) {
    const persona = this.byId(personaId);
    if (!persona) return null;
    const metric = Metrics.byId(holding.metric_id);
    if (!metric) return null;
    // Validate filter keys are subset of metric.dimensions
    const filter = holding.filter || {};
    const dims = metric.dimensions || [];
    const filterKeys = Object.keys(filter);
    if (filterKeys.some(k => dims.indexOf(k) < 0)) return null;
    const rec = {
      filter: {}, targets: [], notes: '',
      ...holding,
      id: holding.id || ('HLD-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)),
    };
    if (!Array.isArray(persona.metric_holdings)) persona.metric_holdings = [];
    persona.metric_holdings.push(rec);
    if (App._save) App._save();
    return rec;
  },

  updateHolding(personaId, holdingId, patch) {
    const persona = this.byId(personaId);
    if (!persona) return null;
    const h = (persona.metric_holdings || []).find(x => x.id === holdingId);
    if (!h) return null;
    // If filter is being changed, validate against the metric's dimensions
    if (patch.filter) {
      const metric = Metrics.byId(h.metric_id);
      if (metric) {
        const dims = metric.dimensions || [];
        if (Object.keys(patch.filter).some(k => dims.indexOf(k) < 0)) return null;
      }
    }
    Object.assign(h, patch);
    if (App._save) App._save();
    return h;
  },

  removeHolding(personaId, holdingId) {
    const persona = this.byId(personaId);
    if (!persona || !Array.isArray(persona.metric_holdings)) return false;
    const idx = persona.metric_holdings.findIndex(x => x.id === holdingId);
    if (idx < 0) return false;
    persona.metric_holdings.splice(idx, 1);
    if (App._save) App._save();
    return true;
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/holdings.test.mjs`
Expected: PASS — all five tests green.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/unit/holdings.test.mjs
git commit -m "feat(personas): holding add/update/remove helpers with filter validation"
```

---

### Task 8: Rollup pure functions

**Files:**
- Modify: `index.html` (add `rollup` methods inside Personas, Objectives, Metrics)
- Test: `tests/unit/rollups.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/rollups.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeObjective, makeMetric, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

describe('Rollups', () => {
  async function setupCustomerWithCascade() {
    resetIdSeq();
    const sarah = makePersona({ id: 'P-CFO',  name: 'Sarah Chen', role_title: 'CFO',  parent_persona_id: null });
    const diane = makePersona({ id: 'P-RGM',  name: 'Diane',      role_title: 'GM N', parent_persona_id: 'P-CFO' });
    const obj   = makeObjective({ id: 'O-REV', name: 'Grow regional revenue 12%' });
    const met   = makeMetric({ id: 'M-REV', name: 'Revenue', dimensions: ['region'], objective_ids: ['O-REV'] });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M-REV', filter: {},                 targets: [{ period: '2026', value: 400, period_type: 'annual' }] }];
    diane.metric_holdings = [{ id: 'H2', metric_id: 'M-REV', filter: { region: 'North' },targets: [{ period: '2026', value: 200, period_type: 'annual' }] }];
    const project = makeProject({ id: 'PR-1', name: 'Q3 reporting refresh', metric_ids: ['M-REV'], persona_ids: [] });
    return loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah, diane],
      objectives: [obj],
      metrics: [met],
      projects: [project],
    }));
  }

  it('Personas.rollup returns held metrics + derived objectives + supporting projects', async () => {
    const app = await setupCustomerWithCascade();
    app.App.activeCustomer = 'Acme Industries';
    const r = app.Personas.rollup('P-CFO');
    expect(r.holdings).toHaveLength(1);
    expect(r.held_metrics.map(m => m.id)).toEqual(['M-REV']);
    expect(r.contributing_objectives.map(o => o.id)).toEqual(['O-REV']);
    expect(r.supporting_projects.map(p => p.id)).toEqual(['PR-1']);
    expect(r.descendants.map(p => p.id)).toEqual(['P-RGM']);
  });

  it('Objectives.rollup returns measuring metrics + contributing personas + delivering projects', async () => {
    const app = await setupCustomerWithCascade();
    app.App.activeCustomer = 'Acme Industries';
    const r = app.Objectives.rollup('O-REV');
    expect(r.measuring_metrics.map(m => m.id)).toEqual(['M-REV']);
    expect(r.contributing_personas.map(p => p.id).sort()).toEqual(['P-CFO', 'P-RGM']);
    expect(r.delivering_projects.map(p => p.id)).toEqual(['PR-1']);
    expect(r.metric_count).toBe(1);
  });

  it('Metrics.rollup returns holders with filter + served objectives + delivering projects', async () => {
    const app = await setupCustomerWithCascade();
    app.App.activeCustomer = 'Acme Industries';
    const r = app.Metrics.rollup('M-REV');
    expect(r.holder_count).toBe(2);
    const holders = r.holders.map(h => ({ persona: h.persona.id, filter: h.holding.filter }));
    expect(holders).toEqual([
      { persona: 'P-CFO', filter: {} },
      { persona: 'P-RGM', filter: { region: 'North' } },
    ]);
    expect(r.served_objectives.map(o => o.id)).toEqual(['O-REV']);
    expect(r.delivering_projects.map(p => p.id)).toEqual(['PR-1']);
    expect(r.has_targets_anywhere).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/rollups.test.mjs`
Expected: FAIL — `rollup` method not on the modules.

- [ ] **Step 3: Add Personas.rollup**

Inside `Personas` block, before closing `};`:

```javascript
  rollup(personaId) {
    const persona = this.byId(personaId);
    if (!persona) return null;
    const holdings = Array.isArray(persona.metric_holdings) ? persona.metric_holdings : [];
    const held_metrics = holdings.map(h => Metrics.byId(h.metric_id)).filter(Boolean);
    const contributing_objectives_ids = new Set();
    held_metrics.forEach(m => (m.objective_ids || []).forEach(oid => contributing_objectives_ids.add(oid)));
    const contributing_objectives = [...contributing_objectives_ids]
      .map(id => Objectives.byId(id)).filter(Boolean);
    const projects = (App.data.projects || []).filter(p => p.customer === persona.customer);
    const supporting_projects = projects.filter(p => {
      const viaMetric  = (p.metric_ids  || []).some(mid => held_metrics.some(m => m.id === mid));
      const viaPersona = (p.persona_ids || []).includes(personaId);
      return viaMetric || viaPersona;
    });
    const descendants = this.descendants(personaId);
    // RACI appearances across all metrics in the customer
    const raci_appearances = { accountable: [], responsible: [], consulted: [], informed: [] };
    Metrics.list().forEach(m => {
      ['accountable','responsible','consulted','informed'].forEach(role => {
        if (m.raci && Array.isArray(m.raci[role]) && m.raci[role].includes(personaId)) {
          raci_appearances[role].push(m);
        }
      });
    });
    return { descendants, holdings, held_metrics, contributing_objectives, supporting_projects, raci_appearances };
  },
```

- [ ] **Step 4: Add Objectives.rollup**

Inside `Objectives` block:

```javascript
  rollup(objectiveId) {
    const obj = this.byId(objectiveId);
    if (!obj) return null;
    const measuring_metrics = Metrics.list().filter(m => (m.objective_ids || []).includes(objectiveId));
    const personaSet = new Set();
    Personas.list().forEach(p => {
      const holds = (p.metric_holdings || []).some(h => measuring_metrics.some(m => m.id === h.metric_id));
      if (holds) personaSet.add(p.id);
    });
    const contributing_personas = [...personaSet].map(id => Personas.byId(id)).filter(Boolean);
    const projects = (App.data.projects || []).filter(p => p.customer === obj.customer);
    const delivering_projects = projects.filter(p =>
      (p.metric_ids || []).some(mid => measuring_metrics.some(m => m.id === mid))
    );
    return {
      measuring_metrics,
      contributing_personas,
      delivering_projects,
      metric_count: measuring_metrics.length,
    };
  },
```

- [ ] **Step 5: Add Metrics.rollup**

Inside `Metrics` block:

```javascript
  rollup(metricId) {
    const metric = this.byId(metricId);
    if (!metric) return null;
    const holders = [];
    Personas.list().forEach(p => {
      (p.metric_holdings || []).filter(h => h.metric_id === metricId)
        .forEach(h => holders.push({ persona: p, holding: h }));
    });
    const served_objectives = (metric.objective_ids || [])
      .map(id => Objectives.byId(id)).filter(Boolean);
    const projects = (App.data.projects || []).filter(p => p.customer === metric.customer);
    const delivering_projects = projects.filter(p => (p.metric_ids || []).includes(metricId));
    const raci_personas = { accountable: [], responsible: [], consulted: [], informed: [] };
    if (metric.raci) {
      ['accountable','responsible','consulted','informed'].forEach(role => {
        (metric.raci[role] || []).forEach(pid => {
          const p = Personas.byId(pid);
          if (p) raci_personas[role].push(p);
        });
      });
    }
    const has_targets_anywhere = holders.some(h => Array.isArray(h.holding.targets) && h.holding.targets.length > 0);
    return {
      holders,
      holder_count: holders.length,
      served_objectives,
      delivering_projects,
      raci_personas,
      has_targets_anywhere,
    };
  },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/unit/rollups.test.mjs`
Expected: PASS — all three tests green.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/unit/rollups.test.mjs
git commit -m "feat(rollups): pure rollup functions for Personas/Objectives/Metrics"
```

---

## Phase 3 — Project linkage data layer

### Task 9: Project edit accepts new fields; column picker schema

**Files:**
- Modify: `index.html` — `App.updateProject` (search for `updateProject` definition); `Dashboard.COLUMNS` (~line 9776) gains two columns; new `'multi-select'` edit type added to inline editor dispatch (search for `col.edit.type` switch)
- Test: extend `tests/unit/migration-strategy.test.mjs` with project additions

- [ ] **Step 1: Write the failing test**

```javascript
// Append to tests/unit/migration-strategy.test.mjs
describe('migration: project additions', () => {
  it('seeds metric_ids and persona_ids on existing projects', async () => {
    const data = makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      projects: [{ id: 'PR1', customer: 'Acme Industries', name: 'Old project', status: 'In Progress', delivery_config: { phase_order: ['Data Engineering'] } }],
    });
    const app = await loadApp(data);
    const p = app.App.data.projects.find(x => x.id === 'PR1');
    expect(Array.isArray(p.metric_ids)).toBe(true);
    expect(Array.isArray(p.persona_ids)).toBe(true);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it passes (already added in Task 1)**

Run: `npx vitest run tests/unit/migration-strategy.test.mjs`
Expected: PASS — Task 1 already covers this.

- [ ] **Step 3: Add the two new columns to Dashboard.COLUMNS**

Locate `Dashboard.COLUMNS` (search for the `const Dashboard = {` block ~line 9720, then `COLUMNS: [`). Add two new column entries (off by default), placing them after the `category` column or where contextually fits:

```javascript
{ key: 'personas', label: 'Personas', defaultVisible: false,
  render: (p) => Dashboard._renderPersonaChips(p),
  edit:   { type: 'multi-select', field: 'persona_ids', source: 'personas' } },
{ key: 'metrics', label: 'Metrics', defaultVisible: false,
  render: (p) => Dashboard._renderMetricChips(p),
  edit:   { type: 'multi-select', field: 'metric_ids', source: 'metrics' } },
```

Then add the helper renderers somewhere inside `Dashboard`:

```javascript
_renderPersonaChips(project) {
  const ids = project.persona_ids || [];
  if (!ids.length) return '<span class="muted">—</span>';
  return ids.map(id => {
    const p = Personas.byId(id);
    if (!p) return '';
    return '<span class="chip-sm">' + Dashboard.esc(p.name) + '</span>';
  }).join(' ');
},
_renderMetricChips(project) {
  const ids = project.metric_ids || [];
  if (!ids.length) return '<span class="muted">—</span>';
  return ids.map(id => {
    const m = Metrics.byId(id);
    if (!m) return '';
    const grp = MetricGroups.byId(m.group_id);
    const swatch = grp ? grp.swatch : '#888';
    return '<span class="chip-sm" style="border-left: 2px solid ' + swatch + '">'
         + Dashboard.esc(m.name) + '</span>';
  }).join(' ');
},
```

- [ ] **Step 4: Add 'multi-select' branch to inline editor dispatch**

Search for the inline editor `switch (col.edit.type)` or equivalent dispatch. Add a `case 'multi-select':` branch that renders a small multi-select using the `source` (one of `'personas'` or `'metrics'`) to populate options. Use existing `App.updateProject` to persist. Reference the existing `'select'` case for the pattern; emit options via `Personas.list()` or `Metrics.list()`. Persist as an array on the chosen `field`.

(Implementation detail: copy the existing `'select'` branch's structure, change to a `<select multiple>` with size attribute or a row of checkboxes, and on commit set `project[field] = [...selectedIds]` then call `App.updateProject(project)`.)

- [ ] **Step 5: Run all unit tests to verify nothing broke**

Run: `npm run test:unit`
Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(projects): add personas/metrics columns + multi-select inline editor"
```

---

## Phase 4 — Settings CRUD UI

### Task 10: Settings — Personas tab (CRUD)

**Files:**
- Modify: `index.html` — extend the Settings/Configuration view with a new "Personas" tab. Search for existing settings tabs (e.g., the Customers tab — `getCustomers()` is rendered around line 8086 and used by settings around line 6438). Match that registration pattern.
- Test: smoke render via `tests/render/strategy-personas.test.mjs` is too high-level here; defer rendering tests to Strategy view (Task 14). For now: a small smoke that the Settings page mentions "Personas" after we add it.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/render/settings-personas.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

describe('Settings — Personas tab', () => {
  it('renders the personas list for the active customer', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [
        makePersona({ id: 'P1', name: 'Sarah Chen', role_title: 'CFO' }),
        makePersona({ id: 'P2', name: 'Tom Lee',    role_title: 'Head Ops', parent_persona_id: 'P1' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const html = app.window.document.documentElement.outerHTML;
    // Open the settings personas tab (call its render directly if the module exposes one)
    const out = app.Personas.renderSettingsTab();
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('Tom Lee');
    expect(out).toContain('CFO');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/settings-personas.test.mjs`
Expected: FAIL — `renderSettingsTab` not defined.

- [ ] **Step 3: Implement Personas.renderSettingsTab**

Inside `Personas`, add a method that returns an HTML string with the persona list (name, role, parent picker), an "Add persona" affordance, and click handlers wired to `Personas.add/update/remove`:

```javascript
  renderSettingsTab() {
    const personas = this.list();
    if (!personas.length) {
      return '<div class="empty">No personas yet for ' + Dashboard.esc(App.activeCustomer || '') + '.'
           + ' <button onclick="Personas._showAddForm()">+ Add the first</button></div>';
    }
    const rows = personas.map(p => {
      const parent = p.parent_persona_id ? this.byId(p.parent_persona_id) : null;
      return '<tr data-persona-id="' + Dashboard.esc(p.id) + '">'
           +   '<td><strong>' + Dashboard.esc(p.name) + '</strong></td>'
           +   '<td>' + Dashboard.esc(p.role_title || '') + '</td>'
           +   '<td>' + (parent ? Dashboard.esc(parent.name) : '<span class="muted">top of org</span>') + '</td>'
           +   '<td>' + (p.metric_holdings || []).length + ' held</td>'
           +   '<td><button onclick="Personas._edit(\'' + p.id + '\')">edit</button>'
           +       ' <button onclick="Personas._remove(\'' + p.id + '\')">remove</button></td>'
           + '</tr>';
    }).join('');
    return '<table class="personas-settings"><thead><tr>'
         + '<th>Name</th><th>Role</th><th>Parent</th><th>Holdings</th><th></th>'
         + '</tr></thead><tbody>' + rows + '</tbody></table>'
         + '<button onclick="Personas._showAddForm()">+ Add persona</button>';
  },

  _showAddForm() { /* open modal — uses Dashboard.openModal pattern; defer impl details */ },
  _edit(id)     { /* open modal pre-filled */ },
  _remove(id)   { if (confirm('Remove this persona?')) { this.remove(id); App.renderActiveView(); } },
```

(`_showAddForm` and `_edit` should follow the existing app's modal pattern — locate `Dashboard.openModal` or similar in `index.html` and reuse.)

- [ ] **Step 4: Wire the tab into the Settings view**

Locate the Settings (Configuration) view tabs registration (search for `'Customers'` near line 6438). Add a `'Personas'` tab with `summary` and `render` callbacks pointing to `Personas.renderSettingsTab()`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/render/settings-personas.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/render/settings-personas.test.mjs
git commit -m "feat(settings): Personas CRUD tab with parent picker"
```

---

### Task 11: Settings — Objectives tab (CRUD)

**Files:**
- Modify: `index.html`
- Test: `tests/render/settings-objectives.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/render/settings-objectives.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeObjective, resetIdSeq } from '../harness/fixtures.mjs';

describe('Settings — Objectives tab', () => {
  it('renders the objectives list with status pills', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      objectives: [
        makeObjective({ id: 'O1', name: 'Reduce opex', status: 'active' }),
        makeObjective({ id: 'O2', name: 'Tooling done', status: 'achieved' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Objectives.renderSettingsTab();
    expect(out).toContain('Reduce opex');
    expect(out).toContain('Tooling done');
    expect(out).toMatch(/active/i);
    expect(out).toMatch(/achieved/i);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/settings-objectives.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement Objectives.renderSettingsTab**

Add inside `Objectives`:

```javascript
  renderSettingsTab() {
    const objs = this.list();
    if (!objs.length) {
      return '<div class="empty">No objectives yet for ' + Dashboard.esc(App.activeCustomer || '') + '.'
           + ' <button onclick="Objectives._showAddForm()">+ Add the first</button></div>';
    }
    const rows = objs.map(o => {
      const start = (o.time_horizon && o.time_horizon.start_date)  || '';
      const end   = (o.time_horizon && o.time_horizon.target_date) || '';
      return '<tr data-objective-id="' + Dashboard.esc(o.id) + '">'
           +   '<td><strong>' + Dashboard.esc(o.name) + '</strong></td>'
           +   '<td><span class="status-pill status-' + Dashboard.esc(o.status) + '">' + Dashboard.esc(o.status) + '</span></td>'
           +   '<td>' + Dashboard.esc(start) + (start || end ? ' → ' : '') + Dashboard.esc(end) + '</td>'
           +   '<td><button onclick="Objectives._edit(\'' + o.id + '\')">edit</button>'
           +       ' <button onclick="Objectives._remove(\'' + o.id + '\')">remove</button></td>'
           + '</tr>';
    }).join('');
    return '<table class="objectives-settings"><thead><tr>'
         + '<th>Name</th><th>Status</th><th>Window</th><th></th>'
         + '</tr></thead><tbody>' + rows + '</tbody></table>'
         + '<button onclick="Objectives._showAddForm()">+ Add objective</button>';
  },
  _showAddForm() { /* modal */ },
  _edit(id)     { /* modal */ },
  _remove(id)   { if (confirm('Remove this objective?')) { this.remove(id); App.renderActiveView(); } },
```

Wire into Settings tabs registry alongside Personas.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/settings-objectives.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/settings-objectives.test.mjs
git commit -m "feat(settings): Objectives CRUD tab with status pills"
```

---

### Task 12: Settings — Metrics tab (CRUD on definitions)

**Files:**
- Modify: `index.html`
- Test: `tests/render/settings-metrics.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/render/settings-metrics.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Settings — Metrics tab', () => {
  it('renders the library list with group + status', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [
        makeMetric({ id: 'M1', name: 'Revenue',     group_id: 'performance', status: 'live' }),
        makeMetric({ id: 'M2', name: 'NPS',         group_id: 'customer',    status: 'draft' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderSettingsTab();
    expect(out).toContain('Revenue');
    expect(out).toContain('NPS');
    expect(out).toMatch(/Performance/i);
    expect(out).toMatch(/Customer/i);
    expect(out).toMatch(/live/i);
    expect(out).toMatch(/draft/i);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/settings-metrics.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement Metrics.renderSettingsTab**

```javascript
  renderSettingsTab() {
    const metrics = this.list();
    const groups  = MetricGroups.list();
    const groupName = (id) => { const g = groups.find(x => x.id === id); return g ? g.name : id; };
    const groupSwatch = (id) => { const g = groups.find(x => x.id === id); return g ? g.swatch : '#888'; };
    if (!metrics.length) {
      return '<div class="empty">No metrics yet for ' + Dashboard.esc(App.activeCustomer || '') + '.'
           + ' <button onclick="Metrics._showAddForm()">+ Add the first</button></div>';
    }
    const rows = metrics.map(m => {
      const dims = (m.dimensions || []).join(', ') || '<span class="muted">none</span>';
      return '<tr data-metric-id="' + Dashboard.esc(m.id) + '">'
           +   '<td><strong>' + Dashboard.esc(m.name) + '</strong></td>'
           +   '<td><span class="group-tag" style="border-left: 3px solid ' + groupSwatch(m.group_id) + '; padding-left: 4px;">'
           +     Dashboard.esc(groupName(m.group_id)) + '</span></td>'
           +   '<td>' + dims + '</td>'
           +   '<td><span class="status-pill status-' + Dashboard.esc(m.status) + '">' + Dashboard.esc(m.status) + '</span></td>'
           +   '<td><button onclick="Metrics._edit(\'' + m.id + '\')">edit</button>'
           +       ' <button onclick="Metrics._remove(\'' + m.id + '\')">remove</button></td>'
           + '</tr>';
    }).join('');
    return '<table class="metrics-settings"><thead><tr>'
         + '<th>Name</th><th>Group</th><th>Dimensions</th><th>Status</th><th></th>'
         + '</tr></thead><tbody>' + rows + '</tbody></table>'
         + '<button onclick="Metrics._showAddForm()">+ Add metric</button>'
         + '<button onclick="MetricGroups._openConfig()" style="margin-left: 8px;">edit groups…</button>';
  },
  _showAddForm() { /* modal */ },
  _edit(id)     { /* modal with definition, pseudo_logic, dimensions, group, RACI, objective links */ },
  _remove(id)   { if (confirm('Remove this metric? Holdings on personas will be deleted.')) { this.remove(id); App.renderActiveView(); } },
```

Wire into Settings tabs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/settings-metrics.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/settings-metrics.test.mjs
git commit -m "feat(settings): Metrics CRUD tab with group + dimensions"
```

---

### Task 13: MetricGroups config UI

**Files:**
- Modify: `index.html` — `MetricGroups._openConfig` opens an inline modal listing groups (name, swatch, in-use count) with add/edit/remove. Remove is blocked when in use (already enforced in `MetricGroups.remove`); UI surfaces the block as a tooltip.
- Test: `tests/render/metric-groups-config.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/render/metric-groups-config.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('MetricGroups config', () => {
  it('renders the three default groups with in-use counts', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [
        makeMetric({ name: 'A', group_id: 'performance' }),
        makeMetric({ name: 'B', group_id: 'performance' }),
        makeMetric({ name: 'C', group_id: 'customer' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.MetricGroups.renderConfigBody();
    expect(out).toMatch(/Customer.*1/);
    expect(out).toMatch(/Performance.*2/);
    expect(out).toMatch(/Operations.*0/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/metric-groups-config.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement MetricGroups.renderConfigBody and _openConfig**

Inside `MetricGroups`:

```javascript
  renderConfigBody() {
    const groups = this.list();
    const metrics = Metrics.list();
    const inUse = (id) => metrics.filter(m => m.group_id === id).length;
    const rows = groups.map(g => {
      const n = inUse(g.id);
      const removeBtn = n > 0
        ? '<button disabled title="Cannot remove: ' + n + ' metric(s) in this group">remove</button>'
        : '<button onclick="MetricGroups._remove(\'' + g.id + '\')">remove</button>';
      return '<tr><td><span style="display:inline-block;width:10px;height:10px;background:' + g.swatch + ';border-radius:2px;"></span> '
           +   '<strong>' + Dashboard.esc(g.name) + '</strong></td>'
           +   '<td>' + Dashboard.esc(g.id) + '</td>'
           +   '<td>' + n + '</td>'
           +   '<td><button onclick="MetricGroups._edit(\'' + g.id + '\')">rename</button> ' + removeBtn + '</td>'
           + '</tr>';
    }).join('');
    return '<table><thead><tr><th>Group</th><th>id</th><th>In use</th><th></th></tr></thead><tbody>'
         +   rows
         + '</tbody></table>'
         + '<button onclick="MetricGroups._showAddForm()">+ Add group</button>';
  },

  _openConfig() { /* open modal containing this.renderConfigBody() */ },
  _edit(id)     { /* prompt new name, call this.update */ },
  _remove(id)   { if (confirm('Remove this group?')) { this.remove(id); App.renderActiveView(); } },
  _showAddForm(){ /* prompt id+name+swatch, call this.add */ },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/metric-groups-config.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/metric-groups-config.test.mjs
git commit -m "feat(settings): MetricGroups config UI with in-use count"
```

---

## Phase 5 — Strategy view (top-level)

### Task 14: Strategy view scaffold + tab routing

**Files:**
- Modify: `index.html` — add `const Strategy = {};` module; add a new top-level "Strategy" entry to whatever drives the main view tabs (search for the navigation registration; existing views are Dashboard / Projects / Sprint Planning / Roadmap / Capacity / Governance / Configuration). Slot Strategy between Dashboard and Projects.
- Test: `tests/render/strategy-scaffold.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/render/strategy-scaffold.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

describe('Strategy view scaffold', () => {
  it('exposes three tabs: Personas, Objectives, Metrics', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const tabs = app.Strategy.tabs();
    expect(tabs.map(t => t.id)).toEqual(['personas', 'objectives', 'metrics']);
  });

  it('render() returns html containing all three tab labels', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const html = app.Strategy.render();
    expect(html).toContain('Personas');
    expect(html).toContain('Objectives');
    expect(html).toContain('Metrics');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/strategy-scaffold.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Add Strategy module**

After the other Strategy modules (Personas / Objectives / Metrics / MetricGroups), add:

```javascript
// ===== Strategy view (top-level) =====
const Strategy = {
  TABS: [
    { id: 'personas',   label: 'Personas'   },
    { id: 'objectives', label: 'Objectives' },
    { id: 'metrics',    label: 'Metrics'    },
  ],

  tabs() { return this.TABS.slice(); },

  activeTab() {
    return App.uiStateGet ? (App.uiStateGet('strategy.tab') || 'personas') : 'personas';
  },

  setActiveTab(id) {
    if (App.uiStateSet) App.uiStateSet('strategy.tab', id);
    App.renderActiveView();
  },

  render() {
    const active = this.activeTab();
    const tabs = this.TABS.map(t =>
      '<button class="tab' + (t.id === active ? ' active' : '') + '" '
      +   'onclick="Strategy.setActiveTab(\'' + t.id + '\')">' + Dashboard.esc(t.label) + '</button>'
    ).join('');
    let body = '';
    if      (active === 'personas')   body = this._renderPersonas();
    else if (active === 'objectives') body = this._renderObjectives();
    else if (active === 'metrics')    body = this._renderMetrics();
    return '<div class="strategy-view">'
         +   '<div class="strategy-tabs">' + tabs + '</div>'
         +   '<div class="strategy-body">' + body + '</div>'
         + '</div>';
  },

  _renderPersonas()   { return Personas.renderInventoryTab(); },
  _renderObjectives() { return Objectives.renderInventoryTab(); },
  _renderMetrics()    { return Metrics.renderInventoryTab(); },
};
```

(Inventory render methods come in Tasks 15-17; for now, they can return placeholder strings so the test passes.)

Add stubs to each module returning `'<!-- TODO -->'`.

- [ ] **Step 4: Wire Strategy into the main view router**

Locate the main view router/registration. Add `'Strategy'` between Dashboard and Projects, render via `Strategy.render()`.

- [ ] **Step 5: Add Strategy to bridge**

Add `Strategy` to `window.__pcc__` in `tests/harness/loadApp.mjs`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/render/strategy-scaffold.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/harness/loadApp.mjs tests/render/strategy-scaffold.test.mjs
git commit -m "feat(strategy): top-level view scaffold with three tabs"
```

---

### Task 15: Strategy — Personas inventory tab

**Files:**
- Modify: `index.html` — replace the Personas inventory stub with the real implementation. Each row renders persona's metric_holdings as chips with status dot, group swatch, dimension filter tag, and `+N` RACI badge when applicable.
- Test: `tests/render/strategy-personas.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/render/strategy-personas.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — Personas inventory', () => {
  it('renders personas grouped by hierarchy with metric chips', async () => {
    resetIdSeq();
    const sarah = makePersona({ id: 'P1', name: 'Sarah Chen', role_title: 'CFO', parent_persona_id: null });
    const diane = makePersona({ id: 'P2', name: 'Diane Yuen', role_title: 'GM N', parent_persona_id: 'P1' });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [{ period: '2026', value: 400, period_type: 'annual' }] }];
    diane.metric_holdings = [{ id: 'H2', metric_id: 'M1', filter: { region: 'North' }, targets: [] }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah, diane],
      metrics: [makeMetric({ id: 'M1', name: 'Revenue', dimensions: ['region'], group_id: 'performance' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.renderInventoryTab();
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('Diane Yuen');
    expect(out).toContain('Revenue');
    expect(out).toContain('region: North');
    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-personas.html');
  });

  it('shows "no metrics" hint for empty personas', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'P1', name: 'Tom', role_title: 'Ops' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.renderInventoryTab();
    expect(out.toLowerCase()).toContain('no metrics');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/strategy-personas.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Replace stub with real implementation**

Inside `Personas`:

```javascript
  renderInventoryTab() {
    const personas = this.list();
    const groups   = MetricGroups.list();
    const groupSwatch = (id) => { const g = groups.find(x => x.id === id); return g ? g.swatch : '#888'; };

    // Order: roots first, then sorted depth-first traversal
    const roots = personas.filter(p => !p.parent_persona_id);
    const ordered = [];
    const visit = (p, depth) => {
      ordered.push({ p, depth });
      personas.filter(c => c.parent_persona_id === p.id).forEach(c => visit(c, depth + 1));
    };
    roots.forEach(r => visit(r, 0));

    const rowHtml = ({ p, depth }) => {
      const indentPx = depth * 18;
      const holdings = p.metric_holdings || [];
      const chipsHtml = holdings.length
        ? holdings.map(h => {
            const m = Metrics.byId(h.metric_id);
            if (!m) return '';
            const dot = m.status === 'live' ? '#5fc995' : '#6a7488';
            const swatch = groupSwatch(m.group_id);
            const filterEntries = Object.entries(h.filter || {});
            const filterTag = filterEntries.length
              ? '<span class="filter-tag">' + Dashboard.esc(filterEntries.map(([k,v]) => k + ': ' + v).join(', ')) + '</span>'
              : '';
            // RACI extras count: total non-empty roles minus accountable === any
            const raciCount = ['responsible','consulted','informed']
              .reduce((n, role) => n + ((m.raci && m.raci[role] && m.raci[role].length) || 0), 0);
            const raciBadge = raciCount > 0
              ? '<span class="raci-badge" data-metric-id="' + Dashboard.esc(m.id) + '">+' + raciCount + '</span>'
              : '';
            return '<span class="chip" data-metric-id="' + Dashboard.esc(m.id) + '">'
                 +   '<span class="chip-dot" style="background:' + dot + '"></span>'
                 +   '<span class="group-swatch" style="background:' + swatch + '"></span>'
                 +   Dashboard.esc(m.name)
                 +   filterTag
                 +   raciBadge
                 + '</span>';
          }).join(' ')
        : '<span class="muted">No metrics</span> '
        + '<button class="ghost" onclick="Personas._addHoldingPrompt(\'' + p.id + '\')">+ add</button>';
      return '<div class="strategy-row" data-persona-id="' + Dashboard.esc(p.id) + '" '
           +   'style="padding-left:' + indentPx + 'px;" '
           +   'onclick="Personas._openDetail(\'' + p.id + '\')">'
           +   '<div class="persona-meta"><strong>' + Dashboard.esc(p.name) + '</strong>'
           +   ' <span class="role">' + Dashboard.esc(p.role_title || '') + '</span></div>'
           +   '<div class="persona-chips">' + chipsHtml + '</div>'
           + '</div>';
    };

    return '<div class="strategy-personas">'
         +   ordered.map(rowHtml).join('')
         + '</div>';
  },

  _openDetail(id)             { /* open detail panel for the persona */ },
  _addHoldingPrompt(personaId){ /* open holding-assign modal: pick metric, filter, targets */ },
```

- [ ] **Step 4: Update strategy-scaffold render to use the new method**

Already wired via `_renderPersonas() { return Personas.renderInventoryTab(); }`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/render/strategy-personas.test.mjs`
Expected: PASS — first run will create the snapshot. Review the snapshot file under `tests/render/__snapshots__/strategy-personas.html` and commit it.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/render/strategy-personas.test.mjs tests/render/__snapshots__/strategy-personas.html
git commit -m "feat(strategy): Personas inventory tab with cascade chips"
```

---

### Task 15b: Personas tab toolbar — search + filters

**Files:**
- Modify: `index.html` — extend `Personas.renderInventoryTab` to prepend a toolbar: search input, status filter (All/Live/Draft), tree/flat toggle, RACI involvement filter (persona picker), dimension filter (dimension key picker), target period filter. Filters mutate `App.uiStateGet('strategy.personas.filters')` and re-render.
- Test: `tests/render/personas-toolbar-filters.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/render/personas-toolbar-filters.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('Personas tab toolbar', () => {
  it('renders search, status, RACI involvement, dimension, target period filters', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'P1', name: 'Sarah Chen' })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.renderInventoryTab();
    expect(out).toMatch(/search/i);
    expect(out).toMatch(/status/i);
    expect(out).toMatch(/raci/i);
    expect(out).toMatch(/dimension/i);
    expect(out).toMatch(/period/i);
  });

  it('applyFilters returns subset matching status=draft', async () => {
    resetIdSeq();
    const m1 = makeMetric({ id: 'M1', name: 'Live one',  status: 'live'  });
    const m2 = makeMetric({ id: 'M2', name: 'Draft one', status: 'draft' });
    const sarah = makePersona({ id: 'P1', name: 'Sarah' });
    const tom   = makePersona({ id: 'P2', name: 'Tom' });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }];
    tom.metric_holdings   = [{ id: 'H2', metric_id: 'M2', filter: {}, targets: [] }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah, tom], metrics: [m1, m2],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.applyFilters({ status: 'draft' });
    expect(out.map(p => p.id)).toEqual(['P2']);  // only Tom's holding matches a draft metric
  });

  it('applyFilters with raciInvolved filter returns personas in that RACI bucket', async () => {
    resetIdSeq();
    const m = makeMetric({ id: 'M1', name: 'Total opex', raci: { accountable: [], responsible: [], consulted: ['P3'], informed: [] } });
    const sarah = makePersona({ id: 'P1', name: 'Sarah' });
    const mei   = makePersona({ id: 'P3', name: 'Mei' });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah, mei], metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Personas.applyFilters({ raciInvolved: 'P3' });
    expect(out.map(p => p.id)).toEqual(['P3']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/personas-toolbar-filters.test.mjs`
Expected: FAIL — `applyFilters` not defined.

- [ ] **Step 3: Add `applyFilters` and toolbar to `Personas`**

Inside `Personas`:

```javascript
  applyFilters(filters) {
    let list = this.list();
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.role_title || '').toLowerCase().includes(q));
    }
    if (filters.status && filters.status !== 'all') {
      list = list.filter(p => (p.metric_holdings || []).some(h => {
        const m = Metrics.byId(h.metric_id);
        return m && m.status === filters.status;
      }));
    }
    if (filters.raciInvolved) {
      const targetPid = filters.raciInvolved;
      list = list.filter(p => Metrics.list().some(m =>
        m.raci && (
          (m.raci.accountable || []).includes(targetPid) ||
          (m.raci.responsible || []).includes(targetPid) ||
          (m.raci.consulted   || []).includes(targetPid) ||
          (m.raci.informed    || []).includes(targetPid)
        ) &&
        (p.id === targetPid || (p.metric_holdings || []).some(h => h.metric_id === m.id))
      ));
      // Tighten to just the involved persona; the spec says "show me everything Mei is C on"
      list = list.filter(p => p.id === targetPid);
    }
    if (filters.dimension) {
      list = list.filter(p => (p.metric_holdings || []).some(h =>
        Object.keys(h.filter || {}).includes(filters.dimension)));
    }
    if (filters.targetPeriod) {
      list = list.filter(p => (p.metric_holdings || []).some(h =>
        (h.targets || []).some(t => t.period === filters.targetPeriod)));
    }
    return list;
  },

  _renderToolbar(filters) {
    const dims = new Set();
    Metrics.list().forEach(m => (m.dimensions || []).forEach(d => dims.add(d)));
    const periods = new Set();
    this.list().forEach(p => (p.metric_holdings || []).forEach(h => (h.targets || []).forEach(t => periods.add(t.period))));
    const personas = this.list();
    const personaOpts = personas.map(p => '<option value="' + Dashboard.esc(p.id) + '"' + (filters.raciInvolved === p.id ? ' selected' : '') + '>' + Dashboard.esc(p.name) + '</option>').join('');
    const dimOpts    = [...dims].map(d => '<option value="' + Dashboard.esc(d) + '"' + (filters.dimension === d ? ' selected' : '') + '>' + Dashboard.esc(d) + '</option>').join('');
    const periodOpts = [...periods].sort().map(p => '<option value="' + Dashboard.esc(p) + '"' + (filters.targetPeriod === p ? ' selected' : '') + '>' + Dashboard.esc(p) + '</option>').join('');
    const sval = (k, v) => filters[k] === v ? ' selected' : '';
    return '<div class="personas-toolbar">'
         +   '<input type="search" placeholder="Search personas…" value="' + Dashboard.esc(filters.search || '') + '" onchange="Personas._setFilter(\'search\', this.value)">'
         +   '<label>Status <select onchange="Personas._setFilter(\'status\', this.value)">'
         +     '<option value="all"' + sval('status', 'all') + '>All</option>'
         +     '<option value="live"' + sval('status', 'live') + '>Live</option>'
         +     '<option value="draft"' + sval('status', 'draft') + '>Draft</option>'
         +   '</select></label>'
         +   '<label>RACI involves <select onchange="Personas._setFilter(\'raciInvolved\', this.value || null)">'
         +     '<option value="">—</option>' + personaOpts
         +   '</select></label>'
         +   '<label>Dimension <select onchange="Personas._setFilter(\'dimension\', this.value || null)">'
         +     '<option value="">—</option>' + dimOpts
         +   '</select></label>'
         +   '<label>Target period <select onchange="Personas._setFilter(\'targetPeriod\', this.value || null)">'
         +     '<option value="">—</option>' + periodOpts
         +   '</select></label>'
         + '</div>';
  },

  _setFilter(key, value) {
    const cur = (App.uiStateGet ? App.uiStateGet('strategy.personas.filters') : null) || {};
    if (value === null || value === undefined || value === '') delete cur[key]; else cur[key] = value;
    if (App.uiStateSet) App.uiStateSet('strategy.personas.filters', cur);
    App.renderActiveView();
  },
```

Modify `renderInventoryTab` to:
1. Read filters from `App.uiStateGet('strategy.personas.filters') || {}`
2. Call `_renderToolbar(filters)` and prepend it to the output
3. Replace the `personas = this.list()` line with `personas = this.applyFilters(filters)`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/personas-toolbar-filters.test.mjs`
Expected: PASS — all three tests green.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/personas-toolbar-filters.test.mjs
git commit -m "feat(strategy): Personas tab toolbar filters (status, RACI, dimension, target period)"
```

---

### Task 16: RACI badge popover behaviour

**Files:**
- Modify: `index.html` — wire click on `.raci-badge` to a popover showing R/A/C/I personas. Use any existing popover/tooltip pattern; if none exists, build a small absolute-positioned div.
- Test: render-only smoke; click behaviour exercised in E2E (Task 23).

- [ ] **Step 1: Write the failing test**

```javascript
// tests/render/raci-popover.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('RACI popover', () => {
  it('renderRaciPopover returns rows for all four roles', async () => {
    resetIdSeq();
    const sarah  = makePersona({ id: 'PS', name: 'Sarah Chen' });
    const james  = makePersona({ id: 'PJ', name: 'James Park' });
    const mei    = makePersona({ id: 'PM', name: 'Mei Tanaka' });
    const ben    = makePersona({ id: 'PB', name: 'Ben Walsh'  });
    const m = makeMetric({ id: 'M1', name: 'Total opex',
      raci: { accountable: ['PS'], responsible: ['PJ'], consulted: ['PM'], informed: ['PB'] } });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah, james, mei, ben],
      metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const html = app.Metrics.renderRaciPopover('M1');
    expect(html).toContain('Sarah Chen');
    expect(html).toContain('James Park');
    expect(html).toContain('Mei Tanaka');
    expect(html).toContain('Ben Walsh');
    expect(html.toUpperCase()).toContain('A');
    expect(html.toUpperCase()).toContain('R');
    expect(html.toUpperCase()).toContain('C');
    expect(html.toUpperCase()).toContain('I');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/raci-popover.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement Metrics.renderRaciPopover**

Inside `Metrics`:

```javascript
  renderRaciPopover(metricId) {
    const m = this.byId(metricId);
    if (!m) return '';
    const r = this.rollup(metricId);
    const row = (letter, persona) => '<div class="raci-row">'
      +   '<span class="raci-letter raci-' + letter + '">' + letter + '</span>'
      +   '<span class="raci-name">' + Dashboard.esc(persona.name) + '</span>'
      +   '<span class="raci-role">' + Dashboard.esc(persona.role_title || '') + '</span>'
      + '</div>';
    let html = '<div class="raci-popover"><div class="title">'
             + Dashboard.esc(m.name) + ' · RACI</div>';
    r.raci_personas.accountable.forEach(p => html += row('A', p));
    r.raci_personas.responsible.forEach(p => html += row('R', p));
    r.raci_personas.consulted.forEach(p => html += row('C', p));
    r.raci_personas.informed.forEach(p => html += row('I', p));
    html += '</div>';
    return html;
  },
```

- [ ] **Step 4: Wire badge click**

In `Personas.renderInventoryTab`, change `<span class="raci-badge" ...>` to be a button or to call `Metrics._showRaciPopover(metricId, evt)` on click. Implement `_showRaciPopover` to inject `renderRaciPopover` HTML into a positioned overlay element.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/render/raci-popover.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/render/raci-popover.test.mjs
git commit -m "feat(strategy): RACI badge popover wiring"
```

---

### Task 17: Strategy — Objectives inventory tab

**Files:**
- Modify: `index.html` — replace `Objectives.renderInventoryTab` stub with the editorial list (status accent bar, name, description, dates as plain text, derived counts).
- Test: `tests/render/strategy-objectives.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/render/strategy-objectives.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeObjective, makeMetric, makePersona, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — Objectives inventory', () => {
  it('renders objective entries with derived counts', async () => {
    resetIdSeq();
    const obj = makeObjective({ id: 'O1', name: 'Reduce opex 15%', description: 'Drive opex efficiencies.', status: 'active',
      time_horizon: { start_date: '2025-06-01', target_date: '2026-05-31' } });
    const m  = makeMetric({ id: 'M1', name: 'Total opex', objective_ids: ['O1'] });
    const persona = makePersona({ id: 'P1' });
    persona.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }];
    const project = makeProject({ id: 'PR1', metric_ids: ['M1'] });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      objectives: [obj], metrics: [m], personas: [persona], projects: [project],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Objectives.renderInventoryTab();
    expect(out).toContain('Reduce opex 15%');
    expect(out).toContain('Total opex');                       // linked metric chip
    expect(out).toMatch(/1.*metrics?/);                        // count
    expect(out).toMatch(/1.*personas?/);
    expect(out).toMatch(/1.*projects?/);
    expect(out).toContain('2025-06-01');
    expect(out).toContain('2026-05-31');
    expect(out).not.toContain('Uncovered');
    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-objectives.html');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/strategy-objectives.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Replace stub**

```javascript
  renderInventoryTab() {
    const objs = this.list();
    if (!objs.length) {
      return '<div class="empty">No objectives for ' + Dashboard.esc(App.activeCustomer || '') + '.</div>';
    }
    const entryHtml = (o) => {
      const r = this.rollup(o.id);
      const start = (o.time_horizon && o.time_horizon.start_date)  || '';
      const end   = (o.time_horizon && o.time_horizon.target_date) || '';
      const window = start || end ? Dashboard.esc(start) + ' → ' + Dashboard.esc(end) : 'not set';
      const chips = r.measuring_metrics.map(m =>
        '<span class="chip" data-metric-id="' + Dashboard.esc(m.id) + '">'
        +   Dashboard.esc(m.name)
        + '</span>'
      ).join(' ');
      return '<div class="strategy-row obj obj-' + Dashboard.esc(o.status) + '" data-objective-id="' + Dashboard.esc(o.id) + '"'
           +   ' onclick="Objectives._openDetail(\'' + o.id + '\')">'
           +   '<span class="accent"></span>'
           +   '<div class="body">'
           +     '<div class="title">' + Dashboard.esc(o.name) + '</div>'
           +     '<div class="desc">' + Dashboard.esc(o.description || '') + '</div>'
           +     '<div class="meta">'
           +       '<span><span class="caps">Window</span> ' + window + '</span>'
           +       '<span><span class="caps">Metrics</span> ' + r.metric_count + '</span>'
           +       '<span><span class="caps">Personas</span> ' + r.contributing_personas.length + '</span>'
           +       '<span><span class="caps">Projects</span> ' + r.delivering_projects.length + '</span>'
           +       '<span class="status-text">' + Dashboard.esc(o.status) + '</span>'
           +     '</div>'
           +     '<div class="chips">' + chips + '</div>'
           +   '</div>'
           + '</div>';
    };
    return '<div class="strategy-objectives">' + objs.map(entryHtml).join('') + '</div>';
  },

  _openDetail(id) { /* open detail panel for the objective */ },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/strategy-objectives.test.mjs`
Expected: PASS — review snapshot.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/strategy-objectives.test.mjs tests/render/__snapshots__/strategy-objectives.html
git commit -m "feat(strategy): Objectives inventory tab — editorial list"
```

---

### Task 18: Strategy — Metrics inventory tab (left pane: library list)

**Files:**
- Modify: `index.html` — `Metrics.renderInventoryTab` returns a two-pane layout (library list + detail). This task implements the library list; detail comes in Task 19.
- Test: `tests/render/strategy-metrics-list.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/render/strategy-metrics-list.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — Metrics inventory list', () => {
  it('renders library rows with group, status, holder count, dimensions', async () => {
    resetIdSeq();
    const m1 = makeMetric({ id: 'M1', name: 'Revenue',     status: 'live',  group_id: 'performance', dimensions: ['region'] });
    const m2 = makeMetric({ id: 'M2', name: 'Customer NPS', status: 'draft', group_id: 'customer' });
    const sarah = makePersona({ id: 'P1', name: 'Sarah Chen' });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [m1, m2], personas: [sarah],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderInventoryTab();
    expect(out).toContain('Revenue');
    expect(out).toContain('Customer NPS');
    expect(out).toContain('region');                  // dimension tag
    expect(out).toMatch(/1.*holders?/);                // Revenue has 1 holder
    expect(out).toMatch(/0.*holders?/);                // NPS has 0
    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-metrics-list.html');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/strategy-metrics-list.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement Metrics.renderInventoryTab**

```javascript
  renderInventoryTab() {
    const metrics = this.list();
    const groups  = MetricGroups.list();
    const groupName = (id) => { const g = groups.find(x => x.id === id); return g ? g.name : id; };
    const groupSwatch = (id) => { const g = groups.find(x => x.id === id); return g ? g.swatch : '#888'; };
    const selectedId = (App.uiStateGet ? App.uiStateGet('strategy.metric.selected') : null) || (metrics[0] && metrics[0].id);

    const rowHtml = (m) => {
      const r = this.rollup(m.id);
      const isSel = (m.id === selectedId);
      const dims = (m.dimensions || []).map(d => '<span class="dim-tag">' + Dashboard.esc(d) + '</span>').join(' ');
      return '<div class="metric-row' + (isSel ? ' selected' : '') + '" '
           +   'data-metric-id="' + Dashboard.esc(m.id) + '" '
           +   'onclick="Metrics._select(\'' + m.id + '\')">'
           +   '<span class="accent" style="background:' + groupSwatch(m.group_id) + '"></span>'
           +   '<div class="body">'
           +     '<div class="top">'
           +       '<span class="name">' + Dashboard.esc(m.name) + '</span>'
           +       '<span class="status status-' + Dashboard.esc(m.status) + '">' + Dashboard.esc(m.status) + '</span>'
           +     '</div>'
           +     '<div class="desc">' + Dashboard.esc(m.definition || '') + '</div>'
           +     '<div class="meta">'
           +       '<span class="group-tag">' + Dashboard.esc(groupName(m.group_id)) + '</span>'
           +       '<span>' + r.holder_count + ' holders</span>'
           +       dims
           +     '</div>'
           +   '</div>'
           + '</div>';
    };

    const detail = selectedId
      ? this.renderDetailPane(selectedId)
      : '<div class="empty">No metric selected</div>';

    return '<div class="strategy-metrics">'
         +   '<div class="library-pane">' + metrics.map(rowHtml).join('') + '</div>'
         +   '<div class="detail-pane">'  + detail + '</div>'
         + '</div>';
  },

  _select(id) {
    if (App.uiStateSet) App.uiStateSet('strategy.metric.selected', id);
    App.renderActiveView();
  },

  renderDetailPane(id) { return '<!-- detail TODO Task 19 -->'; },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/strategy-metrics-list.test.mjs`
Expected: PASS — review snapshot.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/strategy-metrics-list.test.mjs tests/render/__snapshots__/strategy-metrics-list.html
git commit -m "feat(strategy): Metrics inventory left pane (library list)"
```

---

### Task 19: Strategy — Metrics detail pane (right pane with cascade table)

**Files:**
- Modify: `index.html` — replace `renderDetailPane` stub with full detail (definition, pseudo_logic, source, dimensions, linked objectives, definition-level RACI, cascade table).
- Test: `tests/render/strategy-metrics-detail.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/render/strategy-metrics-detail.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePersona, makeObjective, resetIdSeq } from '../harness/fixtures.mjs';

describe('Strategy — Metrics detail pane', () => {
  it('renders definition, pseudo_logic, RACI, and cascade table', async () => {
    resetIdSeq();
    const sarah = makePersona({ id: 'PS', name: 'Sarah Chen', role_title: 'CFO' });
    const diane = makePersona({ id: 'PD', name: 'Diane Yuen', role_title: 'GM N' });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {},                  targets: [{ period: '2026', value: 400, period_type: 'annual' }] }];
    diane.metric_holdings = [{ id: 'H2', metric_id: 'M1', filter: { region: 'North' }, targets: [{ period: '2026', value: 200, period_type: 'annual' }] }];
    const obj = makeObjective({ id: 'O1', name: 'Grow regional revenue 12%' });
    const m = makeMetric({
      id: 'M1', name: 'Revenue', definition: 'Total recognised revenue.',
      pseudo_logic: 'SUM(order_lines.recognised_amount)',
      source: 'Snowflake · prod.fct_revenue', dimensions: ['region'],
      objective_ids: ['O1'],
      raci: { accountable: ['PS'], responsible: [], consulted: [], informed: [] },
    });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah, diane], metrics: [m], objectives: [obj],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.Metrics.renderDetailPane('M1');
    expect(out).toContain('Total recognised revenue');
    expect(out).toContain('SUM(order_lines.recognised_amount)');
    expect(out).toContain('Snowflake');
    expect(out).toContain('region');
    expect(out).toContain('Grow regional revenue 12%');
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('Diane Yuen');
    expect(out).toContain('region: North');
    expect(out).toContain('£400'); // or '400' — adjust assertion if currency formatting differs
    expect(out).toContain('200');
    await expect(out).toMatchFileSnapshot('./__snapshots__/strategy-metrics-detail.html');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/strategy-metrics-detail.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement renderDetailPane**

Inside `Metrics`:

```javascript
  renderDetailPane(id) {
    const m = this.byId(id);
    if (!m) return '<div class="empty">Metric not found</div>';
    const r = this.rollup(id);
    const groups = MetricGroups.list();
    const grp = groups.find(g => g.id === m.group_id);
    const grpHtml = grp
      ? '<span class="group-tag" style="border-left: 3px solid ' + grp.swatch + '; padding-left: 4px;">' + Dashboard.esc(grp.name) + '</span>'
      : '';

    const dimsHtml = (m.dimensions || []).length
      ? (m.dimensions || []).map(d => '<span class="dim-tag">' + Dashboard.esc(d) + '</span>').join(' ')
      : '<span class="muted">none</span>';

    const objHtml = r.served_objectives.length
      ? r.served_objectives.map(o => '<span class="obj-chip">' + Dashboard.esc(o.name) + '</span>').join(' ')
      : '<span class="muted">none</span>';

    const raciRow = (letter, persona) => '<div class="raci-row">'
      +   '<span class="raci-letter raci-' + letter + '">' + letter + '</span>'
      +   '<span class="raci-name">' + Dashboard.esc(persona.name) + '</span>'
      +   '<span class="raci-role">' + Dashboard.esc(persona.role_title || '') + '</span>'
      + '</div>';
    let raciHtml = '';
    r.raci_personas.accountable.forEach(p => raciHtml += raciRow('A', p));
    r.raci_personas.responsible.forEach(p => raciHtml += raciRow('R', p));
    r.raci_personas.consulted.forEach(p => raciHtml += raciRow('C', p));
    r.raci_personas.informed.forEach(p => raciHtml += raciRow('I', p));
    if (!raciHtml) raciHtml = '<span class="muted">no RACI assigned</span>';

    const cascadeRow = ({ persona, holding }) => {
      const filterEntries = Object.entries(holding.filter || {});
      const filterCell = filterEntries.length
        ? '<span class="filter-tag">' + Dashboard.esc(filterEntries.map(([k,v]) => k + ': ' + v).join(', ')) + '</span>'
        : '<span class="muted">all (' + ((m.dimensions || [])[0] || 'unfiltered') + ')</span>';
      const targetCell = (holding.targets || []).length
        ? holding.targets.map(t => Dashboard.esc(t.period) + ' £' + Dashboard.esc(String(t.value))).join(' &nbsp; ')
        : '<span class="muted">no target</span>';
      return '<tr><td><strong>' + Dashboard.esc(persona.name) + '</strong>'
           +    ' <span class="role">' + Dashboard.esc(persona.role_title || '') + '</span></td>'
           +    '<td>' + filterCell + '</td>'
           +    '<td>' + targetCell + '</td>'
           +    '<td><button onclick="Metrics._editHolding(\'' + persona.id + '\',\'' + holding.id + '\')">edit</button></td>'
           + '</tr>';
    };
    const cascadeBody = r.holders.length
      ? r.holders.map(cascadeRow).join('')
      : '<tr><td colspan="4" class="muted">No holders yet — assign this metric to a persona.</td></tr>';

    return '<div class="metric-detail">'
         +   '<div class="hdr">'
         +     '<h2>' + Dashboard.esc(m.name) + '</h2>'
         +     '<div class="hdr-meta">' + grpHtml
         +       ' <span class="status status-' + Dashboard.esc(m.status) + '">' + Dashboard.esc(m.status) + '</span>'
         +     '</div>'
         +   '</div>'
         +   '<div class="sec"><div class="caps">Definition</div><div>' + Dashboard.esc(m.definition || '') + '</div></div>'
         +   '<div class="sec"><div class="caps">Pseudo-logic</div><pre class="pseudo">' + Dashboard.esc(m.pseudo_logic || '') + '</pre></div>'
         +   '<div class="sec grid-2">'
         +     '<div>'
         +       '<div class="caps">Source</div><div>' + Dashboard.esc(m.source || '') + '</div>'
         +       '<div class="caps" style="margin-top:12px;">Dimensions</div><div>' + dimsHtml + '</div>'
         +       '<div class="caps" style="margin-top:12px;">Linked objectives</div><div>' + objHtml + '</div>'
         +     '</div>'
         +     '<div>'
         +       '<div class="caps">RACI · definition</div>' + raciHtml
         +     '</div>'
         +   '</div>'
         +   '<div class="sec"><div class="caps">Cascade · ' + r.holder_count + ' holders</div>'
         +     '<table class="cascade-table"><thead><tr>'
         +       '<th>Persona &amp; role</th><th>Filter</th><th>Target</th><th></th>'
         +     '</tr></thead><tbody>' + cascadeBody + '</tbody></table>'
         +     '<button onclick="Metrics._addHolderPrompt(\'' + id + '\')">+ assign to another persona</button>'
         +   '</div>'
         + '</div>';
  },

  _editHolding(personaId, holdingId) { /* open holding modal pre-filled */ },
  _addHolderPrompt(metricId)         { /* open holding modal: pick persona, filter, targets */ },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/strategy-metrics-detail.test.mjs`
Expected: PASS — review snapshot.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/strategy-metrics-detail.test.mjs tests/render/__snapshots__/strategy-metrics-detail.html
git commit -m "feat(strategy): Metrics detail pane with cascade table"
```

---

## Phase 6 — Project linkage UI

### Task 20: Project edit form — Metrics + Personas pickers

**Files:**
- Modify: `index.html` — locate the project edit form (search for the form HTML around `addProject` ~line 15486 or `DetailPanel`'s edit mode). Add two new picker controls: searchable multi-select for Metrics (results grouped by group_id), simple multi-select for Personas. Persist via `App.updateProject`.
- Test: render-only smoke; full flow tested via E2E in Task 23.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/render/project-edit-pickers.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePersona, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

describe('Project edit form — strategy pickers', () => {
  it('Dashboard renders persona/metric pickers in the edit form', async () => {
    resetIdSeq();
    const project = makeProject({ id: 'PR1', name: 'Q3 refresh' });
    const m = makeMetric({ id: 'M1', name: 'Revenue', group_id: 'performance' });
    const p = makePersona({ id: 'P1', name: 'Sarah Chen' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      projects: [project], metrics: [m], personas: [p],
    }));
    app.App.activeCustomer = 'Acme Industries';
    // Whichever module renders the edit form (DetailPanel or Dashboard); call its render directly.
    const html = app.DetailPanel.renderStrategyEditFields(project);
    expect(html).toContain('Revenue');
    expect(html).toContain('Sarah Chen');
    expect(html).toMatch(/metric_ids/);
    expect(html).toMatch(/persona_ids/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/project-edit-pickers.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement DetailPanel.renderStrategyEditFields**

Inside `DetailPanel` (locate around line 12838), add:

```javascript
  renderStrategyEditFields(project) {
    const personas = Personas.list();
    const metrics  = Metrics.list();
    const groups   = MetricGroups.list();
    const groupName = (id) => { const g = groups.find(x => x.id === id); return g ? g.name : id; };
    const selectedMetricIds  = new Set(project.metric_ids  || []);
    const selectedPersonaIds = new Set(project.persona_ids || []);

    // Group metrics by group_id for display
    const byGroup = {};
    metrics.forEach(m => {
      if (!byGroup[m.group_id]) byGroup[m.group_id] = [];
      byGroup[m.group_id].push(m);
    });
    let metricOpts = '';
    Object.keys(byGroup).forEach(gid => {
      metricOpts += '<optgroup label="' + Dashboard.esc(groupName(gid)) + '">';
      byGroup[gid].forEach(m => {
        const sel = selectedMetricIds.has(m.id) ? ' selected' : '';
        metricOpts += '<option value="' + Dashboard.esc(m.id) + '"' + sel + '>' + Dashboard.esc(m.name) + '</option>';
      });
      metricOpts += '</optgroup>';
    });
    const personaOpts = personas.map(p => {
      const sel = selectedPersonaIds.has(p.id) ? ' selected' : '';
      return '<option value="' + Dashboard.esc(p.id) + '"' + sel + '>'
           + Dashboard.esc(p.name) + (p.role_title ? ' — ' + Dashboard.esc(p.role_title) : '') + '</option>';
    }).join('');

    return '<div class="strategy-edit-fields">'
         +   '<label>Metrics this project delivers <small>— primary link</small>'
         +     '<select multiple name="metric_ids" id="proj-metric-ids" size="6">' + metricOpts + '</select>'
         +   '</label>'
         +   '<label>Personas served <small>— optional, for non-metric work</small>'
         +     '<select multiple name="persona_ids" id="proj-persona-ids" size="4">' + personaOpts + '</select>'
         +   '</label>'
         + '</div>';
  },
```

Inject this into the existing project edit form HTML (locate the form template) and on save, read `metric_ids` and `persona_ids` from the form state and pass to `App.updateProject(project)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/project-edit-pickers.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/project-edit-pickers.test.mjs
git commit -m "feat(projects): edit form gains Metrics + Personas pickers"
```

---

### Task 21: Project detail panel — Strategy section (read view)

**Files:**
- Modify: `index.html` — `DetailPanel.renderStrategySection(project)`. Three rows: Metrics (stored), Objectives (derived via metrics' objective_ids), Personas (stored direct + derived via metric holders), with derivation flags.
- Test: `tests/render/project-strategy-section.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/render/project-strategy-section.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeMetric, makeObjective, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

describe('Project detail — Strategy section', () => {
  it('shows linked metrics + derived objectives + derived personas with flags', async () => {
    resetIdSeq();
    const obj = makeObjective({ id: 'O1', name: 'Grow regional revenue' });
    const m   = makeMetric({ id: 'M1', name: 'Revenue', objective_ids: ['O1'], dimensions: ['region'] });
    const sarah = makePersona({ id: 'PS', name: 'Sarah Chen' });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }];
    const diane = makePersona({ id: 'PD', name: 'Diane Yuen' });
    diane.metric_holdings = [{ id: 'H2', metric_id: 'M1', filter: { region: 'North' }, targets: [] }];
    const project = makeProject({ id: 'PR1', metric_ids: ['M1'], persona_ids: [] });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      objectives: [obj], metrics: [m], personas: [sarah, diane], projects: [project],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.DetailPanel.renderStrategySection(project);
    expect(out).toContain('Revenue');
    expect(out).toContain('Grow regional revenue');
    expect(out).toContain('Sarah Chen');
    expect(out).toContain('Diane Yuen');
    expect(out).toMatch(/via.*Revenue/i);                     // derivation flag on objective
    expect(out).toMatch(/region: North/);                      // filter shown for cascaded persona
    await expect(out).toMatchFileSnapshot('./__snapshots__/project-strategy-section.html');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/project-strategy-section.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement DetailPanel.renderStrategySection**

```javascript
  renderStrategySection(project) {
    const linkedMetrics = (project.metric_ids || []).map(id => Metrics.byId(id)).filter(Boolean);

    // Derived objectives: union of linkedMetrics' objective_ids
    const objIdSet = new Set();
    linkedMetrics.forEach(m => (m.objective_ids || []).forEach(id => objIdSet.add(id)));
    const derivedObjectives = [...objIdSet].map(id => ({ obj: Objectives.byId(id), viaMetricNames: linkedMetrics.filter(m => (m.objective_ids || []).includes(id)).map(m => m.name) }))
                                          .filter(x => x.obj);

    // Derived personas: from holders of linkedMetrics, plus explicit persona_ids
    const personaMap = new Map(); // id → { persona, viaLabels: [] }
    Personas.list().forEach(p => {
      (p.metric_holdings || []).forEach(h => {
        const m = linkedMetrics.find(mm => mm.id === h.metric_id);
        if (!m) return;
        const filterText = Object.entries(h.filter || {}).map(([k,v]) => k + ': ' + v).join(', ');
        const label = m.name + (filterText ? ' · ' + filterText : '');
        if (!personaMap.has(p.id)) personaMap.set(p.id, { persona: p, viaLabels: [] });
        personaMap.get(p.id).viaLabels.push(label);
      });
    });
    (project.persona_ids || []).forEach(pid => {
      const p = Personas.byId(pid);
      if (!p) return;
      if (!personaMap.has(pid)) personaMap.set(pid, { persona: p, viaLabels: [] });
    });

    const metricChips = linkedMetrics.length
      ? linkedMetrics.map(m => '<span class="chip">' + Dashboard.esc(m.name) + '</span>').join(' ')
      : '<span class="muted">none</span>';

    const objectiveChips = derivedObjectives.length
      ? derivedObjectives.map(({ obj, viaMetricNames }) =>
          '<span class="obj-chip">' + Dashboard.esc(obj.name)
          + ' <span class="derived-flag">via ' + Dashboard.esc(viaMetricNames.join(', ')) + '</span></span>'
        ).join(' ')
      : '<span class="muted">none</span>';

    const personaChips = personaMap.size
      ? [...personaMap.values()].map(({ persona, viaLabels }) =>
          '<span class="persona-chip">' + Dashboard.esc(persona.name)
          + (viaLabels.length ? ' <span class="derived-flag">via ' + Dashboard.esc(viaLabels.join(' / ')) + '</span>' : '')
          + '</span>'
        ).join(' ')
      : '<span class="muted">none</span>';

    return '<div class="strategy-section">'
         +   '<div class="strategy-row"><span class="caps">Metrics</span>'    + metricChips    + '</div>'
         +   '<div class="strategy-row"><span class="caps">Objectives</span>' + objectiveChips + '</div>'
         +   '<div class="strategy-row"><span class="caps">Personas</span>'   + personaChips   + '</div>'
         + '</div>';
  },
```

Inject this into the existing project detail panel HTML rendering. Locate where the panel sections are assembled and add a `renderStrategySection(project)` call.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/project-strategy-section.test.mjs`
Expected: PASS — review snapshot.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/project-strategy-section.test.mjs tests/render/__snapshots__/project-strategy-section.html
git commit -m "feat(projects): detail panel Strategy section with derivation flags"
```

---

### Task 22: Projects table — filter by persona / objective / metric

**Files:**
- Modify: `index.html` — locate the existing project filter dropdown (search for filter rendering near `Dashboard.COLUMNS` or its filter helpers). Add three new filter selects: Persona, Objective, Metric. Filter logic: a project passes a Persona filter if `project.persona_ids` includes it OR any holder of a linked metric is that persona; similar for Metric (direct) and Objective (via metric.objective_ids).
- Test: `tests/unit/projects-filter.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/unit/projects-filter.test.mjs
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeMetric, makeObjective, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

describe('Projects filter — strategy', () => {
  it('filterByMetric returns projects directly linked to the metric', async () => {
    resetIdSeq();
    const m1 = makeMetric({ id: 'M1' });
    const m2 = makeMetric({ id: 'M2' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [m1, m2],
      projects: [
        makeProject({ id: 'PR1', metric_ids: ['M1'] }),
        makeProject({ id: 'PR2', metric_ids: ['M2'] }),
        makeProject({ id: 'PR3', metric_ids: [] }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const ids = app.Dashboard.filterByMetric('M1').map(p => p.id);
    expect(ids).toEqual(['PR1']);
  });

  it('filterByObjective returns projects via metric.objective_ids', async () => {
    resetIdSeq();
    const obj = makeObjective({ id: 'O1' });
    const m = makeMetric({ id: 'M1', objective_ids: ['O1'] });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      objectives: [obj], metrics: [m],
      projects: [makeProject({ id: 'PR1', metric_ids: ['M1'] })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Dashboard.filterByObjective('O1').map(p => p.id)).toEqual(['PR1']);
  });

  it('filterByPersona returns projects via metric holders OR explicit persona_ids', async () => {
    resetIdSeq();
    const m = makeMetric({ id: 'M1' });
    const persona = makePersona({ id: 'P1' });
    persona.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [m], personas: [persona],
      projects: [
        makeProject({ id: 'PR1', metric_ids: ['M1'] }),                  // via holding
        makeProject({ id: 'PR2', persona_ids: ['P1'] }),                 // direct
        makeProject({ id: 'PR3' }),                                       // neither
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Dashboard.filterByPersona('P1').map(p => p.id).sort()).toEqual(['PR1', 'PR2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/projects-filter.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Add filter helpers to Dashboard**

Inside `Dashboard`:

```javascript
  filterByMetric(metricId) {
    const projects = (App.data.projects || []).filter(p => p.customer === App.activeCustomer);
    return projects.filter(p => (p.metric_ids || []).includes(metricId));
  },

  filterByObjective(objectiveId) {
    const metricIds = Metrics.list().filter(m => (m.objective_ids || []).includes(objectiveId)).map(m => m.id);
    if (!metricIds.length) return [];
    const projects = (App.data.projects || []).filter(p => p.customer === App.activeCustomer);
    return projects.filter(p => (p.metric_ids || []).some(mid => metricIds.includes(mid)));
  },

  filterByPersona(personaId) {
    const persona = Personas.byId(personaId);
    const metricIds = persona ? (persona.metric_holdings || []).map(h => h.metric_id) : [];
    const projects = (App.data.projects || []).filter(p => p.customer === App.activeCustomer);
    return projects.filter(p =>
      (p.persona_ids || []).includes(personaId) ||
      (p.metric_ids  || []).some(mid => metricIds.includes(mid))
    );
  },
```

Wire these into the existing filter dropdown UI. (Locate the filter UI render — likely returns selects whose `onchange` mutates a filter object; add three new selects + branches.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/projects-filter.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/unit/projects-filter.test.mjs
git commit -m "feat(projects): filter by persona / objective / metric"
```

---

## Phase 7 — Demo data + E2E

### Task 23: E2E — full create→assign→link round-trip

**Files:**
- Create: `tests/e2e/strategy-flow.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/e2e/strategy-flow.spec.ts
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Strategy: create objective → persona → metric → assign → link to project', async ({ page }) => {
  const data = {
    meta: { version: '1.0' },
    customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    projects: [{ id: 'PR1', customer: 'Acme Industries', name: 'Q3 reporting refresh',
                 status: 'In Progress', delivery_config: { phase_order: ['Data Engineering'] } }],
    team_members: [], sprints: [], workflow_templates: [], governance_forums: [],
    annual_holidays: [], audit_log: [], settings: {},
    personas: [], objectives: [], metrics: [], metric_groups: [],
  };
  await openAppWithData(page, data);

  // Open Configuration → Personas tab; add a persona
  await page.click('button:has-text("Configuration")');
  await page.click('text=Personas');
  await page.click('button:has-text("+ Add the first")');
  await page.fill('input[name="name"]', 'Sarah Chen');
  await page.fill('input[name="role_title"]', 'CFO');
  await page.click('button:has-text("Save")');
  await expect(page.locator('text=Sarah Chen')).toBeVisible();

  // Add an objective
  await page.click('text=Objectives');
  await page.click('button:has-text("+ Add the first")');
  await page.fill('input[name="name"]', 'Reduce opex 15%');
  await page.click('button:has-text("Save")');
  await expect(page.locator('text=Reduce opex 15%')).toBeVisible();

  // Add a metric (group=performance, dimensions=[region], objective_ids=[O1])
  await page.click('text=Metrics');
  await page.click('button:has-text("+ Add the first")');
  await page.fill('input[name="name"]', 'Revenue');
  await page.fill('input[name="definition"]', 'Total revenue.');
  await page.click('button:has-text("Save")');
  await expect(page.locator('text=Revenue')).toBeVisible();

  // Open Strategy view, Personas tab — assign Revenue to Sarah
  await page.click('button:has-text("Strategy")');
  await page.click('button:has-text("Personas")');
  await page.click('text=Sarah Chen');     // open detail
  await page.click('button:has-text("+ assign metric")');
  await page.selectOption('select[name="metric_id"]', { label: 'Revenue' });
  await page.click('button:has-text("Assign")');

  // Confirm chip appears for Sarah on the inventory list
  await page.click('button:has-text("Personas")');  // back to inventory
  await expect(page.locator('text=Sarah Chen').locator('..').locator('text=Revenue')).toBeVisible();

  // Link the metric to the project
  await page.click('button:has-text("Projects")');
  await page.click('text=Q3 reporting refresh');
  await page.click('button:has-text("Edit")');
  await page.selectOption('select#proj-metric-ids', { label: 'Revenue' });
  await page.click('button:has-text("Save")');
  await expect(page.locator('.strategy-section')).toContainText('Revenue');
  await expect(page.locator('.strategy-section')).toContainText('Reduce opex 15%');
  await expect(page.locator('.strategy-section')).toContainText('Sarah Chen');
});
```

- [ ] **Step 2: Run test to verify it fails (or runs against the implementation)**

Run: `npx playwright test tests/e2e/strategy-flow.spec.ts`
Expected: PASS if all prior tasks are complete; FAIL with a clear assertion otherwise. If selectors don't match the implementation, refine the selectors to match the actual rendered HTML and re-run.

- [ ] **Step 3: Refine selectors if needed**

Inspect the page when failures occur — the actual button labels and form field names must match the implementation from Tasks 10, 11, 12, 15, 19, 20.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/strategy-flow.spec.ts
git commit -m "test(e2e): strategy round-trip create→assign→link"
```

---

### Task 24: E2E — filter projects by metric

**Files:**
- Create: `tests/e2e/projects-filter-by-metric.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/e2e/projects-filter-by-metric.spec.ts
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Projects table can filter by metric', async ({ page }) => {
  const data = {
    meta: { version: '1.0' },
    customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    projects: [
      { id: 'PR1', customer: 'Acme Industries', name: 'Has Revenue link', status: 'In Progress',
        delivery_config: { phase_order: ['Data Engineering'] }, metric_ids: ['M1'], persona_ids: [] },
      { id: 'PR2', customer: 'Acme Industries', name: 'Unrelated', status: 'In Progress',
        delivery_config: { phase_order: ['Data Engineering'] }, metric_ids: [], persona_ids: [] },
    ],
    metrics: [{ id: 'M1', customer: 'Acme Industries', name: 'Revenue', group_id: 'performance', status: 'live',
                dimensions: [], objective_ids: [], raci: { accountable:[], responsible:[], consulted:[], informed:[] }, actuals: [] }],
    team_members: [], sprints: [], workflow_templates: [], governance_forums: [],
    annual_holidays: [], audit_log: [], settings: {},
    personas: [], objectives: [], metric_groups: [],
  };
  await openAppWithData(page, data);

  await page.click('button:has-text("Projects")');
  // Apply Metric filter
  await page.selectOption('select[name="filter-metric"]', { label: 'Revenue' });
  await expect(page.locator('text=Has Revenue link')).toBeVisible();
  await expect(page.locator('text=Unrelated')).toBeHidden();
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx playwright test tests/e2e/projects-filter-by-metric.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/projects-filter-by-metric.spec.ts
git commit -m "test(e2e): filter projects by metric"
```

---

### Task 25: Demo data — seed personas/objectives/metrics + cascade example

**Files:**
- Modify: `portfolio-data.json`, `portfolio-data-demo.json`

- [ ] **Step 1: Add to portfolio-data.json (and demo)**

Open both JSON files. Inside each top-level object, add:

```json
"personas": [
  { "id": "P-Acme-CFO",  "customer": "Acme Industries", "name": "Sarah Chen",  "role_title": "CFO",                  "definition": "Owns Acme financial strategy.", "key_responsibilities": "Budget, forecast, capital allocation.", "parent_persona_id": null,           "metric_holdings": [], "business_questions": [], "notes": "" },
  { "id": "P-Acme-Ops",  "customer": "Acme Industries", "name": "Tom Lee",     "role_title": "Head of Operations",   "definition": "Runs operations division.",     "key_responsibilities": "Service delivery, ops cost.",          "parent_persona_id": "P-Acme-CFO", "metric_holdings": [], "business_questions": [], "notes": "" },
  { "id": "P-Acme-RGM",  "customer": "Acme Industries", "name": "Diane Yuen",  "role_title": "Regional GM — North",  "definition": "GM for North region.",          "key_responsibilities": "Regional P&L.",                          "parent_persona_id": "P-Acme-CFO", "metric_holdings": [], "business_questions": [], "notes": "" }
],
"objectives": [
  { "id": "O-Acme-OPEX", "customer": "Acme Industries", "name": "Reduce operating costs by 15%", "description": "Drive opex efficiencies.", "status": "active",   "time_horizon": { "start_date": "2025-06-01", "target_date": "2026-05-31" }, "notes": "" },
  { "id": "O-Acme-REV",  "customer": "Acme Industries", "name": "Grow regional revenue 12%",     "description": "Hit £400M total revenue.", "status": "active",   "time_horizon": { "start_date": "2025-06-01", "target_date": "2026-05-31" }, "notes": "" },
  { "id": "O-Acme-SOX",  "customer": "Acme Industries", "name": "Achieve SOX compliance readiness", "description": "Meet SOX 404 controls.", "status": "active", "time_horizon": { "start_date": "2025-04-01", "target_date": "2025-09-30" }, "notes": "" }
],
"metrics": [
  { "id": "M-Acme-OPEX", "customer": "Acme Industries", "name": "Total opex", "definition": "Sum of operating expenditures.", "pseudo_logic": "SUM(opex_lines.amount)", "unit": "£", "direction": "lower_is_better", "group_id": "performance", "source": "Snowflake · prod.fct_opex", "status": "live", "dimensions": ["region"], "objective_ids": ["O-Acme-OPEX"], "raci": { "accountable": ["P-Acme-CFO"], "responsible": [], "consulted": ["P-Acme-Ops"], "informed": [] }, "actuals": [], "notes": "" },
  { "id": "M-Acme-REV",  "customer": "Acme Industries", "name": "Revenue",    "definition": "Total recognised revenue.",      "pseudo_logic": "SUM(orders.recognised_amount)", "unit": "£", "direction": "higher_is_better", "group_id": "performance", "source": "Snowflake · prod.fct_revenue", "status": "live", "dimensions": ["region"], "objective_ids": ["O-Acme-REV"], "raci": { "accountable": ["P-Acme-CFO"], "responsible": [], "consulted": [], "informed": [] }, "actuals": [], "notes": "" }
]
```

Then update `P-Acme-CFO.metric_holdings` and `P-Acme-RGM.metric_holdings`:

```json
"metric_holdings": [
  { "id": "H-Acme-001", "metric_id": "M-Acme-REV",  "filter": {},                   "targets": [{ "period": "2026", "value": 400000000, "period_type": "annual" }], "notes": "" },
  { "id": "H-Acme-002", "metric_id": "M-Acme-OPEX", "filter": {},                   "targets": [{ "period": "2026", "value": 250000000, "period_type": "annual" }], "notes": "" }
]
```

For Diane (RGM):

```json
"metric_holdings": [
  { "id": "H-Acme-003", "metric_id": "M-Acme-REV",  "filter": { "region": "North" }, "targets": [{ "period": "2026", "value": 200000000, "period_type": "annual" }], "notes": "" },
  { "id": "H-Acme-004", "metric_id": "M-Acme-OPEX", "filter": { "region": "North" }, "targets": [{ "period": "2026", "value": 125000000, "period_type": "annual" }], "notes": "" }
]
```

Add at least one existing project to link to `M-Acme-REV` (find an Acme project in the file and append `"metric_ids": ["M-Acme-REV"], "persona_ids": []`).

`metric_groups: []` is fine (migration will populate defaults).

Repeat the equivalent shape for Globex and Initech demo customers — smaller seed (one persona, one objective, one metric each) is fine.

- [ ] **Step 2: Verify the app loads cleanly**

Run: `npm run test:unit`
Expected: PASS — migration doesn't choke on the seeded data.

- [ ] **Step 3: Verify a manual smoke**

Run: `npm run serve` and open the app in a browser. Click "Load JSON" / "Restore", switch to Acme, open the Strategy view. You should see Sarah Chen with Revenue + Total opex chips, Diane with the cascaded slices, and the project showing the metric in its detail panel Strategy section.

- [ ] **Step 4: Commit**

```bash
git add portfolio-data.json portfolio-data-demo.json
git commit -m "data: seed personas/objectives/metrics with cascade example"
```

---

## Self-review checklist

After all 25 tasks are merged, run:

```bash
npm test
```

Expected: All unit + render + e2e tests pass.

Confirm the spec is covered:
- [x] Migration adds personas/objectives/metrics/metric_groups arrays (Task 1)
- [x] Default metric groups seeded (Task 1)
- [x] Persona hierarchy + cycle check (Task 3)
- [x] Holdings with filter validation (Task 7)
- [x] Single-canonical-link rollups (Task 8)
- [x] Project linkage via metric_ids/persona_ids (Tasks 9, 20, 21)
- [x] Strategy view with three tabs (Tasks 14-19)
- [x] Settings CRUD for all three entity types + groups (Tasks 10-13)
- [x] RACI badge popover (Task 16)
- [x] Filter projects by persona/objective/metric (Task 22)
- [x] Demo data with cascade example (Task 25)
- [x] E2E coverage of the round-trip (Tasks 23, 24)

If any spec section is unaccounted for, add a follow-up task before merging.
