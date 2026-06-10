// Quoted SOW template set: per-customer template selection, quote
// generation from the linked project's sizing with prepaid netting, and
// approval gating on quote presence/staleness.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [
      makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', size_engineering: 10, size_tableau: 4 }),
      makeProject({ id: 'A-2', name: 'Acme Beta', customer: 'Acme Industries', size_engineering: 6 })
    ],
    settings: { billing: { currency: 'GBP', hours_per_point: 8, rate_table: { EMEA: { Consultant: 100 } }, customer_defaults: { 'Acme Industries': { region: 'EMEA', level: 'Consultant' } } } }
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function quotedDef() {
  return app.Definitions.loadJson('sow-quoted/sow-definition.json');
}

function makeQuotedSow() {
  const def = quotedDef();
  const filler = Array.from({ length: 45 }, (_, i) => 'w' + i).join(' ');
  const sow = app.Sow.create({
    customer: 'Acme Industries',
    definition: def,
    generatedSections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true, phases: s.id === 'deliverables' ? ['Data Engineering', 'Tableau'] : [] })),
    name: 'Statement of Work — Quoted',
    source_text: 'src'
  });
  return { sow, def };
}

describe('template set registration', () => {
  it('the quoted set is selectable per customer and shares template/style with the default', () => {
    const { Definitions } = app;
    const sets = Definitions.templateSets('sow');
    expect(sets.map(s => s.id)).toEqual(['default', 'quoted']);
    Definitions.setSelectedSetId('sow', 'Acme Industries', 'quoted');
    const r = Definitions.resolve('sow', 'Acme Industries');
    expect(r.id).toBe('quoted');
    expect(r.files.definition.validation.requires_quote).toBe(true);
    expect(r.files.template).toContain('{{commercials}}');   // shared template file
    // Other customers keep the default.
    expect(Definitions.selectedSetId('sow', 'Globex')).toBe('default');
  });

  it('the default set does NOT require a quote (back-compat)', () => {
    const def = app.Definitions.loadJson('sow/sow-definition.json');
    expect(def.validation.requires_quote).toBeUndefined();
  });
});

describe('quote generation', () => {
  it('setQuote requires a linked project, then prices its sizing with prepaid netting', () => {
    const { Sow, Billing } = app;
    const { sow } = makeQuotedSow();
    // No project linked yet.
    let res = Sow.setQuote(sow.id);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Link a project/);
    // Linked: quote prices 10 DE + 4 Tab; prepaid pool covers 8 of the DE.
    Billing.addArrangement({ customer: 'Acme Industries', label: 'Retainer', skill: 'size_engineering', prepaid_points: 8, amount_invoiced: 6400 });
    Sow.attachProject(sow.id, 'A-1');
    res = Sow.setQuote(sow.id);
    expect(res.ok).toBe(true);
    const q = Sow.get(sow.id).quote;
    expect(q.project_id).toBe('A-1');
    expect(q.totals.points).toBe(14);
    expect(q.totals.prepaid_covered).toBe(8);
    expect(q.rate_band).toBe('EMEA / Consultant');
    expect(q.totals.amount).toBe(6 * 8 * 100);
    // Commercials section now carries the rendered quote and is unflagged.
    const comm = Sow.get(sow.id).sections.find(s => s.id === 'commercials');
    expect(comm.content).toContain('covered by prepaid');
    expect(comm.content).toContain('Quoted amount');
    expect(comm.flagged).toBe(false);
    // History + audit recorded; undo restores the pre-quote state.
    expect(Sow.get(sow.id).history.some(h => h.event === 'quote_generated')).toBe(true);
    expect(app.App.data.audit_log.some(e => e.field === 'sow_quote')).toBe(true);
    app.App.undo();
    expect(Sow.get(sow.id).quote).toBeUndefined();
  });

  it('refuses to quote when the customer has no priced rate band', () => {
    const { Sow, App } = app;
    const { sow } = makeQuotedSow();
    Sow.attachProject(sow.id, 'A-1');
    App.data.settings.billing.rate_table = {}; // nothing priced
    const res = Sow.setQuote(sow.id);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/No priced rate band/);
  });
});

describe('approval gating', () => {
  it('a quoted-template SOW cannot approve without a quote; with one it can', () => {
    const { Sow } = app;
    const { sow, def } = makeQuotedSow();
    sow.sections.forEach(s => { s.flagged = false; });
    Sow.setStatus(sow.id, 'Review', def);
    let res = Sow.setStatus(sow.id, 'Approved', def);
    expect(res.ok).toBe(false);
    expect(res.errors.join(' ')).toMatch(/requires a generated quote/);
    Sow.attachProject(sow.id, 'A-1');
    Sow.setQuote(sow.id);
    Sow.get(sow.id).sections.forEach(s => { s.flagged = false; });
    res = Sow.setStatus(sow.id, 'Approved', def);
    expect(res.ok).toBe(true);
  });

  it('a stale quote (re-linked to a different project) blocks approval', () => {
    const { Sow } = app;
    const { sow, def } = makeQuotedSow();
    Sow.attachProject(sow.id, 'A-1');
    Sow.setQuote(sow.id);
    Sow.attachProject(sow.id, 'A-2');  // re-linked after quoting
    const v = Sow.validate(Sow.get(sow.id), def);
    expect(v.errors.some(e => /different project — regenerate/.test(e))).toBe(true);
  });

  it('the default template still approves without any quote', () => {
    const { Sow, Definitions } = app;
    const def = Definitions.loadJson('sow/sow-definition.json');
    const filler = Array.from({ length: 45 }, (_, i) => 'w' + i).join(' ');
    const sow = Sow.create({
      customer: 'Acme Industries', definition: def,
      generatedSections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true })),
      name: 'SOW', source_text: 's'
    });
    sow.sections.forEach(s => { s.flagged = false; });
    Sow.setStatus(sow.id, 'Review', def);
    expect(Sow.setStatus(sow.id, 'Approved', def).ok).toBe(true);
  });
});

describe('editor UI', () => {
  it('the side panel shows the quote block with generate/regenerate and the billable summary', () => {
    const { Sow, SowSkill, Definitions, document } = app;
    Definitions.setSelectedSetId('sow', 'Acme Industries', 'quoted');
    const { sow } = makeQuotedSow();
    SowSkill.open({});
    SowSkill.edit(sow.id);
    let side = document.getElementById('sowSide');
    expect(side.textContent).toContain('Quote (required by this template)');
    expect(side.textContent).toContain('Generate quote');
    Sow.attachProject(sow.id, 'A-1');
    SowSkill.uiGenerateQuote();
    side = document.getElementById('sowSide');
    expect(side.textContent).toContain('Regenerate quote');
    expect(side.textContent).toContain('billable');
  });
});
