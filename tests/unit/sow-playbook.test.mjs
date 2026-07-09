// Playbook-governed SOW review: a governed playbook.json per sow template set
// (preferred positions, tiered fallback wording, hard never-accept rules).
// Machine-checkable shapes (must_contain / must_not_contain / numeric bounds)
// run deterministically inside Sow.validate — no model; never-accept
// deviations block approval via the 'playbook_clean' approval_requires token.
// Fallback wording inserts deterministically with sources kind 'playbook';
// AI assists (on-playbook redraft + prose-nuance review) run on the mock
// adapter only and can never create a rule violation.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function definition() { return app.Definitions.loadJson('sow/sow-definition.json'); }
function configureMock() {
  const id = app.AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
  app.AI.setDefaultProfile(id);
}
// A fully-filled SOW (flags cleared) whose filler content trips no
// never-accept rule and no numeric bound.
function makeSow(sectionContent) {
  const def = definition();
  const filler = Array.from({ length: 45 }, (_, i) => 'word' + i).join(' ');
  const sow = app.Sow.create({
    customer: 'Acme Industries', definition: def,
    generatedSections: def.sections.map(s => ({ id: s.id, content: (sectionContent && sectionContent[s.id] !== undefined) ? sectionContent[s.id] : filler, supported_by_source: true })),
    name: 'Statement of Work', source_text: 'src'
  });
  sow.sections.forEach(s => { s.flagged = false; s.flag_reason = ''; });
  return { sow, def };
}

describe('governed playbook file', () => {
  it('ships in both sow template sets and resolves per customer', () => {
    const { Definitions, Sow } = app;
    const r = Definitions.resolve('sow', 'Acme Industries');
    expect(r.files.playbook).toBeTruthy();
    expect(r.files.playbook.kind).toBe('sow-playbook');
    const pb = Sow._playbook('Acme Industries');
    expect(pb.rules.length).toBeGreaterThanOrEqual(8);
    // Every rule carries the contract fields; tiers come from the fixed vocabulary.
    pb.rules.forEach(rule => {
      expect(rule.id).toBeTruthy();
      expect(rule.section).toBeTruthy();
      expect(rule.rationale).toBeTruthy();
      expect(['preferred', 'fallback', 'never_accept']).toContain(rule.tier);
    });
    // The quoted set carries its own playbook file (with the quote-validity rule).
    const quoted = Definitions.loadJson('sow-quoted/playbook.json');
    expect(quoted.rules.map(x => x.id)).toContain('pb_quote_validity');
    // Both shipped definition sets gate approval on playbook_clean.
    expect(definition().validation.approval_requires).toContain('playbook_clean');
    expect(Definitions.loadJson('sow-quoted/sow-definition.json').validation.approval_requires).toContain('playbook_clean');
  });
});

describe('deterministic rule evaluation (no model)', () => {
  it('must_contain: passes on any listed alternative, fails when all are missing', () => {
    const { Sow } = app;
    const rule = { id: 'r', title: 'r', check: { must_contain: [['payable within', 'net 30']] } };
    expect(Sow._ruleProblems(rule, 'Fees are payable within 30 days.')).toEqual([]);
    expect(Sow._ruleProblems(rule, 'Terms: Net 30 from invoice.')).toEqual([]); // case-insensitive
    const problems = Sow._ruleProblems(rule, 'Payment to be agreed later.');
    expect(problems.length).toBe(1);
    expect(problems[0]).toMatch(/missing required wording/);
  });

  it('must_not_contain: fails when a banned phrase appears', () => {
    const { Sow } = app;
    const rule = { id: 'r', title: 'r', check: { must_not_contain: ['unlimited liability'] } };
    expect(Sow._ruleProblems(rule, 'Liability is capped at the fees paid.')).toEqual([]);
    const problems = Sow._ruleProblems(rule, 'The supplier accepts UNLIMITED LIABILITY for all losses.');
    expect(problems.length).toBe(1);
    expect(problems[0]).toMatch(/banned wording/);
  });

  it('numeric bounds: payment days ≤ 30 and liability cap ≥ 1.0x fees', () => {
    const { Sow } = app;
    const days = { id: 'r', title: 'r', check: { numeric: { pattern: '(?:within|net)\\s+(\\d[\\d,]*)\\s*days', max: 30, label: 'payment days' } } };
    expect(Sow._ruleProblems(days, 'Invoices are payable within 30 days.')).toEqual([]);
    const over = Sow._ruleProblems(days, 'Invoices are payable within 45 days.');
    expect(over.length).toBe(1);
    expect(over[0]).toMatch(/payment days 45 exceeds the playbook maximum of 30/);
    const cap = { id: 'r', title: 'r', check: { numeric: { pattern: '(\\d+(?:\\.\\d+)?)\\s*(?:x|times)\\s+(?:the\\s+)?fees', min: 1.0, label: 'liability cap multiple' } } };
    expect(Sow._ruleProblems(cap, 'Liability is capped at 1.5x the fees paid.')).toEqual([]);
    const under = Sow._ruleProblems(cap, 'Liability is capped at 0.5x the fees paid.');
    expect(under.length).toBe(1);
    expect(under[0]).toMatch(/below the playbook minimum of 1/);
  });

  it('playbookCheck binds rules to sections and skips empty sections', () => {
    const { Sow } = app;
    const { sow } = makeSow({ commercials: 'Fees are payable within 90 days of invoice.' });
    const devs = Sow.playbookCheck(sow);
    const ids = devs.map(d => d.rule_id);
    expect(ids).toContain('pb_payment_terms');            // preferred: > 30 days
    expect(ids).toContain('pb_payment_never_beyond_60');  // never accept: > 60 days
    expect(devs.find(d => d.rule_id === 'pb_payment_never_beyond_60').tier).toBe('never_accept');
    // Empty sections are never checked (emptiness is validate's job).
    const { sow: blank } = makeSow({ commercials: '' });
    expect(Sow.playbookCheck(blank).map(d => d.rule_id)).not.toContain('pb_payment_terms');
  });
});

describe('playbook_clean approval gating', () => {
  it('a never-accept deviation blocks Approve; fixing the wording unblocks', () => {
    const { Sow } = app;
    const { sow, def } = makeSow({ commercials: 'Fees are payable within 90 days of invoice.' });
    Sow.setStatus(sow.id, 'Review', def);
    let v = Sow.validate(Sow.get(sow.id), def);
    expect(v.errors.some(e => /Playbook — .*never beyond 60/i.test(e))).toBe(true);
    let res = Sow.setStatus(sow.id, 'Approved', def);
    expect(res.ok).toBe(false);
    expect(Sow.get(sow.id).status).toBe('Review');
    // Fix the terms to the preferred position — the never-accept clears.
    Sow.updateSection(sow.id, 'commercials', 'Invoices are issued monthly and are payable within 30 days of the invoice date.');
    v = Sow.validate(Sow.get(sow.id), def);
    expect(v.errors.some(e => /Playbook/.test(e))).toBe(false);
    res = Sow.setStatus(sow.id, 'Approved', def);
    expect(res.ok).toBe(true);
    expect(Sow.get(sow.id).status).toBe('Approved');
  });

  it('a clean document approves; preferred-tier deviations are warnings only', () => {
    const { Sow } = app;
    const { sow, def } = makeSow();
    const v = Sow.validate(sow, def);
    expect(v.ok).toBe(true);   // filler trips no never-accept rule
    // The preferred/fallback positions the filler misses surface as warnings.
    expect(v.warnings.some(w => /^Playbook — /.test(w))).toBe(true);
    Sow.setStatus(sow.id, 'Review', def);
    expect(Sow.setStatus(sow.id, 'Approved', def).ok).toBe(true);
  });

  it('without the playbook_clean token, never-accept deviations degrade to warnings', () => {
    const { Sow } = app;
    const { sow } = makeSow({ commercials: 'Fees are payable within 90 days of invoice.' });
    const bare = JSON.parse(JSON.stringify(definition()));
    bare.validation.approval_requires = bare.validation.approval_requires.filter(t => t !== 'playbook_clean');
    const v = Sow.validate(sow, bare);
    expect(v.errors.some(e => /^Playbook — /.test(e))).toBe(false);
    expect(v.warnings.some(w => /never beyond 60/i.test(w))).toBe(true);
  });
});

describe('deterministic fallback insert (sources kind playbook)', () => {
  it('appends the governed wording, records provenance, clears the deviation', () => {
    const { Sow, App } = app;
    const { sow } = makeSow();
    expect(Sow.playbookCheck(sow).map(d => d.rule_id)).toContain('pb_change_control');
    const res = Sow.insertPlaybookFallback(sow.id, 'pb_change_control');
    expect(res.ok).toBe(true);
    const sec = Sow.get(sow.id).sections.find(s => s.id === 'out_of_scope');
    expect(sec.content).toMatch(/written change request/);
    expect(sec.sources.some(s => s.kind === 'playbook' && s.ref === 'pb_change_control')).toBe(true);
    expect(Sow.playbookCheck(Sow.get(sow.id)).map(d => d.rule_id)).not.toContain('pb_change_control');
    // Audited + history event.
    expect(App.data.audit_log.some(e => e.field === 'sow_playbook:out_of_scope')).toBe(true);
    expect(Sow.get(sow.id).history.some(h => h.event === 'playbook_fallback')).toBe(true);
  });

  it('inserts once per rule per section and is undoable', () => {
    const { Sow, App } = app;
    const { sow } = makeSow();
    const before = Sow.get(sow.id).sections.find(s => s.id === 'out_of_scope').content;
    expect(Sow.insertPlaybookFallback(sow.id, 'pb_change_control').ok).toBe(true);
    const again = Sow.insertPlaybookFallback(sow.id, 'pb_change_control');
    expect(again.ok).toBe(false);
    expect(again.error).toMatch(/already/);
    App.undo();
    expect(Sow.get(sow.id).sections.find(s => s.id === 'out_of_scope').content).toBe(before);
  });

  it('rejects unknown rules and rules with no fallback wording', () => {
    const { Sow } = app;
    const { sow } = makeSow();
    expect(Sow.insertPlaybookFallback(sow.id, 'nope').ok).toBe(false);
    expect(Sow.insertPlaybookFallback(sow.id, 'pb_ip_no_blanket_assignment').ok).toBe(false); // never-accept ban, no canned wording
  });
});

describe('AI on-playbook redraft (mock adapter)', () => {
  it('lands in the standard redline (nothing mutates), accept applies audited as ai in one undo', async () => {
    const { Sow, SowSkill, AI, App } = app;
    configureMock();
    const { sow } = makeSow();
    SowSkill.open({});
    SowSkill.edit(sow.id);   // render populates _playbookDevs
    const idx = SowSkill._playbookDevs.findIndex(d => d.rule_id === 'pb_change_control');
    expect(idx).toBeGreaterThanOrEqual(0);
    const original = Sow.get(sow.id).sections.find(s => s.id === 'out_of_scope').content;
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ content: 'Any change to scope is managed through a written change request signed by both parties.' }) }]);
    await SowSkill.uiPlaybookRedraft(idx);
    // Pending proposal only — the section is untouched until Accept.
    expect(SowSkill._redraft).toBeTruthy();
    expect(SowSkill._redraft.sectionId).toBe('out_of_scope');
    expect(Sow.get(sow.id).sections.find(s => s.id === 'out_of_scope').content).toBe(original);
    // The prompt carried the rule, its rationale and the preferred wording.
    const call = AI.ADAPTERS.mock._calls[0];
    const userMsg = call.messages.find(m => m.role === 'user');
    expect(userMsg.content).toContain('PLAYBOOK REVISION INSTRUCTION');
    expect(userMsg.content).toContain('Change control — written change requests only');
    expect(userMsg.content).toContain('PREFERRED WORDING');
    SowSkill.uiRedraftAccept();
    const sec = Sow.get(sow.id).sections.find(s => s.id === 'out_of_scope');
    expect(sec.content).toMatch(/written change request/);
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'sow_section:out_of_scope')).toBe(true);
    App.undo();
    expect(Sow.get(sow.id).sections.find(s => s.id === 'out_of_scope').content).toBe(original);
  });

  it('the redline card re-checks the pending content against the playbook', async () => {
    const { Sow, SowSkill, AI, document } = app;
    configureMock();
    const { sow } = makeSow();
    SowSkill.open({});
    SowSkill.edit(sow.id);
    const idx = SowSkill._playbookDevs.findIndex(d => d.rule_id === 'pb_payment_terms');
    expect(idx).toBeGreaterThanOrEqual(0);
    // The model "fixes" payment terms but drifts into never-accept territory.
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ content: 'Invoices are payable within 90 days of the invoice date.' }) }]);
    await SowSkill.uiPlaybookRedraft(idx);
    const diff = document.getElementById('sowRedraftDiff');
    expect(diff).toBeTruthy();
    expect(diff.textContent).toMatch(/payment days 90 exceeds the playbook maximum/);
  });
});

describe('AI playbook review (advisory only, mock adapter)', () => {
  it('judges only rules carrying ai_check, drops invented rules, and never changes the deterministic result', async () => {
    const { Sow, SowSkill, AI } = app;
    configureMock();
    // Only commercials drafted → exactly one section-level judgement call.
    const { sow, def } = makeSow({
      executive_summary: '', background: '', scope: '', out_of_scope: '', deliverables: '',
      assumptions_dependencies: '', timeline_milestones: '', roles_responsibilities: '',
      acceptance_criteria: '', signoff: '',
      commercials: 'Payment is made within 30 days of acceptance sign-off by the steering board.'
    });
    SowSkill.open({});
    SowSkill.edit(sow.id);
    const vBefore = Sow.validate(Sow.get(sow.id), def);
    const riskBefore = Sow.riskScore(Sow.get(sow.id), def).total;
    // First reply invents a rule (fails the enum schema → repair), the repair
    // reply is clean but flags a real nuance the regex cannot see.
    AI.ADAPTERS.mock.program([
      { text: JSON.stringify({ findings: [{ rule_id: 'pb_made_up_rule', compliant: false, note: 'x' }] }) },
      { text: JSON.stringify({ findings: [{ rule_id: 'pb_payment_terms', compliant: false, note: 'Payment clock starts at <img src=x onerror=alert(1)> acceptance, not invoice date' }] }) }
    ]);
    await SowSkill.uiPlaybookReview();
    const findings = SowSkill._playbookAi.findings;
    expect(findings.length).toBe(1);
    expect(findings[0].rule_id).toBe('pb_payment_terms');
    expect(findings[0].compliant).toBe(false);
    // Advisory only: the model's verdict cannot create a rule violation —
    // validate() and the risk score are byte-identical before and after.
    const vAfter = Sow.validate(Sow.get(sow.id), def);
    expect(vAfter.errors).toEqual(vBefore.errors);
    expect(Sow.riskScore(Sow.get(sow.id), def).total).toBe(riskBefore);
    // Rendered escaped — model text can never become markup.
    const html = SowSkill.renderSideHtml();
    expect(html).toContain('&lt;img src=x');
    expect(html).not.toContain('<img src=x');
  });

  it('no-ops with a toast when no drafted section has an ai_check rule', async () => {
    const { SowSkill, AI } = app;
    configureMock();
    const { sow } = makeSow({
      executive_summary: 'x', background: '', scope: '', out_of_scope: '', deliverables: '',
      assumptions_dependencies: '', timeline_milestones: '', commercials: '',
      roles_responsibilities: '', acceptance_criteria: '', signoff: ''
    });
    SowSkill.open({});
    SowSkill.edit(sow.id);
    AI.ADAPTERS.mock.program([]);
    await SowSkill.uiPlaybookReview();
    expect(SowSkill._playbookAi).toBeNull();
    expect(AI.ADAPTERS.mock._calls.length).toBe(0);
  });
});
