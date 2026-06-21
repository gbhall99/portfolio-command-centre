# Hardening Loop — Ledger

The persistent memory of the /harden loop (see .claude/commands/harden.md).
Updated and committed every iteration. Do not edit by hand mid-loop.

## Status
- Last completed iteration: 1
- Next lens: L2 (undo/audit contracts) — but FIRST finish open L1 items H-002..H-005
- Consecutive clean iterations: 0
- Last PR batch: none (next PR at i5)
- Loop complete: no (contract: >= 20 iterations AND 2 consecutive clean)
- Note: running on branch claude/dreamy-brown-5tpxqt (PR #70) by user request;
  hardening commits share that PR.

## Lens coverage
| Lens | Visits | Last iteration |
|---|---|---|
| L1 | 1 | 1 |
| L2–L20 | 0 | — |

## Findings register
| ID | Iter | Lens | Sev | Location | Description | Status | Commit |
|---|---|---|---|---|---|---|---|
| H-001 | 1 | L1 | P1 | index.html Personas._renderRichTable (≈11446/11481/11499) | Free-text (persona role_title, RACI metric names, definition) interpolated into `title="…"` via `esc()`, which does not encode quotes → attribute breakout → stored XSS via imported/model data. Fixed: use `Dashboard.escAttr` for the attribute value. Pinned by tests/render/persona-escaping.test.mjs (jsdom DOM-level breakout assertion). | Fixed | (this commit) |
| H-002 | 1 | L1 | P1 | index.html ≈12967 (objective desc), ≈13924/13928 (metric RACI pill name/role), ≈13954 (metric definition), ≈14197 (RACI matrix col head persona name/role_title) | Same bug class as H-001 in other Strategy `title="…"` sinks. Display-only; convert `esc`→`escAttr` for the attribute value, add per-sink DOM tests. | Open (next iteration) | — |
| H-003 | 1 | L1 | P1 | index.html free-text `value="…"` inputs via esc() — e.g. ≈8929 (customer name), ≈10835 (holiday name), ≈11720 (persona field), ≈11776 (business question), ≈13329/13332 (product name/owner), ≈12571 (person field), ≈13114 (objective field) | esc() in `value="…"` lets a quote break out and inject e.g. `onfocus`. Higher regression risk than display attrs — must verify the input still round-trips after escAttr. | Open | — |
| H-004 | 1 | L1 | P2 | index.html `alt="…"`/`data-…="…"` via esc() — e.g. ≈8917 (customer name alt), ≈8659 (data-capmember member name) | Same class, lower severity (alt/data rarely script-bearing but still breakout-able). | Open | — |
| H-005 | 1 | L1 | P1 | index.html single-quoted inline handlers passing free-text ids/names — e.g. ≈11445/11492 `Person._openDetail('"+esc(id)+"')` | `esc()` does not encode `'`; an id/name containing an apostrophe breaks out of the JS string in onclick. Prior passes used index-based handlers elsewhere; audit Strategy handlers for the same and convert. | Open | — |

## Deferred / wontfix log
| ID | Reason / proposal |
|---|---|
| — | — |

## Notes for the next session
- L1 is a SYSTEMIC finding: `esc()` (textContent→innerHTML) encodes `< > &` but NOT
  `"` or `'`. Anywhere free-text/imported/model data lands inside a quoted HTML
  attribute or a quoted inline-handler string, it must use `Dashboard.escAttr`
  (attributes) or an index-based handler (onclick/onchange). Continue H-002..H-005
  before rotating to L2; each fix ships a jsdom DOM-level breakout test.
- Controlled enums (status, lifecycle stage, country, sprint id, skill key) in
  attributes are NOT findings — they cannot contain quotes.
- Verification: `npm run test:unit` (vitest) is the fast gate here; full `npm test`
  also runs Playwright e2e (needs chromium-headless-shell).
