// Self-critique pass: a from-scratch SoW section draft is reviewed by the model
// against the style rules + grounding before it is shown — best-effort, so a
// critique failure falls back to the original draft.

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
  app.AI.upsertProfile({ id: 'mp', name: 'Mock', adapter: 'mock', model: 'mock', toolMode: 'native' });
  app.AI.setDefaultProfile('mp');
});
afterEach(() => app.teardown());

function makeSow() {
  const def = sowDef();
  return app.Sow.create({
    customer: 'Acme Industries', definition: def,
    generatedSections: def.sections.map(s => ({ id: s.id, content: '', supported_by_source: true, phases: [] })),
    name: 'Scope of Work', source_text: 'src'
  });
}

async function draftFirstSection() {
  const { Sow, SowSkill } = app;
  const sow = makeSow();
  SowSkill.open({}); SowSkill.edit(sow.id);
  await SowSkill.uiDraftSection(Sow.get(sow.id).sections[0].id);
  return SowSkill;
}

describe('SoW section self-critique', () => {
  it('runs a second review pass and shows the improved draft', async () => {
    const { AI } = app;
    AI.ADAPTERS.mock.program([
      { text: '{"content":"DRAFT BODY"}' },
      { text: '{"content":"POLISHED BODY"}' }
    ]);
    const SowSkill = await draftFirstSection();
    expect(AI.ADAPTERS.mock._calls.length).toBe(2);          // draft + critique
    expect(SowSkill._redraft.newContent).toBe('POLISHED BODY');
    // The critique call is fed the draft to improve.
    expect(JSON.stringify(AI.ADAPTERS.mock._calls[1].messages)).toContain('DRAFT BODY');
  });

  it('falls back to the original draft when the critique pass fails', async () => {
    const { AI } = app;
    // Only one response queued — the critique call hits an empty queue and throws.
    AI.ADAPTERS.mock.program([{ text: '{"content":"DRAFT BODY"}' }]);
    const SowSkill = await draftFirstSection();
    expect(SowSkill._redraft.newContent).toBe('DRAFT BODY');
  });
});
