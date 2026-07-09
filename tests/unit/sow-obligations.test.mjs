// sow-obligations — client-obligation tracker: structured assumptions mirrored
// to RAID. Manual structured entry, RAID mirroring (source 'sow', provenance
// both ways), overdue detection widening isStale + surfacing in HealthCheck are
// all model-free; the AI "structure this section" extraction is confirm-gated.
// Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

function fixture() {
  resetIdSeq();
  return makeDataset({
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', assumptions_register: [] })]
  });
}

function makeSow(a, projectId) {
  const def = a.Definitions.loadJson('sow/sow-definition.json');
  const filler = Array.from({ length: 30 }, (_, i) => 'word' + i).join(' ');
  return a.Sow.create({
    customer: 'Acme Industries', project_id: projectId || null, definition: def,
    generatedSections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true, phases: s.id === 'deliverables' ? ['Data Engineering'] : [] })),
    name: 'Alpha SoW', source_text: 'src'
  });
}

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('structured obligations + RAID mirroring', () => {
  it('adds a structured obligation and mirrors it to the linked project as a RAID assumption (source sow), undoably', () => {
    const { Sow, App } = app;
    const sow = makeSow(app, 'A-1');
    const project = App.data.projects.find(p => p.id === 'A-1');
    expect(project.assumptions_register.length).toBe(0);

    const res = Sow.addObligation(sow.id, 'assumptions_dependencies', {
      text: 'Client provides production data access', owner: 'Data Owner', due_date: '2026-02-01', consequence: 'Schedule slips one sprint'
    });
    expect(res.ok).toBe(true);
    expect(res.raid_id).toBeTruthy();

    // Item lives on the section with a back-reference to the RAID id.
    const sec = Sow.get(sow.id).sections.find(s => s.id === 'assumptions_dependencies');
    expect(sec.items.length).toBe(1);
    expect(sec.items[0].raid_ref).toBe(res.raid_id);

    // Mirrored into the project's assumption register with source 'sow' + both-way provenance.
    const a = App.data.projects.find(p => p.id === 'A-1').assumptions_register.find(x => x.id === res.raid_id);
    expect(a).toBeTruthy();
    expect(a.source).toBe('sow');
    expect(a.text).toBe('Client provides production data access');
    expect(a.sow_ref.sow_id).toBe(sow.id);
    expect(a.sow_ref.obligation_id).toBe(sec.items[0].id);

    // Persisted (audited) and undoable as one step.
    expect((App.data.audit_log || []).some(e => /sow_obligation/.test(e.field || ''))).toBe(true);
    App.undo();
    expect(Sow.get(sow.id).sections.find(s => s.id === 'assumptions_dependencies').items.length).toBe(0);
    expect(App.data.projects.find(p => p.id === 'A-1').assumptions_register.length).toBe(0);
  });

  it('removing an obligation drops its mirrored RAID assumption too', () => {
    const { Sow, App } = app;
    const sow = makeSow(app, 'A-1');
    const res = Sow.addObligation(sow.id, 'assumptions_dependencies', { text: 'Client signs the data-sharing agreement' });
    expect(App.data.projects.find(p => p.id === 'A-1').assumptions_register.length).toBe(1);
    const obId = Sow.get(sow.id).sections.find(s => s.id === 'assumptions_dependencies').items[0].id;
    Sow.removeObligation(sow.id, 'assumptions_dependencies', obId);
    expect(Sow.get(sow.id).sections.find(s => s.id === 'assumptions_dependencies').items.length).toBe(0);
    expect(App.data.projects.find(p => p.id === 'A-1').assumptions_register.some(a => a.id === res.raid_id)).toBe(false);
  });

  it('with no linked project the obligation is still added, just not mirrored', () => {
    const { Sow } = app;
    const sow = makeSow(app, null);
    const res = Sow.addObligation(sow.id, 'assumptions_dependencies', { text: 'Client nominates a product owner' });
    expect(res.ok).toBe(true);
    expect(res.raid_id).toBe(null);
    expect(Sow.get(sow.id).sections.find(s => s.id === 'assumptions_dependencies').items[0].raid_ref).toBe(null);
  });
});

describe('overdue detection widens isStale + surfaces in HealthCheck', () => {
  it('an overdue, unresolved obligation flags the SoW stale', () => {
    const { Sow } = app;
    const sow = makeSow(app, 'A-1');
    Sow.addObligation(sow.id, 'assumptions_dependencies', { text: 'Client confirms scope', due_date: '2000-01-01' });
    expect(Sow.hasOverdueObligation(Sow.get(sow.id))).toBe(true);
    expect(Sow.isStale(Sow.get(sow.id))).toBe(true);
    expect(Sow.overdueObligations(Sow.get(sow.id)).length).toBe(1);
  });

  it('a future or resolved obligation is not overdue', () => {
    const { Sow } = app;
    const sow = makeSow(app, 'A-1');
    const r = Sow.addObligation(sow.id, 'assumptions_dependencies', { text: 'Client provides feed', due_date: '2999-01-01' });
    expect(Sow.hasOverdueObligation(Sow.get(sow.id))).toBe(false);
    // Backdate and mark met — resolved obligations never flag.
    const obId = Sow.get(sow.id).sections.find(s => s.id === 'assumptions_dependencies').items[0].id;
    Sow.updateObligation(sow.id, 'assumptions_dependencies', obId, { due_date: '2000-01-01', resolved: true });
    expect(Sow.hasOverdueObligation(Sow.get(sow.id))).toBe(false);
    expect(r.ok).toBe(true);
  });

  it('surfaces an overdue obligation as a HealthCheck commercial row', () => {
    const { Sow, HealthCheck } = app;
    const sow = makeSow(app, 'A-1');
    Sow.addObligation(sow.id, 'assumptions_dependencies', { text: 'Client signs off the data model', due_date: '2000-06-15', owner: 'CDO' });
    const rows = HealthCheck.commercial('Acme Industries');
    const row = rows.find(r => /obligation overdue/.test(r.text));
    expect(row).toBeTruthy();
    expect(row.text).toMatch(/data model/);
    expect(row.deep_link.type).toBe('sow');
  });
});

describe('AI extraction is confirm-gated', () => {
  it('structuring a section proposes obligations without saving; applying confirms them', async () => {
    const { Sow, SowSkill, AI, App } = app;
    AI.upsertProfile({ id: 'mp', name: 'Mock', adapter: 'mock', model: 'mock', toolMode: 'native' });
    AI.setDefaultProfile('mp');
    const sow = makeSow(app, 'A-1');
    SowSkill._sowId = sow.id;
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ obligations: [
      { text: 'Client grants VPN access', owner: 'IT', due_date: '2026-03-01', consequence: 'Blocks engineering' },
      { text: 'Client approves the metric definitions', owner: '', due_date: '', consequence: '' }
    ] }) }]);

    const before = App.data.projects.find(p => p.id === 'A-1').assumptions_register.length;
    await SowSkill.uiStructureSection('assumptions_dependencies');
    // Pending only — nothing mutated yet.
    expect(SowSkill._obExtract).toBeTruthy();
    expect(SowSkill._obExtract.items.length).toBe(2);
    expect(Sow.get(sow.id).sections.find(s => s.id === 'assumptions_dependencies').items.length).toBe(0);
    expect(App.data.projects.find(p => p.id === 'A-1').assumptions_register.length).toBe(before);

    // Confirming applies them (and mirrors to RAID).
    SowSkill.uiApplyObligations();
    expect(SowSkill._obExtract).toBe(null);
    expect(Sow.get(sow.id).sections.find(s => s.id === 'assumptions_dependencies').items.length).toBe(2);
    expect(App.data.projects.find(p => p.id === 'A-1').assumptions_register.length).toBe(before + 2);
  });
});
