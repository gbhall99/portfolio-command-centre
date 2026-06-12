# Workstream E — Unified document engine + PDF parity — design

**Date:** 2026-06-11
**Branch:** `wsE-unified-reports`
**Context:** User requests #4 ("PDF exports should match the on-screen UI") and #10 ("explain & simplify the customer/portfolio/meeting/internal report packs given the customer filter"). Brainstormed with the visual companion; design validated screen-by-screen. After the brainstorm, branch `main` advanced 21 commits (AI assistant + Skills framework, Kanban, billing/SOW, a Status Report **skill**, Documents section) — this design is revised to build on that landscape rather than fight it.

**Single source of truth:** every printable document in the app is rendered and delivered through one engine (`Reports.Doc.buildDoc` → `Reports.open`), styled from the app's `:root` design tokens so output matches the screen. Skills generate/feed content; they never render their own final document.

**Scope:** Single-file `index.html` (~43k lines post-pull) + tests. No build step. `:root` tokens, inline SVG, no emojis, `Dashboard.esc`, customer-scoped. Gated by `npm test`.

## Decisions (from brainstorming)

1. **Goal:** do both #4 (parity) and #10 (simplify) — the half-finished `Reports.Doc` migration is the shared root of every problem, so unifying the engine is what makes parity tractable.
2. **Consolidation = collapse by scope, audience as a toggle.** Merge the audience-variant pairs (Customer Pack + Portfolio Pack → one Portfolio report; Sponsor Pack + Business Case → one Project report with the business case as an Internal section).
3. **Audience toggle** (Customer-facing vs Internal) is a per-section parameter controlling redaction + classification. Customer-facing = curated sections, risks limited to `customer_visible_risk_ids`, EVM/financials/governance/manager-notes hidden, classification "Confidential — shared". Internal = all sections, nothing redacted, classification "Internal".
4. **Parity = design-language parity** (not literal screen reproduction): reports reuse the app's tokens + components on a clean white A4 canvas. Mechanism: one token-derived stylesheet + one shared table renderer used by both screen and print, so they cannot drift.
5. **Entry = a Reports/Documents hub** (customer-scoped) *plus* contextual shortcuts that deep-link into it via the existing `#/report/{id}?args` copy-link mechanism.
6. **Post-pull (decided after the 21-commit merge):**
   - **One engine renders ALL document output** — briefs, status reports, billing/costs reports, SOW + quoted SOW. The legacy `Report.*` engine and every per-surface one-off renderer (`Billing.exportReport` inline HTML, `StatusReportSkill.exportPrint`, the SOW print path) are retired in favour of engine calls.
   - **Skills feed content, never render.** `StatusReportSkill` and the SOW skill keep AI-drafted, definition-governed content generation, entity persistence (`status_reports`, `sows`), and actions (list recent, run/generate, apply adjustments), but hand the engine a structured `{sections}` payload. No skill calls `window.print()`.
   - **Wireframes are out of scope** — they produce visual design artefacts (images/guidelines), not paginated documents.

## Current state (post-pull, to build on / replace)

- **New engine (keep, extend):** `Reports` object (~`index.html:36441`); `Reports.Doc.buildDoc(opts)` (~36457); `Reports.Catalogue` (~36523, 7 entries: sponsor_pack, business_case, sprint_brief, customer_pack, portfolio_pack, meeting_agenda, status_report); `Reports.Builders.*` (~36578+); `Reports.recentExports` (~36533); `Reports.parseCopyLink`/`buildCopyLink` (~36542/36555); `Reports.recordExport` (audit log).
- **Legacy engine (delete once callers migrate):** `Report` object (~36661–37519): `Report.buildDoc`, `_baseStyles`, `_coverPage`, `buildProjectPackDoc`, `buildBusinessCaseDoc`, `buildSprintBriefDoc`, `buildWalkthroughMinutesDoc`, the raw-HTML `buildCustomerPackDoc` (~36976), the 180-line inline `exportPortfolioPack` (~37322). Keep the `window.open`+auto-print mechanism but move it under `Reports.open`.
- **Per-surface renderers (reroute through the engine):** `Billing.exportReport(customer)` (~40664); `StatusReportSkill.exportPrint()` (~42326); the SOW print path (`Sow` entity ~40907+).
- **Content skills (keep, adapt to feed the engine):** `StatusReportSkill` (~42263), `produces: 'status_report'`, `definitionKind: 'status-report'`, `approval: 'review-before-send'`; the SOW skill (`definitions/sow`, `definitions/sow-quoted`).
- **New entities the engine consumes (no new report-only fields added by E):** `status_reports`, `sows`, `billing_arrangements` (all seeded in `migrateSchema` ~4871–4874).

## E1 — Parity foundation: tokens + shared table renderer

The linchpin of #4 and the reusable piece that justifies "unify all".

- **`Reports.tokens` (print stylesheet):** a single CSS block generated from the same values as the app's `:root` tokens — RAG colours (green/amber/red), status badges, the 11–16px type scale, fonts, surfaces. Replaces the legacy `Report._baseStyles` hardcoded hex. Print-tuned: A4 `@page`, fixed running header/footer, white canvas, ink-friendly.
- **`Reports.table(opts)` (shared renderer):** one helper that builds a token-styled table (header row, body rows, optional severity/status chips, fixed `colgroup`). Used by **every** document section that renders a table *and* available to the on-screen views so screen and print share markup. Mirrors the RAID/Dashboard table look (the brainstorm's parity example was a RAID table identical on screen and in PDF).
- **Acceptance:** a render test asserts the report's RAG/badge/type values equal the app token values (no divergent hex); the legacy hardcoded-hex paths are gone.

## E2 — Engine: one builder, audience-aware sections

- **`Reports.Doc.buildDoc(opts)`** is the only document assembler: cover (branded) → optional ToC → classification band → sections → footer → optional appendix. Extended to consume `Reports.tokens` + `Reports.table`.
- **Sections are audience-tagged.** Each section declares `audiences: ['customer','internal']` or `['internal']`. `buildDoc` (or the builder) filters sections by the chosen audience and sets the classification accordingly. Redaction rules (E.g. risks → `customer_visible_risk_ids` for customer-facing) live in the builders, applied via the audience param.
- **`Reports.open(html)`** is the single delivery mechanism (`window.open` + auto-print), moved off the legacy `Report` object. Every export calls it; nothing else calls `window.print()`.
- **`Reports.recordExport(...)`** audit-logs every generation (existing), so `recentExports` spans all document types.

## E3 — Document catalogue (consolidated)

`Reports.Catalogue` becomes the single registry for **all** document types. Each entry declares: `id`, `title`, `scope` (`project` | `customer` | `customer-sprint` | `forum` | `cross-customer`), `audiences` (which toggles apply), `requiresScopeArg`, `requiresFields`, `defaultClassification` per audience, and **`contentSource`**: `data-derived` (briefs, billing) or `skill-fed` (status, SOW).

Target user-facing set (collapsing the 7 legacy packs + the new doc types):

| Document | Scope | Audiences | Content source | Replaces / absorbs |
|---|---|---|---|---|
| **Project report** | project | Customer-facing / Internal | data-derived | Sponsor Pack + Business Case (Internal section) |
| **Portfolio report** | customer | Customer-facing / Internal | data-derived | Customer Pack + Portfolio Pack |
| **Sprint brief** | customer + sprint | Internal | data-derived | Sprint Brief |
| **Meeting agenda** | forum | Internal | data-derived | Meeting Agenda |
| **Status report** | customer | Customer-facing / Internal | skill-fed | StatusReportSkill output (rendered by engine) |
| **Costs report** | customer | Internal | data-derived | `Billing.exportReport` |
| **SOW** (T&M) | customer/project | Customer-facing | skill-fed | SOW skill print path |
| **Quoted SOW** | customer/project | Customer-facing | skill-fed | quoted-SOW skill print path |

(Internally the briefs collapse to ~5 scopes; billing + SOW adopt the engine without changing their generation logic.)

## E4 — Skills feed content, engine renders

- **`StatusReportSkill`:** keep `generate()` (AI `structuredOutput` against the `status-report` definition), entity persistence (`StatusReport.create` → `App.data.status_reports`), review/edit modal, and actions (list recent, run, apply adjustments). **Remove** `exportPrint`'s bespoke HTML; replace with: build `{sections}` from the saved `status_report` entity → `Reports.Doc.buildDoc({reportType:'status_report', audience, sections})` → `Reports.open`. The skill becomes a content + action surface; the engine owns output.
- **SOW skill:** same pattern — generation/persistence stays; the print path becomes an engine call with the SOW's sections.
- **Principle:** a skill may *feed information or adjustments*, *collect recent reports*, and *run reports*, but **delivery and output are engine-driven**.

## E5 — Documents/Reports hub + contextual shortcuts

- **New hub view** in the nav (customer-scoped): cards for every catalogue entry with audience chips, a **Generate** action, and a unified **Recent exports** list (`Reports.recentExports`, all types). All documents — including the Status report — are scoped to the active customer, consistent with the rest of the app (no "All" customer view).
- **Contextual shortcuts** keep report generation where the data is (project detail → Project report; forum → Agenda; billing view → Costs report; SOW skill → SOW) but all deep-link into the generator via `#/report/{id}?args` with scope pre-filled.
- **Migration:** the scattered legacy buttons (Dashboard/Projects/Governance sidebars, quick-nav) re-point to the unified generator.

## E6 — Removal of legacy + one-off renderers

Once every caller is migrated: delete the legacy `Report.*` engine (build/styles/cover + per-pack builders + inline `exportPortfolioPack` + raw-HTML `buildCustomerPackDoc`), and the per-surface `Billing.exportReport` / `StatusReportSkill.exportPrint` / SOW print HTML. A guard test asserts these identifiers no longer exist and that no surface calls `window.print()` except `Reports.open`.

## Phasing (one spec, phased plan)

Each phase ships green and is independently mergeable:
- **Phase 1 — foundation + briefs:** E1 (tokens + table renderer), E2 (engine + audience sections), E3 catalogue for the briefs, migrate Project/Portfolio/Sprint/Meeting through the engine, delete the legacy `Report.*` paths they used.
- **Phase 2 — skills feed the engine:** E4 — Status report + SOW skills render through the engine; remove their bespoke print paths.
- **Phase 3 — billing + hub:** reroute `Billing.exportReport` (Costs report) through the engine; build the Documents/Reports hub (E5); final legacy removal + guard (E6).

## Error handling

- Missing scope arg → Generate disabled with a reason (no project/forum/sprint selected).
- `requiresFields` integrity checks (existing pattern) before generation.
- Popup blocked (`window.open` null) → toast, no silent failure.
- Empty data → graceful "nothing to report" sections, not a broken doc.
- Skill-fed docs with no saved entity → prompt to generate/draft first.

## Testing

- **Unit:** catalogue shape (ids, scope, audiences, contentSource); each builder's sections per audience; redaction (customer-facing excludes internal sections + filters risks to `customer_visible_risk_ids`); classification per audience; copy-link round-trip; `recentExports` spans all types; **no new report-only schema fields** (engine adds none).
- **Render/snapshot:** each document HTML (customer-facing + internal); **parity assertions** — report RAG/badge/type values equal the app token values; `Reports.table` output matches the on-screen table markup; **guard** — legacy `Report.*` / `Billing.exportReport` / `StatusReportSkill.exportPrint` identifiers removed; no stray `window.print` outside `Reports.open`.
- **Skill integration:** `StatusReportSkill` and SOW skill produce `{sections}` that render through the engine (no bespoke HTML); existing skill tests (`status-report.test.mjs`, `sow.test.mjs`, `sow-quote.test.mjs`) stay green or are updated to assert the engine path.
- **E2E:** hub renders cards customer-scoped; Generate hits the engine print path; a contextual shortcut deep-links with scope; status/billing/SOW exports go through the engine.
- **Visual (in-browser, served):** every document type at 1440px (light + dark) — cover/footer/classification consistent; tables match the on-screen look; customer-facing vs internal redaction correct; switching customer rescopes the hub; no console errors.

## Out of scope

- **Wireframes** (visual design artefacts, not paginated documents).
- No new report content or data fields; the engine renders existing entities.
- No change to how skills *generate* content (AI/definition flow) — only to how their output is *rendered/delivered*.
- The agentic assistant / AgentTools (no report-export tool is added in E).
