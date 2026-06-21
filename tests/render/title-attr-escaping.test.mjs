// Hardening L1 (escaping/XSS) — free-text title="…" sinks app-wide (H-006).
// Same class as the Strategy/Personas sinks: a project / member / RAID name or
// description carrying a double-quote could break out of a tooltip attribute
// and inject a live handler. This pins the Gantt pipeline fragment (a pure,
// export-safe function used by the report packs) at the DOM level.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

const HOSTILE = '" onmouseover="window.__xss=1';

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('Gantt pipeline — free-text title escaping (L1/H-006)', () => {
  it('a quote in a project name cannot break out of the pipeline label/bar titles', () => {
    const { Gantt, document } = app;
    const project = makeProject({
      name: HOSTILE,
      start_date: '2026-01-01',
      target_date: '2026-03-01',
    });

    const frag = document.createElement('div');
    frag.innerHTML = Gantt.pipelineHtml([project]);

    // The month-header row also has an (empty) .gp-label; the project row's
    // label lives inside .gp-row, so scope the query there.
    const label = frag.querySelector('.gp-row .gp-label');
    expect(label).toBeTruthy();
    expect(label.getAttribute('onmouseover')).toBe(null);
    expect(label.getAttribute('title')).toBe(HOSTILE);

    const bar = frag.querySelector('.gp-row .gp-bar');
    expect(bar).toBeTruthy();
    expect(bar.getAttribute('onmouseover')).toBe(null);
    // title is "<name>: <start> to <target>" — hostile name encoded inside.
    expect(bar.getAttribute('title')).toContain(HOSTILE);
  });
});
