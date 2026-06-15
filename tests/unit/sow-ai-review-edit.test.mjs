// AI-suggested document-review edits: a flag- and comment-driven "Suggest edit"
// that reuses the redraft proposal/redline, and on accept applies the edit AND
// resolves the addressed feedback as one undoable batch. Mock adapter only.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({ customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
  app.App.activeCustomer = 'Acme Industries';
  const id = app.AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
  app.AI.setDefaultProfile(id);
});
afterEach(() => app.teardown());

function defFor() { return app.Definitions.loadJson('sow/sow-definition.json'); }
function makeSow() {
  const def = defFor();
  const filler = Array.from({ length: 45 }, (_, i) => 'word' + i).join(' ');
  const sow = app.Sow.create({
    customer: 'Acme Industries', definition: def,
    generatedSections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true })),
    name: 'Statement of Work', source_text: 'src'
  });
  sow.sections.forEach(s => { s.flagged = false; });
  return { sow, def };
}

describe('uiSuggestEdit — grounding in review feedback', () => {
  it('builds the proposal from an open comment + flag and grounds the prompt in both', async () => {
    const { Sow, SowSkill, AI } = app;
    const { sow } = makeSow();
    const sid = sow.sections[0].id;
    Sow.addComment(sow.id, sid, 'Tighten the scope to three bullets');
    // Flag the section with a reason.
    sow.sections[0].flagged = true; sow.sections[0].flag_reason = 'Scope wording too vague';
    SowSkill._sowId = sow.id; SowSkill._mode = 'edit';
    AI.ADAPTERS.mock.program([{ text: '{"content":"Revised, tighter scope addressing the review."}' }]);

    await SowSkill.uiSuggestEdit(sid);
    // A proposal (not yet applied) with the redline + review provenance.
    expect(SowSkill._redraft).toBeTruthy();
    expect(SowSkill._redraft.fromReview).toBe(true);
    expect(SowSkill._redraft.newContent).toMatch(/^Revised, tighter scope/);
    expect(Sow.get(sow.id).sections[0].content).not.toMatch(/^Revised/); // not applied yet
    // The model saw both the comment and the flag as feedback to address.
    const userMsg = AI.ADAPTERS.mock._calls[0].messages.find(m => m.role === 'user');
    expect(userMsg.content).toContain('Tighten the scope to three bullets');
    expect(userMsg.content).toContain('Scope wording too vague');
  });

  it('no-ops with a toast when the section has no open comments or flag', async () => {
    const { SowSkill } = app;
    const { sow } = makeSow();
    SowSkill._sowId = sow.id; SowSkill._mode = 'edit';
    await SowSkill.uiSuggestEdit(sow.sections[0].id);
    expect(SowSkill._redraft).toBeNull();
  });
});

describe('accept — applies + resolves as one undoable batch', () => {
  it('redrafts the section (audited ai), resolves the comment, clears the flag, single-undo', async () => {
    const { Sow, SowSkill, AI, App } = app;
    const { sow } = makeSow();
    const sid = sow.sections[0].id;
    Sow.addComment(sow.id, sid, 'Address pricing assumption');
    sow.sections[0].flagged = true; sow.sections[0].flag_reason = 'Needs a pricing caveat';
    SowSkill._sowId = sow.id; SowSkill._mode = 'edit';
    AI.ADAPTERS.mock.program([{ text: '{"content":"New content with the pricing caveat."}' }]);
    await SowSkill.uiSuggestEdit(sid);

    const undoBefore = App.undoStack.length;
    SowSkill.uiRedraftAccept();
    const sec = Sow.get(sow.id).sections[0];
    expect(sec.content).toBe('New content with the pricing caveat.');
    expect(sec.flagged).toBe(false);
    expect(sec.comments[0].resolved).toBe(true);
    expect(App.data.audit_log.some(e => e.source === 'ai' && /sow_section/.test(e.field))).toBe(true);
    // One batch → one undo reverts the edit AND the resolutions together.
    expect(App.undoStack.length).toBe(undoBefore + 1);
    App.undo();
    const reverted = Sow.get(sow.id).sections[0];
    expect(reverted.content).not.toBe('New content with the pricing caveat.');
    expect(reverted.flagged).toBe(true);
    expect(reverted.comments[0].resolved).toBe(false);
  });

  it('a plain (non-review) AI redraft still applies on its own', async () => {
    const { Sow, SowSkill } = app;
    const { sow } = makeSow();
    const sid = sow.sections[0].id;
    SowSkill._sowId = sow.id;
    SowSkill._redraft = { sectionId: sid, oldContent: sow.sections[0].content, newContent: 'Plain redraft.' };
    SowSkill.uiRedraftAccept();
    expect(Sow.get(sow.id).sections[0].content).toBe('Plain redraft.');
  });
});
