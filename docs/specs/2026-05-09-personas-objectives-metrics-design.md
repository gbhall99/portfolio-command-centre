# Personas, Objectives & Metrics — Design

**Date:** 2026-05-09
**Status:** Approved (data model + derivation rules); UI section pending dedicated brainstorm before implementation plan.
**Scope:** Foundational data layer for strategic traceability across the portfolio. First of three workstreams (this → Sprint Board → Cost/Billing).

## Context

The Portfolio Command Centre serves a metrics-team consultancy that delivers metrics and KPIs to customer stakeholders so those stakeholders can track their objectives. Today the app models projects, sprints, capacity, and governance — but has no first-class representation of *who* the work is for or *why* it matters strategically.

This spec adds three customer-scoped entity types — **Personas**, **Objectives**, and **Metrics** — wired into Projects via a single canonical link path. The intent is strategic traceability ("which projects move which objectives, via which metrics, owned by which personas?"), with forward extensibility for future KPI insights and AI/BI work.

## Goals

1. Enable a portfolio lead to answer, in two clicks: *"Which projects support Persona X / Objective Y / Metric Z, and what's their delivery health?"*
2. Make the metric library a first-class artifact — your team's deliverable, fully described (definition, pseudo-logic, RACI, targets).
3. Surface gaps automatically — objectives without metrics ("not measurable yet"), metrics without objectives ("operational only"), personas without ownership ("inactive").
4. Respect the existing single-file, customer-scoped, no-build-step architecture.
5. Lay schema groundwork (without UI) for future actuals tracking, business-question capture, and AI-generated insights.

## Non-goals

- Actuals capture, charting, automated metric calculation, data-source integration.
- AI-generated insights or business-question answering (separate future workstream).
- Cross-customer sharing of personas, objectives, or metrics. Each customer's strategy is fully isolated.
- Solver/WSJF scoring impact. This release is pure traceability — no prioritisation changes.
- Sprint Board (next workstream) and Cost/Billing (subsequent workstream).

## Mental model

The metric is the central artifact. Everything else is metadata around it.

```
Customer ── Objective ◄───── (many-to-many) ─────► Metric ────► Persona (owner = Accountable)
                                                     │             │
                                                     │             └── parent_persona_id (org tree)
                                                     ├── parent_metric_id (KPI cascade tree)
                                                     ├── raci.{responsible, consulted, informed}
                                                     └── targets[] (time-series)

Project ──► Metric (primary link — the deliverable)
        ──► Persona (secondary, optional — for non-metric work like enablement/training)
```

**Single-canonical-link rule.** Each relationship has exactly one storage location. Reverse views and rollups are computed, never stored. This eliminates sync bugs and keeps the data honest.

| Relationship | Storage | Derivation |
|---|---|---|
| Persona → contributing Objectives | not stored | derived: union of `objective_ids` of metrics owned by persona |
| Objective → contributing Personas | not stored | derived: union of owner personas of metrics linked to objective |
| Project → covered Personas | hybrid: `project.persona_ids` stored for non-metric work | union of: owners of metrics in `project.metric_ids`, plus explicit `project.persona_ids` |
| Project → covered Objectives | not stored | derived: union of `objective_ids` of `project.metric_ids` |
| Metric → covering Projects | not stored | derived: reverse lookup on `project.metric_ids` |

## Data model

### Customer additions

```js
customer = {
  // ...existing fields
  objectives: [],   // Objective[]
  personas:   [],   // Persona[] (hierarchical via parent_persona_id)
  metrics:    [],   // Metric[]  (KPI library, hierarchical via parent_metric_id)
}
```

### Objective (customer-level)

```js
{
  id,                       // string, unique within customer
  name,                     // short label
  description,              // markdown-allowed text
  status,                   // 'active' | 'achieved' | 'paused' | 'abandoned'
  time_horizon: {           // optional
    start_date,             // ISO date
    target_date,            // ISO date
  },
  notes,                    // free text
}
```

No persona link stored here — derived via metrics.

### Persona (hierarchical)

```js
{
  id,
  name,
  role_title,
  definition,               // who this persona is, in 1–3 sentences
  key_responsibilities,     // markdown text
  parent_persona_id,        // null = top of org; otherwise references another persona in same customer
  business_questions: [],   // forward-looking; empty in v1, no UI surfacing yet
  notes,
}
```

Hierarchy: `parent_persona_id` forms an org tree. Cycles forbidden (validated on save). No depth limit enforced.

### Metric (the library entry — central artifact)

```js
{
  id,
  name,
  definition,               // what this metric represents
  pseudo_logic,             // how it's calculated, in plain English / pseudo-code
  unit,                     // e.g. '£', '%', 'count', 'days'
  direction,                // 'higher_is_better' | 'lower_is_better' | 'target_band'
  category,                 // free-text grouping label
  source,                   // free-text: where the data comes from (system / report / manual)

  owner_persona_id,         // single Accountable persona; required
  parent_metric_id,         // optional; enables KPI cascade tree
  objective_ids: [],        // many-to-many; metric measures progress toward these objectives

  raci: {                   // owner is implicit Accountable; below is additive
    responsible: [],        // [personaId, ...]
    consulted:   [],
    informed:    [],
  },

  targets: [                // time-series; sparse is fine
    // period_type ∈ 'annual' | 'quarter' | 'month' | 'custom'
    // period format follows period_type:
    //   annual  → 'YYYY'        e.g. '2026'
    //   quarter → 'YYYY-Q[1-4]' e.g. '2026-Q1'
    //   month   → 'YYYY-MM'     e.g. '2026-03'
    //   custom  → free text     e.g. 'H2 2026'
    { period: '2026',    value: 400, period_type: 'annual'  },
    { period: '2026-Q1', value: 100, period_type: 'quarter' },
  ],

  actuals: [],              // forward-looking; empty in v1, no UI surfacing yet
  notes,
}
```

Validation:
- `owner_persona_id` required and must reference a persona in the same customer.
- `parent_metric_id`, if set, must reference a metric in the same customer; cycles forbidden.
- RACI persona references must exist in the same customer.
- Targets validated for `period_type` consistency; soft warning if quarterly targets sum exceeds annual.
- Soft warning if metric's owner persona is not a descendant of `parent_metric_id`'s owner in the persona tree (i.e., KPI cascade misaligned with org hierarchy). Flagged, not blocked — your team gets to model real-world messiness.
- Soft warning if `objective_ids` is empty — flagged as "operational metric, not strategic".

### Project additions

```js
project = {
  // ...existing fields
  metric_ids:  [],          // primary link: metrics this project delivers/improves
  persona_ids: [],          // secondary, optional: personas served by non-metric work
}
```

Both arrays default empty. No solver impact. No backfilling required.

## Derived rollups (pure functions)

All rollups are pure functions on `customer + entityId` — no caching needed at expected data sizes (hundreds of metrics × dozens of projects per customer).

```js
Personas.rollup(customer, personaId) → {
  descendants:              [personaId, ...],   // transitive children in org tree
  owned_metrics:            [Metric, ...],
  raci_metrics:             { responsible: [Metric, ...], consulted: [...], informed: [...] },
  contributing_objectives:  [Objective, ...],   // via owned_metrics.objective_ids
  supporting_projects:      [Project, ...],     // via owned_metrics + explicit persona_ids
  rag_counts:               { red, amber, green },
}

Objectives.rollup(customer, objectiveId) → {
  contributing_personas:    [Persona, ...],     // via metrics linked
  measuring_metrics:        [Metric, ...],
  delivering_projects:      [Project, ...],     // via measuring_metrics
  rag_counts:               { red, amber, green },
  measurable:               boolean,            // false if no metrics
}

Metrics.rollup(customer, metricId) → {
  ancestors:                [Metric, ...],      // walk parent_metric_id up
  descendants:              [Metric, ...],      // walk parent_metric_id down
  owner_persona:            Persona,
  raci_personas:            { responsible: [Persona, ...], consulted: [...], informed: [...] },
  served_objectives:        [Objective, ...],
  delivering_projects:      [Project, ...],
  current_target:           { period, value, period_type } | null,  // closest in-progress period
  cascade_aligned:          boolean,            // false if owner not descendant of parent owner
}
```

## Module organisation

New plain-JS objects in `index.html`'s single `<script>` block, alongside `Dashboard`, `Sprint`, `Capacity`, etc.:

- **`Personas`** — CRUD against `App.activeCustomer.personas`; hierarchy traversal helpers (`descendants`, `ancestors`, `cycleCheck`); picker widget; rollup function.
- **`Objectives`** — CRUD; picker widget; rollup function.
- **`Metrics`** — CRUD; RACI editor; targets editor; tree traversal; picker widget; rollup function. Largest of the three.
- **`Strategy`** — top-level view orchestration: tab switching (Personas / Objectives / Metrics), card and tree rendering, detail-panel routing.

Existing modules touched:
- **`App`** — `updateProject` accepts new fields; migration logic appends empty arrays; new `App.uiStateGet/Set` keys for Strategy view state.
- **`Dashboard`** — `COLUMNS` extended with optional persona / metric chip columns (off by default); new `'multi-select'` edit type added to inline editor dispatch.
- **`DetailPanel`** — new "Strategy" section showing linked personas, metrics, derived objectives.

## UI surfaces (high-level — dedicated brainstorm pending)

This section intentionally stays at the level of *what surfaces exist*, not *how they look or behave in detail*. A separate brainstorm session will design the UI before the implementation plan is written.

**Settings — three new tabs:**
- Personas (CRUD with parent-persona picker)
- Objectives (customer-level CRUD)
- Metrics (the substantial editor: definition, pseudo-logic, owner picker, parent picker, RACI grid, targets table, objective links)

**New top-level view: Strategy** (slot between Dashboard and Projects), three tabs:
- Personas — org-tree view with rollups per node
- Objectives — card grid with rollups per objective
- Metrics — KPI tree (via `parent_metric_id`) with rollups per node

**Project edit form:** two new multi-select pickers (Metrics primary, Personas secondary).

**Projects table:** two new optional columns (off by default), via existing `Dashboard.COLUMNS` schema.

**Project detail panel:** new "Strategy" section listing linked metrics, derived objectives, linked personas.

**Filters:** existing project filter dropdown gains persona / objective / metric filters.

> **UI brainstorm to follow.** Layout choices, interaction patterns, RACI grid ergonomics, tree-vs-grid toggles, empty states, picker UX, filter integration — all to be designed in a dedicated brainstorm before plans are written.

## Forward extensibility (designed in, not built)

Schema and module shape are chosen so these later additions don't require migration:

- `metric.actuals[]` — empty array placeholder; future home for time-series actual values.
- `persona.business_questions[]` — empty array placeholder; future capture of the questions a persona is trying to answer.
- Detail panel reserves an "Insights" placeholder slot per persona / metric — future home for AI/BI generated insights.
- `metric.source` is free text in v1; can later become a structured object pointing at a connector without renaming.

## Testing approach

Three-tier suite, matching existing convention.

**Unit + render (vitest + jsdom):**
- Migration: existing fixtures gain empty arrays without breakage.
- Hierarchy traversal: `Personas.descendants/ancestors`, cycle detection.
- KPI tree traversal: `Metrics.ancestors/descendants`, cycle detection.
- Cascade alignment soft-warning logic.
- Rollup pure functions: assert correct counts/aggregations against fixture customer.
- RACI editor invariants: owner not duplicated in R/C/I (soft warning); R/C/I persona references resolve.
- Targets validation soft warnings (quarterly sum vs annual).
- HTML render snapshots: Strategy tabs, Settings tabs, project Strategy section, persona org-tree, metric KPI tree.

**E2E (Playwright + chromium-headless-shell):**
- Create objective → create persona hierarchy (parent + child) → create metric (owner + parent + RACI + targets + objective link) → create project linking metric → verify Strategy view rollups (persona shows project; objective shows metric and project; metric tree shows hierarchy).
- Edit project to add a persona-only link → verify Strategy view persona rollup picks up the project.
- Filter Projects table by metric → verify result set.

## Migration

One-pass, additive only. On load, for each customer ensure `personas`, `objectives`, `metrics` arrays exist (default `[]`). For each project ensure `metric_ids`, `persona_ids` arrays exist (default `[]`). No breaking changes to existing fields. Add migration test asserting old fixtures load cleanly.

## Demo data

Seed each existing demo customer (Acme, Globex, Initech) with:
- ~3 personas forming a small hierarchy (one head + 1–2 reports)
- ~3 objectives with mixed time horizons
- ~5 metrics — mix of parent + child cascading; varied RACI; varied target shapes
- 2–3 existing demo projects updated to link to a couple of metrics each

`portfolio-data.json` and `portfolio-data-demo.json` updated together.

## Build sequence (high-level — full plan pending)

The implementation plan (written after UI brainstorm) will sequence roughly:
1. Data model + migration + integrity tests
2. CRUD for Personas, then Objectives, then Metrics (Settings tabs)
3. Project linkage (form pickers, schema-driven columns, detail panel section)
4. Rollup pure functions + unit tests
5. Strategy top-level view (depends on UI brainstorm output)
6. Filters integration on Projects table
7. Demo data seeding
8. E2E tests

## Open items for UI brainstorm

Captured here so the next session has the full list:
- Strategy view layout: are the three tabs equal-weight, or is one the default landing?
- Persona org-tree: collapsible tree vs. nested cards vs. force-directed graph?
- Metric KPI tree: same shape decision; how to surface RACI compactly per node.
- RACI editor in Settings → Metrics: matrix grid vs. four labelled persona pickers vs. drag-and-drop chips?
- Targets editor: table vs. timeline vs. period-grouped accordion?
- Empty states: how to surface "objective has no metrics" / "metric has no objective" warnings without nagging.
- Picker UX: searchable multi-select with category grouping; how to handle hundreds of metrics in a project picker.
- Filter integration: do persona/objective/metric filters live in the existing Projects toolbar or get their own surface?
- Mobile/narrow viewports: are the trees and grids viable at narrow widths or do they fall back to lists?
