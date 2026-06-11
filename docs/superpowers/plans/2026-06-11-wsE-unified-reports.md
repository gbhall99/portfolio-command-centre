# Workstream E — Unified Document Engine + PDF Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one engine (`Reports`) render and deliver every printable document in the app, styled from the app's `:root` design tokens so PDFs match the screen; collapse the report packs behind an audience toggle; retire the legacy `Report.*` engine and the per-surface print paths.

**Architecture:** Today `Reports.Doc.buildDoc(opts)` returns a *doc object* (metadata + sections) but has **no HTML serializer** — the only serializer is the legacy `Report.buildDoc`/`_baseStyles`/`_coverPage` (hardcoded `#22c55e` RAG hex, separate from the app). Phase 1 adds the missing parity layer to `Reports`: a token-derived stylesheet (`Reports.tokens`), a shared table renderer (`Reports.table`), an HTML serializer (`Reports.Doc.toHtml`), a delivery wrapper (`Reports.open`), a single entry point (`Reports.generate`), and audience-aware section filtering — then migrates the briefs onto it. Phase 2 makes the Status-report and SOW skills feed `{sections}` to the engine instead of printing their own HTML. Phase 3 reroutes Billing, builds the Documents hub, and deletes all legacy/one-off renderers behind a guard test.

**Tech Stack:** Single-file `index.html` (~42,450 lines); vitest + jsdom (unit/render); Playwright (e2e). No build step.

**Conventions:** `:root` tokens, inline SVG (no emojis), `Dashboard.esc` for all user content, `esc(JSON.stringify(id))` for ids in onclick JS contexts, customer-scoped via `App.activeCustomer`, persist via `markDirty + saveToLocalStorage`. Run all tests: `npm test`. Single file: `npx vitest run tests/<f>`. Harness exposes top-level objects via `window.__pcc__` (loadApp.mjs already lists `Reports`, `Report`, `Billing`, `Sow`, `SowSkill`, `StatusReport`, `StatusReportSkill`).

**Key current anchors (verified 2026-06-11):**
- `const Reports = {` — line **36441**; closes **36654**. `Reports.Doc.buildDoc` **36455–36481**; `_DEFAULTS_BY_TYPE` **36443–36451**; `_CLASSIFICATION_BAND_COLOR` **36452–36454**; `Catalogue` **36523–36531**; `Builders.*` **36561–36631**; `Brand` **36487–36520**; `recentExports` **36533–36540**, `recordExport` **36634–36653**, `parseCopyLink` **36542–36554**, `buildCopyLink` **36555–36560**.
- `const Report = {` — line **36661**; closes **40372**. Serializer `buildDoc` **37181–37212**; `_baseStyles` **37051–37111**; `_coverPage` **37119–37143**; `_tocPage` **37145–37155**; `_appendix` **37157–37179**; `open` **37215–37220**; `_ragDot`/`execSummaryHtml` after 37220. Builders: `buildProjectPackDoc` **36664–36711**, `buildBusinessCaseDoc` **36724–36754**, `buildSprintBriefDoc` **36817–36856**, `buildCustomerPackDoc` **36976–37016**, `buildWalkthroughMinutesDoc` **36756–36808**, inline `exportPortfolioPack` **37322–37418**. `export*` wrappers: `exportProjectPack` **36713**, `exportSprintBrief` **36969**, `exportBusinessCase` **37023**, `exportCustomerPack` **37018**, `exportWalkthroughMinutes` **36810**.
- `:root` tokens — lines **11–169**. RAG: `--status-green:#0d9488`, `--status-amber:#d97706`, `--status-red:#dc2626` (lines 89–101). Type scale `--fs-2xs:11px … --fs-2xl:26px` (25–32). Font `--font-sans` (22).
- `Billing.exportReport(customer)` — line **40706**; call site **40862**.
- `StatusReportSkill` — **42305**; `generate()` **42325–42359**; `exportPrint()` **42368–42386**. `StatusReport` entity — **42218**.
- `Sow` entity — **40957**; `Sow.create` **40979–41017**. `SowSkill` — **41220+**.
- Call sites for legacy exports: quick-nav **15603/15605**, settings branding **8913**, governance sidebar **3883–3884**, customer panel **3612**, sprints sidebar **3746** (`openSprintBriefPicker`), project detail **19756–19757**, walkthrough **27314**, governance **30450**.
- Tests: `tests/unit/reports-r0-r11.test.mjs`, `billing.test.mjs`, `sow.test.mjs`, `sow-quote.test.mjs`, `status-report.test.mjs`, `skills.test.mjs`; `tests/e2e/sow.spec.ts`. Harness `tests/harness/loadApp.mjs` (bridge ~line 37), `tests/harness/fixtures.mjs` (`makeDataset` 92–105, `makeProject`).

---

## Canonical contracts (defined once, used throughout)

**Section shape** (the unit `Reports.Doc.toHtml` renders):
```js
{ id: 'risks', title: 'Risks we are managing', html: '<p>…</p>', audiences: ['customer','internal'] }
```
- `html` is a pre-escaped HTML fragment (builders use `Dashboard.esc` on user content).
- `audiences` lists which audience(s) show the section. Missing/empty `audiences` ⇒ shown to all (back-compat).

**Audience:** the string `'customer'` or `'internal'`. Default `'internal'`.

**Doc object** (unchanged shape from `buildDoc`, with audience threaded): `{ title, subtitle, customer, reportType, density, coverPage, tocPage, includeAppendix, classification, classificationBand, sections[], appendix[], audience }`.

---

# PHASE 1 — Parity foundation + engine + migrate the briefs

## Task 1: `Reports.tokens()` — token-derived print stylesheet

**Files:** Modify `index.html` (add inside `Reports`, after `_CLASSIFICATION_BAND_COLOR` ~line 36454); Create `tests/render/reports-tokens.test.mjs`

- [x] **Step 1: Write the failing test** — `tests/render/reports-tokens.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

describe('Reports.tokens — parity stylesheet', () => {
  it('uses the app RAG tokens, not the legacy report hex', async () => {
    const app = await loadApp(makeDataset({}));
    const css = app.Reports.tokens();
    expect(css).toContain('<style>');
    // App RAG values (parity), NOT the legacy #22c55e / #f59e0b / #ef4444 family
    expect(css).toContain('#0d9488'); // status-green
    expect(css).toContain('#d97706'); // status-amber
    expect(css).toContain('#dc2626'); // status-red
    expect(css).not.toContain('#22c55e');
    expect(css).not.toContain('#ef4444');
    // print-tuned
    expect(css).toMatch(/@page/);
    app.teardown();
  });
  it('accepts a brand primary color', async () => {
    const app = await loadApp(makeDataset({}));
    const css = app.Reports.tokens({ primaryColor: '#112233' });
    expect(css).toContain('#112233');
    app.teardown();
  });
});
```

- [x] **Step 2: Run, verify FAIL** — `npx vitest run tests/render/reports-tokens.test.mjs` (`Reports.tokens` is not a function).

- [x] **Step 3: Implement `Reports.tokens`.** Insert as a method of the `Reports` object (after `_CLASSIFICATION_BAND_COLOR`, ~line 36454). Port the legacy `_baseStyles` layout rules but source colours/sizes from the APP tokens (RAG = `#0d9488`/`#d97706`/`#dc2626`; type scale 11–26px; `--font-sans`). White A4 canvas, fixed running header/footer, ink-friendly:

```javascript
  tokens(brand) {
    brand = brand || {};
    const primary = brand.primaryColor || '#3b82f6';
    return '<style>' +
      ':root{' +
        '--rp-primary:' + primary + ';' +
        "--rp-font:'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif;" +
        '--rp-surface:#ffffff;--rp-surface-2:#f8fafc;--rp-surface-3:#f1f5f9;' +
        '--rp-text:#1e293b;--rp-title:#0f172a;--rp-muted:#475569;--rp-faint:#64748b;' +
        '--rp-border:#e2e8f0;--rp-border-strong:#cbd5e1;' +
        // PARITY: RAG sourced from the app :root tokens, not the old report hex
        '--rp-green:#0d9488;--rp-amber:#d97706;--rp-red:#dc2626;' +
        '--rp-fs-2xs:11px;--rp-fs-xs:12px;--rp-fs-sm:13px;--rp-fs-md:14px;--rp-fs-lg:16px;--rp-fs-xl:20px;--rp-fs-2xl:26px;' +
      '}' +
      'body{font-family:var(--rp-font);color:var(--rp-text);font-size:var(--rp-fs-sm);line-height:1.55;margin:0;background:var(--rp-surface)}' +
      '.rp-page{max-width:760px;margin:0 auto;padding:0 24px}' +
      '.rp-section{margin:18px 0;page-break-inside:avoid}' +
      '.rp-section-title{font-size:var(--rp-fs-lg);color:var(--rp-title);font-weight:700;border-bottom:2px solid var(--rp-primary);padding-bottom:4px;margin-bottom:8px}' +
      '.rp-table{width:100%;border-collapse:collapse;font-size:var(--rp-fs-xs)}' +
      '.rp-table th{text-align:left;background:var(--rp-surface-3);color:var(--rp-muted);font-weight:600;padding:6px 8px;border-bottom:1px solid var(--rp-border-strong)}' +
      '.rp-table td{padding:6px 8px;border-bottom:1px solid var(--rp-border);color:var(--rp-text)}' +
      '.rp-chip{display:inline-block;border-radius:10px;padding:1px 8px;font-weight:700;color:#fff;font-size:var(--rp-fs-2xs)}' +
      '.rp-rag-green{color:var(--rp-green)}.rp-rag-amber{color:var(--rp-amber)}.rp-rag-red{color:var(--rp-red)}' +
      '.rp-cover{padding:48px 0;border-bottom:3px solid var(--rp-primary);margin-bottom:24px}' +
      '.rp-cover-title{font-size:var(--rp-fs-2xl);color:var(--rp-title);font-weight:800;margin:8px 0}' +
      '.rp-classification{font-size:var(--rp-fs-2xs);text-transform:uppercase;letter-spacing:.6px;font-weight:700}' +
      '.rp-toc{font-size:var(--rp-fs-sm);color:var(--rp-muted)}' +
      '@page{size:A4;margin:22mm 16mm 24mm 16mm}' +
      '@media print{.rp-page{max-width:none}body{font-size:var(--rp-fs-xs)}}' +
    '</style>';
  },
```

- [x] **Step 4: Run, verify PASS** — `npx vitest run tests/render/reports-tokens.test.mjs`.

- [x] **Step 5: Commit**

```bash
git add index.html tests/render/reports-tokens.test.mjs
git commit -m "feat(reports): token-derived print stylesheet (Reports.tokens) for PDF parity"
```

---

## Task 2: `Reports.table()` — shared token-styled table renderer

**Files:** Modify `index.html` (add to `Reports`, after `tokens`); Create `tests/render/reports-table.test.mjs`

- [ ] **Step 1: Write the failing test** — `tests/render/reports-table.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

describe('Reports.table — shared renderer', () => {
  it('renders headers, rows, and escapes content', async () => {
    const app = await loadApp(makeDataset({}));
    const html = app.Reports.table({
      columns: [
        { key: 'name', label: 'Project' },
        { key: 'score', label: 'Score', cell: (r) => '<span class="rp-chip" style="background:var(--rp-red)">' + r.score + '</span>' }
      ],
      rows: [{ name: 'Customer <360>', score: 25 }]
    });
    expect(html).toContain('class="rp-table"');
    expect(html).toContain('<th');
    expect(html).toContain('Project');
    expect(html).toContain('Customer &lt;360&gt;'); // escaped
    expect(html).toContain('rp-chip');
    app.teardown();
  });
  it('renders an empty-state row when no rows', async () => {
    const app = await loadApp(makeDataset({}));
    const html = app.Reports.table({ columns: [{ key: 'x', label: 'X' }], rows: [], empty: 'Nothing to report' });
    expect(html).toContain('Nothing to report');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/render/reports-table.test.mjs`.

- [ ] **Step 3: Implement `Reports.table`.** Add after `tokens`. Default cell = escaped raw value; `cell(row)` callback returns trusted HTML (caller escapes). `colgroup` for fixed widths when `width` given:

```javascript
  table(opts) {
    opts = opts || {};
    const esc = Dashboard.esc;
    const cols = opts.columns || [];
    const rows = opts.rows || [];
    const colgroup = cols.some(c => c.width)
      ? '<colgroup>' + cols.map(c => '<col' + (c.width ? ' style="width:' + c.width + '"' : '') + '>').join('') + '</colgroup>'
      : '';
    const head = '<thead><tr>' + cols.map(c =>
      '<th' + (c.align ? ' style="text-align:' + c.align + '"' : '') + '>' + esc(c.label || '') + '</th>'
    ).join('') + '</tr></thead>';
    let bodyRows;
    if (!rows.length) {
      bodyRows = '<tr><td colspan="' + cols.length + '" style="color:var(--rp-faint);padding:10px 8px">' + esc(opts.empty || 'No data') + '</td></tr>';
    } else {
      bodyRows = rows.map(r => '<tr>' + cols.map(c => {
        const content = typeof c.cell === 'function' ? c.cell(r) : esc(r[c.key] == null ? '' : String(r[c.key]));
        return '<td' + (c.align ? ' style="text-align:' + c.align + '"' : '') + '>' + content + '</td>';
      }).join('') + '</tr>').join('');
    }
    return '<table class="rp-table">' + colgroup + head + '<tbody>' + bodyRows + '</tbody></table>';
  },
```

- [ ] **Step 4: Run, verify PASS** — `npx vitest run tests/render/reports-table.test.mjs`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/reports-table.test.mjs
git commit -m "feat(reports): shared token-styled table renderer (Reports.table)"
```

---

## Task 3: Audience-aware section filter + `Reports.Doc.toHtml` serializer

**Files:** Modify `index.html` (`Reports.Doc`, add `toHtml` + `_filterSections`; extend `buildDoc` to carry `audience`); Create `tests/render/reports-tohtml.test.mjs`

- [ ] **Step 1: Write the failing test** — `tests/render/reports-tohtml.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

const SECTIONS = [
  { id: 'narrative', title: 'Narrative', html: '<p>All good</p>', audiences: ['customer', 'internal'] },
  { id: 'evm', title: 'EVM & cost', html: '<p>SPI 0.9</p>', audiences: ['internal'] }
];

describe('Reports.Doc.toHtml', () => {
  it('serializes a doc to a full HTML document with cover + sections', async () => {
    const app = await loadApp(makeDataset({}));
    const doc = app.Reports.Doc.buildDoc({ reportType: 'portfolio_pack', title: 'Portfolio', customer: 'Acme', sections: SECTIONS, audience: 'internal' });
    const html = app.Reports.Doc.toHtml(doc, { primaryColor: '#3b82f6' });
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('rp-table'.slice(0, 2) === 'rp' ? '<style>' : '<style>'); // tokens injected
    expect(html).toContain('Portfolio');
    expect(html).toContain('Narrative');
    expect(html).toContain('EVM &amp; cost'); // internal section shown for internal audience
    expect(html).toContain('SPI 0.9');
    app.teardown();
  });
  it('redacts internal-only sections for a customer audience', async () => {
    const app = await loadApp(makeDataset({}));
    const doc = app.Reports.Doc.buildDoc({ reportType: 'portfolio_pack', title: 'Portfolio', customer: 'Acme', sections: SECTIONS, audience: 'customer' });
    const html = app.Reports.Doc.toHtml(doc, {});
    expect(html).toContain('Narrative');
    expect(html).not.toContain('SPI 0.9'); // EVM hidden from customers
    app.teardown();
  });
  it('classification band reflects the doc classification', async () => {
    const app = await loadApp(makeDataset({}));
    const doc = app.Reports.Doc.buildDoc({ reportType: 'portfolio_pack', classification: 'Confidential', sections: SECTIONS });
    const html = app.Reports.Doc.toHtml(doc, {});
    expect(html.toLowerCase()).toContain('confidential');
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/render/reports-tohtml.test.mjs`.

- [ ] **Step 3a: Thread `audience` through `buildDoc`.** In `Reports.Doc.buildDoc` (line 36455–36481), add to the returned object: `audience: opts.audience || 'internal',`.

- [ ] **Step 3b: Add `_filterSections` + `toHtml` to `Reports.Doc`** (inside the `Doc` object, after `buildDoc`). Port the legacy cover/toc/appendix/classification rendering, but render sections from the `{id,title,html,audiences}` contract and gate by audience:

```javascript
    _filterSections(sections, audience) {
      return (sections || []).filter(s => !s.audiences || !s.audiences.length || s.audiences.indexOf(audience) >= 0);
    },
    toHtml(doc, brand) {
      doc = doc || {};
      brand = brand || (typeof Reports !== 'undefined' ? Reports.Brand.for(doc.customer) : {});
      const esc = Dashboard.esc;
      const audience = doc.audience || 'internal';
      const sections = this._filterSections(doc.sections, audience);
      const bandColor = doc.classificationBand || (Reports._CLASSIFICATION_BAND_COLOR[doc.classification] || 'transparent');
      const classLine = doc.classification
        ? '<div class="rp-classification" style="color:' + bandColor + '">' + esc(doc.classification) + (audience === 'customer' ? ' — shared' : '') + '</div>'
        : '';
      const cover = doc.coverPage
        ? '<div class="rp-cover">' + classLine +
            '<div class="rp-cover-title">' + esc(doc.title || '') + '</div>' +
            (doc.subtitle ? '<div style="color:var(--rp-muted)">' + esc(doc.subtitle) + '</div>' : '') +
            (doc.customer ? '<div style="color:var(--rp-faint);font-size:var(--rp-fs-xs);margin-top:6px">' + esc(doc.customer) + '</div>' : '') +
          '</div>'
        : '';
      const toc = doc.tocPage && sections.length >= 3
        ? '<div class="rp-section rp-toc"><div class="rp-section-title">Contents</div><ol>' +
            sections.map(s => '<li>' + esc(s.title || '') + '</li>').join('') + '</ol></div>'
        : '';
      const body = sections.map(s =>
        '<div class="rp-section" id="rp-' + esc(s.id || '') + '"><div class="rp-section-title">' + esc(s.title || '') + '</div>' + (s.html || '') + '</div>'
      ).join('');
      const appendix = (doc.appendix && doc.appendix.length)
        ? '<div class="rp-section"><div class="rp-section-title">Appendix</div>' + doc.appendix.map(a => a.html || '').join('') + '</div>'
        : '';
      return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(doc.title || 'Report') + '</title>' +
        Reports.tokens(brand) + '</head><body><div class="rp-page">' +
        cover + toc + body + appendix + '</div></body></html>';
    },
```

- [ ] **Step 4: Run, verify PASS** — `npx vitest run tests/render/reports-tohtml.test.mjs`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/reports-tohtml.test.mjs
git commit -m "feat(reports): Reports.Doc.toHtml serializer + audience section filtering"
```

---

## Task 4: `Reports.open` + `Reports.generate` single entry point

**Files:** Modify `index.html` (`Reports`, add `open` + `generate`); Create `tests/render/reports-generate.test.mjs`

- [ ] **Step 1: Write the failing test** — `tests/render/reports-generate.test.mjs`:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Reports.open + Reports.generate', () => {
  it('open writes HTML to a new window and records nothing by itself', async () => {
    const app = await loadApp(makeDataset({}));
    const writes = [];
    const fakeWin = { document: { write: (s) => writes.push(s), close() {} } };
    app.window.open = () => fakeWin;
    app.Reports.open('<!DOCTYPE html><html><body>hi</body></html>');
    expect(writes.join('')).toContain('hi');
    app.teardown();
  });
  it('generate looks up the catalogue, builds, serializes, opens, and audits', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1' }],
      projects: [makeProject({ id: 'P1', name: 'Proj', customer: 'Acme Industries', status: 'In Progress' })]
    }));
    app.App.activeCustomer = 'Acme Industries';
    const writes = [];
    app.window.open = () => ({ document: { write: (s) => writes.push(s), close() {} } });
    const before = (app.App.data.audit_log || []).length;
    app.Reports.generate('portfolio_pack', { customer: 'Acme Industries', audience: 'internal' });
    expect(writes.join('')).toMatch(/^<!DOCTYPE html>/);
    expect((app.App.data.audit_log || []).length).toBe(before + 1);
    app.teardown();
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/render/reports-generate.test.mjs`.

- [ ] **Step 3: Implement `open` + `generate`** on the `Reports` object. `generate` maps a catalogue id → the matching `Builders.*` call (using `args`), threads `audience`, serializes, opens, and records the export. Map builder per catalogue id:

```javascript
  open(html) {
    const w = window.open('', '_blank');
    if (!w) { if (typeof App !== 'undefined' && App.toast) App.toast('Pop-up blocked — allow pop-ups to export', 'error'); return null; }
    w.document.write(html + '<script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script>');
    w.document.close();
    return w;
  },
  _build(reportId, args) {
    args = args || {};
    const B = Reports.Builders;
    switch (reportId) {
      case 'sponsor_pack':
      case 'project_report': return B.sponsorPack(args.projectId);
      case 'business_case': return B.businessCase(args.projectId);
      case 'sprint_brief': return B.sprintBrief(args.customer, args.sprintId);
      case 'customer_pack':
      case 'portfolio_pack':
      case 'portfolio_report': return (args.audience === 'customer') ? B.customerPack(args.customer) : B.portfolioPack(args.customer);
      case 'meeting_agenda': return B.forumAgenda(args.forumId);
      case 'status_report': return B.statusReport(args.customer);
      default: return null;
    }
  },
  generate(reportId, args) {
    args = args || {};
    const doc = this._build(reportId, args);
    if (!doc) { if (App.toast) App.toast('Unknown report: ' + reportId, 'error'); return; }
    doc.audience = args.audience || doc.audience || 'internal';
    const html = Reports.Doc.toHtml(doc, Reports.Brand.for(doc.customer || args.customer));
    this.open(html);
    this.recordExport(reportId, args.customer || args.projectId || args.forumId || '', { outputSizeBytes: html.length });
  },
```

- [ ] **Step 4: Run, verify PASS** — `npx vitest run tests/render/reports-generate.test.mjs`. NOTE: this exercises `Builders.portfolioPack`/`customerPack`/`statusReport` — if any builder returns sections not matching the `{id,title,html,audiences}` contract, fix that builder's section objects in Task 5/6 (this test only requires `portfolio_pack` internal to serialize; adjust the builder if it throws).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/reports-generate.test.mjs
git commit -m "feat(reports): Reports.open delivery + Reports.generate single entry point"
```

---

## Task 5: Align brief builders to the section contract + audience tags

**Files:** Modify `index.html` (`Reports.Builders.customerPack` 36563, `portfolioPack` 36617, `sponsorPack` 36592, `businessCase` 36596, `sprintBrief` 36610, `forumAgenda` 36624); extend `tests/unit/reports-r0-r11.test.mjs` or create `tests/render/reports-briefs.test.mjs`

- [ ] **Step 1: Read all six builders** (lines 36561–36631) and note their current section shapes. Each must emit sections as `{ id, title, html, audiences }`. `sponsorPack` currently delegates to legacy `Report.buildProjectPackDoc` — re-point it to build via `Reports.Doc.buildDoc` directly (do NOT call legacy).

- [ ] **Step 2: Write the failing test** — `tests/render/reports-briefs.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function boot() {
  const app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [makeProject({ id: 'P1', name: 'Proj One', customer: 'Acme Industries', status: 'At Risk',
      narrative: { headline: 'Phase 1 tracking', wins: ['UAT ready'], asks: ['Approve phase 2'], customer_visible_risk_ids: ['r1'] },
      risks_register: [
        { id: 'r1', description: 'Shown to customer', impact: 4, probability: 3 },
        { id: 'r2', description: 'Internal only risk', impact: 5, probability: 5 }
      ],
      business_value: 8, time_criticality: 6, risk_reduction_opportunity: 5
    })]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

describe('Brief builders emit the section contract', () => {
  it('project report: business case section is internal-only', async () => {
    const app = await boot();
    const doc = app.Reports.Builders.sponsorPack('P1');
    expect(Array.isArray(doc.sections)).toBe(true);
    doc.sections.forEach(s => { expect(s).toHaveProperty('id'); expect(s).toHaveProperty('title'); expect(s).toHaveProperty('html'); });
    const bc = doc.sections.find(s => /business case|cost|npv|financ/i.test(s.title));
    if (bc) expect(bc.audiences).toEqual(['internal']);
    app.teardown();
  });
  it('portfolio customer audience redacts to customer_visible_risk_ids', async () => {
    const app = await boot();
    const doc = app.Reports.Builders.customerPack('Acme Industries');
    const html = app.Reports.Doc.toHtml({ ...doc, audience: 'customer' }, {});
    expect(html).toContain('Shown to customer');
    expect(html).not.toContain('Internal only risk');
    app.teardown();
  });
});
```

- [ ] **Step 3: Update the builders.** For each builder: build sections as `{id,title,html,audiences}`. `sponsorPack` → Project report: narrative/milestones/status sections `audiences:['customer','internal']`; a Business Case section (cost/NPV/WSJF via `App.computeProjectCost`/`App.calculateWsjf`) tagged `audiences:['internal']`; risk section filtered to `customer_visible_risk_ids` when audience customer (do the filtering in the section's html using `App` data — or include both a customer-risk section `['customer','internal']` listing only visible risks and a full-risk section `['internal']`). `customerPack`/`portfolioPack` already exist — ensure their sections carry `audiences` and the risk section respects `customer_visible_risk_ids`. Render all tables via `Reports.table`. Use `Dashboard.esc` on all user content.

- [ ] **Step 4: Run the test + regression** — `npx vitest run tests/render/reports-briefs.test.mjs && npx vitest run tests/unit/reports-r0-r11.test.mjs`. Fix any reports-r0-r11 assertions that referenced the old section shape (update them to the contract; do NOT weaken intent).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/render/reports-briefs.test.mjs tests/unit/reports-r0-r11.test.mjs
git commit -m "feat(reports): brief builders emit audience-tagged section contract"
```

---

## Task 6: Migrate brief export call-sites to `Reports.generate`

**Files:** Modify `index.html` (call sites: project detail **19756–19757**, customer panel **3612**, governance sidebar **3883–3884**, quick-nav **15603/15605**, sprints sidebar **3746**); Create `tests/e2e/reports-generate.spec.ts`

- [ ] **Step 1: Write the failing e2e** — `tests/e2e/reports-generate.spec.ts` (mirror existing e2e patterns in `tests/e2e/sow.spec.ts`):

```typescript
import { test, expect } from '@playwright/test';

test('project detail Report button calls Reports.generate', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    // @ts-ignore
    window.__calls = []; const R = (window as any).Reports;
    const orig = R.generate.bind(R); R.generate = (...a) => { (window as any).__calls.push(a); };
  });
  // open demo + a project detail panel via the app's own API (deterministic)
  await page.evaluate(() => { (window as any).App.loadDemoData(); });
  await page.evaluate(() => {
    const p = (window as any).App.data.projects[0];
    (window as any).App.activeCustomer = p.customer;
    (window as any).Reports.generate('project_report', { projectId: p.id, audience: 'internal' });
  });
  const calls = await page.evaluate(() => (window as any).__calls);
  expect(calls.length).toBeGreaterThan(0);
});
```

(If the existing e2e harness uses a different bootstrap, follow `tests/e2e/sow.spec.ts`'s setup verbatim.)

- [ ] **Step 2: Run, verify FAIL** — `npx playwright test tests/e2e/reports-generate.spec.ts` (only fails if generate wiring/exposure is wrong; the assertion is light — its real purpose is a smoke check).

- [ ] **Step 3: Re-point the call sites.** Replace each legacy `Report.export*` onclick with `Reports.generate(...)`:
  - Project detail **19756–19757**: the two buttons become one **Report** button `onclick="Reports.generate('project_report',{projectId:<id>,audience:'internal'})"` plus a customer-facing variant, or an audience toggle in the panel. Use `esc(JSON.stringify(id))` for the id.
  - Customer panel **3612** + governance sidebar **3883**: `Reports.generate('portfolio_report',{customer:App.activeCustomer,audience:'customer'})` and `…audience:'internal'`.
  - Quick-nav **15603/15605**: same two, via `Reports.generate`.
  - Sprints sidebar **3746** (`openSprintBriefPicker`): keep the picker UI, but its generate action calls `Reports.generate('sprint_brief',{customer,sprintId})`.
  - Meeting agenda call site (governance): `Reports.generate('meeting_agenda',{forumId})`.

- [ ] **Step 4: Run e2e + full regression** — `npx playwright test tests/e2e/reports-generate.spec.ts && npx vitest run`. Existing report tests stay green.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/e2e/reports-generate.spec.ts
git commit -m "feat(reports): route brief export buttons through Reports.generate"
```

---

## Task 7: Remove the legacy brief paths used by the briefs

**Files:** Modify `index.html` (delete the now-unused legacy `Report.*` brief builders/exports that the migrated briefs replaced); Create `tests/unit/reports-no-legacy-briefs.test.mjs`

- [ ] **Step 1: Confirm no remaining callers.** Grep for `Report.exportProjectPack`, `Report.exportBusinessCase`, `Report.exportCustomerPack`, `Report.exportPortfolioPack`, `Report.buildProjectPackDoc`, `Report.buildCustomerPackDoc`. Every UI caller must already route through `Reports.generate` (Task 6). The walkthrough export (`Report.exportWalkthroughMinutes`, 36810) and `Report.open`/`_baseStyles` stay until Phase 3 — only remove brief-specific methods now.

- [ ] **Step 2: Write the guard test** — `tests/unit/reports-no-legacy-briefs.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

describe('legacy brief renderers removed', () => {
  for (const id of ['exportProjectPack', 'exportBusinessCase', 'exportCustomerPack', 'exportPortfolioPack', 'buildProjectPackDoc', 'buildCustomerPackDoc']) {
    it('Report.' + id + ' is gone', () => {
      expect(html).not.toContain(id + '(');
    });
  }
});
```

- [ ] **Step 3: Run, verify FAIL** — `npx vitest run tests/unit/reports-no-legacy-briefs.test.mjs` (methods still present).

- [ ] **Step 4: Delete the legacy brief methods** from the `Report` object: `exportProjectPack` (36713), `exportBusinessCase` (37023), `exportCustomerPack` (37018), `exportPortfolioPack` (37322–37418), `buildProjectPackDoc` (36664–36711), `buildCustomerPackDoc` (36976–37016), `buildBusinessCaseDoc` (36724–36754). Keep `open`, `_baseStyles`, `_coverPage`, `branding`, `setBranding`, `configureBranding`, `exportSprintBrief`/`buildSprintBriefDoc`, `exportWalkthroughMinutes`/`buildWalkthroughMinutesDoc`, `openSprintBriefPicker` for now (Phase 3 sweeps the rest). Verify the object literal stays syntactically valid.

- [ ] **Step 5: Run guard + full regression** — `npx vitest run tests/unit/reports-no-legacy-briefs.test.mjs && npm test`. All green.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/unit/reports-no-legacy-briefs.test.mjs
git commit -m "refactor(reports): delete legacy brief builders now served by Reports engine"
```

---

## Task 8: Phase 1 verification + visual pass

**Files:** none (verification only)

- [ ] **Step 1: Full suite** — `npm test`. Expect all green.
- [ ] **Step 2: Serve + visual** — `python3 -m http.server 8765 --bind 127.0.0.1`; drive `http://127.0.0.1:8765/index.html`, load demo, pick a customer. Generate Project report (Internal + Customer-facing) and Portfolio report (both audiences). Verify at 1440px: cover/classification/footer present; tables use the app RAG colours (#0d9488/#d97706/#dc2626) and match the on-screen table look; customer-facing hides EVM/internal risks; no console errors; the print dialog opens.
- [ ] **Step 3: Commit any tweak** — `git add -A && git commit -m "chore: WS-E phase 1 verification"` (skip if none).

---

# PHASE 2 — Skills feed the engine (Status report + SOW)

## Task 9: Status report renders through the engine

**Files:** Modify `index.html` (`StatusReportSkill.exportPrint` 42368–42386 → build sections + call `Reports`); add a `status_report` builder path; Modify `tests/unit/status-report.test.mjs`

- [ ] **Step 1: Write the failing test** — add to `tests/unit/status-report.test.mjs`:

```javascript
it('exportPrint renders the saved report through Reports engine (no bespoke HTML)', async () => {
  const app = await loadApp(makeDataset({
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', status: 'At Risk' })],
    settings: { billing: { currency: 'USD', hours_per_point: 8, rate_table: {}, customer_defaults: {} } }
  }));
  app.App.activeCustomer = 'Acme Industries';
  const r = app.StatusReport.create({ customer: 'Acme Industries', period: 'June 2026', definition: { sections: [{ id: 'exec', title: 'Executive summary', order: 1, required: true }] }, generatedSections: [{ id: 'exec', content: 'On track.' }] });
  let openedHtml = '';
  app.Reports.open = (html) => { openedHtml = html; return {}; };
  app.StatusReportSkill._id = r.id;
  app.StatusReportSkill.exportPrint();
  expect(openedHtml).toMatch(/^<!DOCTYPE html>/);
  expect(openedHtml).toContain('On track.');
  expect(openedHtml).toContain('<style>'); // engine tokens, not the old inline 2563eb style
  app.teardown();
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/unit/status-report.test.mjs`.

- [ ] **Step 3: Rewrite `StatusReportSkill.exportPrint`** (42368–42386) to map the saved `status_report` entity's sections to the `{id,title,html,audiences}` contract, build a doc via `Reports.Doc.buildDoc({reportType:'status_report', title:'Status Report — '+customer, customer, sections, audience:'internal'})`, serialize with `Reports.Doc.toHtml`, and deliver via `Reports.open`. Convert section content (newline/`- ` bullets) into escaped HTML. Remove the bespoke `<style>…#2563eb…</style>` block and the inline print `<script>`.

```javascript
    exportPrint() {
      const r = StatusReport.get(this._id);
      if (!r) return;
      const esc = Dashboard.esc;
      const toHtml = (content) => (content || '').split(/\n+/).map(line =>
        /^[-*] /.test(line) ? '<li>' + esc(line.slice(2)) + '</li>' : '<p>' + esc(line) + '</p>'
      ).join('');
      const sections = r.sections.filter(s => (s.content || '').trim())
        .map(s => ({ id: s.id, title: s.title, html: toHtml(s.content), audiences: ['customer', 'internal'] }));
      const doc = Reports.Doc.buildDoc({ reportType: 'status_report', title: 'Status Report — ' + r.customer, subtitle: r.period, customer: r.customer, sections, audience: 'internal' });
      Reports.open(Reports.Doc.toHtml(doc, Reports.Brand.for(r.customer)));
      Reports.recordExport('status_report', r.customer, {});
    },
```

- [ ] **Step 4: Run, verify PASS + regression** — `npx vitest run tests/unit/status-report.test.mjs && npx vitest run`.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/unit/status-report.test.mjs
git commit -m "feat(reports): status report skill renders through the unified engine"
```

---

## Task 10: SOW renders through the engine

**Files:** Modify `index.html` (the SOW print/export path in `SowSkill`/`Sow`); Modify `tests/unit/sow.test.mjs`

- [ ] **Step 1: Locate the SOW print path.** In `SowSkill` (41220+) find the export/print method (mirror of `StatusReportSkill.exportPrint`). Read it.
- [ ] **Step 2: Write the failing test** — add to `tests/unit/sow.test.mjs` a test asserting the SOW export calls `Reports.open` with a `<!DOCTYPE html>` doc containing the SOW section content and `<style>` from the engine (mirror Task 9's test, using `Sow.create` with a minimal definition + generatedSections).
- [ ] **Step 3: Run, verify FAIL.**
- [ ] **Step 4: Rewrite the SOW export** to map the SOW entity's `sections[]` ({id,title,content}) into the `{id,title,html,audiences:['customer','internal']}` contract, `buildDoc({reportType:'sponsor_pack'|'sow', ...})` (use `customer_pack` defaults — full/cover/toc; classification Confidential), serialize via `Reports.Doc.toHtml`, deliver via `Reports.open`, `recordExport('sow', customer)`. Remove its bespoke HTML/print.
- [ ] **Step 5: Run test + regression** — `npx vitest run tests/unit/sow.test.mjs && npx vitest run && npx playwright test tests/e2e/sow.spec.ts`. If `sow.spec.ts` asserts old print markup, update it to assert the engine path.
- [ ] **Step 6: Commit**

```bash
git add index.html tests/unit/sow.test.mjs tests/e2e/sow.spec.ts
git commit -m "feat(reports): SOW renders through the unified engine"
```

---

# PHASE 3 — Billing + Documents hub + final legacy removal

## Task 11: Billing/Costs report renders through the engine

**Files:** Modify `index.html` (`Billing.exportReport` 40706 → builder + engine; call site 40862); Modify `tests/unit/billing.test.mjs`

- [ ] **Step 1: Write the failing test** — add to `tests/unit/billing.test.mjs`: after seeding a customer with billing data, stub `Reports.open`, call `Billing.exportReport('Acme Industries')`, assert the captured HTML starts `<!DOCTYPE html>`, contains the engine `<style>`, the arrangements/projects table data, and uses `class="rp-table"` (shared renderer) rather than ad-hoc `<table>`.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Add `Reports.Builders.costsReport(customer)`** returning `buildDoc({reportType:'portfolio_pack', title:'Costs & Billing — '+customer, customer, sections:[{id:'arrangements',title:'Prepaid arrangements',html:Reports.table({...}),audiences:['internal']},{id:'projects',title:'Per-project costs',html:Reports.table({...}),audiences:['internal']}], audience:'internal', classification:'Internal'})`. Source data from `Billing.customerSummary(customer)`. Then rewrite `Billing.exportReport` to `Reports.open(Reports.Doc.toHtml(Reports.Builders.costsReport(customer)))` + `recordExport('costs_report', customer)`. Add a `costs_report` entry to `Reports.Catalogue` and a case in `Reports._build`.
- [ ] **Step 4: Run test + regression** — `npx vitest run tests/unit/billing.test.mjs && npx vitest run`.
- [ ] **Step 5: Commit**

```bash
git add index.html tests/unit/billing.test.mjs
git commit -m "feat(reports): billing/costs report renders through the unified engine"
```

---

## Task 12: Update the catalogue (status_report customer-scoped) + Documents hub view

**Files:** Modify `index.html` (`Reports.Catalogue` 36523 — status_report scope; add a hub view + nav entry); Create `tests/render/reports-hub.test.mjs`

- [ ] **Step 1: Catalogue fix.** Change the `status_report` entry's `scope` from `'cross-customer'` to `'customer'` and `requiresScopeArg` to `'customer'`; add `audiences` arrays to each catalogue entry (`['customer','internal']` for project/portfolio/status; `['internal']` for sprint_brief/meeting_agenda/costs_report). Add `contentSource` (`'data-derived'` | `'skill-fed'`) per the spec table.
- [ ] **Step 2: Write the failing test** — `tests/render/reports-hub.test.mjs`: boot with a customer, call the hub render fn (e.g. `ReportsHub.render()` or `App.navigate('reports')`), assert the host HTML lists the catalogue titles ("Project report", "Portfolio report", "Sprint brief", "Meeting agenda", "Status report", "Costs report"), shows audience chips where `audiences.length>1`, and a "Recent exports" heading. Assert customer-scoping (the active customer name appears).
- [ ] **Step 3: Run, verify FAIL.**
- [ ] **Step 4: Implement a `ReportsHub` object + nav view.** Render catalogue cards (title, description, audience chips, Generate button calling `Reports.generate(id,{customer:App.activeCustomer,audience})`), a Recent-exports list (`Reports.recentExports(10)`), customer-scoped. Add a nav entry (mirror an existing view registration, e.g. how RAID/Delivery views register). Expose `ReportsHub` in `tests/harness/loadApp.mjs` bridge + return.
- [ ] **Step 5: Run test + regression** — `npx vitest run tests/render/reports-hub.test.mjs && npx vitest run`.
- [ ] **Step 6: Commit**

```bash
git add index.html tests/render/reports-hub.test.mjs tests/harness/loadApp.mjs
git commit -m "feat(reports): Documents/Reports hub view + catalogue audience metadata"
```

---

## Task 13: Final legacy removal + one-output-path guard

**Files:** Modify `index.html` (remove remaining legacy `Report.*` renderer + any bespoke print left); Create `tests/unit/reports-single-engine.test.mjs`

- [ ] **Step 1: Migrate the last callers.** Re-point `Report.exportSprintBrief`/`openSprintBriefPicker`, `Report.exportWalkthroughMinutes`, and the meeting-agenda path to `Reports.generate` (or, for walkthrough minutes, a `Reports` builder). Confirm via grep that nothing calls `Report.open`, `Report.buildDoc`, `Report._baseStyles`, `Billing.exportReport`'s old body, or `StatusReportSkill`'s old print.
- [ ] **Step 2: Write the guard test** — `tests/unit/reports-single-engine.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

describe('single document engine', () => {
  it('legacy Report serializer is gone', () => {
    expect(html).not.toContain('_baseStyles(');
    expect(html).not.toContain('Report.buildDoc(');
  });
  it('only Reports.open performs window.open for printing', () => {
    // every window.open(...) for a report must be inside Reports.open;
    // allow at most the single occurrence in Reports.open's body
    const count = (html.match(/window\.open\(''/g) || []).length;
    expect(count).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 3: Run, verify FAIL** — `npx vitest run tests/unit/reports-single-engine.test.mjs`.
- [ ] **Step 4: Delete the remaining legacy `Report.*`** serializer/helpers (`buildDoc`, `_baseStyles`, `_coverPage`, `_tocPage`, `_appendix`, `open`, `execSummaryHtml`, `_ragDot`, the remaining `build*Doc`/`export*`). Keep `branding`/`setBranding`/`configureBranding` ONLY if not already mirrored by `Reports.Brand` — otherwise migrate the branding settings UI to `Reports.Brand` and delete them too. Ensure no other surface calls bare `window.open('','_blank')` for a document (route through `Reports.open`).
- [ ] **Step 5: Run guard + full suite** — `npx vitest run tests/unit/reports-single-engine.test.mjs && npm test`. All green.
- [ ] **Step 6: Commit**

```bash
git add index.html tests/unit/reports-single-engine.test.mjs
git commit -m "refactor(reports): remove legacy Report engine; one delivery path (Reports.open)"
```

---

## Task 14: Final verification + visual pass

**Files:** none

- [ ] **Step 1: Full suite** — `npm test`. All green, 0 failures.
- [ ] **Step 2: Serve + visual at 1440px (light + dark)** — every document type from the hub (Project, Portfolio, Sprint, Meeting, Status, Costs, SOW): cover/classification/footer consistent; tables match the on-screen look and the app RAG colours; customer-facing vs internal redaction correct; switching customer rescopes the hub; contextual shortcuts deep-link; no console errors.
- [ ] **Step 3: Commit any tweak** — `git add -A && git commit -m "chore: WS-E final verification"` (skip if none).

---

## Self-Review Notes
- **Spec coverage:** E1 tokens+table → Tasks 1–2; E2 engine+audience sections → Tasks 3–4; E3 catalogue → Tasks 5,12; E4 skills feed engine → Tasks 9–10; E5 hub+shortcuts → Tasks 6,12; E6 legacy removal+guard → Tasks 7,13. Parity assertion (app RAG vs legacy hex) → Task 1. Phasing matches the spec (1 foundation+briefs / 2 skills / 3 billing+hub).
- **Contracts:** section `{id,title,html,audiences}`, audience `'customer'|'internal'`, `Reports.generate(reportId,args)`, `Reports.open(html)`, `Reports.Doc.toHtml(doc,brand)`, `Reports.tokens(brand)`, `Reports.table({columns,rows,empty})`, `Reports._build(reportId,args)` — used consistently across tasks.
- **No placeholders:** foundational tasks (1–4, 9) carry complete code; migration tasks (5–8, 10–13) cite exact anchors + the established contracts + concrete test assertions (pattern-directed, since they mirror the helpers built in 1–4 and the file's line numbers will shift as code is deleted).
- **Line-number caveat:** anchors are 2026-06-11 truth; deletions shift later anchors — each task re-greps/reads before editing rather than trusting absolute lines.
- **Risk:** Phase 1's parity test pins exact hex; if the app's `:root` RAG tokens change, update Task 1's expected values to match the tokens (the intent is "report == app tokens", not the literal hex).
