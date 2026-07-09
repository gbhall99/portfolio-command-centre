// sow-exclusions-ledger — the out_of_scope section becomes a structured ledger
// of exclusion line items (kind:'exclusion' on the section items[], the same
// shape family as obligations). A matched request proposes a CHANGE ORDER
// pre-priced from Billing.quoteForProject at the customer's band, reusing the
// change_order record shape. Ledger, manual raise, priced skeleton and keyword
// match candidates are model-free; AI only classifies "is this inside #3?" and
// can never invent the price. Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

const billingSettings = {
  billing: {
    currency: 'GBP', hours_per_point: 8,
    rate_table: { 'United Kingdom': { Consultant: 100 } },
    customer_defaults: { 'Acme Industries': { country: 'United Kingdom', level: 'Consultant' } }
  }
};

function fixture() {
  resetIdSeq();
  return makeDataset({
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', size_engineering: 10 })],
    settings: billingSettings
  });
}

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function def(a) { return a.Definitions.loadJson('sow/sow-definition.json'); }

function makeSow(a, projectId) {
  const d = def(a);
  const filler = Array.from({ length: 30 }, (_, i) => 'word' + i).join(' ');
  return a.Sow.create({
    customer: 'Acme Industries', project_id: projectId || null, definition: d,
    generatedSections: d.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true, phases: s.id === 'deliverables' ? ['Data Engineering'] : [] })),
    name: 'Alpha SoW', source_text: 'src'
  });
}

describe('structured exclusion ledger + migration', () => {
  it('adds a structured exclusion on out_of_scope with a skill/size hint, undoably', () => {
    const { Sow, App } = app;
    const sow = makeSow(app, 'A-1');
    const res = Sow.addExclusion(sow.id, { text: 'Mobile app is out of scope', skill: 'size_tableau', size: 5 });
    expect(res.ok).toBe(true);
    const list = Sow.exclusions(Sow.get(sow.id));
    expect(list.length).toBe(1);
    expect(list[0].kind).toBe('exclusion');
    expect(list[0].skill).toBe('size_tableau');
    expect(list[0].size).toBe(5);
    // Lives on the out_of_scope section's items[].
    const sec = Sow.get(sow.id).sections.find(s => s.id === 'out_of_scope');
    expect(sec.items.length).toBe(1);
    App.undo();
    expect(Sow.exclusions(Sow.get(sow.id)).length).toBe(0);
  });

  it('exclusion items are migration-backfilled and do not leak into obligations()', () => {
    const { Sow } = app;
    const sow = makeSow(app, 'A-1');
    Sow.addExclusion(sow.id, { text: 'Data science model is excluded', skill: 'size_data_science', size: 3 });
    // out_of_scope items exist (migration guarantees the array).
    expect(Sow.get(sow.id).sections.every(s => Array.isArray(s.items))).toBe(true);
    // obligations() must not return exclusion items.
    expect(Sow.obligations(Sow.get(sow.id)).length).toBe(0);
  });

  it('an invalid skill hint is dropped (only Billing skill keys accepted)', () => {
    const { Sow } = app;
    const sow = makeSow(app, 'A-1');
    const res = Sow.addExclusion(sow.id, { text: 'Bogus', skill: 'not_a_skill', size: 5 });
    expect(res.item.skill).toBe('');
  });
});

describe('keyword match-candidate list (model-free)', () => {
  it('ranks exclusions by keyword overlap with a new request', () => {
    const { Sow } = app;
    const sow = makeSow(app, 'A-1');
    Sow.addExclusion(sow.id, { text: 'A mobile companion app for field engineers', skill: 'size_engineering', size: 8 });
    Sow.addExclusion(sow.id, { text: 'Forecasting via a data science model', skill: 'size_data_science', size: 4 });
    const cands = Sow.exclusionMatchCandidates(Sow.get(sow.id), 'Can we add a mobile app for the engineers?');
    expect(cands.length).toBeGreaterThan(0);
    // The mobile-app exclusion is the strongest keyword match.
    expect(cands[0].exclusion.text).toContain('mobile');
    expect(cands[0].overlap).toContain('mobile');
  });
});

describe('change order from exclusion — priced via Billing, confirm-gated, undoable', () => {
  it('prices the exclusion from Billing.quoteForProject at the customer band', () => {
    const { Sow, Billing } = app;
    const sow = makeSow(app, 'A-1');
    Sow.addExclusion(sow.id, { text: 'Extra engineering build', skill: 'size_engineering', size: 5 });
    const ex = Sow.exclusions(Sow.get(sow.id))[0];
    const price = Sow.exclusionPrice(Sow.get(sow.id), ex);
    // 5 SP × 8 hrs × £100 = £4000, priced GROSS (empty prepaid pools).
    const synth = { id: 'x', customer: 'Acme Industries', size_engineering: 5 };
    const expected = Billing.quoteForProject(synth, []).totals.amount;
    expect(price.amount).toBe(expected);
    expect(price.amount).toBe(4000);
  });

  it('createExclusionChangeOrder is confirm-gated (skeleton mutates nothing), the price is Billing-derived, and it is undoable', () => {
    const { Sow, App } = app;
    const sow = makeSow(app, 'A-1');
    Sow.addExclusion(sow.id, { text: 'Extra Tableau dashboard', skill: 'size_tableau', size: 3 });
    const ex = Sow.exclusions(Sow.get(sow.id))[0];

    // The skeleton is a pure preview — no new SoW created.
    const before = App.data.sows.length;
    const skel = Sow.exclusionChangeOrderSkeleton(Sow.get(sow.id), ex.id, { request: 'add a dashboard' });
    expect(skel.price.amount).toBe(2400);   // 3 × 8 × 100
    expect(App.data.sows.length).toBe(before);

    // Creating it is the confirmation.
    const r = Sow.createExclusionChangeOrder(sow.id, ex.id, { request: 'add a dashboard' });
    expect(r.ok).toBe(true);
    expect(r.sow.doc_type).toBe('change_order');
    expect(r.sow.parent_sow_id).toBe(sow.id);
    expect(r.sow.exclusion_ref).toBe(ex.id);
    // The stored change_delta figure is the Billing price, never model-written.
    expect(r.sow.change_delta.new_amount).toBe(2400);
    expect(App.data.sows.length).toBe(before + 1);

    App.undo();
    expect(App.data.sows.length).toBe(before);
  });

  it('refuses to price / create when the exclusion has no skill/size hint', () => {
    const { Sow } = app;
    const sow = makeSow(app, 'A-1');
    Sow.addExclusion(sow.id, { text: 'Vague exclusion, no sizing' });
    const ex = Sow.exclusions(Sow.get(sow.id))[0];
    expect(Sow.exclusionPrice(Sow.get(sow.id), ex)).toBe(null);
    const skel = Sow.exclusionChangeOrderSkeleton(Sow.get(sow.id), ex.id, {});
    expect(skel.price).toBe(null);
  });

  it('is unpriceable (null, not £0) when the customer has no rate band', () => {
    const { Sow, App } = app;
    // Clone settings first (the shared billingSettings fixture is not deep-copied
    // by loadApp), then strip the rate band so Billing returns £0 without throwing.
    App.data.settings = JSON.parse(JSON.stringify(App.data.settings));
    App.data.settings.billing.customer_defaults = {};
    App.data.settings.billing.rate_table = {};
    const sow = makeSow(app, 'A-1');
    Sow.addExclusion(sow.id, { text: 'Extra engineering', skill: 'size_engineering', size: 5 });
    const ex = Sow.exclusions(Sow.get(sow.id))[0];
    // Must degrade to "cannot be priced" rather than presenting £0 as a real figure.
    expect(Sow.exclusionPrice(Sow.get(sow.id), ex)).toBe(null);
    expect(Sow.exclusionChangeOrderSkeleton(Sow.get(sow.id), ex.id, {}).price).toBe(null);
  });
});

describe('agent tools — list_exclusions (read) + raise_exclusion_change_order (write)', () => {
  const ctx = (over) => Object.assign({ customer: 'Acme Industries', allScope: false, citations: [], proposals: [] }, over || {});

  it('list_exclusions returns priced exclusions, ranked by keyword overlap when `against` is given', () => {
    const { Sow, AgentTools } = app;
    const sow = makeSow(app, 'A-1');
    Sow.addExclusion(sow.id, { text: 'A mobile companion app', skill: 'size_engineering', size: 8 });
    Sow.addExclusion(sow.id, { text: 'Forecasting model', skill: 'size_data_science', size: 4 });
    const c = ctx();
    const res = AgentTools.invoke('list_exclusions', { against: 'mobile app please' }, c);
    expect(res.count).toBe(2);
    expect(res.exclusions[0].text).toContain('mobile');
    expect(res.exclusions[0].priced.amount).toBe(6400);   // 8 × 8 × 100
    expect(c.citations.some(x => x.type === 'sow' && x.id === sow.id)).toBe(true);
  });

  it('raise_exclusion_change_order returns a Billing-priced proposal; nothing mutates until apply()', () => {
    const { Sow, App, AgentTools } = app;
    const sow = makeSow(app, 'A-1');
    Sow.addExclusion(sow.id, { text: 'Extra engineering build', skill: 'size_engineering', size: 5 });
    const ex = Sow.exclusions(Sow.get(sow.id))[0];
    const c = ctx();
    const before = App.data.sows.length;
    const res = AgentTools.invoke('raise_exclusion_change_order', { sow_id: sow.id, exclusion_id: ex.id, request: 'add the extra build' }, c);
    expect(res.proposed).toBe(true);
    expect(c.proposals.length).toBe(1);
    // The commercial figure in the proposal is Billing-derived.
    const impact = c.proposals[0].changes.find(ch => ch.field === 'commercial impact');
    expect(impact.after).toContain('4,000');
    // No mutation until apply().
    expect(App.data.sows.length).toBe(before);
    const applied = c.proposals[0].apply();
    expect(applied.created).toBe(true);
    expect(App.data.sows.length).toBe(before + 1);
    const co = App.data.sows.find(s => s.id === applied.sow_id);
    expect(co.change_delta.new_amount).toBe(4000);
  });

  it('rejects an unpriceable exclusion and cross-customer / unknown ids', () => {
    const { Sow, AgentTools } = app;
    const sow = makeSow(app, 'A-1');
    Sow.addExclusion(sow.id, { text: 'No sizing here' });
    const ex = Sow.exclusions(Sow.get(sow.id))[0];
    expect(AgentTools.invoke('raise_exclusion_change_order', { sow_id: sow.id, exclusion_id: ex.id }, ctx()).error).toBeTruthy();
    expect(AgentTools.invoke('raise_exclusion_change_order', { sow_id: sow.id, exclusion_id: 'nope' }, ctx()).error).toBeTruthy();
    expect(AgentTools.invoke('raise_exclusion_change_order', { sow_id: sow.id, exclusion_id: ex.id }, ctx({ customer: 'Globex' })).error).toBeTruthy();
  });
});

describe('AI classification is confirm-gated and cannot invent the price', () => {
  it('classifyExclusion picks a matched exclusion via the mock; the price is still recomputed from Billing', async () => {
    const { Sow, SowSkill, AI } = app;
    AI.upsertProfile({ id: 'mp', name: 'Mock', adapter: 'mock', model: 'mock', toolMode: 'native' });
    AI.setDefaultProfile('mp');
    const sow = makeSow(app, 'A-1');
    const res = Sow.addExclusion(sow.id, { text: 'A mobile companion app', skill: 'size_engineering', size: 5 });
    const exId = res.item.id;
    SowSkill._sowId = sow.id;

    // The model claims the request is inside the exclusion — and tries to invent a price.
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({
      inside: true, exclusion_id: exId, rationale: 'clearly the mobile app', scope_prose: 'Deliver a mobile app.',
      price: 999999
    }) }]);
    const match = await SowSkill.classifyExclusion(Sow.get(sow.id), 'can we get a mobile app', null);
    expect(match.inside).toBe(true);
    expect(match.exclusion_id).toBe(exId);

    // No change order created yet — the classifier only proposes.
    const before = app.App.data.sows.length;
    // The priced skeleton IGNORES the model's invented number: it prices from Billing.
    const skel = Sow.exclusionChangeOrderSkeleton(Sow.get(sow.id), match.exclusion_id, { scope_prose: match.scope_prose });
    expect(skel.price.amount).toBe(4000);   // 5 × 8 × 100 — never 999999
    expect(app.App.data.sows.length).toBe(before);   // still confirm-gated
  });

  it('classifyExclusion drops a hallucinated exclusion id that does not exist', async () => {
    const { Sow, SowSkill, AI } = app;
    AI.upsertProfile({ id: 'mp', name: 'Mock', adapter: 'mock', model: 'mock', toolMode: 'native' });
    AI.setDefaultProfile('mp');
    const sow = makeSow(app, 'A-1');
    Sow.addExclusion(sow.id, { text: 'A mobile companion app', skill: 'size_engineering', size: 5 });
    SowSkill._sowId = sow.id;
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ inside: true, exclusion_id: 'EX-hallucinated', scope_prose: 'x' }) }]);
    const match = await SowSkill.classifyExclusion(Sow.get(sow.id), 'mobile app', null);
    expect(match.inside).toBe(false);
    expect(match.exclusion_id).toBe('');
  });
});
