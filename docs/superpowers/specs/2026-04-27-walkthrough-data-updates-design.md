# Walkthrough as Data-Update Ritual — Design

**Author**: Senior Manager (Portfolio Owner)
**Date**: 27 April 2026
**Branch**: feature branch off `main`
**Endorsement bar**: After a 30-minute walkthrough, every project's RAG, completed SP, status, risk-closure decisions, and audit log are current — without anyone having to open a project detail panel separately.

---

## 1. The problem (deeply)

Yesterday's walkthrough enhancement created a 9-section ritual with notes, decisions, and actions. **It captures what was discussed.** It does *not* update the actual project data. That's a governance log, not a data-update ritual.

A senior manager running the weekly review wants to leave the meeting with:

1. Every project's RAG (S/R/Sc) **set to what we just agreed it is** — not what it was a week ago.
2. Every active chip's **completed SP updated** to what the team reports — not stale numbers.
3. Risks **closed, accepted, or re-scored** during the meeting — not still showing yesterday's score.
4. Status changes (e.g. "Project X is now Blocked because dependency Y slipped") **persisted** with rationale.
5. Project-level **notes / sponsor updates** captured against the project, not buried in a session record.
6. **Audit trail** showing who said what, when, and why — already strong, but every data update should hit it with `source: 'walkthrough'`.

If the walkthrough doesn't make these data updates trivially easy, attendees will skip them and the data drifts. The walkthrough has to be the **single weekly forcing function** that brings the whole portfolio current.

---

## 2. Scope (what this delivers)

### In scope — five new data-update inline cells, one per relevant section

| Section | New inline editor | Writes to |
|---|---|---|
| **RAG movers** | Per-project Red/Amber/Green selectors for Schedule, Resourcing, Scope | `project.rag_*` + audit log |
| **Top risks + new** | Per-risk action: Close / Accept / Re-score (impact × probability) | `project.risks_register[i].status` and impact/probability + audit log |
| **Issues & blocked** | Per-project Status dropdown + Unblock button (sets status back to In Progress with rationale) | `project.status` + audit log |
| **Chip progress** | Per-chip "Completed SP" inline number input (replaces opening the chip editor) | `skill_split.completed` + audit log |
| **Capacity & leave** | Notes-only — no auto-mutation; capacity changes go through System Settings | (notes only) |

### Helpers (pure, testable)

```
App.updateProjectRag(projectId, dimension, value, walkthroughId, rationale)
App.updateRiskStatus(projectId, riskIndex, status, walkthroughId, rationale)
App.updateRiskScore(projectId, riskIndex, impact, probability, walkthroughId)
App.updateProjectStatus(projectId, newStatus, walkthroughId, rationale)
App.updateChipProgress(projectId, skillKey, sprintId, completedSp, walkthroughId)
```

Every helper:
- Mutates the project / risk / split.
- Calls `App.logChange` with `source: 'walkthrough'` and the walkthrough id.
- Updates `project.last_updated` to `new Date().toISOString()`.
- Adds the change as a typed entry on `walkthroughs[i].data_updates[]` so the minutes show what was changed.

### Out of scope
- Capacity edits (route to System Settings — different audit semantics).
- Multi-project bulk RAG updates (single-row affordance only).
- Automated RAG inference (we want explicit human attestation each week).

---

## 3. Architecture

```
Existing (yesterday)              New (today)
-------------------------         -------------------------
computeWalkthroughAgenda    +     updateProjectRag
recordWalkthroughDecision   +     updateRiskStatus / updateRiskScore
recordWalkthroughAction     +     updateProjectStatus
completeWalkthrough         +     updateChipProgress
buildWalkthroughMinutesDoc  +     (extends to render data_updates[])
```

### Walkthrough record extended

```js
walkthroughs[i].data_updates = [
  { kind: 'rag', project_id: 'GCC-001', dimension: 'schedule', from: 'Amber', to: 'Red', rationale: '…', recorded_at: '…' },
  { kind: 'risk_status', project_id: 'GCC-002', risk_index: 1, from: 'open', to: 'closed', rationale: '…', recorded_at: '…' },
  { kind: 'status', project_id: 'GCC-003', from: 'In Progress', to: 'Blocked', rationale: '…', recorded_at: '…' },
  { kind: 'progress', project_id: 'GCC-004', skill: 'size_engineering', sprint: 'CY26-S5', completed: 8, recorded_at: '…' }
]
```

Minutes (`buildWalkthroughMinutesDoc`) gets a fifth section **Data updates** that lists each of these so the MD can see exactly what changed.

### UX contract

- Each section in the overlay gets a slim inline editor row per signal.
- Editors are **single-keystroke / single-click** — typing a number, selecting a dropdown, clicking Close.
- Each inline change shows a green flash + appears in the captured-list at the bottom of the section.
- No modal dialogs, no second-step confirmations — speed matters in a 30-min meeting.

---

## 4. Testing

| Test file | Coverage |
|---|---|
| `tests/unit/walkthrough-data-updates.test.mjs` | Each helper mutates correctly + writes audit + logs to `data_updates[]` |
| `tests/render/walkthrough.test.mjs` (extend) | Inline editors render in each section; click/input triggers helper |
| `tests/e2e/walkthrough.spec.ts` (extend) | Full flow: open → flip a RAG → close a risk → update a chip's completed SP → verify mutations |

---

## 5. MD-endorsement criteria (Definition of Done)

1. ✅ A senior manager can open the walkthrough and, in one screen, set every project's three RAGs.
2. ✅ A risk's status can be changed from open to closed/accepted with rationale, without leaving the walkthrough.
3. ✅ Each chip's completed-SP can be updated by typing a number; the audit log shows `source: walkthrough`.
4. ✅ A project's status (e.g. flipping In Progress → Blocked) carries rationale into the audit log automatically.
5. ✅ Mark Done → minutes PDF includes a new **Data updates** section with every change captured.
6. ✅ Tests are green: unit + render + E2E.
7. ✅ The senior manager can describe in one sentence what the walkthrough is FOR — and "updating the data" is in that sentence.

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Inline edits in a 9-section overlay become noisy | Keep editors slim; show captured-list footer per section so manager sees what they touched |
| Accidental RAG flips with no rationale | Each helper accepts a `rationale` param; UI prompts inline (single field, optional but encouraged) |
| Audit log floods with `walkthrough_*` rows | Already mitigated by P2's `audit_log_archive` (entries past 1000 archive automatically) |
| Conflicting updates (two attendees typing simultaneously) | Single-user model; last-write-wins; not a real-time collab tool |

---

## 7. Implementation order

1. Five `App.update*` helpers (pure functions, audit + walkthrough log)
2. Inline editors in `Sprint.openWalkthrough` per section
3. Minutes section "Data updates"
4. E2E + manual smoke
5. Senior-manager endorsement loop (Ralph) until criteria above all green
6. Merge to main

---

**Status**: Approved by senior manager (per Auto mode + user instruction). Proceeding to implementation plan.
