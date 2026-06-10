# Tableau Dashboard Design Guidelines

Visual and structural standards every wireframe concept must meet before it
goes to a customer. The machine-checkable subset is encoded in
`wireframe-definition.json` (the conformance checker enforces it); the rest
is judgement guidance for the designer and the AI assistant.

## Layout

- 12 x 8 grid. Components snap to cells; no free-floating elements.
- Reading order is Z-shaped: title top-left, KPIs across the top, detail
  charts in the middle, granular tables at the bottom.
- One clear focal point per dashboard. If two charts compete, split the
  dashboard.
- White space is a feature: leave at least one empty cell between dense
  blocks where the grid allows.

## Hierarchy and titling

- Exactly one dashboard title, top row, stating the question the dashboard
  answers ("Are we hitting Q3 sales targets?") rather than its contents
  ("Sales dashboard").
- Every chart gets a headline-style title (the takeaway, not the axis
  description) — enforced as `chart_needs_title`.
- KPIs (BANs) carry a comparison: vs target, vs prior period, or trend
  sparkline. A number without context is decoration.

## Filters and interactivity

- Filters live together: top band or right rail (`filters_edge`). Never
  scatter them between charts.
- Three to five filters maximum; beyond that, the dashboard is trying to be
  an extract tool.
- Cross-filtering from charts beats explicit filter controls where the
  audience is executive.

## Chart-type-to-question guidance

| Question shape | Use | Avoid |
|---|---|---|
| How much / top N? | bar | pie, packed bubbles |
| Trend over time? | line, area | bar-per-month walls |
| Relationship / outliers? | scatter | dual-axis spaghetti |
| Where? | map | maps for non-geo data |
| Exact values for finance? | table | charts pretending to be tables |
| Single headline number? | kpi | gauges |

## Accessibility

- Never encode meaning in colour alone; pair with position, shape or label.
- Use colour-blind-safe palettes (Tableau's built-in CB palette or equal).
- Minimum effective text size 10pt at the target display resolution.
- Reserve red/amber/green strictly for status semantics, matching the app's
  RAG conventions — do not use green/amber/red as decorative series colours.

## Permitted nuance

Within these rules, the concept adapts to the customer: their terminology,
their KPI set, their brand accent (one accent colour), the level of detail
their audience expects. The conformance checker flags structural violations
only — it never flags content choices.
