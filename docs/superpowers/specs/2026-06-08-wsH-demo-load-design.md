# Workstream H — Demo dataset loads inline (file:// safe) — design

**Date:** 2026-06-08
**Branch:** `wsH-demo-load`
**Context:** User report — "demo dataset failed to load - some issues loading the sample json." Root cause: `App.loadDemoData()` does `fetch('portfolio-data-demo.json')`, which browsers block when the single-file app is opened directly via `file://` (its primary "no-infrastructure, open in any browser" distribution model). The button then shows the existing toast *"Demo dataset failed to load: …"*. Fix: embed the demo data inline so the demo loads with no network, with the existing `fetch()` kept as a fallback for served deployments.

**Decisions (from brainstorming):** embed inline + fetch fallback; add a sync-test so the inline copy can't drift from `portfolio-data-demo.json`.

**Scope:** Single-file `index.html` + a new test. No build step. No emojis. Gated by `npm test`.

## H1 — Embed the demo dataset inline

Add, inside `<body>` (e.g. immediately before the main application `<script>` block, or anywhere in body), a non-executing data island:

```html
<script type="application/json" id="demoDataset">
{ …full contents of portfolio-data-demo.json… }
</script>
```

- `type="application/json"` means the browser does not execute it; it's read via `textContent`.
- The content is the verbatim contents of `portfolio-data-demo.json` (64 KB). The JSON is controlled/known data; it contains no `</script>` sequence (verify during implementation — if any string did, it would need escaping, but the demo data does not).
- `portfolio-data-demo.json` remains in the repo as the source of truth and the served-fetch fallback.

## H2 — `loadDemoData` reads inline first, falls back to fetch

Rewrite `App.loadDemoData()` to:
1. Read `document.getElementById('demoDataset')`; if present and its `textContent` parses as JSON, use that object → `validateAndLoad` → on success `markClean()` + success toast. This path is synchronous and works under `file://` (no network).
2. If the inline block is missing/empty or `JSON.parse` throws, fall back to the existing `fetch('portfolio-data-demo.json')` promise chain (unchanged), with its existing success/error toasts.
3. Preserve the existing error toast (*"Demo dataset failed to load: …"*) for the case where both inline and fetch fail.

Concretely:

```javascript
loadDemoData() {
  // Prefer the inline data island so the demo works from a double-clicked file:// page
  // (browsers block fetch() of local files). Fall back to fetch for served deployments
  // or if the inline block is ever absent.
  const el = document.getElementById('demoDataset');
  if (el && el.textContent && el.textContent.trim()) {
    try {
      const data = JSON.parse(el.textContent);
      const ok = this.validateAndLoad(data);
      if (ok) {
        if (typeof this.markClean === 'function') this.markClean();
        this.toast('Loaded demo dataset (' + (this.data.projects || []).length + ' projects)', 'success');
      }
      return;
    } catch (e) { /* fall through to fetch */ }
  }
  fetch('portfolio-data-demo.json')
    .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
    .then(data => {
      const ok = this.validateAndLoad(data);
      if (ok) {
        if (typeof this.markClean === 'function') this.markClean();
        this.toast('Loaded demo dataset (' + (this.data.projects || []).length + ' projects)', 'success');
      }
    })
    .catch(err => {
      this.toast('Demo dataset failed to load: ' + (err && err.message ? err.message : err), 'error');
    });
}
```

## H3 — Sync guard (no build step)

Add a unit test that reads BOTH the inline `#demoDataset` JSON (extracted from `index.html`) and `portfolio-data-demo.json`, parses each, and asserts they are **deep-equal**. This fails CI if the two ever drift, so any future change to the demo data must update both. (The test extracts the inline block from the `index.html` text by locating `<script type="application/json" id="demoDataset">` … `</script>` and parsing the inner text.)

## Testing

- **Unit (sync):** inline `#demoDataset` parses and deep-equals `portfolio-data-demo.json`.
- **Unit (load path):** with the app booted (jsdom) and `App.data` cleared, calling `App.loadDemoData()` loads the demo from the inline block **without any fetch** (the jsdom harness has no real server) — assert `App.data.projects.length > 0` synchronously after the call. (This both proves the inline path works and would have failed before the fix, since the old code only fetched.)
- **In-browser:** open `index.html` directly via `file://` (double-click) → "Explore with sample data" loads the demo (14 projects), no console/network error. Also confirm it still works when served.

## Out of scope

- No change to `validateAndLoad`, the sample data content, or `portfolio-data.json` (the separate first-load sample).
- No build/bundling step (the app is intentionally build-free; the sync-test substitutes for a generator).
- D (RAID), E (Reports/packs) — their own workstreams.
