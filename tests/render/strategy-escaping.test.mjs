// Hardening L1 (escaping/XSS) — Strategy attribute contexts must use escAttr,
// not esc. esc() (textContent->innerHTML) encodes < > & but NOT quotes, so a
// free-text value (objective description, metric definition, persona / person
// name) interpolated into a double-quoted title="…" can break out and inject a
// live event handler (stored XSS via imported / model-authored strategy data).
// These tests render the real production fragments under jsdom and assert the
// hostile value stays inside the title attribute rather than becoming its own.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, makePersona, makeObjective, resetIdSeq } from '../harness/fixtures.mjs';

let app;

const HOSTILE = '" onmouseover="window.__xss=1';

afterEach(() => app && app.teardown());

describe('Strategy tables — attribute escaping (L1)', () => {
  it('a quote in an objective description cannot break out of the title attribute', async () => {
    resetIdSeq();
    app = await loadApp(makeDataset());
    app.App.activeCustomer = 'Acme Industries';
    const { Objectives, document } = app;

    const col = Objectives.COLUMNS.find(c => c.id === 'description');
    expect(col).toBeTruthy();
    const frag = document.createElement('div');
    frag.innerHTML = col.render(makeObjective({ description: HOSTILE }));

    const span = frag.querySelector('.objective-description');
    expect(span).toBeTruthy();
    expect(span.getAttribute('onmouseover')).toBe(null);
    expect(span.getAttribute('title')).toBe(HOSTILE);
  });

  it('a quote in a metric definition / persona name cannot break out of the metric table', async () => {
    resetIdSeq();
    const persona = makePersona({ name: HOSTILE });
    const metric = makeMetric({
      definition: HOSTILE,
      raci_defaults: { accountable: [persona.id], responsible: [], consulted: [], informed: [] },
    });
    app = await loadApp(makeDataset({ metrics: [metric], personas: [persona] }));
    app.App.activeCustomer = 'Acme Industries';
    const { Metrics, document } = app;

    const frag = document.createElement('div');
    frag.innerHTML = Metrics.renderInventoryTab();

    // metric definition sink (13955)
    const def = frag.querySelector('.metric-definition');
    expect(def).toBeTruthy();
    expect(def.getAttribute('onmouseover')).toBe(null);
    expect(def.getAttribute('title')).toBe(HOSTILE);

    // persona-template RACI pill sink (13929) — default view is persona
    const pill = frag.querySelector('.raci-pill-template');
    expect(pill).toBeTruthy();
    expect(pill.getAttribute('onmouseover')).toBe(null);
    // title is "<name> (persona — role archetype)" — the hostile name must be
    // encoded so it cannot terminate the attribute early.
    expect(pill.getAttribute('title')).toContain(HOSTILE);
  });

  it('escAttr (not esc) is what makes the title safe', async () => {
    resetIdSeq();
    app = await loadApp(makeDataset());
    const { Dashboard } = app;
    expect(Dashboard.esc(HOSTILE)).toContain('"');             // esc keeps quotes raw
    expect(Dashboard.escAttr(HOSTILE)).not.toContain('"');      // escAttr encodes them
    expect(Dashboard.escAttr(HOSTILE)).toContain('&quot;');
  });
});
