# Portfolio Command Centre

## What This Is
A zero-infrastructure, single-file HTML+JS portfolio management app for managing 39 projects across three customers (GCC, KS, DR&I). Runs client-side in the browser. Reads/writes JSON data with localStorage auto-save. Every view is **customer-scoped** — a customer must always be selected; there is no "All" option.

## Files
- `index.html` — The complete single-file app (~4500 lines). All CSS, HTML, and JS in one file.
- `portfolio-data.json` — Sample data (39 projects, 7 team members, 6 sprints, 3 workflow templates, 10 governance forums)

## Architecture
- **Single HTML file** — no build step, no dependencies, no framework. Opens directly in any browser.
- **Five views**: Dashboard, Sprint Planning (swim lane), Roadmap/Gantt, Capacity & Workload, Governance Forums
- **Data model**: Projects → Stages (Delivery Phases) → Skills → Sprints. Team Members with skill-based capacity. Governance Forums with project mapping.
- **JS modules**: `App` (core), `Dashboard`, `DetailPanel`, `Gantt`, `Sprint`, `Capacity`, `Governance` — all as plain JS objects in a single `<script>` block.
- **No emojis** — all icons are inline SVGs throughout.
- **Customer-scoped** — every view requires a customer selection (GCC, KS, DR&I). No "All" option exists. Capacity calculations filter team members by customer (including those marked "Both"). Auto-selects first customer on data load.

## Data Model Key Facts
- **Customer** is always single-select and mandatory: GCC, KS, DR&I. Never allow an "All" option.
- **Delivery Phases** (in order): Requirements → Data Sourcing → Data Modeling → Development → UAT → Hypercare. Each: Not Started / In Progress / Complete / N/A
- **Skills** (map to sizing fields): Requirements (size_requirements), Tableau (size_tableau), Engineering (size_engineering), Data Science (size_data_science), UAT (size_uat_adoption)
- **Delivery Pipeline** (sequential, enforced by auto-allocate): Phase 1: Requirements → Phase 2: Engineering & Data Science (parallel) → Phase 3: Tableau → Phase 4: UAT. Each phase must occupy its own sprint; skills cannot run concurrently within a sprint for the same project. Exception: Eng & DS are both Phase 2 and can run in parallel.
- **skill_splits**: allows a skill's points to be allocated across multiple sprints. Initialised for ALL skills on a project when any skill is first moved.
- **Story Points**: 1 SP = 8hrs focused work. ~3 SPs achievable per person per week.
- **Sprints**: 4-week dev + 1-week hardening = 5-week cycle. Sprint IDs like CY26-S4. 20 business days per sprint.
- **FY boundary**: 1 June each year
- **Status options**: Not Started, In Progress, On Hold, At Risk, Blocked, Complete, Closed
- **RAG**: rag_schedule, rag_resourcing, rag_scope — each Green/Amber/Red
- **Dependencies**: stored as strings in data (e.g. "GCC-001"), not arrays. Use `Array.isArray()` checks when iterating.
- **Team Members**: each has a `customer` field (GCC, KS, or "Both"), `primary_skills`, `available_points_per_sprint`. Capacity is split equally across primary skills.

## Coding Conventions
- All UI rendering is string concatenation (innerHTML). No virtual DOM, no templates.
- Use `Dashboard.esc()` for HTML escaping user content.
- All icons must be inline SVGs. Never use emojis.
- CSS uses custom properties defined in `:root`. Three responsive breakpoints: 1100px, 768px, 480px.
- Customer filter is always a standard `<select>` (single-select, no "All" option, auto-selects first). Manager/Status/Category use the custom multi-select component.
- `calcSkillCapacity(customerFilter)` accepts an optional customer argument to filter team members. Always pass the current customer filter from the view's dropdown.
- localStorage auto-save. JSON export with timestamped filename.
- Gantt milestones are generic grey diamonds (hover for detail) except Product Launch (green rocket SVG).
- Gantt wrapper needs explicit width set in JS: `ganttWrapper.style.width = (totalWidth + 220) + 'px'`.

## What's Been Built (Complete)
- Dashboard: sortable table, drag-priority, filters, search, summary cards, clipboard copy
- Detail panel: full editing, structured risks, data sourcing, scope, teams involved, delivery phases
- Sprint Planning: swim lane view (default/only view) with draggable skill chips, click-to-move, per-skill capacity bars per sprint, split functionality, drag grip handles
- Auto-Allocate engine: 4-phase delivery pipeline (Req → Eng/DS → Tab → UAT), capacity-constrained, priority-ordered, customer-scoped with settings modal
- Roadmap/Gantt: zoom (day/week/month), skill-segmented bars, milestones, baseline toggle, FY markers, sprint lines, dependency arrows (SVG)
- Capacity: sprint grid with per-skill bars, team member management (add/edit/delete), customer-filtered
- Governance: forum calendar, project mapping, expandable cards
- Mobile responsive (3 breakpoints + print)

## Sprint Planning — Swim Lane View
- Projects as rows, sprints as columns. Skill chips (Req, Tab, Eng, DS, UAT) are colour-coded and draggable.
- **Drag-and-drop**: drag a chip from one sprint cell to another within the same project row.
- **Click-to-move**: click a chip to select it (pulses), then click a target sprint cell. Escape to cancel.
- **Split**: click the parallel-lines icon on a chip to split points across sprints.
- **Capacity headers**: each sprint column header shows per-skill capacity bars with load percentages, filtered to the selected customer's team.
- **Move logic**: `moveSkillToSprint()` initialises `skill_splits` for ALL skills on first move, then moves only the targeted skill. Updates `current_sprint` to the sprint with the most total work.

## Auto-Allocate Engine
- **Customer is required** — opens settings modal if not set.
- **4-phase delivery pipeline**: Req (1) → Eng+DS (2, parallel) → Tableau (3) → UAT (4).
- **Strict sequential phasing**: each phase must start in the sprint AFTER the previous phase finishes. No concurrent phases within a sprint.
- **Capacity-constrained**: respects `maxCapacityPct` target per skill per sprint.
- **Priority-ordered**: highest priority projects allocated first.
- **Settings**: max capacity %, priority weight, start sprint, respect delivery pipeline, spread work, lock completed/in-progress.

## What's Not Yet Built
1. Auto-prioritisation scoring (weighted Impact/Complexity/Value/Urgency)
2. Dependency lines on Gantt (data is string-based, needs migration to array format)
3. Gantt drag-to-adjust dates
4. Native PNG export
5. Status report text generation
6. Activity/change log per project
7. What-if mode for sprint planning
8. New project scheduling assistant
9. Feature-level tracking (sub-items)
10. Azure DevOps integration (FastAPI backend)
11. Multi-editor support

## Testing
Open index.html in a browser. Click "Load JSON" and select portfolio-data.json (or click "Restore" if a localStorage session exists). Navigate between the 5 views. All data persists in localStorage. Always select a customer first — views show nothing without one.
