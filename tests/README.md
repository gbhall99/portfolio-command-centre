# Velocity — Tests

Automated suite for the single-file `index.html` app. Three layers, all run from npm.

## Quick start

```bash
npm install                       # first-time: installs vitest, jsdom, @playwright/test
npx playwright install chromium-headless-shell   # first-time only
npm test                          # unit + render + e2e
```

| command                         | what it does                                                  |
|---------------------------------|---------------------------------------------------------------|
| `npm run test:unit`             | vitest — unit + render snapshot tests (fast, headless jsdom)  |
| `npm run test:unit:watch`       | vitest watch mode                                             |
| `npm run test:e2e`              | Playwright headless-chrome suite                              |
| `npm run test:update-snapshots` | regenerates `tests/render/__snapshots__/` files               |
| `npm test`                      | unit then e2e; CI equivalent                                  |

## Layout

```
tests/
├── harness/
│   ├── loadApp.mjs          — jsdom bootstrap; loads index.html + exposes handles
│   ├── fixtures.mjs         — makeProject/makeSprint/makeMember/makeDataset
│   └── snapshots/           — unused; render snapshots live next to their test
├── unit/
│   ├── _smoke.test.mjs      — sanity: harness loads, handles bound, settings hydrated
│   ├── solver.test.mjs      — SOLVER.md R1–R11 invariants + determinism
│   ├── scoring.test.mjs     — priority score, recommended_priority, explainer
│   ├── migration.test.mjs   — migrateSchema, _ensureSettingsDefaults
│   ├── integrity.test.mjs   — validateDataIntegrity
│   └── capacity.test.mjs    — calcMemberCapacityForSprint, calcSkillCapacityForSprint
├── render/
│   ├── dashboard.test.mjs   — buildRowHtml snapshots (+ recommendation chip)
│   ├── gantt.test.mjs       — renderLegend snapshot (no go-live, violet deadline)
│   ├── detailpanel.test.mjs — renderRisks (field-input dropdowns)
│   ├── config.test.mjs      — Scheduling Engine + Scoring card assertions
│   └── __snapshots__/       — committed golden files; review like code
└── e2e/
    ├── helpers.ts           — openAppWithData + bridge-script injection
    ├── navigation.spec.ts   — cycle through six views
    ├── edit-project.spec.ts — DetailPanel edit → Dashboard refresh
    ├── add-project.spec.ts  — addProject → row/badge updates
    ├── priority-flow.spec.ts — chip appears + Apply clears
    └── gantt-interactions.spec.ts — hover handlers + phase tooltip
```

## How the jsdom harness works

The production app is zero-dep and uses top-level `const App = …` declarations. `const`s at script
scope live in the shared Script Record, so a later `<script>` tag in the same realm can capture
them. The harness:

1. Reads `index.html` from disk.
2. Injects a one-line bridge script before the final `</body>`:
   `window.__pcc__ = { App, Solver, Sprint, Dashboard, Gantt, Capacity, Governance, DetailPanel, AuditPanel };`
3. Boots jsdom with `runScripts: 'dangerously'`, `pretendToBeVisual: true`.
4. Stubs canvas, window.open, window.print, fetch, alert/confirm/prompt in `beforeParse`.
5. Waits for the `load` event, clears the auto-save interval, calls `App.validateAndLoad(fixture)`.
6. Returns a handle object; `teardown()` closes the jsdom window.

The production `index.html` is not modified.

## Fixture patterns

Prefer `makeProject()` / `makeSprintSequence(n)` / `makeMember()` / `makeDataset()` over loading
`portfolio-data.json` wholesale. Isolates the rule under test — less flaky when the fixture
data changes.

```javascript
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';
resetIdSeq();
const sprints = makeSprintSequence(3);
const proj = makeProject({ size_engineering: 20, delivery_config: { phase_order: ['Data Engineering'] } });
const member = makeMember({ available_points_per_sprint: 10 });
const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [member] }));
// ... assertions
app.teardown();
```

## Assertion style

- **Structural invariants** for solver/scoring — "no slice exceeds cap", "ancestors precede descendants".
  Per SOLVER.md §10, resilient to legitimate data/algorithm changes.
- **File snapshots** for render output. Drift is caught immediately; regenerate with
  `npm run test:update-snapshots` and review the diff in the PR.

## Playwright notes

- E2E runs against a local `python3 -m http.server 8765` started by Playwright's `webServer`.
- `openAppWithData()` seeds `localStorage` then clicks the Restore banner button (the app's real
  hydration path) rather than driving via `page.evaluate` — because top-level `const` globals
  don't attach to `window` until the bridge script runs.
- After restore, a bridge `<script>` is injected to expose `window.App`, `window.Solver`, etc.
  for tests that need to poke internals (see `priority-flow.spec.ts`).

## CI

`.github/workflows/test.yml` runs the `unit` and `e2e` jobs in parallel on push/PR. On E2E
failure, `tests/.playwright-artifacts/` is uploaded as a run artefact (traces + screenshots,
7-day retention).

## Adding a test

1. **Pure logic?** Drop in `tests/unit/` with `loadApp()` + invariant assertions.
2. **HTML output you want pinned?** `tests/render/` with `toMatchFileSnapshot('./__snapshots__/name.html')`.
3. **Real user flow?** `tests/e2e/` spec using `openAppWithData()`.

Keep the scope narrow. One fixture per test where possible. Teardown with `app.teardown()`.
