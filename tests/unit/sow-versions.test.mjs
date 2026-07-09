// sow-versions: append-only version history with a pure word-level LCS diff
// (diffWords), snapshots on Review/Approved + on demand, semver amendment
// lifecycle with an immutable signed snapshot, migration backfill from the
// legacy baseline, and an AI "what changed since v…" grounded summary (mock).

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
});
afterEach(() => app.teardown());

function makeSow(bySection) {
  const def = sowDef();
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
  app.Sow.get(sow.id).sections.forEach(s => { s.flagged = false; s.flag_reason = ''; });
  return { sow: app.Sow.get(sow.id), def };
}

describe('diffWords — pure word-level LCS', () => {
  it('marks a pure insertion', () => {
    const t = app.Sow.diffWords('the quick fox', 'the quick brown fox');
    expect(t.filter(x => x.type === 'del')).toHaveLength(0);
    const ins = t.filter(x => x.type === 'ins').map(x => x.text).join('');
    expect(ins).toContain('brown');
    // equal runs preserve the surrounding words.
    expect(t.map(x => x.text).join('')).toBe('the quick brown fox');
  });

  it('marks a pure deletion', () => {
    const t = app.Sow.diffWords('the quick brown fox', 'the quick fox');
    expect(t.filter(x => x.type === 'ins')).toHaveLength(0);
    expect(t.filter(x => x.type === 'del').map(x => x.text).join('')).toContain('brown');
  });

  it('marks a replacement as delete + insert', () => {
    const t = app.Sow.diffWords('payable within 30 days', 'payable within 45 days');
    expect(t.some(x => x.type === 'del' && /30/.test(x.text))).toBe(true);
    expect(t.some(x => x.type === 'ins' && /45/.test(x.text))).toBe(true);
    // Reconstruct: equal + ins tokens rebuild the NEW text.
    expect(t.filter(x => x.type !== 'del').map(x => x.text).join('')).toBe('payable within 45 days');
  });

  it('is empty-safe and identical-safe', () => {
    expect(app.Sow.diffWords('', '')).toEqual([]);
    const same = app.Sow.diffWords('same text here', 'same text here');
    expect(same.every(x => x.type === 'equal')).toBe(true);
  });
});

describe('version snapshots on transitions', () => {
  it('appends a snapshot on Review and a signed snapshot on Approved', () => {
    const { Sow } = app;
    const { sow, def } = makeSow();
    const defn = def.files ? def.files.definition : def; // Definitions.loadJson returns the JSON directly
    expect((sow.versions || []).length).toBe(0);
    Sow.setStatus(sow.id, 'Review', defn);
    expect(sow.versions.length).toBe(1);
    expect(sow.versions[0].status).toBe('Review');
    expect(sow.versions[0].signed).toBe(false);
    Sow.setStatus(sow.id, 'Approved', defn);
    expect(sow.versions.length).toBe(2);
    const signed = sow.versions[sow.versions.length - 1];
    expect(signed.signed).toBe(true);
    expect(signed.version).toBe('1.0');
    // Snapshot is a deep copy of section content.
    expect(signed.sections.find(s => s.id === 'scope')).toBeTruthy();
  });

  it('captures an on-demand snapshot as one undo', () => {
    const { Sow, App } = app;
    const { sow } = makeSow();
    const before = App.undoStack.length;
    Sow.snapshotVersion(sow.id);
    expect(sow.versions.length).toBe(1);
    expect(App.undoStack.length).toBe(before + 1);
  });
});

describe('amendment lifecycle', () => {
  it('bumps the version and preserves the signed snapshot immutably', () => {
    const { Sow } = app;
    const { sow, def } = makeSow();
    const defn = def;
    Sow.setStatus(sow.id, 'Review', defn);
    Sow.setStatus(sow.id, 'Approved', defn);
    expect(sow.version).toBe('1.0');
    const signed = sow.versions.find(v => v.signed && v.version === '1.0');
    const signedScopeBefore = signed.sections.find(s => s.id === 'scope').content;

    const res = Sow.openAmendment(sow.id);
    expect(res.ok).toBe(true);
    expect(sow.version).toBe('1.1');
    expect(sow.status).toBe('Draft');

    // Editing a section post-amendment must NOT rewrite the signed 1.0 snapshot
    // (kept long enough to remain approvable).
    Sow.updateSection(sow.id, 'scope', 'Completely rewritten ' + Array.from({ length: 40 }, (_, i) => 'amended' + i).join(' '));
    const signedAfter = sow.versions.find(v => v.signed && v.version === '1.0');
    expect(signedAfter.sections.find(s => s.id === 'scope').content).toBe(signedScopeBefore);

    // Re-approval keeps the amendment version (1.1), now signed.
    Sow.setStatus(sow.id, 'Review', defn);
    Sow.setStatus(sow.id, 'Approved', defn);
    expect(sow.version).toBe('1.1');
    expect(sow.versions.some(v => v.signed && v.version === '1.1')).toBe(true);
  });

  it('supports a major bump and refuses on a non-approved doc', () => {
    const { Sow } = app;
    const { sow, def } = makeSow();
    expect(Sow.openAmendment(sow.id).ok).toBe(false); // still Draft
    Sow.setStatus(sow.id, 'Review', def);
    Sow.setStatus(sow.id, 'Approved', def);
    Sow.openAmendment(sow.id, { major: true });
    expect(sow.version).toBe('2.0');
  });
});

describe('migration backfill', () => {
  it('backfills versions[] from an existing per-section baseline', () => {
    const { App } = app;
    // Inject legacy SoWs (no versions[]) into the loaded data and re-migrate.
    App.data.sows.push({
      id: 'SOW-legacy', customer: 'Acme Industries', status: 'Approved', version: '1.0',
      sections: [
        { id: 'scope', title: 'Scope', content: 'current scope', baseline: 'signed scope', baseline_status: 'Approved', baseline_at: '2026-03-01T00:00:00Z', comments: [] },
        { id: 'commercials', title: 'Commercials', content: 'current comm', baseline: 'signed comm', comments: [] }
      ],
      history: []
    });
    App.data.sows.push({
      id: 'SOW-fresh', customer: 'Acme Industries', status: 'Draft', version: '0.1',
      sections: [{ id: 'scope', title: 'Scope', content: 'x', comments: [] }], history: []
    });
    App.migrateSchema(App.data);
    const legacy = App.data.sows.find(s => s.id === 'SOW-legacy');
    expect(Array.isArray(legacy.versions)).toBe(true);
    expect(legacy.versions.length).toBe(1);
    expect(legacy.versions[0].signed).toBe(true);
    expect(legacy.versions[0].sections.find(x => x.id === 'scope').content).toBe('signed scope');
    // A baseline-less legacy SoW gets an empty (never-flagged) history.
    const fresh = App.data.sows.find(s => s.id === 'SOW-fresh');
    expect(fresh.versions).toEqual([]);
  });
});

describe('AI change summary (mock)', () => {
  it('summarises the diff between the signed version and now, grounded + untrusted-wrapped', async () => {
    const { Sow, SowSkill, AI } = app;
    const pid = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(pid);
    const { sow, def } = makeSow({ scope: 'We will build the sales dashboard.' });
    Sow.setStatus(sow.id, 'Review', def);
    Sow.setStatus(sow.id, 'Approved', def);
    Sow.openAmendment(sow.id);
    Sow.updateSection(sow.id, 'scope', 'We will build the sales AND finance dashboards.');

    SowSkill._sowId = sow.id; SowSkill._mode = 'edit'; SowSkill._compareVersionId = null;
    AI.ADAPTERS.mock.program([{ text: 'Scope broadened to add the finance dashboard.' }]);
    await SowSkill.uiVersionSummary();

    expect(SowSkill._versionSummary).toBeTruthy();
    expect(SowSkill._versionSummary.text).toMatch(/finance/i);
    const userMsg = AI.ADAPTERS.mock._calls[0].messages.find(m => m.role === 'user');
    expect(userMsg.content).toContain('<untrusted_document>');
    expect(userMsg.content).toContain('finance');
  });
});
