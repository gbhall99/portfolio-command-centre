# Personas, Objectives & Metrics — Design

**Date:** 2026-05-09 · **Last revised:** 2026-05-09 (post-UI brainstorm)
**Status:** Approved (data model + UI direction).
**Scope:** Foundational data layer for strategic traceability across the portfolio. First of three workstreams (this → Sprint Board → Cost/Billing).

## Context

The Portfolio Command Centre serves a metrics-team consultancy that delivers metrics to customer stakeholders so those stakeholders can track their objectives. Today the app models projects, sprints, capacity, and governance — but has no first-class representation of *who* the work is for or *why* it matters strategically.

This spec adds three customer-scoped entity types — **Personas**, **Objectives**, and **Metrics** — wired into Projects via a single canonical link path. The intent is strategic traceability ("which projects move which objectives, via which metrics, owned by which personas?"), with forward extensibility for future insights and AI/BI work.

## Goals

1. Enable a portfolio lead to answer, in two clicks: *"Which projects support Persona X / Objective Y / Metric Z?"*
2. Make the metric library a first-class artifact — your team's deliverable, fully described (definition, pseudo-logic, dimensions, RACI, group). Per-persona holdings carry filters and targets.
3. Surface inventory facts cleanly — counts of holders, KPI-style targets, group breakdowns. No alarmist triage.
4. Respect the existing single-file, customer-scoped, no-build-step architecture.
5. Lay schema groundwork (without UI) for future actuals tracking, business-question capture, and AI-generated insights.

## Non-goals

- Tracking actual metric values, performance against target, charting trends. This app manages the *existence and definition* of metrics, not their values.
- Progress visualisation on objectives (no countdowns, no "approaching deadline" treatments).
- AI-generated insights or business-question answering (separate future workstream).
- Cross-customer sharing of personas, objectives, or metrics. Each customer's strategy is fully isolated.
- Solver/WSJF scoring impact. This release is pure traceability — no prioritisation changes.
- Sprint Board (next workstream) and Cost/Billing (subsequent workstream).

## Terminology

- **Metric** — a definition in the customer's library. Has no owner by itself; ownership emerges from persona holdings. (No separate "KPI" concept — a metric with targets attached is still just a metric.)
- **Holding** — a per-persona instance of a metric, with an optional dimension filter and optional targets. Diane Yuen "holds" Revenue with `filter: {region: 'North'}` and a target of £200M for FY26.
- **Cascade** — multiple holdings of the same metric across different personas, distinguished by their dimension filter. Sarah holds Revenue (unfiltered, £400M); Diane holds Revenue · region: North (£200M); Marco holds Revenue · region: South (£200M). All three reference the same `metric_id`; the cascade is implicit in the data.
- **Group** — categorical bucket for metrics, configurable per customer. Defaults: Customer, Operations, Performance.

## Mental model

The metric is the central artifact. Definitions live in the customer library; ownership and targets live on per-persona holdings.

```
Customer ── Objective ◄───── (many-to-many) ─────► Metric ──► Group (configurable)
                                                     │           │
                                                     │           └── dimensions[] (filterable axes)
                                                     │           └── definition-level RACI
                                                     │
                                                     └─── held by ───► Persona  ── parent_persona_id (org tree)
                                                                         │
                                                                         └── metric_holdings[]
                                                                              { metric_id, filter, targets, notes }

Project ──► Metric (primary link — the deliverable)
        ──► Persona (secondary, optional — for non-metric work like enablement/training)
```

**Single-canonical-link rule.** Each relationship has exactly one storage location. Reverse views and rollups are computed, never stored. This eliminates sync bugs.

| Relationship | Storage | Derivation |
|---|---|---|
| Persona → held metrics | `persona.metric_holdings[]` | direct |
| Metric → holders (which personas) | not stored | scan all personas; collect any with a holding referencing this `metric_id` |
| Persona → contributing Objectives | not stored | union of `objective_ids` across the metrics held by this persona |
| Objective → contributing Personas | not stored | union of holders across metrics where `metric.objective_ids` includes this objective |
| Project → covered Personas | hybrid: `project.persona_ids` for non-metric work | union of: holders of metrics in `project.metric_ids`, plus explicit `project.persona_ids` |
| Project → covered Objectives | not stored | union of `objective_ids` of `project.metric_ids` |
| Metric → covering Projects | not stored | reverse lookup on `project.metric_ids` |

## Data model

### Customer additions

```js
customer = {
  // ...existing fields
  objectives:    [],   // Objective[]
  personas:      [],   // Persona[] (hierarchical via parent_persona_id; each carries metric_holdings[])
  metrics:       [],   // Metric[]  (the library — definitions only)
  metric_groups: [     // editable; defaults shown
    { id: 'customer',    name: 'Customer',    swatch: '#66d9e8' },
    { id: 'operations',  name: 'Operations',  swatch: '#8fb4ff' },
    { id: 'performance', name: 'Performance', swatch: '#c89dde' },
  ],
}
```

### Objective (customer-level)

```js
{
  id,                        // string, unique within customer
  name,                      // short label
  description,               // markdown-allowed text
  status,                    // 'active' | 'achieved' | 'paused' | 'abandoned'
  time_horizon: {            // optional; informational only — no progress derivation
    start_date,              // ISO date
    target_date,             // ISO date
  },
  notes,
}
```

No persona link stored here; coverage is derived via metrics.

### Persona (hierarchical, holds metrics)

```js
{
  id,
  name,
  role_title,
  definition,                // who this persona is, in 1–3 sentences
  key_responsibilities,      // markdown text
  parent_persona_id,         // null = top of org; otherwise references another persona in same customer

  metric_holdings: [         // this persona's instances of library metrics
    {
      id,                    // unique within the persona
      metric_id,             // references customer.metrics[].id
      filter: {              // dimension key→value; empty/absent = unfiltered ("all <dimension>")
        // example: { region: 'North' }
        // keys must appear in metric.dimensions[]
      },
      targets: [             // time-series; sparse OK; can be empty
        // period_type ∈ 'annual' | 'quarter' | 'month' | 'custom'
        // period format follows period_type:
        //   annual  → 'YYYY'        e.g. '2026'
        //   quarter → 'YYYY-Q[1-4]' e.g. '2026-Q1'
        //   month   → 'YYYY-MM'     e.g. '2026-03'
        //   custom  → free text     e.g. 'H2 2026'
        { period: '2026',    value: 400, period_type: 'annual'  },
        { period: '2026-Q1', value: 100, period_type: 'quarter' },
      ],
      notes,
    },
  ],

  business_questions: [],    // forward-looking; empty in v1, no UI surfacing yet
  notes,
}
```

Hierarchy: `parent_persona_id` forms an org tree. Cycles forbidden (validated on save). No depth limit enforced.

### Metric (library entry — definitions only)

```js
{
  id,
  name,
  definition,                // what this metric represents
  pseudo_logic,              // how it's calculated, plain English / pseudo-code
  unit,                      // e.g. '£', '%', 'count', 'days'
  direction,                 // 'higher_is_better' | 'lower_is_better' | 'target_band'
  group_id,                  // references customer.metric_groups[].id
  source,                    // free-text: where the data comes from
  status,                    // 'live' | 'draft'

  dimensions: [],            // array of dimension key strings, e.g. ['region', 'product']
                             // any holding's filter keys must be a subset of this

  objective_ids: [],         // many-to-many; metric measures progress toward these objectives

  raci: {                    // definition-level RACI — who's involved with the metric itself
    accountable: [],         // array (typically length 1, but multiple allowed); not the same as a "holder"
    responsible: [],
    consulted:   [],
    informed:    [],
  },

  actuals: [],               // forward-looking; empty in v1, no UI surfacing yet
  notes,
}
```

Validation:
- `group_id` required; must reference a metric group in the same customer.
- `dimensions[]` keys are free strings; soft warning if a holding references a key not in this list.
- `objective_ids` may reference objectives in the same customer; empty allowed.
- All RACI persona references must exist in the same customer.
- Holding-level: `filter` keys must be a subset of the metric's `dimensions[]`. `metric_id` must exist.
- No cycle/parent constraints — there is no parent-child relationship between metrics any more.

### Project additions

```js
project = {
  // ...existing fields
  metric_ids:  [],           // primary link: metrics this project delivers/improves
  persona_ids: [],           // secondary, optional: personas served by non-metric work
}
```

Both arrays default empty. No solver impact. No backfilling required.

## Derived rollups (pure functions)

All rollups are pure functions on `customer + entityId` — no caching needed at expected data sizes.

```js
Personas.rollup(customer, personaId) → {
  descendants:              [personaId, ...],     // transitive children in org tree
  holdings:                 [Holding, ...],       // direct: persona.metric_holdings
  held_metrics:             [Metric, ...],        // resolved metric definitions for the holdings
  contributing_objectives:  [Objective, ...],     // via held_metrics.objective_ids
  supporting_projects:      [Project, ...],       // via held metrics + explicit persona_ids
  raci_appearances:         { accountable: [Metric, ...], responsible: [...], consulted: [...], informed: [...] },
}

Objectives.rollup(customer, objectiveId) → {
  measuring_metrics:        [Metric, ...],        // metric.objective_ids includes this objective
  contributing_personas:    [Persona, ...],       // any persona with a holding of measuring_metrics
  delivering_projects:      [Project, ...],       // via measuring_metrics + explicit project links
  metric_count:             number,               // 0 = no metrics; UI shows the number, not a derived "uncovered" status
}

Metrics.rollup(customer, metricId) → {
  holders:                  [{ persona, holding }, ...],  // every persona+holding combination
  holder_count:             number,
  served_objectives:        [Objective, ...],
  delivering_projects:      [Project, ...],
  raci_personas:            { accountable: [Persona, ...], responsible: [...], consulted: [...], informed: [...] },
  has_targets_anywhere:     boolean,              // true if any holding has at least one target
}

Holdings.summarise(holding, metric, customer) → {
  metric_name:              string,
  filter_label:             string,               // 'all regions' | 'region: North' | ...
  current_target:           { period, value, period_type } | null,
}
```

## Module organisation

New plain-JS objects in `index.html`'s single `<script>` block, alongside `Dashboard`, `Sprint`, `Capacity`, etc.:

- **`Personas`** — CRUD against `App.activeCustomer.personas`; hierarchy traversal helpers (`descendants`, `ancestors`, `cycleCheck`); picker widget; rollup function. Holding helpers (add/edit/remove holdings, validate filter keys).
- **`Objectives`** — CRUD; picker widget; rollup function.
- **`Metrics`** — CRUD on library entries; picker widget; rollup function. Group management (CRUD on `customer.metric_groups[]`). Largest of the three.
- **`Strategy`** — top-level view orchestration: tab switching (Personas / Objectives / Metrics), list & detail rendering, picker integration.

Existing modules touched:
- **`App`** — `updateProject` accepts new fields; migration logic appends empty arrays + default metric groups; new `App.uiStateGet/Set` keys for Strategy view state.
- **`Dashboard`** — `COLUMNS` extended with optional persona / metric chip columns (off by default); new `'multi-select'` edit type added to inline editor dispatch.
- **`DetailPanel`** — new "Strategy" section showing linked metrics, derived objectives, linked personas (with derivation flag).

## UI surfaces

A new top-level view, **Strategy**, sits between Dashboard and Projects. It contains three equal-weight tabs (Personas / Objectives / Metrics). All three are inventory-oriented look-up views — no triage strips, no countdowns, no progress visualisations.

### Personas tab

Hierarchical list of personas. Each row shows the persona's name, role, and their metric holdings as chips. Each chip displays:
- Status dot (Live / Draft, from the metric definition)
- Group swatch (Customer / Operations / Performance colour)
- Metric name
- Dimension filter as a tag (e.g. `region: North`) when filter is set
- Subtle `+N` RACI badge if the metric has additional RACI links beyond the implicit accountable; hover/click → popover with R/A/C/I breakdown

Empty personas show a quiet "No metrics · + add" affordance, not an alarm. Toolbar: search, status filter (All/Live/Draft), tree/flat toggle, RACI involvement filter (by persona — "show me everything Mei is Consulted on"), dimension filter (by dimension value), target period filter, "+ New persona" CTA.

### Objectives tab

Editorial list of objective entries. Each entry: status accent bar (Active blue / Achieved green / Paused amber / Abandoned grey), title, description, window dates as plain text, derived coverage counts (metrics / personas / projects), linked metric chips. Achieved entries are muted; abandoned are faded. **No "Uncovered" derived status** — zero metrics is just the count `0`. Toolbar: search, status filter, covered/uncovered, sort, "+ New objective" CTA.

### Metrics tab

Two-pane workspace.

**Left pane (library list)** — each row: left accent bar in the metric's group colour, metric name, status dot+label, one-line description, group tag, holder count, dimension tags, avatar stack of holders.

**Right pane (selected metric detail)**:
- Header: name, group tag, status, last-updated metadata
- Definition (free text)
- Pseudo-logic (monospace block)
- Two-column strip: Source / Dimensions / Linked objectives — and definition-level RACI
- Cascade table: every holder, with their filter and their targets — single source of truth for "who has what target on what slice"; entry point to add a new holder

Toolbar: search, status filter, group filter (with "edit groups…" link to config), dimension filter, sort.

### Project linkage (existing Projects view)

- **Edit form**: two new pickers — Metrics (primary, searchable, results grouped by metric group) and Personas (secondary, optional, with a "for non-metric work" hint).
- **Detail panel**: new "Strategy" section showing three rows — Metrics (stored), Objectives (derived, with `via Metric X` flag), Personas (derived, with `via Metric X · region: Y` flag). Click any chip → jumps to that entity in the Strategy view.
- **Projects table**: two new optional columns (off by default) — persona chips, metric chips. Uses existing `Dashboard.COLUMNS` schema; new `'multi-select'` edit type added to the inline editor dispatch.
- **Filters**: existing project filter dropdown gains persona / objective / metric filters.

## Forward extensibility (designed in, not built)

Schema and module shape are chosen so these later additions don't require migration:

- `metric.actuals[]` and `holding.targets` are time-series shapes — actuals can later live alongside targets without restructuring.
- `persona.business_questions[]` placeholder for capturing the questions a persona is trying to answer.
- Detail panel reserves an "Insights" placeholder slot per persona / metric — future home for AI/BI generated insights.
- `metric.source` is free text in v1; can later become a structured object pointing at a connector without renaming.
- Per-holding RACI is intentionally NOT in v1 (definition-level RACI only); could be added later as `holding.raci_overrides`.

## Testing approach

Three-tier suite, matching existing convention.

**Unit + render (vitest + jsdom):**
- Migration: existing fixtures gain empty arrays + default metric_groups without breakage.
- Hierarchy traversal: `Personas.descendants/ancestors`, cycle detection.
- Holding validation: filter keys subset of metric.dimensions; metric_id resolves; targets period_type/period format consistency.
- Rollup pure functions: assert correct counts/aggregations against fixture customer; cascade reconstruction (holders + filters per metric).
- RACI persona references resolve; no duplication across R/C/I within a single category.
- HTML render snapshots: Strategy tabs (Personas / Objectives / Metrics), project Strategy section.

**E2E (Playwright + chromium-headless-shell):**
- Create objective → create persona hierarchy (parent + child) → create metric (group + dimensions + RACI + objective link) → assign metric to persona with filter + targets → cascade to second persona with different filter → create project linking the metric → verify Strategy view rollups (persona shows project; objective shows metric and project; metric detail shows cascade with two holders).
- Edit project to add a persona-only link → verify project detail Strategy section shows the persona with no derivation flag.
- Filter Projects table by metric → verify result set.
- Filter Personas tab by RACI involvement → verify result set.

## Migration

One-pass, additive only. On load, for each customer:
- Ensure `personas`, `objectives`, `metrics` arrays exist (default `[]`).
- Ensure `metric_groups` exists; if missing, populate with the three defaults.
- Each existing persona gains `metric_holdings: []` if missing.

For each project: ensure `metric_ids`, `persona_ids` arrays exist (default `[]`).

No breaking changes to existing fields. Migration test asserts old fixtures load cleanly.

## Demo data

Seed each existing demo customer (Acme, Globex, Initech) with:
- ~3 personas forming a small hierarchy (one head + 1–2 reports), at least one Regional GM persona to demonstrate cascade
- ~3 objectives with mixed statuses (active, one achieved, one paused)
- ~5 metrics across the three default groups, with at least one metric having `dimensions: ['region']`
- Holdings: at least one cascade example (same metric held by 2–3 personas with different region filters and different FY26 targets)
- 2–3 existing demo projects updated to link to a couple of metrics each

`portfolio-data.json` and `portfolio-data-demo.json` updated together.

## Build sequence (high-level — full plan pending)

The implementation plan (next step after this spec) will sequence roughly:
1. Data model + migration + integrity tests (including default metric_groups)
2. Library CRUD + group config (Settings → Metrics tab editor; group management)
3. Personas CRUD with hierarchy + holdings editor (assign metric, set filter + targets)
4. Objectives CRUD
5. Project linkage (form pickers, schema-driven columns, detail panel "Strategy" section)
6. Rollup pure functions + unit tests
7. Strategy top-level view (Personas / Objectives / Metrics tabs as designed)
8. Filters integration on Projects table
9. Demo data seeding
10. E2E tests

## Resolved UI decisions (from brainstorm)

- **Strategy view layout** — three equal-weight tabs (no default-landing tab).
- **Personas tab** — hierarchical inventory list with metric chips inline; no triage strip; RACI as `+N` badge with hover popover (and as a filter); cascade shown via dimension-filter tags on chips.
- **Objectives tab** — editorial list with left status accent bar; window dates as plain text; no progress visualisation; no "Uncovered" status (zero metrics is just `0`).
- **Metrics tab** — two-pane workspace (library list + selected metric detail); detail includes definition, pseudo-logic, source, dimensions, objectives, definition-level RACI, and cascade table; group is a categorical field (left accent bar = group colour, status moved to inline dot).
- **Status set** — Live / Draft for metrics; Active / Achieved / Paused / Abandoned for objectives.
- **No KPI/Metric distinction** — every entry is a metric; presence of targets does not change its type.
- **Cascade model** — same `metric_id`, different `filter` per holding (no parent_metric_id chain).
- **Project linkage** — Metrics picker primary, Personas picker secondary (for non-metric work). Detail panel "Strategy" section shows derived persona/objective coverage with derivation flags.
- **Visual fidelity** — final UI will inherit the existing app's design language; the brainstorm wireframes (in `.superpowers/brainstorm/`) capture structure and information hierarchy, not pixel-perfect treatment.
