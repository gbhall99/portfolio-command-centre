# Hardening Loop — Ledger

The persistent memory of the /harden loop (see .claude/commands/harden.md).
Updated and committed every iteration. Do not edit by hand mid-loop.

## Status
- Last completed iteration: 3
- Next lens: still L1 — finish open items H-003 (value= inputs), H-004 (alt/data),
  H-005 (handler ids), then rotate to L2 (undo/audit contracts).
- Consecutive clean iterations: 0
- Last PR batch: none (next PR at i5)
- Loop complete: no (contract: >= 20 iterations AND 2 consecutive clean)
- Note: now running on branch claude/security-hardening-dpkwh8 (fresh from main;
  H-001 + ledger already merged via PR #70). Hardening commits push here.
- Gate note: full vitest suite ≈15 min. Per-iteration fast gate = targeted +
  render-tier tests; full `npm test` reserved for PR checkpoints (i5/i10/…).

## Lens coverage
| Lens | Visits | Last iteration |
|---|---|---|
| L1 | 3 | 3 |
| L2–L20 | 0 | — |

## Findings register
| ID | Iter | Lens | Sev | Location | Description | Status | Commit |
|---|---|---|---|---|---|---|---|
| H-001 | 1 | L1 | P1 | index.html Personas._renderRichTable (≈11446/11481/11499) | Free-text (persona role_title, RACI metric names, definition) interpolated into `title="…"` via `esc()`, which does not encode quotes → attribute breakout → stored XSS via imported/model data. Fixed: use `Dashboard.escAttr` for the attribute value. Pinned by tests/render/persona-escaping.test.mjs (jsdom DOM-level breakout assertion). | Fixed | (this commit) |
| H-002 | 1 | L1 | P1 | index.html ≈12968 (objective desc), ≈11596 (persona-chip role_title), ≈13925/13929 (metric RACI pill name/role), ≈13955 (metric definition), ≈14198 (RACI matrix col head persona name/role_title), ≈20104 (strategy-picker derived `via`) | Same bug class as H-001 in other Strategy `title="…"` sinks. Fixed: `esc`→`Dashboard.escAttr` for the seven attribute values. Pinned by tests/render/strategy-escaping.test.mjs (DOM-level breakout on objective description + metric definition + persona RACI pill; escAttr-vs-esc contract guard). | Fixed | i2 |
| H-006 | 2 | L1 | P1 | index.html remaining free-text `title="…"` sinks app-wide via esc() — Gantt p.name (≈26212/27624/27626), capacity tm.name (≈28225/33179), kanban card name/manager/assignee (≈29464/29567/29573/29814/42889), RAID descriptions (≈39406/39412/39417/39560), SoW flag_reason (≈45777), activity old/new value (≈22658), wt-ms-notes (≈28476) | Same bug class beyond Strategy. Fixed: 17 sinks converted to `Dashboard.escAttr` (controlled enums — RAG/status/sprint-id/skill labels/dates/EVM static tips — verified NOT findings, left on esc). Pinned by tests/render/title-attr-escaping.test.mjs (DOM breakout on Gantt pipeline label + bar). | Fixed | i3 |
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
