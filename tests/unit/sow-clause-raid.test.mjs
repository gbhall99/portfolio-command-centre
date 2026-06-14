// S2 — SOW: auto-populate Assumptions/Out-of-Scope from the linked project's
// RAID, plus a governed clause library. Provenance lands on section.sources[];
// every write is audited + undoable. No network (no model is used here).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }],
    projects: [
      makeProject({
        id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries',
        assumptions_register: [
          { id: 'a1', description: 'Source data access granted', status: 'open' },
          { id: 'a2', description: 'Closed assumption', status: 'closed' }
        ],
        risks_register: [
          { id: 'r1', description: 'Vendor SLA risk', impact: 5, probability: 4, status: 'open' }, // 20 — severe
          { id: 'r2', description: 'Minor copy tweak', impact: 1, probability: 1, status: 'open' }, // 1 — not severe
          { id: 'r3', description: 'Mitigated severe', impact: 5, probability: 5, status: 'mitigated' }
        ]
      })
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function definition() { return app.Definitions.loadJson('sow/sow-definition.json'); }

function makeLinkedSow(projectId = 'A-1') {
  return app.Sow.create({
    customer: 'Acme Industries', project_id: projectId,
    definition: definition(), generatedSections: [],
    name: 'Statement of Work — Acme Alpha', source: 'user'
  });
}

describe('clause library', () => {
  it('loads the governed clause set for the customer', () => {
    const clauses = app.Sow.clauses('Acme Industries');
    expect(clauses.length).toBeGreaterThan(0);
    expect(clauses.map(c => c.id)).toContain('payment_terms');
    const c = app.Sow.clause('payment_terms', 'Acme Industries');
    expect(c).toBeTruthy();
    expect(c.section_hint).toBe('commercials');
  });
});

describe('Sow.pullFromRaid', () => {
  it('pulls only OPEN assumptions into Assumptions & Dependencies with provenance', () => {
    const sow = makeLinkedSow();
    const before = app.App.data.activity_log ? app.App.data.activity_log.length : 0;
    const res = app.Sow.pullFromRaid(sow.id, 'assumptions_dependencies');
    expect(res.ok).toBe(true);
    expect(res.added).toBe(1);
    const sec = app.Sow.get(sow.id).sections.find(s => s.id === 'assumptions_dependencies');
    expect(sec.content).toContain('Source data access granted');
    expect(sec.content).not.toContain('Closed assumption');
    expect(sec.sources.filter(s => s.kind === 'raid' && s.raid_kind === 'assumption').length).toBe(1);
    expect(sec.sources[0].ref).toBe('a1');
  });

  it('pulls only OPEN, high-severity risks into Out of Scope', () => {
    const sow = makeLinkedSow();
    const res = app.Sow.pullFromRaid(sow.id, 'out_of_scope');
    expect(res.ok).toBe(true);
    expect(res.added).toBe(1); // only r1 (severe, open)
    const sec = app.Sow.get(sow.id).sections.find(s => s.id === 'out_of_scope');
    expect(sec.content).toContain('Vendor SLA risk');
    expect(sec.content).not.toContain('Minor copy tweak');
    expect(sec.content).not.toContain('Mitigated severe');
  });

  it('is idempotent — a second pull adds nothing new', () => {
    const sow = makeLinkedSow();
    expect(app.Sow.pullFromRaid(sow.id, 'assumptions_dependencies').ok).toBe(true);
    const second = app.Sow.pullFromRaid(sow.id, 'assumptions_dependencies');
    expect(second.ok).toBe(false);
    const sec = app.Sow.get(sow.id).sections.find(s => s.id === 'assumptions_dependencies');
    // only one bullet for the single open assumption
    expect((sec.content.match(/Source data access granted/g) || []).length).toBe(1);
  });

  it('refuses to pull on a section that does not map to RAID', () => {
    const sow = makeLinkedSow();
    expect(app.Sow.pullFromRaid(sow.id, 'executive_summary').ok).toBe(false);
  });

  it('requires a linked project', () => {
    const sow = app.Sow.create({ customer: 'Acme Industries', project_id: null, definition: definition(), generatedSections: [], name: 'Unlinked', source: 'user' });
    const res = app.Sow.pullFromRaid(sow.id, 'assumptions_dependencies');
    expect(res.ok).toBe(false);
  });

  it('is undoable', () => {
    const sow = makeLinkedSow();
    app.Sow.pullFromRaid(sow.id, 'assumptions_dependencies');
    app.App.undo();
    const sec = app.Sow.get(sow.id).sections.find(s => s.id === 'assumptions_dependencies');
    expect(sec.content).not.toContain('Source data access granted');
  });
});

describe('Sow.insertClause', () => {
  it('appends the clause text and records provenance', () => {
    const sow = makeLinkedSow();
    const res = app.Sow.insertClause(sow.id, 'commercials', 'payment_terms');
    expect(res.ok).toBe(true);
    const sec = app.Sow.get(sow.id).sections.find(s => s.id === 'commercials');
    expect(sec.content).toContain('payable within 30 days');
    expect(sec.sources.some(s => s.kind === 'clause' && s.ref === 'payment_terms')).toBe(true);
  });

  it('inserts a clause at most once per section', () => {
    const sow = makeLinkedSow();
    expect(app.Sow.insertClause(sow.id, 'commercials', 'payment_terms').ok).toBe(true);
    expect(app.Sow.insertClause(sow.id, 'commercials', 'payment_terms').ok).toBe(false);
  });

  it('rejects an unknown clause', () => {
    const sow = makeLinkedSow();
    expect(app.Sow.insertClause(sow.id, 'commercials', 'nope').ok).toBe(false);
  });

  it('is undoable', () => {
    const sow = makeLinkedSow();
    app.Sow.insertClause(sow.id, 'commercials', 'payment_terms');
    app.App.undo();
    const sec = app.Sow.get(sow.id).sections.find(s => s.id === 'commercials');
    expect(sec.content).not.toContain('payable within 30 days');
  });
});

describe('migration', () => {
  it('backfills section.sources[] on legacy SOWs', () => {
    const data = app.App.data;
    data.sows.push({
      id: 'SOW-legacy', customer: 'Acme Industries', project_id: null, status: 'Draft',
      sections: [{ id: 'scope', title: 'Scope', content: 'x', comments: [] }], history: []
    });
    app.App.migrateSchema(data);
    const sec = data.sows.find(s => s.id === 'SOW-legacy').sections[0];
    expect(Array.isArray(sec.sources)).toBe(true);
  });
});
