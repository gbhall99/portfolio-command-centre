// Phase 1.2 — triage/hygiene agent (tidy_portfolio): deterministic detection,
// every fix a confirmable proposal, applied/undone individually or as a batch.
// Phase 1.3 — ⌘K → agent bridge: palette entries route a typed intent into the
// Assistant, scoped to the current customer. Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

function fixture() {
  resetIdSeq();
  return makeDataset({
    customers: [{ name: 'Acme Industries' }, { name: 'Globex' }],
    projects: [
      makeProject({
        id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', priority: 2,
        risks_register: [
          { description: 'Data feed unstable', impact: 4, probability: 3 },
          { description: '  data feed   UNSTABLE ', impact: 2, probability: 2 }, // dup (normalised)
          { description: 'Scope unclear', impact: 3, probability: 3 }
        ],
        issues_register: []
      }),
      makeProject({ id: 'A-2', name: 'Acme Beta', customer: 'Acme Industries', priority: 2 }), // dup priority
      makeProject({ id: 'A-3', name: 'Acme Gamma', customer: 'Acme Industries', priority: 7 }), // gap
      makeProject({ id: 'G-1', name: 'Globex One', customer: 'Globex', priority: 1 })
    ]
  });
}

const ctx = (over) => Object.assign({ customer: 'Acme Industries', allScope: false, citations: [], proposals: [] }, over || {});

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('1.2 tidy_portfolio', () => {
  it('detects a duplicate risk and priority disorder, proposing one fix each — nothing mutates', () => {
    const { AgentTools, App } = app;
    const c = ctx();
    const r = AgentTools.invoke('tidy_portfolio', {}, c);
    expect(r.proposed).toBe(true);
    expect(r.categories.duplicate_raid).toBe(1);
    expect(r.categories.priority).toBe(1);
    expect(c.proposals.length).toBe(2);
    // Read-only detection: the duplicate is still open, priorities unchanged.
    expect(App.data.projects.find(p => p.id === 'A-1').risks_register[1].resolution_date).toBeUndefined();
    expect(App.data.projects.find(p => p.id === 'A-2').priority).toBe(2);
  });

  it('applies only the toggled fixes via the batch runner, audited ai, one undo', () => {
    const { AgentTools, App } = app;
    const c = ctx();
    AgentTools.invoke('tidy_portfolio', {}, c);
    const undoBefore = App.undoStack.length;
    // Apply both as one batch (the Assistant path).
    const res = App.runBatch('tidy', c.proposals.map(p => () => p.apply()));
    expect(res.applied).toBe(2);
    // Duplicate risk closed.
    expect(App.data.projects.find(p => p.id === 'A-1').risks_register[1].resolution_date).toBeTruthy();
    // Priorities normalised to a clean 1..N (A-1 & A-2 were both 2; stable by name).
    const byId = id => App.data.projects.find(p => p.id === id).priority;
    expect([byId('A-1'), byId('A-2'), byId('A-3')].sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'raid_risk_closed')).toBe(true);
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'priority')).toBe(true);
    // One batch = one undo reverts everything.
    expect(App.undoStack.length).toBe(undoBefore + 1);
    App.undo();
    expect(App.data.projects.find(p => p.id === 'A-1').risks_register[1].resolution_date).toBeUndefined();
    expect(App.data.projects.find(p => p.id === 'A-2').priority).toBe(2);
  });

  it('reports a clean portfolio when there is nothing to fix', () => {
    const { AgentTools, App } = app;
    // Remove the duplicate and fix priorities so nothing is flagged.
    const p1 = App.data.projects.find(p => p.id === 'A-1');
    p1.risks_register = [{ description: 'only one' }];
    App.data.projects.find(p => p.id === 'A-1').priority = 1;
    App.data.projects.find(p => p.id === 'A-2').priority = 2;
    App.data.projects.find(p => p.id === 'A-3').priority = 3;
    const c = ctx();
    const r = AgentTools.invoke('tidy_portfolio', {}, c);
    expect(r.proposed).toBe(false);
    expect(r.note).toMatch(/looks tidy/);
    expect(c.proposals.length).toBe(0);
  });

  it('is scoped to the active customer (Globex is untouched)', () => {
    const { AgentTools, App } = app;
    const c = ctx();
    AgentTools.invoke('tidy_portfolio', {}, c);
    App.runBatch('tidy', c.proposals.map(p => () => p.apply()));
    // Globex priority never renumbered relative to Acme.
    expect(App.data.projects.find(p => p.id === 'G-1').priority).toBe(1);
  });

  it('stays scoped to the working customer under the All-customers filter (allScope)', () => {
    const { AgentTools, App } = app;
    // Both customers already hold clean per-customer 1..N sequences.
    App.data.projects.find(p => p.id === 'A-1').risks_register = [{ description: 'only one' }];
    App.data.projects.find(p => p.id === 'A-1').priority = 1;
    App.data.projects.find(p => p.id === 'A-2').priority = 2;
    App.data.projects.find(p => p.id === 'A-3').priority = 3;
    // Clean per customer, but the cross-customer union (A:1, G:1, A:2, A:3)
    // would look dirty if the scan wrongly aggregated under allScope.
    const clean = AgentTools.invoke('tidy_portfolio', {}, ctx({ allScope: true }));
    expect(clean.proposed).toBe(false);

    // Now make Acme dirty again: the proposal must only touch Acme projects.
    App.data.projects.find(p => p.id === 'A-2').priority = 5;
    const c = ctx({ allScope: true });
    const r = AgentTools.invoke('tidy_portfolio', {}, c);
    expect(r.proposed).toBe(true);
    const globexNames = ['Globex One'];
    c.proposals.forEach(prop => {
      expect(prop.entity.name === 'Globex' || globexNames.includes(prop.entity.name)).toBe(false);
      (prop.changes || []).forEach(ch => expect(globexNames.includes(ch.field)).toBe(false));
    });
    App.runBatch('tidy', c.proposals.map(p => () => p.apply()));
    // Both customers retain clean per-customer 1..N sequences.
    const byId = id => App.data.projects.find(p => p.id === id).priority;
    expect([byId('A-1'), byId('A-2'), byId('A-3')].sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(byId('G-1')).toBe(1);
  });
});

describe('1.3 ⌘K → agent bridge', () => {
  it('builds Ask AI palette entries that route a typed intent into the Assistant', () => {
    const { CommandPalette, Assistant } = app;
    let asked = null;
    const orig = Assistant.ask;
    Assistant.ask = (t) => { asked = t; };
    try {
      const items = CommandPalette._build();
      const ai = items.filter(i => i.group === 'Ask AI');
      expect(ai.length).toBeGreaterThanOrEqual(3);
      // Scope label reflects the active customer.
      expect(ai[0].meta).toContain('Acme Industries');
      const tidy = ai.find(i => /tidy up the portfolio/i.test(i.title));
      expect(tidy).toBeTruthy();
      tidy.action();
      expect(asked).toMatch(/duplicate RAID/i);
    } finally {
      Assistant.ask = orig;
    }
  });

  it('adds a context-aware SOW entry only when a project is open', () => {
    const { CommandPalette, DetailPanel } = app;
    expect(CommandPalette._build().some(i => i.group === 'Ask AI' && /draft a SOW/i.test(i.title))).toBe(false);
    DetailPanel.currentId = 'A-1';
    try {
      expect(CommandPalette._build().some(i => i.group === 'Ask AI' && /draft a SOW/i.test(i.title))).toBe(true);
    } finally {
      DetailPanel.currentId = null;
    }
  });
});
