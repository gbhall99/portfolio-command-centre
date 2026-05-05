import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.computeProjectAttentionScore', () => {
  it('Blocked + 2 Red dimensions outranks a Green Implementation', async () => {
    resetIdSeq();
    const blocked = makeProject({ name: 'B', status: 'Blocked', rag_schedule: 'Red', rag_resourcing: 'Red', size_total: 5 });
    const green = makeProject({ name: 'G', status: 'In Progress', rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green', size_total: 5 });
    const app = await loadApp(makeDataset({ projects: [blocked, green] }));
    expect(app.App.computeProjectAttentionScore(blocked)).toBeGreaterThan(app.App.computeProjectAttentionScore(green));
    app.teardown();
  });

  it('lifecycle stage no longer perturbs attention score (Run/BAU == Idea on equal inputs)', async () => {
    resetIdSeq();
    const bau = makeProject({ name: 'BAU', status: 'In Progress', rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green', lifecycle_stage: 'Run/BAU', size_total: 5 });
    const idea = makeProject({ name: 'IDEA', status: 'In Progress', rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green', lifecycle_stage: 'Idea', size_total: 5 });
    const app = await loadApp(makeDataset({ projects: [bau, idea] }));
    expect(app.App.computeProjectAttentionScore(bau)).toBe(app.App.computeProjectAttentionScore(idea));
    app.teardown();
  });

  it('open risks add to score', async () => {
    resetIdSeq();
    const noRisk = makeProject({ name: 'A', status: 'In Progress', rag_schedule: 'Green' });
    const withRisks = makeProject({ name: 'B', status: 'In Progress', rag_schedule: 'Green' });
    withRisks.risks_register = [
      { description: 'r1', impact: 5, probability: 5, status: 'open' },
      { description: 'r2', impact: 4, probability: 4, status: 'open' }
    ];
    const app = await loadApp(makeDataset({ projects: [noRisk, withRisks] }));
    expect(app.App.computeProjectAttentionScore(withRisks)).toBeGreaterThan(app.App.computeProjectAttentionScore(noRisk));
    app.teardown();
  });
});
