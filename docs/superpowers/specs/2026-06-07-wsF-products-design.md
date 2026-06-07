# Workstream F — Objectives rename + Customer Profile section + Products page — design

**Date:** 2026-06-07
**Branch:** `wsF-products`
**Context:** User request — rename the "Strategy" page to **Objectives** and the menu section "Strategy" to **Customer Profile**; add a **Products** page tracking active products (versions, product type, owner, tech stack, description; application or dashboard), linkable to/from projects (a product shows its linked projects; a project can link products).

**Key findings (from exploration):**
- The `strategy` nav item opens `Strategy.mount()`, a view whose default tab is already Objectives (`activeTab() => 'objectives'`); Personas and Metrics have their own nav items. So "Strategy → Objectives" is a **relabel**, not a restructure (keep `data-view="strategy"` for back-compat, mirroring the earlier `myactions`→"Actions" rename).
- Projects already multi-link strategy entities via `project.metric_ids` / `project.persona_ids` arrays, with multi-select pickers on the detail panel and reverse "linked/delivering projects" lists on the entity detail (Metrics/Personas/Objectives). Products mirror this exact pattern.
- Entity objects (`Objectives`, `Metrics`, `Personas`) follow a `list()` (customer-scoped) / `byId()` / detail-modal pattern; the Products object mirrors it.

**Scope:** Single-file `index.html`. `:root` tokens, inline SVG, no emojis, `Dashboard.esc()`, customer-scoped. Gated by `npm test` + in-browser verify.

## Decisions (from brainstorming)
- Products live under the renamed **Customer Profile** section (after Metrics).
- **Many products per project** (`project.product_ids = []`); product page shows linked projects.
- **Schema-driven table + detail** (mirrors Metrics/Personas).
- **versions** = list; **tech_stack** = list; `product_type` select = Application / Dashboard / Service / Other.
- Link editing is on the **project side** (a `product_ids` picker); the product detail lists linked projects read-only (clickable to open).

## F1 — Renames

- Nav item `data-view="strategy"` visible label **"Strategy" → "Objectives"** (keep the `data-view` key, `onclick="App.navigate('strategy')"`, and the item's icon). Update its `title` text accordingly.
- Nav `.nav-subsection-label` **"Strategy" → "Customer Profile"**.
- `App` `viewNames` map entry `strategy: 'Strategy'` → `strategy: 'Objectives'` (titlebar follows).
- Update affected tests asserting the "Strategy" nav label / viewName (e.g. any `slot-h-nav-raid` / strategy nav assertions) to "Objectives" / "Customer Profile".
- No change to the underlying `Strategy`/`Objectives` objects or routing.

## F2 — Products data model + migration

- New `data.products` array. Product object:
  ```
  { id, customer, name, product_type, versions: [], product_owner, tech_stack: [], description }
  ```
  - `id` — generated (e.g. `PRD-####`, unique; follow the app's id-generation convention).
  - `customer` — set to the active customer on create (customer-scoped, like objectives/metrics).
  - `product_type` — one of `Application` / `Dashboard` / `Service` / `Other`.
  - `versions` — array of strings (latest first by convention).
  - `tech_stack` — array of strings.
  - `product_owner`, `description` — strings.
- New `project.product_ids` array. **Migration** (in `migrateSchema`, alongside the existing `project.metric_ids`/`persona_ids` backfill ~line 5218): `if (!Array.isArray(p.product_ids)) p.product_ids = [];` and `if (!Array.isArray(data.products)) data.products = [];`.

## F3 — Products view + nav

- New nav item **Products** (`data-view="products"`, `onclick="App.navigate('products')"`, inline-SVG icon) in the Customer Profile section, after Metrics. Add `products: 'one'` to `App.VIEW_SCOPE`; add `products: 'Products'` to `viewNames`. Add a `#viewProducts` container and route `navigate('products')` → `ProductsView.mount()` (mirroring how `metrics`→`MetricsView.mount()` is wired in the navigate/refresh paths).
- New `ProductsView` object (mirroring `MetricsView`/`PersonasView`): `mount()` renders a schema-driven table of the active customer's products:
  - Columns: **Name · Type · Version · Owner · Tech stack · Projects** (Version shows the first/latest of `versions`; Tech stack shows chips; Projects shows the count of projects whose `product_ids` include this product).
  - Sortable headers (reuse the strategy-table sort pattern); empty state when none.
  - Row-click → product detail (panel or modal, mirroring the entity detail pattern): name, type, full `versions` list, owner, tech-stack chips, description, and the **linked projects** list (each a clickable chip/row opening `DetailPanel.open(projectId)`).
- Customer-scoped: `ProductsView` and a `Products.list()` helper filter by `App.activeCustomer`; re-render on customer switch (add a `products` branch to `setActiveCustomer`'s re-render chain, like the other entity views).

## F4 — Add / Edit / Remove products

- A `Products` object with `list()` / `byId(id)` / `add(rec)` / `update(i, rec)` / `remove(id)` (remove also strips the id from every project's `product_ids`, mirroring metric/persona deletion).
- A modal **form** (mirror the holiday form / `.team-edit-modal` pattern: tokens, Esc-to-close via `dismissTopModal`, ARIA, focus): Name (text), Type (select of the 4 options), Versions (list add/remove of text rows), Owner (text), Tech stack (list add/remove, or comma-entered chips), Description (textarea). Validation: name required. Add appends; edit replaces; both `pushUndo`/`markDirty`/`saveToLocalStorage`/re-render.
- "+ Add product" button on the Products view opens the blank form; row-click opens it pre-filled; a remove (✕) with confirm.

## F5 — Project ↔ Product linking

- **Project side (edit):** add a **Products** multi-select picker to the project detail panel's strategy-linkage section (the same place as the `metric_ids`/`persona_ids` pickers), sourced from `Products.list()`, writing `project.product_ids` through the normal update path. (The detail-panel strategy pickers live around the `metric_ids`/`persona_ids` rows — add a `product_ids` row mirroring them.)
- **Product side (view):** the product detail lists every project whose `product_ids` includes the product id, clickable to open the project. Read-only here (editing happens on the project side).
- **Delete integrity:** `Products.remove(id)` removes the id from all `project.product_ids`; `validateDataIntegrity` may optionally flag dangling `product_ids` (consistent with existing dangling-reference checks) — include only if low-cost.

## Testing

- **Renames:** nav item label "Objectives", section "Customer Profile", `viewNames.strategy === 'Objectives'`; existing strategy-nav assertions updated.
- **Migration:** `data.products` defaults to `[]`; `project.product_ids` defaults to `[]`.
- **Products object:** `list()` customer-scoped; `add`/`update`/`remove`; `remove` strips the id from projects' `product_ids`.
- **View:** table renders the active customer's products with the right columns + linked-project count; empty state; customer switch re-renders.
- **Form:** add appends a product with the entered fields (versions/tech_stack as arrays); edit pre-fills + updates; name-required validation; Esc closes.
- **Linking:** the detail-panel products picker writes `product_ids`; the product detail lists the linked projects.
- **Visual:** in-browser — Customer Profile section shows Objectives/Personas/Metrics/Products; add a product (Application + Dashboard), link it on a project, confirm it appears in the product's linked-projects list; light + dark.

## Out of scope

- No version history semantics beyond a list of strings (no per-version dates/changelogs).
- `product_owner` is free text (not a Person link) — could be upgraded later.
- Products are not added to the add-project **wizard** (link from the project detail panel); could be added later.
- D (RAID), E (Reports/packs) — their own workstreams.
