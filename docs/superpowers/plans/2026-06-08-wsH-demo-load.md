# Workstream H — Demo Dataset Loads Inline (file:// safe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Explore with sample data" / "Load demo dataset" button work when `index.html` is opened directly via `file://`, by embedding the demo dataset inline and reading it before falling back to `fetch()`.

**Architecture:** Add a `<script type="application/json" id="demoDataset">` data island containing `portfolio-data-demo.json` verbatim; `App.loadDemoData()` parses that inline block first (synchronous, no network), falling back to the existing `fetch()` for served deployments. A sync-test keeps the inline copy equal to the JSON file.

**Tech Stack:** Vanilla single-file `index.html`; vitest + jsdom; Playwright. No build step.

**Conventions:** no emojis; `Dashboard.esc` n/a (data island is JSON, not user HTML). Run tests: `npm test`; single file `npx vitest run tests/<f>`.

---

## File Structure

- **Modify:** `index.html` — add the `#demoDataset` island before `</body>` (~line 37858); rewrite `App.loadDemoData()` (~line 7185).
- **Create test:** `tests/unit/demo-dataset-inline.test.mjs` (sync deep-equal + load-path).

---

## Task 1: Embed inline island + inline-first loadDemoData

**Files:** Modify `index.html`; Create `tests/unit/demo-dataset-inline.test.mjs`

- [ ] **Step 1: Write the failing tests** — create `tests/unit/demo-dataset-inline.test.mjs`:

```javascript
// WS-H: demo dataset is embedded inline so the demo loads under file:// (no fetch),
// and the inline copy stays in sync with portfolio-data-demo.json.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadApp } from '../harness/loadApp.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function extractInlineDemo() {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const m = html.match(/<script type="application\/json" id="demoDataset">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('demoDataset island not found');
  return JSON.parse(m[1]);
}

describe('WS-H inline demo dataset', () => {
  it('inline #demoDataset deep-equals portfolio-data-demo.json', () => {
    const inline = extractInlineDemo();
    const file = JSON.parse(readFileSync(join(root, 'portfolio-data-demo.json'), 'utf8'));
    expect(inline).toEqual(file);
  });

  it('loadDemoData loads from the inline island without fetch', async () => {
    const app = await loadApp({ projects: [], customers: [], team_members: [], sprints: [] });
    // Clear any seeded data, and make fetch throw so only the inline path can succeed.
    app.App.data = null;
    const realFetch = app.window.fetch;
    app.window.fetch = () => Promise.reject(new Error('fetch blocked (simulating file://)'));
    if (typeof globalThis !== 'undefined') { /* jsdom routes window.fetch */ }
    app.App.loadDemoData();
    // Inline path is synchronous — data should be populated immediately.
    expect(app.App.data).toBeTruthy();
    expect((app.App.data.projects || []).length).toBeGreaterThan(0);
    app.window.fetch = realFetch;
    app.teardown();
  });
});
```

Note: if `app.window.fetch` isn't the reference the app uses (the app calls bare `fetch(...)`, which resolves to the jsdom global), set the global the app sees — check `loadApp`/jsdom: it may be `app.window.fetch`, `globalThis.fetch`, or `app.fetch`. Use whatever makes `fetch('…')` inside the app reject. The behavioural assertion is: after `loadDemoData()`, `App.data` is populated **synchronously** (only possible via the inline path). If you cannot reliably force-reject fetch in the harness, instead assert that `App.data` is populated synchronously right after the call (the inline path sets it before any awaited fetch could resolve) — that alone proves the inline path ran.

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run tests/unit/demo-dataset-inline.test.mjs`. Expect: island not found (extract throws) + load-path fails (old code only fetches).

- [ ] **Step 3: Add the empty island.** In `index.html`, immediately before `</body>` (~line 37858), insert:

```html
<script type="application/json" id="demoDataset"></script>
```

- [ ] **Step 4: Populate the island from the JSON file** with a one-off node script (run it, then delete it — do NOT commit the script). The script reads `portfolio-data-demo.json` and injects its exact text between the island tags:

```bash
node -e '
const fs = require("fs");
const demo = fs.readFileSync("portfolio-data-demo.json", "utf8").trim();
let html = fs.readFileSync("index.html", "utf8");
const open = "<script type=\"application/json\" id=\"demoDataset\"></script>";
if (html.indexOf(open) < 0) { console.error("placeholder not found"); process.exit(1); }
if (demo.indexOf("</script") >= 0) { console.error("demo JSON contains </script — needs escaping"); process.exit(1); }
html = html.replace(open, "<script type=\"application/json\" id=\"demoDataset\">\n" + demo + "\n</script>");
fs.writeFileSync("index.html", html);
console.log("island populated, " + demo.length + " bytes");
'
```

(If the guard reports `</script` present in the demo JSON, STOP and report — it would need HTML-escaping; the current demo data does not contain it.)

- [ ] **Step 5: Rewrite `loadDemoData`.** Replace the entire `App.loadDemoData() { … }` method (~line 7185) with:

```javascript
  loadDemoData() {
    // Prefer the inline data island so the demo works from a double-clicked file:// page
    // (browsers block fetch() of local files). Fall back to fetch for served deployments
    // or if the inline block is ever absent/unparseable.
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
  },
```

- [ ] **Step 6: Run the tests, verify PASS** — `npx vitest run tests/unit/demo-dataset-inline.test.mjs`. Both pass (island found + deep-equals; inline load populates data synchronously).

- [ ] **Step 7: Confirm the one-off script is gone** — `git status` shows only `index.html` + the new test modified/added (no stray `.js` populate script). The island is committed inside index.html.

- [ ] **Step 8: Regression** — `npx vitest run`. Expect green (the larger index.html is fine; jsdom parses the island as inert).

- [ ] **Step 9: Commit**

```bash
git add index.html tests/unit/demo-dataset-inline.test.mjs
git commit -m "fix(demo): embed demo dataset inline so it loads under file:// (fetch fallback)"
```

---

## Task 2: Verification

**Files:** none (verification only)

- [ ] **Step 1: Full suite** — `npm test`. Expect all green, 0 failures.

- [ ] **Step 2: file:// verification (the actual bug).** Open the file directly (no server):

```bash
open "file:///Users/zaza/Documents/Projects/portfolio-command-centre/index.html"
```

(or load that `file://` URL in the browser tool). On the first-run screen, click **Explore with sample data** → the demo loads (14 projects), the success toast shows "Loaded demo dataset (14 projects)", and there is NO "Demo dataset failed to load" error and NO failed network request in the console. Navigate a couple of views to confirm data is present.

- [ ] **Step 3: served verification.** Also serve it and confirm the demo still loads (inline path used; fetch is just the fallback):

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```
Load `http://127.0.0.1:8765/index.html` → Explore with sample data → loads cleanly.

- [ ] **Step 4: Final commit if a tweak was needed** — `git add -A && git commit -m "chore: WS-H verification pass"` (skip if none).

---

## Self-Review Notes

- **Spec coverage:** H1 inline island → Task 1 Steps 3-4; H2 inline-first loadDemoData → Task 1 Step 5; H3 sync-test → Task 1 Step 1 (deep-equal test). All covered.
- **No placeholders:** the populate step is a complete runnable one-off script (then deleted); loadDemoData is complete code.
- **Sync guard:** the deep-equal test fails if the inline copy and the JSON file diverge — the no-build substitute for a generator.
- **Test-harness caveat:** the load-path test notes how to force-reject fetch / or fall back to asserting synchronous population; either proves the inline path runs.
- **`</script>` safety:** the populate script guards against a `</script` sequence in the demo JSON (would need escaping); current demo data has none.
