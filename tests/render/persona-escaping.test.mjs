// Hardening L1 (escaping/XSS) — attribute contexts must use escAttr, not esc.
// esc() (textContent->innerHTML) encodes < > & but NOT quotes, so free-text
// values interpolated into a double-quoted attribute can break out and inject a
// live event handler (stored XSS via imported/model-authored data). These tests
// parse the rendered fragment with jsdom and assert the hostile value stays
// inside the title attribute rather than becoming its own attribute.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

const HOSTILE = '" onmouseover="window.__xss=1';

describe('Personas table — attribute escaping (L1)', () => {
  it('a quote in a persona definition cannot break out of the title attribute', () => {
    const { Personas, document } = app;
    const persona = makePersona({ name: 'CFO', definition: HOSTILE });

    const frag = document.createElement('div');
    frag.innerHTML = Personas._renderRichTable([persona]);

    const def = frag.querySelector('.persona-tbl-def');
    expect(def).toBeTruthy();
    // The injected handler did NOT become a real attribute…
    expect(def.getAttribute('onmouseover')).toBe(null);
    // …and the raw value is preserved, intact, inside the title.
    expect(def.getAttribute('title')).toBe(HOSTILE);
  });

  it('escAttr (not esc) is what makes the title safe — esc would leave the quote raw', () => {
    const { Dashboard } = app;
    // Guard the underlying contract so a future refactor cannot regress silently.
    expect(Dashboard.esc(HOSTILE)).toContain('"');            // esc keeps quotes
    expect(Dashboard.escAttr(HOSTILE)).not.toContain('"');     // escAttr encodes them
    expect(Dashboard.escAttr(HOSTILE)).toContain('&quot;');
  });
});
