# Shippable Demo Dataset — Design

**Date:** 2026-05-06
**Status:** Approved
**Owner:** Gareth
**Scope:** New `portfolio-data-demo.json` file with completely fictional, presentable data

---

## Goal

Ship the product with a clean dummy dataset. The current `portfolio-data.json` mixes real-looking names (Sarah Thompson, James Mitchell, etc.) with internal references that aren't appropriate to ship publicly. Replace it with a file written specifically for demos and onboarding.

## Non-goals

- Migrating the in-development `portfolio-data.json` (kept for the owner's local use; gitignored if needed).
- Replacing the existing data on first load. The default load behaviour (try localStorage first, then fall back to `portfolio-data.json` via the Restore button) is unchanged. Demo data is a separate file the owner ships and a "Load demo" button exposes.

## Constraints

- Schema must validate cleanly against current `App.validateAndLoad` and pass `migrateSchema` without warnings.
- All fields use only the post-overhaul shape (assumptions_register, benefits array, success_criteria, customer.sponsors, etc.).
- All names are obviously fictional ("Acme Industries", "Globex", "Initech"). No reference to real customers/colleagues.
- Reasonable spread: 12–18 projects across 3 customers, varied lifecycle stages, varied RAGs, mix of in-progress / blocked / on-hold / complete, a couple of POCs that show the lifecycle flow.
- 6 sprints (current + 2 past + 3 future) spanning ~7 months around 2026-05-06 so the date-aware Sprint Brief picker has somewhere to land.
- 6 team members spread across customers + skills.
- 3 governance forums (one per customer).
- 4–6 risks scattered across projects, 2–3 decisions, 2–3 assumptions.

## Architecture

Single new file: `portfolio-data-demo.json`. Same top-level shape as the existing `portfolio-data.json`:

```jsonc
{
  "meta": { "version": "1.1", "exported_at": "2026-05-06T...", "exported_by": "Demo", "app_name": "Portfolio Command Centre" },
  "customers": [
    { "name": "Acme Industries", "color": "#3b82f6", "staleThreshold": 14, "sponsors": ["Sam Carter", "Riley Chen"], "logo": "" },
    { "name": "Globex", "color": "#10b981", "staleThreshold": 21, "sponsors": ["Jordan Patel"], "logo": "" },
    { "name": "Initech", "color": "#a855f7", "staleThreshold": 14, "sponsors": ["Casey Reyes"], "logo": "" }
  ],
  "projects": [ /* 12–18 fictional projects */ ],
  "sprints": [ /* 6 sprints */ ],
  "team_members": [ /* 6 members */ ],
  "governance_forums": [ /* 3 forums */ ],
  "settings": { /* defaults; no custom RAG rules */ }
}
```

## Components

### 1. The JSON file

- 14 projects: 6 Acme, 5 Globex, 3 Initech.
- Stages: 1 Idea, 2 Discovery, 2 POC, 7 Implementation, 2 Run/BAU.
- Statuses: 8 In Progress, 2 At Risk, 1 Blocked, 1 On Hold, 2 Complete.
- WSJF inputs populated on 8 of 14 (so the WSJF/MoSCoW filter actually has signal).
- 4 projects have hard_deadlines, 8 have target_date only, 2 have neither (illustrative bad-data state).
- Each project has 0–3 risks_register entries; 0–2 decisions_register entries; 0–2 assumptions_register entries; 0–2 benefits.
- 2 projects have success_criteria (1–2 entries each).
- 3 projects have external dependencies with labels ("Vendor SOC 2 audit", "Legal review", "DPIA approval").

### 2. "Load demo" button (Settings → Data)

In the existing Data card (post settings IA redesign), add a button next to "Load JSON" / "Restore":

```
[Load demo dataset]
```

Clicking calls `App.loadDemoData()` which `fetch`es `portfolio-data-demo.json`, runs `App.validateAndLoad(json)`, and shows a toast.

### 3. Tests — sample fixture parses cleanly

```javascript
it('demo dataset loads via validateAndLoad without warnings', async () => {
  const fs = await import('fs/promises');
  const path = await import('path');
  const raw = await fs.readFile(path.resolve('./portfolio-data-demo.json'), 'utf8');
  const data = JSON.parse(raw);
  const app = await loadApp(makeDataset()); // empty
  const ok = app.App.validateAndLoad(data);
  expect(ok).toBe(true);
  expect(app.App.data.projects.length).toBeGreaterThan(10);
  app.teardown();
});
```

## Data flow

```
User clicks "Load demo dataset" in Settings → Data
  → App.loadDemoData() fetches portfolio-data-demo.json
  → App.validateAndLoad(data) — same path as Restore / Load JSON
  → migrateSchema runs (in case future migrations land between ships)
  → markDirty(false) so the user knows nothing's lost
  → toast: "Loaded demo dataset (14 projects)"
```

## Error handling

| Case | Behaviour |
|---|---|
| `fetch` fails (file missing) | Toast "Demo dataset not found" |
| Parse error | Toast "Demo dataset is corrupt" |
| Schema mismatch | `validateAndLoad`'s existing toast handles |

## Testing

- Unit: file loads, project count is right, no migration warnings.
- Render snapshot (optional): the dashboard's first few rows after loading the demo data — proves end-to-end works.
- E2E: click "Load demo dataset" button → assert dashboard updates.

## Out of scope

- Auto-load demo on first launch with no localStorage. (Could be a follow-up.)
- Multiple demo flavours.
- Localised demo data.
