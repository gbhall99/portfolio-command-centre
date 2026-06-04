# Workstream C — Holidays: date pickers + country/city — design

**Date:** 2026-06-04
**Branch:** `wsC-holidays`
**Context:** Third of five phased workstreams (A→E). Addresses issue #3: "Holidays should have date pickers and not free text, [and] be associated to a country and city (with all and all) as options."

**Key finding:** the data model already carries `country` + `sub_location` (city) and the capacity matcher already treats an empty `country` as "applies to everyone" and empty `sub_location` as "whole country" — i.e. "All" semantics already exist. The real gap is the **input UX**: `App.addAnnualHoliday` is a chain of free-text `App.prompt` dialogs (free-text `YYYY-MM-DD` date; free-text country defaulting to "UK" with no "All" option). Holidays also carry a legacy per-customer `scope` which is being removed.

**Scope:** Single-file `index.html`. No framework/build. `:root` tokens, inline SVG, no emojis, `Dashboard.esc()`. Gated by `npm test` + in-browser verify (light + dark).

## Decisions (from brainstorming)

- **Drop the per-customer scope** on holidays — they apply by country + city only.
- **Add + Edit + Remove** — clicking a holiday row opens a pre-filled form.
- New holidays default to **All countries / All cities**.

## C1 — Data model

Holiday object: `{ name, date, recurring, country, sub_location }` (the `customers` array is removed).
- `country`: `''` → **All countries** (global); otherwise a `LOCATIONS` country (`UK, US, India, Netherlands, Canada, Malaysia`).
- `sub_location`: `''` → **All cities** (whole country); otherwise a sub-location of `country` (only India has sub-locations today: `Hyderabad, Bangalore`).
- `date`: ISO `YYYY-MM-DD`. `recurring`: boolean (repeats every year using month/day).

**Migration** (in `App.migrateSchema`, at the existing `annual_holidays` backfill ~line 5021-5028): for each holiday, `delete ah.customers;`. Preserve existing `country`/`sub_location` (legacy holidays keep their `country: 'UK'` default; only *new* holidays default to All/All). No other field changes.

## C2 — Capacity matcher

In `Sprint.calcMemberCapacityForSprint` (the holiday filter ~line 27771-27783), **remove only the legacy customer-scope branch**:

```javascript
      // Legacy customer-scope filter.
      if (ah.customers && Array.isArray(ah.customers) && ah.customers.length > 0) {
        if (customerScope && ah.customers.indexOf(customerScope) < 0) return false;
      }
```

Keep the country/sub_location branch unchanged (empty `country` = applies to all members; empty `sub_location` = whole country):

```javascript
      if (ah.country) {
        if (ah.country !== memberCountry) return false;
        if (ah.sub_location && ah.sub_location !== memberSubLocation) return false;
      }
      return true;
```

Keep the `customerScope` parameter and every other use of it (it drives per-customer capacity at the top of the function — lines ~10/43-45 — unrelated to holidays).

## C3 — Add / Edit / Remove modal form

Replace the `App.addAnnualHoliday()` prompt-chain with a modal form, mirroring the existing `.team-edit-modal` + overlay pattern (centered white card, fields, footer Save/Cancel; `Esc`/overlay-click closes; dark-mode handled by existing modal overrides).

Form state lives on `App` (e.g. `App._holidayEditIndex` = `null` for add, or the integer index for edit). Methods:
- `App.openHolidayForm(index)` — `index` omitted/`null` = add (blank); otherwise pre-fill from `data.annual_holidays[index]`. Builds + shows the modal.
- `App._holidayFormCountryChanged()` — repopulate the City select from the chosen country's sub-locations (+ "All cities"); when country = All or has no sub-locations, the City select shows only "All cities".
- `App.saveHolidayForm()` — read fields; validate `name` non-empty and `date` matches `^\d{4}-\d{2}-\d{2}$` (the native date input yields this; guard anyway). Build `{ name, date, recurring, country, sub_location }` (country `''` = All, sub_location `''` = All). If `_holidayEditIndex` is null → push; else replace at that index. `pushUndo`, `markDirty`, `saveToLocalStorage`, close modal, `renderConfig()`.
- `App.closeHolidayForm()` — hide/remove the modal.

Fields:
- **Name** — `<input type="text">`.
- **Date** — `<input type="date">` (native picker).
- **Repeats every year** — `<input type="checkbox">`.
- **Country** — `<select id="holidayFormCountry" onchange="App._holidayFormCountryChanged()">`: first option `All countries` (value `''`), then each `LOCATIONS` country.
- **City** — `<select id="holidayFormCity">`: first option `All cities` (value `''`), then the selected country's sub-locations. Rebuilt on country change.

The modal markup is created in JS (the app builds modals dynamically). Escape user content with `Dashboard.esc()` where applicable (names). Use `:root` tokens for styling, consistent with `.team-edit-modal`.

## C4 — Settings card

`App._renderAnnualHolidaysCard()`:
- Helper text reworded to describe country/city (drop the customer-scope wording): e.g. "Holidays reduce capacity for team members in the matching country/city. Choose All / All to apply company-wide."
- Table columns: **Name · Date · Country · City · Recurring · (✕)**. Remove the old "Scope" column.
- Country/City cells show the value, or a muted italic **All** when empty.
- Each holiday row is clickable (cursor pointer, `role="button"`, keyboard-activatable) and calls `App.openHolidayForm(i)` to edit; the ✕ still calls `App.removeAnnualHoliday(i)` (stop propagation so the row-click edit doesn't also fire).
- The "Add" affordance is a "+ Add holiday" button calling `App.openHolidayForm()`.

## Testing

- **Matcher (unit):** build team members in different countries/cities and sprints; assert a holiday with `country:''` reduces capacity for any member; `country:'India'` only India members; `country:'India', sub_location:'Bangalore'` only Bangalore members; and a holiday object with a stale `customers:['X']` no longer filters by customer (capacity reduced regardless of `customerScope`).
- **Migration (unit):** load data whose holiday has `customers:['Acme']` → after `validateAndLoad`, `customers` is absent and the holiday still has its `country`.
- **Form (render/unit):** `openHolidayForm()` builds the modal with All/All defaults; `saveHolidayForm()` with set fields appends `{name, date, recurring, country, sub_location}` (`''` for All); `openHolidayForm(i)` pre-fills; `_holidayFormCountryChanged()` rebuilds the city options for the chosen country; editing updates the right index.
- **Card (render):** holidays render Country/City columns with "All" for empty; no "Scope" column; a row exposes an edit affordance.
- **Visual:** in-browser add a holiday via the date picker + country/city selects (incl. India→Bangalore and All/All); edit a row; confirm capacity changes on the Capacity view; light + dark.

## Out of scope

- No new countries/cities (the `LOCATIONS` list is unchanged).
- No change to per-sprint capacity overrides or member country/city editing.
- RAID (D), Reports/PDF + packs (E) — their own workstreams.
