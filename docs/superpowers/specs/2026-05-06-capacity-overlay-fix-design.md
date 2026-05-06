# Capacity Overlay z-index Fix — Design

**Date:** 2026-05-06
**Status:** Approved
**Owner:** Gareth
**Scope:** Capacity view — `Sprint Overrides` modal (`teamEditModal`) and `Member Impact` modal (`memberImpactOverlay`)

---

## Goal

Fix a z-index mismatch where the Capacity "Sprint Overrides" modal and "Member Impact" modal can fall behind newer overlays (e.g. the detail panel, sticky headers, or each other when both opened in sequence). Standardise their z-index tier so they're always above every non-modal element and stack predictably when both are visible.

## Non-goals

- Reworking the modal markup or behaviour.
- Migrating modals to a shared mount point.
- Changing the overlay tint colour or backdrop blur.

## Constraints

- Single-file `index.html`. No new CSS file.
- Z-index must NOT exceed the toast container (1000) and the floating Backups/Scenarios modals (10200) — the latter need to layer above sprint-overrides if both are ever open. Practical band: 9000–9200.

## Architecture

Z-index audit (current → proposed):

| Element | Where | Today | Proposed |
|---|---|---|---|
| `.team-edit-overlay` (sprint-overrides backdrop, also reused by forum/dep modals) | line 1512 | 299 | **9000** |
| `.team-edit-modal` (sprint-overrides body) | line 1503 | 300 | **9001** |
| `#memberImpactOverlay` (inline `cssText`) | `Capacity.openMemberImpactModal` | 300 | **9100** |
| `.panel-overlay` (detail-panel backdrop) | line 790 | 200 | unchanged |
| `.detail-panel` | line 794 | 201 | unchanged |
| `.toast-container` | line 448 | 1000 | unchanged |
| Backups / Scenario / Sprint-brief picker overlays | inline | 9000–10200 | unchanged |

The change is two CSS edits + one inline `cssText` edit. No JS logic moves.

## Components

### 1. CSS

```css
/* line 1503 */
.team-edit-modal { … z-index: 9001 … }
/* line 1512 */
.team-edit-overlay { … z-index: 9000 … }
```

### 2. JS — memberImpactOverlay

In `Capacity.openMemberImpactModal` change:

```javascript
overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;…';
```

to:

```javascript
overlay.style.cssText = 'position:fixed;inset:0;z-index:9100;display:flex;…';
```

(z-index 9100 sits above `.team-edit-modal` at 9001 so when the user opens Member Impact while Sprint Overrides is open, the simulator stacks correctly on top.)

## Data flow

No data flow change. Pure CSS.

## Error handling

No new error paths. The fix removes a class of "modal hidden behind something" complaints.

## Testing

### Render snapshot

- Snapshot the existing `team-edit-overlay` and `team-edit-modal` CSS rules (or grep for the z-index value as a guard test).

### E2E

- Open Capacity view; click a sprint header → assert `#teamEditModal` is visible AND in front of any other potentially-covering element (use `.evaluate` to compare `getBoundingClientRect` + check no opaque element overlays with higher computed z-index).
- Open Sprint Overrides, then open Member Impact, then close Member Impact → assert Sprint Overrides is interactive again (input editable).

### Manual smoke

- Open detail panel from the dashboard → switch to Capacity → click sprint header → confirm the Sprint Overrides modal renders fully on top, with the panel overlay greyed beneath. (Hard to cover automatically since the detail panel + capacity view interaction crosses two views.)

## Out of scope

- Z-index discipline pass across the whole app (some inline overlays still use 9000–10200; not unified).
- Replacing window.confirm prompts in the Capacity flow with custom modals.
