// R12: a team member is never assigned to two overlapping deliveries at once,
// unless both deliveries are in the allow-list (default: Requirements + UAT).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

// Sprints starting in the future avoid past-sprint protection.
function futureSprints(n) {
  const start = new Date(); start.setDate(start.getDate() + 7);
  return makeSprintSequence(n, start.toISOString().slice(0, 10));
}

async function runSolver(dataset, customer = 'GCC', settingOverrides = {}) {
  const app = await loadApp(dataset);
  const settings = { ...app.Sprint.allocSettings, ...settingOverrides };
  const plan = app.Solver.solve(customer, settings, app.App.data, app.Sprint);
  return { plan, app };
}

// Collect every (project, skill, sprint, member) triple assigned in a plan.
function expandAssignments(plan) {
  const out = [];
  Object.entries(plan.allocations || {}).forEach(([pid, skills]) => {
    Object.entries(skills || {}).forEach(([sk, arr]) => {
      (arr || []).forEach(sp => {
        (sp.assigned_to || []).forEach(a => {
          out.push({ pid, sk, sprint: sp.sprint, member: a.member, points: a.points });
        });
      });
    });
  });
  return out;
}

describe('Solver — R12: concurrent single-person guard', () => {
  it('splits two DE deliveries across different sprints when only one DE member exists (R12 ON)', async () => {
    resetIdSeq();
    const sprints = futureSprints(4);
    const projA = makeProject({ id: 'GCC-A', name: 'Alpha', priority: 1, size_engineering: 5, delivery_config: { phase_order: ['Data Engineering'] } });
    const projB = makeProject({ id: 'GCC-B', name: 'Beta', priority: 2, size_engineering: 5, delivery_config: { phase_order: ['Data Engineering'] } });
    const bob = makeMember({ name: 'Bob', primary_skills: ['Data Engineering'], available_points_per_sprint: 20 });
    const { plan, app } = await runSolver(makeDataset({
      projects: [projA, projB], sprints, team_members: [bob]
    }));
    const assigns = expandAssignments(plan);
    // For any (sprint, member) pair, projects with non-allow-list skills must not overlap.
    const perSprintMember = {};
    assigns.forEach(a => {
      const key = a.sprint + '|' + a.member;
      (perSprintMember[key] = perSprintMember[key] || []).push(a);
    });
    Object.values(perSprintMember).forEach(list => {
      const projectIds = new Set(list.map(a => a.pid));
      if (projectIds.size > 1) {
        list.forEach(a => expect(['size_requirements', 'size_uat_adoption']).toContain(a.sk));
      }
    });
    // Specifically: Bob on DE must NOT appear twice in the same sprint for different projects.
    const bobDe = assigns.filter(a => a.member === 'Bob' && a.sk === 'size_engineering');
    const bySprint = {};
    bobDe.forEach(a => { (bySprint[a.sprint] = bySprint[a.sprint] || new Set()).add(a.pid); });
    Object.values(bySprint).forEach(set => expect(set.size).toBeLessThanOrEqual(1));
    app.teardown();
  });

  it('allows two Requirements phases on the same person in the same sprint (allow-list default)', async () => {
    resetIdSeq();
    const sprints = futureSprints(4);
    const projA = makeProject({ id: 'GCC-A', name: 'Alpha', priority: 1, size_engineering: 0, size_requirements: 3, delivery_config: { phase_order: ['Requirements'] } });
    const projB = makeProject({ id: 'GCC-B', name: 'Beta', priority: 2, size_engineering: 0, size_requirements: 3, delivery_config: { phase_order: ['Requirements'] } });
    const charlie = makeMember({ name: 'Charlie', primary_skills: ['Requirements'], available_points_per_sprint: 20 });
    const { plan, app } = await runSolver(makeDataset({
      projects: [projA, projB], sprints, team_members: [charlie]
    }));
    const assigns = expandAssignments(plan);
    // Both Req slices should land in the same sprint on Charlie — check any sprint has both projects.
    const perSprint = {};
    assigns.forEach(a => { (perSprint[a.sprint] = perSprint[a.sprint] || new Set()).add(a.pid); });
    const sharedSprint = Object.values(perSprint).some(s => s.size === 2);
    expect(sharedSprint).toBe(true);
    app.teardown();
  });

  it('turning R12 off lets DE overlap across projects on the same person in the same sprint', async () => {
    resetIdSeq();
    const sprints = futureSprints(4);
    const projA = makeProject({ id: 'GCC-A', name: 'Alpha', priority: 1, size_engineering: 5, delivery_config: { phase_order: ['Data Engineering'] } });
    const projB = makeProject({ id: 'GCC-B', name: 'Beta', priority: 2, size_engineering: 5, delivery_config: { phase_order: ['Data Engineering'] } });
    const bob = makeMember({ name: 'Bob', primary_skills: ['Data Engineering'], available_points_per_sprint: 20 });
    const { plan, app } = await runSolver(
      makeDataset({ projects: [projA, projB], sprints, team_members: [bob] }),
      'GCC',
      { enforceConcurrentSinglePerson: false }
    );
    const assigns = expandAssignments(plan);
    const perSprint = {};
    assigns.forEach(a => { (perSprint[a.sprint] = perSprint[a.sprint] || new Set()).add(a.pid); });
    const sharedSprint = Object.values(perSprint).some(s => s.size === 2);
    expect(sharedSprint).toBe(true);
    app.teardown();
  });
});
