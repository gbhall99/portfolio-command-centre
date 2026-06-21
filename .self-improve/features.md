# Feature Catalogue

Living inventory of every major feature/module in Velocity (`index.html`, ~18k lines, single file).
Consulted on every cycle so nothing is changed or tested in isolation. Maturity: **solid** (mature,
well-tested), **rough** (works, has known edges), **partial** (incomplete/early).

Code locations are the JS module objects in the single `<script>` block unless noted.

---

## Core shell & data
| Feature | What it does | Serves | Where | Maturity |
|---|---|---|---|---|
| App core | State, customer scoping, save/load (localStorage + JSON), undo, audit, migration, `updateProject` | all | `App` | solid |
| Customer scoping + "All customers" | Customer-scoped app with an aggregate read filter (`scopeCustomer`/`matchesCustomer`/`isAllScope`) | Priya | `App`, `ALL_CAPABLE_VIEWS` | solid |
| Migration & integrity | Versioned data migration + integrity checks | all | `App` migration | solid |

## Planning & delivery
| Feature | What it does | Serves | Where | Maturity |
|---|---|---|---|---|
| Dashboard / Projects table | Schema-driven table (`Dashboard.COLUMNS`), inline edit, column picker | Priya, Tom | `Dashboard` | solid |
| Backlog | Prioritised project/work list (WSJF/MoSCoW aware) | Tom | backlog view | solid |
| Sprint Planning | Per-customer sprint allocation, splits, overrides | Sana | `Sprint` | solid |
| Kanban Board | Schema-driven cards (`Kanban.CARD_FIELDS`), swimlanes, WIP, blocked/aging/time-in-status, ⋯ menu, keyboard move (K1–K10) | Tom, Dev | `Kanban` | solid |
| Roadmap / Gantt | Timeline, baselines, critical-path overlay toggle | Priya, Elena | `Gantt` | solid |
| Capacity & Workload | Holiday-aware capacity, heatmaps, per-sprint overrides | Sana | `Capacity`, `calcSkillCapacityForSprint` | solid |
| Auto-allocation Solver | Rules R1–R12, dependency-aware topo order, critical path, warnings, scoring | Priya, Sana | `Solver` (see SOLVER.md) | solid |
| Scenario Lab | Saved/comparable solver what-ifs with £ economics, promote-on-confirm | Priya | `ScenarioLab`, simulate_plan | solid |
| Forecast | Monte-Carlo completion bands (P50/P80/P95) + EVM | Priya, Elena | `Forecast`, commercial_forecast | solid |

## Governance & risk
| Feature | What it does | Serves | Where | Maturity |
|---|---|---|---|---|
| RAID | Risks/Assumptions/Issues/Decisions/Actions tabs (Actions folded in) | Tom | RAID view | solid |
| Governance | Forums, project decisions, decision deep-links | Tom, Elena | `Governance` | solid |
| Activity / Audit | Change log, audit panel, trends | all | `AuditPanel`, `TrendsModal` | solid |
| Health Check | User-invoked "needs attention" digest (prepaid low, margin, stale SOW, readiness gaps, drift) | Priya | `HealthCheck` | solid |

## Strategy
| Feature | What it does | Serves | Where | Maturity |
|---|---|---|---|---|
| Strategy library | Objectives, Personas, Metrics, Products; Persona vs Person split; RACI | Priya, Marcus | Strategy view, `Objectives`/`Metrics` | rough |
| Metric insight narration | Grounded movement summaries from recorded actuals (Phase 3.3) | Marcus, Elena | `Metrics.insightFor/movementSummary` | solid |

## Documents & commercials
| Feature | What it does | Serves | Where | Maturity |
|---|---|---|---|---|
| SOW skill | Governed SOW authoring, draft/redraft/suggest-edit, RAID pull, review redline, freshness-gated approval | Marcus | `Sow`/`SowSkill`, `definitions/sow/` | solid |
| Wireframe skill | Tableau wireframes, conformance, build-ready gating, field/calc map, acceptance checklist, vision compare | Dev, Marcus | `Wireframe`/`WireframeSkill`, `definitions/tableau/` | solid |
| Status reports | Grounded periodic narratives, living-doc refresh | Marcus | `StatusReport`/`StatusReportSkill`, `definitions/status-report/` | solid |
| Billing (OUT OF BOUNDS) | Cost (rate_card) + sell (rate_table/hours_per_point), prepaid arrangements, quotes, planned economics | Marcus | `Billing`, `App.computeProjectCost` | solid · do-not-touch |
| Reports / Packs | Audience-gated docs, pack composer, embedded Gantt pipeline, KPI/charts/callouts (R1–R10) | Elena, Marcus | `Reports.*` | solid |
| Project Wizard | Conversational new-project onboarding (deterministic, AI-optional) | Priya | `ProjectWizard` | solid |
| Onboarding tooltips | Product view-help (distinct from ProjectWizard) | new users | `Onboarding` | solid |

## AI layer (WS1–WS6, Phases 0–5) — credentials OUT OF BOUNDS
| Feature | What it does | Serves | Where | Maturity |
|---|---|---|---|---|
| Provider adapters | openai/anthropic/gemini/mock, streaming, vision, capability negotiation | all | `AI.ADAPTERS` | solid |
| AgentTools registry | Declarative read/write tools; writes return confirm-gated proposals; skills-as-tools | all | `AgentTools` | solid |
| Agent runtime | Native + JSON-fallback tool loops, system prompt, memory fold-in | all | `Agent` | solid |
| Assistant panel | Per-customer threads, citations, diff cards, batch card, briefing, scope-aware chips | all | `Assistant` | solid |
| Agent memory | Durable customer-scoped goals/facts/worklog (export-safe) | Priya | `AgentMemory` | solid |
| Batch runner / policy | One undoable audited batch; propose vs auto_apply policy | Priya | `App.runBatch`, agent.policy | solid |
| Command palette → agent | ⌘K "Ask AI" intents (VIEW_PROMPTS) | all | `CommandPalette` | solid |
| Skills registry / gallery | One descriptor per skill; governed output to real entities | Marcus, Dev | `Skills` | solid |
| Tableau connector | Read-only dashboard refs (metadata only); creds in localStorage | Dev | `Tableau` | rough |

## Notes / known edges to respect
- Untrusted content: always `Dashboard.esc()`; `esc()` does NOT escape double quotes — never interpolate untrusted values into double-quoted onclick attributes (use index-based handlers).
- Integer story points everywhere except sanctioned statistics (`fmtPoints`/`toInteger`/`fmtAverage`).
- `App._save` is a guarded no-op; some mutators (Objectives/Metrics) only touch memory and must persist explicitly.
- After editing anything under `definitions/`, run `node scripts/embed-definitions.mjs` (a skills sync test fails on drift).
