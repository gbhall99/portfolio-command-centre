// sow-markup-triage: paste-in counterparty redline review. Deterministic
// heading alignment + word diff + playbook classification (on-playbook /
// negotiable / never-accept / unclassifiable), one-runBatch apply of
// accept/counter/escalate/comment decisions, untrusted-wrapped AI semantic
// matching + prose classification (mock), and the comment fallback.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;
const sowDef = () => app.Definitions.loadJson('sow/sow-definition.json');

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function makeSow(bySection) {
  const def = sowDef();
  const filler = Array.from({ length: 25 }, (_, i) => 'word' + i).join(' ');
  const sow = app.Sow.create({
    customer: 'Acme Industries', definition: def,
    generatedSections: def.sections.map(s => ({
      id: s.id,
      content: (bySection && bySection[s.id] !== undefined) ? bySection[s.id] : filler,
      supported_by_source: true,
      phases: s.id === 'deliverables' ? ['Requirements', 'Data Engineering', 'Tableau'] : []
    })),
    name: 'Scope of Work', source_text: 'src'
  });
  app.Sow.get(sow.id).sections.forEach(s => { s.flagged = false; s.flag_reason = ''; });
  return { sow: app.Sow.get(sow.id), def };
}

describe('heading alignment (model-free)', () => {
  it('maps pasted sections by heading and returns unmatched heading-like regions', () => {
    const { Sow } = app;
    const def = sowDef();
    const pasted = [
      'Commercials',
      'Invoices are payable within 45 days of the invoice date.',
      '',
      'Payment Annex',
      'Some drifted heading the definition does not know.'
    ].join('\n');
    const align = Sow.alignMarkup(def, pasted);
    expect(align.matched.some(m => m.id === 'commercials' && /45 days/.test(m.content))).toBe(true);
    expect(align.unmatched.some(u => /Payment Annex/.test(u.heading))).toBe(true);
  });
});

describe('deterministic playbook classification', () => {
  it('classifies a never-accept edit (escalate)', () => {
    const { Sow } = app;
    const { sow, def } = makeSow({ commercials: 'Invoices are payable within 30 days of the invoice date.' });
    const pasted = 'Commercials\nInvoices are payable within 30 days on a pay when paid basis.';
    const t = Sow.triageMarkup(sow, pasted, { definition: def });
    const c = t.changes.find(x => x.section_id === 'commercials');
    expect(c.classification).toBe('never_accept');
    expect(c.decision).toBe('escalate');
    expect(c.rule_id).toBe('pb_payment_never_beyond_60');
  });

  it('classifies a negotiable edit (counter with the governed fallback)', () => {
    const { Sow } = app;
    const { sow, def } = makeSow({ commercials: 'Invoices are payable within 30 days of the invoice date.' });
    const pasted = 'Commercials\nInvoices are payable within 45 days of the invoice date.';
    const t = Sow.triageMarkup(sow, pasted, { definition: def });
    const c = t.changes.find(x => x.section_id === 'commercials');
    expect(c.classification).toBe('negotiable');
    expect(c.decision).toBe('counter');
    expect(c.counter_text).toMatch(/payable within 30 days/i);
  });

  it('classifies a benign governed-section edit as on-playbook (accept)', () => {
    const { Sow } = app;
    const { sow, def } = makeSow({ commercials: 'Invoices are payable within 30 days.' });
    const pasted = 'Commercials\nInvoices are payable within 30 days of the invoice date, issued monthly in arrears.';
    const t = Sow.triageMarkup(sow, pasted, { definition: def });
    const c = t.changes.find(x => x.section_id === 'commercials');
    expect(c.classification).toBe('on_playbook');
    expect(c.decision).toBe('accept');
  });

  it('classifies a change on a rule-less section as unclassifiable (comment)', () => {
    const { Sow } = app;
    const { sow, def } = makeSow({ background: 'The customer runs a legacy reporting stack.' });
    const pasted = 'Background\nThe customer runs a modern cloud reporting stack replacing the legacy one.';
    const t = Sow.triageMarkup(sow, pasted, { definition: def });
    const c = t.changes.find(x => x.section_id === 'background');
    expect(c.classification).toBe('unclassifiable');
    expect(c.decision).toBe('comment');
  });

  it('ignores an unchanged section (word diff finds no change)', () => {
    const { Sow } = app;
    const { sow, def } = makeSow({ commercials: 'Invoices are payable within 30 days.' });
    const pasted = 'Commercials\nInvoices are payable within 30 days.';
    const t = Sow.triageMarkup(sow, pasted, { definition: def });
    expect(t.changes.find(x => x.section_id === 'commercials')).toBeUndefined();
  });
});

describe('batch apply — one undoable round', () => {
  it('applies accept / counter / escalate / comment as a single runBatch', () => {
    const { Sow, SowSkill, App } = app;
    const { sow, def } = makeSow({
      commercials: 'Invoices are payable within 30 days of the invoice date.',
      background: 'Legacy stack.'
    });
    SowSkill._sowId = sow.id; SowSkill._mode = 'edit';
    // Build a triage result with a mix of decisions.
    SowSkill._markup = {
      changes: [
        { section_id: 'commercials', section_title: 'Commercials', oldContent: 'a', newContent: 'Invoices payable within 30 days of the invoice date, monthly in arrears.', classification: 'on_playbook', decision: 'accept' },
        { section_id: 'background', section_title: 'Background', oldContent: 'Legacy stack.', newContent: 'Modern cloud stack.', classification: 'unclassifiable', decision: 'comment' },
        { section_id: 'acceptance_criteria', section_title: 'Acceptance Criteria', oldContent: 'x', newContent: 'Liability shall be unlimited.', classification: 'never_accept', decision: 'escalate', rule_title: 'Liability — never uncapped', detail: 'banned wording' }
      ],
      unmatched: []
    };
    const before = App.undoStack.length;
    SowSkill.uiMarkupApply();
    expect(App.undoStack.length).toBe(before + 1); // exactly one undo step

    const after = Sow.get(sow.id);
    // accept adopted the counterparty content
    expect(after.sections.find(s => s.id === 'commercials').content).toMatch(/monthly in arrears/);
    // comment fallback queued a review comment (content NOT adopted)
    expect(after.sections.find(s => s.id === 'background').content).toBe('Legacy stack.');
    expect(after.sections.find(s => s.id === 'background').comments.some(c => /Counterparty proposed/.test(c.text))).toBe(true);
    // escalate cited the rule and did not adopt the content
    const accept = after.sections.find(s => s.id === 'acceptance_criteria');
    expect(accept.comments.some(c => /ESCALATE/.test(c.text) && /never-accept/.test(c.text))).toBe(true);

    // One undo reverts the whole round.
    App.undo();
    const reverted = Sow.get(sow.id);
    expect(reverted.sections.find(s => s.id === 'commercials').content).not.toMatch(/monthly in arrears/);
    expect(reverted.sections.find(s => s.id === 'background').comments.length).toBe(0);
  });

  it('counter keeps the rest of the section and inserts the governed fallback (no content loss)', () => {
    const { Sow, SowSkill } = app;
    // A real multi-clause Commercials section — the day rate and expenses terms
    // must survive a counter; only the governed fallback clause is added.
    const { sow, def } = makeSow({ commercials: 'The day rate is £850 per person. Expenses are charged at cost. Invoices are payable within 30 days of the invoice date.' });
    const pasted = 'Commercials\nThe day rate is £850 per person. Expenses are charged at cost. Invoices are payable within 45 days of the invoice date.';
    const t = Sow.triageMarkup(sow, pasted, { definition: def });
    const c = t.changes.find(x => x.section_id === 'commercials');
    expect(c.decision).toBe('counter');
    expect(c.rule_id).toBeTruthy();
    SowSkill._sowId = sow.id; SowSkill._mode = 'edit';
    SowSkill._markup = { changes: [c], unmatched: [] };
    SowSkill.uiMarkupApply();
    const sec = Sow.get(sow.id).sections.find(s => s.id === 'commercials');
    // The other clauses are NOT deleted (the data-loss bug), and the counterparty's
    // 45-day term is rejected (our section was never overwritten with it).
    expect(sec.content).toMatch(/day rate is £850/i);
    expect(sec.content).toMatch(/Expenses are charged at cost/i);
    expect(sec.content).not.toMatch(/45 days/);
    // The governed fallback clause is present, recorded with playbook provenance.
    expect(sec.content).toMatch(/payable within 30 days/i);
    expect((sec.sources || []).some(s => s.kind === 'playbook')).toBe(true);
    expect(sec.comments.some(x => /Countered/.test(x.text))).toBe(true);
  });
});

describe('AI enhancements (mock)', () => {
  it('untrusted-wraps the counterparty text and matches a drifted heading to a section', async () => {
    const { Sow, SowSkill, AI } = app;
    const pid = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(pid);
    const { sow } = makeSow({ commercials: 'Invoices are payable within 30 days.' });
    SowSkill._sowId = sow.id; SowSkill._mode = 'edit';
    // A drifted heading ("Payment Annex") that must be AI-mapped to commercials.
    SowSkill._markupText = 'Payment Annex\nInvoices are payable within 45 days of the invoice date.';
    // Mock: (1) semantic match maps region 0 → commercials.
    AI.ADAPTERS.mock.program([
      { text: JSON.stringify({ matches: [{ region_index: 0, section_id: 'commercials' }] }) }
    ]);
    await SowSkill.uiMarkupRun();

    // The counterparty document rode the untrusted wrapper in the sent messages.
    const userMsg = AI.ADAPTERS.mock._calls[0].messages.find(m => m.role === 'user');
    expect(userMsg.content).toContain('<untrusted_document>');
    expect(userMsg.content).toContain('45 days');
    // The drifted region was matched to commercials and classified negotiable.
    const c = SowSkill._markup.changes.find(x => x.section_id === 'commercials');
    expect(c).toBeTruthy();
    expect(c.classification).toBe('negotiable');
  });

  it('AI prose classification can upgrade an unclassifiable change; unknown verdicts keep the comment fallback', async () => {
    const { Sow, SowSkill, AI } = app;
    const pid = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(pid);
    const { sow } = makeSow({ background: 'Legacy stack.' });
    SowSkill._sowId = sow.id; SowSkill._mode = 'edit';
    SowSkill._markupText = 'Background\nThe modern cloud stack replaces the legacy one entirely.';
    // Mock: alignment has no unmatched (heading matches), so the first call is
    // the prose classifier — upgrade the background change to never_accept.
    AI.ADAPTERS.mock.program([
      { text: JSON.stringify({ verdicts: [{ change_index: 0, classification: 'never_accept', note: 'strategic re-platform out of scope' }] }) }
    ]);
    await SowSkill.uiMarkupRun();
    const c = SowSkill._markup.changes.find(x => x.section_id === 'background');
    expect(c.classification).toBe('never_accept');
    expect(c.decision).toBe('escalate');
    // The untrusted wrap was applied to the prose classifier prompt too.
    const userMsg = AI.ADAPTERS.mock._calls[0].messages.find(m => m.role === 'user');
    expect(userMsg.content).toContain('<untrusted_document>');
  });
});
