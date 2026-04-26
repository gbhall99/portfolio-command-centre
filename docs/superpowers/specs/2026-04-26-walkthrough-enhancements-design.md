# Weekly Walkthrough Enhancement — Design

**Author**: Senior Manager (Portfolio Owner)
**Date**: 26 April 2026
**Branch**: `audit-f-nnn-data-integrity`
**Endorsement bar**: I should be willing to walk into my MD's office and say "this is how my team runs the weekly portfolio review."

---

## 1. Why this is needed

The existing `Sprint.openWalkthrough` (P2 Task 5) lists every open chip with a per-row Edit button. That covers *one* of about *eight* things that need to happen in our weekly portfolio review. A senior manager's weekly walkthrough is a **ritual** that has to capture:

1. What's changed since last week (to set the agenda)
2. RAG movers (which projects flipped, which way, why)
3. Top risks + any new ones raised this week
4. Issues / blocked projects
5. Governance actions due in the next 7 days
6. Per-project story-point progress (the existing chip list)
7. Backlog refinement health (anything newly unrefined or stale)
8. Capacity & leave changes (sustained high-load, upcoming PTO, contract endings)
9. Decisions taken in this session + actions assigned out

Today the SM/PO/manager would have to flip between Dashboard, Capacity, Governance, Backlog Health, Trends modal, and the existing chip list to cover all of it. The walkthrough should be a **single canvas** with all of these signals pre-loaded, sectioned, and trackable.

**Time budget**: 30–45 minutes max. Anything longer indicates we're misusing the meeting.

**Output**: a persistent walkthrough record + auto-generated minutes PDF + audit-logged decisions + governance-tracked actions.

---

## 2. Scope (what this delivers)

### In scope
- **Sectioned agenda overlay** — replaces the current flat list with eight sections, each pre-loading its signals.
- **Persistent session** — `App.data.walkthroughs[]` (capped at 52 entries) records timestamp, attendees, per-section notes, decisions, actions.
- **Per-section "Mark covered"** — explicit completion tracking; the walkthrough has a single "Done" state when every section is covered or skipped.
- **Decision capture** — each decision recorded as a row in the session AND as an audit-log entry on the relevant project (with rationale).
- **Action assignment** — each action is stored on the session AND pushed into the relevant governance forum's `actions[]` so it surfaces in the existing Forum view.
- **Auto-generated minutes** — one-page PDF via the existing `Report.buildDoc` framework.
- **Resume support** — closing the overlay before "Done" leaves a `started_at, completed_at: null` record; the next `openWalkthrough` resumes it.
- **Delta-driven content** — every section pulls signals "since last walkthrough" so we don't re-discuss handled items.

### Out of scope
- Multi-customer walkthrough (single customer per session — matches CLAUDE.md scoping rule).
- Live collaboration / multi-user editing — solo SM/PO/SM driving.
- Calendar invite / attendee sign-in — capture attendee names by free-text.
- AI-generated meeting summary — minutes are templated from real data.

---

## 3. Architecture

Four new helpers + one extended modal.

```
App.computeWalkthroughAgenda(customer, sinceTimestamp?)
  → { sections: [{ id, title, signals: [...], summary: string }],
      lastWalkthroughAt, customer }
  Pure. Reads App.data. No DOM, no mutation.

App.startWalkthrough(customer, attendees)
  → walkthroughId
  Creates a row in App.data.walkthroughs[]. Returns id.

App.recordWalkthroughDecision(walkthroughId, { projectId, text, rationale })
  → boolean
  Appends to walkthroughs[i].decisions[] AND audit log via App.logChange.

App.recordWalkthroughAction(walkthroughId, { description, owner, due_date, forumId })
  → boolean
  Appends to walkthroughs[i].actions[] AND to the named forum's actions[].

App.completeWalkthrough(walkthroughId)
  → boolean
  Sets completed_at + auto-generates minutes via Report.buildWalkthroughMinutesDoc.

Sprint.openWalkthrough(customer)
  Now opens the sectioned overlay (replaces old flat list).
  Resumes last in-progress walkthrough OR starts a new one.

Report.buildWalkthroughMinutesDoc(walkthroughId)
  → HTML doc string (consumed by Report.open)
```

### Data shape

```js
App.data.walkthroughs = [
  {
    id: 'wt_<timestamp>_<rand>',
    customer: 'GCC',
    started_at: '2026-04-26T09:00:00Z',
    completed_at: null,                      // or ISO timestamp once Done clicked
    attendees: ['Senior Manager', 'PO Name', 'SM Name'],
    section_notes: { whats_changed: '…', rag_movers: '…', … },
    section_status: { whats_changed: 'covered' | 'skipped' | 'pending', … },
    decisions: [
      { project_id: 'GCC-001', text: 'Defer DE Phase to S6', rationale: 'Sponsor concern', recorded_at: '…' }
    ],
    actions: [
      { description: 'Confirm Veena availability', owner: 'PO', due_date: '2026-04-30', forum_id: 'GovBoard' }
    ],
    minutes_html: null  // populated on complete
  }
]
```

Capped at 52 entries (rolling year). Older sessions archive into `walkthroughs_archive[]` mirroring the `audit_log_archive` pattern.

---

## 4. Sections (the ritual)

Each section has a deterministic title, a `signals` array of typed entries, an optional notes field, and a covered/skipped toggle. The order is fixed — that's the ritual.

| # | Section | Signals (data) | Why this matters |
|---|---|---|---|
| 1 | **What's changed** | Audit-log entries since `lastWalkthroughAt`, grouped by field; top 3 mutated fields | Sets agenda — drives where attention goes |
| 2 | **RAG movers** | Projects whose `rag_*` differs from the value at `lastWalkthroughAt` (sourced from audit log) | Flagging schedule/resource/scope flips |
| 3 | **Top risks + new** | Top 5 by `impact × probability` + risks added since last walkthrough | What's keeping us up at night |
| 4 | **Issues & blockers** | All projects with `status === 'Blocked'` + `issues_register[]` open | Unblock list |
| 5 | **Governance actions due ≤ 7 days** | Each forum's `actions[]` filtered by `due_date` window | Don't let actions slip silently |
| 6 | **Chip progress** | Per-customer open chips in active sprint (existing list) — Edit button still present | PO/SM weekly burn-update |
| 7 | **Backlog refinement** | `App.computeBacklogBuckets(customer).unrefined` + stale items (no audit movement in 30 days) | Keeps the input queue healthy |
| 8 | **Capacity & leave** | `Capacity.computeSustainedHighLoad` + members with PTO booked in next 14 days + contract ends in next 30 days | Don't get caught short |
| 9 | **Decisions & actions** | Form rows for capturing decisions + actions during the meeting | Audit trail + accountability |

Section IDs (stable string keys): `whats_changed | rag_movers | risks | issues | actions_due | chip_progress | backlog | capacity | decisions`.

---

## 5. UX contract (overlay shape)

- Modal overlay (same pattern as `openScenarioManager`, `openWhenByModal`).
- Header strip: customer pill, started-at, attendees inline-edit, **Save & Close** + **Mark Done** buttons.
- Eight collapsible sections + one "Decisions & actions" footer-section, each:
  - Title + section completion checkbox (or "Skip" with reason).
  - Pre-loaded signals as a tight bulleted list.
  - Free-text notes textarea (saved to `section_notes[sectionId]`).
  - Section-level "Add decision" / "Add action" buttons that open a small inline form.
- Bottom toolbar: time-elapsed indicator, **Export minutes**, **Mark Done**.
- Resume: opening when an in-progress walkthrough exists for the customer restores all state.

---

## 6. Testing strategy

Per the existing `tests/` conventions (vitest + jsdom + Playwright):

- **Unit** (`tests/unit/walkthrough-agenda.test.mjs`):
  - `computeWalkthroughAgenda(customer)` returns 9 sections in stable order.
  - "What's changed" section reads audit-log entries since `lastWalkthroughAt`.
  - "RAG movers" derives flips from audit log.
  - "Top risks" uses `impact × probability` ordering, top 5.
- **Unit** (`tests/unit/walkthrough-session.test.mjs`):
  - `startWalkthrough` creates a row with `id`, `started_at`.
  - `recordWalkthroughDecision` appends to session AND audit log.
  - `recordWalkthroughAction` appends to session AND to the named forum.
  - `completeWalkthrough` sets `completed_at` and generates `minutes_html`.
  - Cap at 52: 53rd entry archives the oldest into `walkthroughs_archive[]`.
- **Render** (`tests/render/walkthrough.test.mjs` — extend existing):
  - `Sprint.openWalkthrough(customer)` renders 9 section headers in order.
  - Resuming a walkthrough preloads `section_notes`.
- **E2E** (`tests/e2e/walkthrough.spec.ts`):
  - Open walkthrough → mark covered on each section → record decision → record action → click Done → minutes overlay opens.

---

## 7. MD-endorsement criteria (Definition of Done)

The senior manager will only ship to the MD when:

1. ✅ A new walkthrough opens with all 9 sections pre-populated with real signals (not placeholders).
2. ✅ A decision recorded during the walkthrough appears in `App.data.audit_log` AND on the project's audit feed.
3. ✅ An action recorded during the walkthrough appears in the named governance forum's `actions[]` (and on the existing Governance view).
4. ✅ Mark Done generates a one-page printable minutes PDF.
5. ✅ Closing the overlay mid-flight and re-opening resumes the same session with notes intact.
6. ✅ The 52-entry cap rolls correctly into `walkthroughs_archive[]`.
7. ✅ Full `npm test` is green.
8. ✅ The senior manager can describe in one paragraph what the walkthrough delivers without naming any code symbols. (Test of comprehensibility.)

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Over-engineering — too many sections, meeting still takes 90 min | Hard 30-45 min budget; section signals are top-N capped (top 5 risks, top 10 stale items, etc.) |
| Decision capture friction — typing during a meeting is slow | Each decision row has a single text field + optional rationale; defaults work. |
| Stale walkthroughs left half-done | Auto-prompt on next `openWalkthrough` call: "Resume yesterday's walkthrough or start fresh?" |
| Audit log bloat from action/decision rows | Already handled by P2 Task 7 archive (entries past 1000 archive automatically). |
| Customer scoping confusion | Each walkthrough is single-customer; the customer pill in the header makes scope visible. |

---

## 9. Implementation order

A single plan with eight tasks (one per helper + integration), then E2E + verify.

1. `computeWalkthroughAgenda` — pure function, all 9 section types
2. Session helpers (`startWalkthrough`, `record*`, `completeWalkthrough`) + persistence
3. Refactored overlay (replaces the flat-list version)
4. Section forms (decision / action capture inline)
5. Resume-on-open behaviour
6. `Report.buildWalkthroughMinutesDoc`
7. Sidebar / button: surface "Walkthrough" already exists; just confirm it points at the new flow
8. Archive cap (52 → `walkthroughs_archive[]`)
9. E2E + manual smoke

Each task ships with its own unit test before code, per the existing TDD discipline.

---

**Status**: Approved by senior manager (self-approval per user instruction). Proceeding to implementation plan.
