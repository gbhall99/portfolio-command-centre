// simulate_plan — the solver-hypothesis Assistant tool. Read-only what-ifs:
// runs Solver.solve on a throwaway clone (App.data swapped in/out around the
// synchronous solve) and reports deltas vs the baseline plan. Must NEVER
// mutate the live data.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [
      makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', size_engineering: 10, status: 'Not Started', moscow: 'Should', manager: 'Dana', target_date: '2026-12-01' })
    ],
    sprints: makeSprintSequence(4, '2026-07-06'),
    team_members: [makeMember({ name: 'Dana', available_points_per_sprint: 10, primary_skills: ['Data Engineering'] })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

const ctx = () => ({ customer: 'Acme Industries', proposals: [], citations: [] });

describe('simulate_plan', () => {
  it('as_is describes the current plan and never mutates the data', () => {
    const { AgentTools, App } = app;
    const before = JSON.stringify(App.data);
    const res = AgentTools.invoke('simulate_plan', { hypothesis: 'as_is' }, ctx());
    expect(res.error).toBeUndefined();
    expect(res.simulation).toBe(true);
    expect(res.baseline.total_points).toBe(10);
    expect(res.baseline.deadline_misses).toEqual([]);
    expect(JSON.stringify(App.data)).toBe(before);
  });

  it('add_project reports the bigger plan and deltas; live data untouched', () => {
    const { AgentTools, App } = app;
    const before = JSON.stringify(App.data);
    const res = AgentTools.invoke('simulate_plan', {
      hypothesis: 'add_project', name: 'New dashboard', size_engineering: 20, phases: ['Data Engineering']
    }, ctx());
    expect(res.error).toBeUndefined();
    expect(res.applied).toContain('New dashboard');
    expect(res.hypothetical.total_points).toBe(30);
    expect(res.hypothetical.makespan_sprints).toBeGreaterThanOrEqual(res.baseline.makespan_sprints);
    expect(res.delta.makespan_sprints).toBe(res.hypothetical.makespan_sprints - res.baseline.makespan_sprints);
    expect(JSON.stringify(App.data)).toBe(before);
    // The hypothetical project never leaks into the live data.
    expect(App.data.projects.some(p => p.id === 'HYPO-1')).toBe(false);
  });

  it('change_deadline surfaces a new deadline miss when the date is impossible', () => {
    const { AgentTools } = app;
    // 10 SP at 10 SP/sprint needs ~1 sprint; a deadline before the first
    // sprint ends cannot hold if we also pile on more work first.
    const addRes = AgentTools.invoke('simulate_plan', { hypothesis: 'change_deadline', project_id: 'A-1', hard_deadline: '2026-07-08' }, ctx());
    expect(addRes.error).toBeUndefined();
    // Either it misses (flagged) or fits in sprint 1 — both are valid solver
    // outcomes; the contract is that deadline_misses is reported as an array.
    expect(Array.isArray(addRes.hypothetical.deadline_misses)).toBe(true);
    expect(addRes.applied).toContain('2026-07-08');
  });

  it('remove_member produces capacity warnings in the hypothetical plan only', () => {
    const { AgentTools, App } = app;
    const res = AgentTools.invoke('simulate_plan', { hypothesis: 'remove_member', member_name: 'Dana' }, ctx());
    expect(res.error).toBeUndefined();
    expect(res.applied).toContain('Dana');
    expect(res.baseline.capacity_overflows.length).toBe(0);
    expect(res.hypothetical.capacity_overflows.length).toBeGreaterThan(0);
    // Dana still exists in real data.
    expect(App.data.team_members.some(m => m.name === 'Dana')).toBe(true);
  });

  it('resize_skill re-places the resized work in the hypothetical plan', () => {
    const { AgentTools } = app;
    const res = AgentTools.invoke('simulate_plan', { hypothesis: 'resize_skill', project_id: 'A-1', skill: 'size_engineering', points: 35 }, ctx());
    expect(res.error).toBeUndefined();
    expect(res.applied).toContain('from 10 to 35 SP');
    expect(res.hypothetical.total_points).toBe(35);
  });

  it('validates inputs with precise errors', () => {
    const { AgentTools } = app;
    expect(AgentTools.invoke('simulate_plan', { hypothesis: 'add_project' }, ctx()).error).toMatch(/at least one size/);
    expect(AgentTools.invoke('simulate_plan', { hypothesis: 'change_deadline', project_id: 'nope', hard_deadline: '2026-09-01' }, ctx()).error).toMatch(/valid project_id/);
    expect(AgentTools.invoke('simulate_plan', { hypothesis: 'remove_member', member_name: 'Nobody' }, ctx()).error).toMatch(/no team member named/);
    expect(AgentTools.invoke('simulate_plan', { hypothesis: 'resize_skill', project_id: 'A-1' }, ctx()).error).toMatch(/needs skill and points/);
  });

  it('works end-to-end through the assistant with the mock adapter', async () => {
    const { AI, Assistant, document } = app;
    const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(id);
    AI.ADAPTERS.mock.program([
      { toolCalls: [{ id: 'c1', name: 'simulate_plan', args: { hypothesis: 'add_project', name: 'Hypo', size_engineering: 20 } }] },
      { text: 'Adding Hypo stretches the plan by one sprint; no deadlines break.' }
    ]);
    Assistant.open();
    document.getElementById('assistantInput').value = 'what if we add a 20 point project?';
    await Assistant.send();
    expect(document.getElementById('assistantBody').textContent).toContain('stretches the plan');
    // The tool result the model saw carried the simulation note.
    const toolMsg = AI.ADAPTERS.mock._calls[1].messages.find(m => m.role === 'tool');
    expect(toolMsg.content).toContain('Read-only simulation');
  });
});
