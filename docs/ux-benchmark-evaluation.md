# Velocity — UX/UI Benchmark Evaluation

**Date:** 2026-05-29 · **Branch:** `ux-benchmark-overhaul` · **App:** index.html (~36,400 lines)
**Method:** 4-persona code-grounded evaluation (Product Owner, Portfolio Owner, Scrum Master, Customer) + accessibility/heuristics lens via a background multi-agent workflow, synthesised against industry "excellent" thresholds and adversarially verified (verdict: **defensible, confidence 0.86**). Cross-checked against a live in-browser walkthrough (Playwright): screenshots of 5 views, a DOM accessibility probe, console-error check, and functional spot-checks. Supersedes the April `USABILITY_TEST_REPORT.md` (most April criticals are now FIXED).

## Excellent thresholds (industry standard)
| Benchmark | Excellent | Avg/median |
|---|---|---|
| Task Success Rate | ≥ 95% | ~78% |
| Task Time efficiency (optimal/actual) | ≥ 0.80 (≤1.25× expert) | — |
| SUS | ≥ 80.3 (Grade A) | 68 |
| SUPR-Q (overall + each subscale, percentile) | ≥ 90 | 50 |
| NPS | ≥ 50 | SaaS ~30–40 |
| CSAT | ≥ 85% (≥4.25/5) | — |

## Scorecard (current state)
| Benchmark | Current | Excellent | Gap |
|---|---|---|---|
| **Task Success Rate** | **77.5%** (15.5/20; 5 partials, 0 fails) | ≥95% | −17.5 |
| **Task Time efficiency** | **0.64** (~1.55× expert) | ≥0.80 | −0.16 |
| **SUS (mean)** | **76.9** (range 70–82.5) | ≥80.3 | −3.4 (−8.6 to "excellent" 85.5) |
| **SUPR-Q overall** | **73.75** (trust ~75, loyalty ~60, usability ~74, appearance ~85) | ≥90 | −16 |
| **NPS** | **0** (8/8/8/7 → 4 passives, 0 promoters) | ≥50 | −50 |
| **CSAT** | **77.5%** (3.875/5) | ≥85% | −7.5 |

Per-persona: Portfolio Owner SUS 82.5 (only one clearing Grade A) · Scrum Master 79 · Product Owner 76 · **Customer 70** (the anchor: trust 58, loyalty 50).

## What's already excellent (preserve)
- Auto-Allocate **Options-first preview→Apply** loop with undo + audit + toast.
- **"Why this rank?"** WSJF/MoSCoW explainer — best-in-class, stakeholder-defensible.
- Named multi-snapshot **baselines** with variance + branded export.
- Two sponsor-grade PDF exports; rich Gantt; dense-but-legible Sprint grid; skill palette divergent from RAG.
- Solid a11y hygiene: lang, skip-link, landmarks, 6 aria-live regions, :focus-visible, sr-only, fully-labelled icon buttons.

## Remediation backlog (R1–R14, prioritised by impact-to-excellent)

| ID | Title | Theme | Sev | Effort | Moves |
|---|---|---|---|---|---|
| **R1** | Make customer-safe **Customer Pack** the default forwardable export; relabel/gate the cross-customer Status Report (which embeds **all** customers' data — confirmed leak) | Trust | **critical** | M | Success, SUPR-Q, NPS, CSAT, Time |
| **R2** | Direct-manipulation **backlog refinement** (drag / move-to-bucket) vs read-only derived columns | Consistency | high | L | Success, Time, SUS, SUPR-Q, NPS |
| **R3** | Plain-language **"Value delivered"** summary for customers (vs expert Metrics/RACI view) | Findability | high | M | Success, Time, SUPR-Q, CSAT, NPS |
| **R4** | Auto-recompute `recommended_priority` on **add-project** so rank ripple is immediate | Feedback | high | S | Success, Time, SUS |
| **R5** | Inline **"mark off sick / set leave"** + one-click re-run on Capacity per-member row | Feedback | high | M | Success, Time, SUS, SUPR-Q, NPS |
| **R6** | Aggregate **RAID issues / sprint blockers / over-commit** into My Actions | Findability | high | M | Success, SUS, SUPR-Q |
| **R7** | **Customer-scoped My Actions** mode (filter to active customer, hide Approve/Reassign) | Trust | high | S | Success, SUPR-Q, CSAT |
| **R8** | Sort **RAID Risks** by score desc + cross-portfolio scope + sortable headers | Findability | medium | S | Success, Time, SUS |
| **R9** | Replace dev-centric **first-run dropzone** with benefit-led onboarding + demo CTA | Findability | high | S | Time, SUS, SUPR-Q, CSAT |
| **R10** | Promote per-view title to semantic **`<h1>`** + normalise heading outline | A11y | medium | M | SUS, SUPR-Q |
| **R11** | Deep-link from Sprint **over-commit badge** → per-person Capacity breakdown | Findability | medium | S | Time, SUS |
| **R12** | **aria-label** the Metric/Objective/Persona + utility selects (visible label spans exist but no programmatic association) | A11y | medium | S | SUS, SUPR-Q |
| **R13** | On-screen **"vs baseline" variance table** on Roadmap (not just export) | Feedback | low | S | Time, SUPR-Q |
| **R14** | Fix subject-verb agreement: "1 project **need** immediate attention" → "needs" | Aesthetics | low | S | SUPR-Q, CSAT |

**Verifier additions:** R1 — `exportStatusReport` builds a colorMap over `getCustomers().forEach`, confirming the whole multi-customer dataset is embedded (strengthens critical severity). R8 — RAID `<th>` headers have no `onclick` sort either, so the unsorted state is unrecoverable by the user. Also: confirm `Sprint.autoAllocate` calls `pushUndo` before mutating (a11y finding #5) and add success toasts after report exports.

## Implementation waves
- **Wave 1 — polish, a11y, trust quick-wins (S/M):** R14, R12, R10, R9, R4, R8, R11, R13, export-success toasts, verify Auto-Allocate undo.
- **Wave 2 — trust & customer legibility (critical/high):** R1, R7, R3.
- **Wave 3 — direct-manipulation workflows (M/L):** R2, R5, R6.

Each wave keeps `npm test` green (baseline: 635 passed / 3 skipped, 130 files). Re-evaluate against benchmarks after each wave; iterate until all six families reach excellent.

---

## Round 2 — post-overhaul re-evaluation (2026-05-29)

Same multi-agent method re-run against the overhauled code, adversarially verified (verdict: **defensible/needs-adjustment**, confidence 0.78 — the verifier found the product is *better* than the raw scorecard implies: per-project change-history and a per-member utilisation column already exist, so a couple of "partials" are not real).

| Benchmark | Baseline | After Waves 1–3 | Excellent | Status |
|---|---|---|---|---|
| Task Success | 77.5% | **92.5%** (verifier: ~95%) | ≥95% | ✅ at/near |
| Task Time eff. | 0.64 | **0.76** | ≥0.80 | ◐ close |
| SUS | 76.9 | **82.6** | ≥80.3 (A) | ✅ Grade A |
| SUPR-Q | 73.75 | **83.5** | ≥90 all subscales | ◐ (loyalty binding) |
| NPS | 0 | **50** | ≥50 | ✅ at threshold |
| CSAT | 77.5% | **84%** | ≥85% | ◐ −1 |

Per-persona after Waves 1–3: Product Owner SUS 85 / SUPR-Q 87, Scrum Master 84/84, Portfolio Owner 82.5/84, **Customer 79/79** — the Customer persona is the single binding constraint on every aggregate.

### Wave 4 — Customer persona + appearance (this round)
- **R1** Customer (read-only) view mode: header toggle curates the sidebar to Portfolio/Roadmap/RAID/Metrics/Governance, hides create/export affordances, shows a read-only banner; persisted via `uiStateSet`.
- **R2** Value reframed from raw "X/Y SP" to a plain-language **"Work delivered %"** progress bar (SP demoted to tooltip).
- **R3** Customer Pack + Customer Roadmap exports surfaced on the Portfolio Overview header (were only in Governance/Roadmap).
- **R6** One-line **cross-portfolio health** summary on Portfolio Overview ("health word — N active, X% on-track, at-risk, blocked, severe risks").
- **R7** Global 24px minimum target size on small buttons (WCAG 2.5.8).
- **R12** Persistent "Viewing all customers" pill in RAID when cross-portfolio scope is on.
- **R14** Lightened dark-mode muted text for AA contrast.
- Skipped as **stale/already-built** (verifier-confirmed): R5 (inline change-history exists), R4 (utilisation column exists), R13 (non-bug), parts of R3.

Wave 4 targets the Customer persona's SUS/loyalty/CSAT and SUPR-Q appearance. SUPR-Q ≥90 on *every* subscale (esp. loyalty) is an aspirational bar that reflects emotional attachment as much as UI; the remaining gap is tracked honestly rather than asserted closed.
