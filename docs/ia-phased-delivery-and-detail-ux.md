# IA clarity + rolling-wave delivery + detail-page UX

**Date:** 2026-05-30 · **Branch:** `ia-phased-delivery` · Driven by two multi-agent workflows
(`.claude/wf-ia-phased.js`, `.claude/wf-detail-ux.js`), each design → synthesize → adversarial-verify.

## Workflow 1 — Portfolio-vs-customer menu clarity + rolling-wave phases

### Goal 1a — scope-first menu  ✅ shipped (`6b4e8ae`)
The old "Portfolio" section mixed the all-customer Portfolio Overview with four single-customer views.
- Three **scope-first** section headers: **Across all customers** (Portfolio Overview + cross-customer RAID),
  **This customer · ‹name›** (Projects/Roadmap/Backlog/RAID/Sprint/Capacity/My Actions/Strategy/Metrics/
  Personas/Governance, grouped by Delivery/Planning/Business-context sub-dividers), **System** (Activity/Settings).
- **RAID split** into two explicit nav items (both `data-view=raid`): `#navRaidAll` (showAll=true) and
  `#navRaidSingle` (showAll=false) — scope is a navigation choice, not a hidden toggle.
- `App.VIEW_SCOPE` map + `_viewScope()` drive a categorical **titlebar scope badge** (All customers /
  This customer: ‹name› / System · all data; all/system drop the customer dot).
- "This customer" header carries a live customer chip; customer mode hides the cross-customer RAID entry.
- Tests: `tests/unit/ia-scope-clarity.test.mjs` (8) + updated `slot-h-nav-raid`, `ux-benchmark-wave5`.

### Goal 1b — rolling-wave / progressive elaboration  ✅ core shipped
Phase model: `phase_order` entries are plain strings (committed phases) or objects
`{ phase, status: 'tbd'|'planned'|'committed', placeholder_size? }` for not-yet-committed phases.
- **B6 tolerant readers** (`App.phaseName/phaseNames/phaseStatusOf`) so every consumer treats the mixed array
  uniformly; fixed the four string-assuming sites (phase-flow editor, detail phase list, dependency check,
  handover lookup). (`44a5a7f`+)
- **B7 — no scope creep** (`9c206bd`): `DetailPanel._classifySizeChange()` — a skill/phase going 0→N is
  *elaboration* (logs a neutral `phase_elaborated` event, suppresses the scope-change prompt); only >20% growth
  of an already-sized phase is a *scope-change*.
- **B9 — no Gantt disconnection** (`44a5a7f`): the single fixed TBD panel became a continuous, flush-butted
  **placeholder train** (one panel per future phase; tbd=dashed, planned=solid-faded `~N`); removed the `w>0`
  guard so all-TBD projects render a continuous dashed roadmap. On promotion a phase migrates into the live bar.
- Promote ladder (`promoteTbdPhase`) already advances tbd→planned and is safe (never hits the scope-creep path).
- Tests: `tests/unit/ia-phased-delivery.test.mjs` (B6/B7/B9).

**Remaining (hardening, not blocking the core):** B8 (baseline-variance attribution: label a promotion-driven
date shift as "planned phase elaboration" vs silent slip); B10/B11 (solver/integrity guards — effectively moot
today since tbd/planned phases carry no `size_*`/`skill_splits`); a first-class "add future (TBD) phase" affordance
in the Delivery tab so users can seed un-elaborated phases without editing data.

## Workflow 2 — Project detail page UX scrutiny (verdict: defensible, 0.9)

Five lenses → 20-item backlog + 19 acceptance criteria. **Shipped:**
- **NAV-1** chip TOC / scroll-spy / Collapse-Expand-all scoped to the active tab (were spanning hidden tabs → dead clicks). `b999375`
- **NAV-2** History moved inside the Overview tab panel (was leaking onto every tab). `b999375`
- **A11Y-1** Escape closes the dialog (was the only modal without it). `b999375`
- **TASK-1** merge Status + the three RAG dials into one "Status & Health" card on Overview (was an
  Overview→RAID round-trip). `5fb0e24`
- **TASK-2** Projects/Backlog row-click lands on Overview (now carries Status/Identity/Prioritisation/Health). `5fb0e24`

**Remaining detail-page backlog (queued):** A11Y-2 field accessible names · A11Y-3 keyboard RAG radiogroup ·
VIS-1 theme-aware banner tints · NAV-3 stable per-section collapse keys · TASK-3 sticky-meta deep-links ·
FB-1 save feedback · A11Y-4 tablist arrow keys · IA-1 tighten RAID · VIS-2 EVM cells-first · VIS-3/4/5 read-only
badges + tokens · ERR-1 app-modal close guard. (CONS-1 flagged stale by the verifier — re-check before action.)
