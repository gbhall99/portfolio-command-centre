import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.computeWalkthroughPrompts', () => {
  it('returns a schedule_amber_mitigation prompt when schedule is amber for >=7 days', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-1', name: 'Slipping', rag_schedule: 'Amber' });
    p.last_updated = new Date(Date.now() - 14 * 86400000).toISOString();
    const app = await loadApp(makeDataset({ projects: [p] }));
    const prompts = app.App.computeWalkthroughPrompts(app.App.data.projects[0]);
    expect(prompts.some(x => x.kind === 'schedule_amber_mitigation')).toBe(true);
    app.teardown();
  });

  it('returns a stale_chip_progress prompt when project has open chips and last_updated > 14d', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-2', name: 'Stale', size_engineering: 10 });
    p.skill_splits = { size_engineering: [{ sprint: 'CY26-S1', points: 10, completed: 4, status: 'pending' }] };
    p.last_updated = new Date(Date.now() - 30 * 86400000).toISOString();
    const app = await loadApp(makeDataset({ projects: [p], sprints: makeSprintSequence(2) }));
    const prompts = app.App.computeWalkthroughPrompts(app.App.data.projects[0]);
    expect(prompts.some(x => x.kind === 'stale_chip_progress')).toBe(true);
    app.teardown();
  });

  it('returns a risk_recheck prompt for risk score >=9 open >=7 days', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-3', name: 'Risky' });
    p.risks_register = [{ description: 'data quality', impact: 3, probability: 3, status: 'open', added_at: new Date(Date.now() - 14 * 86400000).toISOString() }];
    const app = await loadApp(makeDataset({ projects: [p] }));
    const prompts = app.App.computeWalkthroughPrompts(app.App.data.projects[0]);
    expect(prompts.some(x => x.kind === 'risk_recheck')).toBe(true);
    app.teardown();
  });

  it('returns a blocked_no_decision prompt for blocked status with no decisions logged this walkthrough', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-4', name: 'Stuck', status: 'Blocked' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const prompts = app.App.computeWalkthroughPrompts(app.App.data.projects[0]);
    expect(prompts.some(x => x.kind === 'blocked_no_decision')).toBe(true);
    app.teardown();
  });

  it('returns a missing_headline prompt for Implementation projects with empty narrative.headline', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-5', name: 'NoHead' });
    p.lifecycle_stage = 'Implementation';
    const app = await loadApp(makeDataset({ projects: [p] }));
    const prompts = app.App.computeWalkthroughPrompts(app.App.data.projects[0]);
    expect(prompts.some(x => x.kind === 'missing_headline')).toBe(true);
    app.teardown();
  });

  it('returns a red_no_decision prompt when schedule is Red with no decision in the latest walkthrough', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-RED', name: 'Critical', rag_schedule: 'Red' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    app.App.startWalkthrough('GCC', []);
    const prompts = app.App.computeWalkthroughPrompts(app.App.data.projects[0]);
    expect(prompts.some(x => x.kind === 'red_no_decision')).toBe(true);
    app.teardown();
  });

  it('returns no prompts for a healthy on-track project', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-6', name: 'Healthy', rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green', status: 'In Progress' });
    p.last_updated = new Date().toISOString();
    p.narrative = { headline: 'Phase 1 on track', wins: [], asks: [], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    p.lifecycle_stage = 'Run/BAU';
    const app = await loadApp(makeDataset({ projects: [p] }));
    const prompts = app.App.computeWalkthroughPrompts(app.App.data.projects[0]);
    expect(prompts).toEqual([]);
    app.teardown();
  });
});
