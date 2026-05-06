# Settings IA Redesign — Design

**Date:** 2026-05-05
**Status:** Approved
**Owner:** Gareth
**Scope:** System Settings view (`#viewConfig`, `App.renderConfig`)

---

## Goal

Replace the current single-scroll Settings page with a **tile-dashboard** entry, where every category is a drill-down with its own focused detail panel. The current page mixes 12+ sections — high-frequency ones (stale threshold, RAG rules, customers) next to deep solver knobs (R7 buffer-slide cap) — in one infinite scroll, with a "Jump to" pill list that covers only 5 of those sections. Result: hard to find anything, hard to scan what's possible.

After this rework:

- `#viewConfig` lands on a **tile dashboard**: 8 cards, one per category, each showing a category name, icon, and a one-line summary stat (e.g. "3 customers" / "14-day default stale threshold").
- Clicking a tile reveals its detail panel; the dashboard hides. A breadcrumb / back arrow returns to the dashboard.
- Each detail panel is focused: only that category's settings render, in a clear grid.
- All settings still live on `App.data.settings` and continue to flow through their existing save handlers — this is a **layout + navigation change, not a data model change**. (Project conventions per CLAUDE.md keep applying: string-concat HTML, escape via Dashboard.esc, no emojis.)

## Non-goals

- Adding new settings.
- Removing existing settings.
- URL hash routing (out of scope; reload returns to dashboard).
- Search across all settings (optional follow-up; not in MVP).
- Tabs-with-keyboard-navigation (Notion/Linear style — option A in brainstorming).
- Inline editing on the dashboard tiles (deliberately rejected to keep the dashboard scannable).

## Constraints

- Single-file `index.html`, no build step.
- Existing save handlers (`App.saveCustomerConfig`, `App.saveSchedulerSettings`, etc.) preserved verbatim.
- Existing modal patterns (Bulk Import, Annual Holidays editor inside the page) keep working.
- Cross-link buttons elsewhere in the app (e.g. `App.navigate('config'); scrollIntoView('annualHolidaysCard')`) must keep working — see Migration below.

---

## Architecture

```
#viewConfig
  ├── ConfigDashboard   (default — tile grid)
  └── ConfigCategory    (rendered when a tile is opened)

App.renderConfig()  — entry point; routes to dashboard or category
App._renderConfigDashboard()
App._renderConfigCategory(id)
App.openConfigCategory(id)
App.closeConfigCategory()                ← returns to dashboard

Categories share a registry:
  App.CONFIG_CATEGORIES = [
    { id, label, icon, summary(p), render() },
    …
  ]
```

The same registry-driven pattern as `Dashboard.COLUMNS` — one entry per category, single source of truth for tile + detail panel.

## Components

### 1. `App.CONFIG_CATEGORIES` registry

```js
App.CONFIG_CATEGORIES = [
  { id: 'customers',     label: 'Customers',           icon: '<svg…>',
    summary: () => App.getCustomers().length + ' customers',
    render: () => /* current Customers card markup */ },

  { id: 'team',          label: 'Team & calendar',     icon: '<svg…>',
    summary: () => (App.data.team_members||[]).length + ' members · '
                 + (App.data.settings?.annual_holidays||[]).length + ' holidays',
    render: () => /* current Annual Holidays + team intro */ },

  { id: 'sprints',       label: 'Sprints',             icon: '<svg…>',
    summary: () => (App.data.sprints||[]).length + ' configured',
    render: () => /* sprint list link + default cycle length */ },

  { id: 'scheduler',     label: 'Scheduling engine',   icon: '<svg…>',
    summary: () => 'R1–R12 · solver knobs',
    render: () => /* current Scheduling Engine card */ },

  { id: 'scoring',       label: 'Scoring & priority',  icon: '<svg…>',
    summary: () => /* "WSJF · MoSCoW · " + ragRulesCount + " RAG rules" */,
    render: () => /* Scoring card + RAG rules */ },

  { id: 'templates',     label: 'Workflow templates',  icon: '<svg…>',
    summary: () => /* "N templates" */,
    render: () => /* delivery_config templates editor */ },

  { id: 'display',       label: 'Display & branding',  icon: '<svg…>',
    summary: () => /* "Theme: Light · Stale: 14d" */,
    render: () => /* Display Thresholds + Branding cards merged */ },

  { id: 'data',          label: 'Data',                icon: '<svg…>',
    summary: () => /* "Last export: 3 days ago" or "Never exported" */,
    render: () => /* current Data card — export/import/restore */ }
];
```

Each `render()` returns the inner HTML for the category's detail panel — pulled directly from the existing `renderConfig` IIFE chunks. No new markup needed; we're refactoring placement, not authoring fresh content.

### 2. `App.renderConfig()` — entry point

Replaces the current implementation. Routes:

```js
App.renderConfig() {
  if (this._ensureSettingsDefaults) this._ensureSettingsDefaults();
  const body = document.getElementById('configBody');
  if (!body) return;
  if (this._configActiveCategory) {
    this._renderConfigCategory(this._configActiveCategory);
  } else {
    this._renderConfigDashboard();
  }
}
```

### 3. `App._renderConfigDashboard()` — tile grid

```
┌─ System Settings ──────────────────────────── [stats] ───┐
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  [icon]     │  │  [icon]     │  │  [icon]     │      │
│  │  Customers  │  │  Team &     │  │  Sprints    │      │
│  │  3 active   │  │  calendar   │  │  6 sprints  │      │
│  └─────────────┘  │  7 mems · 5h│  └─────────────┘      │
│                   └─────────────┘                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  Scheduler  │  │  Scoring    │  │  Templates  │      │
│  │  R1–R12     │  │  WSJF · 5R  │  │  3 default  │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│  ┌─────────────┐  ┌─────────────┐                        │
│  │  Display    │  │  Data       │                        │
│  │  Light · 14d│  │  Last: …    │                        │
│  └─────────────┘  └─────────────┘                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Each tile is a `<button>` with:
- Top-left: 24×24 inline SVG icon
- Title: category label, 14px bold
- Below: summary stat, 11px muted

Click → `App.openConfigCategory(id)`.

The 4-tile data-summary strip from today (projects/team/sprints/customers) stays at the top of the dashboard above the tile grid — small, discoverable, no longer fighting for space with the Scheduling Engine.

CSS: 3-column grid at desktop, collapses to 2 then 1. Min-width 220 per tile; consistent height.

### 4. `App._renderConfigCategory(id)` — detail panel

```
┌─ ← Settings  /  Customers ───────────────────────────────┐
│                                                          │
│  Configure customers, their colours, and stale-update    │
│  thresholds. Renaming cascades to all projects, team     │
│  members, and forums.                                    │
│                                                          │
│  ┌──── Customer config table ────────────────────────┐   │
│  │ Name         Color    Stale (days)   Actions       │   │
│  │ Acme Industries          ⬛       14              Rename Delete │   │
│  │ Globex           ⬛       21              Rename Delete │   │
│  │ Initech         ⬛       14              Rename Delete │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  + Add customer                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- Header: a back-button "← Settings" (left), then "Settings / {category}" breadcrumb. Clicking the back arrow OR "Settings" segment returns to dashboard.
- Body: the existing card markup for this category, lifted from today's `renderConfig`.
- Save buttons / interactions inside the body keep working — they call the same `App.save*` handlers.
- Pressing **Esc** with no editor focused returns to the dashboard.

### 5. `App.openConfigCategory(id)` / `App.closeConfigCategory()`

```js
openConfigCategory(id) {
  if (!App.CONFIG_CATEGORIES.find(c => c.id === id)) return;
  this._configActiveCategory = id;
  this.renderConfig();
  document.getElementById('configBody').scrollTop = 0;
}

closeConfigCategory() {
  this._configActiveCategory = null;
  this.renderConfig();
}
```

`_configActiveCategory` is in-memory only — not persisted. Reload returns to dashboard.

### 6. Cross-links elsewhere in the app

A handful of buttons already deep-link into specific Settings sections:

- `index.html:2701` — "Annual holidays…" button on the Sprint Planning toolbar runs:
  ```js
  App.navigate('config');
  setTimeout(() => document.getElementById('annualHolidaysCard').scrollIntoView(...), 80)
  ```
- `Sprint.openSchedulingSettings()` — toolbar button targets the Scheduling Engine card.
- (Possibly more — sweep with `grep` during implementation.)

Update each to:

```js
App.navigate('config');
App.openConfigCategory('team');   // or 'scheduler', etc.
```

## Data flow

### Open a category

```
1. User clicks the Customers tile
2. App.openConfigCategory('customers')
3. _configActiveCategory = 'customers'
4. renderConfig() routes to _renderConfigCategory('customers')
5. configBody innerHTML <- breadcrumb + Customers card render
```

### Close back to dashboard

```
1. User clicks "← Settings" (or presses Esc, or clicks "Settings" in breadcrumb)
2. App.closeConfigCategory()
3. _configActiveCategory = null
4. renderConfig() routes to _renderConfigDashboard()
5. configBody innerHTML <- stats strip + tile grid
```

### Edit a setting from a category

No change vs today: existing input → `App.save…` handler → `notifyDataChange` flow is untouched. After a save, `renderConfig` re-runs, and because `_configActiveCategory` is still set, the user stays in the same category.

## Error handling

| Case | Behaviour |
|---|---|
| `openConfigCategory` with unknown id | no-op, stays on dashboard |
| `_renderConfigCategory` throws | wrap in try/catch (matches existing pattern); show fallback "Settings failed to render" + button to return to dashboard |
| Save inside category fails | existing toast pattern; user stays in category |
| User closes browser mid-edit | localStorage autosave already covers; no special handling |

## Testing

### Unit (vitest)

- `App.CONFIG_CATEGORIES` registry shape: every entry has `id, label, icon, render`; `summary` is a function returning a string.
- `App.openConfigCategory('customers')` sets `_configActiveCategory`; `closeConfigCategory()` clears it.
- `App.openConfigCategory('does-not-exist')` is a no-op.

### Render snapshot

- Snapshot the tile dashboard HTML for a fixed fixture.
- Snapshot one category detail panel (Customers).

### E2E (Playwright)

- Navigate to Settings — assert tile grid visible, no Scheduling Engine card directly visible.
- Click Customers tile — assert breadcrumb shown, Customers table visible, tile grid hidden.
- Click "← Settings" — assert tile grid back, Customers table gone.
- Click Annual Holidays toolbar button on Sprint Planning — assert lands directly on Team & calendar category, scrolled to holidays section.
- Press Esc inside a category — assert returns to dashboard.

### Manual smoke

- Save a setting from each category — confirm the user stays in that category after save.
- Each tile's summary stat reflects the live data.

## Migration

Search for `App.navigate('config')` callers across `index.html`:

```
grep -n "App.navigate(.config" index.html
```

Each caller that scrolls to a specific card needs to be updated to also call `App.openConfigCategory(...)`. Map old card ids → new category ids:

| Old card id | New category id |
|---|---|
| `schedulingEngineCard` | `scheduler` |
| `scoringCard` | `scoring` |
| `displayThresholdsCard` | `display` |
| `brandingCard` | `display` |
| `dataCard` | `data` |
| `annualHolidaysCard` | `team` |
| customers table | `customers` |
| `backlogHealthCard` | `scoring` (RAG rules) |

After this migration, the old "Jump to" pills are deleted (replaced by the tile grid itself).

## Out of scope

- Search across settings.
- Recently-changed log on the dashboard.
- Per-user pinned settings.
- URL hash routing.
- Tabbed sidebar (option A in brainstorming).
- New settings, deletion of existing settings, schema changes.

