// Phase 2.3 — AI plan explainer + on-demand drift check. Both read-only and
// grounded: explain_plan narrates solver/capacity facts (no invented numbers);
// check_plan_drift reports staleness vs the last solve. Mock adapter — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

let app;

function fixture() {
  resetIdSeq();
  const sprints = makeSprintSequence(3, '2026-07-06');
  const s0 = sprints[0].sprint_id;
  return makeDataset({
    customers: [{ name: 'Acme Industries' }],
    projects: [
      makeProject({
        id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', size_engineering: 40,
        status: 'In Progress', moscow: 'Must', manager: 'Dana', target_date: '2026-09-01',
        // Pile 40 SP of engineering into one sprint against a 10-pt capacity = binding constraint.
        skill_splits: { size_engineering: [{ sprint: s0, points: 40, status: 'pending', completed: 0, assigned_to: [], reasons: [] }] }
      })
    ],
    sprints,
    team_members: [makeMember({ name: 'Dana', available_points_per_sprint: 10, primary_skills: ['Data Engineering'] })]
  });
}

const ctx = (over) => Object.assign({ customer: 'Acme Industries', allScope: false, citations: [], proposals: [] }, over || {});

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('explain_plan', () => {
  it('returns a grounded plan summary, binding constraints and levers; never mutates', () => {
    const { AgentTools, App } = app;
    const before = JSON.stringify(App.data);
    const r = AgentTools.invoke('explain_plan', {}, ctx());
    expect(r.error).toBeUndefined();
    expect(r.plan_summary.makespan_sprints).toBeGreaterThanOrEqual(0);
    expect(typeof r.plan_summary.avg_utilisation_pct).toBe('number');
    // 40 SP against 10-pt capacity in one sprint is a binding engineering constraint.
    expect(r.binding_constraints.some(b => b.skill === 'engineering' && b.utilisation_pct >= 90)).toBe(true);
    expect(r.levers.join(' ')).toMatch(/engineering/i);
    expect(JSON.stringify(App.data)).toBe(before);
  });

  it('reports slack honestly when nothing is binding', () => {
    const { AgentTools, App } = app;
    // Drop the over-allocation: small, well-resourced plan.
    App.data.projects[0].skill_splits = {};
    App.data.projects[0].size_engineering = 5;
    const r = AgentTools.invoke('explain_plan', {}, ctx());
    expect(r.binding_constraints.length).toBe(0);
    expect(r.levers.join(' ')).toMatch(/slack/i);
  });
});

describe('check_plan_drift', () => {
  it('says the solver has not run when there is no record', () => {
    const { AgentTools } = app;
    const r = AgentTools.invoke('check_plan_drift', {}, ctx());
    expect(r.last_run).toBeNull();
    expect(r.recommend_rerun).toBe(false);
    expect(r.note).toMatch(/not been run/);
  });

  it('detects inputs changed since the last solve and recommends a re-run', () => {
    const { AgentTools, App } = app;
    // Record a solve in the past, then "touch" a project after it.
    const past = new Date(Date.now() - 5 * 3600000).toISOString();
    App.data.settings = App.data.settings || {};
    App.data.settings.solverRuns = { 'Acme Industries': { at: past, projectCount: 1 } };
    App.data.projects[0].last_updated = new Date().toISOString();
    App.data.projects[0].hard_deadline = '2026-08-15';
    const r = AgentTools.invoke('check_plan_drift', {}, ctx());
    expect(r.last_run.hours_ago).toBeGreaterThanOrEqual(4);
    expect(r.inputs_changed_since).toBe(1);
    expect(r.changed_projects).toContain('Acme Alpha');
    expect(r.deadline_affected).toBe(true);
    expect(r.recommend_rerun).toBe(true);
  });

  it('reports the plan is current when nothing changed since the solve', () => {
    const { AgentTools, App } = app;
    App.data.projects[0].last_updated = new Date(Date.now() - 9 * 3600000).toISOString();
    App.data.settings = App.data.settings || {};
    App.data.settings.solverRuns = { 'Acme Industries': { at: new Date(Date.now() - 1 * 3600000).toISOString(), projectCount: 1 } };
    const r = AgentTools.invoke('check_plan_drift', {}, ctx());
    expect(r.inputs_changed_since).toBe(0);
    expect(r.recommend_rerun).toBe(false);
    expect(r.note).toMatch(/current/);
  });
});

describe('palette intents', () => {
  it('exposes explain-plan and drift Ask AI entries', () => {
    const { CommandPalette } = app;
    const titles = CommandPalette._build().filter(i => i.group === 'Ask AI').map(i => i.title);
    expect(titles.some(t => /explain the current plan/i.test(t))).toBe(true);
    expect(titles.some(t => /is the plan still valid/i.test(t))).toBe(true);
  });
});
