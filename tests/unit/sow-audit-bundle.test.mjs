// sow-audit-bundle: signature-ready evidentiary export + acceptance capture.
// The bundle is assembled deterministically from data the app already records —
// validate() output, the risk rubric, playbook deviations, resolved flags/
// comments with timestamps, quote provenance (rate band, hours/point, prepaid),
// wireframe co-sign, and the redline history since Review (versions[] +
// diffWords). Acceptance is a plain form (name/role/date), additive + undoable +
// stamped in history[] and escaped on render. The AI executive cover is optional
// garnish, grounded in document facts, hidden with no model.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;
const definition = () => app.Definitions.loadJson('sow/sow-definition.json');

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', size_engineering: 10, size_tableau: 4 })],
    settings: { billing: { currency: 'GBP', hours_per_point: 8, rate_table: { 'United Kingdom': { Consultant: 100 } }, customer_defaults: { 'Acme Industries': { country: 'United Kingdom', level: 'Consultant' } } } }
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function configureMock() {
  const id = app.AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
  app.AI.setDefaultProfile(id);
}
// The harness seeds a default local profile, so isConfigured() is true unless we
// explicitly store an empty profile list.
function clearAi() { app.AI.saveSettings({ profiles: [], defaultProfileId: null, taskDefaults: {} }); }

function makeSow(bySection) {
  const def = definition();
  const filler = Array.from({ length: 45 }, (_, i) => 'word' + i).join(' ');
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
  const got = app.Sow.get(sow.id);
  got.sections.forEach(s => { s.flagged = false; s.flag_reason = ''; });
  return { sow: got, def };
}

describe('acceptance capture', () => {
  it('records a name/role/date additively, undoably, and stamps history[]', () => {
    const { Sow, App } = app;
    const { sow } = makeSow();
    expect(sow.acceptance).toBeNull();
    const before = App.undoStack.length;
    const res = Sow.recordAcceptance(sow.id, { name: 'Dana Sponsor', role: 'Finance Director', date: '2026-07-01' });
    expect(res.ok).toBe(true);
    const got = Sow.get(sow.id);
    expect(got.acceptance).toMatchObject({ name: 'Dana Sponsor', role: 'Finance Director', date: '2026-07-01' });
    expect(got.acceptance.at).toBeTruthy();
    // history[] carries an acceptance event.
    expect(got.history.some(h => h.event === 'acceptance' && /Dana Sponsor/.test(h.detail))).toBe(true);
    // Undoable (one step).
    expect(App.undoStack.length).toBe(before + 1);
    App.undo();
    expect(Sow.get(sow.id).acceptance).toBeNull();
  });

  it('requires a name and can be cleared', () => {
    const { Sow } = app;
    const { sow } = makeSow();
    expect(Sow.recordAcceptance(sow.id, { name: '   ', role: 'x' }).ok).toBe(false);
    Sow.recordAcceptance(sow.id, { name: 'Sam' });
    expect(Sow.get(sow.id).acceptance.name).toBe('Sam');
    // Missing date defaults to today (ISO date).
    expect(/^\d{4}-\d{2}-\d{2}$/.test(Sow.get(sow.id).acceptance.date)).toBe(true);
    Sow.clearAcceptance(sow.id);
    expect(Sow.get(sow.id).acceptance).toBeNull();
  });

  it('migration backfills acceptance:null on legacy SoWs', () => {
    const { App } = app;
    App.data.sows.push({ id: 'SOW-legacy', customer: 'Acme Industries', status: 'Draft', version: '0.1', sections: [{ id: 'scope', title: 'Scope', content: 'x', comments: [] }], history: [] });
    App.migrateSchema(App.data);
    expect(App.data.sows.find(s => s.id === 'SOW-legacy').acceptance).toBeNull();
  });

  it('escapes a free-text acceptance name/role on render (no HTML injection)', () => {
    const { Sow, SowSkill } = app;
    const { sow } = makeSow();
    Sow.recordAcceptance(sow.id, { name: '<script>alert(1)</script>', role: 'a"b', date: '2026-07-01' });
    const doc = SowSkill._buildExportDoc(Sow.get(sow.id), definition());
    const html = app.Reports.Doc.toHtml(doc, {});
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    // The acceptance section is present.
    expect(html).toContain('Acceptance record');
  });
});

describe('deterministic audit bundle assembly', () => {
  it('gathers validation, risk, comments, quote, wireframe co-sign and redlines', () => {
    const { Sow } = app;
    const { sow, def } = makeSow({ scope: 'We will build the sales dashboard reporting suite for finance.' });
    Sow.attachProject(sow.id, 'A-1');
    Sow.setQuote(sow.id);
    // A resolved comment (timestamped) and a version history via transitions.
    Sow.addComment(sow.id, 'scope', 'Please confirm the go-live date.');
    Sow.resolveComment(sow.id, 'scope', 0, true);
    Sow.setStatus(sow.id, 'Review', def);
    Sow.updateSection(sow.id, 'scope', 'We will build the sales AND finance dashboard reporting suite.');
    Sow.setStatus(sow.id, 'Review', def); // second snapshot → a redline pair

    const b = Sow.auditBundle(Sow.get(sow.id), def);
    expect(b.validation).toHaveProperty('ok');
    expect(b.risk).toHaveProperty('tier');
    expect(b.quote).toMatchObject({ hours_per_point: 8, rate_band: expect.any(String) });
    expect(b.quote.totals.amount).toBeGreaterThan(0);
    // Comment captured with its resolution + timestamp.
    const c = b.comments.find(x => /go-live/i.test(x.text));
    expect(c).toMatchObject({ resolved: true });
    expect(c.at).toBeTruthy();
    // Redline history has at least one changed-section pair (scope broadened).
    expect(b.redlines.length).toBeGreaterThan(0);
    expect(b.redlines.some(r => r.changes.some(ch => /scope/i.test(ch.section)))).toBe(true);
  });

  it('renders the evidentiary appendix into the exported document', () => {
    const { Sow, SowSkill } = app;
    const { sow, def } = makeSow({ commercials: 'Commercials are priced per the attached quote below.' });
    Sow.attachProject(sow.id, 'A-1');
    Sow.setQuote(sow.id);
    Sow.addComment(sow.id, 'scope', 'Confirm the sponsor.');
    Sow.setStatus(sow.id, 'Review', def);
    Sow.updateSection(sow.id, 'scope', 'Rewritten scope ' + Array.from({ length: 40 }, (_, i) => 'w' + i).join(' '));
    Sow.setStatus(sow.id, 'Review', def);
    Sow.recordAcceptance(sow.id, { name: 'Dana Sponsor', role: 'Sponsor', date: '2026-07-02' });

    const doc = SowSkill._buildExportDoc(Sow.get(sow.id), def);
    const html = app.Reports.Doc.toHtml(doc, {});
    // Evidentiary sections are all present.
    expect(html).toContain('Acceptance record');
    expect(html).toContain('Approval evidence');
    expect(html).toContain('Flags &amp; comments');
    expect(html).toContain('Commercial provenance');
    expect(html).toContain('Redline history since review');
    // Quote provenance surfaces the rate basis + hours-per-point.
    expect(html).toContain('Hours per story point');
    expect(html).toContain('Rate basis');
    // Redline shows the raised comment text and inline diff styling.
    expect(html).toContain('Confirm the sponsor.');
    expect(html).toMatch(/line-through/);
  });

  it('is model-free — the whole bundle assembles with no AI configured', () => {
    const { Sow, SowSkill } = app;
    const { sow, def } = makeSow();
    Sow.attachProject(sow.id, 'A-1');
    Sow.setQuote(sow.id);
    Sow.recordAcceptance(sow.id, { name: 'No Model', date: '2026-07-03' });
    // No AI profile configured at all.
    clearAi();
    expect(app.AI.isConfigured()).toBe(false);
    const doc = SowSkill._buildExportDoc(Sow.get(sow.id), def);
    const html = app.Reports.Doc.toHtml(doc, {});
    expect(html).toContain('No Model');
    expect(html).toContain('Commercial provenance');
    // No executive cover section is emitted without a model.
    expect(html).not.toContain('Executive summary');
  });
});

describe('AI executive cover (optional, grounded)', () => {
  it('drafts a grounded cover via the mock and includes it in the export; cannot invent figures', async () => {
    const { Sow, SowSkill, AI } = app;
    configureMock();
    const { sow, def } = makeSow({ scope: 'Build the finance reporting dashboards.' });
    Sow.attachProject(sow.id, 'A-1');
    Sow.setQuote(sow.id);
    SowSkill._sowId = sow.id; SowSkill._mode = 'edit';
    AI.ADAPTERS.mock.program([{ text: 'This SOW delivers the finance reporting dashboards at the quoted price.' }]);
    await SowSkill.uiAuditCover();

    expect(SowSkill._auditCover).toBeTruthy();
    expect(SowSkill._auditCover.text).toMatch(/finance/i);
    // The prompt grounds in document facts, wrapped as untrusted; the quote
    // figure is supplied so the model never invents it.
    const userMsg = AI.ADAPTERS.mock._calls[0].messages.find(m => m.role === 'user');
    expect(userMsg.content).toContain('<untrusted_document>');
    expect(userMsg.content).toMatch(/hours per story point|excl\. tax/i);

    // The cover rides the export as the Executive summary section.
    const doc = SowSkill._buildExportDoc(Sow.get(sow.id), def);
    const html = app.Reports.Doc.toHtml(doc, {});
    expect(html).toContain('Executive summary');
    expect(html).toContain('finance reporting dashboards');
  });

  it('is hidden with no AI (uiAuditCover no-ops, no cover section)', async () => {
    const { Sow, SowSkill } = app;
    const { sow } = makeSow();
    SowSkill._sowId = sow.id;
    clearAi();
    expect(app.AI.isConfigured()).toBe(false);
    await SowSkill.uiAuditCover();
    expect(SowSkill._auditCover).toBeNull();
  });
});
