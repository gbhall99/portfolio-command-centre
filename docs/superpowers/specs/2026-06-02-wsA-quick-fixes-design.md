# Workstream A — Quick correctness fixes — design

**Date:** 2026-06-02
**Branch:** `wsA-quick-fixes`
**Context:** First of five phased workstreams (A→E) addressing an 11-item issue list. A = the small, low-risk correctness fixes. B (sprint window), C (holidays), D (RAID redesign), E (Reports/PDF + packs IA) follow as their own spec→plan→build cycles.

**Scope:** Single-file `index.html` (CSS in one `<style>`, HTML in `<body>`, JS in one `<script>`) plus the two sample-data JSON files. No framework/build. Conventions: inline SVG (no emojis), `:root` tokens (no hardcoded colours where a token exists), `Dashboard.esc()` for user content. Gated by `npm test` + in-browser verification (light + dark, 1440px).

## Items

### A1 — Remove the header power-tools right-edge gradient (issue #1)

The middle-header "power tools" pill `.header-tools` (index.html:398-400) carries a scroll-fade mask:

```css
-webkit-mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 14px), transparent 100%);
        mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 14px), transparent 100%);
```

This fades the pill's right ~14px to transparent, letting the page background show through — the "random gradient on the right" that doesn't match the scheme.

**Fix:** delete both `mask-image` declarations. The pill keeps its `var(--surface-inset)` fill, `var(--border-dim)` border, and pill radius rendered solidly to the edge. `overflow-x: auto` + `scrollbar-width: none` remain as the silent overflow fallback (the cluster rarely overflows; when it does it simply scrolls without a fade cue, consistent with the user's request to align to the colour scheme).

**Verify:** the pill has crisp, uniform edges at common widths in light + dark; no transparent fade on the right.

### A2 — Backfill sample-data priority inputs (issue #5)

The complaint ("missing metric ids and priority ratings") surfaces when viewing default data in the project detail / backlog-health surfaces, which flag a project with reasons `'MoSCoW not set'`, `'not sized'`, `'no WSJF inputs'` (index.html:18600-18603) when its priority inputs are absent.

Finding (probed against both sample files): all 14 projects already have non-empty `metric_ids` and zero dangling metric references; **6 of 14 projects lack** `business_value`, `time_criticality`, `risk_reduction_opportunity`, and `moscow`.

**Fix (data only):** in **both** `portfolio-data.json` and `portfolio-data-demo.json`, for every project currently missing them, add:
- `business_value`, `time_criticality`, `risk_reduction_opportunity` — integers 1–10, sensible and varied per project (not all identical),
- `moscow` — one of `"Must"` / `"Should"` / `"Could"` / `"Won't"`, varied,
and confirm each project retains a non-empty `metric_ids` array.

Keep the two files identical in these fields (demo button fetches `portfolio-data-demo.json`; `portfolio-data.json` is the first-load sample). No code change.

**Verify:** load the demo dataset, open each project's detail panel and the backlog-health view — no `MoSCoW not set` / `no WSJF inputs` / unprioritised reasons appear for any sample project.

### A3 — Detail panel: auto-save, flush on close, no phantom prompt (issue #6)

Fields already auto-save on blur via `App.updateProject`. But `DetailPanel.close()` (index.html ~19044-19071) then recomputes a DOM-vs-stored diff and shows `confirm('You have unsaved changes in: … Close without saving?')`, which fires phantom warnings even when nothing meaningful changed. There is no Save button because saving is automatic.

**Fix (per chosen model "auto-save + flush on close"):**
- Keep the existing step that blurs the focused element inside the panel before closing — that flush commits the in-focus field through the normal auto-save path.
- **Remove the DOM-vs-stored diff block and its `confirm(...)`** so closing never shows the phantom prompt; the panel closes silently after the flush.
- Preserve the genuine-failure signal: the existing storage-full path (index.html ~8752) already toasts independently when a write fails, so a real persistence failure is still surfaced without a close-time confirm. No new warning machinery is added.
- Leave the `beforeunload` guard (index.html:4382) as-is; `isDirty` is cleared by successful auto-save (`markClean`), so it won't false-fire after edits.

**Verify:** open a project, edit several fields (text/number/date/select), close via the × and via Esc — closes immediately with no dialog; reopen and confirm edits persisted; the amber `#unsavedDot` is not stuck on.

### A4 — Remove "show all customers" from the RAID page (issue #7)

RAID currently supports an in-view all-customers scope toggle (`RaidView.showAll`), surfaced as a control in `RaidView.render` and reflected by `App._viewScope('raid')` returning `'all'` when `showAll` is true.

**Fix:** RAID is always customer-scoped.
- Remove the all-customers toggle control from `RaidView.render` (the in-view "show all customers" UI).
- Force `RaidView.showAll = false` (keep the property to avoid touching every reference, but it is never set true) and remove the toggle handler.
- Simplify `App._viewScope('raid')` to always return `'one'` (drop the dynamic `showAll ? 'all'` branch).
- The nav item's `onclick` `RaidView.showAll=false` is now redundant but harmless; leave or remove for tidiness.
- Update affected tests: the `ia-scope-clarity` VIEW_SCOPE dynamic-raid assertions and any `ux-benchmark-wave5` customer-mode toggle assertions that expect the toggle to exist/relabel. RAID data remains filtered to `App.activeCustomer`.

**Verify:** the RAID page shows no all-customers toggle in any mode; rows are scoped to the active customer; switching customer updates RAID.

### A5 — Load screen must not leak empty views beneath it (issue #9)

Structure: `.main-content` contains `.file-loader-screen#fileLoaderScreen` (shown until data loads; `.hidden` added in `onDataLoaded` path at index.html:5806) followed by the `.view` divs (`.view { display:none }`, `.view.active { display:flex }`). With no data loaded, an empty view is rendering beneath the loader (a view gets `.active`, or `navigate()` runs pre-data).

**Fix:** make "no data" a single, authoritative UI state.
- Add a `no-data` body (or `#mainContent`) class set on first paint / whenever `!App.data`, and removed in `onDataLoaded`.
- CSS: `body.no-data .view { display: none !important; }` and keep `.view-titlebar` hidden while in `no-data`.
- Ensure `App.navigate(...)` early-returns (stays on the loader, does not add `.active`) when `!App.data`.
- The exact current trigger that activates a view pre-data will be identified during planning and neutralised; the `no-data` class is the defensive guarantee regardless of trigger.

**Verify:** hard reload with no localStorage session — only the file-loader screen shows (no empty table/headers behind it, no titlebar); after loading demo/JSON, views render normally and the `no-data` state is cleared.

### A6 — Drop-zone / load-screen background alignment (issue #8b)

`.drop-zone` hardcodes `background: white` (index.html:558) sitting on the `var(--bg-content)` (#f5f7fa) canvas of `.file-loader-screen`, so the card reads as a mismatched colour rather than a themed card; dark mode relies on a separate override.

**Fix:** replace hardcoded colours with tokens so the load screen matches every other card surface:
- `.drop-zone` background → `var(--surface)`; border stays the dashed `var(--border-light)`; hover/drag-over tint stays a token-based accent wash.
- Ensure `.file-loader-screen` sits on the app canvas (`var(--bg-content)`) so the card/canvas relationship matches the rest of the app.
- Remove now-redundant hardcoded dark-mode `.drop-zone` background overrides where the token already resolves correctly.

**Verify:** in light and dark, the drop-zone reads as a normal themed card on the app canvas — consistent with cards elsewhere; hover/drag-over still gives clear feedback.

## Testing

- `npm test` green (unit/render + e2e) after each item; update only the tests whose assertions this workstream intentionally changes (RAID scope in A4; any load-screen/`no-data` assertions in A5).
- Add focused unit coverage where behaviour is testable in jsdom:
  - A4: RAID has no all-customers toggle; `App._viewScope('raid') === 'one'`.
  - A5: with `App.data` null, no `.view` is active and the loader is the only visible region; after load, a view activates.
  - A3: closing the detail panel after an edit does not invoke the confirm path and the edit persists.
- A1, A2, A6 are verified visually in-browser (CSS / data); A2 also by confirming no unprioritised reasons fire on sample projects.

## Out of scope (later workstreams)

- Sprint Planning window configurability (B), holidays date pickers + country/city (C), RAID intelligence redesign (D), Reports/PDF parity + packs simplification (E). A4 only *removes* the RAID all-customers toggle; the RAID redesign is D.
