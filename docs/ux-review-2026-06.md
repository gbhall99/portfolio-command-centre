# Velocity — UX walkthrough & improvement backlog (Jun 2026)

A view-by-view visual walkthrough of every page, assessed against the app's **user
personas**. The product is already mature — the toolbar is fully labelled, the RAID
tables carry variance-gated severity chips, the metrics grid has a deliberate
horizontal-scroll affordance, RACI badges have hover tooltips, empty states use a
shared family, and keyboard/ARIA support is broad. So this is a *polish* backlog,
not a redesign.

## Personas considered
- **P1 — Portfolio Lead** (primary): portfolio health, prioritisation, capacity, plans, commercials.
- **P2 — Delivery / Project Manager**: per-project delivery, RAID, sprints, board.
- **P3 — Executive / Account Sponsor**: customer-facing health, reports, commercials.
- **P4 — Consultant / Team Member**: "what am I assigned to?", capacity.
- **P5 — Commercial / Finance**: billing, margins, quotes.

## Prioritised list

### P0 — real dead-ends / first-run friction (fixed in this PR)
1. **Activity feed dead-ends when the time window hides everything** *(P1/P2)* — with a
   non-empty log but the default "Last 7 days" window (or a narrow source/search),
   the feed showed only "No activity matches your filters" with no way forward.
   **Fixed:** the empty state now counts entries outside the window and offers a
   one-click **Show all time** (preserving source/search), or **Clear filters** when
   a source/search filter is the cause. The genuinely-empty log keeps its plain
   message.
2. **Bare empty states give new customers nothing to act on** *(P1 onboarding)* — the
   Products view showed plain grey text. **Fixed:** Products now renders an
   actionable empty state (icon + one-line explanation + a primary "Add the first
   product" CTA), reusing the shared `.portfolio-empty` family. This is the pattern
   to extend to the remaining empty views (see P1.3).

### P1 — worthwhile, deferred (needs care or a product decision)
3. **Roadmap rows for unscheduled projects are blank and unexplained** *(P2)* — projects
   with no start/target date draw no bar and give no reason. A muted "no dates — set
   schedule" affordance in the row would close the loop. *Deferred:* touches Gantt
   bar geometry; wants a careful, separately-tested change.
4. **Board cards show "Nd in status" and "Nd idle" which are often identical** *(P2)* —
   two conceptually-distinct metrics that read as redundant noise when equal.
   Collapse to one chip when they match, or relabel. *Deferred:* low-risk but wants a
   visual-regression pass.
5. **Extend the actionable empty-state pattern** *(P1)* to Backlog "Unrefined (0)",
   Documents "recent exports", and the historical-Activity case, mirroring fix #2.

### P2 — clarity for exec / cross-functional readers
6. **RAID Risk severity is variance-gated** *(P2/P3)* — the Score column hides when every
   risk shares a score, so a uniformly-high-risk portfolio reads as undifferentiated.
   Consider always showing severity for the Risks tab. *Deferred:* deliberate design;
   needs a product call.
7. **Metrics RACI grid pushes Dimensions…Updated behind a horizontal scroll** *(P3)* at
   common widths. A sticky first column or a compact-density toggle would keep the
   right-hand columns discoverable.
8. **Personas RACI letter badges (A/R/C/I + counts) are explained only on hover** *(P3)*
   — a one-line legend above the table would make the matrix self-describing for an
   exec skimming it.

### P3 — minor polish
9. **Board "Blocked" column sits off-screen at 1440px** (7 statuses) — works via
   horizontal scroll; a subtle "scroll for more" cue would help discoverability.
10. **"View as" / "Data as at"** header chrome is clear; no change needed.

## Fixed in this PR
- P0.1 Activity feed empty-state guidance (`AuditPanel` — `widenToAll` / `clearFilters` + smarter empty branch).
- P0.2 Actionable Products empty state.

Both are covered by unit tests; the remainder are tracked here as the prioritised
backlog.
