# Customer Logos Relocation — Design

**Date:** 2026-05-06
**Status:** Approved
**Owner:** Gareth
**Scope:** Settings → Customers + Display & Branding

---

## Goal

Customer logos currently live in the per-customer Branding card alongside primaryColor / companyName / footerText. They're a customer property, so they belong on the **Customers** page (per-customer table), not under "Branding". Move them. Reconsider section titles after the move so the Display & Branding card is no longer "the place where logos hide".

## Non-goals

- Changing the file format / upload flow for logos.
- Adding multi-logo support (light / dark variants).
- Per-project logos.
- Removing primaryColor / companyName / footerText from Branding (those stay).

## Constraints

- Single-file `index.html`. innerHTML string concat; user content escaped via `Dashboard.esc`.
- No emojis.
- Existing `App.setBranding(customer, opts)` write API stays — it keeps logo via `c.logo`. The settings tile renamed for clarity.
- Logo data is per-customer object on `data.customers[i].logo` (already there via setBranding).

---

## Architecture

```
Before:
  Settings → Display & Branding
    ├── Display thresholds
    └── Branding card (per customer: logo, primaryColor, companyName, footerText)

After:
  Settings → Customers
    ├── Name | Color | Stale | Logo  | Sponsors | Actions
    │                          ⚙ Set        (added)
  Settings → Display & Branding
    ├── Display thresholds
    └── Branding card  (per customer: primaryColor, companyName, footerText  — logo removed from here)
```

## Components

### 1. Customers table — new "Logo" column

In `_renderCustomersCard`, add a column between `Stale (days)` and `Sponsors` (added by the project-details overhaul spec):

```
| Name | Color | Stale (days) | Logo                      | Sponsors | Actions |
| Acme Industries  | ⬛    | 14           | [thumbnail or "Set logo"] | …        | …       |
```

When a logo is set, render a 24x24 `<img src=…>` thumbnail. When not, a small "Set logo…" button. Clicking the thumbnail or button opens an inline editor (textarea for data-URL or URL string, "Save" / "Remove" buttons).

`App.setCustomerLogo(customerName, logoUrl)` — thin wrapper that calls `App.setBranding(customerName, { logo })`. Keeps the table-level handler from importing the full Branding write surface.

### 2. Branding card — remove logo control

In `_renderBrandingCard`, remove the logo input (the `<input type="text">` plus its label and the "Upload" affordance). Keep primaryColor + companyName + footerText.

The card's section title changes from "Branding" to **"White-labelling"** so users searching for "logo" don't find an empty card. (Title rename only — same content otherwise.)

### 3. Display & branding category renamed

The Settings tile says "Display & branding" today. After the logo move, rename to **"Display & white-labelling"** so the user model matches the actual content.

(Display thresholds stay where they are; just the parent label changes.)

## Data flow

```
1. User clicks "Set logo…" on the Acme Industries row in Customers
2. Inline editor opens (textarea + Save/Remove)
3. User pastes a URL or data-URL → Save
4. App.setCustomerLogo('Acme Industries', value) → App.setBranding('Acme Industries', { logo: value })
5. data.customers.find(Acme Industries).logo = value (existing write path)
6. markDirty, saveToLocalStorage, renderConfig (re-render the active category)
7. Thumbnail appears in the row
```

## Error handling

| Case | Behaviour |
|---|---|
| Empty save | Treats as "remove" — clears logo |
| Save with invalid URL | No client-side validation (matches existing setBranding behaviour); browser handles broken `<img>` |
| Logo > 5 MB data-URL | localStorage write may fail — existing `try/catch` already toasts |
| Customer renamed mid-session | Existing rename cascade preserves logo (it's on the customer object) |

## Testing

### Unit

- `App.setCustomerLogo('Acme Industries', 'https://example/logo.png')` writes to `data.customers.find(Acme Industries).logo`.
- Empty value clears the logo.
- Branding card render no longer includes a `data-field="logo"` input.
- Customers card render includes a `Logo` column.

### Render snapshot

- Customers card snapshot with one customer having a logo, one without.
- Branding card snapshot with logo controls removed.

### E2E

- Click "Set logo…" on the Acme Industries row → enter a URL → Save → assert `<img>` appears with that src.
- Open Display & white-labelling category → assert no logo input present.
- Sidebar tile label says "Display & white-labelling".

## Out of scope

- File-upload UI (we keep the data-URL paste affordance the existing branding flow uses).
- Logo variants (light/dark, navbar vs print).
- Auto-cropping / resizing.
