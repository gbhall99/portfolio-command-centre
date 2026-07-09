// Risk-adjusted commercials (sow-risk-quote): Forecast velocity bands price the
// billable effort at P50/P80/P95, the contingency reserve is the P80−P50 gap,
// bands ride the stored quote so quoteIsStale keeps working, figuresCheck accepts
// the band figures, and the quoted set can gate approval on it. All model-free.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, resetIdSeq } from '../harness/fixtures.mjs';

// Deterministic RNG so band tests don't flake.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A history project whose skill_splits over PAST sprints give a spread of
// distinct completion ratios (1.0 → 0.3) so the effort distribution has a
// differentiated tail (P50 < P80 < P95).
function historyProject() {
  const completed = [20, 18, 16, 14, 12, 10, 8, 6];   // ratios 1.0,0.9,…,0.3 on 20 committed
  return makeProject({
    id: 'H-1', name: 'History', customer: 'Acme Industries', status: 'Complete',
    size_engineering: 160,
    skill_splits: {
      size_engineering: completed.map((c, i) => ({ sprint: 'CY26-S' + (i + 1), points: 20, completed: c, status: 'in_progress' }))
    }
  });
}

const billingSettings = { billing: { currency: 'USD', hours_per_point: 8, rate_table: { 'United Kingdom': { Consultant: 100 } }, customer_defaults: { 'Acme Industries': { country: 'United Kingdom', level: 'Consultant' } } } };

let app;
beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [
      makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', size_engineering: 10 }),
      historyProject()
    ],
    sprints: makeSprintSequence(8, '2023-01-02'),   // all in the past
    settings: billingSettings
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('Forecast.effortPointBands', () => {
  it('produces an ordered P50 < P80 < P95 effort band from velocity reliability', () => {
    const { Forecast } = app;
    const bands = Forecast.effortPointBands('Acme Industries', 10, { rng: mulberry32(7) });
    expect(bands.insufficient).toBe(false);
    expect(bands.completed_sprints).toBe(8);
    expect(bands.p50).toBeLessThan(bands.p80);
    expect(bands.p80).toBeLessThan(bands.p95);
    // Effort is at least the planned scope (reliability ≤ 1 inflates effort).
    expect(bands.p50).toBeGreaterThanOrEqual(10);
  });

  it('honestly reports insufficient history below MIN_HISTORY', async () => {
    // Fresh app with no completed-sprint history.
    const bare = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries' }],
      projects: [makeProject({ id: 'A-1', customer: 'Acme Industries', size_engineering: 10 })],
      settings: billingSettings
    }));
    try {
      const bands = bare.Forecast.effortPointBands('Acme Industries', 10, { rng: mulberry32(1) });
      expect(bands.insufficient).toBe(true);
      expect(bands.p80).toBeUndefined();
    } finally { bare.teardown(); }
  });
});

describe('Billing.quoteWithBands', () => {
  it('prices the bands and sets the contingency reserve to P80 − P50', () => {
    const { Billing, App } = app;
    const project = App.data.projects.find(p => p.id === 'A-1');
    const quote = Billing.quoteWithBands(project, { rng: mulberry32(7), applied: true });
    // Totals are unchanged from the point quote (10 SP × 8h × $100).
    expect(quote.totals.amount).toBe(10 * 8 * 100);
    const b = quote.bands;
    expect(b.insufficient).toBe(false);
    expect(b.base_amount).toBe(b.p50_amount);
    expect(b.confidence).toBe('p80');
    expect(b.contingency_amount).toBe(b.p80_amount - b.p50_amount);
    expect(b.confidence_amount).toBe(b.p80_amount);
    expect(b.p50_amount).toBeLessThanOrEqual(b.p80_amount);
  });

  it('falls back to the point quote when history is insufficient', async () => {
    const bare = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries' }],
      projects: [makeProject({ id: 'A-1', customer: 'Acme Industries', size_engineering: 10 })],
      settings: billingSettings
    }));
    try {
      const project = bare.App.data.projects.find(p => p.id === 'A-1');
      const quote = bare.Billing.quoteWithBands(project);
      expect(quote.bands.insufficient).toBe(true);
      expect(quote.totals.amount).toBe(10 * 8 * 100);
    } finally { bare.teardown(); }
  });
});

describe('bands ride the stored quote — quoteIsStale still works', () => {
  it('setQuote stores bands but staleness tracks the point totals', () => {
    const { Sow } = app;
    const def = app.Definitions.loadJson('sow-quoted/sow-definition.json');
    const sow = Sow.create({ customer: 'Acme Industries', project_id: 'A-1', definition: def, generatedSections: [], name: 'Q', source_text: 's' });
    const res = Sow.setQuote(sow.id);
    expect(res.ok).toBe(true);
    const stored = Sow.get(sow.id).quote;
    expect(stored.bands).toBeTruthy();
    expect(stored.bands.insufficient).toBe(false);       // history present
    expect(Sow.quoteIsStale(Sow.get(sow.id))).toBe(false);
    // Growing the project sizing drifts the point quote → stale, regardless of bands.
    app.App.data.projects.find(p => p.id === 'A-1').size_engineering = 25;
    expect(Sow.quoteIsStale(Sow.get(sow.id))).toBe(true);
    Sow.setQuote(sow.id);
    expect(Sow.quoteIsStale(Sow.get(sow.id))).toBe(false);
  });
});

describe('figuresCheck accepts band figures', () => {
  it('a band amount in the document traces; an unrelated amount does not', () => {
    const { Sow, Billing } = app;
    const def = app.Definitions.loadJson('sow-quoted/sow-definition.json');
    const sow = Sow.create({ customer: 'Acme Industries', project_id: 'A-1', definition: def, generatedSections: [], name: 'Q', source_text: 's' });
    Sow.setQuote(sow.id);
    const got = Sow.get(sow.id);
    const band = got.quote.bands.confidence_amount;
    const sec = got.sections.find(s => s.id === 'executive_summary');
    sec.content = 'The contingency-inclusive price is ' + Billing.fmtMoney(band) + ' and an unrelated figure of $987654.';
    const flags = Sow.figuresCheck(got);
    expect(flags.some(f => f.amount.replace(/[^0-9]/g, '') === String(band))).toBe(false);   // band traces
    expect(flags.some(f => /987654/.test(f.amount))).toBe(true);                              // unrelated flagged
  });
});

describe('contingency_priced approval gate', () => {
  function fullQuotedSow() {
    const def = app.Definitions.loadJson('sow-quoted/sow-definition.json');
    const filler = Array.from({ length: 45 }, (_, i) => 'w' + i).join(' ');
    const sow = app.Sow.create({
      customer: 'Acme Industries', project_id: 'A-1', definition: def,
      generatedSections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true, phases: s.id === 'deliverables' ? ['Data Engineering'] : [] })),
      name: 'Quoted', source_text: 'src'
    });
    app.Sow.get(sow.id).sections.forEach(s => { s.flagged = false; });
    return { sow: app.Sow.get(sow.id), def };
  }

  it('blocks approval when bands are available but risk pricing is not applied, then clears on apply', () => {
    const { Sow } = app;
    const { sow, def } = fullQuotedSow();
    Sow.setQuote(sow.id);                                  // bands sufficient, not applied
    let v = Sow.validate(Sow.get(sow.id), def);
    expect(v.errors.some(e => /Risk-adjusted commercials are available but not applied/.test(e))).toBe(true);
    // Apply the contingency pricing → gate clears.
    expect(Sow.setQuoteMode(sow.id, true).ok).toBe(true);
    v = Sow.validate(Sow.get(sow.id), def);
    expect(v.errors.some(e => /Risk-adjusted commercials/.test(e))).toBe(false);
    Sow.setStatus(sow.id, 'Review', def);
    Sow.get(sow.id).sections.forEach(s => { s.flagged = false; });
    expect(Sow.setStatus(sow.id, 'Approved', def).ok).toBe(true);
  });

  it('passes through honestly when history is insufficient (point estimate accepted)', async () => {
    const bare = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries' }],
      projects: [makeProject({ id: 'A-1', customer: 'Acme Industries', size_engineering: 10 })],
      settings: billingSettings
    }));
    try {
      const { Sow } = bare;
      bare.App.activeCustomer = 'Acme Industries';
      const def = bare.Definitions.loadJson('sow-quoted/sow-definition.json');
      const filler = Array.from({ length: 45 }, (_, i) => 'w' + i).join(' ');
      const sow = bare.Sow.create({
        customer: 'Acme Industries', project_id: 'A-1', definition: def,
        generatedSections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true, phases: s.id === 'deliverables' ? ['Data Engineering'] : [] })),
        name: 'Quoted', source_text: 'src'
      });
      bare.Sow.get(sow.id).sections.forEach(s => { s.flagged = false; });
      Sow.setQuote(sow.id);
      expect(Sow.get(sow.id).quote.bands.insufficient).toBe(true);
      const v = Sow.validate(Sow.get(sow.id), def);
      expect(v.errors.some(e => /Risk-adjusted commercials/.test(e))).toBe(false);
      Sow.setStatus(sow.id, 'Review', def);
      Sow.get(sow.id).sections.forEach(s => { s.flagged = false; });
      expect(Sow.setStatus(sow.id, 'Approved', def).ok).toBe(true);
    } finally { bare.teardown(); }
  });
});
