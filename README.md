# Portfolio Command Centre

A single-file, zero-dependency portfolio management app for small data/analytics teams running multiple customer accounts. Runs entirely in the browser. No server, no build step, no signup.

## What it does

- **Project portfolio** with customer-scoped views, schema-driven table (filter, sort, pin, watch, drag-reorder priority), and a deep detail panel covering health, setup, and delivery.
- **Sprint planning** — auto-allocates story points to fixed-length sprints subject to capacity, deadlines, MoSCoW bands, WSJF, and concurrent-work guards. R1–R12 rules documented in [`SOLVER.md`](./SOLVER.md).
- **Capacity & workload** — per-member supply vs. demand across the active horizon, with sprint-level overrides for holidays and reduced availability.
- **Roadmap / Gantt** — read-only timeline rendered from the same data, with phase bars, deadlines, and baseline overlays.
- **Governance forums** — agenda builder, minutes recorder, RACI roster.
- **Walkthrough** — a guided weekly review of every open work-item with one-keystroke RAG flips and decision capture.
- **Reports** — printable customer pack, sprint brief, business case, EVM strip, audit-log export.

## Quick start

1. Clone or download this repo.
2. Open `index.html` in any modern browser (Chrome, Edge, Safari, Firefox).
3. Click **Load JSON** in the header and pick `portfolio-data.json`.
4. Pick a customer from the header and explore.

That's it — no installation, no Node, no API keys.

### Try the demo data without picking a file

After step 2, you can also navigate to **Settings → Data → Load demo dataset**, which fetches `portfolio-data-demo.json` directly. Same content as `portfolio-data.json`.

### Bring your own data

Drop a file named `something.local.json` next to `index.html` and point Load JSON at it. Files matching `*.local.json` are gitignored, so your real data stays out of the repo.

## Tech notes

- **Stack:** plain HTML, CSS, and JavaScript in a single ~30k-line `index.html`. No framework, no transpiler, no bundler. Renders with `innerHTML` string concatenation; user content is escaped via `Dashboard.esc()`.
- **Persistence:** browser localStorage with auto-save. Manual JSON export produces a timestamped file you can version-control yourself.
- **Modules:** plain JS objects (`App`, `Dashboard`, `DetailPanel`, `Sprint`, `Capacity`, `Governance`, `Solver`, `Gantt`, `AuditPanel`, …). Customer / table / settings registries are the single source of truth and drive both rendering and editing.
- **Customer-scoped:** every view filters by the active customer. There is no "All" option — it would hide capacity contention.

## Tests

```bash
npm install
npx playwright install chromium-headless-shell    # one-off
npm test                                          # unit + e2e
```

- **Unit + render** (vitest + jsdom): solver invariants, scoring, schema migration, capacity, render-snapshot HTML.
- **E2E** (Playwright + chromium-headless-shell): navigation, dashboard interactions, sprint planning flows, governance walkthrough.

CI runs both on every push (see `.github/workflows/test.yml`).

See [`tests/README.md`](./tests/README.md) for harness details and fixture patterns.

## Repository layout

```
.
├── index.html                  Single-file app
├── portfolio-data.json         Sample (fictional) data
├── portfolio-data-demo.json    Same — fetched by "Load demo dataset" button
├── CLAUDE.md                   Conventions for AI assistants
├── SOLVER.md                   Solver R1–R12 reference
├── tests/                      Unit, render, E2E
└── docs/superpowers/           Specs + plans for in-flight work
```

## Contributing

- All work happens on feature branches; merge to `main` via PR. CI must pass.
- Keep `index.html` rendering convention (string concat, escape via `Dashboard.esc`). Don't introduce a build step.
- Don't commit emojis (icons are inline SVGs).
- Story points are integers — use `App.toInteger` / `App.fmtPoints`.
- All project field writes go through `App.updateProject(id, field, value)` so the audit log + undo + dirty flag + autosave stay consistent.

The `docs/superpowers/specs/` and `docs/superpowers/plans/` directories hold accepted designs and the per-feature implementation plans they were shipped from.

## License

MIT — see [LICENSE](./LICENSE).
