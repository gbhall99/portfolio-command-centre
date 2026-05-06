# Project Details Overhaul — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** Restructure the Project DetailPanel — sponsor managed list, structured assumptions/benefits/success-criteria, dropdown styling consistency, dates moved into Delivery section, single read-only sprint window, communications removed.

**Architecture:** Schema migration in `migrateSchema` drops comms data and converts string fields to structured arrays. New `App.computeSprintWindow`, `App.addCustomerSponsor`, `App.setCustomerSponsors`, `App.setCustomerLogo` (the latter is shared with the customer-logos PR — defensive existence check). DetailPanel render gains/loses sections per the spec. Settings → Customers gets a Sponsors column.

**Spec:** `docs/superpowers/specs/2026-05-06-project-details-overhaul-design.md`

## Task 1: Schema migration

**Files:**
- Modify: `index.html` — `migrateSchema(data)` (search for `migrateSchema`)
- Create: `tests/unit/project-overhaul-migration.test.mjs`

- [ ] **Step 1: Failing tests**

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Project details overhaul — migration', () => {
  it('drops comms_log + comms_date + external_delivery_date', async () => {
    const p = makeProject({ id: 'X', comms_log: [{ note: 'a' }], comms_date: '2026-04-01', external_delivery_date: '2026-09-01' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const got = app.App.data.projects.find(x => x.id === 'X');
    expect(got.comms_log).toBeUndefined();
    expect(got.comms_date).toBeUndefined();
    expect(got.external_delivery_date).toBeUndefined();
    app.teardown();
  });

  it('migrates assumptions string to assumptions_register array', async () => {
    const p = makeProject({ id: 'A', assumptions: 'Stakeholders sign off by S5' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const got = app.App.data.projects.find(x => x.id === 'A');
    expect(Array.isArray(got.assumptions_register)).toBe(true);
    expect(got.assumptions_register.length).toBe(1);
    expect(got.assumptions_register[0].text).toBe('Stakeholders sign off by S5');
    expect(got.assumptions).toBeUndefined();
    app.teardown();
  });

  it('migrates benefits string to a single-entry array', async () => {
    const p = makeProject({ id: 'B', benefits: 'Saves time and money' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const got = app.App.data.projects.find(x => x.id === 'B');
    expect(Array.isArray(got.benefits)).toBe(true);
    expect(got.benefits.length).toBe(1);
    expect(got.benefits[0].description).toBe('Saves time and money');
    app.teardown();
  });

  it('initialises success_criteria to []', async () => {
    const p = makeProject({ id: 'S' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    expect(app.App.data.projects[0].success_criteria).toEqual([]);
    app.teardown();
  });

  it('seeds customer.sponsors from existing project sponsors', async () => {
    const dataset = makeDataset({
      projects: [
        makeProject({ id: 'P1', customer: 'GCC', sponsor: 'Sarah T.' }),
        makeProject({ id: 'P2', customer: 'GCC', sponsor: 'James M.' }),
        makeProject({ id: 'P3', customer: 'KS',  sponsor: 'Riley P.' })
      ]
    });
    // Strip seed sponsors so we test real seeding
    if (dataset.customers) dataset.customers.forEach(c => { delete c.sponsors; });
    const app = await loadApp(dataset);
    const gcc = app.App.data.customers.find(c => c.name === 'GCC');
    expect(gcc).toBeTruthy();
    expect(Array.isArray(gcc.sponsors)).toBe(true);
    expect(gcc.sponsors).toEqual(expect.arrayContaining(['Sarah T.', 'James M.']));
    app.teardown();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npx vitest run tests/unit/project-overhaul-migration.test.mjs
```

- [ ] **Step 3: Implement migration in `migrateSchema`**

Find `migrateSchema(data)`. Add the five migration blocks (drop comms, migrate assumptions, migrate benefits, init success_criteria, seed customer.sponsors) per the spec. Each block iterates `data.projects` once. Be defensive: only migrate when the legacy field is a string AND the new field is missing.

For sponsor seeding, walk projects, group by customer, then walk `data.customers` and union with each customer's existing `sponsors` array.

- [ ] **Step 4: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS — new migration tests + all existing pass.

- [ ] **Step 5: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/unit/project-overhaul-migration.test.mjs
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(project): schema migration — comms drop, structured assumptions/benefits/success_criteria, customer.sponsors"
```

---

## Task 2: Helpers — `computeSprintWindow`, `addCustomerSponsor`, `setCustomerSponsors`

**Files:**
- Modify: `index.html` — add helpers to `App`
- Modify: `tests/unit/project-overhaul-migration.test.mjs` — append a helpers describe block

- [ ] **Step 1: Failing tests**

Append:

```javascript
describe('App.computeSprintWindow', () => {
  it('returns null/null for projects with no skill_splits', async () => {
    const p = makeProject({ id: 'NS' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const w = app.App.computeSprintWindow(p);
    expect(w).toEqual({ start: null, end: null });
    app.teardown();
  });

  it('returns earliest + latest sprints from skill_splits', async () => {
    const p = makeProject({
      id: 'WS', skill_splits: {
        size_engineering: [{ sprint: 'CY26-S2', points: 3 }, { sprint: 'CY26-S5', points: 2 }],
        size_uat_adoption: [{ sprint: 'CY26-S3', points: 1 }]
      }
    });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const w = app.App.computeSprintWindow(p);
    expect(w.start.sprint_id).toBe('CY26-S2');
    expect(w.end.sprint_id).toBe('CY26-S5');
    app.teardown();
  });
});

describe('App.addCustomerSponsor / setCustomerSponsors', () => {
  it('addCustomerSponsor appends and dedups', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.addCustomerSponsor('GCC', 'Sarah T.');
    app.App.addCustomerSponsor('GCC', 'Sarah T.');
    const c = app.App.data.customers.find(x => x.name === 'GCC');
    const matches = (c.sponsors || []).filter(s => s === 'Sarah T.');
    expect(matches.length).toBe(1);
    app.teardown();
  });

  it('setCustomerSponsors replaces with a sorted, deduped, trimmed list', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.setCustomerSponsors('GCC', ['  Bob  ', 'Alice', 'Bob', '']);
    const c = app.App.data.customers.find(x => x.name === 'GCC');
    expect(c.sponsors).toEqual(['Alice', 'Bob']);
    app.teardown();
  });
});
```

- [ ] **Step 2: Implement helpers**

Append to `App` (near other settings helpers):

```javascript
  computeSprintWindow(project) {
    const sprintIds = new Set();
    Object.values((project && project.skill_splits) || {}).forEach(arr => {
      if (!Array.isArray(arr)) return;
      arr.forEach(sp => { if (sp && sp.sprint) sprintIds.add(sp.sprint); });
    });
    if (!sprintIds.size) return { start: null, end: null };
    const allSprints = (this.data && this.data.sprints) || [];
    const ordered = allSprints.filter(s => sprintIds.has(s.sprint_id))
      .slice()
      .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
    if (!ordered.length) return { start: null, end: null };
    return { start: ordered[0], end: ordered[ordered.length - 1] };
  },

  addCustomerSponsor(customerName, sponsorName) {
    if (!sponsorName || !sponsorName.trim()) return false;
    const c = (this.data && this.data.customers || []).find(x => x.name === customerName);
    if (!c) return false;
    if (!Array.isArray(c.sponsors)) c.sponsors = [];
    const trimmed = sponsorName.trim();
    if (c.sponsors.indexOf(trimmed) < 0) c.sponsors.push(trimmed);
    if (this.markDirty) this.markDirty();
    if (this.saveToLocalStorage) this.saveToLocalStorage();
    return true;
  },

  setCustomerSponsors(customerName, sponsors) {
    const c = (this.data && this.data.customers || []).find(x => x.name === customerName);
    if (!c) return false;
    const cleaned = (sponsors || []).map(s => String(s || '').trim()).filter(Boolean);
    const seen = new Set();
    const dedup = [];
    cleaned.forEach(s => { if (!seen.has(s)) { seen.add(s); dedup.push(s); } });
    dedup.sort();
    c.sponsors = dedup;
    if (this.markDirty) this.markDirty();
    if (this.saveToLocalStorage) this.saveToLocalStorage();
    return true;
  },
```

- [ ] **Step 3: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 4: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/unit/project-overhaul-migration.test.mjs
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(project): computeSprintWindow + customer sponsor helpers"
```

---

## Task 3: Customers card — Sponsors column

**Files:**
- Modify: `index.html` — `_renderCustomersCard`

- [ ] **Step 1: Add sponsors column**

In `_renderCustomersCard`, add a `<th>Sponsors</th>` between Stale and Actions. Per row, render the count + the names truncated to ~3 with a "✎" pencil button. Pencil click calls `App._openSponsorEditor(customerName)`.

`_openSponsorEditor` opens a small overlay modal (id `sponsorEditorOverlay`, z-index 9000) with a textarea of comma-separated names preloaded from `c.sponsors`. Save calls `App.setCustomerSponsors(name, value.split(','))`. Close + re-render. Match the existing logo-editor / audit-export modal styling.

- [ ] **Step 2: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(project): Sponsors column on Customers card"
```

---

## Task 4: DetailPanel — sponsor select with Add-new

**Files:**
- Modify: `index.html` — `DetailPanel` Setup-tab render around `<input data-field="sponsor">`

- [ ] **Step 1: Replace the sponsor input with a select**

Find the Setup-tab block that emits the Sponsor field (search for `data-field="sponsor"`). Replace the `<input type="text">` line with a render call:

```javascript
'<div class="field-group"><div class="field-label">Sponsor</div>' + DetailPanel.renderSponsorField(p) + '</div>'
```

Add `renderSponsorField(p)` to `DetailPanel`:

```javascript
  renderSponsorField(p) {
    const customer = (App.data && App.data.customers || []).find(c => c.name === p.customer);
    const pool = (customer && customer.sponsors) || [];
    const opts = ['<option value="">(none)</option>'];
    if (p.sponsor && pool.indexOf(p.sponsor) < 0) opts.push('<option value="' + Dashboard.esc(p.sponsor) + '" selected>' + Dashboard.esc(p.sponsor) + ' (legacy)</option>');
    pool.forEach(s => opts.push('<option value="' + Dashboard.esc(s) + '"' + (s === p.sponsor ? ' selected' : '') + '>' + Dashboard.esc(s) + '</option>'));
    opts.push('<option value="__add__">+ Add new sponsor…</option>');
    return '<select class="field-input" data-field="sponsor" onchange="DetailPanel.onSponsorChange(this, \'' + Dashboard.esc(p.id) + '\')">' + opts.join('') + '</select>';
  },

  onSponsorChange(sel, projectId) {
    if (sel.value === '__add__') {
      this.addSponsor(projectId, sel);
      return;
    }
    App.updateProject(projectId, 'sponsor', sel.value);
  },

  addSponsor(projectId, sel) {
    const p = (App.data && App.data.projects || []).find(x => x.id === projectId);
    if (!p) return;
    const name = (window.prompt && window.prompt('New sponsor name:')) || '';
    if (!name.trim()) {
      // Revert select to prior value
      sel.value = p.sponsor || '';
      return;
    }
    const ok = App.addCustomerSponsor(p.customer, name.trim());
    if (!ok) { App.toast('Could not add sponsor', 'error'); sel.value = p.sponsor || ''; return; }
    App.updateProject(projectId, 'sponsor', name.trim());
    DetailPanel.renderBody(p);
  },
```

- [ ] **Step 2: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(project): sponsor select pulls from customer pool with Add-new"
```

---

## Task 5: Assumptions register

**Files:**
- Modify: `index.html` — DetailPanel Health tab around the existing assumptions textarea

- [ ] **Step 1: Replace assumptions textarea with register**

Find the Notes section in the Health tab that contains:

```html
<div style="margin-top:8px"><div class="field-label">Assumptions</div>
textarea('assumptions', p.assumptions) + '</div>'
```

Remove that block from the Notes section. Add a new sibling section AFTER Notes:

```javascript
healthSections.push(
  '<div class="panel-section">' +
    '<div class="panel-section-title">Assumptions <span class="risk-count" id="assumptionCount">' + ((p.assumptions_register || []).length || 0) + '</span></div>' +
    '<div id="assumptionListInner">' + this.renderAssumptions(p) + '</div>' +
    '<button class="risk-add-btn" onclick="DetailPanel.addAssumption()">+ Log Assumption</button>' +
  '</div>'
);
```

Implement `renderAssumptions / addAssumption / removeAssumption / updateAssumption` mirroring the existing `renderDecisions / addDecisionLog / removeDecision / updateDecisionLog` pattern verbatim. Each row has date, made_by, text, notes columns.

- [ ] **Step 2: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS. Render snapshots in `tests/render/detailpanel.test.mjs` may change — inspect, regenerate via `--update`.

- [ ] **Step 3: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/render/__snapshots__/
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(project): assumptions register replaces textarea"
```

---

## Task 6: Benefits multi-row

**Files:**
- Modify: `index.html` — DetailPanel Setup tab around any existing `data-field="benefits"` input

- [ ] **Step 1: Replace benefits textarea with multi-row**

Add (in Setup tab, near the Sponsor field or wherever it makes sense in the Setup ordering):

```javascript
setupSections.push(
  '<div class="panel-section">' +
    '<div class="panel-section-title">Benefits <span class="risk-count" id="benefitCount">' + ((p.benefits || []).length || 0) + '</span></div>' +
    '<div id="benefitListInner">' + this.renderBenefits(p) + '</div>' +
    '<button class="risk-add-btn" onclick="DetailPanel.addBenefit()">+ Add Benefit</button>' +
  '</div>'
);
```

Implement `renderBenefits / addBenefit / removeBenefit / updateBenefit`. Each row:
- `<select>` type: `time_saving | cost_saving`
- `<input type="number">` amount (integer via `App.toInteger`)
- `<input type="text">` units
- `<input type="text">` description
- delete X button

Use the same row-grid styling as Decisions. Updates write to `p.benefits[idx][field]` via the standard render-then-mutate pattern, then `App.markDirty()` + `saveToLocalStorage()`.

- [ ] **Step 2: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/render/__snapshots__/
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(project): benefits multi-row with type/amount/units/description"
```

---

## Task 7: Success criteria multi-row

**Files:**
- Modify: `index.html` — DetailPanel Setup tab

- [ ] **Step 1: Add the section**

```javascript
setupSections.push(
  '<div class="panel-section">' +
    '<div class="panel-section-title">Success criteria <span class="risk-count" id="successCriteriaCount">' + ((p.success_criteria || []).length || 0) + '</span></div>' +
    '<div id="successCriteriaListInner">' + this.renderSuccessCriteria(p) + '</div>' +
    '<button class="risk-add-btn" onclick="DetailPanel.addSuccessCriterion()">+ Add success criterion</button>' +
  '</div>'
);
```

Implement `renderSuccessCriteria / addSuccessCriterion / removeSuccessCriterion / updateSuccessCriterion`. Each row:
- `<input type="text">` name
- `<input type="text">` target
- `<input type="text">` measure
- `<select>` tag from `['Adoption','Cost','Cycle time','Quality','Revenue']`
- delete X

- [ ] **Step 2: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/render/__snapshots__/
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(project): success criteria with KPI tag"
```

---

## Task 8: Move dates into Delivery; restrict editors to hard_deadline + target_date

**Files:**
- Modify: `index.html` — DetailPanel render

- [ ] **Step 1: Strip the Dates section from its current tab**

Find the Dates section in DetailPanel (search for `<div class="panel-section-title">Dates</div>` or similar). Remove its current location. Replace any `<input type="date">` editors for `start_date`, `actual_date`, `baseline_start`, `baseline_end`, `product_release_date`, `comms_date`, `external_delivery_date` with read-only badges (small grey labels showing the formatted date or "Not set").

- [ ] **Step 2: Add a Dates section to the Delivery tab**

In the Delivery tab section list, push:

```javascript
deliverySections.push(
  '<div class="panel-section">' +
    '<div class="panel-section-title">Dates</div>' +
    '<div class="field-grid">' +
      '<div class="field-group"><div class="field-label">Hard deadline (external)</div>' +
        '<input type="date" class="field-input" data-field="hard_deadline" value="' + (p.hard_deadline || '') + '" onchange="DetailPanel.onFieldChange(this)"></div>' +
      '<div class="field-group"><div class="field-label">Target date</div>' +
        '<input type="date" class="field-input" data-field="target_date" value="' + (p.target_date || '') + '" onchange="DetailPanel.onFieldChange(this)"></div>' +
    '</div>' +
    '<div style="margin-top:10px;font-size:11px;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:14px">' +
      (p.start_date ? '<span><strong>Started:</strong> ' + new Date(p.start_date).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}) + '</span>' : '') +
      ((p.status === 'Complete' || p.status === 'Closed') && p.actual_date ? '<span><strong>Completed:</strong> ' + new Date(p.actual_date).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}) + '</span>' : '') +
      (p.baseline_start && p.baseline_end ? '<span><strong>Baseline:</strong> ' + p.baseline_start + ' → ' + p.baseline_end + '</span>' : '') +
    '</div>' +
  '</div>'
);
```

(Adjust `deliverySections` to whatever the existing variable name is — search for "Delivery" tab render code.)

- [ ] **Step 3: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 4: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/render/__snapshots__/
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(project): dates move to Delivery; only hard_deadline + target_date editable"
```

---

## Task 9: Single read-only sprint window in Delivery tab

**Files:**
- Modify: `index.html` — DetailPanel Delivery tab render
- Modify: `tests/unit/project-overhaul-migration.test.mjs` (already covered by Task 2 helper test)

- [ ] **Step 1: Add the sprint-window section**

```javascript
const win = (typeof App.computeSprintWindow === 'function') ? App.computeSprintWindow(p) : { start: null, end: null };
const fmtSprint = (s) => s ? (s.sprint_id + ' · ' + (s.start_date ? new Date(s.start_date).toLocaleDateString('en-GB', {day:'numeric',month:'short'}) : '—')) : '—';
const fmtSprintEnd = (s) => s ? (s.sprint_id + ' · ' + (s.end_date ? new Date(s.end_date).toLocaleDateString('en-GB', {day:'numeric',month:'short'}) : '—')) : '—';

deliverySections.push(
  '<div class="panel-section">' +
    '<div class="panel-section-title">Sprint window</div>' +
    '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Auto-populated by Sprint Planning when work is allocated.</div>' +
    '<div class="field-grid">' +
      '<div class="field-group"><div class="field-label">Start sprint</div>' +
        '<div class="field-input" style="background:var(--bg-content);cursor:default">' + fmtSprint(win.start) + '</div></div>' +
      '<div class="field-group"><div class="field-label">End sprint</div>' +
        '<div class="field-input" style="background:var(--bg-content);cursor:default">' + fmtSprintEnd(win.end) + '</div></div>' +
    '</div>' +
  '</div>'
);
```

Also remove any existing editors for `current_sprint` / `target_sprint` from the Setup or Delivery tab — those become read-only via this section.

- [ ] **Step 2: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/render/__snapshots__/
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(project): single read-only sprint window in Delivery tab"
```

---

## Task 10: Remove Communications section + comms data

**Files:**
- Modify: `index.html` — DetailPanel Health tab

- [ ] **Step 1: Delete the Communications panel-section**

Find the block in `healthSections.push` whose `panel-section-title` is `Communications` (search for `Communications`). Remove the entire block, plus the `commsAddForm` it contains, plus any helpers that bind to `comms_log` (e.g. `removeComm`, `addCommunication`).

The migration in Task 1 already drops `p.comms_log` and `p.comms_date` so the data side is clean.

- [ ] **Step 2: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/render/__snapshots__/
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(project): remove Communications section + handlers"
```

---

## Task 11: Dropdown styling sweep

**Files:**
- Modify: `index.html` — DetailPanel render

- [ ] **Step 1: Sweep all `<select>` inside DetailPanel**

Search for `<select` within the DetailPanel module's render functions. For each, ensure `class="field-input"` is present on the element. Existing classes that conflict (e.g. inline `style="width:..."`) should keep working — `.field-input` only sets baseline padding, border-radius, font.

- [ ] **Step 2: Run tests**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:unit
```
Expected: PASS. Snapshots may change due to class additions — regenerate.

- [ ] **Step 3: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add index.html tests/render/__snapshots__/
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "feat(project): apply field-input class to every DetailPanel select"
```

---

## Task 12: E2E coverage

**Files:**
- Create: `tests/e2e/project-overhaul.spec.ts`

- [ ] **Step 1: Write the spec**

```typescript
import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Communications section is gone from detail panel', async ({ page }) => {
  await openAppWithData(page);
  const id = await page.evaluate(() => (window as any).App.data.projects[0].id);
  await page.evaluate((pid) => (window as any).DetailPanel.open(pid), id);
  await expect(page.locator('#detailPanel.open')).toBeVisible();
  const text = await page.locator('#detailPanel').innerText();
  expect(text.toLowerCase()).not.toContain('communications');
});

test('Sponsor select offers Add-new option', async ({ page }) => {
  await openAppWithData(page);
  const id = await page.evaluate(() => (window as any).App.data.projects[0].id);
  await page.evaluate((pid) => (window as any).DetailPanel.open(pid), pid => pid, id);
  // (Use a plain evaluate instead of the awkward chained form)
  await page.evaluate((pid) => (window as any).DetailPanel.open(pid), id);
  const options = page.locator('#detailPanel select[data-field="sponsor"] option');
  await expect(options.last()).toContainText(/add new sponsor/i);
});

test('Sprint window is read-only', async ({ page }) => {
  await openAppWithData(page);
  const id = await page.evaluate(() => (window as any).App.data.projects[0].id);
  await page.evaluate((pid) => (window as any).DetailPanel.open(pid), id);
  await expect(page.locator('#detailPanel >> text=Sprint window')).toBeVisible();
  // No <input data-field="current_sprint"> or "target_sprint" present
  await expect(page.locator('#detailPanel input[data-field="current_sprint"], #detailPanel input[data-field="target_sprint"]')).toHaveCount(0);
});

test('Only hard_deadline and target_date have date inputs in Delivery', async ({ page }) => {
  await openAppWithData(page);
  const id = await page.evaluate(() => (window as any).App.data.projects[0].id);
  await page.evaluate((pid) => (window as any).DetailPanel.open(pid), id);
  // Switch to Delivery tab if tabbed
  await page.evaluate(() => {
    const tab = document.querySelector('#detailPanel .panel-tab[data-tab="delivery"]') as HTMLElement;
    if (tab) tab.click();
  });
  const dateInputs = page.locator('#detailPanel input[type="date"]');
  const count = await dateInputs.count();
  // Should see exactly 2 date inputs (hard_deadline, target_date) + maybe 1 if status=Complete (actual_date — but spec says Health tab)
  expect(count).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Run E2E**

```
cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm run test:e2e
```
Expected: PASS (gantt-interactions flake allowed).

- [ ] **Step 3: Commit**

```
git -C /Users/zaza/Documents/Projects/portfolio-command-centre add tests/e2e/project-overhaul.spec.ts
git -C /Users/zaza/Documents/Projects/portfolio-command-centre commit -m "test(project): E2E for sponsor list, no comms, sprint window read-only, dates pruned"
```

---

## Task 13: Final verification

- [ ] `cd /Users/zaza/Documents/Projects/portfolio-command-centre && npm test` → PASS (or only gantt-interactions flake).
