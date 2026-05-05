# Portfolio Command Centre

## What This Is
A zero-infrastructure, single-file HTML+JS portfolio management app for managing projects across three customers (Acme Industries, Globex, Initech). Runs client-side in the browser. Reads/writes JSON data with localStorage auto-save. Every view is **customer-scoped** — a customer must always be selected; there is no "All" option.

## Files
- `index.html` — The complete single-file app (~18,000 lines). All CSS, HTML, and JS in one file.
- `portfolio-data.json` — Sample data (39 projects, 7 team members, 6 sprints, 10 governance forums)
- `SOLVER.md` — Technical reference for the auto-allocation solver: settings, rules R1–R12, algorithm passes, warnings, scoring, and known limitations. Read this before tweaking `Solver.solve` or `Sprint.allocSettings`.

## Architecture
- **Single HTML file** — no build step, no dependencies, no framework. Opens directly in any browser.
- **Seven views**: Dashboard, Projects, Sprint Planning, Roadmap/Gantt, Capacity & Workload, Governance Forums, Configuration. Dashboard + Projects share the same DOM container with a `view-mode-*` class toggling section visibility.
- **Data model**: Projects → Delivery Config → Phases/Skills → Sprints. Team Members with flexible capacity. Governance Forums with project mapping.
- **JS modules**: `App` (core), `Dashboard`, `DetailPanel`, `Gantt`, `Sprint`, `Capacity`, `Governance`, `Solver`, `AuditPanel`, `TrendsModal` — all as plain JS objects in a single `<script>` block.
- **No emojis** — all icons are inline SVGs throughout.
- **Schema-driven Projects table** — `Dashboard.COLUMNS` is the single source of truth for header (`renderHeader`), row body (`buildRowHtml`), the column picker (`ColumnPicker`), and the inline editor (`openQuickEdit`). Add a column = one entry. Inline edits dispatch on `col.edit.type` (text/number/date/select/textarea/sprint/rag/derived) and write through `App.updateProject`. Visibility/order/width persist globally via `App.uiStateSet('dashboard.columns', …)`. Single-click row opens the detail panel (deferred ~280 ms so a double-click on a `data-quick-edit` cell can take over and open the inline editor instead). `.project-table` uses `table-layout: fixed` so column widths are authoritative.
- **Customer-scoped** — `App.activeCustomer` is the single source of truth. Defaults to Acme Industries. Syncs across all views.
- **Skill colors** — defined in `Sprint.SKILL_COLORS`. Avoid green/amber/red (RAG confusion). Current: Indigo (Req), Cyan (Tab), Blue (DE), Violet (DS), Pink (UAT).

## Data Model Key Facts
- **Customer** is always single-select and mandatory: Acme Industries, Globex, Initech
- **Delivery Config** per project: `delivery_config` with toggles (include_req, include_de, include_ds, include_tableau, include_uat, include_hypercare) and `phase_order` array
- **Delivery Phases** (6 possible): Requirements, Data Sourcing, Data Engineering, Data Science, Tableau, UAT. Each has status + optional story points.
- **Skills** (5 with points): Requirements (size_requirements), Tableau (size_tableau), Data Engineering (size_engineering), Data Science (size_data_science), UAT (size_uat_adoption)
- **Delivery Pipeline**: Driven by each project's `delivery_config.phase_order`. The Solver reads this per-project.
- **skill_splits**: Allocation across sprints with status (pending/in_progress/complete) and completed points. Optional `work_start_date` / `work_end_date` per split narrow the Gantt bar to the actual work window (Issue 4).
- **Sprints**: 4-week dev + 1-week hardening = 5-week cycle. End date auto-computed from start_date.
- **Team Members**: `available_points_per_sprint` is available for ANY skill (primary + secondary). Per-sprint overrides via `sprint_overrides`.
- **FY boundary**: 1 June each year
- **Status options**: Not Started, In Progress, On Hold, At Risk, Blocked, Complete, Closed
- **RAG**: rag_schedule, rag_resourcing, rag_scope — labelled Schedule Health, Resource Health, Scope Health
- **WSJF prioritisation**: Projects may set `business_value`, `time_criticality`, `risk_reduction_opportunity` (each 1–10) and `moscow` ("Must"/"Should"/"Could"/"Won't"). When any WSJF input is populated, `App.calculateWsjf(project)` drives scoring; otherwise the legacy hybrid (status × RAG × risk × size × deadline) is used. Solver sort: hard_deadline → MoSCoW band → WSJF → priority.
- **Story points are integers** everywhere except statistics (velocity avg, days-per-SP). Use `App.toInteger(v)` to parse, `App.fmtPoints(n)` to render. `App.fmtAverage(n, decimals)` for sanctioned decimal statistics.
- **R12 concurrent guard**: a member is never assigned to two overlapping deliveries unless both are in `concurrentOverlapAllowedSkills` (default: Req + UAT). Toggle via `enforceConcurrentSinglePerson`.

## Coding Conventions
- All UI rendering is string concatenation (innerHTML). No virtual DOM, no templates.
- Use `Dashboard.esc()` for HTML escaping user content.
- All icons must be inline SVGs. Never use emojis.
- CSS uses custom properties defined in `:root`.
- `calcSkillCapacityForSprint(customer, sprintId)` — holiday-aware, reads sprint_overrides.
- localStorage auto-save. JSON export with timestamped filename.
- Reports open in new window with auto-print for PDF output.
- Event delegation used for Gantt hover (mouseover on scroll container).

## Testing

### Manual
Open index.html in a browser. Click "Load JSON" and select portfolio-data.json (or click "Restore" if a localStorage session exists). Navigate between the 6 views. All data persists in localStorage. Always select a customer first.

### Automated
`npm test` runs a three-tier suite (see `tests/README.md`):
- **Unit + render** (vitest + jsdom, ~2s) — solver R1–R12 invariants, scoring (incl. WSJF + MoSCoW), integer-points enforcement, migration, integrity, capacity, HTML snapshots.
- **E2E** (Playwright + chromium-headless-shell, ~3s) — navigation, edit-project refresh, add-project flow, priority chip, Gantt hover.
- CI runs both jobs in parallel on push/PR via `.github/workflows/test.yml`.
