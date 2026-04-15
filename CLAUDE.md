# Portfolio Command Centre

## What This Is
A zero-infrastructure, single-file HTML+JS portfolio management app for managing projects across three customers (GCC, KS, DR&I). Runs client-side in the browser. Reads/writes JSON data with localStorage auto-save. Every view is **customer-scoped** — a customer must always be selected; there is no "All" option.

## Files
- `index.html` — The complete single-file app (~7200 lines). All CSS, HTML, and JS in one file.
- `portfolio-data.json` — Sample data (39 projects, 7 team members, 6 sprints, 10 governance forums)

## Architecture
- **Single HTML file** — no build step, no dependencies, no framework. Opens directly in any browser.
- **Six views**: Dashboard, Sprint Planning, Roadmap/Gantt, Capacity & Workload, Governance Forums, Configuration
- **Data model**: Projects → Delivery Config → Phases/Skills → Sprints. Team Members with flexible capacity. Governance Forums with project mapping.
- **JS modules**: `App` (core), `Dashboard`, `DetailPanel`, `Gantt`, `Sprint`, `Capacity`, `Governance`, `Solver`, `AuditPanel`, `TrendsModal` — all as plain JS objects in a single `<script>` block.
- **No emojis** — all icons are inline SVGs throughout.
- **Customer-scoped** — `App.activeCustomer` is the single source of truth. Defaults to GCC. Syncs across all views.
- **Skill colors** — defined in `Sprint.SKILL_COLORS`. Avoid green/amber/red (RAG confusion). Current: Indigo (Req), Cyan (Tab), Blue (DE), Violet (DS), Pink (UAT), Slate (HC).

## Data Model Key Facts
- **Customer** is always single-select and mandatory: GCC, KS, DR&I
- **Delivery Config** per project: `delivery_config` with toggles (include_req, include_de, include_ds, include_tableau, include_uat, include_hypercare) and `phase_order` array
- **Delivery Phases** (7 possible): Requirements, Data Sourcing, Data Engineering, Data Science, Tableau, UAT, Hypercare. Each has status + optional story points.
- **Skills** (6 with points): Requirements (size_requirements), Tableau (size_tableau), Data Engineering (size_engineering), Data Science (size_data_science), UAT (size_uat_adoption), Hypercare (size_hypercare)
- **Delivery Pipeline**: Driven by each project's `delivery_config.phase_order`. The Solver reads this per-project.
- **skill_splits**: Allocation across sprints with status (pending/in_progress/complete) and completed points.
- **Sprints**: 4-week dev + 1-week hardening = 5-week cycle. End date auto-computed from start_date.
- **Team Members**: `available_points_per_sprint` is available for ANY skill (primary + secondary). Per-sprint overrides via `sprint_overrides`.
- **FY boundary**: 1 June each year
- **Status options**: Not Started, In Progress, On Hold, At Risk, Blocked, Complete, Closed
- **RAG**: rag_schedule, rag_resourcing, rag_scope — labelled Schedule Health, Resource Health, Scope Health

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
Open index.html in a browser. Click "Load JSON" and select portfolio-data.json (or click "Restore" if a localStorage session exists). Navigate between the 6 views. All data persists in localStorage. Always select a customer first.
