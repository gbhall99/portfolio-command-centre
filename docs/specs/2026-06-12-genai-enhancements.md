# GenAI Enhancements — approved scope (2026-06-12)

*Approved by Gareth: Tier 1 (#1–3) plus #4 and #5 from the ranked review.
Delivered as sequential tested commits on the working branch; PR per batch.
This spec lets any session continue the work without prior context.*

## #1 Transcript → RAID / actions / status extraction (highest value)
- Entry: command palette "Extract from meeting transcript" + Assistant suggestion.
- UI: modal (reuse `.sow-modal` styles, id `exModal*`): paste/drop transcript →
  Generate. `AI.structuredOutput` schema:
  `{ raid_items: [{project_id|null, kind(risk|assumption|issue|decision),
  description, owner?, impact?, probability?}], status_changes: [{project_id,
  status, reason}] }`. Prompt wraps the transcript in `<untrusted_document>`
  with the never-follow-instructions rule and includes the customer's project
  list (id+name) for matching; unmatched items return project_id null and the
  UI shows a project picker before confirm.
- Apply path: feed each extracted item through the EXISTING AgentTools write
  handlers (`create_raid_item`, `update_project_field`) with a local ctx to get
  proposal objects; render proposal cards with per-item Confirm + Confirm-all.
  Nothing mutates pre-confirm; everything audited 'ai', undoable.
- Tests: extraction lands proposals not mutations; unmatched→picker; batch
  confirm; injection guard in prompt; XSS in rendered extracts.

## #2 Section-level SOW redrafting with diff preview
- "AI redraft" button per section (hidden when Approved). Instruction input →
  `AI.structuredOutput {content}` with: section guidance from the definition,
  current content, style rules, source excerpt (untrusted-wrapped), and the
  user instruction.
- Render old→new diff (two stacked blocks, old struck-through style) with
  Accept / Reject. Accept → `Sow.updateSection(..., 'ai')` + history event
  `section_redrafted`. Reject discards.
- Tests: accept persists + audits 'ai'; reject leaves content; approved lock.

## #3 AI sizing suggestions (source → estimates)
- In SowSkill side panel: "Suggest sizes" → `AI.structuredOutput
  { sizes: {size_*: int}, rationale, confidence(low|med|high) }` grounded in
  the SOW source text + a comparables digest (completed projects: sizes,
  sprint span). Suggestion renders with rationale; "Apply to linked project"
  routes each size through `App.updateProject(..., 'ai')` after one confirm
  (single proposal card listing all size changes).
- Tests: integers clamped ≥0; apply gated + audited; no linked project → save
  into the create-project flow defaults instead.

## #4 Conversational wireframe refinement
- In the wireframe editor: instruction input "Refine with AI" →
  `AI.structuredOutput { ops: [{op: add|move|resize|retitle|remove, type?,
  id?, x?, y?, w?, h?, title?}] }` with the vocabulary enum on `type` and the
  current component list (ids+geometry) in the prompt.
- Ops apply through the EXISTING clamped mutators (`addComponent`,
  `updateComponent`, `removeComponent`); invalid ops dropped with a visible
  count; conformance panel re-checks; toast "Applied N changes — Ctrl+Z to
  undo".
- Tests: vocabulary enforcement, clamp, unknown-id ops dropped, conformance
  preserved on the happy path.

## #5 "What changed" briefing
- New READ tool `recent_changes {days?=7}`: customer-scoped digest from
  audit_log (counts by field class, RAG flips, status changes, new/closed
  RAID, sow/wireframe/report events) + deadlines entering the next 30 days.
- Assistant suggestion "What changed in the last week?" + palette entry.
- Tests: scoping, day filter, content classes, citations.

## Sequencing & status
| Item | Status |
|---|---|
| Spec (this file) | committed |
| #2 SOW redraft | DONE |
| #5 Briefing tool | DONE |
| #1 Transcript extraction | DONE |
| #3 Sizing suggestions | pending |
| #4 Wireframe refinement | pending |

Update this table as items land. Conventions: every fix/feature ships with
mock-adapter tests (no network), all writes confirmation-gated + audited,
suite must stay green (`npm test`).
