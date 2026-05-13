# Project Detail Panel — IA Refactor

**Status:** implementation plan (no code changed yet) — **all four personas signed off with conditions; conditions applied inline below**
**Authored:** 2026-05-13
- rev 1 — Walkthrough UI redesign in scope
- rev 2 — Reports & documentation consistency in scope
- rev 3 — gate "Benefits" renamed to "Hypercare"; Walkthrough Minutes removed entirely; Acceptance Criteria added to every phase (§5, §9.12) and pattern AC for repeated structural elements (§11)

**Personas signed off:** Product Owner (E → H, L) · Scrum Master (F → I, M) · UX expert (G → J, O) · Data Engineer (Reports work only, I → N) — see `_scratch_detail_panel_refactor.md` for Detail-panel critiques, `_scratch_reports_audit.md` for Reports critiques. Rev 3 changes (gate rename, minutes removal, AC) are user-driven scope refinements; SM red lines on minutes integrity become moot because the artifact itself is out of scope.

**Scope:** `DetailPanel.renderBody` + `quickAdd` wizard + **`Walkthrough` module UI redesign** + **7 report/pack outputs unified via `Reports.*` + top-level `Format.*`** (see §9). Single-file HTML/JS app.

## 1. Problem (one-paragraph)

The current detail panel has 21 collapsible sections across 3 tabs (`Setup` / `Health` / `Delivery`) whose names don't match what's inside them. Prioritisation lives in "Setup" but is re-tuned weekly. Strategy appears twice. RAID is split across two tabs. EVM and WSJF analytics are jammed in alongside editable inputs. Navigation falls back to a "Jump to…" select, which is the panel admitting its IA isn't working. The wizard collects 5 fields then drops the user into a 30-field Setup tab with no path. **The Walkthrough modal duplicates the same information with a parallel UI: its own RAG cycle widget, its own risk-add templates, its own milestone editor, its own narrative composer. A field edited in one place may look different in the other — and SMs in live meetings hit this constantly.** Two surfaces, two mental models, one project.

## 2. Goals (what "done" means)

A user opening the panel can, without training, complete each of the four core jobs in under 60 seconds:

- **J1 Add a project:** a 3-step wizard with only customer + name + size mandatory; everything else flagged as readiness-gate work, not enforced.
- **J2 Update a project:** every edit type has one obvious home and an inline quick-add wherever it's triggered (e.g. log a risk from the phase tracker).
- **J3 Check status:** Overview tab answers "what is this project right now?" in a screenshot, including PO weekly caption, RAG, milestones, blockers, last-reviewed-by.
- **J4 Run the weekly walkthrough:** the per-project center pane of the Walkthrough renders from the *same* components as Overview, with the same inline edit affordances, the same RAID quick-add chips, the same RAG selector, the same milestone editor. No second mental model. Meeting-flow chrome (project list, progress bar, "Mark Done", customer pack) stays as the only walkthrough-specific surface.

Non-goals: visual restyle of cards, theming, performance optimisation, **Solver / capacity model / Sprint Planning view**.

## 3. Architecture decisions (the consensus from 3 personas)

### 3.1 Tab structure — final

Four tabs, in left-to-right order chosen for frequency-of-use (Overview + Delivery dominate daily; Scope & Value + RAID weekly):

| Tab | Intent | Default mode | Frequency |
|---|---|---|---|
| **Overview** | "What is this project right now?" | read-mostly (inline click-to-edit) | daily, sponsor-facing |
| **Delivery** | "How are we executing?" | inline edit | daily, SM/delivery lead |
| **Scope & Value** | "What are we delivering and why?" | inline edit | weekly, PO |
| **RAID** | "Risks · Assumptions · Issues · Decisions" — full register | inline edit | continuous |

**Default landing tab is entry-point-aware** (PO E#5). The routing map below is canonical (not folklore — document in `CLAUDE.md` once Phase 3 ships): *(SM I push-back)*

| Entry point | Default tab |
|---|---|
| Dashboard tile, Walkthrough "Open detail", share-link | `Overview` |
| Projects table row, Backlog card, Roadmap bar | `Delivery` |
| Strategy view, Personas/Metrics view | `Scope & Value` |
| Cmd+K search, typeahead jump | `Overview` |
| Notification deep-link | tab encoded in link |

Hash overrides everything: `#/p/<id>/<tab>[#<section>]`.

### 3.2 Tab contents — final allocation

**Overview** (read-mostly; mix of strips, chips, and CTAs — no editable forms; all edits land in other tabs via deep-link or inline click-to-edit on the single PO caption field)
1. **PO weekly caption** — single-line textarea ("PO this week:", 240 chars). Same field as Walkthrough's customer narrative headline; one source. *(PO E#3, must)*
2. **RAG triplet** with inline override + reason (kept).
3. **Status & dates strip** — status pill · hard deadline · target date · started · baseline footer. Read-only summary; click any cell deep-links to Delivery > Dates.
4. **Sprint context** — current sprint window · committed/completed for current sprint · assignee chips. *(SM F#7, should)*
5. **Customer milestones (read-only strip)** — surfaces externally-committed milestones first; click → Delivery > Milestones. *(UX G#3 reconciles PO E#2 + SM F#3, must)*
6. **Blockers + Top-3 risks** — filtered RAID slice: blocking / overdue / red. *(SM F#6, should)*
7. **Outcomes summary chip** — "3 of 5 benefits forecast on track; 2 at risk" → Scope & Value > Outcomes.
8. **Recent activity** — last 5 audit entries. *(SM F#14)*
9. **Strategy contribution chip** — persona(s) + top-linked metric + OKR. *(PO E#10)*
10. **RACI strip (read-only)** — top 4–6 named roles inline, click → Delivery > Stakeholders. *(SM F#8 + I push-back)*

EVM strip is **demoted** from Health into a "Show analytics" disclosure on Overview, hidden by default and entirely hidden when no baseline exists. *(PO E#12; UX G#13)*

**Delivery** (6–7 sub-blocks; inline edit)
1. **Delivery configuration** — data sourcing type + external fields + phase flow toggles/order.
2. **Phase tracker + sizing** — per-phase status select · points (point + max) · variance · consumed/remaining. **Sizing inputs co-located here, NOT on Scope & Value.** Total points bar + Set/Reset Baseline below. *(SM F#4 + UX G#10, must)*
3. **Sprint window** (read-only, auto-populated by Sprint Planning).
4. **Dates** — hard deadline · target date · started · completed · baseline edit + history.
5. **Dependencies** register (moved off "Setup"). Keep here unless a future review reclassifies as RAID. *(UX G#4, nice)*
6. **Stakeholders / RACI** + **Sponsor sign-off log** (E#9) co-located.
7. **Customer Milestones register** (editable) with new column `external_commitment` (Y/N) + `committed_in` + `committed_date`. *(PO E#2, must)*

Inline quick-add chips on Phase tracker:
- `+ Log risk` (opens 1-row form, persists to Risks register)
- `+ Log issue`
- `+ Log decision` (autofills "context: phase X re-baselined" when triggered from Phase tracker; required by PO E#11 scope-change rule)
*(SM F#5 + F#9, must)*

**Scope & Value** (cap at 4 sub-blocks; inline edit) *(UX G#10, must)*
1. **Identity** — name, customer, category, sponsor, manager, governance forum visible above the fold. Rarely-changed fields (lifecycle stage, visibility, DevOps/WFA links) collapse behind a **"More details"** disclosure. **All identity lives here**, not split with Delivery. *(UX G#2 + G#12, must)*
2. **Prioritisation** — priority#, MoSCoW, business value, time-criticality, risk/opportunity. WSJF/CoD/MoSCoW band breakdown becomes a single line chip with a "why?" popover, not a sub-block.
3. **Strategy linkage** — metric ids, persona ids, objectives, business questions (editable; the one and only place).
4. **Outcomes** — merged register replacing both Benefits and Success criteria. Columns: `type` (benefit | success criterion) · `description` · `target` · `unit` · `measurement_date` · `baseline` · `actual` · `status` (Forecast | Realised | Missed | Abandoned | N/A) · `last_checked_at`. *(PO E#1 + UX G#10, must)*
5. **Gate reviews** (lifted from PO E#6) — collapsed by default; gate name (Discovery/Design/Build/UAT/Live/Hypercare) · planned · actual · decision · sign-off-by · evidence. Rolls up to Overview chip "Last gate: …; Next: …".

**Re-prioritisation reason capture**: when any WSJF input or MoSCoW changes, prompt for a one-line "why now?" and auto-create a Decision register entry tagged `prioritisation`. Surface last 3 reasons inline under the WSJF chip. *(PO E#4, must)*

**Scope change reason**: when total points change post-baseline **(triggered from the Delivery sizing inputs — that is where the points live)**, force a one-line reason; auto-create a Decision register entry tagged `scope-change`. Show net delta vs baseline next to sizing input on Delivery. *(PO E#11 + H condition, must)*

**RAID** (4 sub-blocks; inline edit; this is the *register*, not the only place to add)
1. **Risks** (with quick-add templates + new fields `mitigation_owner`, `mitigation_due_date`). *(PO E#15)*
2. **Issues** — laid out as a sibling column next to Risks on ≥768 px viewports, stacked below on narrow viewports. Different accent colour to keep them visually distinct. *(PO H condition)*
3. **Assumptions**
4. **Decisions** (includes prioritisation/scope-change Decisions auto-created from Scope & Value and Delivery)
5. **Governance Decisions** (linked, conditional)
6. **Meeting Actions** (linked, conditional)

### 3.3 Read/Edit toggle — dropped

The proposed global Read/Edit toggle is removed. Replaced with **inline click-to-edit** (Linear / Notion pattern): fields render as text until clicked/focused, then become inputs. No mode state, no mode error. *(UX G#5, must-ship red line)*

**Resting affordance** *(UX J condition)*: editable fields render with a subtle dotted underline + a tinted background on hover; on focus, full input border appears. Non-editable computed/derived fields (EVM, WSJF chip, sprint window) render with no underline and no hover state. Distinct enough to learn in one session; quiet enough not to clutter a read-mostly Overview.

### 3.4 Sticky header — two rows

| Row | Contents | Behaviour |
|---|---|---|
| 1 | Customer chip · status pill · RAG triplet · **Readiness chip** · **Last reviewed by/at** · Open in Walkthrough | always visible |
| 2 | Sprint window · committed/completed · assignees · target date · readiness shortcuts | collapses on viewport **< 540 px** into a single chip showing `<sprint id> · X/Y SP` — tap to expand inline |

**Collapse target spec** *(UX J condition)*: at <540 px, row 2 becomes a single horizontal chip `S26 · 18/32 SP` (current sprint + committed/completed). Tap reveals the full row inline (does not push tab strip off-screen — uses a `details/summary` pattern). Assignees + target date promoted into the popover, not the chip. *(UX G#18 + SM F#7 + F#12, must)*

### 3.5 Mini-TOC — sticky chip row with scroll-spy

Replace "Jump to…" `<select>` with a horizontally-scrolling chip row directly under the tab strip. Active section highlighted via scroll-spy. Works at all viewports; no left rail to crush form columns. **Ship this as Phase 0 quick win, before the tab refactor lands.** *(UX G#7, G#25, must)*

Accordions reserved for **low-frequency content only**: Governance Decisions/Meeting Actions when empty, History (Audit), Gate reviews. Never for primary tab content. *(UX G#8)*

### 3.6 Readiness gate (replaces completion meter)

Three-stage gate, mirrors how a project matures:

| Gate | Required fields | Effect when not met |
|---|---|---|
| **Ready for backlog** | name, customer, MoSCoW (or "unranked"), lifecycle stage | hidden from prioritised backlog view |
| **Ready for sprint planning** | + total points by phase, target date, manager | Solver flags & skips during alloc |
| **Ready for steerco** | + sponsor, governance forum, at least 1 outcome, RAG triplet not null | Walkthrough list shows `setup incomplete` chip; weekly-review banner "1 project needs setup" |

Surfaced as a chip in Row 1 of the sticky header: "Ready for: backlog ✓ · planning ✓ · steerco ✗ (sponsor missing)". Click opens checklist popover. Not a percentage. *(SM F#11 + PO E#8 + UX G#19, must)*

**Grandfathering for in-flight projects** *(PO H condition)*: projects with `status ∈ {In Progress, On Hold, At Risk, Blocked}` on the day the gate ships are auto-marked `legacy_grandfathered = true` and not retroactively hidden from the backlog or skipped by the Solver. The readiness chip still shows what's missing, but enforcement is informational only. New projects (created after the flip) hit full enforcement.

### 3.7 Wizard — 3 steps, only Step 1 mandatory

| Step | Fields | Required? |
|---|---|---|
| **1 Identify** | name, customer, category, lifecycle stage, MoSCoW (allow "unranked"), total size estimate | mandatory (name + customer + size) |
| **2 Scope & value** *(skippable)* | template pick, suggested strategy link (auto-suggested from customer/template/peer projects), target date, sponsor | "Add later" affordance per field |
| **3 Delivery shape** *(skippable)* | data sourcing type, phase flow, hard deadline, governance forum, priority slot or hard dates | "Add later" affordance per field |

Wizard **suggests** (auto-fills with explicit `Suggested` label, editable). Template choice triggers suggestions for MoSCoW, phase flow, governance forum, strategy link. *(PO E#13, should)*

On create: land on **Overview** (not Setup — Setup no longer exists). Header readiness chip shows what's missing. *(PO E#7 + F#15 + G#20, must)*

The 5-field-in-15-seconds standup flow is preserved by making Steps 2+3 collapse to a single "Add details later →" button on Step 1.

### 3.7a Walkthrough → Detail re-prioritise shortcut

In addition to "Open detail" deep-links, the Walkthrough adds a **`Re-prioritise`** action on the per-project card (next to RAG cycle) that deep-links to `#/p/<id>/scope#prioritisation` with the WSJF block focused. This is the most-requested action *during* a weekly review when new information lands. *(PO E#14 + H condition)*

### 3.8 Walkthrough redesign — shared components, meeting-optimised shell

The Walkthrough is no longer a parallel UI. Its 3-pane shell (project list / center / customer pack) is preserved because it's a meeting-flow affordance — but the **center pane is recomposed from the same render functions that draw the Detail panel's Overview tab**. This collapses the parallel-implementations problem into an architectural property: same component → same data → same UX.

**Single source of truth becomes architectural, not contractual.** The v1 plan proposed a per-field write-arbitration matrix between two parallel UIs. With shared components, the matrix mostly evaporates — there is one render path, one save handler, one validation, one audit-log entry per field. The matrix shrinks to the residual concurrent-edit case (PO on laptop, SM on meeting screen, same field, same minute).

#### 3.8.1 Walkthrough shell — what stays

The shell is the *only* walkthrough-specific surface. Everything else is shared.

| Surface | Why it stays |
|---|---|
| Left rail — project list with reviewed checkmarks, RAG dots, attention score, search, "By attention" grouping | Unique to the meeting flow; you walk through N projects and need progress + cohort visibility |
| Top bar — progress %, cohort pills (critical/watch/steady), "Mark Done", session date | Walkthrough is a *session*; needs a session bar |
| Bottom bar — "Next project →" + keyboard nav | Meeting cadence affordance |
| Right rail — customer pack picker + customer-facing narrative composer (wins/asks/visible-risk picker) | Sponsor-pack output is a walkthrough-only artefact |
| `walkthrough.section_status[]` reviewed-state | Walkthrough-only state |
| `bumpProjectReviewed(projectId, walkthroughId)` → writes `project.last_reviewed_at` + `last_reviewed_by_walkthrough_id` | Cross-surface stamp; surfaces in Overview header (§3.4 Row 1) |

#### 3.8.2 Walkthrough center pane — what changes

Every parallel UI is replaced by a shared render call. Drop the duplicate implementations entirely.

| Old behaviour (today) | New behaviour (post-Phase 6) | Shared function called |
|---|---|---|
| Parallel RAG cycle UI (`_cycleRag` — click dots Green/Amber/Red) | Inline click-to-edit RAG triplet with override + reason | `Overview.renderRagTriplet(p)` |
| Parallel risk-add 6-template buttons (`SME unavailable`, `Data quality`, …) | Same 6 templates as Detail panel; single source list | `RAID.RISK_TEMPLATES` + `RAID.renderQuickAddRisk(p, ctx)` |
| Parallel milestone editor (`_setMilestoneStatus`) with no `external_commitment` flag | Full Customer Milestones register with `external_commitment` column visible | `Delivery.renderCustomerMilestones(p)` |
| Parallel narrative headline field (`_narrativeHeadlineChange`) | Headline = `project.narrative.po_caption` (the Overview PO weekly caption — same field) | `Overview.renderPoCaption(p)` |
| Parallel capture-tab machinery (`_setCaptureTab` for Decision / Action / Risk) | Same inline quick-add chips as Detail panel; new record auto-tagged with `walkthrough_id` for audit | `RAID.renderQuickAdd{Risk,Issue,Decision}(p, {walkthroughId})` |
| Parallel "close risk" / "accept risk" buttons (`_closeRisk` / `_acceptRisk`) | Same Risk row controls as RAID tab | `RAID.renderRiskRow(p, idx)` |
| Parallel meeting-action defer/done (`_deferAction` / `_doneAction`) | Same Meeting Actions controls as RAID tab | `RAID.renderMeetingActionRow(p, action)` |

#### 3.8.3 Walkthrough right-rail customer pack — clarified scope

The customer pack composer captures the *external-facing* story for the sponsor meeting. Fields split by whether they're project-state or walkthrough-state:

| Field | Stored on | Shared with |
|---|---|---|
| `narrative.po_caption` | `project.narrative` | Overview header (one source, one input) |
| `narrative.wins[]` | `project.narrative` | Walkthrough right-rail only (don't pollute project header) |
| `narrative.asks[]` | `project.narrative` | Walkthrough right-rail only |
| `narrative.customer_visible_risk_ids[]` | `project.narrative` | Walkthrough right-rail only; selects from the same Risks register the rest of the app reads |

This separation means the PO weekly caption is consistent across Detail panel and Walkthrough, but the rest of the customer-pack composition stays in the walkthrough and doesn't leak into project state.

#### 3.8.4 Visual & interaction consistency

The walkthrough adopts the same visual language as the detail panel post-Phase 2:

- Same `.dp-chip-row` for in-pane section nav inside the center pane
- Same `.dp-inline-edit` resting / hover / focus states (dotted underline → tinted hover → focus border)
- Same `.dp-undo-toast` for revert affordances after every edit
- Same empty-state spec (§3.9) — risks register with zero entries shows "+ Log first risk →", not an empty grid
- Same interaction-order spec (§3.10a) — reason-prompt > conflict-toast > undo-toast hierarchy
- Same ARIA roles & focus management (§3.11) — `role="region"` on each rail with `aria-label`; focus trap inside the walkthrough overlay; focus restored to opener on close

#### 3.8.5 Keyboard shortcuts inside Walkthrough

Walkthrough-specific shortcuts (in addition to the panel's `g o/d/s/r`):

| Key | Action |
|---|---|
| `j` / `k` | Next / previous project in left rail |
| `r` | Mark current project reviewed + advance |
| `n` | Next project (without marking reviewed) |
| `g o` / `g d` / `g s` / `g r` | Open detail panel at correct tab for the *currently selected* project |
| `/` | Focus left-rail search |
| `esc` | Close walkthrough (with dirty-edit guard if mid-edit) |
| `cmd+s` | "Saved" confirmation toast (auto-save already runs) |

#### 3.8.6 Deep-link round-tripping

Walkthrough ↔ Detail panel deep-link in both directions:

- **Walkthrough → Detail:** "Open detail" deep-links to the *correct sub-section* (anchor-supported per §3.5/§3.9). Risk-capture context → `#/p/<id>/raid#risks`. Re-prioritise CTA (§3.7a) → `#/p/<id>/scope#prioritisation`. Generic "Open detail" → `#/p/<id>/overview`.
- **Detail → Walkthrough:** Overview's "Open in Walkthrough" CTA opens the active customer's walkthrough with this project pre-selected and scrolled into the left rail.

#### 3.8.7 Residual conflict resolution

Even with shared components, two surfaces can be open on the same field simultaneously (PO laptop + SM meeting screen). The original §3.8 toast survives this case:

- Every project gets `last_edited_at` (timestamp) + `last_edited_in` ('detail' | 'walkthrough') on any field write.
- If the other surface has the same field open when a write lands, that surface shows a toast: `"Updated by [surface] — Reload"` with a 1-click reload affordance.
- Per §3.10a, this conflict toast queues behind any open reason-prompt and yields to undo-toast in the hierarchy.

This is the entire write-arbitration matrix now — one rule, one toast, one timestamp pair.

#### 3.8.8 In-session display-value pin

While a Walkthrough overlay is open, the center pane and right-rail pack composer **cache the project values that were displayed on first render** and only update via local user input. A canonical mutation elsewhere (e.g. PO edits a project name on a laptop mid-meeting from the Detail panel) does NOT live-replace the displayed values inside the open walkthrough overlay. The §3.8.7 conflict toast fires; the SM chooses when to reload.

Guarantees "what the sponsor saw on screen during the meeting = what was used to capture decisions/actions/customer-pack narrative". Note: this is no longer about minutes regeneration (rev 3 removed minutes) — it remains as a meeting-flow stability property. *(Originally SM M condition from the Reports work, relocated here.)*

### 3.9 Empty states

Defined per section *(UX G#13, must)*:
- Registers with no entries: 1-line CTA card ("No risks logged. `+ Log first risk →`")
- EVM strip: **hide entirely** unless baseline + actuals exist (never show CPI = 0.00)
- Metric chips: `—` not `0` for unknown values
- Phase tracker: phases not in `phase_order` show "off" greyed-out, not "0 pts allocated"

### 3.10 Focus management, undo, keyboard

| Behaviour | Spec |
|---|---|
| Tab switch with dirty input | auto-save (already auto-saves to localStorage) + **undo toast for 8s** *(UX G#15, must)* |
| Per-field undo | undo toast on every change ("Risk title changed · Undo · 8s") |
| Per-session "revert all" | overflow menu on panel header |
| Keyboard shortcuts | `g o` / `g d` / `g s` / `g r` jump tabs; `j` / `k` next/prev section; `/` focus chip-row search; `cmd+s` shows "Saved" toast; `esc` closes panel with dirty-edit guard. **Desktop only.** *(UX G#16, should)* |
| **Mobile (<768 px)** | tab strip becomes a horizontal scroller (not a `<select>`) so all four tabs remain visible/scent-finding intact; no keyboard shortcuts on mobile; chip-row TOC stays. *(UX J condition; G#22 resolved)* |
| Escape with dirty edit | dirty-edit guard prompt: "Discard unsaved …? — keep editing / discard" |

### 3.10a Interaction-order spec (multiple things firing at once)

When the user changes a field that triggers BOTH a required-reason prompt (re-prioritisation, scope-change) AND would normally produce an undo toast, the order is *(UX J condition)*:

1. **Reason prompt is modal** — the change is held pending until the reason is entered or the change is cancelled.
2. If user confirms with reason → Decision register entry written + undo toast appears ("Priority changed → Decision logged · Undo · 8s"). Undo undoes both the field change and the auto-Decision.
3. If user cancels → field reverts immediately, no toast (nothing to undo).
4. **Cross-surface conflict toast** ("Updated by Walkthrough — Reload") never coexists with a reason prompt: if a conflict lands while the prompt is open, queue the toast until the prompt closes.

This means at most ONE notification visible at any time, with a clear hierarchy: reason prompt > conflict toast > undo toast.

### 3.11 Accessibility

- `role="tablist"` on tab strip; `role="tab"` + `aria-selected` + `aria-controls` per tab.
- `role="tabpanel"` per panel.
- Mini-TOC chip row: `<nav>` with `aria-current="location"` on the active chip.
- Focus order: tab strip → mini-TOC → main content → action buttons.
- Focus trap inside the slide-over while open; restore focus to opener on close.
- All sub-block headers `<h3>`, optional sub-headers `<h4>`. No bold-as-heading. *(UX G#11, G#21, must)*

### 3.12 History (was: Audit log)

- Renamed from "Audit log" to "History" in UI. *(UX G#26)*
- Default-collapsed.
- Split: **Recent activity (last 5)** rendered on Overview tab; **Full history** behind the collapsed section at bottom of panel.
- PO red line: 1-click "show all" always available; never hidden by accordion alone.

### 3.13 Section migration map (audit completeness)

All 21 current `panel-section` titles + 2 audit collapsibles map to the new IA:

| Current section | Today's tab | → New tab | → New sub-block |
|---|---|---|---|
| Status & Health | Health | Overview | RAG triplet + status pill (Row 1 sticky) |
| Strategy (read-only) | Health | Overview | Strategy contribution chip |
| Assumptions | Health | RAID | Assumptions |
| Risks | Health | RAID | Risks (+ inline quick-add elsewhere) |
| Decisions | Health | RAID | Decisions |
| Governance Decisions (conditional) | Health | RAID | Governance Decisions |
| Meeting Actions (conditional) | Health | RAID | Meeting Actions |
| Identity | Setup | Scope & Value | Identity (above-fold + "More details" disclosure) |
| Prioritisation | Setup | Scope & Value | Prioritisation |
| Delivery Setup | Setup | Delivery | Delivery configuration |
| Dependencies | Setup | Delivery | Dependencies |
| Stakeholders | Setup | Delivery | Stakeholders + Sponsor sign-off log (new) |
| Strategy linkage | Setup | Scope & Value | Strategy linkage |
| Benefits | Setup | Scope & Value | Outcomes (merged) |
| Success criteria | Setup | Scope & Value | Outcomes (merged) |
| Dates | Delivery | Delivery | Dates (+ Overview status & dates strip read-only) |
| Sprint window | Delivery | Delivery | Sprint window |
| Delivery Phases | Delivery | Delivery | Phase tracker + sizing |
| Customer Milestones | Delivery | Delivery | Customer Milestones (+ Overview read-only strip + `external_commitment` flag) |
| Issues | Delivery | RAID | Issues |
| EVM strip (no header) | Health (top) | Overview | "Show analytics" disclosure (hidden when no baseline) |
| Change History (audit, collapsible 1) | appended | Overview | Recent activity (last 5) |
| Change History (audit, collapsible 2) | appended | bottom of any tab | History (collapsed; renamed) |

No current section is orphaned. New sub-blocks introduced by the refactor: Overview *PO weekly caption*, Overview *Blockers strip*, Overview *Outcomes chip*, Overview *RACI strip*, Scope & Value *Gate reviews*, Delivery *Sponsor sign-off log*.

**Walkthrough surface migration** (parallel UIs collapse to shared components per §3.8.2):

| Walkthrough surface today | → After refactor |
|---|---|
| `_cycleRag` (dot-cycle RAG widget) | `Overview.renderRagTriplet` (shared) |
| `_setMilestoneStatus` + inline milestone editor | `Delivery.renderCustomerMilestones` (shared, gains `external_commitment` column) |
| `_captureTab` Decision/Action/Risk tabs | `RAID.renderQuickAdd*` chips (shared, tagged with `walkthrough_id`) |
| 6 parallel risk-template buttons | `RAID.RISK_TEMPLATES` (single list, shared) |
| `_closeRisk` / `_acceptRisk` row buttons | `RAID.renderRiskRow` controls (shared) |
| `_deferAction` / `_doneAction` row buttons | `RAID.renderMeetingActionRow` (shared) |
| `_narrativeHeadlineChange` (parallel headline field) | `Overview.renderPoCaption` (same `project.narrative.po_caption` field) |
| Wins / asks / customer-visible-risk picker | Stay in walkthrough right-rail only — these are pack-composition, not project-state |
| Project list, top bar, bottom bar, pack picker | Unchanged (walkthrough-shell surfaces) |

## 4. Files to change (single-file app)

All edits to `/Users/zaza/Documents/Projects/portfolio-command-centre/index.html`. The single file is the architecture, per CLAUDE.md. No new files except this plan and tests under `tests/`.

### 4.1 CSS (`<style>` block, ~lines 1099–1131 area)

- Add `.dp-chip-row` (sticky chip TOC under tab strip).
- Add `.dp-readiness-chip`, `.dp-readiness-popover`.
- Add `.dp-undo-toast`.
- Add `.dp-inline-edit` (text-mode → input-mode hover/focus state).
- Tighten `.panel-section-title` H3 spec; introduce `.panel-section-h4`.
- Two-row sticky header: `.panel-sticky-meta-row1`, `.panel-sticky-meta-row2` + `@media (max-width: 540px)` collapse rule.

### 4.2 HTML scaffolding (`#detailPanel`, ~lines 3351–3367)

- Tab strip: `Overview · Delivery · Scope & Value · RAID`.
- Replace `panelJumpMenu <select>` with `<nav class="dp-chip-row">`.
- `panel-sticky-meta` becomes two `<div>` rows.

### 4.3 `DetailPanel` module (~line 17273)

- Rewrite `renderBody(p)`:
  - Build 4 tab section arrays (`overviewSections`, `deliverySections`, `scopeSections`, `raidSections`).
  - Stop appending `renderAuditLog` always; render History inside its own collapsible at the bottom of all tabs, with Recent activity surfaced on Overview only.
- Add `renderOverviewPoCaption(p)`, `renderReadinessChip(p)`, `renderBlockersStrip(p)`, `renderRecentActivity(p)`, `renderMilestonesReadOnly(p)`.
- Add `renderOutcomes(p)` (merged Benefits + Success criteria). Migrate data.
- Add `renderGateReviews(p)` (new register).
- Add `onPrioritisationChange()` to capture re-prioritisation reason → Decision entry.
- Add `onScopeChange()` to capture scope-change reason → Decision entry.
- Drop `_openQuickAddWizard` single-screen; replace with `_openCreateWizard` 3-step (Step 1 mandatory, 2+3 skippable). Reuse existing template + priority-slot logic.
- Drop `collapseAll` / `expandAll` toolbar; chip-row scroll-spy replaces it.
- Add `_routeFromHash()` + `_writeHash()` for deep-linkable `#/p/<id>/<tab>[#<section>]`.
- Add inline edit pattern: every editable cell gets `.dp-inline-edit` wrapper, click → swap to input, blur/Enter → save + undo toast.

### 4.4 Data model — migration

Schema additions, all defaulted so existing data loads cleanly:

- `project.narrative.po_caption` (string ≤ 240 chars, dated) — already partially present as `narrative.headline`; rename or alias.
- `project.outcomes` (array) — built by merging `project.benefits` + `project.success_criteria`. Each row: `{ id, type, description, target, unit, measurement_date, baseline, actual, status, last_checked_at }`.
- `project.gate_reviews` (array) — new register.
- `project.customer_milestones[i].external_commitment` (bool, default false), `.committed_in` (string), `.committed_date` (date).
- `project.risks_register[i].mitigation_owner`, `.mitigation_due_date`.
- `project.last_edited_at`, `project.last_edited_in` ('detail' | 'walkthrough').
- `project.readiness` (computed, not stored) — derive in `App.computeReadiness(p)`.
- `project.stakeholders` gets a new entry type `sponsor_sign_off` with fields `date`, `scope_version`, `sponsor`, `status`, `evidence_link`.

Migration: lift `benefits` and `success_criteria` into `outcomes` with `type` set per source; keep old arrays for one release behind a `legacy_*` rename to allow rollback.

### 4.5 Walkthrough module — UI redesign (`Walkthrough`, ~line 23169)

**Refactor `Walkthrough._renderCenter()` to compose from shared render functions** rather than calling parallel implementations. Drop ~300 lines of duplicate UI code.

Functions to **extract into shared namespace** (called by both `DetailPanel.renderBody` and `Walkthrough._renderCenter`):
- `Overview.renderRagTriplet(p)` — replaces `_cycleRag` + parallel RAG dots
- `Overview.renderPoCaption(p)` — replaces `_narrativeHeadlineChange` headline field
- `Delivery.renderCustomerMilestones(p)` — replaces parallel `_setMilestoneStatus` editor
- `RAID.renderQuickAddRisk(p, ctx)` — replaces `_submitCapture('Risk')` flow
- `RAID.renderQuickAddIssue(p, ctx)` — new (used by Detail panel + Walkthrough)
- `RAID.renderQuickAddDecision(p, ctx)` — replaces `_submitCapture('Decision')` flow
- `RAID.renderRiskRow(p, idx)` — replaces parallel `_closeRisk` / `_acceptRisk` controls
- `RAID.renderMeetingActionRow(p, action)` — replaces parallel `_deferAction` / `_doneAction` controls
- `RAID.RISK_TEMPLATES` — single template list (currently duplicated)

Functions to **delete** from Walkthrough:
- `_cycleRag`, `_setMilestoneStatus`, `_setCaptureTab`, `_submitCapture` (only the dispatcher; quick-add components do the work)
- `_closeRisk`, `_acceptRisk`, `_deferAction`, `_doneAction` (inline in shared row components)
- `_narrativeHeadlineChange` (caption is direct-edit on the shared field)

Functions to **keep** in Walkthrough (meeting-flow shell):
- `open`, `selectProject`, `advanceToNext`, `markProjectReviewed`, `_completeAndClose`
- `_render`, `_renderTopBar`, `_renderProjectList`, `_renderBottomBar`, `_renderCustomerPanel`
- Customer-pack functions: `_openPackPicker`, `_removeNarrativeListItem`, `_narrativeAddListItem`, `_toggleVisibleRisk`
- Keyboard wiring: `_wireKeyboardShortcuts` — extend with `j/k/r/n` per §3.8.5

**Schema/data:**
- `narrative.headline` → renamed/aliased to `narrative.po_caption` (one field shared with Overview header). Migration handles the rename.
- New records created via Walkthrough quick-add chips tagged with `walkthrough_id` (already exists for risks; extend to issues + decisions).
- `last_edited_at` + `last_edited_in` written on every save from either surface (§3.8.7).

**Deep-link round-tripping:**
- Walkthrough → Detail: "Open detail" buttons resolve to `#/p/<id>/<tab>#<section>` based on the click context (risk-row → `raid#risks`; re-prioritise CTA → `scope#prioritisation`; generic → `overview`).
- Detail → Walkthrough: Overview "Open in Walkthrough" CTA opens walkthrough overlay with this project pre-selected and scrolled into left rail.

## 5. Build sequence (do this in this order)

Each phase is independently shippable and reverts cleanly. **Acceptance Criteria (AC)** in each row are the testable conditions that gate ship of that phase — if any AC fails, the phase does not merge.

| Phase | What | Why first | Acceptance criteria |
|---|---|---|---|
| **0. Quick wins** | (a) chip-row TOC + scroll-spy replacing "Jump to…"; (b) default-collapse History + rename; (c) "Last reviewed by/at" chip on existing Health tab; (d) `external_commitment` flag on milestones. | Each is independently valuable, low risk, validates the IA assumptions before committing. UX G#25 + G#27 + PO E#2. | **AC-0.1** "Jump to…" `<select>` removed; sticky `<nav class="dp-chip-row">` renders one chip per visible panel-section; clicking a chip scrolls the section into view; scroll-spy marks the in-view chip `aria-current="location"`. **AC-0.2** Audit-log section renders collapsed by default; title reads "History"; "show all" expander always visible. **AC-0.3** Last-reviewed chip in Health tab shows reviewer name + ISO timestamp from `project.last_reviewed_by_walkthrough_id`; absent when never reviewed. **AC-0.4** `customer_milestones[i].external_commitment` (bool) accepted on load; existing rows default to false; Detail panel edits round-trip through save. |
| **1. Data model migration** | Schema additions + migration runner; outcomes merge; backfill `last_edited_*`. Tests pass against demo data. | Everything after depends on schema. Ship behind feature flag. | **AC-1.1** Loading `portfolio-data.json` + `portfolio-data-demo.json` post-migration: every `benefits[]` row becomes an `outcomes[]` row with `type:'benefit'`; same for `success_criteria[]`; legacy arrays preserved as `legacy_*`. **AC-1.2** `project.last_edited_at` + `last_edited_in` populated on every save path. **AC-1.3** `App.computeReadiness(p)` returns `{backlog:bool, planning:bool, steerco:bool, missing:string[]}` for every fixture project. **AC-1.4** Down-migration round-trip on every fixture produces semantically identical JSON. **AC-1.5** Migration runtime <500 ms on 100-project fixture (SM H#14). |
| **2. Sticky chip TOC + 2-row header + inline edit** | Visual chrome + chip TOC + inline edit pattern. Tabs unchanged. | Decouples chrome rewrite from IA rewrite. | **AC-2.1** Sticky header renders 2 rows on ≥540 px; row 2 collapses to `<sprint id> · X/Y SP` chip <540 px; tap expands inline without pushing tab strip off-screen. **AC-2.2** `.dp-inline-edit` cells render as text with subtle dotted underline; hover tints background; focus reveals input border; blur/Enter saves + emits undo toast (8s). **AC-2.3** Computed/derived fields (EVM strip, WSJF chip, sprint window) render WITHOUT underline or hover state. **AC-2.4** Tab switch with dirty input auto-saves; undo toast appears. |
| **3. Tab IA flip** | Overview / Delivery / Scope & Value / RAID. All section reassignments per §3.2. Deep-link hash routing. Entry-point-aware default. | Big-bang within a single file is OK because the file IS the architecture. | **AC-3.1** Tab strip renders 4 tabs in order `Overview · Delivery · Scope & Value · RAID` with `role="tablist"`, per-tab `role="tab"` + `aria-selected` + `aria-controls`. **AC-3.2** Every panel-section from §3.13 migration map renders in its new home; zero orphans. **AC-3.3** Entry-point routing matches §3.1 table for every entry point (test: 5 fixtures). **AC-3.4** Hash `#/p/<id>/<tab>[#<section>]` round-trips: writing the hash updates the URL; reloading the URL lands on the same tab+section. **AC-3.5** Read-only Identity strip on Overview renders customer chip + sponsor + governance forum even when active tab is not Overview. |
| **4. Wizard 3-step** | New `_openCreateWizard`. Step 1 mandatory only. Suggest-don't-collect for Step 2/3. | Independent of IA flip; ship after IA so wizard's "open Overview" works. | **AC-4.1** Creating a project with only name + customer + size lands on Overview with readiness chip showing "Ready for: backlog ✓, planning ✗, steerco ✗". **AC-4.2** Step 1 has an "Add details later →" button that creates + exits the wizard without entering Steps 2/3. **AC-4.3** Picking a template auto-fills MoSCoW, phase flow, governance forum, strategy link with explicit `Suggested` label; each is editable. **AC-4.4** Step 2/3 every field has a per-field "Add later" affordance; skipping fields does not block create. |
| **5. Inline quick-add chips** | `+ Log risk/issue/decision` on Overview/Delivery contexts. Prioritisation reason + scope-change reason auto-Decision. | Depends on Decisions register being on RAID tab. | **AC-5.1** `+ Log risk` chip on Phase tracker opens a 1-row inline form; saved risk appears in RAID > Risks AND Overview blockers strip without refresh. **AC-5.2** Changing any WSJF input or MoSCoW prompts for a one-line reason; a Decision register entry is auto-created tagged `prioritisation` with the reason in `rationale`. **AC-5.3** Changing total points post-baseline prompts for a one-line reason; auto-creates a Decision tagged `scope-change` with net-delta in `meta.delta`. **AC-5.4** Reason prompt is modal; if cancelled, the field reverts; if confirmed, undo toast appears that undoes both the field change AND the auto-Decision. |
| **6. Walkthrough UI consolidation** | (a) Extract shared render functions out of `DetailPanel` into `Overview` / `Delivery` / `RAID` namespaces; (b) rewrite `Walkthrough._renderCenter` to compose from them; (c) delete parallel implementations (`_cycleRag`, parallel milestone editor, capture-tab machinery, parallel narrative composer, parallel close-risk/accept-risk/defer/done controls); (d) add `j/k/r/n` keyboard shortcuts; (e) bi-directional deep-linking; (f) residual `last_edited_at` + conflict toast for true concurrent edits + in-session display-value pin (§3.8.8). | Requires Phases 1–5 (schema, chrome, IA, inline-edit pattern, quick-add chips) to exist before Walkthrough can compose from them. **This is the big code-removal phase** — net negative LOC, single source of truth becomes structural. | **AC-6.1** DOM snapshot test: `Overview.renderRagTriplet(p)` produces byte-identical output when called from Detail panel vs Walkthrough center pane on the same project. **AC-6.2** All parallel implementations listed in §3.8.2 are deleted from the `Walkthrough` module (verify by grep — `_cycleRag`, `_setMilestoneStatus`, `_setCaptureTab`, `_narrativeHeadlineChange`, `_closeRisk`, `_acceptRisk`, `_deferAction`, `_doneAction` all absent). **AC-6.3** Keyboard: `j`/`k` cycle project selection in left rail; `r` marks reviewed + advances; `n` advances without marking; `g o`/`g d`/`g s`/`g r` open Detail panel at correct tab for selected project; `/` focuses left-rail search; shortcuts scoped to focused overlay only. **AC-6.4** Concurrent-edit pin: edit project name in Detail panel while walkthrough open → walkthrough overlay still displays original name; conflict toast appears; manual reload reflects the new name. **AC-6.5** "Open detail" deep-links resolve to correct sub-section (risk-row → `raid#risks`; re-prioritise CTA → `scope#prioritisation`; generic → `overview`). **AC-6.6** "Open in Walkthrough" from Overview opens walkthrough with that project pre-selected and scrolled into left rail. |
| **7. Gate reviews + Sponsor sign-off log** | New registers on Scope & Value / Delivery, with gate names locked: Discovery / Design / Build / UAT / Live / **Hypercare**. | Lower urgency; gate names confirmed by user 2026-05-13. | **AC-7.1** `project.gate_reviews[]` accepts `{gate_name, planned_date, actual_date?, decision: 'Go'|'No-Go'|'Conditional', sign_off_by?, evidence_link?}`. Gate-name picker offers exactly 6 values: Discovery / Design / Build / UAT / Live / Hypercare. **AC-7.2** Overview "Last gate / Next gate" chip rolls up from `gate_reviews[]` — last = max(actual_date with decision !== null); next = min(planned_date where actual_date is null). **AC-7.3** Sponsor sign-off log row on Stakeholders accepts `{date, scope_version, sponsor, status: 'Approved'|'Conditional'|'Rejected', evidence_link?}` and round-trips through save. |
| **8. Readiness gate enforcement** | Walkthrough list filter; weekly-review banner; backlog visibility rule. | Last because rolling enforcement before the IA settles will produce false negatives. | **AC-8.1** Walkthrough project list shows `setup incomplete` chip on projects where `App.computeReadiness(p).steerco === false`. **AC-8.2** Weekly-review banner shows "N project(s) need setup" linking to the unfit-for-steerco list. **AC-8.3** Solver `Solver.solve` flags + skips projects where `App.computeReadiness(p).planning === false`. **AC-8.4** In-flight projects (status ∈ {In Progress, On Hold, At Risk, Blocked} at the day the gate ships) are auto-marked `legacy_grandfathered = true` and NOT skipped retroactively. **AC-8.5** Readiness chip popover opens on click and lists the missing fields with deep-links to the field on its owning tab. |

## 6. Tests (must pass before each phase ships)

- **Unit:**
  - Migration: existing project with benefits+success_criteria becomes outcomes; legacy arrays preserved.
  - `App.computeReadiness(p)` returns correct gate status per fixture.
  - Re-prioritisation auto-creates a Decision tagged `prioritisation`.
  - Scope-change post-baseline auto-creates a Decision tagged `scope-change`.
- **Render (jsdom):**
  - Tab strip renders 4 tabs with correct ARIA.
  - Chip TOC renders one chip per sub-block of active tab.
  - Empty state for risks shows CTA, not zero-state.
  - EVM strip hidden when no baseline.
  - Inline edit click → input → blur saves + emits undo toast.
- **E2E (Playwright):**
  - New project via wizard with only mandatory fields → lands on Overview → readiness chip shows "Ready for backlog ✓, planning ✗, steerco ✗".
  - Update RAG in Detail panel → open Walkthrough → assert exact same RAG widget, same value, same override reason visible. Cycle RAG in Walkthrough → reopen Detail panel with same project → values match without reload.
  - Deep-link `#/p/<id>/scope#strategy` lands on Scope & Value scrolled to Strategy linkage.
  - `g o / g d / g s / g r` keyboard shortcuts switch tabs.
  - Phase tracker `+ Log risk` chip opens inline form; saved risk visible on RAID tab and on Overview blockers strip.
- **Walkthrough integration (Playwright):**
  - Walkthrough center pane renders the same RAG triplet component as Overview tab (DOM snapshot comparison on `Overview.renderRagTriplet`'s output).
  - Quick-add risk in Walkthrough → record appears in RAID tab with `walkthrough_id` set on the entry.
  - Walkthrough `j/k` cycles project selection; `r` marks reviewed + advances; `n` advances without marking; `g o` opens detail panel at Overview for selected project.
  - `narrative.po_caption` edited in Walkthrough right-rail is immediately reflected in Overview header on next render (and vice versa).
  - Concurrent-edit test: open Detail panel and Walkthrough in two tabs on same project; edit RAG in one → other shows "Updated — Reload" toast within debounce window.
  - "Open in Walkthrough" from Overview opens overlay with correct project pre-selected and scrolled into left rail.

## 7. Decisions explicitly NOT taken (out of scope)

- **Walkthrough shell is preserved** (project list, progress bar, top/bottom bars, customer-pack composer, reviewed-state). Only the center pane and parallel widgets get unified — see §3.8.1 vs §3.8.2.
- **Walkthrough Minutes are removed entirely** (2026-05-13 user decision): the workflow does not need them. The legacy `walkthrough.minutes_html`, `walkthrough.data_updates[]`, and the Walkthrough Minutes report (#3 in the old §9.2) are all dropped from the plan. Sessions still capture decisions/actions/risks into the canonical registers; the audit_log retains every event; the customer pack remains the customer-facing artifact. See §9.3-renamed-DELETED. *(closes the SM/PO/DataEng red lines on minutes integrity by removing the artifact rather than preserving it.)*
- The Solver, capacity model, and Sprint Planning view are untouched.
- No new visualisations (no Gantt redesign, no burn-up). EVM gets demoted, not improved.
- No theme/dark-mode rework.
- Dependencies stay on Delivery tab (not RAID). Revisit if user behaviour says otherwise. *(UX G#4)*
- Walkthrough wins/asks/customer-visible-risk picker stay walkthrough-only (pack-composition fields, not project-state). They are NOT mirrored on the Detail panel.

## 8. Personas — final sign-off (resolved tensions)

| Tension | Asks | Resolution |
|---|---|---|
| Customer milestones — Scope & Value vs Delivery? | E#2, F#3, G#3 | Editable register on **Delivery** with `external_commitment` flag; read-only summary on Overview. |
| Default landing tab — Overview vs working surface? | E#5, G#1 | **Entry-point-aware**: Overview from Dashboard/Walkthrough/share; Delivery from Projects/Backlog/Roadmap; Scope & Value from Strategy. URL hash overrides. |
| Phase sizing — Scope & Value vs Delivery? | F#4, G#10 | **Delivery** (co-located with phase status; SM and UX over-ride initial PO assumption). |
| Identity — split or merged? | F#8, G#2 | **Merged on Scope & Value**; Delivery is pure ops; Overview shows read-only identity strip. |
| Read/Edit mode toggle? | G#5 | **Dropped**. Inline click-to-edit instead. |
| Completion meter vs readiness gate? | E#8, F#11, G#19 | **Readiness gate** with 3 stages; chip in sticky header; enforced in Walkthrough/backlog. |
| Wizard step 2/3 mandatory? | E#7, F#15, G#20 | **Step 1 mandatory only.** Steps 2+3 skippable with "Add later". |
| Benefits + Success criteria split? | E#1, G#10 | **Merged into Outcomes** register with `type` field + realisation fields. |
| Walkthrough ↔ Detail conflict resolution? | E red line, F#10, G#14 | **Shared render functions (§3.8) — SoT is architectural, not contractual.** Residual concurrent-edit toast survives for the laptop-vs-meeting-screen case (§3.8.7). |
| Walkthrough parallel UI (RAG/risks/milestones/narrative) | E#3 + F#1/F#5/F#9 + G#5 implicit | **Walkthrough redesigned to compose from shared Detail-panel render functions (§3.8.2).** Shell stays, parallel widgets deleted. Strict superset of every persona's "no drift" ask. |
| RAID as own tab — capture friction? | F#1, F#5, F#9 | **RAID tab is the register/index**; inline quick-add chips on Overview + Delivery + Phase tracker. |

All three personas endorsed the consensus above with conditions, **all of which are applied inline in §3.1–§3.10a**. Cross-references to sign-off:
- **PO sign-off (H)** — 14/15 resolved + 1 partial→fully addressed via §3.7a (Re-prioritise CTA). All 4 red lines respected. 4 conditions applied: §3.1 routing map, §3.2 RAID Risks/Issues column split, §3.6 grandfathering, scope-change trigger location §3.2.
- **SM sign-off (I)** — 13/15 resolved + 1 partial→addressed via §3.2 Overview#10 (RACI strip) + 1 moot (toggle dropped). 3 conditions applied.
- **UX sign-off (J)** — 22/27 resolved + 3 partial→addressed via §3.10 mobile spec + §3.4 collapse target + §3.3 affordance + §3.10a interaction-order spec + §3.2 Identity More-details disclosure. 5 conditions applied.

**Gate definitions locked (2026-05-13, user confirmation):** Discovery → Design → Build → UAT → Live → **Hypercare**. Phase 7 ships with these names; the "Benefits" final gate is renamed "Hypercare" to match the org's vocabulary. No further sign-off required before Phase 7. *(closes SM I condition)*

## 9. Reports & documentation consistency

Added 2026-05-13 (rev 2). User requirement: full review of all documentation outputs (business review packs, meeting packs, exports, sponsor decks) to ensure consistent creation flow app-wide, no schema fields exist solely to support reports, and data points used by reports are consistent with the canonical project/walkthrough schema. Critiqued by PO, Scrum Master, Data Engineer, and UX designer (see `_scratch_reports_audit.md` sections G–O). All four signed off with conditions; conditions applied inline.

**Rev 3 (2026-05-13):** Walkthrough Minutes report removed entirely per user decision — workflow does not require them. Cascades through §9.2 (one fewer output), §9.3 (deleted), §9.4 (audit_snapshot deleted, data_updates simplified), §9.7/§9.8 (Minutes references removed), §9.12 (R7 reworked), §9.13 (parity test removed), §10 (minutes-related risk rows removed). The 7-output set is the new canonical inventory.

### 9.1 Four principles

1. **One template, one render path.** Every printable doc routes through `Reports.Doc.buildDoc`. No bespoke HTML in any builder.
2. **No schema field exists solely to support a report** — with one named exception: **immutable compliance snapshots** (§9.3). Reports are derivations from canonical state + audit_log + clock.
3. **One shared formatter library** at top-level `Format.*`, called by Reports builders, DetailPanel, AND Walkthrough. Named presets only, no options bag.
4. **Report generation is idempotent and replayable.** Any report can be regenerated at any time from `{canonical state, audit_log + archive + walkthrough audit-snapshot, render clock}`. Where regeneration would silently rewrite history (signed-off documents), a frozen snapshot is captured at sign-off time.

### 9.2 Report inventory — 8 outputs, unified

| # | Output | Scope | Inline trigger | Reports view | Default density |
|---|---|---|---|---|---|
| 1 | Sponsor Pack | project | Detail panel banner button (one-click; Shift-click = preview) | bucket: This project | compact, header-band cover |
| 2 | Business Case | project | Detail panel banner button | bucket: This project | standard |
| 3 | Sprint Brief | customer × sprint | Capacity view button | bucket: This customer | compact |
| 4 | Customer Pack | customer | Walkthrough right-rail "Open pack" + Detail panel inline narrative editor (§9.10) | bucket: This customer | **full** (cover + TOC + appendix; lifecycle-stage grouping preserved) |
| 5 | Portfolio Pack | customer | (none today; replaced by Reports view path) | bucket: This customer | full |
| 6 | Meeting Agenda | forum | **Governance forum row "Agenda" button** *(PO L condition — closes the gap from rev 1)* + Walkthrough → forum action | bucket: This customer | standard |
| 7 | Status Report | cross-customer | (none today; replaced by Reports view path) | bucket: Cross-portfolio | full |

Two of these (Customer Pack #4, Status Report #7) currently bypass `Report.buildDoc` and emit bespoke HTML. Re-templating closes the inconsistency. **Walkthrough Minutes (formerly #3) was removed in rev 3** — see banner above.

### 9.3 ~~Walkthrough minutes — both modes, one report~~ (REMOVED — rev 3)

Walkthrough Minutes are out of scope. The user confirmed (2026-05-13) that the team workflow does not need them. Consequences:

- The Walkthrough Minutes report is removed from the catalogue.
- `walkthrough.minutes_html`, `walkthrough.minutes_sha256`, `walkthrough.minutes_size_bytes` are NOT added to the schema (they were never live; the proposal to add them is withdrawn).
- The existing `walkthrough.minutes_html` field that is written today on `completeWalkthrough` is **deleted** in R7 (the schema reduction that originally aimed at this field), with safe migration (write-then-delete pattern per §9.6: stamp `legacy_minutes_html` for 2 versions, then drop).
- `walkthrough.data_updates[]` becomes a strict deprecation (no replacement read path needed; nothing consumes it after the Minutes report is gone).
- `walkthrough.audit_snapshot[]` materialisation is removed from the plan — its only purpose was to feed Minutes regeneration; without Minutes, the audit_log + audit_log_archive is sufficient for forensic queries.

**Walkthrough sessions still produce** decisions (→ canonical Decisions register §9.4.1), actions (→ canonical Actions register §9.4.2), risks (→ canonical Risks register §9.4.3), and customer-pack narrative (→ Customer Pack report). The session itself is captured in audit_log via `event_type: 'walkthrough_opened' / 'walkthrough_closed'` (§9.5).

**In-session display-value pin** is preserved as a Walkthrough UX behaviour and moved to §3.8.8 (it's about overlay stability during a live meeting, not about minutes specifically).

### 9.4 Schema reductions — single canonical store per register

#### 9.4.1 Decisions — one store, two scopes, three types

- **Canonical store:** `project.decisions_register[]` for project-scoped; **new** `customer.decisions_register[]` for cross-project / portfolio-level decisions captured against a customer rather than one project *(PO G#5)*.
- **Schema:** `{ id, decision, rationale, context, decided_by, dissented_by[], decision_type, walkthrough_id?, forum_id?, project_id?, customer, ts, meta: { origin: 'detail'|'walkthrough'|'governance' } }` where `decision_type ∈ {'Noted', 'Agreed', 'Governance-binding'}` *(PO G#4 + SM H#6/H#7)*.
- **Promotion rule:** at walkthrough quick-add, user picks `decision_type`. Only `Agreed` and `Governance-binding` write to canonical register; `Noted` stays walkthrough-scoped (filterable view). Stops register-bloat at the source.
- **Walkthrough view** = filter canonical register by `meta.walkthrough_id`. `walkthrough.decisions[]` removed as a stored field.
- **Migration:** existing `walkthrough.decisions[]` rows backfill into canonical register; rows without `project_id` land in `customer.decisions_register[]`. Legacy field renamed `legacy_decisions[]`, retained 2 schema versions.

#### 9.4.2 Actions — `forum.actions[]` is canonical

- `forum.actions[]` already exists with `source: 'walkthrough:<id>'` tagging. No new store.
- Walkthrough view = `forum.actions.filter(a => a.source === 'walkthrough:' + wt.id)`, rendered as a "Captured this session" strip in walkthrough top bar *(SM H#5)*. (Minutes-doc reference removed in rev 3.)
- `walkthrough.actions[]` becomes derived. Removed as stored field.
- **Migration dedupe key:** `{description, owner, due_date, source}` composite *(DataEng I#6)*.

#### 9.4.3 Risks — already canonical

`project.risks_register[]` with `added_by_walkthrough_id` already exists. No change.

#### 9.4.4 Section notes — kept walkthrough-scoped

`walkthrough.section_notes` stays on the walkthrough record (SM owns the workflow that captures them). Surfaced as read-only references via `walkthrough_id` in the Detail panel History tab. NOT promoted to a per-project register *(SM H#10 over the original proposal)*.

#### 9.4.5 `walkthrough.data_updates[]` deprecated and dropped

`audit_log` with `meta.walkthroughId` remains the canonical event stream for state changes during walkthroughs. With Minutes removed (§9.3), nothing reads `walkthrough.data_updates[]` anymore. It is dropped via the standard migration pattern: rename to `legacy_data_updates[]` for 2 schema versions, then delete. No view filter needed.

#### 9.4.6 `walkthrough.audit_snapshot[]` ~~materialised at completion~~ (REMOVED — rev 3)

Removed in rev 3. The audit_snapshot existed only to feed Minutes regeneration across audit_log rotation; without Minutes, `audit_log` + `audit_log_archive` is sufficient for any forensic queries on past sessions.

The R4 historic backfill (stamping `meta.walkthroughId` on legacy audit_log entries) is **kept** because it still serves: (a) Recent-list filtering of "what happened during walkthrough X", (b) the optional History tab cross-reference (§9.4.4 section notes). The join source moves from `wt.data_updates[]` to a deterministic time-window join (audit entries between `walkthrough.started_at` and `walkthrough.completed_at` with no other `walkthroughId`).

### 9.5 Audit-log event_type vocabulary

Add `event_type` to audit_log alongside legacy `field`. Closed vocabulary: `field_change`, `report_generated`, `walkthrough_opened`, `walkthrough_closed`, `branding_updated`, `migration_applied`, `report_snapshot_taken`. Legacy `field` populated only when `event_type === 'field_change'`.

**Back-compat read path** *(DataEng N condition)*: code that reads audit_log treats an entry with no `event_type` as `event_type === 'field_change'`. Documented in `CLAUDE.md`. Read code never crashes on missing key.

**`migration_applied` shape** *(DataEng N condition)*: `{event_type:'migration_applied', meta:{from_version, to_version, migration_id, rows_touched, before_hash, after_hash, applied_at}}`. Forensic-replay can identify which migration touched which row.

**Stream split deferred with explicit re-eval trigger** *(DataEng N condition)*: revisit splitting `audit_log` into `audit_log` (state changes) + `app_events` (telemetry) when ANY of: (a) non-`field_change` events > 20% of stream, (b) per-project replay > 100 ms on largest portfolio, (c) future analytics export requires telemetry/state separation. Documented in `CLAUDE.md`.

**Branding writes audit** *(DataEng I#13)*: every `Reports.Brand.set` emits `event_type:'branding_updated'` with `{customer, patch_keys, prev_values_hash}`. No silent brand-drift.

### 9.6 Migration safety contract

Every Reports-work migration (R0–R11) ships with:

- **`up(data)` + `down(data)` functions** — `up` mandatory; `down` mandatory whenever a field is deleted *(DataEng I#7)*.
- **`schema_version` bump** every migration.
- **Version-rejection on load**: if loaded data's `schema_version > app version`, refuse to mutate; show "saved by newer version" dialog with download-snapshot escape hatch *(DataEng I#15 — red line)*.
- **Legacy retention 2 schema versions**, not 1 *(DataEng I#8)*.
- **`migration_applied` audit entry** every migration run.
- **Never delete a field without writing `legacy_<name>` first**.
- **Migrations run <500 ms** on a 100-project portfolio, never blocking Walkthrough overlay *(SM H#14)*.

### 9.7 Document template controls

`Reports.Doc.buildDoc({customer, title, subtitle, sections, reportType, density, coverPage, tocPage, includeAppendix, classification})`:

| Option | Values | Defaults by report |
|---|---|---|
| `density` | `compact` \| `standard` \| `full` | Sponsor Pack/Sprint Brief `compact`; Business Case/Forum Agenda `standard`; Customer Pack/Portfolio Pack/Status Report `full` |
| `coverPage` | `full` \| `header-band` \| `none` | Compact → `header-band`; standard/full → `full` |
| `tocPage` | boolean | Compact → off; else on if ≥ 3 sections |
| `includeAppendix` | boolean | Full → on; else off |
| `classification` | `Public` \| `Internal` \| `Confidential` \| `Restricted` | Chosen at generate-time, **sticky per-report-type default**. Sponsor/Customer Pack default `Confidential`; Status Report default `Internal` *(UX J#4)* |

Classification renders as a visual band (top + bottom) on every page, colour-coded with `print-color-adjust: exact`: `Confidential` red, `Restricted` purple, `Internal` grey, `Public` none *(UX J#11)*.

### 9.8 Module structure

| Namespace | Responsibility |
|---|---|
| `Reports.Doc` | Template engine. `buildDoc`, `_coverPage` (3 variants), `_tocPage`, `_appendix`, `_baseStyles`, `_classificationBand`. |
| `Reports.Builders` | One per output: `projectPack`, `businessCase`, `sprintBrief`, `customerPack`, `portfolioPack`, `forumAgenda`, `statusReport`. **Read-only over canonical state + audit_log + Format.** *(DataEng I#2)* |
| `Reports.Brand` | `for(customer)` with **3-tier deep-merge** (portfolio default → customer override → hardcoded), `set`, `configureModal`, `previewModal`, `defaultsForPortfolio` *(DataEng I#12)*. |
| `Reports.Catalogue` | Metadata: `{id, title, description, scope, requiresFields[], requiresScopeArg, defaultClassification, doesNotInclude}` per report. |
| `Reports.View` | Sidebar view — bucketed catalogue + Recent list + Preview overlay. Cmd+K verb `"Generate report…"` *(UX J#12)*. |
| `Format` (top-level) | Named-preset formatters: `statusBadge(p)`, `ragDots(p)`, `ragShorthand(p)`, `ragVerbose(p)`, `sprintId(id)`, `riskScore(r)`, `dateShort(d)`, `dateDaysLeft(d)`, `currency(n, ccy)`, `percent(n)`, `personChip(name)`, `lifecycleStage(p)`, `memberLoad(member, sprintId)`. **No options bag** — callers pick a preset *(UX J#7 + DataEng I#11 + SM H#8)*. Used by DetailPanel, Walkthrough, AND Reports.Builders. |

### 9.9 Reports view UX

- **Sidebar entry** below Governance, above Configuration. Cmd+K verb `"Generate report…"`.
- **Bucketed catalogue**: This project / This customer / Cross-portfolio.
- **Per-card metadata**: title, one-line description, scope-arg picker if needed, **"Last generated" stamp**, **readiness state** (greyed-out + tooltip when required fields missing — same pattern as §3.6 readiness-gate), **"Does NOT include"** line per report *(PO G#13)*.
- **Recent list query** *(SM M condition)*: `audit_log.filter(e => e.event_type === 'report_generated').sort(ts desc).limit(20)`. Each row: `{report_type, scope_arg, ts, generated_by, walkthrough_id?, output_size_bytes}`. "Did we send the customer pack last week?" answered by `report_type === 'customer_pack' AND scope_arg === <customer>` sorted by `ts desc`.
- **"Re-generate"** *(UX O condition)*: re-opens Preview overlay with saved scope-args + classification pre-filled, NOT a silent re-fire.
- **Contextual entry points retained** *(PO L condition)*: Detail panel banner (Sponsor Pack + Business Case today; Customer Pack added), Walkthrough right-rail (Customer Pack), **Governance forum row "Agenda" button** (added — closes the PO G#9 gap). (Walkthrough Minutes entry point removed in rev 3.)
- **First-run empty state**: worked example against demo data *(UX J#13)*.
- **Preview overlay**: iframe of cover + TOC + first section. Buttons: "Download PDF" / "Print" / "Copy link" / "Back to args". Always-on from Reports view; quick-action buttons remain one-click; **Shift-click = preview** *(UX J#8 — red line preserved)*.
- **html2pdf decision** *(UX O condition)*: R8 ships with feature flag `reports.enableHtml2pdf = false`. Download PDF button calls `window.print()` when off, html2pdf when on. Bundle shipped behind the flag, disabled at launch. Decision to flip taken in a follow-up.
- **Copy-link URL shape** *(UX O condition)*: `#/report/<reportId>?<scope_args>&classification=<class>` — e.g. `#/report/sponsor_pack?projectId=acme-001&classification=Confidential`. Opens Reports view with that report selected + args pre-filled in Preview. Does NOT auto-fire.

### 9.10 Mid-week narrative edit

PO can edit `narrative.wins / asks / customer_visible_risk_ids` from Detail panel Overview — opens an "Edit customer narrative" side-drawer with the same three lists Walkthrough right-rail exposes. Same canonical store, second editing surface. Closes the §3.8.3 gap that those fields were walkthrough-only-editable *(PO G#6)*.

### 9.11 Business Case schema expansion

Replace flat `benefit_annual_gbp + benefit_horizon_years` with:

```
project.business_case = {
  cost_items[]: [{ id, category, year, amount, currency }],
  benefit_items[]: [{ id, type: 'cashable'|'non-cashable'|'avoidance', year_from, year_to, annual_amount, currency, ramp_curve? }],
  assumptions[]: [{ id, text, sensitivity_low_gbp?, sensitivity_high_gbp? }],
  discount_rate,
  status: 'Draft'|'In Review'|'Approved'|'Rejected'|'Superseded',
  approved_by, approved_at, approval_meeting_id?,
  version, supersedes_business_case_id?,
  legacy_benefit_annual_gbp?, legacy_benefit_horizon_years?  // back-compat shim
}
```

Business Case report renders status prominently, shows year-by-year cashflow table, derives NPV with working, surfaces sensitivity envelope *(PO G#7/G#8)*. Migration lifts legacy fields into a single `benefit_items[0]` row.

### 9.12 Build sequence (R0–R11)

Each phase independently shippable and revertable. Sits after the parent plan's Phase 8 (readiness gate enforcement); does not block phases 0–8.

| Phase | What | Depends on | Risk | Acceptance criteria |
|---|---|---|---|---|
| **R0** | Top-level `Format.*` library, named presets. Migrate DetailPanel + Walkthrough + existing Report call-sites. No schema change. | nothing | low | **AC-R0.1** `Format.ragDots(p)` / `ragShorthand(p)` / `ragVerbose(p)` / `statusBadge(p)` / `sprintId(id)` / `riskScore(r)` / `dateShort(d)` / `dateDaysLeft(d)` / `currency(n, ccy)` / `percent(n)` / `personChip(name)` / `lifecycleStage(p)` / `memberLoad(member, sprintId)` all exist as exported functions. **AC-R0.2** Every preset has unit tests for happy/empty/edge inputs. **AC-R0.3** No `Format.*` function accepts an options bag — verified by signature inspection. **AC-R0.4** `grep -n "rag.*dots\|rag.*verbose"` in `index.html` shows DetailPanel + Walkthrough + Report.* all call `Format.*` (no inline rendering remains). |
| **R1** | `Reports.Doc` (today's buildDoc + density/coverPage/tocPage/classification controls + visual classification band). `Reports.Brand` (3-tier deep-merge + branding audit log). `Reports.Catalogue`. | R0 | low | **AC-R1.1** `Reports.Doc.buildDoc({density, coverPage, tocPage, includeAppendix, classification, …})` honours all 5 options per §9.7 defaults. **AC-R1.2** Classification band renders at top + bottom of every page, colour-coded per §9.7; verified by Chromium headless print snapshot. **AC-R1.3** `Reports.Brand.for(customer)` deep-merges `settings.branding.portfolio_default` → `settings.branding[customer]` → hardcoded; a customer that overrides only `primaryColor` still inherits the portfolio logo. **AC-R1.4** `Reports.Brand.set(...)` emits `audit_log` entry with `event_type:'branding_updated'`. **AC-R1.5** `Reports.Catalogue` lists all 7 reports with `{id, title, description, scope, requiresFields[], requiresScopeArg, defaultClassification, doesNotInclude}` populated. |
| **R2** | Re-template Customer Pack via `Reports.Doc.buildDoc`. **PO is named sign-off owner** *(PO L condition)*; visual-diff side-by-side; sign-off recorded as audit entry. Preserves: lifecycle-stage grouping, Wins, "We need from you" asks, customer-visible risks, "What's next" sprint roadmap. | R1 | medium (content parity) | **AC-R2.1** New Customer Pack output contains all 5 content blocks (lifecycle headlines, Wins, "We need from you" asks as own visible section, customer-visible risks, "What's next" sprint roadmap) in that order. **AC-R2.2** Visual-diff side-by-side recorded as PR artifact; PO sign-off recorded as `audit_log` entry `{event_type:'migration_applied', meta:{migration_id:'R2-customer-pack-cutover', approved_by:'<PO name>'}}` before the legacy `Report.buildCustomerPackDoc` path is deleted. **AC-R2.3** Cover, classification band, appendix all present on new output (consequence of `buildDoc`); diff-check confirms no content drop versus the legacy bespoke HTML. |
| **R3** | Re-template Status Report via `Reports.Doc.buildDoc`. | R1 | low | **AC-R3.1** New Status Report output contains cover + TOC + classification band + appendix + all sections currently produced by `App.exportStatusReport`. **AC-R3.2** Cross-customer fixture (3 customers, 15 projects) produces a doc with one section per customer + the executive narrative + exceptions table + upcoming milestones. **AC-R3.3** Default classification = `Internal` per §9.7. |
| **R4** | `event_type` field + closed vocabulary + back-compat read path + historic backfill stamping `meta.walkthroughId`. Branding audit. | R1 | low | **AC-R4.1** New audit_log writes set `event_type` from the closed vocabulary (`field_change` / `report_generated` / `walkthrough_opened` / `walkthrough_closed` / `branding_updated` / `migration_applied`). **AC-R4.2** Read code with `entry.event_type === undefined` treats as `field_change` and does not crash. **AC-R4.3** Historic backfill: fixture with pre-rev3 audit_log + completed walkthroughs runs the migration → every audit row written between `walkthrough.started_at` and `walkthrough.completed_at` for that walkthrough gains `meta.walkthroughId`; migration row records `{matched, unmatched}` counts. **AC-R4.4** `migration_applied` entry shape includes `from_version` + `to_version` + `migration_id` + `rows_touched` + `before_hash` + `after_hash`. |
| **R5** | Decisions consolidation: single canonical store with `meta.origin` + `decision_type` + `customer.decisions_register[]`. Walkthrough view = filter. `legacy_decisions[]` retained 2 versions. | R4 | high (schema + data) | **AC-R5.1** Every existing `walkthrough.decisions[]` row backfilled into `project.decisions_register[]` (where `project_id` present) or `customer.decisions_register[]` (where not); zero rows lost; counts logged in `migration_applied` audit. **AC-R5.2** Walkthrough quick-add prompts for `decision_type` ∈ {Noted, Agreed, Governance-binding}; only Agreed + Governance-binding write to canonical register; Noted stays walkthrough-scoped. **AC-R5.3** Detail panel RAID > Decisions filter offers `meta.origin` toggle (All / Detail / Walkthrough / Governance). **AC-R5.4** Schema rows include `{id, decision, rationale, context, decided_by, dissented_by[], decision_type, walkthrough_id?, forum_id?, project_id?, customer, ts, meta}`. **AC-R5.5** Legacy `legacy_decisions[]` retained on every walkthrough record for 2 schema versions. |
| **R6** | Actions consolidation: `forum.actions[]` canonical, walkthrough view = filter. "Captured this session" strip. | R4 | medium | **AC-R6.1** Every existing `walkthrough.actions[]` row deduped against `forum.actions[]` using `{description, owner, due_date, source}` composite key; matched rows preserve `forum.actions` copy, unmatched rows inserted with `source:'walkthrough:<id>'`. **AC-R6.2** Walkthrough top bar renders "Captured this session" strip showing `forum.actions.filter(a => a.source === 'walkthrough:' + wt.id)`. **AC-R6.3** `walkthrough.actions[]` removed as stored field (retained as `legacy_actions[]` for 2 versions). |
| **R7** | Walkthrough Minutes removal: drop `walkthrough.minutes_html` write on `completeWalkthrough`; rename existing field to `legacy_minutes_html` for 2 versions then delete; remove the Minutes export button + builder. Drop `walkthrough.data_updates[]` writes (legacy retention 2 versions). | R4 + R5 | low (deletion) | **AC-R7.1** `completeWalkthrough(id)` no longer writes `wt.minutes_html`; verified by grep. **AC-R7.2** Existing `wt.minutes_html` values renamed to `legacy_minutes_html` on load (one-time per record); 2-schema-version retention before final deletion. **AC-R7.3** Walkthrough top bar no longer renders "Export minutes" button. **AC-R7.4** `Report.exportWalkthroughMinutes`, `Report.buildWalkthroughMinutesDoc` deleted; `Reports.Builders.walkthroughMinutes` not present. **AC-R7.5** `walkthrough.data_updates[]` renamed to `legacy_data_updates[]`; not written by new code; nothing reads it after R7. |
| **R8** | Reports view sidebar — bucketed catalogue, Recent list, readiness state, Preview overlay (with html2pdf feature flag, copy-link URL shape, Re-generate re-opens Preview), classification picker, "Does NOT include" lines, first-run worked example. Cmd+K verb. **Forum-row Agenda button added.** | R1 + R4 | medium | **AC-R8.1** Sidebar entry "Reports" sits between Governance and Configuration; clicking opens the Reports view. **AC-R8.2** Cmd+K shows "Generate report…" verb-named entry. **AC-R8.3** Catalogue renders 7 reports bucketed `This project / This customer / Cross-portfolio`. **AC-R8.4** Each card shows title, description, "Does NOT include" line, "Last generated" stamp (when present), readiness state (greyed-out + tooltip when required fields missing). **AC-R8.5** Empty-state on first run shows worked-example tile against demo data. **AC-R8.6** Recent list renders last 20 entries from `audit_log.filter(e => e.event_type === 'report_generated').sort(ts desc).limit(20)`. **AC-R8.7** Clicking "Re-generate" re-opens Preview overlay with saved scope-args + classification pre-filled, NOT a silent re-fire. **AC-R8.8** Preview overlay buttons: Download PDF, Print, Copy link, Back to args. Download PDF calls `window.print()` when `reports.enableHtml2pdf` is false; calls html2pdf when true. **AC-R8.9** Copy-link URL shape matches `#/report/<reportId>?<args>&classification=<class>`; opening the link lands in Reports view with args pre-filled in Preview; does NOT auto-fire. **AC-R8.10** Governance forum row has an "Agenda" button that opens Preview for that forum's Meeting Agenda. **AC-R8.11** Detail-panel quick-action buttons (Sponsor Pack, Business Case) still one-click → print; Shift-click opens Preview. |
| **R9** | Detail-panel inline narrative editor (§9.10). Mid-week narrative edit no longer requires walkthrough. | parent §3.8 + R1 | low | **AC-R9.1** Overview > "Edit customer narrative" side-drawer opens from the PO weekly caption row; shows wins/asks/customer-visible-risk-id lists. **AC-R9.2** Edits round-trip through `App.updateProjectNarrative` (existing method); same canonical store as Walkthrough right-rail. **AC-R9.3** No walkthrough session required to open the drawer. |
| **R10** | Business Case schema expansion (§9.11). New report renders cashflow + sensitivity. Migration of legacy fields. | R5 + R7 | high (schema + data) | **AC-R10.1** `project.business_case` accepts `{cost_items[], benefit_items[], assumptions[], discount_rate, status, approved_by, approved_at, approval_meeting_id?, version, supersedes_business_case_id?, legacy_benefit_annual_gbp?, legacy_benefit_horizon_years?}`. **AC-R10.2** Migration lifts legacy `benefit_annual_gbp` + `benefit_horizon_years` into a single `benefit_items[0]` row with `type:'cashable'`, `year_from:<today>`, `year_to:<today>+horizon`, `annual_amount:<legacy>`; legacy fields preserved per §9.6. **AC-R10.3** Business Case report renders status pill prominently, year-by-year cashflow table, NPV with calculation shown, sensitivity envelope from `assumptions[].sensitivity_low_gbp / sensitivity_high_gbp`. **AC-R10.4** For every fixture project, post-migration NPV equals pre-migration NPV to within 0.5%. |
| **R11** | Audit-log report-generation entries (`event_type:'report_generated'` + `walkthrough_id` when active). Recent list reads from these. | R4 + R8 | low | **AC-R11.1** Every successful `Reports.*` export emits `audit_log` entry `{event_type:'report_generated', meta:{report_type, scope_arg, generated_by, walkthrough_id?, output_size_bytes}}`. **AC-R11.2** Reports view Recent list reflects new entries within 1s of export completion. **AC-R11.3** `walkthrough_id` is populated when the export happens with a walkthrough overlay open. |

### 9.13 Tests

- **Migration replays**: real `portfolio-data.json` from pre-Reports-work runs through every R-phase migration; asserts zero decisions/risks/business-case data loss *(PO G#14)*.
- **Walkthrough overlay cold-load <500 ms** after R3+R4+R5 on a 100-project, 52-walkthrough fixture *(SM H#14)*.
- **Down-migration round-trip**: every `up` round-trips through `down` + `up` with no semantic change.
- **Classification band print fidelity**: snapshot test against Chromium headless print.
- **Format library**: every preset has unit tests for happy path, empty/null, edge case.
- **Decision promotion gate**: a `Noted` decision captured in walkthrough does NOT appear in `project.decisions_register[]`; an `Agreed` decision does.
- **Concurrent-edit pin**: walkthrough open, project name changes via Detail panel, walkthrough overlay still renders the original name until reload *(§3.8.8)*.
- **R7 minutes-removal migration**: existing fixture with non-null `walkthrough.minutes_html` runs through R7; field renamed to `legacy_minutes_html`; no UI references the field after migration; smoke-test of walkthrough open/complete cycle passes without writing minutes.

### 9.14 Out-of-scope (deferred)

- Splitting `audit_log` into `audit_log` + `app_events` two streams — re-eval trigger in §9.5.
- Email delivery from Print toolbar — needs backend.
- html2pdf direct PDF download — shipped behind feature flag in R8, decision to enable taken in a follow-up.

### 9.15 Persona sign-off

| Persona | Verdict | Conditions applied in |
|---|---|---|
| PO (L) | Sign off with conditions | §9.2 row 7 (Forum-row button), §9.12 R2 (PO named sign-off owner) |
| SM (M) | Sign off with conditions | §3.8.8 (in-session pin, relocated rev 3), §9.4.6 (R4 backfill via time-window join, rev 3), §9.9 (Recent-list query spec) |
| Data Engineer (N) | Sign off with conditions | §9.5 (back-compat read, `migration_applied` shape, split re-eval) |
| UX (O) | Sign off with conditions | §9.9 (html2pdf flag, copy-link spec, Re-generate re-opens Preview) |

All 58 prior asks across G/H/I/J resolved; full mapping in `_scratch_reports_audit.md` §K17.

## 10. Risks of this plan

| Risk | Likelihood | Mitigation |
|---|---|---|
| Migration loses data when merging benefits + success criteria | low | Keep `legacy_benefits` / `legacy_success_criteria` for one release; test against `portfolio-data.json` + `portfolio-data-demo.json`. |
| Inline click-to-edit reads as broken to users used to obvious inputs | medium | Phase 2 ships chip TOC + 2-row header first; inline edit gated on user testing. Fallback: explicit pencil icon affordance. |
| Wizard "soft-required" produces incomplete projects that clutter the board | medium | Readiness gate (Phase 8) is the controlling mechanism. Until Phase 8, surface incompleteness as a chip but don't enforce. |
| Walkthrough integration drifts during phased rollout | low (post-Phase 6) | Shared components make drift impossible by construction — `Overview.renderRagTriplet` returns the same DOM no matter who calls it. Phase 6 is the gate; document the shared namespace in `CLAUDE.md` once it lands. |
| Tab reorder confuses returning users | low | Default-landing now respects entry-point, so most users don't see the reorder. Add a one-time "What's new" toast on first Detail-panel open post-flip. |
| Phase 6 refactor regresses an existing Walkthrough behaviour that wasn't captured | medium | Pre-Phase-6 step: snapshot-test current Walkthrough flows (markProjectReviewed, capture-risk, defer-action, narrative composer, pack export) against demo data; replay all snapshots post-refactor. Document any intentional behaviour changes vs regressions. |
| Shared render functions accumulate Walkthrough-vs-Detail conditional logic (`if (ctx.surface === 'walkthrough')`) and become hard to reason about | medium | Components accept a `ctx` parameter for surface-specific affordances (e.g. `ctx.walkthroughId` to tag new records) but **never branch on `ctx.surface` for layout or styling**. If a component truly needs different shape per surface, it gets split into two named components instead of branching. |
| Walkthrough keyboard shortcuts (`j/k/r/n`) collide with detail-panel shortcuts (`g o/d/s/r`) | low | Shortcuts are scoped to the focused overlay — `j/k/r/n` only fire when Walkthrough overlay has focus; `g o/d/s/r` only when Detail panel has focus. Documented in §3.8.5 + tested. |
| Customer Pack re-template (R2) silently drops a load-bearing block (lifecycle headlines, asks section, "What's next") | medium | PO is the named sign-off owner (§9.12 R2). Visual-diff side-by-side, audit-logged. Cannot delete bespoke path until sign-off recorded. |
| Audit_log rotation truncates an older walkthrough's session events before they're needed (e.g. for History tab cross-reference) | low | `audit_log_archive` retains rotated entries indefinitely; History tab queries union(`audit_log`, `audit_log_archive`). Tested with 100-project / 52-walkthrough fixture. |
| R7 minutes-removal deletes the field but legacy data is needed for a sponsor dispute reference within the 2-version retention window | low | `legacy_minutes_html` retained on every walkthrough record for 2 schema versions. After 2 versions, the field is genuinely gone (consistent with "we don't need minutes" decision). Documented in CLAUDE.md so a future PO knows where to look during the retention window. |
| Decision-promotion in R5 spams `project.decisions_register[]` with low-value walkthrough chatter | medium | `decision_type` gate at capture — only `Agreed` / `Governance-binding` promote; `Noted` stays walkthrough-scoped. SM is the gatekeeper at capture time, not a downstream filter. Tested. |
| Business Case migration (R10) corrupts existing legacy NPV calculations | medium | Lift `benefit_annual_gbp` + `benefit_horizon_years` into a single `benefit_items[0]` row only; legacy fields retained 2 versions as `legacy_*`; new NPV must match old NPV to ≤0.5% for every project in fixture before R10 ships. |
| html2pdf bundle adds friction (load time, memory) for users who never click "Download PDF" | low | Shipped behind feature flag `reports.enableHtml2pdf = false` (§9.9). Bundle loaded lazily only when flag flipped. Decision to enable taken in follow-up after measuring print-as-PDF friction. |
| Reports view becomes a feature-dump (8 cards, no scent) | medium | Bucketed catalogue (This project / This customer / Cross-portfolio) + Recent list + worked-example empty state + readiness state on cards (§9.9). Validated against UX heuristic before R8 ships. |

## 11. Acceptance criteria patterns (non-phase elements)

Build phases get bespoke AC inline (§5 main + §9.12 reports). For repeated structural elements that appear many times across the plan, the AC is the same shape every time; this section defines those patterns once. Any new element added to the plan inherits its applicable pattern automatically.

### 11.1 Every tab sub-block (Overview / Delivery / Scope & Value / RAID — §3.2)

For each numbered sub-block (Overview #1–#10, Delivery #1–#7, Scope & Value #1–#5, RAID #1–#6) the AC pattern is:

- **AC-§3.2.a** Renders without error from empty project state (all relevant fields null/undefined/empty array).
- **AC-§3.2.b** Renders without error from partial state (some fields present, others empty).
- **AC-§3.2.c** Renders correctly from full fixture state (verified against demo data snapshot).
- **AC-§3.2.d** Every editable field uses `.dp-inline-edit` (per §3.3 / §2.2 above) and round-trips through `App.updateProject` (project-scoped) or the appropriate `App.update*` for narrative / risks / decisions / outcomes / milestones / etc.
- **AC-§3.2.e** Headers use `<h3>` (sub-block) / `<h4>` (optional sub-grouping); no bold-as-heading (per §3.11).
- **AC-§3.2.f** Reachable by keyboard alone — tab order matches visual order; chip TOC entry exists per sub-block.
- **AC-§3.2.g** Empty-state per §3.9: registers show 1-line CTA card, not blank grid; computed metric chips show `—` not `0`.
- **AC-§3.2.h** Any field whose change emits a Decision (re-prioritisation §3.2 Scope&Value#2; scope-change §3.2 Delivery#2) honours the §3.10a interaction-order spec (modal reason prompt → undo toast → conflict toast queued).

### 11.2 Every new register (Outcomes, Gate reviews, Sponsor sign-off log, customer.decisions_register, etc.)

- **AC-reg.a** Schema is fully specified — every field has a type + nullability + default.
- **AC-reg.b** Add / edit / delete round-trip through save + render without page reload.
- **AC-reg.c** Empty state shows 1-line CTA card with `+ Log first <item> →` button (per §3.9).
- **AC-reg.d** Append-only registers never delete a row in v1; "delete" affordance soft-marks `status='closed'` or `archived_at`.
- **AC-reg.e** Every row has a stable `id` and a `ts` of last edit.
- **AC-reg.f** Any cross-register link uses an `id` reference, not a denormalised copy.

### 11.3 Every migration (R0–R11 + parent Phase 1)

- **AC-mig.a** `up(data)` is idempotent — running it twice on the same data produces the same result as running it once.
- **AC-mig.b** `down(data)` exists whenever a field is deleted; round-trips `up(down(up(data))) === up(data)` for every fixture.
- **AC-mig.c** `schema_version` bump is recorded.
- **AC-mig.d** `migration_applied` audit entry written with `{from_version, to_version, migration_id, rows_touched, before_hash, after_hash, applied_at}`.
- **AC-mig.e** No field is deleted without a `legacy_<name>` shadow retained for 2 schema versions.
- **AC-mig.f** Loading a file with `schema_version > app version` triggers the "saved by newer version" dialog; the app does NOT silently mutate.
- **AC-mig.g** Migration runs <500 ms on the 100-project, 52-walkthrough fixture; never blocks the Walkthrough overlay opening.
- **AC-mig.h** Migration replay test: real `portfolio-data.json` runs end-to-end through every R-phase migration; zero data loss on canonical registers; legacy fields preserved.

### 11.4 Every `Format.*` preset (§9.8)

- **AC-fmt.a** Function exists at top-level `Format` namespace.
- **AC-fmt.b** Signature accepts only the input (no options bag).
- **AC-fmt.c** Unit tests cover: happy path, null/undefined input, empty-state input, edge case (e.g. for `dateDaysLeft`: today, in past, in future, in ≤7 days).
- **AC-fmt.d** Called from DetailPanel, Walkthrough, AND Reports.Builders — at least one call-site for each (verified by grep).
- **AC-fmt.e** Pure: no DOM mutation, no `App.*` side effect, only string return.

### 11.5 Every report builder (§9.8 `Reports.Builders.*`)

- **AC-rb.a** Read-only over canonical state + audit_log; never writes to `App.data` except for the per-export audit entry (which is emitted by the wrapper, not the builder).
- **AC-rb.b** Returns `{title, subtitle, sections, density, coverPage, classification, reportType}` consumed by `Reports.Doc.buildDoc`.
- **AC-rb.c** Honours the per-report-type defaults from §9.7 unless explicitly overridden via the Preview overlay.
- **AC-rb.d** Idempotent — calling with the same scope-arg + canonical state + clock returns the same output bytes.
- **AC-rb.e** Catalogue entry in `Reports.Catalogue` is populated: `{id, title, description, scope, requiresFields[], requiresScopeArg, defaultClassification, doesNotInclude}`.
- **AC-rb.f** Visual classification band renders on every page; matches the chosen classification.
- **AC-rb.g** Empty / partial state renders gracefully — sections with no data render as "No <item> recorded" not as empty tables.

### 11.6 Every architecture decision in §3.3 – §3.13 (singletons)

- **AC-arch.a** Each architecture decision (toggle dropped §3.3, sticky 2-row header §3.4, chip-row TOC §3.5, readiness gate §3.6, wizard §3.7, walkthrough shell §3.8, empty states §3.9, focus/undo/keyboard §3.10, ARIA §3.11, History §3.12) has at least one corresponding test row in §6 OR §9.13.
- **AC-arch.b** Each decision references the persona-ask ID(s) it resolves (e.g. *UX G#5, PO E#3* parenthetical); the §8 persona-sign-off table maps every resolved ask back to its decision location.
- **AC-arch.c** No decision contradicts another decision earlier in §3 — verified by editorial pass at PR review time.

### 11.7 §10 risks (informational, not deliverable)

Risks are not phase deliverables, so they do not have AC in the testable sense. Their "AC" is the mitigation column: each risk's mitigation must be implemented before or during the phase named in the mitigation text. Risk rows without a phase-attached mitigation are reviewed at the start of each phase to confirm they remain low-probability.

---

**How to read this section:** when picking a phase to implement, start with that phase's bespoke AC (§5 or §9.12) AND apply the relevant pattern from §11 to every element the phase touches. The combination is the full "done" definition. If an element doesn't match any pattern in §11, add a new pattern here instead of bespoke AC — patterns are reusable, bespoke AC isn't.
