// Whole-document review (sow-doc-review): deterministic cross-section
// consistency + style lints (model-free, feed validate warnings) and an
// optional AI full-pass that lands as one batch of redline cards with a
// single-undo Accept-all.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, resetIdSeq } from '../harness/fixtures.mjs';

let app;
const sowDef = () => app.Definitions.loadJson('sow/sow-definition.json');

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', size_engineering: 10, delivery_config: { phase_order: ['Data Engineering', 'Tableau'] } })],
    sprints: makeSprintSequence(3, '2026-01-05')
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

// Build a SoW with per-section content supplied by `bySection` (id -> string);
// unspecified sections get benign filler so only the section under test lints.
function makeSow(bySection, opts = {}) {
  const def = sowDef();
  const filler = Array.from({ length: 20 }, (_, i) => 'word' + i).join(' ');
  const sow = app.Sow.create({
    customer: 'Acme Industries',
    project_id: opts.project_id || null,
    definition: def,
    generatedSections: def.sections.map(s => ({
      id: s.id,
      content: (bySection && bySection[s.id] !== undefined) ? bySection[s.id] : filler,
      supported_by_source: true,
      phases: s.id === 'deliverables' ? (opts.phases || []) : []
    })),
    name: 'Scope of Work', source_text: 'src'
  });
  return { sow: app.Sow.get(sow.id), def };
}

describe('deterministic consistency lints', () => {
  it('flags a phrase shared between Scope and Out of Scope', () => {
    const { Sow } = app;
    const bad = makeSow({ scope: 'We will build the sales dashboard and its reporting layer.', out_of_scope: 'The sales dashboard for the finance team is excluded from this engagement.' }).sow;
    expect(Sow.consistencyLints(bad).some(w => /sales dashboard/.test(w) && /Scope and Out of Scope/.test(w))).toBe(true);
    const good = makeSow({ scope: 'We will build the sales analytics platform.', out_of_scope: 'Mobile applications are out of scope.' }).sow;
    expect(Sow.consistencyLints(good).some(w => /Out of Scope/.test(w))).toBe(false);
  });

  it('flags a Timeline date outside the linked project sprint calendar', () => {
    const { Sow } = app;
    const bad = makeSow({ timeline_milestones: 'The engagement completes by 12 December 2031 with monthly showcases.' }, { project_id: 'A-1' }).sow;
    expect(Sow.consistencyLints(bad).some(w => /Timeline date 12 December 2031/.test(w) && /outside the delivery sprint calendar/.test(w))).toBe(true);
    const good = makeSow({ timeline_milestones: 'The engagement runs across the sprints starting 5 January 2026.' }, { project_id: 'A-1' }).sow;
    expect(Sow.consistencyLints(good).some(w => /outside the delivery sprint/.test(w))).toBe(false);
  });

  it('flags a named person absent from Roles & Responsibilities', () => {
    const { Sow } = app;
    const bad = makeSow({ scope: 'Jane Cooper sponsors the programme and signs off scope.', roles_responsibilities: 'The delivery lead runs the squad and the analyst gathers requirements.' }).sow;
    expect(Sow.consistencyLints(bad).some(w => /Jane Cooper/.test(w) && /Roles & Responsibilities/.test(w))).toBe(true);
    const good = makeSow({ scope: 'Jane Cooper sponsors the programme.', roles_responsibilities: 'Jane Cooper is the accountable sponsor; the delivery lead runs the squad.' }).sow;
    expect(Sow.consistencyLints(good).some(w => /Jane Cooper/.test(w))).toBe(false);
  });
});

describe('deterministic style lints', () => {
  it('flags American spelling and passes clean British English', () => {
    const { Sow } = app;
    const def = sowDef();
    const bad = makeSow({ background: 'We will organize the data and analyze the pipeline.' }).sow;
    const lints = Sow.styleLints(bad, def);
    expect(lints.some(w => /organize/.test(w) && /organise/.test(w))).toBe(true);
    const good = makeSow({ background: 'We will organise the data and analyse the pipeline.' }).sow;
    expect(Sow.styleLints(good, def).some(w => /British English/.test(w))).toBe(false);
  });

  it('flags bullets that do not start with a verb', () => {
    const { Sow } = app;
    const def = sowDef();
    const bad = makeSow({ deliverables: '- The dashboard for sales\n- Build the ingestion pipeline' }).sow;
    expect(Sow.styleLints(bad, def).some(w => /do not start with a verb/.test(w) && /Deliverables/.test(w))).toBe(true);
    const good = makeSow({ deliverables: '- Build the ingestion pipeline\n- Deliver the sales dashboard' }).sow;
    expect(Sow.styleLints(good, def).some(w => /do not start with a verb/.test(w))).toBe(false);
  });

  it('flags an over-budget document (> ~1,800 words)', () => {
    const { Sow } = app;
    const def = sowDef();
    const bad = makeSow({ background: Array.from({ length: 1900 }, (_, i) => 'w' + i).join(' ') }).sow;
    expect(Sow.styleLints(bad, def).some(w => /targets under ~1,800 words/.test(w))).toBe(true);
    const good = makeSow({}).sow;
    expect(Sow.styleLints(good, def).some(w => /1,800 words/.test(w))).toBe(false);
  });

  it('validate() surfaces the lints as warnings without changing ok/errors', () => {
    const { Sow } = app;
    const { sow, def } = makeSow({ background: 'We will organize the data.' });
    const v = Sow.validate(sow, def);
    expect(v.warnings.some(w => /organize/.test(w))).toBe(true);
    // Lints are warnings only — they never add an error.
    expect(v.errors.some(e => /organize/.test(e))).toBe(false);
  });
});

describe('AI full-pass — batch redline cards, single-undo accept-all', () => {
  beforeEach(() => {
    app.AI.upsertProfile({ id: 'mp', name: 'Mock', adapter: 'mock', model: 'mock', toolMode: 'native' });
    app.AI.setDefaultProfile('mp');
  });

  it('produces one batch of redline cards and applies them as ONE undoable batch', async () => {
    const { AI, Sow, SowSkill } = app;
    const { sow } = makeSow({ scope: 'Original scope prose here.', background: 'Original background prose here.' });
    SowSkill.open({}); SowSkill.edit(sow.id);
    AI.ADAPTERS.mock.program([{
      text: JSON.stringify({
        summary: 'Two sections tightened for consistency.',
        edits: [
          { section_id: 'scope', revised_content: 'REVISED SCOPE', reason: 'Aligns with deliverables' },
          { section_id: 'background', revised_content: 'REVISED BACKGROUND', reason: 'Trim' },
          { section_id: 'scope', revised_content: 'Original scope prose here.', reason: 'no-op dropped' }
        ]
      })
    }]);
    await SowSkill.uiDocReview();
    // No-op edit (unchanged content) is dropped; two real edits remain.
    expect(SowSkill._docReview.edits.length).toBe(2);
    expect(SowSkill._docReview.summary).toMatch(/tightened/);

    const before = { scope: Sow.get(sow.id).sections.find(s => s.id === 'scope').content, background: Sow.get(sow.id).sections.find(s => s.id === 'background').content };
    SowSkill.uiDocReviewAcceptAll();
    expect(Sow.get(sow.id).sections.find(s => s.id === 'scope').content).toBe('REVISED SCOPE');
    expect(Sow.get(sow.id).sections.find(s => s.id === 'background').content).toBe('REVISED BACKGROUND');
    expect(SowSkill._docReview).toBe(null);

    // ONE undo reverts the whole batch.
    app.App.undo();
    expect(Sow.get(sow.id).sections.find(s => s.id === 'scope').content).toBe(before.scope);
    expect(Sow.get(sow.id).sections.find(s => s.id === 'background').content).toBe(before.background);
  });

  it('drops edits that name an unknown section id', async () => {
    const { AI, SowSkill } = app;
    const { sow } = makeSow({ scope: 'Original.' });
    SowSkill.open({}); SowSkill.edit(sow.id);
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ summary: 's', edits: [{ section_id: 'not_a_section', revised_content: 'X' }, { section_id: 'scope', revised_content: 'NEW SCOPE' }] }) }]);
    await SowSkill.uiDocReview();
    expect(SowSkill._docReview.edits.length).toBe(1);
    expect(SowSkill._docReview.edits[0].sectionId).toBe('scope');
  });
});
