# IBCS / ISO 24896 dashboard notation

This house style encodes the **IBCS SUCCESS** rules (International Business Communication Standards, the basis of ISO 24896) for management reporting. Design every concept so a finance or controlling audience can read it without a legend and compare it against any other IBCS report. Prefer these rules over generic dashboard aesthetics.

## SAY — convey a message
- The **title states the message**, not just the subject: "Margin below plan in EMEA", not "Margin by region". Put it in the top-left of the top row.
- Every chart title carries the takeaway, not the dimension name.

## UNIFY — apply semantic notation (scenario marking)
- Mark **every data-bearing element** with its scenario via the *Scenario (IBCS)* prop:
  - **actual** — solid fill (the realised figure).
  - **plan / budget** — outlined / framed (empty fill with an outline).
  - **forecast** — hatched fill.
  - **previous_year (PY)** — a thin, lighter bar behind or beside the actual.
  - **delta** — the variance (actual − plan or actual − PY), shown as its own signed bar or a "vs plan / vs PY" figure.
- Keep the same scenario-to-fill mapping across every page. A reader must never guess whether a value is actual or planned.

## SUCCESS — provide proper visualisation
- Use one message per chart and pick the chart type that fits the analytical message via the *Message (IBCS)* prop:
  - **time_series** (development over time) → columns (vertical bars) or a line.
  - **comparison** (ranking, actual vs plan) → bars.
  - **deviation** (variance / bridge) → bars, ideally signed.
  - **structure** (part-to-whole, composition) → stacked bars or a table.
  - **correlation** → a scatter.
- Do not use pie/donut encodings or gauges — they defeat comparison.

## CONDENSE — increase information density
- Fill the canvas with content; avoid decorative whitespace. Prefer small multiples and consistent scales over a few large, sparse charts.
- Use consistent, comparable sizes for like elements so magnitudes read at a glance.

## CHECK — ensure visual integrity
- Bars start at zero. Use one consistent scale for comparable charts.
- Show units once, clearly (£m, %, FTE), and keep them consistent.

## EXPRESS / SIMPLIFY — remove clutter
- No 3-D, no gradients, no redundant gridlines or borders. One accent colour at most.
- Do not encode categories with red/green alone (inaccessible); pair colour with position, label or scenario notation.

## STRUCTURE — organise consistently
- Read top-to-bottom, summary-first: **headline KPIs above the analytical charts**, filters in the top band or right rail.
- Order categories the same way everywhere (e.g. largest-to-smallest, or a fixed reporting order).

Bind data-bearing components to the customer's real metrics wherever possible so the concept is build-ready and every figure traces to strategy.
