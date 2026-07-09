// Precedent-grounded drafting (sow-precedent): a pure local query over
// data.sows exposes how the same section read in the customer's last N Approved
// SoWs of the same template set; it grounds AI drafts and powers a model-free
// "Copy from precedent" that records provenance.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;
const sowDef = () => app.Definitions.loadJson('sow/sow-definition.json');

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#0ea5e9' }],
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function makeSow(customer, contentBySection, status) {
  const def = sowDef();
  const filler = Array.from({ length: 20 }, (_, i) => 'w' + i).join(' ');
  const sow = app.Sow.create({
    customer,
    definition: def,
    generatedSections: def.sections.map(s => ({ id: s.id, content: (contentBySection && contentBySection[s.id]) || filler, supported_by_source: true, phases: [] })),
    name: 'SOW ' + customer, source_text: 'src'
  });
  const got = app.Sow.get(sow.id);
  if (status) { got.status = status; got.history.push({ at: new Date().toISOString(), event: 'status', detail: 'Review → Approved' }); }
  return got;
}

describe('Sow.precedentVersions / precedentBlock', () => {
  it('returns prior Approved section text for the same customer + template, newest first', () => {
    const { Sow } = app;
    makeSow('Acme Industries', { scope: 'OLD APPROVED SCOPE' }, 'Approved');
    const current = makeSow('Acme Industries', { scope: 'draft scope' }, null);
    const versions = Sow.precedentVersions(current, 'scope');
    expect(versions.length).toBe(1);
    expect(versions[0].content).toBe('OLD APPROVED SCOPE');
    expect(Sow.precedentBlock(current, 'scope')).toContain('OLD APPROVED SCOPE');
    expect(Sow.precedentBlock(current, 'scope')).toContain('<precedent>');
  });

  it("returns '' / [] when there is no Approved precedent", () => {
    const { Sow } = app;
    // A Draft (not Approved) SoW is not precedent; a foreign-customer Approved one is excluded.
    makeSow('Acme Industries', { scope: 'DRAFT ONLY' }, null);
    makeSow('Globex', { scope: 'FOREIGN APPROVED' }, 'Approved');
    const current = makeSow('Acme Industries', { scope: 'draft scope' }, null);
    expect(Sow.precedentVersions(current, 'scope')).toEqual([]);
    expect(Sow.precedentBlock(current, 'scope')).toBe('');
  });

  it('excludes the current SoW and empty sections', () => {
    const { Sow } = app;
    const approvedEmpty = makeSow('Acme Industries', { background: 'HAS BACKGROUND', scope: '' }, 'Approved');
    // Force the scope section empty on the approved doc.
    approvedEmpty.sections.find(s => s.id === 'scope').content = '';
    const current = makeSow('Acme Industries', { scope: 'x' }, null);
    expect(Sow.precedentVersions(current, 'scope')).toEqual([]);       // approved doc has no scope content
    expect(Sow.precedentVersions(current, 'background').length).toBe(1); // but it does have background
  });
});

describe('Copy from precedent records provenance', () => {
  it('appends the prior text and stamps a section.sources precedent entry (undoable)', () => {
    const { Sow } = app;
    const prior = makeSow('Acme Industries', { scope: 'SIGNED SCOPE WORDING' }, 'Approved');
    const current = makeSow('Acme Industries', { scope: '' }, null);
    current.sections.find(s => s.id === 'scope').content = '';
    const r = Sow.copyFromPrecedent(current.id, 'scope', prior.id);
    expect(r.ok).toBe(true);
    const sec = Sow.get(current.id).sections.find(s => s.id === 'scope');
    expect(sec.content).toContain('SIGNED SCOPE WORDING');
    const src = (sec.sources || []).find(s => s.kind === 'precedent');
    expect(src).toBeTruthy();
    expect(src.ref).toBe(prior.id);
    expect(src.text).toMatch(/§Scope/);
    // Second copy from the same source is refused.
    expect(Sow.copyFromPrecedent(current.id, 'scope', prior.id).ok).toBe(false);
    // Undoable.
    app.App.undo();
    expect((Sow.get(current.id).sections.find(s => s.id === 'scope').sources || []).some(s => s.kind === 'precedent')).toBe(false);
  });
});

describe('drafting prompts are grounded in precedent', () => {
  beforeEach(() => {
    app.AI.upsertProfile({ id: 'mp', name: 'Mock', adapter: 'mock', model: 'mock', toolMode: 'native' });
    app.AI.setDefaultProfile('mp');
  });

  it('uiRedraftRun folds the precedent block into the sent messages', async () => {
    const { AI, Sow, SowSkill, document } = app;
    makeSow('Acme Industries', { scope: 'PRIOR APPROVED SCOPE TEXT' }, 'Approved');
    const current = makeSow('Acme Industries', { scope: 'current scope' }, null);
    SowSkill.open({}); SowSkill.edit(current.id);
    // Open the redraft input and populate the instruction.
    SowSkill.uiRedraftToggle('scope');
    document.getElementById('sowRedraftInput').value = 'tighten it';
    AI.ADAPTERS.mock.program([{ text: '{"content":"redrafted"}' }]);
    await SowSkill.uiRedraftRun('scope');
    const sent = JSON.stringify(AI.ADAPTERS.mock._calls[0].messages);
    expect(sent).toContain('<precedent>');
    expect(sent).toContain('PRIOR APPROVED SCOPE TEXT');
  });

  it('uiDraftSection grounds an empty section draft in precedent', async () => {
    const { AI, Sow, SowSkill } = app;
    makeSow('Acme Industries', { background: 'PRIOR APPROVED BACKGROUND' }, 'Approved');
    const current = makeSow('Acme Industries', { background: '' }, null);
    current.sections.find(s => s.id === 'background').content = '';
    SowSkill.open({}); SowSkill.edit(current.id);
    AI.ADAPTERS.mock.program([{ text: '{"content":"BODY"}' }, { text: '{"content":"POLISHED"}' }]);
    await SowSkill.uiDraftSection('background');
    const sent = JSON.stringify(AI.ADAPTERS.mock._calls[0].messages);
    expect(sent).toContain('PRIOR APPROVED BACKGROUND');
  });
});
