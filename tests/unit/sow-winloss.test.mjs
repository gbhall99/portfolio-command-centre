// sow-winloss — win/loss + quoted-vs-actual calibration loop. Approved SoWs
// carry an additive outcome; completed linked projects yield per-skill
// quoted-vs-actual variance; the aggregate calibration factor is offered as a
// VISIBLE, TOGGLEABLE quote line (never auto-applied); recurring loss reasons
// land as AgentMemory facts. AI only narrates the variance. Mock adapter only.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, resetIdSeq } from '../harness/fixtures.mjs';

let app;

const billingSettings = {
  billing: {
    currency: 'GBP', hours_per_point: 8, target_margin_pct: 30,
    rate_table: { 'United Kingdom': { Consultant: 100 } },
    customer_defaults: { 'Acme Industries': { country: 'United Kingdom', level: 'Consultant' } }
  }
};

function fixture() {
  resetIdSeq();
  return makeDataset({
    projects: [makeProject({
      id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', status: 'Complete',
      size_engineering: 10, size_requirements: 0, size_tableau: 0,
      // Delivered 12 SP of engineering vs 10 quoted → we under-quoted by 20%.
      skill_splits: { size_engineering: [{ sprint: 'CY26-S1', points: 12, completed: 12, status: 'complete', assigned_to: [], reasons: [] }] }
    })],
    sprints: makeSprintSequence(4, '2026-01-05'),
    settings: billingSettings
  });
}

// Create an Approved SoW linked to A-1 with a quote captured while the project
// was sized at 10 SP engineering.
function approvedSow(a) {
  const def = a.Definitions.loadJson('sow/sow-definition.json');
  const filler = Array.from({ length: 45 }, (_, i) => 'word' + i).join(' ');
  const sow = a.Sow.create({
    customer: 'Acme Industries', project_id: 'A-1', definition: def,
    generatedSections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true, phases: s.id === 'deliverables' ? ['Data Engineering'] : [] })),
    name: 'Alpha SoW', source_text: 'src'
  });
  a.Sow.setQuote(sow.id);
  a.Sow.get(sow.id).sections.forEach(s => { s.flagged = false; s.flag_reason = ''; });
  a.Sow.setStatus(sow.id, 'Review', def);
  a.Sow.get(sow.id).sections.forEach(s => { s.flagged = false; s.flag_reason = ''; });
  const r = a.Sow.setStatus(sow.id, 'Approved', def);
  expect(r.ok).toBe(true);
  return a.Sow.get(sow.id);
}

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('outcome capture (additive)', () => {
  it('records won/lost/no-decision + reason, undoably', () => {
    const { Sow, App } = app;
    const sow = approvedSow(app);
    expect(sow.outcome).toBe(null);
    const r = Sow.setOutcome(sow.id, { result: 'won', reason_code: 'value', reason_text: 'Strong ROI story' });
    expect(r.ok).toBe(true);
    expect(Sow.get(sow.id).outcome.result).toBe('won');
    expect(Sow.get(sow.id).outcome.reason_text).toBe('Strong ROI story');
    App.undo();
    expect(Sow.get(sow.id).outcome).toBe(null);
  });

  it('rejects an unknown result', () => {
    const { Sow } = app;
    const sow = approvedSow(app);
    expect(Sow.setOutcome(sow.id, { result: 'maybe' }).ok).toBe(false);
  });

  it('escapes a double-quote in the reason fields (no attribute-injection XSS)', () => {
    const { Sow, SowSkill } = app;
    const sow = approvedSow(app);
    const evil = 'x" autofocus onfocus="alert(1)';
    Sow.setOutcome(sow.id, { result: 'lost', reason_code: evil, reason_text: evil });
    const html = SowSkill._outcomeHtml(Sow.get(sow.id));
    // The raw double-quote must be entity-escaped so it cannot break out of value="…".
    expect(html).not.toContain('value="x" autofocus onfocus="alert(1)"');
    expect(html).toContain('&quot;');
    expect(html).not.toContain('onfocus="alert(1)"');
  });
});

describe('quoted-vs-actual variance arithmetic', () => {
  it('computes per-skill variance from quote lines vs delivered points', () => {
    const { Sow } = app;
    const sow = approvedSow(app);
    const qva = Sow.quotedVsActual(sow);
    expect(qva.ok).toBe(true);
    const eng = qva.lines.find(l => l.skill === 'size_engineering');
    expect(eng.quoted).toBe(10);
    expect(eng.actual).toBe(12);
    expect(eng.variance).toBe(2);
    expect(eng.variance_pct).toBeCloseTo(0.2, 5);
  });

  it('aggregates a per-customer calibration factor from completed projects', () => {
    const { Sow } = app;
    approvedSow(app);
    const calib = Sow.calibration('Acme Industries');
    const eng = calib.skills.find(s => s.skill === 'size_engineering');
    expect(eng.n).toBe(1);
    expect(eng.factor).toBeCloseTo(1.2, 5);
    expect(eng.variance_pct).toBeCloseTo(0.2, 5);
    expect(Sow.calibrationSummary('Acme Industries').some(t => /Data Engineering quotes run 20% under/.test(t))).toBe(true);
  });
});

describe('calibration factor is a visible toggle, never auto-applied', () => {
  it('setQuote stores the plain quote; the adjustment is a separate, opt-in line', () => {
    const { Sow, App } = app;
    approvedSow(app);
    // A fresh quote for the same project — the stored quote is the plain figure.
    const project = App.data.projects.find(p => p.id === 'A-1');
    const quote = app.Billing.quoteForProject(project);
    const base = quote.totals.amount;                       // 10 SP * 8h * £100 = £8000
    expect(base).toBe(8000);

    const adj = Sow.calibrationAdjustment('Acme Industries', quote);
    expect(adj).toBeTruthy();
    expect(adj.extra_points).toBe(2);                       // +20% on 10 billable SP
    expect(adj.extra_amount).toBe(2 * 8 * 100);
    expect(adj.adjusted_amount).toBe(base + adj.extra_amount);
    // The underlying quote is untouched by computing the adjustment.
    expect(quote.totals.amount).toBe(base);

    // The toggle is a display-only uiState flag — flipping it never mutates the quote.
    const key = 'sow.calibration.applied.Acme Industries';
    expect(App.uiStateGet(key, false)).toBe(false);
    App.uiStateSet(key, true);
    expect(app.Billing.quoteForProject(project).totals.amount).toBe(base);
  });
});

describe('loss reason → AgentMemory fact', () => {
  it('a lost outcome pins the reason as an ambient fact', () => {
    const { Sow, AgentMemory } = app;
    const sow = approvedSow(app);
    Sow.setOutcome(sow.id, { result: 'lost', reason_code: 'price', reason_text: 'Undercut on day rate' });
    const facts = AgentMemory.facts('Acme Industries');
    expect(facts.some(f => /Undercut on day rate/.test(f.text))).toBe(true);
  });

  it('a won outcome does not add a loss fact', () => {
    const { Sow, AgentMemory } = app;
    const sow = approvedSow(app);
    const before = AgentMemory.facts('Acme Industries').length;
    Sow.setOutcome(sow.id, { result: 'won', reason_text: 'good relationship' });
    expect(AgentMemory.facts('Acme Industries').length).toBe(before);
  });
});

describe('AI narrative (mock)', () => {
  it('narrates the calibration variance without inventing figures', async () => {
    const { Sow, SowSkill, AI } = app;
    approvedSow(app);
    AI.upsertProfile({ id: 'mp', name: 'Mock', adapter: 'mock', model: 'mock', toolMode: 'native' });
    AI.setDefaultProfile('mp');
    AI.ADAPTERS.mock.program([{ text: 'Data Engineering estimates have run about 20% light across recent work; lean higher on DE-heavy scopes.' }]);
    // Point the skill at a SoW so the narrative has a customer scope.
    SowSkill._sowId = Sow.list('Acme Industries')[0].id;
    await SowSkill.uiCalibrationNarrative();
    expect(SowSkill._calibNarr).toMatch(/20% light/);
  });
});
