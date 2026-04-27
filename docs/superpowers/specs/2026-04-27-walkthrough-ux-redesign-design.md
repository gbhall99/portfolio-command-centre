# Walkthrough UX Redesign — Design

**Author**: UX & Graphic Designer (collab w/ Senior Manager Portfolio Owner)
**Date**: 27 April 2026
**Branch**: `walkthrough-ux-redesign` (off `main`)
**Endorsement bar**: After a 30-minute walkthrough, every project's data is current. The interface is so easy that the senior manager doesn't *think* about the tool — they think about the projects. Looks great enough that the MD glances over and says "is that what we use?"

---

## 1. The current state (what's wrong)

The walkthrough overlay today is **section-bundled** — by topic. RAG flips for every project sit in one section, status changes in another, chip-progress in a third, risks in a fourth. Each section is a wide table. To touch one project end-to-end (RAG → status → progress → risks → notes) you scan four different tables in four different parts of the modal.

That's wrong for a manager-led ritual. A weekly walkthrough is **project-by-project**: "right, let's talk about the Metrics Library project — RAG? Risks? Progress? Done. Next project." The current UX forces context-switching by topic, which is what the underlying data shape demands but not what the human meeting demands.

Beyond that, the visual is dense, monochrome, and doesn't reward completion. There's no sense of progress. There's no priority — every project sits next to every other, regardless of whether it's the burning Red one or a steady Green one.

---

## 2. The redesign — three principles

### Principle 1: Project-bundled, not section-bundled
Each project gets a card. Inside the card: that project's RAG (3 dots, click to flip), status, top risks (with Close/Accept), this-week's chip progress (sliders), and a notes textarea. The whole 30-minute meeting becomes "scroll through cards, touch what's changed, move on."

### Principle 2: Priority-ordered
Cards are sorted top-to-bottom by **attention score**. The score is the senior manager's natural weighting:
- 1000 × #Red RAG dimensions
- 500 × (status === Blocked ? 1 : 0)
- 200 × (status === At Risk ? 1 : 0)
- 100 × #Amber RAG dimensions
- 50 × #open risks (capped at 5 per project)
- 25 × #open chips with stale `completed` (>7 days no audit)
- 10 × #days since `last_updated` (capped at 30)
- + (project.size_total) × 0.5 — a tiebreak: bigger projects later in the same band rank above smaller ones
- − 1000 × (lifecycle_stage === 'Run/BAU' ? 1 : 0) — BAU sinks to the bottom

So a Blocked project with two Red dimensions and a high-score risk lands first; a green Implementation in steady state lands near the bottom; a Run/BAU project lands last.

### Principle 3: Earned visual reward
- Cards collapse with a green check after the manager presses **"Reviewed"** on them.
- A persistent progress strip at the top: "12 / 39 reviewed · 27 to go". Fills horizontally as projects are completed.
- Subtle micro-animations: collapsing card slides up, progress strip fills smoothly. No party tricks — just feedback.
- Top-left "Up next" pill names the next un-reviewed project and its score, so the manager always knows what's coming.
- A **Pin** affordance per card (so the manager can keep one open while another is being collapsed); pinned cards stay expanded regardless of Reviewed state.

---

## 3. The visual — design tokens

This builds on the app's existing skill palette and CSS custom properties. No new design system; just careful application of what's already there.

### Card states (background gradient + left-border accent)

| State | Background | Left border | Use |
|---|---|---|---|
| **Critical** (any Red OR Blocked) | `linear-gradient(135deg, var(--tint-red-weak), transparent 50%)` | `4px solid var(--status-red)` | Burning |
| **Watch** (any Amber OR At Risk) | `linear-gradient(135deg, var(--tint-amber-weak), transparent 50%)` | `4px solid var(--status-amber)` | Pay attention |
| **Steady** (all Green AND in-progress/not-started) | `var(--surface)` | `3px solid var(--border-light)` | Quick check |
| **Done** (status complete or all Greens with last_updated < 7d) | `var(--surface-2)` (slightly recessed) | `3px solid var(--status-green)` | Just confirm |
| **Reviewed-this-session** | `var(--surface)` (collapsed) | `3px solid var(--status-green)` (left bar stays as marker) | Hide the body |

### RAG dots
Three pill-shaped dots per row: S / R / Sc. Click cycles Green → Amber → Red → Green. Each click triggers `App.updateProjectRag` and a 200ms colour transition. The colour palette already exists; just apply.

### Lifecycle chip + priority chip
Top of every card: project name + the existing `lifecycleStageChip` + a small new score chip (`Attention 740`) so the manager understands why this card is here.

### Header band
Fixed header inside the modal. Three things, equally weighted:
- **Customer pill** (already exists in app)
- **Progress strip** with count and segmented fill
- **Cohort summary**: "5 critical · 8 watch · 26 steady"

### Footer band
Fixed footer:
- Decisions count · Actions count
- **Save & Close** · **Export minutes** · **Mark walkthrough done**

### Empty / completed states
- When all cards are reviewed, the card list becomes a single celebratory row "All caught up — 39 / 39 reviewed. Generate minutes?".

---

## 4. Card anatomy

```
┌───────────────────────────────────────────────────────────────────┐
│ [✦] Project name           [POC chip] [Attention 740]    [📌] [✓] │  ← Header (click to collapse)
│  ────────────────────────────────────────────────────────         │
│  Status: [Blocked ▼]   RAG:  ●S  ●R  ○Sc      Last updated: 5d   │
│                                                                    │
│  This sprint                                                       │
│   • Data Engineering   [▓▓▓▓░░░░] 12 / 18 SP                      │
│   • Tableau            [▓▓▓▓▓▓▓░] 7 / 8 SP                        │
│                                                                    │
│  Risks (open: 2)                                                   │
│   • Source data delayed (score 16) [Close] [Accept]                │
│   • UAT slot uncertain (score 9)   [Close] [Accept]                │
│                                                                    │
│  Notes                                                             │
│  [_________________________________________________]              │
│                                                                    │
│  [+ Decision] [+ Action]                                           │
└───────────────────────────────────────────────────────────────────┘
```

### Interactions
- **Click card header**: collapses (only when not pinned).
- **✓ Reviewed**: collapses + records `section_status[project.id] = 'reviewed'`. The card persists in the list as a thin one-line confirmation strip ("✓ Metrics Library reviewed · 12:34"). Manager can re-open by clicking.
- **📌 Pin**: keeps card expanded across collapses; pinned cards bubble to a "Pinned" group at the top.
- **Status dropdown**: calls `App.updateProjectStatus`; instant green flash on change.
- **RAG dot click**: cycles G → A → R → G; calls `App.updateProjectRag`.
- **Chip slider drag / type**: calls `App.updateChipProgress` on commit (blur or Enter).
- **Risk Close/Accept**: calls `App.updateRiskStatus`; the risk row gets struck-through and animates to grey.
- **+ Decision / + Action**: opens the small inline form already in the existing decisions section, but scoped to this project (the recorded decision auto-tags `project_id`).

---

## 5. Information density vs. discoverability

The card has a lot in it. Two safeguards:

1. **Compact-by-default**: Steady and Done cards collapse to a one-line summary by default. Critical and Watch cards expand. Manager can override.
2. **Progressive disclosure**: Risks are shown as count + top 2 by default, with a "+ N more" link that expands. Same for chips when there are >4.

---

## 6. Performance & state

- The whole modal still renders synchronously in plain JS.
- Card list uses `Array.sort` on the precomputed score (no virtual scrolling — typical customer has 30 projects max, all fit).
- `App.computeWalkthroughAgenda(customer)` extends with a per-project `attentionScore` field consumed by the new render path.
- Section status `reviewed` per-project is stored on `walkthroughs[i].section_status['proj:' + projectId] = 'reviewed'`. Resumes correctly.

---

## 7. Architecture (helpers + UI)

```
NEW pure helpers (Dashboard or App, side-by-side with existing computes):
  App.computeProjectAttentionScore(project, opts?)
    → number
  App.computeWalkthroughCards(customer)
    → [{ project, attentionScore, ragSummary, status, openRisks, chips, lastUpdatedDays, state: 'critical'|'watch'|'steady'|'done' }]

REPLACED render path (Sprint):
  Sprint.openWalkthrough()  →  uses computeWalkthroughCards instead of section-by-section render
  Sprint._wtRenderCard(card, active)  →  per-card render
  Sprint._wtCycleRag(walkthroughId, projectId, dimension)  →  G→A→R cycle
  Sprint._wtMarkProjectReviewed(walkthroughId, projectId)
  Sprint._wtPinProject(walkthroughId, projectId)
  Sprint._wtTogglePinned(projectId)  →  in-memory; not persisted across sessions

EXTENDED:
  computeWalkthroughAgenda still returns the 9-section data — kept for the minutes builder which already consumes it.
```

The nine-section information is still computed (it feeds the minutes). The user-facing walkthrough is now project-cards. The minutes still work — they read `data_updates`, `decisions`, `actions` and don't care about UI shape.

---

## 8. Testing

| Test file | Coverage |
|---|---|
| `tests/unit/walkthrough-attention-score.test.mjs` | `computeProjectAttentionScore` — Blocked > Red > Amber > size; Run/BAU sinks |
| `tests/unit/walkthrough-cards.test.mjs` | `computeWalkthroughCards` returns correct `state` per card; ordering is by score desc |
| `tests/render/walkthrough.test.mjs` (extend) | Card render contains lifecycle chip, attention chip, RAG dots, status select, chip rows, risk rows, notes textarea |
| `tests/render/walkthrough.test.mjs` (extend) | Pressing "Reviewed" collapses card + sets section_status |
| `tests/e2e/walkthrough.spec.ts` (extend) | Open walkthrough → click ✓ on a card → verify it collapses + minutes section unchanged |

---

## 9. MD-endorsement criteria

1. ✅ One screen, project-bundled cards.
2. ✅ Cards are ordered by attention (highest score first).
3. ✅ Critical / Watch / Steady / Done states are visually obvious in 100ms.
4. ✅ Every data update from yesterday's spec still works inline (RAG, status, chip progress, risk close/accept).
5. ✅ "Reviewed" collapses the card and persists across re-opens.
6. ✅ Progress strip + cohort summary + Up-next pill in the header.
7. ✅ Print/minutes flow unaffected.
8. ✅ All tests green.
9. ✅ The senior manager AND a UX-literate person look at the screen and both say "this is good."

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Cards too dense → manager can't scan | Compact-by-default for Steady/Done; expanded for Critical/Watch |
| Animation feels janky in a single-file plain-JS app | Use only CSS transitions on `max-height`, `opacity`, `background-color`; no JS-driven animation |
| 30+ cards becomes scrolly | Sticky header strip + Up-next pill always visible; "scroll to next un-reviewed" keyboard shortcut: `j` / next, `k` / previous |
| Manager wants the old section view | Not provided. The redesign IS the walkthrough. Section-bundled view available via the existing per-section pages (Capacity, Governance, Backlog) |

---

## 11. Implementation order

1. `computeProjectAttentionScore` (pure helper)
2. `computeWalkthroughCards` (pure helper, ordering + state classification)
3. CSS additions: card states, RAG dots, progress strip, micro-animations
4. Replace `Sprint.openWalkthrough` body with card-based render
5. Card-level handlers (cycle RAG, mark reviewed, pin)
6. Compact-by-default for Steady/Done
7. Header progress strip + up-next pill + cohort summary
8. Tests + E2E + manual smoke
9. Endorsement loop until criteria met
10. Merge to main

---

**Status**: Approved by senior manager (per Auto mode + user instruction). Proceeding to implementation plan.
