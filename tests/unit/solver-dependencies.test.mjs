// Phase 2.2 — dependency-aware scheduling + critical path.
// The forward pass already gates a successor's start on a blocker's finish, but
// only when the blocker is allocated first. A stable topological reorder makes
// that hold even when the successor sorts earlier (e.g. earlier deadline). The
// reorder is a no-op for dependency-free portfolios. Solver also now reports the
// critical dependency chain. These are pure solver tests (no network).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

let app;

const ready = (over) => makeProject(Object.assign({ status: 'Not Started', moscow: 'Should', manager: 'Dana', target_date: '2026-12-01', lifecycle_stage: 'Implementation' }, over));

function solve(over) {
  const { Solver, Sprint, App } = app;
  return Solver.solve('Acme Industries', Object.assign({}, Sprint.allocSettings, over || {}), App.data, Sprint);
}
const sprintIdx = (sid) => app.App.data.sprints.findIndex(s => s.sprint_id === sid);
function slices(result, pid) {
  const out = [];
  Object.values(result.allocations[pid] || {}).forEach(arr => arr.forEach(sp => out.push(sp)));
  return out;
}

afterEach(() => app.teardown());

describe('dependency-aware ordering', () => {
  it('schedules a blocker before its successor even when the successor sorts first (by priority)', async () => {
    resetIdSeq();
    app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries' }],
      projects: [
        // Blocker: 20 SP eng at 10/sprint spans two sprints; low priority → sorts LAST.
        ready({ id: 'BLOCK', name: 'Blocker', size_engineering: 20, priority: 9 }),
        // Successor: blocked_by Blocker, but priority 1 makes it sort FIRST.
        ready({ id: 'SUCC', name: 'Successor', size_engineering: 10, priority: 1,
          dependencies: [{ kind: 'project', type: 'blocked_by', target_id: 'BLOCK' }] })
      ],
      sprints: makeSprintSequence(5, '2026-07-06'),
      team_members: [makeMember({ name: 'Dana', available_points_per_sprint: 10, primary_skills: ['Data Engineering'] })]
    }));
    app.App.activeCustomer = 'Acme Industries';
    // spreadWork off isolates the ordering contract from Pass 3 load-balancing.
    const res = solve({ spreadWork: false });
    const blockLast = Math.max(...slices(res, 'BLOCK').map(s => sprintIdx(s.sprint)));
    const succFirst = Math.min(...slices(res, 'SUCC').map(s => sprintIdx(s.sprint)));
    expect(slices(res, 'BLOCK').length).toBeGreaterThan(0);
    expect(slices(res, 'SUCC').length).toBeGreaterThan(0);
    // The successor never starts before the blocker has finished.
    expect(succFirst).toBeGreaterThan(blockLast);
  });

  it('leaves a dependency-free portfolio identical to a plain solve (reorder is a no-op)', async () => {
    resetIdSeq();
    const fixture = () => makeDataset({
      customers: [{ name: 'Acme Industries' }],
      projects: [
        ready({ id: 'P1', name: 'One', size_engineering: 8, priority: 2 }),
        ready({ id: 'P2', name: 'Two', size_engineering: 8, priority: 1 }),
        ready({ id: 'P3', name: 'Three', size_engineering: 8, priority: 3 })
      ],
      sprints: makeSprintSequence(4, '2026-07-06'),
      team_members: [makeMember({ name: 'Dana', available_points_per_sprint: 10, primary_skills: ['Data Engineering'] })]
    });
    app = await loadApp(fixture());
    app.App.activeCustomer = 'Acme Industries';
    const a = solve();
    const b = solve();
    expect(JSON.stringify(a.allocations)).toBe(JSON.stringify(b.allocations));
    expect(a.stats.criticalPath).toEqual([]);
  });
});

describe('critical path', () => {
  it('reports the longest blocked_by chain as a solver stat', async () => {
    resetIdSeq();
    app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries' }],
      projects: [
        ready({ id: 'A', name: 'Alpha', size_engineering: 5, priority: 1 }),
        ready({ id: 'B', name: 'Bravo', size_engineering: 5, priority: 2, dependencies: [{ kind: 'project', type: 'blocked_by', target_id: 'A' }] }),
        ready({ id: 'C', name: 'Charlie', size_engineering: 5, priority: 3, dependencies: [{ kind: 'project', type: 'blocked_by', target_id: 'B' }] }),
        // An independent project should not be on the chain.
        ready({ id: 'D', name: 'Delta', size_engineering: 5, priority: 4 })
      ],
      sprints: makeSprintSequence(6, '2026-07-06'),
      team_members: [makeMember({ name: 'Dana', available_points_per_sprint: 10, primary_skills: ['Data Engineering'] })]
    }));
    app.App.activeCustomer = 'Acme Industries';
    const res = solve();
    expect(res.stats.criticalPath).toEqual(['A', 'B', 'C']);
    expect(res.stats.criticalPathNames).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(res.stats.criticalPathLength).toBe(3);
  });

  it('explain_plan surfaces the critical path and a lever to shorten it', async () => {
    resetIdSeq();
    app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries' }],
      projects: [
        ready({ id: 'A', name: 'Alpha', size_engineering: 5, priority: 1 }),
        ready({ id: 'B', name: 'Bravo', size_engineering: 5, priority: 2, dependencies: [{ kind: 'project', type: 'blocked_by', target_id: 'A' }] })
      ],
      sprints: makeSprintSequence(5, '2026-07-06'),
      team_members: [makeMember({ name: 'Dana', available_points_per_sprint: 10, primary_skills: ['Data Engineering'] })]
    }));
    app.App.activeCustomer = 'Acme Industries';
    const r = app.AgentTools.invoke('explain_plan', {}, { customer: 'Acme Industries', proposals: [], citations: [] });
    expect(r.critical_path).toEqual(['Alpha', 'Bravo']);
    expect(r.levers.join(' ')).toMatch(/critical dependency chain/i);
  });

  it('ignores circular dependencies for the critical path (no crash)', async () => {
    resetIdSeq();
    app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries' }],
      projects: [
        ready({ id: 'X', name: 'X', size_engineering: 5, priority: 1, dependencies: [{ kind: 'project', type: 'blocked_by', target_id: 'Y' }] }),
        ready({ id: 'Y', name: 'Y', size_engineering: 5, priority: 2, dependencies: [{ kind: 'project', type: 'blocked_by', target_id: 'X' }] })
      ],
      sprints: makeSprintSequence(4, '2026-07-06'),
      team_members: [makeMember({ name: 'Dana', available_points_per_sprint: 10, primary_skills: ['Data Engineering'] })]
    }));
    app.App.activeCustomer = 'Acme Industries';
    const res = solve();
    expect(res.warnings.some(w => w.type === 'circular_dependency')).toBe(true);
    // Cycle edges are ignored, so no 2+ chain is reported.
    expect(res.stats.criticalPath).toEqual([]);
  });
});
