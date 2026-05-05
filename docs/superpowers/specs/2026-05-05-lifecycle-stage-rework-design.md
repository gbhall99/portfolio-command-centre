# Lifecycle Stage Rework — Design

**Date:** 2026-05-05
**Status:** Approved
**Owner:** Gareth
**Scope:** Project lifecycle (`lifecycle_stage`), WSJF scoring, detail-panel banners, related UI copy

---

## Goal

Reframe `lifecycle_stage` as **a project's journey** (Idea → Discovery → POC → Implementation → Run/BAU), not a *confidence rating*. Today the model conflates the two: stages below Implementation incur a numeric WSJF penalty, the chip is labelled "Project conviction class", and the only way to clear the penalty is a "Convert to Implementation" action that also auto-snapshots the baseline. This misframes the data — a Discovery is a deliberate, resourced phase, not a low-confidence project. And a POC graduating to a full project is **knowledge increasing**, not scope creep.

After this rework:

- Stage is informational. WSJF + MoSCoW + hard_deadline already encode urgency and value; stage doesn't modify the score.
- Promoting a project from POC → Implementation is the **same project** continuing — no scope-creep flag, no audit hand-wringing.
- Baseline is decoupled from stage transitions: when stage changes the user is *prompted* to re-set baseline, but baseline is otherwise a manual action available at any time.
- Stage list trims `Phase-1 Build` (it overlapped with Implementation; subsequent delivery phases live in `phase_status` / `delivery_config.phase_order`).

## Non-goals

- Changing the WSJF formula itself (only removing the lifecycle penalty term).
- Reworking phase-level tracking (`phase_status`, delivery pipeline) — that lives in a different spec.
- Cross-project predecessor links (a POC closing and a new project being created with `predecessor: <pocId>`). Decided against during brainstorming — same-project transition with re-baseline.
- A historical baseline log (multiple baselines per project). Single baseline only; user re-sets when needed.

## Constraints

- Single-file `index.html`. No new dependencies.
- All writes through `App.updateProject(id, field, value)`.
- Story points / dates use existing helpers (`App.toInteger`, `Dashboard.esc`, ISO YYYY-MM-DD).
- No emojis. Inline SVG icons only.
- Schema migration: `migrateSchema` must coerce legacy `'Phase-1 Build'` values to `'Implementation'` so existing data parses cleanly.
- Audit log must record stage transitions with the previous + new value, retaining the existing `App.logChange` shape.

---

## Architecture

```
                          ┌─────────────────────────────┐
                          │  App.LIFECYCLE_STAGES        │
                          │  ['Idea','Discovery','POC',  │
                          │   'Implementation','Run/BAU']│
                          └──────────────┬──────────────┘
                                         │
                                         ▼
   App.advanceStage(id, nextStage)  ── App.updateProject (audit + save)
                                         │
                                         └─→ optional baseline re-set prompt
                                              (DetailPanel)
                                         │
                                         ▼
                              Project.lifecycle_stage
                                         │
        ┌────────────────────────────────┼─────────────────────────────┐
        ▼                                ▼                             ▼
   Detail-panel header chip       Dashboard column ('lifecycle')   Reports / Backlog buckets
   (label: "Lifecycle: Discovery")    (opt-in via picker)           (no "conviction" copy)
        │
        ▼
   Stage-aware banner
   ("Currently in Discovery — set or
    update the baseline when scope is
    firm enough to track")
```

`App.lifecycleConvictionPenalty` is **deleted**. `App.calculateScore` and `App.calculateWsjf` no longer call it. The Run/BAU -1000 special case migrates into a **status filter**: Run/BAU projects are excluded from active scoring views (they were effectively bottom anyway).

## Data model

`lifecycle_stage`: enum string. Values:

| Old | New |
|---|---|
| `Idea` | `Idea` |
| `Discovery` | `Discovery` |
| `POC` | `POC` |
| `Phase-1 Build` | **migrated → `Implementation`** |
| `Implementation` | `Implementation` |
| `Run/BAU` | `Run/BAU` |

Default for legacy projects (and new): `Implementation` (unchanged).

No new fields. `baseline_start / baseline_end / baseline_set_date` remain. The `convertToImplementation` rationale-on-`notes` write is dropped (we don't add notes implicitly any more).

## Components

### 1. Constants and migration

```js
App.LIFECYCLE_STAGES = ['Idea', 'Discovery', 'POC', 'Implementation', 'Run/BAU'];
App.LIFECYCLE_STAGE_DEFAULT = 'Implementation';
```

In `migrateSchema` (or `_ensureSettingsDefaults`-adjacent), add a migration step:

```js
// Lifecycle rework: 'Phase-1 Build' is no longer a stage; collapse to Implementation.
data.projects.forEach(p => {
  if (p.lifecycle_stage === 'Phase-1 Build') p.lifecycle_stage = 'Implementation';
  if (p.lifecycle_stage && App.LIFECYCLE_STAGES.indexOf(p.lifecycle_stage) < 0) {
    p.lifecycle_stage = App.LIFECYCLE_STAGE_DEFAULT;
  }
});
```

### 2. `App.advanceStage(projectId, nextStage, opts)`

Replaces `App.convertToImplementation`. Generic transition that:

- Validates `nextStage` is in `LIFECYCLE_STAGES`.
- Refuses no-op transitions.
- Writes via `App.updateProject(id, 'lifecycle_stage', nextStage)` so audit + undo + save fire.
- Does **not** auto-snapshot baseline. The caller (DetailPanel) handles the "re-set baseline?" prompt separately.
- Returns `true` on success.

Backwards-compat: keep `App.convertToImplementation` as a thin shim that calls `advanceStage(id, 'Implementation')` so existing keyboard shortcuts / external integrations don't break. Mark as deprecated in a comment.

### 3. WSJF / scoring changes

- **Delete** `App.lifecycleConvictionPenalty` and all its callers.
- `App.calculateScore` and `App.calculateWsjf` lose their `- this.lifecycleConvictionPenalty(project)` term.
- Run/BAU exclusion: `App.activeProjects(customer)` (or equivalent) filters out `lifecycle_stage === 'Run/BAU'` from active sort/score views. Reports may still include Run/BAU explicitly.

The score-explainer modal (`App.openScoreExplainer` or similar) drops the "Conviction adjustment" row.

### 4. Detail panel — header chip

Replace "Project conviction class" chip wording. New display: a labelled inline pair next to Status:

```
Status: In Progress       Lifecycle: Discovery
```

Background colour from the existing palette (the `lifecycleStageChip` palette stays the same; just rename the function helper to `lifecycleStageBadge` and remove the `title="Project conviction class"` wording → `title="Lifecycle stage"`).

### 5. Detail panel — banner & action

Replace the conditional "This is a POC. Convert to Implementation when ready to lock scope + auto-baseline." banner with a stage-aware informational strip:

| Stage | Banner copy |
|---|---|
| Idea | `Captured as an Idea — promote to Discovery to start exploring.` |
| Discovery | `Currently in Discovery — set or update the baseline when scope is firm enough to track.` |
| POC | `Currently a POC — set or update the baseline when scope is firm enough to track.` |
| Implementation | (no banner, or shows baseline date if set) |
| Run/BAU | `Running — excluded from active scoring views.` |

Action: replace the "Convert to Implementation" button with an **"Advance stage"** dropdown that defaults to the next stage in the list. On commit:

1. Calls `App.advanceStage(projectId, chosenStage)`.
2. If the new stage is `Implementation` AND the project has unset/old baseline (`baseline_set_date` missing OR older than the current `start_date`), shows a follow-up prompt: `Re-set baseline to current dates?` with `Yes / Skip / Cancel`. Yes calls the existing `DetailPanel.setBaseline(projectId)` (or `App.setBaseline`); Skip closes; Cancel reverts the stage change.
3. For other stages (e.g. Discovery → POC), no baseline prompt.

### 6. Dashboard column

The existing `lifecycle` column (already in `Dashboard.COLUMNS` from the column-picker work) needs:

- `label: 'Lifecycle'` (already)
- `render` returns `lifecycleStageBadge(p)` instead of `lifecycleStageChip(p)` (rename only).
- `edit: { type: 'select', field: 'lifecycle_stage', options: App.LIFECYCLE_STAGES }` so users can change stage from the table directly. (Note: changing stage inline does NOT trigger the baseline prompt; that's detail-panel-only. Inline keeps things fast for bulk re-classification.)

### 7. Reports / backlog / sprint brief copy

Wherever the literal string "conviction" appears in copy or tooltips, replace with "lifecycle" (or omit if redundant). Affected:

- `App.lifecycleStageChip` `title` attribute: "Project conviction class" → "Lifecycle stage".
- Score explainer modal: "Conviction adjustment" row deleted.
- Backlog grouping/labels (if any reference "conviction") → "Lifecycle stage".
- Customer Pack (`buildCustomerPackDoc`) section labels — sweep for "conviction" and replace.

## Data flow

### Stage advance with baseline prompt

```
User opens detail panel for a Discovery project
↓
DetailPanel renders stage chip + banner + Advance-stage <select>
↓
User picks 'Implementation' from dropdown, clicks Advance
↓
DetailPanel.advanceStage(id, 'Implementation')
   ↓ App.advanceStage(id, 'Implementation')
        ↓ App.updateProject(id, 'lifecycle_stage', 'Implementation')   [audit + dirty + save]
   ↓ baseline check: needs re-set?
        ↓ yes → confirmation prompt
              ↓ Yes → DetailPanel.setBaseline(id)   [snapshots dates, audit]
              ↓ Skip → no-op
              ↓ Cancel → revert via App.updateProject(id, 'lifecycle_stage', priorStage)
```

### Score recalc after stage drop

```
User picks Project A's stage from Implementation → POC (downgrade)
↓ App.updateProject writes the field
↓ notifyDataChange triggers Dashboard.applyAndRender
↓ scores re-render — POC no longer subtracts 10 (previously did) so Project A's WSJF is unchanged
                     vs older versions where score would jump by 10 on stage flip
```

This change is the whole point: stage transitions stop creating ranking jolts.

## Migration & rollout

- One-shot migration in `migrateSchema` collapses `Phase-1 Build` → `Implementation`.
- Existing audit-log entries that reference the old stage stay intact (they're historical; no rewrite).
- localStorage data is migrated on next load.
- JSON imports from older versions get the same migration via the standard load pipeline.

## Error handling

| Case | Behaviour |
|---|---|
| `advanceStage` called with invalid stage | no-op, log warn |
| User cancels baseline prompt | stage transition is reverted (single `App.updateProject` undo) |
| Stage selected via inline column edit but writes fail | existing `App.updateProject` error path (toast) |
| Score explainer references the deleted penalty row | guard with `if` so older snapshots in tests still parse |

## Testing

### Unit (vitest)

- Migration: project with `lifecycle_stage: 'Phase-1 Build'` becomes `'Implementation'` after `migrateSchema`.
- `App.advanceStage`:
  - Valid forward transition writes via `updateProject`.
  - Invalid stage rejected.
  - No-op (same stage) returns false.
- WSJF score: project with `lifecycle_stage: 'POC'` and same WSJF inputs as `Implementation` produces the **same** score (penalty removed).
- Active-projects filter: Run/BAU projects excluded from sort views; included in reports.
- `App.lifecycleConvictionPenalty` is undefined / does not exist (regression guard).

### Render snapshot

- Detail panel header for a Discovery project renders `Lifecycle: Discovery` chip + Advance-stage dropdown.
- Banner copy snapshot per stage.

### E2E (Playwright)

- Open detail for a POC, advance to Implementation, accept baseline prompt → assert `lifecycle_stage === 'Implementation'` AND `baseline_start === start_date`.
- Same flow, decline baseline prompt → assert stage flipped, baseline unchanged.
- Same flow, cancel baseline prompt → assert stage reverted.
- Inline column edit: change a project's lifecycle column from Implementation to POC → assert WSJF score stays the same as before.

### Manual smoke

- Filter project table by `lifecycle_stage = Run/BAU`, confirm those projects are visible there but not in score-sorted views.
- Audit log entry for stage transition shows `before → after` with no extraneous note.
- Search for "conviction" in the running app — zero matches.

## Out of scope

- Stage-specific size/effort defaults (e.g. "Discovery defaults to 5 points").
- Auto-promote rules (e.g. "POC complete → propose Implementation").
- Multi-stage baseline history.
- Stage-driven workflow gates (status transitions blocked by stage).
- "Predecessor" cross-project links.
