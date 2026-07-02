// Regression tests pinning review-pipeline fixes. Shared by sequential fix stages.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function runSolver(dataset, customer = 'Acme Industries', settingOverrides = {}) {
  const app = await loadApp(dataset);
  const settings = { ...app.Sprint.allocSettings, ...settingOverrides };
  const plan = app.Solver.solve(customer, settings, app.App.data, app.Sprint);
  return { plan, app };
}

function allSlices(plan) {
  const slices = [];
  Object.entries(plan.allocations || {}).forEach(([pid, skills]) => {
    Object.entries(skills || {}).forEach(([sk, arr]) => {
      (arr || []).forEach(slice => slices.push({ ...slice, pid, sk }));
    });
  });
  return slices;
}

describe('Solver.getProjectPhaseMap — B6 object-form phase_order entries (rolling wave)', () => {
  it('maps promoted { phase, status } object entries so their skills are scheduled', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(6);
    const sprintIdx = {};
    sprints.forEach((s, i) => { sprintIdx[s.sprint_id] = i; });
    const proj = makeProject({
      name: 'Rolling Wave',
      size_requirements: 5,
      size_engineering: 12,
      delivery_config: {
        phase_order: ['Requirements', { phase: 'Data Engineering', status: 'planned' }]
      }
    });
    const member = makeMember({
      name: 'Alice',
      primary_skills: ['Requirements', 'Data Engineering'],
      available_points_per_sprint: 10
    });
    const { plan, app } = await runSolver(makeDataset({
      projects: [proj], sprints, team_members: [member]
    }));
    try {
      // The promoted (object-form) phase's map entry follows the string entry
      const map = app.Solver.getProjectPhaseMap(proj);
      expect(map).toEqual({ size_requirements: 1, size_engineering: 2 });

      // Both skills receive allocation slices
      const slices = allSlices(plan);
      const reqPts = slices.filter(s => s.sk === 'size_requirements')
        .reduce((t, s) => t + s.points, 0);
      const engPts = slices.filter(s => s.sk === 'size_engineering')
        .reduce((t, s) => t + s.points, 0);
      expect(reqPts).toBe(5);
      expect(engPts).toBe(12);

      // Phase ordering holds: no DE slice earlier than the last Requirements slice (R1)
      const reqMax = Math.max(...slices.filter(s => s.sk === 'size_requirements')
        .map(s => sprintIdx[s.sprint]));
      const engMin = Math.min(...slices.filter(s => s.sk === 'size_engineering')
        .map(s => sprintIdx[s.sprint]));
      expect(engMin).toBeGreaterThanOrEqual(reqMax);
    } finally {
      app.teardown();
    }
  });

  it('schedules an all-object committed phase_order (previously silently skipped)', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'Committed Object',
      size_engineering: 8,
      delivery_config: {
        phase_order: [{ phase: 'Data Engineering', status: 'committed' }]
      }
    });
    const member = makeMember({ name: 'Bob' });
    const { plan, app } = await runSolver(makeDataset({
      projects: [proj], sprints, team_members: [member]
    }));
    try {
      const engPts = allSlices(plan).filter(s => s.sk === 'size_engineering')
        .reduce((t, s) => t + s.points, 0);
      expect(engPts).toBe(8);
      expect(plan.stats.projectsSkipped).toBe(0);
    } finally {
      app.teardown();
    }
  });

  it('excludes tbd entries from scheduling with no SKILL_PHASE fallback', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'All TBD',
      size_engineering: 8,
      delivery_config: {
        phase_order: [{ phase: 'Data Engineering', status: 'tbd', placeholder_size: 8 }]
      }
    });
    const member = makeMember({ name: 'Cara' });
    const { plan, app } = await runSolver(makeDataset({
      projects: [proj], sprints, team_members: [member]
    }));
    try {
      // tbd-only phase_order yields an empty phase map (no hardcoded fallback)
      expect(app.Solver.getProjectPhaseMap(proj)).toEqual({});
      // ...so nothing is scheduled for the project
      expect(allSlices(plan).filter(s => s.pid === proj.id)).toEqual([]);
    } finally {
      app.teardown();
    }
  });
});
