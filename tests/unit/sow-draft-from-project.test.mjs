// S1 — SOW first draft generated from the project's own data.
// Sow.groundingFor builds a read-only fact pack; SowSkill.generateFromProject
// drafts a governed SOW grounded in it. Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }],
    metrics: [makeMetric({ id: 'MET-1', name: 'Churn rate', customer: 'Acme Industries', target: '5%' })],
    projects: [
      makeProject({
        id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', status: 'In Progress',
        manager: 'Avery Nolan', sponsor: 'Dana Sponsor', description: 'Replace the legacy churn model.',
        target_date: '2026-09-30',
        size_engineering: 12, size_requirements: 4, size_total: 16,
        delivery_config: { phase_order: ['Requirements', 'Data Engineering', 'UAT'] },
        phases: { Requirements: { status: 'complete' }, 'Data Engineering': { status: 'in_progress' } },
        metric_ids: ['MET-1'],
        outcomes: [{ id: 'o1', type: 'benefit', description: 'Cut churn', target: '20', unit: '%' }],
        assumptions_register: [{ id: 'a1', description: 'Source data access granted', status: 'open' }],
        risks_register: [
          { id: 'r1', description: 'Vendor SLA risk', impact: 5, probability: 4, status: 'open' }, // severe (20)
          { id: 'r2', description: 'Minor copy tweak', impact: 1, probability: 1, status: 'open' }  // not severe
        ]
      })
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function configureMock() {
  const id = app.AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
  app.AI.setDefaultProfile(id);
}

describe('Sow.groundingFor', () => {
  it('builds a read-only fact pack from the project', () => {
    const g = app.Sow.groundingFor('A-1');
    expect(g.project).toMatchObject({ name: 'Acme Alpha', customer: 'Acme Industries', manager: 'Avery Nolan', sponsor: 'Dana Sponsor', target_date: '2026-09-30' });
    expect(g.delivery.size_total).toBe(16);
    expect(g.delivery.sizes.engineering).toBe(12);
    expect(g.delivery.phases.map(p => p.phase)).toEqual(['Requirements', 'Data Engineering', 'UAT']);
    expect(g.outcomes[0]).toMatchObject({ type: 'benefit', description: 'Cut churn', target: '20 %' });
    expect(g.metrics).toEqual([{ name: 'Churn rate', target: '5%' }]);
    expect(g.assumptions).toEqual(['Source data access granted']);
    // only the severe risk is surfaced
    expect(g.risks).toEqual(['Vendor SLA risk']);
  });

  it('returns null for a missing project and never mutates the project', () => {
    const before = JSON.stringify(app.App.data.projects.find(p => p.id === 'A-1'));
    expect(app.Sow.groundingFor('NOPE')).toBe(null);
    app.Sow.groundingFor('A-1');
    expect(JSON.stringify(app.App.data.projects.find(p => p.id === 'A-1'))).toBe(before);
  });
});

describe('SowSkill.generateFromProject', () => {
  it('drafts a governed SOW grounded in the project, linked + audited', async () => {
    const { AI, Sow, SowSkill, App } = app;
    configureMock();
    const def = app.Definitions.loadJson('sow/sow-definition.json');
    const filler = Array.from({ length: 50 }, (_, i) => 'w' + i).join(' ');
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({
      project_name: 'Acme Alpha',
      sections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true }))
    }) }]);

    const before = Sow.list('Acme Industries').length;
    await SowSkill.generateFromProject('A-1');

    const sows = Sow.list('Acme Industries');
    expect(sows.length).toBe(before + 1);
    const sow = sows[sows.length - 1];
    expect(sow.project_id).toBe('A-1');
    expect(sow.customer).toBe('Acme Industries');
    // sections follow the definition (ids + order)
    expect(sow.sections.map(s => s.id)).toEqual(def.sections.slice().sort((a, b) => a.order - b.order).map(s => s.id));
    // audited as an AI-from-project write
    expect(App.data.audit_log.some(e => /sow_created/.test(e.field || ''))).toBe(true);
    expect(sow.history.some(h => h.event === 'created')).toBe(true);
  });

  it('does nothing when the project does not exist', async () => {
    const { Sow, SowSkill } = app;
    configureMock();
    const before = Sow.list('Acme Industries').length;
    await SowSkill.generateFromProject('NOPE');
    expect(Sow.list('Acme Industries').length).toBe(before);
  });
});
