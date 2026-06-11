# Velocity

*Authored by Gareth Hall and Claude.*

A single-file, zero-dependency portfolio management app for small data/analytics teams running multiple customer accounts. Runs entirely in the browser. No server, no build step, no signup — and now **agentic**: connect any LLM (cloud or local) and talk to the whole solution.

*(Formerly "Portfolio Command Centre". The repo path and localStorage keys are unchanged so existing sessions keep their data; user-facing name is "Velocity" everywhere.)*

## What it does

- **Project portfolio** with customer-scoped views, schema-driven table (filter, sort, pin, watch, drag-reorder priority), and a deep detail panel covering health, setup, and delivery.
- **Sprint planning** — auto-allocates story points to fixed-length sprints subject to capacity, deadlines, MoSCoW bands, WSJF, and concurrent-work guards. R1–R12 rules documented in [`SOLVER.md`](./SOLVER.md).
- **Team Kanban board** — customer-scoped columns per status, schema-driven cards (RAG, WSJF, points, deadlines), drag-and-drop transitions, WIP limits, swimlanes.
- **Capacity & workload** — per-member supply vs. demand across the active horizon, with sprint-level overrides for holidays and reduced availability.
- **Roadmap / Gantt** — read-only timeline rendered from the same data, with phase bars, deadlines, and baseline overlays.
- **Governance forums** — agenda builder, minutes recorder, RACI roster.
- **Walkthrough** — a guided weekly review of every open work-item with one-keystroke RAG flips and decision capture.
- **Reports** — printable customer pack, sprint brief, business case, EVM strip, audit-log export.
- **Costs, billing & quoting** — an hourly rate table by **country × level** (with a configurable hours-per-story-point conversion and per-customer default band), team rate-band assignments so work bills at the rate of whoever did it, customer pre-paid/fixed arrangements that completed work draws down before anything bills as T&M, a per-customer Billing & Costs report (arrangement balances, per-project billable/cost/margin), and a governed "Quoted SOW" template whose Commercials section is generated from project sizing, rates and live prepaid balances — never hand-typed.
- **What-if planning** — ask the Assistant "could we fit a new 30-point project?" or "what if we lose Dana?": the solver runs on a throwaway copy and reports the deltas (makespan, utilisation, new/resolved deadline misses) without touching your plan.
- **Assistant** (Ctrl/Cmd+J) — chat with your portfolio: grounded Q&A that cites and links the entities it used, and multi-step workflows ("create a project for Globex with Req+DE+Tableau and put Alpha on hold") that preview a diff and apply only on your confirmation. Every AI write is audited and undoable.
- **AI skills** — governed, template-driven generators:
  - **SOW Generator** — paste a discovery doc or transcript; get a Statement of Work that strictly follows the version-controlled definition in [`definitions/sow/`](./definitions/sow/), with a Draft → Review → Approved workflow, flags for anything the source didn't support, and direct linkage to projects/phases/assumptions.
  - **Tableau Wireframe Builder** — a grid canvas whose component vocabulary and design rules come from [`definitions/tableau/`](./definitions/tableau/); AI can draft a conforming starting layout; a live conformance checker flags structural violations (never content choices).

## Quick start

1. Clone or download this repo.
2. Open `index.html` in any modern browser (Chrome, Edge, Safari, Firefox).
3. Click **Load JSON** in the header and pick `portfolio-data.json`.
4. Pick a customer from the header and explore.

That's it — no installation, no Node, no API keys. Everything except the AI features works fully offline.

### Try the demo data without picking a file

After step 2, you can also navigate to **Settings → Data → Load demo dataset**, which loads the embedded copy of `portfolio-data-demo.json` (works from `file://`).

### Bring your own data

Drop a file named `something.local.json` next to `index.html` and point Load JSON at it. Files matching `*.local.json` are gitignored, so your real data stays out of the repo.

## Connecting an AI model (optional)

Velocity's AI layer is **provider-agnostic** — point it at whatever model you have in **Settings → AI & Assistant**. Keys are stored only in your browser's localStorage; they never enter the portfolio data, exports, or this repo.

| Provider | Adapter | Base URL | Notes |
|---|---|---|---|
| **Ollama** (local) | OpenAI-compatible | `http://localhost:11434/v1` | Start with `OLLAMA_ORIGINS=*` (or this page's origin) so the browser may call it. No key needed. |
| **LM Studio** (local) | OpenAI-compatible | `http://localhost:1234/v1` | Enable CORS in the Local Server tab. |
| **llama.cpp / llamafile / vLLM / text-generation-webui** | OpenAI-compatible | your server's `/v1` | All expose the OpenAI chat-completions shape. |
| **Anthropic (Claude)** | Anthropic | default | Works browser-direct (the adapter sends the required browser-access header). Recommended default when available. |
| **Google Gemini** | Gemini | default | Browser-direct. |
| **OpenAI / Azure / Groq / Together / OpenRouter** | OpenAI-compatible | provider URL | Some providers block browser-origin calls — see the proxy note below. |

- **Multiple profiles + per-task defaults** — e.g. a strong cloud model for SOW drafting, a fast local model for interactive chat.
- **Capability negotiation** — models without native tool calling (common locally) automatically run through a constrained-JSON fallback with strict parsing and a repair loop. Set **Tool mode: JSON fallback** on the profile if auto-detection guesses wrong. Features degrade to the fallback path; they never disappear.
- **No model configured?** Every AI surface shows a "Connect a model" empty state; the rest of the app is fully functional.
- **Optional thin proxy** — if a cloud provider rejects browser-origin calls (CORS), run any minimal forwarding proxy you trust on localhost and set the profile's Base URL to it, adding your key as a header there. The default path stays serverless; the proxy is only for providers that refuse browser calls.

## Tech notes

- **Stack:** plain HTML, CSS, and JavaScript in a single `index.html`. No framework, no transpiler, no bundler. Renders with `innerHTML` string concatenation; user/model content is escaped via `Dashboard.esc()`.
- **Persistence:** browser localStorage with auto-save. Manual JSON export produces a timestamped file you can version-control yourself. AI keys live in a separate localStorage key and are never exported.
- **Modules:** plain JS objects (`App`, `Dashboard`, `DetailPanel`, `Sprint`, `Kanban`, `Capacity`, `Governance`, `Solver`, `Gantt`, `AuditPanel`, `AI`, `AgentTools`, `Agent`, `Assistant`, `Definitions`, `Skills`, `Sow`, `Wireframe`, …). Customer / table / settings / tool / skill registries are the single source of truth and drive both rendering and editing.
- **Customer-scoped:** every view filters by the active customer. There is no "All" option — it would hide capacity contention. The Assistant and all skills inherit this scope.
- **Governed definitions:** generated artifacts (SOWs, wireframes) follow version-controlled definition files under [`definitions/`](./definitions/) — authored files are the source of truth, embedded copies keep `file://` working, and a CI test prevents drift. See [`SKILLS.md`](./SKILLS.md) for how to add skills, templates, and adapters.
- **Security:** AI/document content is treated as untrusted — escaped on render, schema-validated before it touches the data model, never auto-executed; write proposals always require explicit confirmation and are audited (source `AI`) and undoable.

## Tests

```bash
npm install
npx playwright install chromium-headless-shell    # one-off
npm test                                          # unit + e2e
```

- **Unit + render** (vitest + jsdom): solver invariants, scoring, schema migration, capacity, AI adapters + agent runtime (mock provider, both native-tool and JSON-fallback paths), SOW/wireframe definition conformance, kanban transitions, authored-vs-embedded definition sync, render-snapshot HTML.
- **E2E** (Playwright + chromium-headless-shell): navigation, dashboard interactions, sprint planning flows, governance walkthrough, assistant round trip, kanban drag, SOW review workflow, wireframe build.

No test ever touches the network — AI tests run against the built-in mock adapter.

CI runs both on every push (see `.github/workflows/test.yml`).

See [`tests/README.md`](./tests/README.md) for harness details and fixture patterns.

## Repository layout

```
.
├── index.html                  Single-file app
├── portfolio-data.json         Sample (fictional) data
├── portfolio-data-demo.json    Same — loaded by "Load demo dataset" button
├── definitions/                Governed templates + design rules (SOW, Tableau)
├── scripts/embed-definitions.mjs  Sync authored definitions into index.html
├── CLAUDE.md                   Conventions for AI assistants
├── SOLVER.md                   Solver R1–R12 reference
├── SKILLS.md                   How to add skills / templates / model adapters
├── tests/                      Unit, render, E2E
└── docs/specs/                 Accepted designs for in-flight work
```

## Contributing

- All work happens on feature branches; merge to `main` via PR. CI must pass.
- Keep `index.html` rendering convention (string concat, escape via `Dashboard.esc`). Don't introduce a build step.
- Don't commit emojis (icons are inline SVGs).
- Story points are integers — use `App.toInteger` / `App.fmtPoints`.
- All project field writes go through `App.updateProject(id, field, value, source?)` so the audit log + undo + dirty flag + autosave stay consistent. AI-originated writes pass source `'ai'`.
- Edited anything under `definitions/`? Run `node scripts/embed-definitions.mjs` — the sync test fails otherwise.

## License

MIT — see [LICENSE](./LICENSE).
