# Workstream G — Align the add-project wizard UI/UX — design

**Date:** 2026-06-05
**Branch:** `wsG-wizard-ux`
**Context:** User request — "fully evaluate the add-new-project wizard and align the UI and UX to the rest of the app." Chosen depth (brainstorming): **Restyle + UX polish** — keep the 3-step flow & fields; rebuild the chrome on the app's conventions, replace hardcoded sizes/colours with `:root` tokens (dark-mode correct), standardise the form fields, and fix interaction gaps. **No flow/field redesign.**

**Scope:** Single-file `index.html` — `DetailPanel._openCreateWizard` (~line 22939) and its render helpers, plus a small block of new CSS and one `App.dismissTopModal` entry. No framework/build. `:root` tokens, inline SVG, no emojis, `Dashboard.esc()`. Gated by `npm test` + in-browser verify (light + dark).

## Evaluation findings (current state)

The wizard is a 3-step modal (Identify · Scope & value · Delivery shape) built with bespoke inline styles:
- Form fields repeat `font-size:11px/12px; padding:6px 8px; border:1px solid var(--border-light); border-radius:var(--radius-sm)` on every input/select; labels are `font-size:11px;font-weight:600`. Denser and smaller than the app's standard forms (the holiday form/detail panel use `--fs-sm` 13px, token borders).
- Step pills hardcode `#f1f5f9` (inactive bg) and `rgba(59,130,246,0.15)` (active bg) → not tokens, wrong in dark mode.
- Dividers use `--border-light` rather than the app's `--border-dim` convention.
- Backdrop click closes the wizard (line ~23066) — risks losing multi-step input.
- Esc does **not** close the wizard (`createWizard` isn't registered in `App.dismissTopModal`), unlike every other modal.
- The backdrop (`rgba(15,23,42,0.55)`), card surface/shadow/radius, role=dialog/aria-modal, and `.btn` footer buttons are already app-consistent — keep them.

## G1 — Card chrome token alignment

Keep the standard backdrop and the 640px card (a multi-step form, wider than the 380px `.team-edit-modal`). Token-align: header/footer divider borders `var(--border-light)` → `var(--border-dim)`; confirm surface/shadow/radius use tokens (they already do). No structural change to the card.

## G2 — Standardised form fields (shared classes)

Add two CSS classes (defined once, near other modal/form CSS) using tokens:

```css
.wiz-label { font-size: var(--fs-xs); font-weight: 600; color: var(--text-dark); }
.wiz-input { width: 100%; margin-top: 2px; padding: 6px 8px; border: 1px solid var(--border-dim); border-radius: var(--radius-sm); font-size: var(--fs-sm); background: var(--surface); color: var(--text-dark); box-sizing: border-box; }
```

Apply `class="wiz-label"` to every wizard field label and `class="wiz-input"` to every wizard `<input>`/`<select>` across all three steps, removing their inline `style="font-size…;padding…;border…"` attributes. This gives consistent 13px token-based fields that render correctly in dark mode, matching the holiday form and detail panel. (The two-column grid in Step 1 and single-column rows in Steps 2/3 stay; only the field styling is standardised.)

## G3 — Consistent stepper

In the `stepPill(n, label, active)` helper, replace the hardcoded colours with tokens:
- active: background `var(--accent-soft)`, color `var(--accent)`;
- inactive: background `var(--surface-inset)`, color `var(--text-muted)`.

Keep the pill shape/size. This matches the RAID/Governance tab-count styling and works in dark mode.

## G4 — Interaction polish

- **Esc-to-close:** register the wizard in `App.dismissTopModal` — add, after the holiday-overlay check, `const cw = document.getElementById('createWizard'); if (cw) { DetailPanel._closeCreateWizard(); return true; }`. (The global keydown handler already calls `dismissTopModal()` on Escape.)
- **Backdrop click does NOT close** (deliberate divergence to protect multi-step input): remove the `overlay.addEventListener('click', …_closeCreateWizard())` line (~23066). The × button and Esc remain the close paths.
- **Focus:** keep the existing focus-on-open of `#cwName`.
- **Validation messaging:** the Step-1 mandatory checks (name/customer/size, in `_wizardNext`/`_confirmCreateWizard`) should surface errors consistently with the app — use a token-based inline error style (`color: var(--status-red)`, `font-size: var(--fs-2xs)`) rather than ad-hoc/alert. If validation currently uses `App.toast`, keep the toast but ensure invalid fields get a visible `--status-red` border; if it uses no visible cue, add a small inline error line under the offending field. Keep behaviour (Next/Create blocked until valid) unchanged.
- **Spacing:** field-row gaps/margins use `var(--space-*)` tokens (e.g. the `margin-bottom:10px` rows → `var(--space-3)`), for 8pt consistency. Cosmetic; no layout change.

## Testing

- **Render tests** (`tests/render/wizard-ux.test.mjs`): opening the wizard yields fields carrying `.wiz-input`/`.wiz-label` (and no inline `font-size:11px` on fields); the step pills use token colours (assert no literal `#f1f5f9`/`rgba(59,130,246,0.15)` in the wizard HTML); `App.dismissTopModal()` closes the wizard (overlay removed, `_cwState` reset); the wizard does NOT register a backdrop-close listener (clicking the overlay leaves it open — assert overlay still present after an overlay click, or assert the listener is absent by behaviour).
- **Regression:** `tests/unit/phase4-wizard.test.mjs` stays green (3-step flow, Add-details-later, template suggestions, per-field Add-later all unchanged). Full `npm test`.
- **Visual:** in-browser, open the wizard (light + dark): fields match the rest of the app (13px token inputs); stepper readable in dark; Esc closes; backdrop click does not; Step-1 validation blocks Next with a clear cue; "Add details later" and template suggestions still work.

## Out of scope

- No change to the 3 steps, the fields, the template-suggestion logic, the "Add later" affordances, or `App.addProject`.
- F (Objectives/Products), D (RAID), E (Reports/packs) — their own workstreams.
