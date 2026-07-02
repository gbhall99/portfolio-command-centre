// SoW follow-ups: figures-trace accuracy check, quote-staleness reason,
// AI-edit regression warnings, bulk resolve, and the phase-alignment warning.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', size_engineering: 10, size_tableau: 4 })],
    settings: { billing: { currency: 'USD', hours_per_point: 8, rate_table: { 'United Kingdom': { Consultant: 100 } }, customer_defaults: { 'Acme Industries': { country: 'United Kingdom', level: 'Consultant' } } } }
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function quotedDef() { return app.Definitions.loadJson('sow-quoted/sow-definition.json'); }
function makeSow(def) {
  const filler = Array.from({ length: 45 }, (_, i) => 'w' + i).join(' ');
  return app.Sow.create({
    customer: 'Acme Industries', definition: def,
    generatedSections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true, phases: s.id === 'deliverables' ? ['Data Engineering', 'Tableau'] : [] })),
    name: 'Scope of Work — Test', source_text: 'src'
  });
}

describe('Sow.figuresCheck (accuracy)', () => {
  it('flags currency amounts that are not in the generated quote, but not the quote’s own figures', () => {
    const { Sow } = app;
    const def = quotedDef();
    const sow = makeSow(def);
    Sow.attachProject(sow.id, 'A-1');
    expect(Sow.setQuote(sow.id).ok).toBe(true);
    const total = Math.round(Sow.get(sow.id).quote.totals.amount); // grounded amount
    // Inject a foreign figure into Background; put the real total into Scope.
    Sow.updateSection(sow.id, 'background', 'The total budget is $987,654 for this engagement.');
    Sow.updateSection(sow.id, 'scope', 'The agreed price is $' + total.toLocaleString('en-US') + '.');
    const flags = Sow.figuresCheck(Sow.get(sow.id));
    expect(flags.some(f => /987,654/.test(f.amount))).toBe(true);     // foreign → flagged
    expect(flags.some(f => new RegExp(String(total)).test(f.amount.replace(/,/g, '')))).toBe(false); // grounded → not flagged
  });

  it('does not flag the quote’s own hourly rate immediately after Generate quote', () => {
    const { Sow } = app;
    const sow = makeSow(quotedDef());
    Sow.attachProject(sow.id, 'A-1');
    expect(Sow.setQuote(sow.id).ok).toBe(true);
    // Commercials is now quoteAsText output — "$100/hour" per billable line plus
    // the "Rates basis" line. All of it traces to the quote, so no flags.
    expect(Sow.figuresCheck(Sow.get(sow.id))).toEqual([]);
    const v = Sow.validate(Sow.get(sow.id), quotedDef());
    expect(v.warnings.filter(w => /cites \$100/.test(w))).toEqual([]);
  });

  it('flags euro amounts too (regex covers EUR)', () => {
    const { Sow, App } = app;
    App.data.settings.billing.currency = 'EUR';
    const sow = makeSow(quotedDef());
    Sow.attachProject(sow.id, 'A-1');
    expect(Sow.setQuote(sow.id).ok).toBe(true);
    Sow.updateSection(sow.id, 'background', 'A side budget of €7,777 is assumed.');
    const flags = Sow.figuresCheck(Sow.get(sow.id));
    expect(flags.some(f => /7,777/.test(f.amount))).toBe(true);
  });

  it('returns nothing when there is no quote to ground against', () => {
    const { Sow } = app;
    const sow = makeSow(quotedDef());
    Sow.updateSection(sow.id, 'background', 'A figure of $5,000 appears here.');
    expect(Sow.figuresCheck(Sow.get(sow.id))).toEqual([]);
  });
});

describe('Sow.quoteStaleReason', () => {
  it('explains the drift after the project sizing changes', () => {
    const { Sow, App } = app;
    const sow = makeSow(quotedDef());
    Sow.attachProject(sow.id, 'A-1');
    Sow.setQuote(sow.id);
    expect(Sow.quoteStaleReason(Sow.get(sow.id))).toBe(''); // fresh
    App.updateProject('A-1', 'size_engineering', 30, 'test'); // re-size → quote drifts
    const reason = Sow.quoteStaleReason(Sow.get(sow.id));
    expect(reason).not.toBe('');
    expect(reason).toMatch(/points|total|rate/);
  });
});

describe('Sow.regressionWarnings (re-validate AI edits)', () => {
  it('warns when an edit drops a required section below its word floor', () => {
    const { Sow } = app;
    const def = quotedDef();
    expect(Sow.regressionWarnings('executive_summary', 'far too short', def).length).toBeGreaterThan(0);
    const ok = Array.from({ length: 60 }, (_, i) => 'w' + i).join(' ');
    expect(Sow.regressionWarnings('executive_summary', ok, def)).toEqual([]);
  });
});

describe('Sow bulk resolve', () => {
  it('resolveAllFlags clears every flag as one undo', () => {
    const { Sow, App } = app;
    const sow = makeSow(quotedDef());
    sow.sections[0].flagged = true; sow.sections[1].flagged = true;
    const n = Sow.resolveAllFlags(sow.id);
    expect(n).toBe(2);
    expect(Sow.get(sow.id).sections.filter(s => s.flagged)).toEqual([]);
    App.undo();
    expect(Sow.get(sow.id).sections.filter(s => s.flagged).length).toBe(2);
  });

  it('resolveAllComments resolves every open comment as one undo', () => {
    const { Sow, App } = app;
    const sow = makeSow(quotedDef());
    Sow.addComment(sow.id, 'scope', 'one');
    Sow.addComment(sow.id, 'background', 'two');
    expect(Sow.resolveAllComments(sow.id)).toBe(2);
    expect(Sow.get(sow.id).sections.reduce((n, s) => n + Sow.openComments(s), 0)).toBe(0);
    App.undo();
    expect(Sow.get(sow.id).sections.reduce((n, s) => n + Sow.openComments(s), 0)).toBe(2);
  });
});

describe('editor UI affordances', () => {
  it('renders readiness summary, bulk-resolve, Suggest edit (Review) and Draft this section (empty)', () => {
    const { Sow, SowSkill, AI, document } = app;
    const def = app.Definitions.loadJson('sow/sow-definition.json');
    const filler = Array.from({ length: 45 }, (_, i) => 'w' + i).join(' ');
    const sow = Sow.create({
      customer: 'Acme Industries', definition: def,
      generatedSections: def.sections.map((s, i) => ({ id: s.id, content: i === 0 ? '' : filler, supported_by_source: true, phases: [] })),
      name: 'UI SOW', source_text: 'src'
    });
    sow.sections[1].flagged = true; sow.sections[1].flag_reason = 'x';
    sow.sections[2].flagged = true; sow.sections[2].flag_reason = 'y';
    const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'm' });
    AI.setDefaultProfile(id);
    Sow.setStatus(sow.id, 'Review', def);
    SowSkill.open({}); SowSkill.edit(sow.id);
    const main = document.querySelector('.sow-main').textContent;
    const side = document.getElementById('sowSide').textContent;
    expect(main).toContain('Draft this section');     // section 0 is empty + a model is set
    expect(main).toContain('Suggest edit');           // always shown in Review
    expect(side).toMatch(/issue.*before Approve/);    // empty required section blocks
    expect(side).toContain('Resolve all flags');      // >1 flagged section
  });
});

describe('validate phase-alignment warning', () => {
  it('warns when Deliverables name a phase not in the linked project plan', () => {
    const { Sow, App } = app;
    App.data.projects.find(p => p.id === 'A-1').delivery_config = { phase_order: ['Data Engineering'] };
    const def = quotedDef();
    const sow = makeSow(def);          // deliverables.phases = ['Data Engineering','Tableau']
    Sow.attachProject(sow.id, 'A-1');
    const v = Sow.validate(Sow.get(sow.id), def);
    expect(v.warnings.some(w => /not in the linked project’s plan/.test(w) && /Tableau/.test(w))).toBe(true);
  });
});
