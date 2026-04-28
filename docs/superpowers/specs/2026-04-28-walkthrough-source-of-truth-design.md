# Walkthrough as Single Source of Truth — Design

**Authors**: Senior Manager (Portfolio Owner) + Senior UX Designer
**Date**: 28 April 2026
**Branch**: `walkthrough-source-of-truth` (off `main`)
**Endorsement bar**: every signal captured during the live walkthrough lands on the underlying project record without a follow-up admin pass; the customer pack auto-rolls-up from the same captures, killing the deck-prep cycle.

---

## 1. The brief

The walkthrough is a **live meeting** (manager + scrum master + product owner + stakeholders), with **variable pace per project** — some projects are reviewed in 10 seconds ("nothing new, on track"), others spawn 10-minute discussions. Today's overlay handles the easy projects fine but five gaps make the meeting feel like data entry that only feeds itself rather than the project record.

| # | Gap | What "feeding back" means |
|---|---|---|
| G1 | Decisions / actions captured in the walkthrough are siloed | A decision should land on the project + audit log; an action should file into the relevant governance forum + project record + the assignee's My Actions queue |
| G2 | Chip-level progress is captured but no velocity / burndown side effects | Updating chip completion already writes to `skill_splits`; needs to also update sprint-level rolling throughput so the next walkthrough sees the right "since" delta |
| G3 | "Last reviewed" is a card-collapse flag, not a project property | A reviewed project should bump `last_reviewed_at` so the stale-detector uses the real cadence (not just `last_updated`, which any auto-edit can satisfy) |
| G4 | The reviewer has to remember what to ask each project | The walkthrough should surface **prompts** derived from each project's signals: "amber on schedule for 14 days — log a mitigation?", "stale 27 days — confirm chip progress?", "risk score 9 open 9 days — still real?" |
| G5 | The next customer presentation is a separate prep cycle | Capture the customer-facing narrative inline (headline, wins, asks, customer-visible risk flags); regenerate a printable customer pack on demand |

**Hard requirement**: nothing in the walkthrough lives in isolation. Every field on screen has a clear "↦ where it lands" target on the project record.

---

## 2. The shape — Master / Detail / Customer

```
┌──────────────────────────────────────────────────────────────────┐
│ Walkthrough — GCC · 12 Apr · ━━━━━━━━━░░░ 8/23  [4 crit · 9 watch · 10 steady]  Export · Done · ×│
├──────────┬────────────────────────────────────────┬──────────────┤
│ Project  │ Centre — ONE project, fits in viewport │ Customer     │
│  list    │                                        │  pack panel  │
│ (220px)  │ Header (name · attention · ✓ Reviewed) │ (320px)      │
│          │ Prompts strip (3 prompts in amber)     │              │
│ search   │ Signal grid                            │ Headline     │
│  ─────   │   Health (RAG + status select)         │ ───────      │
│ ✓ Wellb… │   Sprint chips (DE 12/20, UAT 0/5)     │ Wins         │
│ ▶ Metrics│   Since-last-walkthrough (7 changes)   │  +DE estimate│
│ ○ PureI… │ Open risks (2)  │  Open actions (2)    │  +UAT-ready  │
│ ⚠ Topics │ Capture tabbed (Decision · Action ·    │ Asks         │
│ ✓ Shrink…│   Risk · Comms note)                   │  +DQ SME     │
│          │                                        │ Risks        │
│          │                                        │  ☑ Data Q…   │
│          │                                        │  ☐ SME un…   │
│          │                                        │ [Generate]   │
├──────────┴────────────────────────────────────────┴──────────────┤
│ 5 decisions · 3 actions · 2 risks closed · 1 raised      Save · Next →│
└──────────────────────────────────────────────────────────────────┘
```

Why this layout:

- **Project list always visible left** — when a stakeholder asks "what about Project X?" mid-meeting, you click X. No back-button gymnastics. Reviewed projects strike through.
- **Centre column is one project at a time** — for the common case the entire review state fits in viewport without internal scroll. A dense project's centre column scrolls within itself; the left rail and customer panel stay anchored.
- **Customer pack accrues live** — the right column is a persistent compose surface. Type the headline for project A, switch to project B, type its headline; by the end of the meeting the pack is ready to export. Each input is annotated with where it lands on the customer doc ("→ good news slide", "→ we need slide").

---

## 3. Architecture — components and data flow

### 3.1 Project record additions

| Field | Type | Purpose |
|---|---|---|
| `project.last_reviewed_at` | ISO timestamp | Bumped only by the "✓ Reviewed" button in the walkthrough; drives stale-detector "weeks since reviewed" badge separately from `last_updated` (which any auto-edit satisfies) |
| `project.narrative` | object | Persistent project narrative consumed by **every** pack (customer / forum / sponsor / executive): `{ headline, wins[], asks[], customer_visible_risk_ids[], updated_at, updated_by_walkthrough_id }`. The `customer_visible_risk_ids` array is the only customer-specific slice; everything else is general-purpose. |
| `project.last_reviewed_by_walkthrough_id` | string | Audit pointer back to which walkthrough touched the project last |

These are additive — no migration of existing data needed; helpers default missing fields lazily.

### 3.2 New compute helpers (App)

```
App.computeWalkthroughPrompts(project)              NEW
App.bumpProjectReviewed(projectId, walkthroughId)   NEW
App.updateProjectNarrative(projectId, patch, wid)   NEW   (single setter — used by walkthrough today, by detail panel later)
App.recordWalkthroughDecision(...)                  EXTEND (add comms_log entry side-effect)
App.recordWalkthroughAction(...)                    EXTEND (route to person's My Actions if @owner)
App.updateRiskFromWalkthrough(...)                  EXTEND (cover Update score + Mitigate path)
App.addRiskFromWalkthrough(pid, riskData, wid)      NEW
App.addCommFromWalkthrough(pid, note, wid)          NEW    (used by decision auto-feed only — no manual capture)
App.completeForumAction(forumId, actionId, wid)     NEW
App.deferForumAction(forumId, actionId, newDate, wid) NEW
App.computeProjectDeliveryTrajectory(projectId)     NEW    (committed vs completed across recent + upcoming sprints)
App.computeProjectUpcoming(projectId)               NEW    (target_date, hard_deadline, dependencies w/ status, days-to-event)
Report.buildCustomerPackDoc(customer, opts)         NEW    (consumes project.narrative for customer-facing slice)
Report.buildForumPackDoc(forumId, opts)             EXTEND (existing forum agenda — read project.narrative.headline/wins/asks for each linked project)
Report.buildSponsorPackDoc(...)                     EXTEND (existing — pull project.narrative.headline as the project's "current state" line)
```

### 3.3 `computeWalkthroughPrompts(project)` — the "ask the right question" engine

Pure function. Returns an array of `{ severity, kind, message, action }` derived from the project's current state.

| Trigger | Prompt | Default action |
|---|---|---|
| Schedule RAG = Amber for ≥ 7 days, no risks_register entry tagged "schedule" added in window | "Schedule has been amber for {N} days — log a mitigation?" | Add risk template "schedule risk" |
| Schedule RAG = Red, no decisions logged this walkthrough | "Schedule is red — confirm the recovery plan in writing." | Add Decision input |
| `last_updated` > stale threshold AND has open chips | "Stale {N} days — confirm chip progress?" | Focus DE/UAT chip input |
| Open risk with score ≥ 9 untouched for ≥ 7 days | "Risk \"{desc}\" score {N} open {N} days — still real?" | Open risk for Update / Close |
| Status = Blocked AND no decision since blocked-at | "Blocked — what's the unblock and by when?" | Add Action input |
| narrative.headline empty AND lifecycle = Implementation | "No headline yet — capture one for next pack?" | Focus headline textarea |

The prompts surface in the centre column **above** the signal grid. Resolving a prompt (clicking its inline button) deep-links into the relevant capture surface (e.g. "Add mitigation" focuses the +Risk capture with the schedule template pre-selected).

### 3.4 Write-back map — every screen field ↦ project record

| Field on screen | Helper called | Project mutation | Side effects |
|---|---|---|---|
| RAG dot click | `App.updateProjectRag(pid, dim, val, wid)` | `p.rag_*` set, `_rag_overrides[dim]=true` | Audit `walkthrough_rag` entry; bump `last_updated` |
| Status select | `App.updateProjectStatus(pid, status, wid)` | `p.status` set | Audit; if Complete/Closed, prompt for `actual_date` (existing behaviour) |
| Sprint chip number | `App.updateChipProgress(pid, skill, sprintId, val, wid)` | `skill_splits[skill][i].completed` set; if `>= points`, `status = 'complete'` | Audit; recompute `Forecast.earnedValue(p)` for next walkthrough's "since" delta |
| Open Risk: Close button | `App.updateRiskFromWalkthrough(pid, idx, 'closed', wid)` | `risks_register[idx].status = 'closed'` | Audit; if it was customer-visible, prompt to remove from customer pack |
| Open Risk: Update score | (focuses risk inline editor — existing) | `risks_register[idx].impact/probability` set | Audit |
| Open Action: Done button | `App.completeForumAction(forumId, actionId, wid)` (NEW) | Forum action `status = 'Done'`, `completed_at` set | Audit; remove from owner's My Actions queue |
| Open Action: Defer | `App.deferForumAction(forumId, actionId, newDate, wid)` (NEW) | Action `due_date` updated | Audit |
| + Decision capture | `App.recordWalkthroughDecision({ projectId, text, rationale, wid })` | `walkthrough.decisions[]` push | Audit; **also** push `{ type: 'Status Update', date: today, note: text }` to project's `comms_log` (kills G1 — decision auto-feeds the comms log so customers see it next update) |
| + Action capture | `App.recordWalkthroughAction({ projectId, description, owner, due_date, forumId?, wid })` | `walkthrough.actions[]` push | If `forumId`: push to forum's `actions`. If `owner` matches a team member: tag with `personal_owner_id` so the My Actions view picks it up |
| + Risk capture | `App.addRiskFromWalkthrough(pid, riskData, wid)` (NEW) | `risks_register[]` push with `added_at`, `added_by_walkthrough_id` | Audit |
| Project headline | `App.updateProjectNarrative(pid, { headline }, wid)` | `narrative.headline` set | Audit; consumed by **all** packs (customer · forum · sponsor) |
| Wins / asks add or remove | `App.updateProjectNarrative(pid, { wins/asks }, wid)` | `narrative.wins/asks[]` patched | Audit |
| Customer-visible-risk toggle | `App.updateProjectNarrative(pid, { customer_visible_risk_ids }, wid)` | Set/unset risk id in array | Audit; only consumed by customer pack |
| ✓ Reviewed button | `App.bumpProjectReviewed(pid, wid)` | `last_reviewed_at = now()`, `last_reviewed_by_walkthrough_id = wid`, `walkthrough.section_status['proj:'+pid] = 'reviewed'` | Audit; card collapses on next render |

> The "+ Comms note" capture tab from earlier drafts is removed — every decision auto-feeds the comms log already (G1), so a separate comms entry is redundant noise during a live meeting.

**Result**: every interactive control on the walkthrough surface has an explicit project-record side-effect. The walkthrough is now the canonical write surface for the weekly cadence.

### 3.5 Pack data flow — narrative powers every pack

The `project.narrative` field is the **single canonical source** for every project's "current state in plain English". Each pack consumes the slice that fits its audience:

| Pack | Consumes | Filter |
|---|---|---|
| Customer pack (NEW) | headline, wins, asks, customer_visible_risk_ids | Per-customer slice; only customer-visible risks |
| Forum pack (`Report.buildForumPackDoc`) | headline, wins, asks for each project linked to the forum | Per-forum project mapping |
| Sponsor pack (`Report.buildSponsorPackDoc`) | headline (as the project's "current state" line), wins | Per-project; existing sections enriched |
| Executive summary on Dashboard | headline (top 5 portfolio projects) | Existing summary pulls headlines as the human-readable line |
| Walkthrough minutes | headline, wins, asks (per project reviewed) | All projects in the customer's walkthrough |

**Customer pack generator:**

```
App.computeCustomerPackData(customer)
  → returns {
      generated_at, customer, projects: [
        { id, name, headline, wins[], asks[], visible_risks: [{ desc, mitigation }] },
        ...
      ],
      portfolio_health: { ragMix, blockedCount, atRiskCount },
      key_decisions_this_period: [...],   // pulled from latest walkthrough
      key_asks: [...]                     // aggregated from all projects' asks
    }

Report.buildCustomerPackDoc(customer, opts)
  → printable HTML; six sections:
      1. Cover: customer · period · portfolio health
      2. Headlines (one per active project, grouped by lifecycle stage)
      3. Wins (rolled up across projects)
      4. We need from you (aggregated asks)
      5. Risks we're managing (only customer-visible ones)
      6. What's next (next sprint scope per project, computed from current sprint + 1)
```

Triggered from the right rail's "Open pack" button which presents a quick picker (Customer · Forum · Sponsor) before generating. Opens in a new window via the existing `Report._openPrintWindow` pattern.

### 3.6 Delivery trajectory + Upcoming-events tiles

Two new compute helpers replace the single-sprint chip view with the broader picture the manager actually needs:

**`App.computeProjectDeliveryTrajectory(projectId)`** returns committed-vs-completed across recent + upcoming sprints:

```
{
  sprints: [
    { sprint_id: 'CY26-S3', label: 'S3', state: 'past',    committed: 8,  completed: 8 },
    { sprint_id: 'CY26-S4', label: 'S4', state: 'past',    committed: 12, completed: 10 },
    { sprint_id: 'CY26-S5', label: 'S5', state: 'current', committed: 25, completed: 12 },
    { sprint_id: 'CY26-S6', label: 'S6', state: 'future',  committed: 18, completed: 0  },
    { sprint_id: 'CY26-S7', label: 'S7', state: 'future',  committed: 5,  completed: 0  }
  ],
  trend: 'on-track' | 'slipping' | 'ahead',           // simple comparison of last 2 past sprints
  total_committed: 68,
  total_completed: 30
}
```

Rendered as a tiny stacked bar per sprint in the centre column's signal grid — past sprints in blue, current in violet, future in dim grey; completed portion saturated, committed-but-not-completed faded. The current sprint's chip inputs sit beside it for inline editing.

**`App.computeProjectUpcoming(projectId)`** returns the next time-pressure events:

```
{
  target_date: { iso, days_to: 27, state: 'on-track' | 'amber' | 'red' },
  hard_deadline: { iso, days_to: 35, state: ... } | null,
  next_sprint_end: { iso, days_to: 12 },
  product_release_date: ... | null,
  dependencies: [
    { kind: 'blocked_by', target_id: 'GCC-XYZ', target_name: 'Onboarding API', state: 'pending', target_date_iso: ... },
    { kind: 'blocks',     target_id: 'GCC-ABC', target_name: 'UAT readiness', state: 'in_progress' }
  ]
}
```

Rendered as a "Dates & Dependencies" tile: a stacked list of dated events with day-to chips coloured red ≤7d / amber ≤14d / green otherwise; dependency rows show kind + target name + state pill.

### 3.7 Hover-only enrichment — DevOps / WFA / assignees

Three pieces of useful context live on hover so they don't crowd the centre column:

| Hover target | Popover content | Source |
|---|---|---|
| Project name in centre header | DevOps link · WFA link as anchor tags (open in new tab); copy-to-clipboard icon next to each | `project.devops_link`, `project.wfa_link` |
| A sprint chip in the trajectory tile | "Assigned to" list — names + sp counts pulled from `skill_splits[skill][i].assigned_to[]` for that sprint | existing `skill_splits` data |
| A dependency row | Target project's headline + RAG dots + manager + days-to-target | resolved from `App.data.projects` |

The popovers reuse the existing `.dash-tip` pattern from the dashboard hero cards (CSS hover, no JS state). On focus (keyboard) the same popover opens. No extra real estate, no extra clicks.

### 3.8 New UI module — `Walkthrough.*`

The current overlay code lives inline on `Sprint.openWalkthrough()`. Extract to a dedicated `Walkthrough` module so the new layout doesn't bloat `Sprint`. Module surface:

```
Walkthrough.open(customer)          replaces Sprint.openWalkthrough
Walkthrough.activeProjectId          state — which project is in centre column
Walkthrough.selectProject(pid)       click handler from left rail
Walkthrough.markProjectReviewed(pid) ✓ Reviewed handler
Walkthrough.advanceToNext()          ⌘+Enter — moves to highest-attention unreviewed project
Walkthrough.renderTopBar()
Walkthrough.renderProjectList()
Walkthrough.renderCenter(card)
Walkthrough.renderCustomerPanel(card)
Walkthrough.renderBottomBar()
Walkthrough.renderPrompts(project)
Walkthrough._wireKeyboardShortcuts()
```

Centre column is re-rendered when `activeProjectId` changes; left rail and customer panel persist (DOM nodes only patched, not rebuilt) so user-typed text in the customer panel is preserved across project switches.

### 3.9 Stale-detector integration (G3)

Currently the dashboard's stale list uses `last_updated`. Add a "weeks since reviewed" complementary signal that uses `last_reviewed_at`. Show both. Reviewed-recently-but-not-edited shows a green check; edited-recently-but-not-reviewed shows an amber clock.

---

## 4. Visual treatment

The mockup at `.superpowers/brainstorm/.../final-layout.html` is the reference. Key tokens:

- **Top bar**: 56px. Subtle gradient `#fff → #f8fafc`. Customer name in `--accent-blue`. Cohort pills use the standard RAG tones.
- **Left rail**: 220px. Compact rows (28px tall each). Active row has a 3px left-border in `--accent-blue` and a `#dbeafe` background. Reviewed rows are strike-through `#94a3b8`. RAG dots are 5px circles, three abreast.
- **Centre**: 16-20px padding. Header has bottom border. Tile pack uses `#f8fafc` panels with `#e2e8f0` borders. Open lists are white panels with `#e2e8f0` borders, rows separated by hairline `#f1f5f9`.
  - **Header link icons**: small DevOps and WFA icons inline next to the project name; hover reveals a `.dash-tip` popover with the actual links + a copy-to-clipboard control. No icon if the field is empty.
  - **Signal grid (4 tiles, 2×2)**: Health · Delivery trajectory · Dates & Dependencies · Since-last-walkthrough. Trajectory tile shows a 5-sprint mini bar chart (past in blue, current in violet, future dimmed); each bar is hoverable for the per-sprint assignees popover. Dates tile lists target / hard deadline / next-sprint-end / dependencies with day-to chips (red ≤7d, amber ≤14d, green otherwise).
- **Prompts strip**: amber gradient `#fffbeb → #fef3c7`, `#fcd34d` border. Each row has a one-line prompt + italic verbatim phrasing + a "resolve" button on the right.
- **Capture tabs** (centre column): three tabs only — **+ Decision · + Action · + Risk**. The earlier "+ Comms note" tab is removed; decisions auto-feed the comms log.
- **Right rail "Project narrative" panel**: 320px. Purple gradient `#faf5ff → #f5f3ff`, `#c4b5fd` border. Header reads **Project narrative** with a small subtitle "Feeds: customer · forum · sponsor packs". Inputs have `#c4b5fd` border, focus `#7c3aed`. Headline textarea is italic. Each section has a tiny `→ pack location` annotation. Bottom button is **"Open pack"** which presents a Customer/Forum/Sponsor picker before generating.
- **Bottom bar**: 48px. Stats on the left (decisions / actions / risks closed + raised this meeting). Keyboard hints in the middle (`Tab cycles capture · ⌘+Enter next project`). Save / Next buttons right.

All sizes use the existing CSS variables `--surface`, `--border-light`, `--border-dim`, `--text-dark`, `--text-muted`, `--accent-blue`, `--accent-violet`, `--status-green/amber/red` so the new module inherits dark-mode behaviour automatically.

---

## 5. Tests

| File | Cases |
|---|---|
| `tests/unit/walkthrough-prompts.test.mjs` (NEW) | computeWalkthroughPrompts: amber-14d → mitigation prompt; stale-14d → progress prompt; risk-9-9d → risk prompt; blocked + no decision → unblock prompt; empty headline + Implementation → headline prompt |
| `tests/unit/walkthrough-side-effects.test.mjs` (NEW) | recordWalkthroughDecision adds to comms_log; recordWalkthroughAction with @owner tags personal_owner_id; addRiskFromWalkthrough writes added_by_walkthrough_id; bumpProjectReviewed sets last_reviewed_at; updateProjectNarrative patches all fields and audits |
| `tests/unit/project-trajectory.test.mjs` (NEW) | computeProjectDeliveryTrajectory returns past/current/future sprint frames with committed/completed; trend detection (slipping vs on-track) |
| `tests/unit/project-upcoming.test.mjs` (NEW) | computeProjectUpcoming returns target/hard_deadline/dependencies with day-to states (red/amber/green); resolves dependency target_name correctly |
| `tests/unit/pack-data.test.mjs` (NEW) | computeCustomerPackData rolls up across projects; Report.buildCustomerPackDoc returns HTML with the 6 sections; Report.buildForumPackDoc consumes project.narrative.headline; Report.buildSponsorPackDoc surfaces narrative.headline |
| `tests/render/walkthrough-layout.test.mjs` (NEW) | three columns render: project list, centre with active project, narrative panel; selecting a project updates centre but not narrative panel typed text |
| `tests/render/walkthrough-tiles.test.mjs` (NEW) | trajectory tile renders 5 sprint bars; dates tile renders day-to chips; chip hover popover lists assigned_to; project name hover popover lists devops/wfa links |
| `tests/render/walkthrough.test.mjs` (extend) | prompts surface above signal grid; ✓ Reviewed bumps last_reviewed_at; +Decision adds a comms_log entry; capture tabs are 3 only (no Comms note tab) |
| `tests/e2e/walkthrough.spec.ts` (extend) | Live meeting flow: select project → answer prompt → close risk → file action → type narrative headline → mark reviewed → next project; "Open pack" picker generates Customer pack without errors |

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Pack generation surfaces wrong / outdated narrative | Show a "narrative last updated {N}d ago" stamp per project on the right rail; if older than 14 days, mark stale-amber so the manager updates before exporting |
| Decision auto-feeding the comms log creates noise | Comms entries from the walkthrough are tagged with `source: 'walkthrough'` and `walkthrough_id` so they're filterable in the comms log + audit |
| Action assigned to a person who isn't a team_member | Free-text owner is allowed (matches today's behaviour); only when `owner` matches a `team_members[].name` does it tag `personal_owner_id` for My Actions integration |
| Three-column layout breaks below 1100px | Below 1100px, fall back to two columns (left + centre) and slide-over the narrative panel via a "📊 Narrative" toggle in the top bar |
| Customer-visible risk toggles drift out of sync if a risk is closed | When a risk is closed, also remove its id from `narrative.customer_visible_risk_ids` (and audit it) |
| Hover popovers (devops/wfa/assignees/dependency) trap focus or block content | Use the existing `.dash-tip` pattern (CSS-only hover, ESC-dismissable on focus); position via `<details>` or absolute positioning that respects viewport edges |
| Trajectory tile becomes too dense for projects with many sprints | Show last 2 past + current + next 2 sprints (5 frames max); a "More" button opens the full sprint history modal |

---

## 7. Implementation order

Each step is independently committable + green-suite-able.

1. **Schema additions** — defaults for `last_reviewed_at`, `narrative` (with the multi-pack shape), `last_reviewed_by_walkthrough_id` in `migrateSchema`.
2. **`computeWalkthroughPrompts`** — pure function + unit tests.
3. **`computeProjectDeliveryTrajectory` + `computeProjectUpcoming`** — pure functions + unit tests.
4. **Write-back helpers** — extend existing recordWalkthroughDecision (add comms_log side-effect), recordWalkthroughAction (personal_owner_id), and add `bumpProjectReviewed`, `updateProjectNarrative`, `addRiskFromWalkthrough`, `addCommFromWalkthrough`, `completeForumAction`, `deferForumAction`.
5. **Customer pack compute + report** — `computeCustomerPackData` + `Report.buildCustomerPackDoc`.
6. **Forum + Sponsor pack enrichment** — extend `Report.buildForumPackDoc` and `Report.buildSponsorPackDoc` to consume `project.narrative.headline / wins / asks` for richer pack content.
7. **`Walkthrough` module** — extract from `Sprint`, build the three-column shell, top + bottom bars.
8. **Centre column** — header (with devops/wfa hover popovers), prompts, signal grid (Health · Trajectory · Dates & Dependencies · Since-last-walkthrough), open-risk + open-action lists, capture tabs (Decision / Action / Risk only).
9. **Right rail "Project narrative" panel** — headline / wins / asks / customer-visible-risks toggles + "Open pack" picker.
10. **Hover popovers** — devops/wfa links on project name; per-sprint assignees on trajectory bars; dependency target detail on dependency rows.
11. **Keyboard shortcuts** — Tab cycles capture, ⌘+Enter advances to next.
12. **Stale-detector integration** — surface "weeks since reviewed" alongside "weeks since updated".
13. **Full test pass + visual verification** + endorsement loop.
14. **Merge to `main`**.

---

## 8. MD-endorsement criteria (Definition of Done)

1. ✅ Open the walkthrough in a meeting; project list, centre, and project-narrative panel are all visible at 1280px.
2. ✅ Active project's centre column shows prompts derived from real signals (not hardcoded), and clicking a prompt's resolve button opens the relevant capture.
3. ✅ Centre column's signal grid shows the **delivery trajectory** (5-sprint mini bar chart) and **dates + dependencies** (target / hard deadline / next sprint end / dep rows with day-to colour coding) — not just the active sprint's chips.
4. ✅ Closing an open risk in the centre column writes to `risks_register` and audit log; the same close happens via the existing detail panel — they don't drift.
5. ✅ Marking an action Done writes to its source forum's `actions` array AND clears it from My Actions.
6. ✅ "+ Decision" capture lands a `comms_log` entry tagged `source: 'walkthrough'` automatically. (No "+ Comms note" tab in the capture row.)
7. ✅ "✓ Reviewed" updates the project's `last_reviewed_at`; reopening the walkthrough next week shows the project as "Reviewed last week" not "stale".
8. ✅ Project-narrative panel persists across project switches (no data loss when navigating).
9. ✅ "Open pack" picker generates a Customer pack populated from `project.narrative`; the same `narrative` data also enriches Forum and Sponsor packs.
10. ✅ Hover the project name → DevOps + WFA links open in popover. Hover a trajectory bar → assignee list appears. Hover a dependency row → target project's headline + RAG appear.
11. ✅ All 188+ unit/render tests + 27+ E2E tests green.
12. ✅ Senior manager + UX designer agree the walkthrough now functions as the single weekly source of truth — no follow-up admin pass required.

---

**Status**: Approved by senior manager + UX designer (per Auto mode + iterative feedback rounds — Approach B → v2 with Open Risks/Actions → Layout A three-column polish). Proceeding to implementation plan.
