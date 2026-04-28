# Walkthrough Source-of-Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the weekly walkthrough into the single source of truth for project narrative, decisions, actions, risks, and customer-facing pack content — eliminating downstream admin.

**Architecture:** Three-column overlay (project list left, focused project centre, project-narrative panel right). Every interactive control writes through to the project record; new compute helpers feed prompt-nudges, delivery trajectory, dates+dependencies, and pack data. New `Walkthrough.*` module replaces `Sprint.openWalkthrough()`.

**Tech Stack:** Single-file `index.html` (~26,000 lines) with plain-JS modules; vitest 2.1 + jsdom for unit/render tests; Playwright 1.48 for E2E.

**Spec:** `docs/superpowers/specs/2026-04-28-walkthrough-source-of-truth-design.md`

---

## File Structure

| File | Role | Change |
|---|---|---|
| `index.html` | Schema migration, App helpers, Walkthrough module, CSS, Report builders | Modified throughout |
| `tests/unit/walkthrough-prompts.test.mjs` | Pure prompt-engine tests | New |
| `tests/unit/walkthrough-side-effects.test.mjs` | Write-back helper tests | New |
| `tests/unit/project-trajectory.test.mjs` | Delivery trajectory compute tests | New |
| `tests/unit/project-upcoming.test.mjs` | Dates+dependencies compute tests | New |
| `tests/unit/pack-data.test.mjs` | Customer/forum/sponsor pack data tests | New |
| `tests/render/walkthrough-layout.test.mjs` | Three-column shell render tests | New |
| `tests/render/walkthrough-tiles.test.mjs` | Trajectory tile + dates tile + popovers | New |
| `tests/render/stale-reviewed-badge.test.mjs` | Reviewed-badge on Projects-table row | New |
| `tests/render/walkthrough.test.mjs` | Existing — extended | Modified |
| `tests/e2e/walkthrough.spec.ts` | Existing — extended | Modified |

The codebase intentionally keeps everything in `index.html`; we follow that convention. Logical "modules" are plain-JS objects (`App`, `Sprint`, `Walkthrough`, `Report` etc.) — extraction in Task 7 means defining a new top-level `const Walkthrough = { ... }` and bridging it in `tests/harness/loadApp.mjs`.

---

## Task 1: Schema additions for narrative + last_reviewed_at

**Files:**
- Modify: `index.html` — `App.migrateSchema` (~line 3162)
- Test: `tests/unit/migration.test.mjs` — extend

- [ ] **Step 1: Write the failing test**

Append two cases to the existing `describe('migrateSchema', ...)` block in `tests/unit/migration.test.mjs`. The first asserts `narrative` is seeded as `{ headline: '', wins: [], asks: [], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null }` for a legacy project, and `last_reviewed_at` exists as `null`. The second asserts the migration is idempotent — passing in a project with existing narrative.headline preserves it.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/migration.test.mjs`
Expected: FAIL on `expect(proj.narrative).toBeDefined()`.

- [ ] **Step 3: Add the migration block**

In `index.html`, find the always-run block right after the ownership canonicalisation (~line 3210). Add a new always-run block that, for every `data.projects[]` entry, defaults `p.narrative` to the standard shape (preserving any existing values) and seeds `p.last_reviewed_at`/`p.last_reviewed_by_walkthrough_id` to `null` when missing.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/migration.test.mjs`
Expected: PASS — new + existing cases.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/unit/migration.test.mjs
git commit -m "feat(schema): seed project.narrative + last_reviewed_at"
```

---

## Task 2: computeWalkthroughPrompts pure function

**Files:**
- Modify: `index.html` — add to `App` near `computeWalkthroughCards` (~line 4633)
- Test: `tests/unit/walkthrough-prompts.test.mjs` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/walkthrough-prompts.test.mjs` with six cases:
1. Schedule = Amber, last_updated > 7 days → returns a prompt with `kind === 'schedule_amber_mitigation'`.
2. Open chips + last_updated > 14 days → returns `kind === 'stale_chip_progress'`.
3. Risk score ≥ 9 open ≥ 7 days → returns `kind === 'risk_recheck'`.
4. status === 'Blocked' AND no decisions logged this walkthrough → returns `kind === 'blocked_no_decision'`.
5. Empty `narrative.headline` AND `lifecycle_stage === 'Implementation'` → returns `kind === 'missing_headline'`.
6. Healthy on-track project → returns `[]`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/walkthrough-prompts.test.mjs`
Expected: FAIL — `app.App.computeWalkthroughPrompts is not a function`.

- [ ] **Step 3: Add the helper**

In `index.html`, locate `computeWalkthroughCards` (~line 4633) and add `computeWalkthroughPrompts(project)` directly above it as a pure function returning an array of `{ severity, kind, message, hint, action }` objects derived from the conditions in the test.

The five generators:
- Amber + ≥7d stale → `{ severity:'amber', kind:'schedule_amber_mitigation', action:'focus_risk_capture_template:schedule' }`.
- Red status with no decision recorded for this project in the latest walkthrough → `{ severity:'red', kind:'red_no_decision', action:'focus_decision_capture' }`.
- Open chips (sp.status !== 'complete' AND points > 0) + lastUpdatedDays ≥14 → `{ severity:'amber', kind:'stale_chip_progress', action:'focus_chip_inputs' }`.
- Per risk: score ≥9 AND status open AND age ≥7d → `{ severity:'amber', kind:'risk_recheck', action:'focus_risk_idx:'+idx }`.
- status === 'Blocked' + no decisions for this project in the latest walkthrough → `{ severity:'red', kind:'blocked_no_decision', action:'focus_action_capture' }`.
- Empty narrative.headline AND lifecycle_stage === 'Implementation' → `{ severity:'info', kind:'missing_headline', action:'focus_narrative_headline' }`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/walkthrough-prompts.test.mjs`
Expected: PASS — 6 cases.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/unit/walkthrough-prompts.test.mjs
git commit -m "feat(walkthrough): computeWalkthroughPrompts engine"
```

---

## Task 3: computeProjectDeliveryTrajectory + computeProjectUpcoming

**Files:**
- Modify: `index.html` — add to `App` near `computeWalkthroughPrompts`
- Test: `tests/unit/project-trajectory.test.mjs` (new)
- Test: `tests/unit/project-upcoming.test.mjs` (new)

- [ ] **Step 1: Write trajectory test**

Create `tests/unit/project-trajectory.test.mjs` with three cases:
1. A 5-sprint allocation — verify the returned `trajectory.sprints.length` is in `[1, 5]`, each frame has `{ sprint_id, label, state, committed, completed }`, and `total_committed`/`total_completed` aggregate correctly.
2. State labelling: each frame is `'past'`, `'current'`, or `'future'` based on its position relative to the active sprint.
3. Empty allocation → returns `{ sprints: [], trend: 'unknown', total_committed: 0, total_completed: 0 }`.

- [ ] **Step 2: Write upcoming test**

Create `tests/unit/project-upcoming.test.mjs` with three cases:
1. `target_date` set 27 days out → `state === 'green'`, `days_to === 27`.
2. Two projects with target_date 5d and 12d → states `'red'` and `'amber'` respectively.
3. A project's `dependencies` resolves `target_name` from `App.data.projects` lookup.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/project-trajectory.test.mjs tests/unit/project-upcoming.test.mjs`
Expected: FAIL — both helpers undefined.

- [ ] **Step 4: Add `computeProjectDeliveryTrajectory(projectId)`**

Returns `{ sprints: [...frames], trend, total_committed, total_completed }`. For the 5-frame window, walk `App.data.sprints`, find the active-sprint index (first sprint whose `end_date >= now`), and pick frames `[active-2 .. active+2]` clamped to the array bounds. For each frame, sum `committed` and `completed` from all skill_splits whose `sprint === sprint_id`. Drop frames that have no allocation (except keep the current sprint frame even if empty). Compute `trend` from the last two past frames' completion ratios: `slipping` if recent < prev - 0.1, `ahead` if recent > prev + 0.1, else `on-track`. `total_*` sums every (committed/completed) across all of the project's allocations regardless of frame window.

- [ ] **Step 5: Add `computeProjectUpcoming(projectId)`**

Returns `{ target_date, hard_deadline, next_sprint_end, product_release_date, dependencies }`. The date helpers compute `days_to` (ceil((iso_ms - now)/86400000)) and `state` (`'red'` if days_to ≤ 7, `'amber'` if ≤ 14, else `'green'`). `next_sprint_end` is the active sprint's end_date. `dependencies` maps `project.dependencies[]` to `{ kind, target_id, target_name (from App.data.projects lookup), target_status, target_rag_schedule, state ('done' if target.status is Complete/Closed, 'in_progress' if target exists, 'external' otherwise), target_date_iso }`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/project-trajectory.test.mjs tests/unit/project-upcoming.test.mjs`
Expected: PASS — all cases.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/unit/project-trajectory.test.mjs tests/unit/project-upcoming.test.mjs
git commit -m "feat(walkthrough): trajectory + upcoming pure helpers"
```

---

## Task 4: Write-back helpers — extend existing + add new

**Files:**
- Modify: `index.html` — extend `recordWalkthroughDecision` (~line 4430), `recordWalkthroughAction` (~line 4444); add `addRiskFromWalkthrough`, `addCommFromWalkthrough`, `updateProjectNarrative`, `bumpProjectReviewed`, `completeForumAction`, `deferForumAction` near them.
- Test: `tests/unit/walkthrough-side-effects.test.mjs` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/walkthrough-side-effects.test.mjs` with eight cases:
1. `recordWalkthroughDecision` — verify the project's `comms_log[]` gains a row with `note` containing the decision text, `source === 'walkthrough'`, `walkthrough_id === wid`.
2. `recordWalkthroughAction` with `owner === 'Shazia'` matching a `team_members[].name` → action gains `personal_owner_id === 'Shazia'`.
3. `recordWalkthroughAction` with free-text `owner` → no `personal_owner_id` set.
4. `addRiskFromWalkthrough(pid, riskData, wid)` → project's `risks_register[]` gains an entry with `added_by_walkthrough_id === wid` and `added_at` populated.
5. `updateProjectNarrative(pid, { headline, wins }, wid)` → project's `narrative.headline` and `narrative.wins` are patched, `updated_by_walkthrough_id === wid`, `updated_at` populated.
6. `bumpProjectReviewed(pid, wid)` → `last_reviewed_at` is populated, `last_reviewed_by_walkthrough_id === wid`.
7. `completeForumAction(forumId, actionId, wid)` → action's `status === 'Done'`, `completed_at` populated.
8. `deferForumAction(forumId, actionId, '2026-05-15', wid)` → action's `due_date === '2026-05-15'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/walkthrough-side-effects.test.mjs`
Expected: FAIL — multiple is-not-a-function errors and missing comms_log auto-feed.

- [ ] **Step 3: Extend `recordWalkthroughDecision`**

Add a side-effect after `wt.decisions.push(entry)`: when `opts.projectId` is set, look up the project and push a new comms_log row of shape `{ type: 'Status Update', date: today_iso, note: entry.text + (rationale ? ' (rationale)' : ''), source: 'walkthrough', walkthrough_id: walkthroughId }`.

- [ ] **Step 4: Extend `recordWalkthroughAction`**

When `opts.owner` is set, look up `App.data.team_members[]` for a case-insensitive name match. If found, set `action.personal_owner_id = team_member.name` before pushing to `wt.actions[]`.

- [ ] **Step 5: Add the new helpers**

Right after `recordWalkthroughAction`, define:
- `addRiskFromWalkthrough(projectId, riskData, walkthroughId)` — clamps impact/probability to `[0,5]`, sets `added_at = ISO_now`, `added_by_walkthrough_id`, `status = 'open'`. Audit-logs via `logChange`.
- `addCommFromWalkthrough(projectId, note, walkthroughId)` — pushes a comms_log row with `source: 'walkthrough'` and `walkthrough_id`.
- `updateProjectNarrative(projectId, patch, walkthroughId)` — patches `headline` (string slice 240), `wins` (array slice 20, each string slice 200), `asks` (same), `customer_visible_risk_ids` (array slice 50). Stamps `updated_at` + `updated_by_walkthrough_id`. Audit-logs the patched-keys list.
- `bumpProjectReviewed(projectId, walkthroughId)` — sets `last_reviewed_at = ISO_now`, `last_reviewed_by_walkthrough_id`, AND calls `setWalkthroughSectionStatus(walkthroughId, 'proj:'+projectId, 'reviewed')` to keep the existing card-collapse state in sync.
- `completeForumAction(forumId, actionId, walkthroughId)` — looks up forum (by `id` or `name`), looks up action (by `id` or `description`), sets `status = 'Done'` and `completed_at = ISO_now`. Audit-logs.
- `deferForumAction(forumId, actionId, newDate, walkthroughId)` — same lookup; updates `due_date`. Audit-logs.

All helpers call `markDirty()` + `saveToLocalStorage()`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/walkthrough-side-effects.test.mjs`
Expected: PASS — 8 cases.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/unit/walkthrough-side-effects.test.mjs
git commit -m "feat(walkthrough): write-back helpers — decision auto-feeds comms_log + new helpers"
```

---

## Task 5: Customer pack — computeCustomerPackData + Report.buildCustomerPackDoc

**Files:**
- Modify: `index.html` — add `computeCustomerPackData` to `App` (after `computeProjectUpcoming`); add `buildCustomerPackDoc` and `exportCustomerPack` to `Report`
- Test: `tests/unit/pack-data.test.mjs` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/pack-data.test.mjs` with four cases for `computeCustomerPackData('GCC')`:
1. Two projects with their narratives populated → returned `data.projects.length === 2`, alpha's `headline === 'Phase 1 on track'`, alpha's `visible_risks` length matches its `customer_visible_risk_ids`.
2. Project with two risks but only one in `customer_visible_risk_ids` → `visible_risks.length === 1`.
3. Two projects each with multiple asks → `data.key_asks` aggregates them all.

Plus one `Report.buildCustomerPackDoc` case asserting the returned HTML contains `<html`, the six section headings, and the project's `narrative.headline`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pack-data.test.mjs`
Expected: FAIL — `computeCustomerPackData is not a function`.

- [ ] **Step 3: Add `computeCustomerPackData`**

After `computeProjectUpcoming`, define `computeCustomerPackData(customer)` returning `{ generated_at, customer, projects: [...], portfolio_health: { ragMix, blockedCount, atRiskCount }, key_decisions_this_period, key_asks }`. Each project entry has `id, name, lifecycle_stage, headline, wins, asks, visible_risks (array of { desc, score, mitigation } filtered by `customer_visible_risk_ids` matching either the risk's `id` or its index), next_sprint_id`. `key_asks` flattens `(project, ask)` pairs. `key_decisions_this_period` is the latest completed walkthrough's `decisions[]`.

- [ ] **Step 4: Add `Report.buildCustomerPackDoc(customer, opts)`**

Returns a complete HTML document (with `<html>`, `<head>`, basic print CSS, `<body>`) with six sections: Cover, Portfolio health, Headlines (grouped by lifecycle_stage in the order Idea → Discovery → POC → Phase-1 Build → Implementation → Run/BAU), Wins, We need from you, Risks we're managing, What's next.

Add `Report.exportCustomerPack(customer)` that calls `buildCustomerPackDoc` and `_openPrintWindow` (existing pattern).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/pack-data.test.mjs`
Expected: PASS — 4 cases.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/unit/pack-data.test.mjs
git commit -m "feat(report): customer pack — computeCustomerPackData + buildCustomerPackDoc"
```

---

## Task 6: Forum + Sponsor pack enrichment from project.narrative

**Files:**
- Modify: `index.html` — `Report.buildSponsorPackDoc` / `buildProjectPackDoc`, `Report.buildAgendaDoc` (forum agenda) — locate via grep
- Test: extend `tests/unit/pack-data.test.mjs`

- [ ] **Step 1: Locate the existing builders**

Run: `grep -n "buildSponsorPackDoc\|buildProjectPackDoc\|buildAgendaDoc\|buildForumPackDoc" index.html`

- [ ] **Step 2: Write the failing tests (extend pack-data.test.mjs)**

Append two cases:
1. `Report.buildProjectPackDoc('GCC-X')` returned HTML contains the project's `narrative.headline` text.
2. `Report.buildAgendaDoc('F1')` (or `buildForumPackDoc`) returned HTML contains the linked project's `narrative.headline`, `wins[0]`, and `asks[0]` strings.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/pack-data.test.mjs`
Expected: FAIL on the two new cases.

- [ ] **Step 4: Enrich `buildProjectPackDoc`**

Inside the function body, after looking up `project`, take `project.narrative.headline` (if non-empty) and inject it as an italic line directly under the project name heading, e.g. `<p style="font-style:italic;font-size:14px;color:#0f172a;margin:6px 0">{escaped headline}</p>`. Use `Dashboard.esc` for safety.

- [ ] **Step 5: Enrich `buildAgendaDoc`**

Locate the per-project loop inside the agenda builder. For each linked project, emit a small narrative block: `<p style="font-style:italic;color:#0f172a;margin:4px 0 6px 0">{esc(headline)}</p>`, plus optional `<div><strong>Wins:</strong> ...</div>` and `<div><strong>Asks:</strong> ...</div>` rows when those arrays are non-empty.

If `Report.buildForumPackDoc` does not already exist, alias it: `buildForumPackDoc(forumId, opts) { return this.buildAgendaDoc(forumId, opts); }`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/pack-data.test.mjs`
Expected: PASS — all 6 cases.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/unit/pack-data.test.mjs
git commit -m "feat(report): sponsor + forum packs surface project.narrative"
```

---

## Task 7: Extract `Walkthrough.*` module — three-column shell skeleton

**Files:**
- Modify: `index.html` — define `const Walkthrough = { ... }` near the existing Sprint module; replace the body of `Sprint.openWalkthrough` with `Walkthrough.open(App.activeCustomer)`.
- Modify: `tests/harness/loadApp.mjs` — bridge `Walkthrough` onto `window.__pcc__` and into the returned handles.
- Test: `tests/render/walkthrough-layout.test.mjs` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/render/walkthrough-layout.test.mjs` with three cases:
1. After `Walkthrough.open('GCC')`, the overlay exists and contains the class names `wt-top`, `wt-list`, `wt-center`, `wt-cust`, `wt-bottom`.
2. `Walkthrough.selectProject(otherId)` updates `Walkthrough.activeProjectId` and the centre column re-renders to show the new project's name.
3. Typed text in `[data-narrative-field="headline"]` persists across project switches (write the headline via `App.updateProjectNarrative`, switch projects, switch back, assert the textarea value matches).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/walkthrough-layout.test.mjs`
Expected: FAIL — `app.Walkthrough is undefined`.

- [ ] **Step 3: Add the bridge**

In `tests/harness/loadApp.mjs`, append `Walkthrough` to the `window.__pcc__` destructured set on the bridge `<script>` line, and add `Walkthrough: handles.Walkthrough` to the returned object at the bottom.

- [ ] **Step 4: Define `const Walkthrough = { ... }`**

Place the module just before `const Sprint = {`. Surface area:
- State: `activeProjectId`, `_activeWalkthroughId`, `_captureTab`.
- `open(customer)` — finds or starts a walkthrough; sets `activeProjectId` to the highest-attention unreviewed project; calls `_render`.
- `selectProject(projectId)` — sets `activeProjectId`, calls `_renderCenter`.
- `markProjectReviewed(projectId)` — calls `App.bumpProjectReviewed`, advances `activeProjectId` to the next unreviewed by attention, calls `_render`.
- `advanceToNext()` — picks the next unreviewed by attention; updates `activeProjectId`; re-renders the centre.
- `_render(customer)` — removes any prior overlay; creates the shell `<div id="walkthroughOverlay">` containing a `<div class="wt-shell">` with five sub-divs (each with a `data-wt-*` attribute target). Appends to body; clicks outside the shell close. Calls each sub-render method.
- `_renderTopBar()`, `_renderProjectList()`, `_renderCenter()`, `_renderCustomerPanel()`, `_renderBottomBar()` — populate via `host.innerHTML` strings using `Dashboard.esc` for safety.
- `_completeAndClose()` — calls `App.completeWalkthrough`, removes the overlay.

The minimal `_renderCenter` for this task only emits the project name plus the four child host divs (`[data-wt-prompts]`, `[data-wt-grid]`, `[data-wt-open-lists]`, `[data-wt-capture]`) so subsequent tasks can populate them. The minimal `_renderCustomerPanel` emits an `<textarea data-narrative-field="headline">` with the current value.

Replace the existing `Sprint.openWalkthrough()` body with:

```javascript
openWalkthrough() { Walkthrough.open(App.activeCustomer); }
```

- [ ] **Step 5: Add the CSS shell**

Append to the walkthrough CSS block (~line 1100): `.wt-shell` (grid 56px / 1fr / 48px), `.wt-top`, `.wt-progress`, `.wt-progress-fill`, `.wt-progress-label`, `.wt-pill` + variants, `.wt-body` (grid 220px 1fr 320px), `.wt-list`, `.wt-list-item` + states, `.wt-list-rags`, `.wt-list-att`, `.wt-center`, `.wt-cust`, `.wt-cust-input`, `.wt-bottom`, `.wt-bot-stat`. Use existing CSS variables (`--surface`, `--accent-blue`, `--text-muted`, `--border-light` etc.). Add a `@media (max-width: 1100px)` block that drops `.wt-cust` (display:none) and reduces the grid to two columns.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/render/walkthrough-layout.test.mjs`
Expected: PASS — 3 cases.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/harness/loadApp.mjs tests/render/walkthrough-layout.test.mjs
git commit -m "feat(walkthrough): extract Walkthrough module — three-column shell"
```

---

## Task 8: Centre column — header, prompts, signal grid (Health · Trajectory · Dates · Since)

**Files:**
- Modify: `index.html` — flesh out `Walkthrough._renderCenter`; add `_cycleRag` helper.
- Test: `tests/render/walkthrough-tiles.test.mjs` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/render/walkthrough-tiles.test.mjs` with three cases:
1. Project with amber schedule + 14 days stale → `[data-wt-prompts]` contains "Schedule has been amber".
2. Project with skill_splits across 4 sprints → centre `[data-wt-grid]` HTML contains all four `data-wt-tile` markers (`health`, `trajectory`, `dates`, `since`).
3. Project's trajectory tile renders 1-5 `[data-wt-trajectory-bar]` elements.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/walkthrough-tiles.test.mjs`
Expected: FAIL — tiles not rendered yet.

- [ ] **Step 3: Implement the centre render**

Replace the placeholder `_renderCenter` with the full render. Header includes: project name, lifecycle chip, an inline DevOps/WFA hover popover (hidden if both links are empty) using `.dash-tip`, "last touched Nd ago" tag, attention-score chip, ✓ Reviewed button calling `Walkthrough.markProjectReviewed`. Prompts strip renders rows from `App.computeWalkthroughPrompts(project)` with one `.wt-prompt-item` per prompt (badge + message). Signal grid is 2×2 of `<div class="wt-tile" data-wt-tile="<name>">` blocks:
- `health`: three `wt-rag-w` widgets (clicks call `Walkthrough._cycleRag`) + a status `<select>` whose `onchange` calls `App.updateProjectStatus`.
- `trajectory`: bars produced from `App.computeProjectDeliveryTrajectory(project.id).sprints`, each `<div class="wt-traj-bar" data-wt-trajectory-bar data-sprint-id="..." tabindex="0">` styled with the per-state tone (past=blue, current=violet, future=dimmed grey, faded opacity for future). Inner bar `wt-traj-fill` height = round((completed/committed)*100)%. Label below.
- `dates`: rows for `target_date`, `hard_deadline`, `next_sprint_end`, then dependency rows. Each date row uses a `wt-date-chip wt-{green|amber|red}` for the day-to value.
- `since`: shows `cards.lastUpdatedDays` from `computeWalkthroughCards` (existing).

The four child host divs `[data-wt-prompts]`, `[data-wt-grid]`, `[data-wt-open-lists]`, `[data-wt-capture]` remain so Tasks 9-11 can populate.

Add helper:
```
_cycleRag(projectId, dim) {
  const next = project[dim] === 'Green' ? 'Amber' : project[dim] === 'Amber' ? 'Red' : 'Green';
  App.updateProjectRag(projectId, dim, next, this._activeWalkthroughId, '');
  this._render(App.activeCustomer);
}
```

- [ ] **Step 4: Append the matching CSS**

Add: `.wt-c-hd`, `.wt-c-hd .nm/.age/.att/.rev`, `.wt-links-hover`, `.wt-links-tip`, `.wt-prompts`, `.wt-prompt-item` + .pill, `.wt-grid` (2-col), `.wt-tile` + h6, `.wt-rags-row`, `.wt-rag-w`, `.wt-status-sel`, `.wt-traj-wrap` (flex row, height 72px), `.wt-traj-bar`, `.wt-traj-fill`, `.wt-traj-lbl`, `.wt-date-row`, `.wt-date-lbl`, `.wt-date-iso`, `.wt-date-chip`, `.wt-green`, `.wt-amber`, `.wt-red`, `.wt-dep-row`, `.wt-dep-kind`, `.wt-dep-name`, `.wt-dep-state`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/render/walkthrough-tiles.test.mjs`
Expected: PASS — 3 cases.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/render/walkthrough-tiles.test.mjs
git commit -m "feat(walkthrough): centre column — prompts + 4-tile signal grid"
```

---

## Task 9: Centre column — open risks + open actions + capture tabs (no comms note)

**Files:**
- Modify: `index.html` — extend `Walkthrough._renderCenter` to populate `[data-wt-open-lists]` and `[data-wt-capture]`; add helper methods.
- Test: extend `tests/render/walkthrough-tiles.test.mjs`

- [ ] **Step 1: Extend the test file**

Append two cases:
1. A project with an open risk and a forum action whose `project_id` matches → `[data-wt-open-lists]` HTML contains "Open risks" + the risk description, and "Open actions" + the action description.
2. The capture row contains exactly three `[data-wt-cap-tab]` elements with text `'+ Decision'`, `'+ Action'`, `'+ Risk'` — no `'+ Comms note'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/walkthrough-tiles.test.mjs`
Expected: FAIL on both new cases.

- [ ] **Step 3: Add `_renderOpenLists(project)` and `_renderCapture(project)`**

Inside `_renderCenter`, after writing the host's HTML, call both methods. They populate their respective `[data-wt-open-lists]` and `[data-wt-capture]` host divs.

`_renderOpenLists`:
- Build `openRisks` from `project.risks_register` (filter to status !== 'closed', sort by impact*probability descending).
- Build `openActions` by walking all governance forums' `actions[]`, filtering to `status !== 'Done' && project_id === project.id`.
- Emit a two-column `<div class="wt-section-row">` containing two `<div class="wt-list-block">` panels (Open risks left, Open actions right). Each row uses `.wt-row` and includes inline action buttons:
  - Risk row: `Close` and `Accept` buttons calling `Walkthrough._closeRisk` / `_acceptRisk`.
  - Action row: `Defer` and `✓ Done` buttons calling `Walkthrough._deferAction` / `_doneAction`.

`_renderCapture`:
- Build a tabs row with three `<button class="wt-cap-tab" data-wt-cap-tab>` elements (Decision / Action / Risk). The active tab gets `.on`.
- Body switches by `_captureTab`:
  - Decision: two text inputs (text, rationale) + Save button.
  - Action: text + owner + due date inputs + Save button.
  - Risk: description + impact + probability inputs + Save button.
- Save buttons call `Walkthrough._submitCapture(projectId)` which dispatches by `_captureTab` to the right write-back helper.

`_setCaptureTab(tab)` re-renders the capture host only. `_submitCapture(projectId)` reads the inputs via `document.querySelector('[data-wt-cap-text]')` etc., dispatches to the right helper, and triggers `_render(App.activeCustomer)` so the open lists and bottom-bar counters refresh.

`_closeRisk` / `_acceptRisk` call `App.updateRiskFromWalkthrough(projectId, idx, 'closed' | 'accepted', wid, '')`.
`_doneAction` calls `App.completeForumAction(forumId, actionId, wid)`.
`_deferAction` prompts for a new date then calls `App.deferForumAction(forumId, actionId, newDate, wid)`.

- [ ] **Step 4: Append the matching CSS**

Add: `.wt-section-row` (2-col), `.wt-list-block` + h6 + count, `.wt-row`, `.wt-row .pri-r/-a/-g`, `.wt-row .due`, `.wt-row .desc/.meta`, `.wt-row .qact button`, `.wt-capture`, `.wt-cap-tabs`, `.wt-cap-tab + .on`, `.wt-cap-input`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/render/walkthrough-tiles.test.mjs`
Expected: PASS — 5 cases.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/render/walkthrough-tiles.test.mjs
git commit -m "feat(walkthrough): centre — open risks/actions + capture tabs (no comms)"
```

---

## Task 10: Right rail — Project narrative panel + "Open pack" picker

**Files:**
- Modify: `index.html` — replace `_renderCustomerPanel` (rename internally to `_renderNarrativePanel`) with the full narrative composer.
- Test: extend `tests/render/walkthrough-layout.test.mjs`

- [ ] **Step 1: Extend the layout test**

Append two cases:
1. After `Walkthrough.open` + `selectProject`, the `.wt-cust` element's HTML contains `'Project narrative'`, `'customer · forum · sponsor'`, and `data-narrative-field="headline"`.
2. Setting the headline textarea's `value` and dispatching a `change` event writes through to `App.data.projects[i].narrative.headline`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/walkthrough-layout.test.mjs`
Expected: FAIL on both new cases.

- [ ] **Step 3: Replace `_renderCustomerPanel`**

Body produces five sections inside the `.wt-cust` host:
1. Header: `<span class="ttl">Project narrative</span>`. Subtitle: `Feeds: customer · forum · sponsor packs`.
2. Headline section: `<textarea class="wt-cust-input" data-narrative-field="headline" onchange="Walkthrough._narrativeHeadlineChange(this.value)">{esc(headline)}</textarea>` plus a `→ pack` annotation.
3. Wins section: list of `<div class="wt-cust-list-row">` rows for each existing win + a `+ add a win` `<input>` whose onchange calls `Walkthrough._narrativeAddListItem('wins', value)`.
4. Asks section: same shape as Wins but with `→ "we need" slide` annotation.
5. Customer-visible risks: list of `<div class="wt-cust-tag">` rows, one per open risk; clicking toggles its inclusion in `narrative.customer_visible_risk_ids` via `Walkthrough._toggleVisibleRisk(riskId)`. Each tag uses an `id` derived from the risk's `id` field if set, otherwise `String(idx)`.
6. Bottom: `📤 Open pack` button calling `Walkthrough._openPackPicker()`.

Helpers:
- `_narrativeHeadlineChange(val)` → `App.updateProjectNarrative(activeProjectId, { headline: val }, _activeWalkthroughId)`.
- `_narrativeAddListItem(field, val)` → patches `wins`/`asks` array; calls `_renderCustomerPanel` after.
- `_removeNarrativeListItem(field, idx)` → splices the index out, patches.
- `_toggleVisibleRisk(riskId)` → toggles set membership in `narrative.customer_visible_risk_ids`.
- `_openPackPicker()` → uses `prompt()` for now (`customer | forum | sponsor`) and dispatches:
  - `customer` → `Report.exportCustomerPack(App.activeCustomer)`.
  - `sponsor` → `Report.exportProjectPack(activeProjectId)` if it exists, else builds via `buildProjectPackDoc` + `_openPrintWindow`.
  - `forum` → looks up the project's `governance_forum`, finds the forum by name, calls `Report.buildForumPackDoc(forum.id || forum.name)` (or `buildAgendaDoc` fallback) + `_openPrintWindow`.

- [ ] **Step 4: Append CSS**

Add: `.wt-cust-h`, `.wt-cust-h .ico/.ttl`, `.wt-cust-sub`, `.wt-cust-section`, `.wt-cust-section .lbl/.for`, `.wt-cust textarea.wt-cust-input { min-height:56px; font-style:italic; color:#1e1b4b; }`, `.wt-cust-list`, `.wt-cust-list-row` + `.x`, `.wt-cust-tag` + `.on`, `.wt-cust-gen` (dashed purple border, hover background).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/render/walkthrough-layout.test.mjs`
Expected: PASS — 5 cases.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/render/walkthrough-layout.test.mjs
git commit -m "feat(walkthrough): right rail Project narrative panel + Open pack picker"
```

---

## Task 11: Hover popovers — DevOps/WFA, sprint assignees, dependency target

**Files:**
- Modify: `index.html` — extend trajectory bar render to embed an assignees `.dash-tip`; extend dependency row render to embed a target-detail `.dash-tip`. Header DevOps/WFA popover already added in Task 8 — verify only.
- Test: extend `tests/render/walkthrough-tiles.test.mjs`

- [ ] **Step 1: Append three cases**

1. A project with `devops_link` + `wfa_link` set → `[data-wt-center]` HTML contains `dash-tip` near "DevOps" and "WFA" strings.
2. A project's skill_splits with `assigned_to: [{ name: 'Alex', points: 5 }, { name: 'Sam', points: 5 }]` → its first `[data-wt-trajectory-bar]` innerHTML contains "Alex" and "Sam".
3. A project with a dependency on another project that has a narrative.headline → its `[data-wt-dep-row]` contains the target's `narrative.headline`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/walkthrough-tiles.test.mjs`
Expected: FAIL on the 3 new cases (Task 8 handled the DevOps/WFA header but the assignees + dep-target popovers don't exist yet).

- [ ] **Step 3: Update trajectory bar render**

In `_renderCenter`, before the `trajBars = ...` line, define an `assigneesFor(sprintId)` helper that flattens `(skill, name, points)` triples by walking `project.skill_splits`. For each bar's HTML, append `<div class="dash-tip wt-traj-tip">{assignees as div lines}</div>` when the assignees array is non-empty.

- [ ] **Step 4: Update dependency row render**

In `_renderCenter`, replace the `depRow` arrow with one that also resolves the target project (`App.data.projects.find(...)`) and emits a `.dash-tip wt-dep-tip` containing the target's name (bold), its `narrative.headline` (italic, if set), the three RAG dots, and the manager. Add `data-wt-dep-row` and `tabindex="0"` to the row container.

- [ ] **Step 5: Append CSS for the popovers**

Add `.wt-traj-bar { position: relative; }`, `.wt-traj-tip` (positioned below the bar, centred), `.wt-traj-bar:hover .wt-traj-tip, .wt-traj-bar:focus-visible .wt-traj-tip` (visible). Same shape for `.wt-dep-row` + `.wt-dep-tip` but anchored top-left.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/render/walkthrough-tiles.test.mjs`
Expected: PASS — 8 cases.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/render/walkthrough-tiles.test.mjs
git commit -m "feat(walkthrough): hover popovers — devops/wfa, sprint assignees, dep target"
```

---

## Task 12: Keyboard shortcuts — Cmd+Enter advances, Esc closes

**Files:**
- Modify: `index.html` — add `Walkthrough._wireKeyboardShortcuts()`; call it from `_render`.
- Test: extend `tests/render/walkthrough-layout.test.mjs`

- [ ] **Step 1: Append the test case**

Open the walkthrough, select Project A, dispatch a `keydown` with `key='Enter'` and `metaKey=true` on `document`, assert `Walkthrough.activeProjectId` advances to the next project.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/walkthrough-layout.test.mjs`
Expected: FAIL — handler not wired.

- [ ] **Step 3: Implement `_wireKeyboardShortcuts`**

The handler:
- Aborts if no overlay exists.
- On `(metaKey || ctrlKey) + Enter`: prevents default, calls `advanceToNext`.
- On `Escape`: removes the overlay, detaches itself.

In `_render`, after `_renderBottomBar`, call `_wireKeyboardShortcuts`. Store the handler on `this._kbHandler` and remove the previous one before re-adding so re-renders don't multiply listeners.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/walkthrough-layout.test.mjs`
Expected: PASS — 6 cases.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/walkthrough-layout.test.mjs
git commit -m "feat(walkthrough): keyboard shortcuts — Cmd+Enter advances, Esc closes"
```

---

## Task 13: Stale-detector integration — surface "weeks since reviewed"

**Files:**
- Modify: `index.html` — `Dashboard.buildRowHtml` (~line 9486) — add a reviewed-ago badge alongside the existing `staleIcon2`.
- Test: `tests/render/stale-reviewed-badge.test.mjs` (new)

- [ ] **Step 1: Locate the stale-detector code**

Run: `grep -n "staleIcon2\|getStaleThreshold\|last_reviewed_at" index.html | head`

- [ ] **Step 2: Write the failing test**

Create `tests/render/stale-reviewed-badge.test.mjs` with one case: a project whose `last_reviewed_at` is 6 days ago and `last_updated` is 30 days ago — assert `Dashboard.buildRowHtml(project)` returned HTML contains `Reviewed` and a number-of-days-or-weeks-ago string.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/render/stale-reviewed-badge.test.mjs`
Expected: FAIL.

- [ ] **Step 4: Add the reviewed badge**

In `Dashboard.buildRowHtml`, after the `staleIcon2` line, compute `lastReviewedMs`/`reviewedDays` from `p.last_reviewed_at`. If non-null, build a small `<span class="reviewed-badge" title="Reviewed N days ago">✓</span>`. Append it after `staleIcon2` inside the project-name `<td>`.

Append CSS: `.reviewed-badge { display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; background:#dcfce7; color:#166534; border-radius:50%; font-size:9px; font-weight:700; margin-left:4px; }` and a dark-mode override.

- [ ] **Step 5: Update existing snapshots**

The Projects-table row snapshots will diff because of the added span. Run `npx vitest run -u` then verify via `git --no-pager diff tests/render/__snapshots__/` that the only delta is the new badge.

- [ ] **Step 6: Run the full vitest suite**

Run: `npx vitest run`
Expected: PASS — all unit + render tests including the updated snapshots.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/render/stale-reviewed-badge.test.mjs tests/render/__snapshots__/
git commit -m "feat(dashboard): reviewed-ago badge alongside stale-since-update icon"
```

---

## Task 14: Full test pass + visual verification + push

- [ ] **Step 1: Run the full vitest + Playwright suite**

Run: `npm test 2>&1 | tail -20`
Expected: all unit/render tests pass (~200 cases) + all 27+ E2E tests pass.

- [ ] **Step 2: Extend the E2E spec**

Open `tests/e2e/walkthrough.spec.ts` and append a test case that:
1. Loads the app with data via `openAppWithData(page)`.
2. Calls `Walkthrough.open('GCC')` via `page.evaluate`.
3. Asserts `.wt-list`, `.wt-center`, `.wt-cust` are all visible.
4. Fills the headline textarea with "Phase 1 on track" and dispatches a `change` event.
5. Reads back `App.data.projects.find(p => p.id === Walkthrough.activeProjectId).narrative.headline` and asserts it equals "Phase 1 on track".

- [ ] **Step 3: Run E2E**

Run: `npx playwright test tests/e2e/walkthrough.spec.ts`
Expected: PASS.

- [ ] **Step 4: Visual verification (manual)**

Start a server: `python3 -m http.server 8475 > /tmp/pcc.log 2>&1 &`
Open `http://localhost:8475/index.html`, click Restore, navigate to Sprint Planning, click Walkthrough. Verify:
- Three columns visible at 1280px+
- Project list left, focused project centre, narrative panel right
- Prompts strip surfaces for amber/stale/risk projects
- 4 tiles render: Health · Trajectory · Dates & Dependencies · Since-last-walkthrough
- Hover the project name → DevOps/WFA links popover
- Hover a trajectory bar → assignees popover (when assignees exist on a sprint)
- Hover a dep row → target headline + RAG popover
- Open Pack picker prompts for Customer/Forum/Sponsor
- ✓ Reviewed advances to the next project; reopening next week the row shows the reviewed badge

- [ ] **Step 5: Commit any final tweaks discovered in visual verification**

```bash
git add index.html
git commit -m "polish(walkthrough): visual fix from manual verification"
```

- [ ] **Step 6: Stop the verification server**

Run: `lsof -ti:8475 | xargs kill -9 2>/dev/null || true`

- [ ] **Step 7: Push**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage:**

- §3.1 Schema additions ↔ Task 1 ✓
- §3.2 Helpers (computeWalkthroughPrompts) ↔ Task 2 ✓
- §3.2 Trajectory + Upcoming ↔ Task 3 ✓
- §3.2 Write-back helpers ↔ Task 4 ✓
- §3.5 Customer pack ↔ Task 5 ✓
- §3.5 Forum + Sponsor enrichment ↔ Task 6 ✓
- §3.6/3.8 Walkthrough module + three-column shell ↔ Task 7 ✓
- §4 Centre column visuals ↔ Tasks 8 + 9 ✓
- §4 Right-rail narrative panel + Open pack picker ↔ Task 10 ✓
- §3.7 Hover popovers ↔ Task 11 ✓
- §4 Keyboard shortcuts ↔ Task 12 ✓
- §3.9 Stale-detector integration ↔ Task 13 ✓
- §8 Acceptance — Task 14 verifies all 12 criteria via the full suite + visual verification.

**Placeholder scan:** No "TBD", no "TODO", no vague "add validation". Every task names concrete helper signatures, DOM hooks, CSS classes, and test expectations.

**Type consistency:**

- `project.narrative` shape (`{ headline, wins, asks, customer_visible_risk_ids, updated_at, updated_by_walkthrough_id }`) used consistently across Tasks 1, 4, 5, 6, 10.
- Helper names match across tasks: `updateProjectNarrative`, `addRiskFromWalkthrough`, `bumpProjectReviewed`, `completeForumAction`, `deferForumAction`, `computeProjectDeliveryTrajectory`, `computeProjectUpcoming`, `computeCustomerPackData`, `computeWalkthroughPrompts`.
- DOM data attributes consistent: `[data-wt-prompts]`, `[data-wt-grid]`, `[data-wt-open-lists]`, `[data-wt-capture]`, `[data-wt-list-pid]`, `[data-narrative-field]`, `[data-wt-cap-tab]`, `[data-wt-trajectory-bar]`, `[data-wt-dep-row]`, `[data-wt-tile]`.
- CSS class names consistent: `wt-shell`, `wt-top`, `wt-list`, `wt-center`, `wt-cust`, `wt-bottom`, `wt-tile`, `wt-grid`, `wt-prompts`, `wt-prompt-item`, `wt-traj-bar/-fill/-lbl/-tip`, `wt-dep-row/-tip`, `wt-cust-h/-input/-list/-list-row/-tag/-gen`, `reviewed-badge`.

No issues found.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-28-walkthrough-source-of-truth.md`.**
