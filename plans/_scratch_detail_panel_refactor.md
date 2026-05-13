# Scratch — Detail Panel IA Refactor (working file)

## Iteration log
- v1 drafted: ✓ (sections A–D)
- PO critique: ✓ (section E, 15 asks)
- SM critique: ✓ (section F, 15 asks)
- UX critique: ✓ (section G, 27 asks)
- Final plan written: ✓ `plans/detail-panel-ia-refactor.md`
- PO sign-off: ✓ with 4 conditions (section H) — applied inline
- SM sign-off: ✓ with 3 conditions (section I) — applied inline
- UX sign-off: ✓ with 5 conditions (section J) — applied inline
- Consensus: ✓ all three personas signed off; conditions resolved

---

## A. Current state inventory (truthful map)

**Mount point:** `#detailPanel`, opened via `DetailPanel.open(projectId)`. Right-side slide-over, ~620px wide on desktop.

**Header chrome (always visible):**
- `panel-header` — id chip + title + close
- `panel-sticky-meta` — customer chip, status, RAG dots, "Updated X ago"
- `panel-toolbar` — Collapse all / Expand all / "Jump to…" select

**Body chrome:**
- Action bar — `Clone Project` / `Save as Template`
- Tab strip (3 tabs): **Setup** · **Health** · **Delivery**
- Audit log (always appended below all tabs)

### Tab inventory

**SETUP** (intent: "once-off configuration")
1. Identity — name, customer, delivery role, category, visibility, sponsor, manager, governance meeting, DevOps link, WFA link
2. Prioritisation — priority#, MoSCoW, business value, time-criticality, risk/opportunity, WSJF breakdown
3. Delivery Setup — data sourcing type + external fields + phase flow toggles/order
4. Dependencies — register
5. Stakeholders — register
6. Strategy linkage — metric ids, persona ids, objectives, business questions
7. Benefits — register
8. Success criteria — register

**HEALTH** (intent: "weekly review surface")
1. EVM strip (no header; rendered before sections)
2. Status & Health — status + 3 RAG dots + "why?" override
3. Strategy — read-only view of linked metrics/personas
4. Assumptions — register
5. Risks — register + 6 quick-add templates
6. Decisions — register
7. Governance Decisions — linked, conditional
8. Meeting Actions — linked, conditional

**DELIVERY** (intent: "daily ops")
1. Dates — hard deadline, target date, started/completed/baseline footer chip
2. Sprint window — auto-populated, read-only (start/end sprint cells)
3. Delivery Phases — per-phase status select + point input + max + variance line + total bar + baseline history link
4. Customer Milestones — register
5. Issues — register

**APPENDED (always):** Change History / Audit log

### Adjacent flows
- **Create project**: `DetailPanel.quickAdd()` → modal wizard (single screen): name, customer, template, total size, lifecycle stage, timeline mode (priority slot OR manual dates). Opens DetailPanel on Setup tab after create, focuses name.
- **Weekly review**: `Walkthrough.open(customer)` — separate full-screen modal, 3-pane (list/center/customer-narrative). Has its own RAG cycle, milestone editor, risk capture, action capture, customer narrative composer. Detail panel is NOT opened during walkthrough.

---

## B. Friction inventory (concrete misalignments)

### B1. Tab boundaries leak
| Field | Current tab | Why misplaced |
|---|---|---|
| **Prioritisation** (WSJF, MoSCoW, business value) | Setup | These get re-tuned every sprint/refinement — not "once-off" |
| **Stakeholders** | Setup | Routinely updated through delivery (joiners/leavers, RACI changes) |
| **Strategy linkage** (editable) | Setup | Duplicates the Health-tab Strategy read-only view |
| **Hard deadline / target date** | Delivery | Hard deadline is a setup input; target date drifts during delivery |
| **Data sourcing dates** (UAT/Go-Live) | Setup (Delivery Setup) | These are mid-delivery operational, not setup |
| **Customer Milestones** | Delivery | These are stakeholder-facing commitments — PO/sponsor surface |
| **Issues** | Delivery | Companion to Risks/Assumptions/Decisions — RAID is split across Health & Delivery |
| **Benefits / Success criteria** | Setup | Tracked all the way through to close-out, not just configured at start |
| **DevOps / WFA links** | Setup → Identity | Tactical links used daily; buried inside Identity grid |
| **Sponsor / Manager** | Setup → Identity | Status-relevant during weekly review; not pure identity |

### B2. Out-of-place reports/metrics in detail panel
- **EVM strip** (planned value, EV, SPI, CPI) — sits at top of Health tab. Mixes portfolio-level analytics into a per-project edit surface; values are computed not editable; uses different mental model from the rest.
- **Baseline variance line + total points bar** — embedded inside the Delivery Phases section, mixing read-only analytics with editable inputs.
- **WSJF/CoD/MoSCoW band/Confidence** breakdown — embedded inside the Prioritisation section as a sub-block.
- **Audit log** — always appended below tabs; never collapsed by default until v2; large + noisy.

### B3. Navigation friction
- 21 sections across 3 tabs, with a "Jump to…" select for in-page nav — the select itself is a tell that the tabs aren't doing their job.
- Collapse-all / Expand-all are session-local toggles; no per-job presets ("collapse to weekly review" / "collapse to scope edit").
- No breadcrumb of where you are inside the panel (no scroll-spy on the tab strip).
- Tabs are not deep-linkable; refresh loses tab state.
- Mobile: panel becomes full-width but tab labels (`Setup` / `Health` / `Delivery`) are unintuitive verbs for a phone-first user.

### B4. Wizard ↔ detail-panel mismatch
- Wizard captures 5 fields. After creation, the user lands on Setup tab with 8 sections, ~30+ further fields, and no progress indicator showing "complete the setup".
- Wizard offers a Lifecycle stage but never asks for Sponsor, Manager, Hard deadline, Visibility, or Governance forum — all of which are arguably essential before the project hits a roadmap or weekly review.
- No template-vs-blank visual differentiation after creation: a 200-line template-cloned project looks identical to a blank one.

### B5. Weekly-review duplication
- Walkthrough has its own RAG-cycle UI, milestone editor, risk capture, narrative composer.
- Detail panel's Health tab has the same RAG selector + risks register + customer milestones — but laid out for solo editing.
- Result: SM in a meeting uses Walkthrough; SM doing a 1:1 deep-dive uses Detail Panel — and the two surfaces drift in subtle ways (e.g. different add-risk template buttons, different narrative model).

---

## C. The three core jobs

| Job | Who | Frequency | Today's path |
|---|---|---|---|
| **J1. Add a new project** | PO / SM | Weekly-ish | + New Project → wizard → Setup tab (overwhelming) |
| **J2. Update a project** | PO / SM / delivery lead | Daily / continuous | Open detail → hunt for correct tab → find section → edit field |
| **J3. Check status** | PO / SM / sponsor | Daily glance + weekly deep-dive | Open detail → Health tab → scroll, OR enter Walkthrough |

Sub-tasks under J2 that should each have an obvious path:
- J2a. Re-prioritise (PO weekly)
- J2b. Change scope (re-baseline points, log reason)
- J2c. Log a risk / issue / decision / assumption (RAID)
- J2d. Update phase status + completed points (delivery lead, daily/sprint)
- J2e. Update RAG + commentary (SM weekly)
- J2f. Update stakeholders / RACI (occasional)
- J2g. Update governance/sponsor/manager (occasional)
- J2h. Update strategy linkage (occasional)
- J2i. Log a customer milestone (PO when committed)
- J2j. Update benefits / success criteria (PO/sponsor at gate reviews)

---

## D. Draft v1 — proposed IA

### D1. Tab structure (4 tabs, intent-named after the job)

**OVERVIEW** — "What is this project, right now?" (status check, read-mostly)
- Headline strip: title, customer chip, status pill, last-updated, last-reviewed-at, sprint window
- RAG triplet (Schedule / Resource / Scope) — with inline override + reason
- EVM strip (read-only) — moved here from Health
- Dates panel: hard deadline · target date · started · completed · baseline (with set/reset baseline action)
- Phase progress strip (read-only summary of phase status + points consumed)
- Top-3 risks (read-only summary; click → jump to Risks)
- Latest activity (last 3 audit log entries)
- CTA chips: "Open in Walkthrough" · "Run Weekly Review"

**SCOPE & VALUE** — "What are we delivering and why?" (PO surface, J2a + J2b + J2h + J2i + J2j)
- Identity sub-block: name, category, lifecycle stage, visibility
- Strategy linkage (editable; only here — no duplicate read-only)
- Prioritisation: priority#, MoSCoW, WSJF inputs (the analytics breakdown moves to Overview as a tiny chip)
- Sizing: per-phase points editor (lifted out of Delivery Phases)
- Benefits register
- Success criteria register
- Customer milestones (moved from Delivery)

**DELIVERY** — "How are we executing?" (SM/delivery surface, J2d + J2g)
- Identity sub-block: customer, delivery role, sponsor, manager, governance forum, DevOps/WFA links
- Delivery configuration: data sourcing type/team/dates + phase flow toggles/order
- Phase tracker: per-phase status + points used + variance (the editor; sizing inputs move to Scope & Value)
- Sprint window (read-only)
- Dependencies (moved from Setup)
- Stakeholders / RACI

**RAID & DECISIONS** — "What's in the way, what did we decide?" (SM/PO daily, J2c)
- Risks (with quick-add templates)
- Issues
- Assumptions
- Decisions
- Governance Decisions (linked, conditional)
- Meeting Actions (linked, conditional)

**Always appended (below tabs, collapsed by default):**
- Audit / Change History

### D2. Header & navigation polish
- Sticky header expands: customer chip · status · RAG triplet · sprint window · target date · *Open in Walkthrough* button → one-click jump to weekly review for this customer with this project pre-selected
- Tab strip uses **noun+intent** labels ("Overview · Scope & Value · Delivery · RAID") not generic ("Setup / Health / Delivery").
- Replace "Jump to…" select with a sticky **mini-TOC** sidebar visible inside each tab (or a horizontally-scrolling chip row on mobile). Active section highlighted as the user scrolls (scroll-spy).
- Tab state persists in URL hash (`#/p/<id>/scope`) so refresh + share both work.
- Add **"Edit mode" toggle**: Read mode hides edit controls (cleaner status check); Edit mode reveals inputs. Defaults to Read on Overview, Edit elsewhere.

### D3. Wizard alignment ("setup wizard")
Expand the current quickAdd modal into a 3-step wizard that mirrors the new tab IA:
- Step 1 **Identify**: name, customer, category, visibility, sponsor, manager, lifecycle stage (was a single field — now grouped with the others)
- Step 2 **Scope & value**: template, total size, MoSCoW, prioritisation slot (or hard dates), strategy link (at least one metric or persona)
- Step 3 **Delivery shape**: data sourcing type, phase flow, hard deadline, target date, governance forum
- Final action: "Create & open Overview" (lands on Overview tab, NOT Setup-equivalent) — so the user sees what they just created, with green/amber chips indicating "you still need: target date, sponsor, …".

Add a "completion meter" pill in the panel header: `Setup 80%` — when red/amber, clicking it opens a checklist of unfilled mandatory fields.

### D4. Weekly review alignment
- Detail panel **Overview tab** = single-project read of what Walkthrough shows across all projects. Same RAG, same milestones, same top-risks. Identical components.
- Detail panel **RAID tab** = the same registers Walkthrough captures into. Editing in one updates the other.
- Walkthrough "open detail" deep-links to the **RAID tab** when capturing a risk/decision/action, or to **Overview** when reviewing.
- Add a "Last reviewed in [walkthrough name] on [date]" chip in the Overview header; clicking opens the walkthrough at this project.

### D5. Per-section cleanups (delete / merge)
- **Drop** the standalone Health-tab "Strategy" read-only block — replaced by editable Strategy linkage in Scope & Value and a read-only summary chip in Overview header.
- **Drop** the per-section Collapse-all / Expand-all toolbar (mini-TOC supersedes it).
- **Move** the WSJF/CoD/MoSCoW band breakdown out of Prioritisation editor and into a single Overview chip + "why?" popover.
- **Merge** the duplicate "Identity" fields: split between Scope & Value (what is it?) and Delivery (who runs it?) — see D1.
- **Default-collapse** Audit log; expose only "Latest 3 activity" entries in Overview.

### D6. Mobile
- Tab strip collapses into a top-of-panel select on <540 px.
- Mini-TOC becomes a horizontal pill scroller below the tab.
- Edit-mode toggle defaults to OFF on mobile (touch users are mostly checking status).

---

(Personas: critique below.)

---

## E. PO persona critique

Reviewed sections A–D as a senior Product Owner running a portfolio across multiple customer accounts. Headline: the four-tab IA is directionally right and Scope & Value is the single biggest unlock for my job. But the proposal leans too SM-operational at the edges, under-serves sponsor reporting, and the wizard is asking for things on day 1 that I genuinely won't know yet. Asks below in priority order.

### Direct answers to the four questions
- **Q1 (tab structure):** Yes, with one caveat — "RAID & Decisions" should be reachable from Overview in one click for sponsor questions, and Scope & Value must be the default landing tab for me, not Overview, when I open from the backlog/Projects list. Overview is the sponsor view; my working view is Scope & Value.
- **Q2 (PO-critical gaps):** Several. Most painful: no explicit benefits realisation tracking (target vs actual vs date-measured), no gate-review surface, no sponsor-sign-off log, customer milestone commitments lack a "committed externally Y/N" flag, and no place to record re-prioritisation rationale when WSJF inputs change.
- **Q3 (wizard):** The 3 steps are reasonable shape but Step 2 over-asks. I will not have target_date, governance forum, sponsor, or strategy linkage at create-time for most projects — they emerge in discovery. Make these soft / skippable with a completion meter, not blocking.
- **Q4 (Overview as sponsor answer):** Close but not quite. Top-3 risks + EVM are operational; a sponsor asks "are we still going to deliver the value we promised, on time, for the cost we said?" — needs benefits health, milestone-commitment status, and a one-line "PO narrative this week" caption. Currently leans SM-reporting, not sponsor-reporting.
- **Q5 (quick wins + red lines):** Quick wins — PO narrative caption, benefits column on Overview, milestone-commitment flag, default-landing tab respects entry point. Red line — do not ship the completion meter as a hard "Setup 80%" gate without making strategy linkage genuinely optional at create time; it will become noise the team learns to ignore.

### Concrete asks

1. **Ask:** Add a "Benefits realisation" register distinct from "Benefits" with columns: benefit · target value · unit · measurement date · baseline · actual · status (Forecast / Realised / Missed / Abandoned) · last-checked-at. Live on Scope & Value, with a one-line summary chip on Overview ("3 of 5 benefits on track").
   **Why:** Today's "Benefits register" is a free-text list — I cannot answer "did we deliver the value we promised" at close-out or 90-day post-go-live, which is half my job. Without this, the panel encourages benefit theatre.
   **Severity:** must

2. **Ask:** On Customer Milestones, add an `external_commitment` boolean ("committed to customer Y/N") plus `committed_in` (governance meeting / email / contract ref) and `committed_date`. Surface externally-committed milestones distinctly on Overview ("2 customer commitments in next 4 weeks: 1 at risk").
   **Why:** A milestone I told myself vs a milestone I told the CFO at a steerco are operationally identical in the current model. Sponsor pings start with "you committed X on date Y" — I need to find that fast.
   **Severity:** must

3. **Ask:** Add a "Sponsor view / weekly caption" single-line textarea at the top of Overview ("PO this week: …", 240 chars, dated, last 4 retained). This is the single thing the sponsor reads. Auto-prompt to update on every walkthrough.
   **Why:** Right now there is no first-person PO narrative on the panel — only RAG and registers. Sponsors want a sentence, not a register. Walkthrough has a customer narrative composer; per-project equivalent is missing.
   **Severity:** must

4. **Ask:** Re-prioritisation should write an audit-bearing reason. When WSJF inputs (BV / TC / RR) or MoSCoW change, prompt for "why now?" (free text, 1 line). Surface the last 3 re-prioritisation reasons inline under the WSJF chip on Scope & Value.
   **Why:** WSJF moves get questioned in steerco ("why did this drop from 4 to 11?"). The audit log currently captures the value change but not the reason. PO accountability demands a stated rationale.
   **Severity:** must

5. **Ask:** Make Scope & Value the **default landing tab** when opening from the Projects list, Backlog, or Roadmap. Overview is the landing tab only when opening from Walkthrough, Dashboard, or a sponsor-share link. Encode entry-point in the deep-link.
   **Why:** PO daily work is editing scope/priority/benefits. SM/sponsor daily work is reading status. Forcing the PO through Overview every time adds a click and an attention reset. Entry-point-aware defaults solve both jobs without a global setting.
   **Severity:** should

6. **Ask:** Add a "Gate review" sub-section on Scope & Value with: gate name (Discovery → Design → Build → UAT → Live → Benefits) · planned date · actual date · decision (Go / No-Go / Conditional) · sign-off-by (person ref) · evidence link. Roll up to a single Overview chip ("Last gate: Design — Go, 12 Apr; Next: UAT, 28 May").
   **Why:** Lifecycle stage is a tag, not a checkpoint. Real portfolio governance requires gate decisions on the record. Today they live in meeting minutes; if the panel claims to be the project's source of truth it must own this.
   **Severity:** should

7. **Ask:** Soften wizard Step 2 — make target_date, hard_deadline, governance forum, strategy linkage all **skippable** with explicit "Add later" affordance. Only enforce: name, customer, MoSCoW band (or "unranked"), lifecycle stage. Move governance forum + hard_deadline to Step 3, where they belong, and mark them optional.
   **Why:** At create-time for a fresh inbound idea I know name + customer + a rough size. Forcing strategy link and hard deadline produces fake data that then needs unpicking. Better to land with an honest "incomplete" state and the completion meter than to be lied to.
   **Severity:** must

8. **Ask:** Replace the binary completion meter with a **fitness checklist** grouped by use-case: "Ready for backlog review" (name, MoSCoW, rough size) · "Ready for sprint planning" (phase points, target_date, manager) · "Ready for steerco" (sponsor, benefits, gate plan, RAG). Each group ticks green when its slice is filled.
   **Why:** "Setup 80%" is meaningless — which 20% am I missing and does it matter today? A staged checklist matches how projects mature.
   **Severity:** should

9. **Ask:** Add a Stakeholders → "Sponsor sign-off log" with date · scope-statement-version · sponsor · status (Approved / Conditional / Rejected) · evidence. Distinct from Decisions register.
   **Why:** Sponsor approvals are scope-bearing and gate-bearing; burying them in Decisions makes them unfindable when a customer disputes scope at UAT. PO is accountable for keeping receipts.
   **Severity:** should

10. **Ask:** Surface a "Strategy contribution" mini-chip in the Overview header: persona(s) · top-linked metric · OKR if set. Clicking opens Scope & Value scrolled to Strategy linkage.
    **Why:** Today strategy is a flat list of IDs. Sponsors ask "what does this project move?" — needs the one-line answer at the top, not a register click-through. Matches the metrics-team identity in user memory: metrics are the central deliverable, not metadata.
    **Severity:** should

11. **Ask:** On Scope & Value sizing, when total points change post-baseline, force a one-line "scope change reason" tied to a Decision register entry (auto-created, editable). Show net delta vs baseline next to the sizing input.
    **Why:** Silent re-sizing is the single largest source of "where did the variance come from" questions. The PO owns scope; the panel should make scope changes feel deliberate.
    **Severity:** must

12. **Ask:** Move EVM strip on Overview behind a toggle / "show analytics" disclosure. Default: PO narrative + RAG + milestones + benefits + top-3 risks. EVM is operational data the SM/finance lead care about; sponsors mostly don't read it.
    **Why:** The proposal correctly removes EVM from Health, but it shouldn't dominate Overview either. Overview must answer the sponsor question first; analytics second.
    **Severity:** nice

13. **Ask:** Wizard should infer / suggest, not just collect. If a template is picked, pre-fill MoSCoW from template default, suggest a default governance forum from customer config, suggest a strategy link from other projects on this customer. All editable, all explicitly labelled "Suggested".
    **Why:** Three-step wizard is heavy if every field is empty. Templates exist; lean on them. PO will say yes/no faster than typing.
    **Severity:** should

14. **Ask:** "Open in Walkthrough" CTA on Overview is good — also add the reverse on Walkthrough: a "Re-prioritise" shortcut that deep-links to Scope & Value with the WSJF block focused. Re-prioritisation often happens *during* a weekly review when new info lands.
    **Why:** Today I have to close walkthrough, find the project, open detail, scroll. With this, prioritisation becomes a normal walkthrough action.
    **Severity:** should

15. **Ask:** RAID tab: split Risks vs Issues visually (two columns or two stacked panels with distinct accents), and add a "Mitigation owner + due-date" field on Risks, not just on Actions. Today risks are captured but ownership of mitigation is implicit.
    **Why:** Risk without an owner is a feeling. PO is asked weekly "who's working the mitigation on R-12?" — needs to be inline, not in a separate Actions register.
    **Severity:** should

### Red lines (do not ship)
- Do **not** ship the wizard requiring strategy linkage and hard_deadline at Step 2/3 as mandatory. It will produce fake data within a week.
- Do **not** drop Customer Milestones into Scope & Value without the external_commitment flag (Ask #2). Without that flag, the move from Delivery to Scope & Value loses semantic value.
- Do **not** unify Detail-panel RAID and Walkthrough RAID without a clear write-arbitration model (last-write-wins is unacceptable when SM and PO edit the same risk minutes apart). State the rule in the plan before building.
- Do **not** auto-collapse the Audit log to "Latest 3" without keeping a 1-click "show all" — audit is a PO defence artefact, not noise.

### Strongest endorsements
- The four-tab split with named intents is correct. Keep it.
- Editable Strategy linkage in one place (Scope & Value) and read-only in Overview is the right pattern; do the same for Stakeholders/RACI eventually.
- Deep-linkable tab state via URL hash is essential for sharing with sponsors — make sure it survives login redirects if/when auth lands.
- "Edit mode" toggle defaulting to Read on Overview is a quiet win for sponsor screenshots.

---

## F. Scrum Master persona critique

Lens: I run weekly walkthroughs for 3+ squads, capture RAID live in meetings, and the detail panel is what gets shared on screen with a sponsor for 30 minutes. The proposed IA improves the labels but, as drafted, splits things I touch together and bundles things I touch separately.

1. **Ask:** Keep a tightly-scoped *Risks + Issues capture strip* visible (or one tap away) on the **Delivery** tab, not only on the RAID tab.
   **Why:** During standup and end-of-sprint reviews I'm watching phase status / variance and a new risk surfaces *because of* that variance. Tab-hopping to RAID to log a row, then back to Delivery to finish the points convo, breaks the flow and risks me losing the row. Walkthrough already has inline risk capture — the panel must match.
   **Severity:** must

2. **Ask:** Don't put **Sprint window** + **Phase tracker (points/variance)** + **Dependencies** on different tabs.
   **Why:** Sprint window readability is meaningless without seeing committed-vs-completed per phase, and dependencies are why a phase slips. These are one sentence in a review ("DE slipped because dep X moved, so the end-sprint pushed by one"). If Dependencies stays on Delivery and Sizing inputs move to Scope & Value, that's a different break — see #4.
   **Severity:** must

3. **Ask:** Move **Customer Milestones** to **Delivery**, not Scope & Value.
   **Why:** Customer milestones are external commitments tracked against the sprint window and hard deadline — they live in the same conversation as phase status and the dates panel. A sponsor in the 30-min review asks "are we still hitting the milestone?" right after looking at the sprint window. Putting them on Scope & Value forces a tab jump for the most common sponsor question.
   **Severity:** must

4. **Ask:** Do **not** split phase **sizing** (Scope & Value) from phase **status/actuals** (Delivery).
   **Why:** Re-baselining points is the single most common mid-sprint edit when scope changes. The PO sets new size, the SM logs the variance, the baseline_history captures the audit — all in one motion, with the "Reset Baseline" button right next to the inputs. Splitting them across two tabs guarantees stale sizing on one side and tab-hopping on the other. Either keep both on Delivery, or co-locate them in a single "Scope & Sizing" sub-block that is reachable from either tab.
   **Severity:** must

5. **Ask:** RAID tab is fine as a *register/index*, but every register **must** also have an inline quick-add (one-line capture) accessible from Overview and Delivery without opening RAID.
   **Why:** A live meeting is "say it out loud → type it in five seconds → carry on talking". Forcing a tab switch to capture a risk loses the wording. Pattern: a `+ quick risk` chip in Overview's "Top-3 risks" block and on Delivery's phase tracker that opens a 1-row inline form. The full register edit lives on the RAID tab as today.
   **Severity:** must

6. **Ask:** Promote a **Blockers** view (a filtered slice of Risks+Issues where state = blocking / overdue / red) to the Overview tab.
   **Why:** "Top-3 risks" by recency is not the same as "what's blocking us right now". A SM opens the panel pre-standup to call out blockers; if the panel buries them inside RAID, the standup either runs without that lens or the SM bypasses the panel entirely.
   **Severity:** should

7. **Ask:** Sticky header must include **completed/committed for the current sprint** and **assignee chips for the current sprint**, not just sprint window dates.
   **Why:** A 30-min sponsor review opens with "what did we finish this sprint, who's on it". If that requires scrolling Delivery to find the phase tracker, the first 90 seconds are wasted hunting. The Walkthrough already shows committed/completed trajectory bars and assignees-on-hover — mirror that in the panel header.
   **Severity:** should

8. **Ask:** Stakeholders / RACI on **Delivery** is wrong placement — keep them with **Sponsor / Manager / Governance forum** as the "who runs it" cluster, but also surface a read-only RACI strip on Overview.
   **Why:** During retro and during sponsor reviews the question "who's accountable for this delay" comes up constantly. Having the cluster of people-fields together is right, but only Delivery means the sponsor never sees it on Overview.
   **Severity:** should

9. **Ask:** **Decisions** must live near both RAID *and* near Phase tracker / Dates.
   **Why:** Mid-delivery decisions ("we're descoping the UAT phase", "we're pushing target by a sprint") are made *while looking at* the phase tracker and dates. A "log decision" button has to be there, not only on the RAID tab. Same pattern as #5 — inline quick-add chip wherever the decision is triggered.
   **Severity:** should

10. **Ask:** The **"Open in Walkthrough"** chip in the Overview header is good — but Walkthrough → Detail must deep-link back to the *correct sub-section* (not just tab), and edits in either surface must round-trip without an explicit Save.
    **Why:** D4 promises identical components — that only holds if the data model is genuinely shared. Today the Walkthrough has its own RAG capture, its own risk-add templates, its own narrative composer. If after the refactor I edit a risk in Walkthrough, refresh the detail panel, and the risk text differs (e.g. different timestamp shape, different schema field used) — we'll silently corrupt the register. Need a documented "single source of truth per field" matrix before D4 ships.
    **Severity:** must

11. **Ask:** Replace the "completion meter" pill (`Setup 80%`) with a **Readiness gate** that blocks weekly-review inclusion until set.
    **Why:** A percentage in the header is decoration. What I actually need: until *sponsor, manager, hard deadline, governance forum, target sprint* are set, the project shows as `setup incomplete` in the Walkthrough list and the weekly review banner says "1 project needs setup". That's the only way the meter changes behaviour. Mandatory fields belong in `App.calculateWsjf`/integrity, not vibes.
    **Severity:** should

12. **Ask:** Add a **"Last reviewed at"** + **"Reviewed by"** stamp in the Overview header, populated by Walkthrough.markProjectReviewed.
    **Why:** D4 mentions a "Last reviewed in [walkthrough name]" chip — make it concrete: who marked it reviewed and on what date. Drives accountability and lets the sponsor see staleness without opening audit log.
    **Severity:** should

13. **Ask:** Edit mode toggle that *defaults to Read on Overview* is right; but on Delivery the default must be **Edit** during a sprint window (current_sprint set) and **Read** outside it.
    **Why:** Cognitive load — when a sprint is running I am editing daily; when no sprint is active I am only looking. Static defaults will produce the wrong answer roughly half the time.
    **Severity:** nice

14. **Ask:** Don't merge Audit log into a single bottom-of-panel block — split into **Recent activity** (last 5, always visible on Overview) and **Full audit** (collapsed, behind a link).
    **Why:** The "always appended below tabs" model is what created today's noise. Last 5 is the only thing I read in a review; the full log is forensic.
    **Severity:** nice

15. **Ask:** Red line — **do not ship D3's 3-step wizard** unless step 3 is optional / skippable on create.
    **Why:** Today's quickAdd is 5 fields and gets a project on the board in 15 seconds. A 3-step wizard with mandatory data-sourcing type, phase flow, hard deadline, target date, governance forum will kill the "log a project in standup" flow. Make Identify mandatory, Scope & Value soft-required (allow draft), Delivery shape completely optional at create time — and surface the "incomplete" state via #11's readiness gate.
    **Severity:** must

---

## G. UX expert persona critique

Lens: enterprise PPM (Linear/Jira/Asana/Smartsheet/Monday), Nielsen heuristics, progressive disclosure, recognition over recall, error prevention, mental-model fit, accessibility. Findings on Section D below; where PO (E) or SM (F) already flagged the same concern, I cross-reference rather than restate.

### G1. Tab IA — coherence, MECE, label scent

1. **Ask:** Rename **RAID & Decisions** to plain **RAID** in the tab strip (full name as the panel H1 inside the tab), and reorder to **Overview · Delivery · Scope & Value · RAID**.
   **Why:** "RAID" already means Risks/Assumptions/Issues/Decisions; "& Decisions" is redundant and bloats the strip. Delivery > Scope precedence matches daily-use frequency (J2d/J2e dominate over J2a/J2b/J2h/J2j) and reads as paired "what is this" tabs (Overview + Scope) with operational tabs to their right.
   **Severity:** should

2. **Ask:** Resolve the **"Identity" split** ambiguity. The plan puts name/category/lifecycle/visibility in Scope & Value but customer/role/sponsor/manager/governance/links in Delivery. That's not MECE for the user — "who is the sponsor?" is an identity question, not a delivery one.
   **Why:** Splitting identity by "what vs who" passes the designer's logic test but fails recognition-over-recall: a new user opens Scope & Value looking for sponsor and bounces. Either (a) keep a single Identity sub-block on Overview (read-only) with edit deep-links, or (b) put **all identity in Scope & Value** and limit Delivery to ops (config, phases, sprints, dependencies, stakeholders, links). Option (b) is cleaner and aligns with SM #8.
   **Severity:** must

3. **Ask:** Surface **Customer Milestones** on **Overview as a read-only strip** in addition to wherever the editable register lives. PO (E) wants them on Scope & Value with an `external_commitment` flag; SM (F#3) wants them on Delivery. Resolve by: editable register on Delivery (sponsor's most common question lives next to dates and phases), summary strip on Overview.
   **Why:** Milestones are the single highest-scent artefact for a 30-second exec check. Burying them one tab deep breaks the Overview promise of "what is this project, right now?". Splitting "summary on Overview, editor on Delivery" satisfies both PO and SM.
   **Severity:** must

4. **Ask:** Sanity-check whether **Dependencies** belong in Delivery or RAID. Jira Advanced Roadmaps, Asana, Monday treat dependencies as a RAID sibling because they have status (blocked/satisfied).
   **Why:** If the register has status + resolution, it's RAID-shaped; if it's pure linkage, Delivery is fine. Decide deliberately and document. Don't let the split happen by accident.
   **Severity:** nice

### G2. Read-mode / Edit-mode toggle

5. **Ask:** Drop the **global Read/Edit toggle**. Replace with **inline edit affordances** (click-to-edit fields with a clear hover/focus state, like Linear and Notion). SM #13's "auto-switch on current_sprint" is a smart heuristic but presupposes the toggle exists.
   **Why:** A modal mode toggle is the canonical mode-error Nielsen and Tognazzini warn against — users try to edit, find inputs disabled, hunt for the toggle, then forget which mode they're in. The same field renders differently in each mode, hurting recognition. Inline edit satisfies the "clean status check" goal because uneditable values render as text until clicked/focused. If a mode must survive, scope it to Overview only and call it **Compact view**, not "Read mode".
   **Severity:** must

6. **Ask:** If the toggle survives review, persist its state **per user, not per session**, and put the switch in the sticky header.
   **Why:** Per-session state is invisible after a refresh; users will rediscover it constantly. Per-user persistence respects heuristic 7 (flexibility & efficiency of use).
   **Severity:** should

### G3. Mini-TOC, scroll-spy, accordion

7. **Ask:** At 480–620 px width, a left-rail mini-TOC eats 120–160 px and crushes form fields. Use **a sticky chip row under the tab strip** (scroll-spy highlights active section, click jumps) on all viewports.
   **Why:** Side panels are vertical scroll surfaces; horizontal chips preserve form column width, are touch-friendly, mirror the tab strip's affordance language, and avoid double-rail noise. Linear, Height, modern Jira side panels all do this.
   **Severity:** must

8. **Ask:** Use **accordions only for low-frequency registers** (Audit/History, Governance Decisions when empty, Meeting Actions when empty). Don't accordion primary tab content — it hides scent and forces 2 clicks to find a field.
   **Why:** Accordions are an anti-pattern for forms: they break Ctrl-F, screen-reader linear traversal, and recognition. Scroll-spy + sticky chips beat accordions for 5–8 sections.
   **Severity:** should

9. **Ask:** Add **anchor-deep-link support** for sections (`#/p/<id>/scope#benefits`), not just tabs. Pairs with SM #10's demand for sub-section deep-links from Walkthrough.
   **Why:** Walkthrough → "edit benefits" should land *at* the benefits register, not the top of Scope & Value. Same for audit-log links and notifications.
   **Severity:** should

### G4. Information density and chunking

10. **Ask:** Cap **Scope & Value at 4 visible sub-blocks**, not 7. Today's plan: Identity, Strategy, Prioritisation, Sizing, Benefits, Success criteria, Customer milestones. Merge **Benefits + Success criteria** into one "Outcomes" register with a type field, follow SM #4 to **co-locate Sizing with Phase tracker** (Delivery), and move Customer milestones per #3 above.
    **Why:** Task-flow heuristic: a PO opening Scope & Value to re-prioritise shouldn't scroll past sizing inputs that belong with execution. Sizing-with-phases also matches the Solver's mental model (points per skill, allocated per phase) and the SM's re-baseline motion.
    **Severity:** must

11. **Ask:** Adopt a **two-tier heading system** consistently: H3 = sub-block (e.g. "Prioritisation"), H4 = optional grouping inside (e.g. "WSJF inputs"). Existing `panel-section` CSS (lines 1099–1131) supports this with a tweak; codify it and ban ad-hoc bold "labels" that read as headings.
    **Why:** Inconsistent heading hierarchy is the #1 reason form panels feel cluttered. Screen readers also rely on H-level for skim-nav.
    **Severity:** should

12. **Ask:** Group fields by **time-to-update**, not by data type. Rarely-changed fields (visibility, category, lifecycle) collapse behind a "More details" disclosure inside each sub-block.
    **Why:** Progressive disclosure. The weekly editor should see weekly-touched fields above the fold. Lifecycle stage is set once and forgotten — it doesn't deserve the same visual weight as MoSCoW.
    **Severity:** should

### G5. Edge cases the plan glosses over

13. **Ask:** Define **empty state per section** explicitly. New project lands on Overview, but Overview is read-mostly — EVM strip, dates, phase progress, top-3 risks will all be empty or zero. Spec: empty registers show a 1-line CTA card ("No risks logged. Capture one →"); empty metrics show "—" not "0" (zero is meaningful); EVM strip hides entirely if no baseline.
    **Why:** Zero values lie ("CPI 0.00" looks alarming on a project with no points spent). Heuristic 1 (visibility of status) demands we distinguish "no data" from "data = 0".
    **Severity:** must

14. **Ask:** Specify **Walkthrough ↔ Detail-panel write-conflict** resolution. Plan says "editing in one updates the other" — but if both are open and both edit RAG, last-write-wins silently overwrites. Add `last_edited_at` + `last_edited_in` ('walkthrough' | 'detail') and surface a toast when the other surface mutates the same field while open. Pairs with SM #10's "single source of truth per field" matrix.
    **Why:** Walkthrough on a meeting screen + detail panel on a laptop will silently overwrite each other. Data-loss class bug, not a UX one.
    **Severity:** must

15. **Ask:** Define **focus management on tab switch mid-edit**. If a user is in a dirty input on Scope & Value and clicks Delivery, do we (a) auto-save, (b) prompt, (c) silently discard? Pick one and apply consistently. Recommended: auto-save (localStorage already auto-saves) **with an undo toast** for 8 seconds — matches Gmail, Linear, Notion. Never silently discard.
    **Why:** Heuristics 3 (user control & freedom) and 5 (error prevention).
    **Severity:** must

16. **Ask:** Add **keyboard shortcuts**: `g o / g s / g d / g r` to jump tabs; `j / k` for section nav; `/` to focus mini-TOC search; `cmd+s` shows a "Saved" confirmation toast (since auto-save); `esc` closes the panel with a dirty-edit guard.
    **Why:** Power users (PO/SM updating daily) live on keyboard. PPM tools without keyboard nav lose to Linear within 6 months.
    **Severity:** should

17. **Ask:** Provide an **explicit Discard / Undo** affordance. Inline edit + auto-save means an accidental keystroke mutates data — users need an obvious escape hatch. Per-field undo via undo toast; per-session "revert all changes since open" in the panel overflow menu.
    **Why:** Heuristic 3 (user control & freedom). Audit/History alone doesn't satisfy this — users don't think of history as undo.
    **Severity:** must

### G6. Header, completion meter, wizard

18. **Ask:** The proposed sticky header packs **customer · status · RAG triplet · sprint window · target date · Open in Walkthrough**, and SM #7 wants to add committed/completed + assignee chips. That's 8+ elements before the tab strip — too dense at 480 px. Define a **two-row sticky header**: row 1 = identity (customer, status, RAG, completion gate, Open in Walkthrough); row 2 = sprint context (sprint window, committed/completed, assignees), collapsible on <540 px.
    **Why:** Sticky chrome shouldn't exceed 2 lines on mobile; a single overstuffed row hurts everyone. Two rows with a clear visual hierarchy lets us include SM's review-critical chips without crowding the identity band.
    **Severity:** should

19. **Ask:** The **"Setup 80%" completion meter** needs spec on (a) what counts as "complete" per field — required vs recommended; (b) does it block anything or is it informational; (c) does the denominator grow with new fields (forever-amber)? Reconcile with SM #11's **readiness gate** (blocks weekly-review inclusion until mandatory fields set) and PO #11's "scope change reason auto-creates a Decision".
    **Why:** Half-spec'd completion meters become noise users learn to ignore. Make the meter a *gate* not decoration — show in Walkthrough list and weekly-review banner as SM proposed.
    **Severity:** should

20. **Ask:** Wizard step 2 demands **strategy link (at least one metric or persona)** on create. Soft-require, don't hard-require. PO/SM both flagged this as a red line — endorse and codify.
    **Why:** A tactical/keep-the-lights-on project shouldn't be blocked at creation. Completion meter flags the gap post-create. Hard requirements push users to bypass the wizard via JSON import or fake metrics. PO #13's "suggest from template/customer/similar projects" makes the wizard tolerable; without that, it's painful.
    **Severity:** should

### G7. Accessibility and responsive

21. **Ask:** Spec **ARIA semantics**: `role="tablist"` on the tab strip, `role="tab"` + `aria-selected` per tab, `role="tabpanel"` per panel, `aria-controls` linking them. Mini-TOC chips: `role="navigation"` with `aria-current="location"` on the active section. Focus order: tab strip → mini-TOC → main content. Trap focus inside the slide-over when open; restore focus to opener on close.
    **Why:** A 4-tab refactor without ARIA spec ships inaccessibly and gets retrofitted later (expensive). Get it right at IA-spec time.
    **Severity:** must

22. **Ask:** Test **mobile collapse to a select** (D6, <540 px) against the keyboard-shortcut spec from #16. A `<select>` can't host `g o / g s / g d / g r` naturally and hides the active tab's siblings.
    **Why:** Internal consistency. Either keep a horizontal tab scroller on mobile (preferred) or accept shortcuts are desktop-only — but state it.
    **Severity:** nice

### G8. Red lines and quick wins

23. **Red line:** Don't ship the **global Read/Edit toggle** as currently specified (#5). Single highest-risk piece of the refactor.
    **Severity:** must

24. **Red line:** Don't ship without **empty-state + conflict-resolution + undo** specs (#13, #14, #17). All three are data-correctness, not polish.
    **Severity:** must

25. **Quick win:** Replace today's "Jump to…" `<select>` with the sticky chip row + scroll-spy **first**, before touching tab IA. 1-day change, solves ~60% of B3 navigation friction, de-risks the rest.
    **Severity:** must

26. **Quick win:** Default-collapse the **Audit log** and rename to **History** in the UI. "Audit" reads as compliance; "History" matches user mental model. Pairs with SM #14's split into Recent activity + Full history. PO red line: keep 1-click "show all" available.
    **Severity:** nice

27. **Quick win:** Ship the **"Last reviewed in Walkthrough on …"** chip (D4) as v0, concretised with SM #12's "reviewed by" stamp — high signal, low engineering cost, removes the "are these two surfaces in sync?" anxiety.
    **Severity:** should

### Summary table

| # | Severity | Theme |
|---|---|---|
| 2, 3, 5, 10, 13, 14, 17, 21, 23, 24, 25 | must | MECE leaks, milestones scent, mode error, empty-state, conflict, undo, ARIA, quick win |
| 1, 6, 7, 8, 9, 11, 12, 16, 18, 19, 20, 27 | should | Labels, density, focus, header weight, keyboard, wizard soft-require |
| 4, 22, 26 | nice | Dependencies placement, mobile shortcuts, History rename |

---

## H. PO sign-off

Validated final plan (`detail-panel-ia-refactor.md`) against my 15 asks.

| Ask | Verdict | Note |
|---|---|---|
| E#1 Benefits realisation register | ✓ resolved | §3.2 Outcomes merges benefits+SC with target/actual/status/last_checked_at; Overview chip §3.2/Overview#7. |
| E#2 Milestone external_commitment flag | ✓ resolved | §3.2 Delivery#7 adds the flag + committed_in/date; Overview read-only strip surfaces externally-committed first. |
| E#3 PO weekly caption | ✓ resolved | §3.2 Overview#1 ties to Walkthrough narrative.headline as one source. |
| E#4 Re-prioritisation reason auto-Decision | ✓ resolved | §3.2 "Re-prioritisation reason capture" + tests in §6. |
| E#5 Entry-point-aware default tab | ✓ resolved | §3.1 explicit routing matrix; URL hash overrides. |
| E#6 Gate reviews register | ✓ resolved | §3.2 Scope & Value#5; collapsed by default with Overview chip. Open question on gate names flagged in §8. |
| E#7 Soften wizard Step 2 | ✓ resolved | §3.7 only name+customer+size mandatory; Steps 2+3 skippable; 15-sec flow preserved via "Add details later". |
| E#8 Fitness checklist not % meter | ✓ resolved | §3.6 three-stage readiness gate (backlog/planning/steerco) replaces meter. |
| E#9 Sponsor sign-off log | ✓ resolved | §4.4 stakeholders type `sponsor_sign_off`; §3.2 Delivery#6 co-locates. |
| E#10 Strategy contribution chip on Overview | ✓ resolved | §3.2 Overview#9. |
| E#11 Scope-change reason → Decision | ✓ resolved | §3.2 "Scope change reason" with net delta vs baseline next to sizing input. |
| E#12 EVM behind disclosure | ✓ resolved | §3.2 "Show analytics" disclosure; hidden when no baseline. |
| E#13 Wizard suggests, not just collects | ✓ resolved | §3.7 explicit "Suggested" labels driven by template/customer/peer. |
| E#14 Re-prioritise shortcut from Walkthrough | ⚠ partial | §3.8 confirms deep-link sub-sections from Walkthrough, but no explicit "Re-prioritise" CTA spec'd on Walkthrough → Scope & Value#prioritisation. Add one line. |
| E#15 Risk mitigation_owner + due_date | ✓ resolved | §4.4 schema additions; §3.2 RAID#1 references. Visual split of Risks vs Issues not explicitly called out — minor. |

**Red lines respected:**
- Wizard strategy linkage non-mandatory at create — yes (§3.7).
- Milestones move gated on external_commitment flag — yes (§3.2 Delivery#7).
- Unified RAID write-arbitration before unified writes ship — yes (§3.8 matrix is a hard gate before Phases 4–5 per §9).
- Audit/History never hidden without 1-click "show all" — yes (§3.12 explicit PO red line).

**Pushback on consensus changes:**
- Phase sizing moved to Delivery (not Scope & Value): I conceded this in tension table — accept, but the scope-change reason capture (E#11) must fire on the Delivery sizing input, not only on Scope & Value. §3.2 says "Show net delta vs baseline next to sizing input on Delivery" — good, hold the line in implementation.
- Default landing = Delivery from Projects table: acceptable given entry-point routing, but watch metrics — if POs land on Delivery and immediately hop to Scope & Value, flip the default.
- Inline click-to-edit replacing Read/Edit toggle: UX won this one cleanly. Risk noted in §9; I accept the medium-risk mitigation (pencil icon fallback).

**Verdict: Sign off with conditions.**

Conditions (one-line fixes to the plan):
1. Add explicit "Re-prioritise" CTA on Walkthrough that deep-links to `#/p/<id>/scope#prioritisation` (closes E#14 gap).
2. Phase 5 acceptance must include: scope-change reason fires from the Delivery sizing input, not only Scope & Value.
3. RAID tab must visually distinguish Risks vs Issues (two columns or stacked accents) — call out in §3.2 RAID block.
4. §3.6 readiness gate enforcement (Phase 8) must not block manual creation flows for in-flight projects already below the gate — grandfather existing data.

---

## I. Scrum Master sign-off

Validated final plan (`detail-panel-ia-refactor.md`) against my 15 prior asks.

### 1. Ask-by-ask trace

| # | Ask (short) | Severity | Plan ref | Status |
|---|---|---|---|---|
| F#1 | Inline risk capture on Delivery, not RAID-only | must | §3.2 Delivery quick-add chips; §5 Phase 5 | ✓ resolved |
| F#2 | Sprint window + phase tracker + dependencies co-located | must | §3.2 Delivery sub-blocks 2/3/5 all on Delivery | ✓ resolved |
| F#3 | Customer milestones on Delivery | must | §3.2 Delivery#7 editable + Overview read-only strip | ✓ resolved |
| F#4 | Don't split phase sizing from phase status | must | §3.2 Delivery#2 sizing co-located here, NOT Scope & Value; §8 row 3 | ✓ resolved |
| F#5 | Quick-add chips on Overview + Delivery, not RAID-only | must | §3.2 Delivery chips; §5 Phase 5; §8 row 10 | ✓ resolved |
| F#6 | Blockers strip on Overview | should | §3.2 Overview#6 "Blockers + Top-3 risks" | ✓ resolved |
| F#7 | Sticky header shows committed/completed + assignees | should | §3.4 Row 2 sprint context | ✓ resolved |
| F#8 | People-cluster together; RACI read-only on Overview | should | §3.2 Delivery#6 stakeholders+sign-off co-located; Overview read-only RACI strip absent | ⚠ partial |
| F#9 | "Log decision" near phase tracker + dates | should | §3.2 Delivery `+ Log decision` chip; auto-Decision on scope-change | ✓ resolved |
| F#10 | Walkthrough ↔ Detail SoT matrix before unification | must | §3.8 per-field matrix; §5 Phase 6 hard gate | ✓ resolved |
| F#11 | Readiness gate replaces completion meter, blocks weekly review | should | §3.6 three-stage gate; §5 Phase 8 enforcement | ✓ resolved |
| F#12 | "Last reviewed by/at" stamp on Overview | should | §3.4 Row 1; §5 Phase 0(c) | ✓ resolved |
| F#13 | Edit-mode default by current_sprint | nice | §3.3 global toggle dropped — moot | ✓ acceptable |
| F#14 | Recent activity (last 5) vs Full history split | nice | §3.12 split; §3.2 Overview#8; History bottom-of-panel | ✓ resolved |
| F#15 | Don't ship 3-step wizard unless step 3 skippable (15s standup flow) | must | §3.7 Step 1 mandatory only; "Add details later →" preserves quickAdd | ✓ resolved |

F#13 resolution: accept. Dropping the global Read/Edit toggle removes the mode-error class entirely; inline click-to-edit works the same whether a sprint is active or not — no heuristic needed.

### 2. Priority items preserved

- F#4 phase sizing co-located with phase status: yes, §3.2 Delivery#2 is explicit and §8 documents I won the tension against PO assumption.
- F#1 + F#5 + F#9 inline quick-add for RAID: yes, `+ Log risk / + Log issue / + Log decision` chips on Phase tracker plus auto-Decision on scope-change and re-prioritisation.
- F#10 Walkthrough SoT matrix: yes, §3.8 is a real per-field table with conflict rules and §5 Phase 6 gates unified writes behind it.
- F#15 15-second standup wizard: yes in spirit — §3.7 collapses Steps 2+3 into "Add details later →" so quickAdd survives.

### 3. Push-backs on consensus changes

- **F#8 partial:** §3.2 Delivery#6 co-locates Stakeholders/RACI with Sponsor sign-off log — good. But the read-only RACI strip on Overview I asked for is absent. Sponsor reviews ask "who's accountable" before opening Delivery.
- **Default landing = Delivery from Projects/Backlog/Roadmap (§3.1):** plan resolved this for SM/delivery daily work. I'll take it, but the entry-point routing map needs to be discoverable (settings panel or tooltip) or it becomes folklore.
- **Phase 2 inline-edit pencil-icon fallback (§9):** acceptable, but mid-rollout sprint review demos may show two interaction patterns. Flag in retro.
- **Gate review names (§8 footer):** governance vocabulary lock needs an owner+date before Phase 7 enters the build queue, else customers on a different gate model see noise.

Nothing in the plan makes a sprint review harder. The two-row sticky header (§3.4) and Overview blockers strip (§3.2#6) actively make my 30-min sponsor reviews faster.

### 4. Verdict

**Sign off with conditions.** Three concrete fixes:

1. Add a read-only **RACI summary chip on Overview** (§3.2 Overview) — closes F#8 fully.
2. Make the **entry-point → default-tab map visible** in Settings or a sticky-header tooltip (§3.1) — prevents PO/SM folklore drift.
3. Assign an **owner + date for gate-name lock** (§8 footer) before Phase 7 enters the build queue.

With those, ship it.

---

## J. UX sign-off

### 1. Status of the 27 asks
- Resolved: **22** (G#1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 17, 19, 20, 21, 23, 24, 25, 26, 27 — G#6 moot once #5 dropped the toggle)
- Partial: **3** — G#16, G#18, G#22
- Missing: **2** — G#4, G#12

Partial / missing detail:
- **G#4** (Dependencies = Delivery or RAID): deferred as "nice" in §7 with no revisit trigger.
- **G#12** (group fields by time-to-update; "More details" disclosure for visibility/category/lifecycle): not addressed. Scope & Value Identity lumps weekly-touched and set-once fields together.
- **G#16** (keyboard shortcuts): desktop spec solid; chip-TOC scroll vs `j/k` on touch, and whether shortcuts are desktop-only, undefined.
- **G#18** (two-row header <540px): §3.4 says row 2 "collapses" — target state (drawer / overflow / dropped) not defined.
- **G#22** (mobile shortcut interaction): the `<select>` is gone (chip row replaces it), but mobile keyboard implication is unreconciled.

### 2. Red-line audit
| Red line | Spec'd? | Where |
|---|---|---|
| Drop global Read/Edit toggle (G#5/23) | Yes | §3.3 |
| Empty-state spec (G#13) | Yes | §3.9 (registers CTA, EVM hidden when no baseline, `—` not `0`, phases) |
| Walkthrough conflict resolution (G#14) | Yes | §3.8 per-field matrix + cross-surface toast |
| Explicit Discard/Undo (G#17) | Yes | §3.10 (8s undo toast, revert-all overflow, dirty-edit guard on esc) |

All four respected.

### 3. Spec-rigour check
- **ARIA (G#21):** §3.11 — rigorous. Roles, aria-current, focus order, focus trap, restore-on-close.
- **Keyboard (G#16):** §3.10 rigorous on desktop; **hand-wavy on mobile** — no statement on desktop-only-ness, no chip-TOC scroll vs `j/k` interaction.
- **Focus on tab-switch-mid-edit (G#15):** §3.10 clear and consistent — auto-save + 8s undo. Good.
- **Two-row sticky header <540px (G#18):** §3.4 **hand-wavy**. "Collapses" is not a behaviour. Sprint context (committed/completed, assignees) is review-critical per F#7; without a defined target state it can vanish on the device that needs it most.
- **Inline edit affordance (G#5 alternative):** §4.1 names a CSS class but the resting affordance is unpinned. Plan §9 risk row admits "reads as broken" and proposes a pencil-icon fallback "gated on user testing" — known unknown, not a spec.

### 4. Coupling concerns
Inline edit + auto-save + 8s undo + cross-surface conflict toast + required reason prompts (re-prioritisation, scope-change) form a four-way interaction the plan handles in isolation but not jointly:
- If a Walkthrough write lands inside the 8s undo window for the same field, does the conflict toast stack, replace, or queue behind undo?
- Reason prompts block save: is the auto-created Decision committed before or after the undo window closes? If the user undoes the value change, does the auto-Decision retract atomically?
- Blur-to-save on a field that triggers a required reason prompt (MoSCoW, total points) collides with the modal prompt — spec silent on whether blur opens the prompt or saves first.

### 5. Verdict
**Sign off with conditions.** Five concrete one-line fixes:
1. §3.4: pin the row-2 <540px collapse target (named drawer, overflow menu, or explicit drop list) — replace "collapses".
2. §3.10: state shortcuts are desktop-only OR define mobile equivalents; spec chip-TOC scroll vs `j/k`.
3. §4.1/§3.10: lock the resting `.dp-inline-edit` affordance now (dotted underline, hover bg, pencil-on-hover — pick one); don't gate on later testing.
4. §3.2/§3.10: define interaction order for reason-prompt + undo-toast + conflict-toast + auto-save — at minimum "reason prompt blocks save; undoing the underlying value retracts the auto-Decision atomically".
5. §3.2 Scope & Value Identity: add a "More details" disclosure (G#12) hiding visibility/category/lifecycle below sponsor/manager/governance.
