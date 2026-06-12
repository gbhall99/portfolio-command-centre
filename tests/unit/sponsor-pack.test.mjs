import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Per-project sponsor pack', () => {
  it('Reports.Builders.sponsorPack returns a doc with sections for narrative/milestones/risks/business case', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Demo', sponsor: 'Sandra Lee', manager: 'Owen' });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    const Reports = app.window.__pcc__.Reports;
    expect(Reports).toBeDefined();
    const doc = Reports.Builders.sponsorPack(proj.id);
    expect(doc).toBeDefined();
    const html = Reports.Doc.toHtml(doc, {});
    expect(html).toMatch(/Demo/);
    expect(html).toMatch(/Narrative/i);
    expect(html).toMatch(/Risks/i);
    expect(html).toMatch(/Sandra Lee/);
    app.teardown();
  });

  it('internal project notes never reach the customer-audience output', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Demo', sponsor: 'Sandra Lee', manager: 'Owen' });
    proj.notes = 'Paused pending Legal review. Resume target Q3.';
    proj.narrative = { headline: 'On track for the autumn release.' };
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    const Reports = app.window.__pcc__.Reports;
    const doc = Reports.Builders.sponsorPack(proj.id);

    // Customer audience (the 'Report (Customer)' button / hub toggle path):
    // notes are internal planning commentary and must be redacted.
    doc.audience = 'customer';
    const customerHtml = Reports.Doc.toHtml(doc, {});
    expect(customerHtml).not.toContain('Paused pending Legal review');
    expect(customerHtml).not.toContain('Internal notes');
    expect(customerHtml).toContain('On track for the autumn release.');

    // Internal audience keeps the notes (legacy exportProjectPack parity).
    doc.audience = 'internal';
    const internalHtml = Reports.Doc.toHtml(doc, {});
    expect(internalHtml).toContain('Paused pending Legal review. Resume target Q3.');
    expect(internalHtml).toContain('Internal notes');

    // No section tagged 'customer' may embed the notes text, whatever the
    // serializer does later.
    const customerSections = Reports.Doc._filterSections(doc.sections, 'customer');
    expect(customerSections.length).toBeGreaterThan(0);
    for (const s of customerSections) {
      expect(s.html).not.toContain('Paused pending Legal review');
    }
    app.teardown();
  });

  it('a project without notes emits no empty Internal notes section', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Demo' });
    delete proj.notes;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    const Reports = app.window.__pcc__.Reports;
    const doc = Reports.Builders.sponsorPack(proj.id);
    const internalSections = Reports.Doc._filterSections(doc.sections, 'internal');
    expect(internalSections.some(s => s.id === 'pp-notes')).toBe(false);
    const html = Reports.Doc.toHtml(doc, {});
    expect(html).not.toContain('Internal notes');
    app.teardown();
  });
});
