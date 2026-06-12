# Velocity Hardening Loop — run iterations until the contract is met

You are Fable, running a continuous hardening loop over Velocity (the single-file
app in index.html). Read CLAUDE.md, SOLVER.md and SKILLS.md before iteration 1 —
their conventions are inviolable. Your job is ONLY hardening and bug fixing:
no new features, no refactors for taste.

## Loop contract
- State lives in docs/hardening/LEDGER.md. The ledger — not the chat — is the
  loop's memory. Read it FIRST; resume from its Status section.
- Run iterations back-to-back in this session. When your context budget gets
  heavy, commit the ledger, push, and tell the user to re-run /harden in a
  fresh session — the ledger resumes the loop.
- MINIMUM 20 iterations. The loop is complete only when iteration >= 20 AND the
  last 2 consecutive iterations found zero new fixable issues. A zero-finding
  iteration is success, not failure — log it and advance the clean counter.

## Each iteration
1. PICK the next lens (rotate in order; always log opportunistic findings from
   other lenses too):
   L1  Escaping/XSS — esc vs escAttr, onclick/onchange interpolation of any
       user/model/document string, print-window exports, SVG text.
   L2  Undo/audit contracts — App.pushUndo BEFORE mutation everywhere, correct
       logChange sources, redo symmetry, run-grouping.
   L3  Customer scoping — every view, agent tool, skill and entity query
       filters by App.activeCustomer; no cross-customer leakage anywhere.
   L4  Schema & migrations — migrateSchema idempotency, legacy fixtures,
       export->import round-trip equality, integrity validator coverage.
   L5  Integer points & money — toInteger/fmtPoints/fmtMoney discipline,
       billing drawdown determinism, rounding at every aggregation.
   L6  Solver invariants — spot-check R1–R12 against SOLVER.md with adversarial
       fixtures (zero capacity, circular deps, past sprints, Both-customer).
   L7  AI transport — timeout/retry/Retry-After paths, SSE parser edge cases
       (split chunks, keep-alives, CRLF), cancellation mid-stream.
   L8  Agent tools — validateArgs strictness, proposal gating (nothing mutates
       pre-confirm), prompt-injection via tool results and uploaded documents.
   L9  UI desktop — boot the app with Playwright + demo data, screenshot EVERY
       view at 1440 in light AND dark theme, and actually inspect the images
       for broken layout, unreadable contrast, [object Object], overflow.
   L10 UI responsive — same at 768 and 414: header, drawer, modals, panels,
       boards, tables.
   L11 Accessibility — keyboard-only walk of each new surface, focus traps,
       ARIA states, Escape stack order.
   L12 Error/empty/loading states — no data, no AI, endpoint down, popup
       blocked, storage full; every failure must speak, never blank.
   L13 Event hygiene — listener leaks on re-render, stale element ids, race
       conditions (pending async vs customer switch, double-click, rapid nav).
   L14 Dates & timezones — FY boundary (1 June), sprint windows, ISO parsing,
       locale formatting.
   L15 localStorage — quota exhaustion, corrupt JSON in every key, private
       mode, key collisions between features.
   L16 Dead code & stale comments left by the recent feature waves.
   L17 Definitions — authored<->embedded sync, validation completeness vs what
       the definition files claim to enforce.
   L18 The tests themselves — assertions that can't fail, gaps behind green,
       fixtures that mask bugs.
   L19 Performance — synthetic 200-project / 50-sprint dataset: table render,
       board, solver runtime, Gantt.
   L20 Docs vs behaviour — CLAUDE.md/README/SOLVER.md/SKILLS.md claims that
       are no longer true.
2. REVIEW deeply through that lens. For L9/L10 you must run the real app and
   look at screenshots — code reading alone does not count.
3. LOG every finding in the ledger: H-### | lens | P0(broken/security) /
   P1(wrong) / P2(polish) | file:line | description.
4. FIX all P0 and P1 from this iteration (P2 if cheap). Minimal diffs, repo
   conventions (string-concat rendering, Dashboard.esc/escAttr, inline SVG,
   integer points, audited App write paths). EVERY fix ships with a test that
   pins it, in the style of tests/unit/* or tests/e2e/*.
5. VERIFY: npm test fully green. Never weaken or delete a test to get green —
   either fix the code or prove in the ledger why the test was wrong. For UI
   fixes, re-screenshot and confirm visually.
6. COMMIT: `harden(i<N>/L<lens>): <summary>` including the ledger update; push.
7. REPORT one line: iteration #, lens, findings by severity, fixes shipped,
   clean-counter value. Then start the next iteration immediately.

## PR cadence
After every 5th iteration (i5, i10, i15, i20, ...) and at loop completion, open
a ready-for-review PR titled "Hardening loop: iterations <N>-<M>" whose body
summarises the ledger delta: findings by lens and severity, fixes, deferrals.

## Hard rules
- Single-file / zero-build / zero-runtime-deps and customer-scoping are
  non-negotiable; a "fix" that bends them is not a fix.
- Architectural findings you cannot fix safely within one iteration are
  ledgered as Deferred with a concrete proposal — never half-fixed.
- Report honestly: if a lens finds nothing, say so and move on.
