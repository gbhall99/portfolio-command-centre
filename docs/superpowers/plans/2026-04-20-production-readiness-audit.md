# Production Readiness Audit — `audit-f-nnn-data-integrity`

> **For agentic workers:** This is an audit+fix plan, not a feature plan. Tasks alternate
> between review passes (code-review, frontend-design) and targeted fixes until a
> go/no-go release decision is defensible.

**Goal:** Decide whether branch `audit-f-nnn-data-integrity` (11 commits, 1478 lines
changed in `index.html`) is safe to merge and release to production, with an
auditable record of what was reviewed, what was fixed, and what residual risk
remains.

**Architecture:** Iterative review loop modelled on Ralph. Each pass: run two
reviews in parallel → synthesise findings → deduplicate against the existing
`USABILITY_TEST_REPORT.md` (30 issues already logged) → fix the subset that is
both **load-bearing for release** and **tractable in a single pass** → re-run
tests and reviews. Stop when the reviews return clean on the slice we own, or
when further fixes require scope the user has not authorised.

**Tech Stack:** Single-file vanilla JS/HTML (`index.html`, ~23,600 lines). Tests:
vitest + jsdom (unit/render) and Playwright + chromium-headless-shell (e2e).

---

## Scope boundary

In scope for this audit:
- Code quality of the 1478-line diff vs `main` (correctness, regressions, data
  integrity, solver invariants, event wiring).
- Visual/UX quality of the surfaces touched by this branch (detail panel,
  team-edit modal, allocation warnings, RAG placement, solver output, priority
  chips).
- Test suite must remain green (currently 61 unit + 5 e2e = 66 pass).

Out of scope (explicitly):
- The 30 pre-existing issues catalogued in `USABILITY_TEST_REPORT.md` that were
  not introduced by this branch. Those are acknowledged as known residual
  risk and do not block release of *this* branch — they block a future
  "reconciliation sprint" the report itself recommends.
- Architectural rewrites (e.g. splitting the single-file app) — they are neither
  requested nor safe to smuggle into a release audit.

The audit asks "is this branch safe to merge?", not "is the whole app perfect?".
Conflating the two would make every release impossible.

---

## Task 1: Baseline

**Files:** none (evidence only)

- [x] **Verify tests pass on the branch head** — 61 unit + 5 e2e passed before
      audit began, so regressions introduced during fixes are detectable.
- [x] **Survey diff vs main** — 11 commits, 1478 insertions / 303 deletions in
      `index.html`; snapshot updates in two test files.
- [x] **Read `USABILITY_TEST_REPORT.md`** — understand what's already logged so
      new findings can be deduplicated.

## Task 2: Code review pass

**Files:** none created; findings logged in conversation.

- [ ] **Dispatch `code-review` skill** against the diff vs `main`.
- [ ] **Capture findings** under these buckets: correctness bugs, data-integrity
      regressions, solver-invariant risks, event-wiring leaks, performance
      cliffs.
- [ ] **Cross-reference against `USABILITY_TEST_REPORT.md`** — mark each finding
      as "new (introduced by branch)", "pre-existing (logged in report)", or
      "pre-existing (not logged)".

## Task 3: Frontend-design review pass

**Files:** none created; findings logged in conversation.

- [ ] **Dispatch `frontend-design` skill** focused on the surfaces this branch
      touches: detail panel, team-edit modal, RAG repositioning, allocation
      warnings, priority chip, unsaved-changes warning.
- [ ] **Capture findings** under these buckets: visual hierarchy, contrast,
      density, affordance clarity, motion, responsive behaviour.
- [ ] **Cross-reference** same way as Task 2.

## Task 4: Synthesise + prioritise

**Files:** none created; produces a fix shortlist in conversation.

- [ ] **Deduplicate** findings across the two reviews.
- [ ] **Score** each by (a) was it introduced by this branch and (b) does it
      actively mislead the user or corrupt data.
- [ ] **Shortlist** only the findings that score "yes" on both — those are the
      release blockers for *this* branch. Everything else is a ticket, not a
      fix in this session.

## Task 5: Targeted fixes

**Files:** `index.html` (single-file app).

- [ ] **For each shortlisted finding**, make a minimal, surgical edit.
- [ ] **Run `npm test`** after each fix — if any test fails, revert and
      investigate before proceeding.
- [ ] **No scope creep** — a fix for finding F is not an invitation to clean up
      adjacent code. The audit trail has to stay readable.

## Task 6: Re-run reviews

**Files:** none.

- [ ] **Dispatch `code-review` and `frontend-design` again** against the
      post-fix state. Confirm the shortlisted findings are resolved and no new
      findings have been introduced.

## Task 7: Go / no-go

**Files:** update the audit report with a final decision block.

- [ ] **If reviews return clean on the shortlist**: declare the branch
      release-ready, state the residual risks explicitly (pointer to the 30
      pre-existing issues), and hand back to the user.
- [ ] **If reviews surface new criticals introduced by fixes in Task 5**: loop
      back to Task 4 with the new findings. Hard stop at 3 full iterations —
      beyond that, the fix set is the wrong shape and the user needs to weigh
      in.
- [ ] **If the user pulls the plug at any point**: commit what's clean, report
      honestly, stop.

---

## Final audit record — 2026-04-20

**Iteration 1 — code-review + frontend-design, both passes complete.**

Issues scored 25 or higher:

| ID | Severity | Source | Status |
|----|---|---|---|
| K — `Sprint.recomputeCapacity` reads wrong sprint-override key (`available_points_per_sprint` vs `available_points`) | 75 | code-review | **Fixed** (index.html:15491) + regression test |
| C — `evaluateRagRules` silently deletes reasoned overrides when rule temporarily agrees | 75 | code-review | **Fixed** (index.html:6822) + 2 regression tests |
| D — Gantt labels-resizer `mousemove` can leak on document if `mouseup` never fires | 75 | code-review | **Fixed** (index.html:13737–13767) with `blur` + `pointercancel` + explicit mouseup cleanup |
| Moderate — allocation-results banner uses hard-coded hex, breaks in dark mode | moderate | frontend-design | **Fixed** (index.html:17972–17976) by routing through `--tint-*-weak` + `--status-*` tokens |
| F/J — `onRagClick` writes legacy boolean instead of canonical shape | 25 | code-review | Deferred — rare edge (user clicking already-active RAG); helpers handle the legacy shape. Logged, not fixed. |
| B — `ragOverrideCount()` not customer-scoped | 0 | code-review | False positive — function is defined but never called. |
| E — Gantt sub-row stamping regex | 0 | code-review | False positive — regex is safe for the rendered markup. |

**Iteration 2 — re-review.** One residual found (Fix 3 left the `{ once: true }` mouseup listener intact on fallback paths). **Fixed.**

**Tests:**
- Before: 61 unit/render + 5 e2e = 66 pass
- After: 64 unit/render + 5 e2e = 69 pass (added 3 regression tests in `tests/unit/audit-fixes.test.mjs`)

**Release decision: GO — conditional.**

*Branch `audit-f-nnn-data-integrity` is safe to merge given the following caveats:*

1. The 30 issues in `USABILITY_TEST_REPORT.md` (9 Critical, 8 High, 9 Medium,
   3 Low) are **pre-existing** and explicitly out-of-scope for this audit.
   They do not block this branch, but they mean the app's overall usability
   rating (5/10 per the report) is unchanged. A separate reconciliation sprint
   is recommended — in particular I-18 (Set Baseline persistence), I-20 (three
   sprint-load numbers), and I-21 (skill_splits have no assignee) are
   trust-layer gaps that any PO/SM will hit within an hour.

2. The fixes above address bugs **introduced by this branch**. No attempt was
   made to re-verify all 1478 lines beyond the issues surfaced by the two
   reviews; it is statistically likely other issues exist that weren't scored
   ≥25 in the code-review gate.

3. No changes to the solver's R1–R12 invariants, scoring, or data model. All
   existing regression tests unaffected.

4. Commit was **not** performed automatically — user authorisation required per
   the project's safety defaults.

---

## Self-review (checklist, not subagent)

- **Coverage**: the plan reviews the diff this branch actually introduces, not
  the whole app. ✔
- **No placeholders**: every task has a concrete action and a concrete gate. ✔
- **Iteration bound**: loop terminates after 3 full passes even if the reviews
  keep finding issues — this prevents the Ralph loop from running forever. ✔
- **Honest framing**: the audit explicitly excludes the 30 pre-existing issues
  and says so, so the release decision is not wrongly gated on a backlog the
  user didn't ask this session to clear. ✔
