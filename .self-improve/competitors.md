# Competitive Profile

Velocity occupies an unusual niche: a **zero-infrastructure, single-file, client-side** delivery &
portfolio tool purpose-built for a **data-analytics services team** — combining PPM (portfolio
planning, capacity, solver) with **commercial document generation** (SOWs, quotes, status reports,
wireframes) and a **provider-agnostic agentic layer**. No single mainstream product covers that
combination, so competitors are profiled by the dimension they overlap on. Profiles reflect
well-known market positioning; treat specifics as directional, not freshly scraped.

Legend for the matrix: ✓ strong · ~ partial/limited · ✗ absent · n/a not applicable.

---

## Profiles

### Jira / Jira Align (Atlassian) — enterprise agile + PPM
- **Positioning:** De-facto enterprise agile tracker (Jira) scaling to portfolio/SAFe (Jira Align).
- **Strengths:** Deep board/backlog/workflow, huge ecosystem, reporting, enterprise governance.
- **UX strengths:** Familiar to every engineer; powerful JQL.
- **Gaps vs Velocity:** Heavy setup/admin; no built-in client SOW/quote generation; capacity/solver is plugin-land; not client-side/zero-infra; agentic features bolted-on, not native.

### Monday.com — flexible work OS
- **Strengths:** Highly visual, fast to configure, broad templates, automations.
- **UX strengths:** Approachable, colourful, low learning curve.
- **Gaps:** No true capacity solver; no analytics-delivery domain model (skills/sprints/SOWs); commercial docs are manual; data lives in their cloud.

### Asana — task & project coordination
- **Strengths:** Clean task/portfolio coordination, goals, timeline, workload.
- **UX strengths:** Polished, opinionated simplicity.
- **Gaps:** Workload is coarse vs a points/skills solver; no SOW/quote/billing; no governed AI document generation; not domain-specific.

### Smartsheet — spreadsheet-grid PPM
- **Strengths:** Grid+Gantt familiarity, resource management add-on, strong in services/PMO.
- **Gaps:** Spreadsheet ergonomics; capacity/forecasting is add-on; no governed AI authoring; cloud-hosted.

### Wrike — services-oriented work management
- **Strengths:** Resourcing, time tracking, proofing, request forms; strong for agencies.
- **Gaps:** Configuration overhead; no analytics-delivery model; commercial docs/quotes external; AI features limited and generic.

### Productboard — product management / roadmapping
- **Strengths:** Prioritisation (incl. scoring), roadmap, customer insight linkage.
- **Gaps:** Product- not services-shaped; no capacity solver, no SOW/billing; complementary rather than overlapping.

### Float / Runn — resource & capacity planning
- **Strengths:** Purpose-built resource scheduling, utilisation, forecasting, some financials.
- **Gaps:** Scheduling-only; no board/RAID/governance/SOW/agentic document layer; cloud-hosted.

---

## Capability matrix (us vs. them)

| Capability | Velocity | Jira/Align | Monday | Asana | Smartsheet | Wrike | Productboard | Float/Runn |
|---|---|---|---|---|---|---|---|---|
| Zero-infra / client-side / data-stays-local | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Analytics-delivery domain model (skills/phases/sprints) | ✓ | ~ | ✗ | ✗ | ~ | ~ | ✗ | ~ |
| Capacity solver w/ rules + critical path | ✓ | ~ | ✗ | ~ | ~ | ~ | ✗ | ✓ |
| Kanban board (blocked/aging/WIP/swimlanes) | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | ~ | ✗ |
| RAID + governance | ✓ | ~ | ~ | ~ | ~ | ~ | ✗ | ✗ |
| Governed SOW / quote generation | ✓ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | ✗ |
| Wireframe spec + conformance + vision compare | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Status reports grounded in live data | ✓ | ~ | ~ | ~ | ~ | ~ | ✗ | ✗ |
| Provider-agnostic agentic assistant + tools | ✓ | ~ | ~ | ~ | ✗ | ~ | ~ | ✗ |
| Scenario/what-if w/ £ economics | ✓ | ~ | ✗ | ✗ | ~ | ~ | ✗ | ~ |
| Forecast (Monte-Carlo + EVM) | ✓ | ~ | ✗ | ✗ | ✗ | ~ | ✗ | ~ |
| Enterprise scale / multi-team ecosystem | ~ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ |
| Native mobile apps | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ |
| Real-time multi-user collaboration | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Integrations marketplace | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ~ |

---

## Where we are behind (defend/close)
1. **Single-user, single-device.** No real-time collaboration or cloud sync — the flip side of "zero-infra/local". Biggest strategic gap vs every competitor.
2. **No native mobile / no integrations marketplace.** Practitioners and execs increasingly expect mobile + connected tools.
3. **Onboarding discoverability.** A dense single-file app with many powerful views can overwhelm new users vs Monday/Asana's guided simplicity.

## Where we can leapfrog (attack)
1. **Governed, grounded document generation (SOW/quote/status/wireframe) is genuinely differentiated.** No mainstream PPM tool turns the plan into client-ready, figure-traceable commercial docs. Double down (principle 6: AI-native).
2. **Agentic, confirm-gated portfolio actions** (NL-to-action, tidy_portfolio, scenario promote) beat everyone's bolted-on AI. Make the assistant the fastest way to operate the app.
3. **Privacy/zero-infra as a feature** for consultancies handling sensitive client data — "nothing leaves the browser" is a real selling point. Lean into it where it doesn't block collaboration.
4. **Explainability** (explain_plan, binding constraints, critical path, honest "insufficient history") is rare in PPM — a trust advantage for execs (Elena).
