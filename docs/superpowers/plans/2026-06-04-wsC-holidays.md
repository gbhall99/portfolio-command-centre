# Workstream C — Holidays: date pickers + country/city Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text holiday `App.prompt` chain with an add/edit/remove modal form (native date picker + cascading Country→City selects with "All" options), and drop the legacy per-customer scope from holidays and the capacity matcher.

**Architecture:** The holiday data model already has `country`/`sub_location` and the capacity matcher already treats empty `country`/`sub_location` as "All". So this is mostly UI (a JS-built modal mirroring `.team-edit-modal`) plus removing the legacy customer-scope filter in `Sprint.calcMemberCapacityForSprint` and deleting the `customers` field on migration.

**Tech Stack:** Vanilla HTML/CSS/JS single file `index.html`; vitest + jsdom; Playwright.

**Conventions:** `:root` tokens, inline SVG (no emojis), `Dashboard.esc()` for user content. Run tests: `npm test`; single file `npx vitest run tests/unit/<f>.mjs`.

---

## File Structure

- **Modify:** `index.html`
  - `App.migrateSchema` annual_holidays backfill (~line 5027) — `delete ah.customers`.
  - `Sprint.calcMemberCapacityForSprint` holiday filter (~line 27772-27775) — remove the customer-scope branch.
  - `App` object — add `_holidayEditIndex` + `openHolidayForm` / `_holidayFormCountryChanged` / `saveHolidayForm` / `closeHolidayForm`; the old `addAnnualHoliday` (~line 10301) is removed/replaced.
  - `App._renderAnnualHolidaysCard` (~line 8502-8524) — columns Name/Date/Country/City/Recurring/✕, "All" labels, row-click edit, "+ Add holiday".
- **Create test:** `tests/unit/holiday-form.test.mjs` (form + migration + customer-scope removal).
- **Possibly modify:** `tests/unit/slot-f-country-holidays.test.mjs` only if a migration assertion needs the `customers`-dropped expectation (it asserts `.country` only — should stay green; do NOT edit unless it actually fails).

---

## Task C1: Drop customer scope (migration + matcher)

**Files:** Modify `index.html` (migration ~5027, matcher ~27772); Create `tests/unit/holiday-form.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/holiday-form.test.mjs`:

```javascript
// WS-C: holidays apply by country/city only; customer scope removed from data + matcher.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMember, makeSprintSequence } from '../harness/fixtures.mjs';

function firstWeekdayInSprint(sprints) {
  const d = new Date(sprints[0].start_date);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('WS-C migration drops customers from holidays', () => {
  it('removes the customers field on load, keeps country', async () => {
    const app = await loadApp(makeDataset({
      annual_holidays: [{ name: 'X', date: '2026-12-25', recurring: true, country: 'UK', customers: ['Acme Industries'] }]
    }));
    const h = app.App.data.annual_holidays[0];
    expect('customers' in h).toBe(false);
    expect(h.country).toBe('UK');
    app.teardown();
  });
});

describe('WS-C matcher ignores any residual customer scope', () => {
  it('a holiday reduces capacity regardless of customerScope (no customer filtering)', async () => {
    const sprints = makeSprintSequence(1);
    const ymd = firstWeekdayInSprint(sprints);
    const app = await loadApp(makeDataset({
      team_members: [makeMember({ name: 'UK-A', country: 'UK', available_points_per_sprint: 20 })],
      sprints,
      // stale customers value scoped to Globex; member serves Acme. Pre-WS-C this would be excluded.
      annual_holidays: [{ name: 'UK Bank', date: ymd, recurring: false, country: 'UK', customers: ['Globex'] }]
    }));
    const cap = app.Sprint.calcMemberCapacityForSprint(app.App.data.team_members[0], sprints[0].sprint_id, 'Acme Industries');
    expect(cap.points).toBeLessThan(20);
    app.teardown();
  });

  it('an All-countries holiday (country:"") reduces capacity for any country', async () => {
    const sprints = makeSprintSequence(1);
    const ymd = firstWeekdayInSprint(sprints);
    const app = await loadApp(makeDataset({
      team_members: [makeMember({ name: 'US-A', country: 'US', available_points_per_sprint: 20 })],
      sprints,
      annual_holidays: [{ name: 'Global Day', date: ymd, recurring: false, country: '' }]
    }));
    const cap = app.Sprint.calcMemberCapacityForSprint(app.App.data.team_members[0], sprints[0].sprint_id, 'Acme Industries');
    expect(cap.points).toBeLessThan(20);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify it FAILS**

Run: `npx vitest run tests/unit/holiday-form.test.mjs`
Expected: FAIL — migration still keeps `customers`; and the "regardless of customerScope" test fails because the current matcher excludes the Globex-scoped holiday for an Acme scope.

- [ ] **Step 3: Drop `customers` on migration**

In `index.html` (~line 5027), change:

```javascript
    (data.annual_holidays || []).forEach(ah => {
      if (ah && !('country' in ah)) ah.country = 'UK';
    });
```

to also delete the legacy field:

```javascript
    (data.annual_holidays || []).forEach(ah => {
      if (ah && !('country' in ah)) ah.country = 'UK';
      if (ah && 'customers' in ah) delete ah.customers;
    });
```

- [ ] **Step 4: Remove the customer-scope branch from the matcher**

In `Sprint.calcMemberCapacityForSprint` (~line 27771-27783), delete the legacy customer-scope block so the filter only matches on country/sub_location. Change:

```javascript
    annualHols = annualHols.filter(ah => {
      // Legacy customer-scope filter.
      if (ah.customers && Array.isArray(ah.customers) && ah.customers.length > 0) {
        if (customerScope && ah.customers.indexOf(customerScope) < 0) return false;
      }
      // Country filter (Item 14).
      if (ah.country) {
        if (ah.country !== memberCountry) return false;
        // Sub-location: if the holiday is sub-location-scoped, member must match.
        if (ah.sub_location && ah.sub_location !== memberSubLocation) return false;
      }
      return true;
    });
```

to:

```javascript
    annualHols = annualHols.filter(ah => {
      // Holidays apply by country/city only. Empty country = all countries;
      // empty sub_location = whole country.
      if (ah.country) {
        if (ah.country !== memberCountry) return false;
        if (ah.sub_location && ah.sub_location !== memberSubLocation) return false;
      }
      return true;
    });
```

(Do NOT touch the `customerScope` parameter or its other uses earlier in the function — it drives per-customer capacity.)

- [ ] **Step 5: Run the new tests + the existing country-holidays suite**

Run: `npx vitest run tests/unit/holiday-form.test.mjs tests/unit/slot-f-country-holidays.test.mjs`
Expected: PASS. (slot-f uses `customers: []` everywhere and only asserts `.country`, so it stays green.)

- [ ] **Step 6: Commit**

```bash
git add index.html tests/unit/holiday-form.test.mjs
git commit -m "feat(holidays): drop legacy customer scope from holidays + matcher"
```

---

## Task C2: Add/Edit/Remove modal form

**Files:** Modify `index.html` (add `App` methods near `removeAnnualHoliday` ~line 10333; remove old `addAnnualHoliday` ~10301); extend `tests/unit/holiday-form.test.mjs`

- [ ] **Step 1: Confirm the modal overlay class exists**

Run: `grep -n "team-edit-overlay" index.html | head`
You should find a `.team-edit-overlay` rule and existing usages (e.g. the dependency modal). If it exists, reuse it. If NOT, add this CSS once near `.team-edit-modal` (~line 2321): `.team-edit-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 9000; }`. Report which path you took.

- [ ] **Step 2: Add the failing form tests**

Append to `tests/unit/holiday-form.test.mjs`:

```javascript
describe('WS-C holiday add/edit modal form', () => {
  function bootForm() {
    return loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1' }],
      annual_holidays: [{ name: 'Existing', date: '2026-01-01', recurring: true, country: 'India', sub_location: 'Bangalore' }]
    }));
  }

  it('openHolidayForm() builds a blank add form defaulting to All/All', async () => {
    const app = await bootForm();
    app.App.openHolidayForm();
    expect(app.document.getElementById('holidayFormName')).toBeTruthy();
    expect(app.document.getElementById('holidayFormDate').type).toBe('date');
    expect(app.document.getElementById('holidayFormCountry').value).toBe('');
    expect(app.document.getElementById('holidayFormCity').value).toBe('');
    app.App.closeHolidayForm();
    app.teardown();
  });

  it('saveHolidayForm() appends a holiday with All=empty for country/city', async () => {
    const app = await bootForm();
    app.App.openHolidayForm();
    app.document.getElementById('holidayFormName').value = 'New Year';
    app.document.getElementById('holidayFormDate').value = '2027-01-01';
    app.document.getElementById('holidayFormRecurring').checked = true;
    app.App.saveHolidayForm();
    const hols = app.App.data.annual_holidays;
    const added = hols[hols.length - 1];
    expect(added).toMatchObject({ name: 'New Year', date: '2027-01-01', recurring: true, country: '', sub_location: '' });
    expect('customers' in added).toBe(false);
    app.teardown();
  });

  it('openHolidayForm(index) pre-fills and save updates that index', async () => {
    const app = await bootForm();
    app.App.openHolidayForm(0);
    expect(app.document.getElementById('holidayFormName').value).toBe('Existing');
    expect(app.document.getElementById('holidayFormCountry').value).toBe('India');
    expect(app.document.getElementById('holidayFormCity').value).toBe('Bangalore');
    app.document.getElementById('holidayFormName').value = 'Renamed';
    app.App.saveHolidayForm();
    expect(app.App.data.annual_holidays[0].name).toBe('Renamed');
    expect(app.App.data.annual_holidays.length).toBe(1); // updated, not appended
    app.teardown();
  });

  it('_holidayFormCountryChanged() rebuilds city options for the chosen country', async () => {
    const app = await bootForm();
    app.App.openHolidayForm();
    const countrySel = app.document.getElementById('holidayFormCountry');
    countrySel.value = 'India';
    app.App._holidayFormCountryChanged();
    const cityOpts = Array.from(app.document.getElementById('holidayFormCity').options).map(o => o.value);
    expect(cityOpts).toEqual(['', 'Hyderabad', 'Bangalore']);
    app.App.closeHolidayForm();
    app.teardown();
  });

  it('saveHolidayForm() rejects an empty name (no append)', async () => {
    const app = await bootForm();
    const before = app.App.data.annual_holidays.length;
    app.App.openHolidayForm();
    app.document.getElementById('holidayFormName').value = '';
    app.document.getElementById('holidayFormDate').value = '2027-05-01';
    app.App.saveHolidayForm();
    expect(app.App.data.annual_holidays.length).toBe(before);
    app.App.closeHolidayForm();
    app.teardown();
  });
});
```

- [ ] **Step 3: Run, verify it FAILS**

Run: `npx vitest run tests/unit/holiday-form.test.mjs`
Expected: FAIL — `openHolidayForm`/`saveHolidayForm`/`_holidayFormCountryChanged`/`closeHolidayForm` are not functions.

- [ ] **Step 4: Add the form methods to `App`**

In the `App` object, add `_holidayEditIndex: null,` as a property near the other state fields, and add these methods next to `removeAnnualHoliday` (~line 10333). Replace the entire old `async addAnnualHoliday() { … }` method (~line 10301-10331) with the new methods below (so the prompt-chain is gone):

```javascript
  _holidayEditIndex: null,

  openHolidayForm(index) {
    if (!this.data) return;
    if (!this.data.annual_holidays) this.data.annual_holidays = [];
    this._holidayEditIndex = (typeof index === 'number') ? index : null;
    const h = this._holidayEditIndex != null ? (this.data.annual_holidays[this._holidayEditIndex] || {}) : {};
    const esc = Dashboard.esc;
    const curCountry = h.country || '';
    const countryOpts = '<option value="">All countries</option>' +
      (this.LOCATIONS || []).map(l => '<option value="' + esc(l.country) + '"' + (l.country === curCountry ? ' selected' : '') + '>' + esc(l.country) + '</option>').join('');
    const subs = curCountry ? this._subLocationsForCountry(curCountry) : [];
    const curCity = h.sub_location || '';
    const cityOpts = '<option value="">All cities</option>' +
      subs.map(s => '<option value="' + esc(s) + '"' + (s === curCity ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
    const fieldStyle = 'width:100%;padding:6px 8px;border:1px solid var(--border-dim);border-radius:var(--radius-sm);background:var(--surface);color:var(--text-dark);font-size:13px;box-sizing:border-box';
    const labelStyle = 'display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:var(--text-dark)';
    const overlay = document.createElement('div');
    overlay.className = 'team-edit-overlay';
    overlay.id = 'holidayFormOverlay';
    overlay.onclick = function () { App.closeHolidayForm(); };
    const modal = document.createElement('div');
    modal.className = 'team-edit-modal';
    modal.onclick = function (e) { e.stopPropagation(); };
    modal.innerHTML =
      '<h3 style="font-size:15px;font-weight:700;color:var(--text-dark)">' + (this._holidayEditIndex != null ? 'Edit holiday' : 'Add holiday') + '</h3>' +
      '<div class="team-edit-body" style="display:flex;flex-direction:column;gap:12px">' +
        '<label style="' + labelStyle + '">Name<input type="text" id="holidayFormName" value="' + esc(h.name || '') + '" style="' + fieldStyle + '"></label>' +
        '<label style="' + labelStyle + '">Date<input type="date" id="holidayFormDate" value="' + esc(h.date || '') + '" style="' + fieldStyle + '"></label>' +
        '<label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--text-dark)"><input type="checkbox" id="holidayFormRecurring"' + (h.recurring ? ' checked' : '') + '> Repeats every year</label>' +
        '<label style="' + labelStyle + '">Country<select id="holidayFormCountry" onchange="App._holidayFormCountryChanged()" style="' + fieldStyle + '">' + countryOpts + '</select></label>' +
        '<label style="' + labelStyle + '">City<select id="holidayFormCity" style="' + fieldStyle + '"' + (subs.length ? '' : ' disabled') + '>' + cityOpts + '</select></label>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">' +
        '<button class="btn btn-outline btn-sm" onclick="App.closeHolidayForm()">Cancel</button>' +
        '<button class="btn btn-primary btn-sm" onclick="App.saveHolidayForm()">Save</button>' +
      '</div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    const nameEl = document.getElementById('holidayFormName');
    if (nameEl && nameEl.focus) { try { nameEl.focus(); } catch (e) {} }
  },

  _holidayFormCountryChanged() {
    const countrySel = document.getElementById('holidayFormCountry');
    const citySel = document.getElementById('holidayFormCity');
    if (!countrySel || !citySel) return;
    const country = countrySel.value;
    const subs = country ? this._subLocationsForCountry(country) : [];
    citySel.innerHTML = '<option value="">All cities</option>' +
      subs.map(s => '<option value="' + Dashboard.esc(s) + '">' + Dashboard.esc(s) + '</option>').join('');
    citySel.value = '';
    citySel.disabled = subs.length === 0;
  },

  saveHolidayForm() {
    const nameEl = document.getElementById('holidayFormName');
    const dateEl = document.getElementById('holidayFormDate');
    if (!nameEl || !dateEl) return;
    const name = (nameEl.value || '').trim();
    const date = (dateEl.value || '').trim();
    if (!name) { this.toast('Holiday needs a name', 'error'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { this.toast('Pick a valid date', 'error'); return; }
    const recurring = !!document.getElementById('holidayFormRecurring').checked;
    const country = document.getElementById('holidayFormCountry').value || '';
    const city = document.getElementById('holidayFormCity').value || '';
    const rec = { name, date, recurring, country, sub_location: city };
    if (!this.data.annual_holidays) this.data.annual_holidays = [];
    this.pushUndo(this._holidayEditIndex != null ? 'Edit annual holiday' : 'Add annual holiday');
    if (this._holidayEditIndex != null) this.data.annual_holidays[this._holidayEditIndex] = rec;
    else this.data.annual_holidays.push(rec);
    this.markDirty();
    this.saveToLocalStorage();
    this.closeHolidayForm();
    this.renderConfig();
    this.toast('Holiday saved', 'success');
  },

  closeHolidayForm() {
    const o = document.getElementById('holidayFormOverlay');
    if (o) o.remove();
    this._holidayEditIndex = null;
  },
```

NOTE: confirm `App` already has `LOCATIONS`, `_subLocationsForCountry`, `toast`, `pushUndo`, `markDirty`, `saveToLocalStorage`, `renderConfig` (it does). If a stray reference to the removed `addAnnualHoliday` remains anywhere besides the settings card button (Task C3 fixes that), `grep -n "addAnnualHoliday" index.html` and report.

- [ ] **Step 5: Run the form tests, verify PASS**

Run: `npx vitest run tests/unit/holiday-form.test.mjs`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add index.html tests/unit/holiday-form.test.mjs
git commit -m "feat(holidays): add/edit/remove modal form with date picker + country/city selects"
```

---

## Task C3: Settings card — Country/City columns + row-click edit

**Files:** Modify `index.html` (`_renderAnnualHolidaysCard` ~8502-8524); extend `tests/unit/holiday-form.test.mjs`

- [ ] **Step 1: Add the failing render test**

Append to `tests/unit/holiday-form.test.mjs`:

```javascript
describe('WS-C holidays settings card', () => {
  it('renders Country/City columns with All for empty, no Scope column, and an edit affordance', async () => {
    const app = await loadApp(makeDataset({
      annual_holidays: [
        { name: 'Global', date: '2026-01-01', recurring: true, country: '', sub_location: '' },
        { name: 'India Fest', date: '2026-08-15', recurring: false, country: 'India', sub_location: 'Bangalore' }
      ]
    }));
    const html = app.App._renderAnnualHolidaysCard();
    expect(html).toMatch(/Country/);
    expect(html).toMatch(/City/);
    expect(html).not.toMatch(/Scope/);
    // "All" appears for the global holiday's country + city
    expect(html).toMatch(/All/);
    expect(html).toMatch(/India/);
    expect(html).toMatch(/Bangalore/);
    // rows wire up edit via openHolidayForm
    expect(html).toMatch(/openHolidayForm\(0\)/);
    // add button opens the form
    expect(html).toMatch(/openHolidayForm\(\)/);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify it FAILS**

Run: `npx vitest run tests/unit/holiday-form.test.mjs`
Expected: FAIL — current card has a "Scope" column, no Country/City, and the button calls `addAnnualHoliday()`.

- [ ] **Step 3: Rewrite `_renderAnnualHolidaysCard`**

Replace the entire `_renderAnnualHolidaysCard()` method (~line 8502-8524) with:

```javascript
  _renderAnnualHolidaysCard() {
    const esc = Dashboard.esc;
    const allTag = '<span style="color:var(--text-muted);font-style:italic">All</span>';
    const hols = (App.data && App.data.annual_holidays) || [];
    let rows;
    if (hols.length) {
      const th = (t, extra) => '<th style="text-align:' + (extra || 'left') + ';padding:4px 6px;font-size:var(--fs-2xs);text-transform:uppercase;color:var(--text-muted)">' + t + '</th>';
      rows = '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px">' +
        '<thead><tr style="border-bottom:2px solid var(--border-light)">' +
          th('Name') + th('Date') + th('Country') + th('City') + th('Recurring', 'center') + '<th style="padding:4px 6px"></th>' +
        '</tr></thead><tbody>' +
        hols.map(function (h, i) {
          const rec = h.recurring
            ? '<svg width="12" height="12" viewBox="0 0 10 10" aria-label="recurring"><circle cx="5" cy="5" r="4" fill="#22c55e"/><polyline points="3,5 4.5,7 7,3.5" fill="none" stroke="white" stroke-width="1.5"/></svg>'
            : '-';
          return '<tr style="border-bottom:1px solid #f1f5f9;cursor:pointer" role="button" tabindex="0" aria-label="Edit ' + esc(h.name || '') + '"' +
            ' onclick="App.openHolidayForm(' + i + ')" onkeydown="if(event.key===\'Enter\'){event.preventDefault();App.openHolidayForm(' + i + ')}">' +
            '<td style="padding:4px 6px">' + esc(h.name || '') + '</td>' +
            '<td style="padding:4px 6px">' + esc(h.date || '') + '</td>' +
            '<td style="padding:4px 6px">' + (h.country ? esc(h.country) : allTag) + '</td>' +
            '<td style="padding:4px 6px">' + (h.sub_location ? esc(h.sub_location) : allTag) + '</td>' +
            '<td style="padding:4px 6px;text-align:center">' + rec + '</td>' +
            '<td style="padding:4px 6px;text-align:center"><button style="border:none;background:none;color:var(--status-red);cursor:pointer;font-size:12px" onclick="event.stopPropagation();App.removeAnnualHoliday(' + i + ')" title="Remove" aria-label="Remove ' + esc(h.name || '') + '">&times;</button></td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>';
    } else {
      rows = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">No annual holidays configured</div>';
    }
    return '<div id="annualHolidaysCard" style="background:white;border:1px solid var(--border-light);border-radius:var(--radius-md);padding:16px;margin-bottom:16px">' +
      '<h3 style="font-size:14px;font-weight:700;color:var(--text-dark);margin-bottom:12px">Annual Holidays</h3>' +
      '<div style="font-size:12px;color:var(--text-dark-secondary);margin-bottom:8px">Holidays reduce capacity for team members in the matching country and city. Choose All / All to apply company-wide. Click a row to edit.</div>' +
      rows +
      '<button class="btn btn-outline btn-sm" onclick="App.openHolidayForm()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add holiday</button>' +
    '</div>';
  },
```

(Note: this method must live where the original was — confirm the surrounding object so the method is a valid member. The original used an IIFE; this version inlines the same logic.)

- [ ] **Step 4: Run the test, verify PASS**

Run: `npx vitest run tests/unit/holiday-form.test.mjs`
Expected: PASS.

- [ ] **Step 5: Confirm no stale `addAnnualHoliday` references**

Run: `grep -n "addAnnualHoliday" index.html`
Expected: no matches (the method is removed and the button now calls `openHolidayForm()`). If any remain, fix them to `openHolidayForm()`.

- [ ] **Step 6: Regression + commit**

Run: `npx vitest run`
Expected: all green.

```bash
git add index.html tests/unit/holiday-form.test.mjs
git commit -m "feat(holidays): settings card shows country/city, row-click edit, Add holiday button"
```

---

## Task C4: Full verification + visual pass

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all unit/render + e2e green, 0 failures.

- [ ] **Step 2: Serve + visual verification**

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Drive `http://127.0.0.1:8765/index.html`, load demo data, go to **System Settings → Team** (Annual Holidays card). Verify at 1440px, light + dark:
- The card shows **Name · Date · Country · City · Recurring · ✕**; existing holidays show "All" where country/city are empty; no "Scope" column.
- **+ Add holiday** opens the modal: a native date picker; Country select with "All countries" + the 6 locations; selecting **India** repopulates City with All cities / Hyderabad / Bangalore; Save adds the row.
- Add an All/All holiday and an India/Bangalore holiday.
- Click a row → the form opens **pre-filled**; change the name → Save updates that row.
- ✕ removes a row (and doesn't trigger the row-edit).
- On the **Capacity** view, confirm an All-countries holiday reduces capacity for members in any country, and an India/Bangalore holiday only affects Bangalore members. No console errors.

- [ ] **Step 3: Final commit if a tweak was needed**

```bash
git add -A && git commit -m "chore: WS-C verification pass"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** C1 data model + migration → Task C1 (migration) + the form writing `{name,date,recurring,country,sub_location}` (Task C2); C2 matcher → Task C1; C3 modal form (add/edit/remove, date picker, cascading country→city, All) → Task C2; C4 settings card → Task C3. All spec sections covered.
- **Naming consistency:** `App._holidayEditIndex`, `App.openHolidayForm`, `App._holidayFormCountryChanged`, `App.saveHolidayForm`, `App.closeHolidayForm`; element ids `holidayFormName/Date/Recurring/Country/City`, overlay `holidayFormOverlay`; used identically across the form code, the card row-click, and the tests.
- **No placeholders:** every step has literal code. The only conditional ("confirm `.team-edit-overlay` exists") has an explicit fallback CSS rule.
- **Back-compat:** existing `slot-f-country-holidays.test.mjs` uses `customers: []` and only asserts `.country`, so dropping the customer branch + deleting the field keeps it green (Task C1 Step 5 verifies).
