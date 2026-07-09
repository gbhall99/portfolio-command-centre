// Explainable SOW risk score: a deterministic rubric assembled only from
// named checks (playbook deviations by tier, flags, open comments, untraced
// figures, thin content, stale quote, non-build-ready wireframes) rolled into
// a Red/Amber/Green document tier. Red hard-blocks Approve (validate error);
// Amber approves only with a typed override rationale recorded in history[]
// and the audit log. AI narration is optional garnish on the mock adapter.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', size_engineering: 10, size_tableau: 4 })],
    settings: { billing: { currency: 'GBP', hours_per_point: 8, rate_table: { 'United Kingdom': { Consultant: 100 } }, customer_defaults: { 'Acme Industries': { country: 'United Kingdom', level: 'Consultant' } } } }
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function definition() { return app.Definitions.loadJson('sow/sow-definition.json'); }
function configureMock() {
  const id = app.AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
  app.AI.setDefaultProfile(id);
}
function makeSow(opts) {
  const def = definition();
  const filler = Array.from({ length: 45 }, (_, i) => 'word' + i).join(' ');
  const sow = app.Sow.create(Object.assign({
    customer: 'Acme Industries', definition: def,
    generatedSections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true })),
    name: 'Statement of Work', source_text: 'src'
  }, opts || {}));
  sow.sections.forEach(s => { s.flagged = false; s.flag_reason = ''; });
  return { sow, def };
}
// A definition stripped of every approval_requires token so flags/comments
// stay warnings — the risk gate is then the only thing standing at Approve.
function bareDef() {
  const def = JSON.parse(JSON.stringify(definition()));
  def.validation.approval_requires = [];
  return def;
}
// Isolate the rubric arithmetic from the shipped playbook where noted.
function noPlaybook() { app.Sow._playbook = () => null; }

describe('rubric arithmetic — every point traces to a named check', () => {
  it('starts at zero and each input moves the score by its documented weight', () => {
    const { Sow } = app;
    noPlaybook();
    const { sow, def } = makeSow();
    expect(Sow.riskScore(sow, def)).toMatchObject({ total: 0, tier: 'Green', items: [] });
    // Unresolved flag: +3.
    sow.sections[0].flagged = true; sow.sections[0].flag_reason = 'Needs review';
    let r = Sow.riskScore(Sow.get(sow.id), def);
    expect(r.total).toBe(Sow.RISK_POINTS.flagged);
    expect(r.items[0]).toMatchObject({ check: 'flag', points: 3 });
    // Open comment: +2 each.
    Sow.addComment(sow.id, 'scope', 'Tighten this');
    r = Sow.riskScore(Sow.get(sow.id), def);
    expect(r.total).toBe(3 + Sow.RISK_POINTS.open_comment);
    expect(r.items.some(it => it.check === 'comment' && it.points === 2)).toBe(true);
    // Thin required content: +2.
    Sow.updateSection(sow.id, 'background', 'too short');
    r = Sow.riskScore(Sow.get(sow.id), def);
    expect(r.total).toBe(5 + Sow.RISK_POINTS.thin_required);
    expect(r.items.some(it => it.check === 'thin' && it.section === 'Background')).toBe(true);
    // Empty required content: +3 (replaces thin).
    Sow.updateSection(sow.id, 'background', '');
    r = Sow.riskScore(Sow.get(sow.id), def);
    expect(r.total).toBe(5 + Sow.RISK_POINTS.empty_required);
    // Resolving the comment gives the points back.
    Sow.resolveComment(sow.id, 'scope', 0);
    expect(Sow.riskScore(Sow.get(sow.id), def).total).toBe(3 + 3);
    // Total is exactly the sum of the visible items — no opaque remainder.
    r = Sow.riskScore(Sow.get(sow.id), def);
    expect(r.total).toBe(r.items.reduce((n, it) => n + it.points, 0));
  });

  it('playbook deviations score by tier (never-accept 10 / fallback 2 / preferred 1)', () => {
    const { Sow } = app;
    const { sow, def } = makeSow();
    Sow._playbook = () => ({ rules: [
      { id: 'never', title: 'never', section: 'scope', tier: 'never_accept', check: { must_not_contain: ['forbidden'] } },
      { id: 'fall', title: 'fall', section: 'scope', tier: 'fallback', check: { must_contain: ['expected'] } },
      { id: 'pref', title: 'pref', section: 'scope', tier: 'preferred', check: { must_contain: ['nice'] } }
    ] });
    Sow.updateSection(sow.id, 'scope', 'This forbidden scope has neither of the phrases.');
    const r = Sow.riskScore(Sow.get(sow.id), def);
    const pb = r.items.filter(it => it.check === 'playbook');
    expect(pb.map(it => it.points).sort((a, b) => b - a)).toEqual([10, 2, 1]);
    // 13 playbook points + 2 for the now-thin scope section.
    expect(r.total).toBe(15);
    expect(r.items.some(it => it.check === 'thin' && it.points === 2)).toBe(true);
  });

  it('stale quotes and untraced figures feed the score', () => {
    const { Sow } = app;
    noPlaybook();
    const { sow, def } = makeSow({ project_id: 'A-1' });
    expect(Sow.setQuote(sow.id).ok).toBe(true);
    // A figure nowhere in the quote: +2.
    Sow.updateSection(sow.id, 'scope', 'A one-off licence fee of £123 applies. ' + Array.from({ length: 40 }, (_, i) => 'w' + i).join(' '));
    let r = Sow.riskScore(Sow.get(sow.id), def);
    expect(r.items.some(it => it.check === 'figures' && it.points === 2)).toBe(true);
    // Resize the project → the stored quote goes stale: +4.
    app.App.updateProject('A-1', 'size_engineering', 20, 'user');
    r = Sow.riskScore(Sow.get(sow.id), def);
    expect(r.items.some(it => it.check === 'stale_quote' && it.points === 4)).toBe(true);
  });

  it('an attached wireframe that is not build-ready scores against Deliverables', () => {
    const { Sow, Wireframe } = app;
    noPlaybook();
    const { sow, def } = makeSow();
    const wfDef = app.Definitions.resolve('tableau', 'Acme Industries').files.definition;
    const wf = Wireframe.create({ customer: 'Acme Industries', name: 'Exec dashboard', definition: wfDef }); // empty canvas → not build-ready
    Sow.toggleWireframe(sow.id, wf.id);
    const r = Sow.riskScore(Sow.get(sow.id), def);
    const item = r.items.find(it => it.check === 'wireframe');
    expect(item).toBeTruthy();
    expect(item.section).toBe('Deliverables');
    expect(item.points).toBe(Sow.RISK_POINTS.wireframe_not_ready);
  });

  it('tier thresholds: Green below 8, Amber from 8, Red from 16', () => {
    const { Sow } = app;
    noPlaybook();
    const { sow, def } = makeSow();
    // 3 + 2×2 = 7 → Green.
    sow.sections[0].flagged = true;
    Sow.addComment(sow.id, 'scope', 'one');
    Sow.addComment(sow.id, 'scope', 'two');
    expect(Sow.riskScore(Sow.get(sow.id), def)).toMatchObject({ total: 7, tier: 'Green' });
    // +1 comment → 9 ≥ 8 → Amber... via a 4th input: 3+3×2 = 9.
    Sow.addComment(sow.id, 'background', 'three');
    expect(Sow.riskScore(Sow.get(sow.id), def)).toMatchObject({ total: 9, tier: 'Amber' });
    // Pile on flags to cross 16 → Red.
    sow.sections[1].flagged = true;
    sow.sections[2].flagged = true;
    sow.sections[3].flagged = true;
    expect(Sow.riskScore(Sow.get(sow.id), def)).toMatchObject({ total: 18, tier: 'Red' });
  });
});

describe('tiered approval gates', () => {
  it('Red hard-blocks Approve through Sow.validate — even with no approval_requires tokens', () => {
    const { Sow } = app;
    noPlaybook();
    const { sow } = makeSow();
    const def = bareDef();
    [0, 1, 2, 3, 4, 5].forEach(i => { sow.sections[i].flagged = true; }); // 18 pts → Red
    Sow.setStatus(sow.id, 'Review', def);
    const v = Sow.validate(Sow.get(sow.id), def);
    expect(v.errors.some(e => /risk is Red \(18 points/.test(e))).toBe(true);
    const res = Sow.setStatus(sow.id, 'Approved', def);
    expect(res.ok).toBe(false);
    expect(Sow.get(sow.id).status).toBe('Review');
  });

  it('Amber requires a typed override; the rationale lands in history[] and the audit log', () => {
    const { Sow, App } = app;
    noPlaybook();
    const { sow } = makeSow();
    const def = bareDef();
    [0, 1, 2].forEach(i => { sow.sections[i].flagged = true; }); // 9 pts → Amber
    Sow.setStatus(sow.id, 'Review', def);
    // Without a rationale: refused, flagged as needing the override.
    let res = Sow.setStatus(sow.id, 'Approved', def);
    expect(res.ok).toBe(false);
    expect(res.needsOverride).toBe(true);
    expect(res.risk.tier).toBe('Amber');
    expect(Sow.get(sow.id).status).toBe('Review');
    // With a typed rationale: approved, recorded in history AND audited.
    res = Sow.setStatus(sow.id, 'Approved', def, { overrideRationale: 'Customer accepted the residual review debt at the 12 May steering board.' });
    expect(res.ok).toBe(true);
    expect(Sow.get(sow.id).status).toBe('Approved');
    const h = Sow.get(sow.id).history.find(x => x.event === 'risk_override');
    expect(h).toBeTruthy();
    expect(h.detail).toContain('Amber (9 points)');
    expect(h.detail).toContain('Customer accepted the residual review debt');
    const audit = App.data.audit_log.find(e => e.field === 'sow_risk_override');
    expect(audit).toBeTruthy();
    expect(audit.oldValue).toBe('Amber');
    expect(audit.source).toBe('user');
    // One undo reverts the whole approval (status + override record).
    App.undo();
    expect(Sow.get(sow.id).status).toBe('Review');
    expect(Sow.get(sow.id).history.some(x => x.event === 'risk_override')).toBe(false);
  });

  it('Green approves with no override prompt', () => {
    const { Sow } = app;
    noPlaybook();
    const { sow } = makeSow();
    const def = bareDef();
    Sow.setStatus(sow.id, 'Review', def);
    const res = Sow.setStatus(sow.id, 'Approved', def);
    expect(res.ok).toBe(true);
    expect(res.needsOverride).toBeUndefined();
  });

  it('the editor surfaces the tier and full breakdown atop the issues panel', () => {
    const { Sow, SowSkill } = app;
    noPlaybook();
    const { sow } = makeSow();
    sow.sections[0].flagged = true; sow.sections[0].flag_reason = 'Scope unverified';
    SowSkill.open({});
    SowSkill.edit(sow.id);
    const html = SowSkill.renderSideHtml();
    expect(html).toContain('sow-risk-chip');
    expect(html).toMatch(/Green · 3 pts/);
    expect(html).toContain('Unresolved flag: Scope unverified');   // every point traceable
  });
});

describe('AI narration of the score (optional, mock adapter)', () => {
  it('is grounded only in the rubric facts and rendered escaped', async () => {
    const { Sow, SowSkill, AI } = app;
    noPlaybook();
    configureMock();
    const { sow } = makeSow();
    sow.sections[0].flagged = true; sow.sections[0].flag_reason = 'Needs review';
    SowSkill.open({});
    SowSkill.edit(sow.id);
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ advice: 'Fix the <b>flag</b> on Executive Summary first — it carries the whole score.' }) }]);
    await SowSkill.uiExplainRisk();
    expect(SowSkill._riskNarration).toContain('Fix the <b>flag</b>');
    // The prompt carried ONLY the rubric fact pack.
    const userMsg = AI.ADAPTERS.mock._calls[0].messages.find(m => m.role === 'user');
    expect(userMsg.content).toContain('<risk_facts>');
    expect(userMsg.content).toContain('Needs review');
    // Rendered escaped.
    const html = SowSkill.renderSideHtml();
    expect(html).toContain('&lt;b&gt;flag&lt;/b&gt;');
    expect(html).not.toContain('<b>flag</b>');
  });

  it('the narration affordance is hidden when no model is configured', () => {
    const { SowSkill, AI } = app;
    noPlaybook();
    // Explicitly no profiles (the seed Ollama profile counts as configured).
    AI.saveSettings({ profiles: [], defaultProfileId: null, taskDefaults: {} });
    expect(AI.isConfigured()).toBe(false);
    const { sow } = makeSow();
    sow.sections[0].flagged = true;
    SowSkill.open({});
    SowSkill.edit(sow.id);
    expect(SowSkill.renderSideHtml()).not.toContain('What to fix first');
  });
});
