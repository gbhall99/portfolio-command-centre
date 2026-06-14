# SOW, Wireframing & Assistant enhancements — spec (2026-06-13)

*Twelve enhancements across the three skill surfaces, ranked within each area by
value. This is a design spec, not yet built. Conventions (per CLAUDE.md): every
item ships with mock-adapter tests (no network), all model output lands in a real
governed entity, all writes are confirmation-gated + audited (`source:'ai'`,
undoable), `Dashboard.esc()`/`escAttr()` on all rendered model/document text,
`pushUndo` BEFORE mutate, and `npm test` stays green. Single file, no deps.*

Item ids: **S1–S4** (SOW), **W1–W4** (Wireframing), **AS1–AS4** (Assistant).

---

## A. SOW (`Sow` / `SowSkill`, `data.sows[]`, `definitions/sow/`)

### S1 — Generate a first draft from the project's own data (highest value)
**Goal.** Today a SOW starts blank or from an uploaded source document. Add a
"Draft from project" path that grounds generation in the linked project, so the
author starts at ~90% instead of an empty editor — figures are never invented.

- **Entry.** In `SowSkill` list/edit and the project detail panel's Documents
  section: "Draft from project" (enabled when a `project_id` is set). Also a
  palette entry and an Assistant tool (see AS1).
- **Grounding.** New `Sow.groundingFor(projectId)` mirroring
  `StatusReport.groundingFor`: returns a structured, read-only fact pack —
  project name/customer/dates, `delivery_config.phase_order` + phase statuses,
  the five `size_*` totals, `outcomes[]` (benefits + success criteria),
  linked `metric_ids` (names + targets via `Metrics.byId`), open RAID
  assumptions/risks, and the quote if present (`Billing.quoteForProject`).
- **Generation.** `AI.structuredOutput(profileForTask('drafting'), …, schema)`
  where the schema is `{ sections: [{ id, content }] }` keyed to the selected
  `definitions/sow/` set's section ids. Prompt = section guidance + style rules
  + the grounding pack (facts are data, not instructions) + the never-follow
  rule. Source excerpt, if any, is untrusted-wrapped.
- **Apply.** Each returned section routes through the existing
  `Sow.updateSection(id, content, 'ai')` (history event `section_drafted`),
  rendered as a per-section accept/reject diff (reuse the S-redraft diff card
  from the shipped #2). Nothing auto-approves; `Sow.validate` still gates
  Approve.
- **Tests.** grounding pack is read-only + customer-scoped; sections map to the
  definition set; figures in the draft trace to the grounding (no fabricated
  numbers beyond the fact pack); accept persists + audits `'ai'`; reject leaves
  content; injection guard; XSS in rendered draft.

### S2 — Auto-populate Assumptions/Exclusions from RAID + a clause library
**Goal.** Biggest risk-reducer/consistency win: stop hand-retyping standard
clauses and surface the project's real assumptions/risks in the SOW.

- **RAID pull.** A "Pull from RAID" action on the Assumptions/Exclusions
  sections inserts the project's open `assumptions_register` (as assumptions) and
  high-severity `risks_register` items (as exclusions/caveats), each as an
  editable bullet with provenance.
- **Clause library.** New governed file set `definitions/sow-clauses/` (authored
  markdown snippets: payment terms, IP, change control, warranties, data
  handling), mirrored to an embedded island by `scripts/embed-definitions.mjs`
  (anti-drift test like the others). `Sow` gains `clauses()` loader; the editor
  shows an "Insert clause" picker per section; AI drafting (S1) may pull from it.
- **Data.** No new entity fields — clauses land as section `content`. Provenance
  stored as a lightweight `section.sources[]` (`{kind:'raid'|'clause', ref}`) so
  the UI can show where a bullet came from; additive, migration backfills `[]`.
- **Tests.** RAID pull is customer/project-scoped + audited; clause set authored↔
  embedded in sync; inserted clause text escaped; migration idempotent.

### S3 — Stale-quote detection + one-click re-quote
**Goal.** Stop SOWs going out with outdated commercials when scope changes after
a quote was attached.

- **Detection.** Store `sow.quote.basis_hash` = a hash of the priced inputs
  (planned `size_*` + band + prepaid balance) at `Sow.setQuote` time. On render,
  recompute via `Billing.quoteForProject` and compare; if drifted, show a "Quote
  out of date" chip on the Commercials section.
- **Action.** "Re-quote" recomputes and re-stores through the existing
  `Sow.setQuote` (history event `quote_refreshed`); the quoted template's
  `validation.requires_quote` still blocks Approve on a stale quote.
- **Tests.** hash changes when sizes/band/prepaid change; stale chip appears;
  re-quote updates totals + audits; Approve blocked while stale (quoted set).

### S4 — Version redline + resolved-comments approval gate
**Goal.** Make review real: see what changed between versions and require comment
resolution before Approve.

- **Redline.** `sow.history[]` already records section edits; add a per-section
  "Compare" that diffs the current content against the last `Approved`/`Review`
  snapshot (store a `section.baseline` captured on status transitions).
  Old→new shown as the existing stacked diff (struck old / new).
- **Gate.** Extend `Sow.validate`: Approve is blocked while any section has an
  unresolved `flagged`/open comment; surfaced as a validation reason.
- **Tests.** baseline captured on Review→ transition; diff reflects edits;
  Approve blocked with an open flag/comment, allowed once resolved.

---

## B. Wireframing (`Wireframe` / `WireframeSkill`, `data.wireframes[]`, `definitions/tableau/`)

### W1 — Visual grounding + export to a build spec (highest value)
**Goal.** Close the design↔build loop. Two halves:

- **(a) Visual grounding.** When a wireframe has `tableau_refs[]` (the connector
  shipped this session) and/or a pasted screenshot, send the **image** to a
  vision-capable provider so AI drafts/refines match the existing dashboard's
  style — today only names/metadata reach the prompt. Gated by
  `AI.capabilities(profile).vision`; degrades to the current text-only grounding
  when the model can't take images. Images travel only in the request (never
  persisted into `data.wireframes` — exports stay lean), reusing
  `Tableau.viewImageDataUrl`.
- **(b) Build-spec export.** New `Wireframe.toBuildSpec(wf)` → a structured doc
  (ordered components with type, grid geometry, title, bound metric — see W2)
  rendered through the Reports engine as a new catalogue entry
  `wireframe_spec` (data-derived), so a developer gets an actionable layout +
  data map rather than a picture.
- **Tests.** vision path only fires when capability present (mock both ways);
  image never lands in `data.wireframes`; build spec lists every component +
  geometry + bound metric; spec generates through `Reports.generate` and audits.

### W2 — Bind each component to a metric/field
**Goal.** Traceability (concept → metric → strategy) and a real data map for the
build spec.

- **Data.** Component gains optional `metric_id` (additive; migration backfills
  none needed since absent = unbound). Editor: when a component is selected, a
  "Shows metric" picker lists the customer's metrics (`Metrics.list()` scoped to
  `wf.customer`). AI draft/refine may set it (schema gains `metric_id` on
  add/retitle ops, validated against the customer's metric ids).
- **Conformance.** `checkConformance` gains an optional warning: KPI/chart
  components with no bound metric (not an error — nuance stays unflagged).
- **Tests.** bind/unbind audited + undoable; picker scoped to `wf.customer`;
  AI-set metric_id validated (unknown ids dropped); build spec (W1) includes the
  bound metric name.

### W3 — Multi-dashboard wireframe sets
**Goal.** Real Tableau deliverables are several linked dashboards; today it's one
grid per wireframe.

- **Data.** New optional `wireframe.set_id` + `wireframe.set_order` (additive).
  A "set" is just wireframes sharing a `set_id`; `Wireframe.set(id)` returns the
  ordered members. Editor gains page tabs (prev/next dashboard) and "Add page".
- **AI.** "Draft a set" produces N linked wireframes from one brief (each a
  governed grid); navigation order returned by the model, clamped.
- **Tests.** set membership/order; add/remove page audited; build spec (W1) can
  emit a whole set; migration leaves single wireframes as a set of one.

### W4 — Conformance → one-click AI fixes
**Goal.** When `checkConformance` flags structural issues, propose the corrective
ops instead of leaving the user to fix them.

- **Flow.** "Fix layout" calls `AI.structuredOutput` with the same constrained
  `ops` schema as the shipped refine (#4) plus the current conformance errors;
  ops apply through the clamped mutators; conformance re-checks; toast "Applied N
  fixes — Ctrl+Z to undo".
- **Tests.** ops constrained to the vocabulary; invalid ops dropped; conformance
  improves or is unchanged (never regresses on the happy path); undoable.

---

## C. Assistant (`Assistant` / `Agent` / `AgentTools`)

### AS1 — Portfolio-aware scope + skills exposed as tools (highest value)
**Goal.** Two multipliers: let the Assistant answer cross-customer questions, and
let it *drive the document engine*, not just read/edit fields.

- **(a) Scope.** Read tools currently filter by `ctx.customer`. When
  `App.isAllScope()` (the All-customers filter, on an aggregate-capable view),
  pass `ctx.customer = null` so read tools aggregate every customer; write tools
  and per-customer authoring stay pinned to the working customer. The thread
  header shows the active scope.
- **(b) Skills as tools.** New write tools that return proposals which run the
  governed generators: `draft_sow {project_id}` → S1, `draft_wireframe
  {project_id, brief}` → WireframeSkill draft, `generate_report
  {type, scope_arg}` → `Reports.generate` (portfolio_overview / success_story /
  status_report). Each returns a proposal card; confirming runs the skill so the
  output lands as a real `data.sows`/`data.wireframes`/report entity, audited.
- **Tests.** read tools aggregate only under all-scope (mock); skill tools return
  proposals (no mutation pre-confirm); confirm lands a real entity + audits
  `'ai'`; both native-tool and JSON-fallback paths.

### AS2 — Proactive "needs your attention" briefing on open
**Goal.** Turn the Assistant from reactive to a standing analyst.

- **Flow.** On panel open (per customer, once per session), call the existing
  `recent_changes` read tool plus a deadlines-in-30-days scan and render a
  compact digest card (counts by class, RAG flips, status changes, aging
  decisions, upcoming deadlines) with citation deep-links. Dismissible; never
  mutates; respects customer scope / all-scope (AS1).
- **Tests.** digest is read-only + scoped; day window honored; citations resolve;
  renders once per session; empty/quiet period reads honestly.

### AS3 — Visible multi-step plans (chained tools)
**Goal.** For "what if we add this project?" type asks, let the Assistant chain
tools with the plan shown and every write still confirmation-gated.

- **Flow.** `Agent` gains a lightweight plan loop: it may call read/simulate
  tools (`simulate_plan`, `billing_summary`, `recent_changes`) in sequence,
  render the intermediate reasoning + a proposed action, and only mutate via the
  usual proposal→confirm. A visible step list ("1. simulated · 2. proposing…")
  keeps it auditable; a max-steps guard prevents runaway loops.
- **Tests.** chains read+simulate then proposes one confirm-gated write; respects
  max-steps; no mutation without confirm; JSON-fallback path.

### AS4 — Context-aware prompt chips + sturdier local-model path
**Goal.** Lower the blank-box cost and make small local models fail gracefully.

- **Chips.** Per-view suggested prompts surfaced above the input (e.g. on RAID:
  "summarise this customer's top risks"; on Capacity: "where are we over
  capacity?"; on a project: "draft a status update"). Derived from
  `App.currentView` + scope; clicking pre-fills the input.
- **Local-model robustness.** On the constrained-JSON fallback
  (`Agent._runJsonFallback`), add a clearer repair message + a one-line
  "model returned invalid JSON, retrying" status and a final actionable error
  (so the Ollama/gemma seed degrades visibly, not silently).
- **Tests.** chips reflect the current view + scope; fallback repair path surfaces
  a status then succeeds/errors deterministically (mock programmed bad-then-good
  JSON).

---

## Sequencing & status

Build order = value first, and the three "if I could only do three" picks lead:

| Order | Item | Status |
|---|---|---|
| 1 | S1 SOW draft-from-project | DONE |
| 2a | W1b build-spec export | DONE |
| 2b | W1a visual (vision) grounding | DEFERRED — needs a multimodal message layer across all adapters (openai/anthropic/gemini) + a `vision` capability + mock support; tracked as its own item |
| 3 | AS1 portfolio scope + skills-as-tools | DONE |
| 4 | S2 RAID/clause library | DONE |
| 5 | W2 component↔metric binding | DONE |
| 6 | AS2 proactive briefing | DONE |
| 7 | S3 stale-quote | DONE |
| 8 | W4 conformance one-click fix | DONE |
| 9 | AS3 visible tool steps | DONE |
| 10 | S4 redline + gate | DONE |
| 11 | W3 multi-dashboard sets | DONE |
| 12 | AS4 view-aware prompt chips | DONE |

Update this table as items land. Each lands as its own tested commit; PR per
small batch (≈3 items), suite green per the conventions above.
