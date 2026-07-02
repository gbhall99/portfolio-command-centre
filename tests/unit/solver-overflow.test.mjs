// Diagnostics for the two capacity_overflow failure shapes:
//   (a) horizon-terminal: every sprint in the horizon is saturated and no later
//       sprint exists.
//   (b) deadline-ceiling: a project's hard_deadline caps the allowable window.
// Users hit (a) when running out of horizon, and (b) when committing more than
// the deadline window can hold. The solver dumps both into the last allowed
// sprint, but the corrective action is different for each — so the warning
// type must distinguish them.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMember, makeProject, makeSprintSequence } from '../harness/fixtures.mjs';

describe('Solver overflow diagnostics', () => {
  it('emits capacity_overflow_horizon when the horizon is saturated and no ceiling is set', async () => {
    const member = makeMember({ name: 'Solo', available_points_per_sprint: 5, primary_skills: ['Data Engineering'] });
    const proj = makeProject({ id: 'Acme Industries-HUGE', name: 'Huge DE', size_engineering: 40 });
    const app = await loadApp(makeDataset({
      team_members: [member],
      sprints: makeSprintSequence(2),
      projects: [proj]
    }));
    const plan = app.Solver.solve('Acme Industries', app.Sprint.allocSettings, app.App.data, app.Sprint);
    const overflows = plan.warnings.filter(w => w.type === 'capacity_overflow_horizon');
    expect(overflows.length).toBeGreaterThan(0);
    const w = overflows[0];
    expect(w.sprint).toBe('CY26-S2');
    expect(w.detail.toLowerCase()).toMatch(/horizon|extend|last sprint/);
    app.teardown();
  });

  it('emits capacity_overflow_deadline when a hard deadline bounds the horizon', async () => {
    const member = makeMember({ name: 'Solo', available_points_per_sprint: 5, primary_skills: ['Data Engineering'] });
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      id: 'Acme Industries-DL',
      name: 'Deadline DE',
      size_engineering: 30,
      hard_deadline: sprints[0].end_date
    });
    const app = await loadApp(makeDataset({
      team_members: [member],
      sprints,
      projects: [proj]
    }));
    const plan = app.Solver.solve('Acme Industries', app.Sprint.allocSettings, app.App.data, app.Sprint);
    const overflows = plan.warnings.filter(w => w.type === 'capacity_overflow_deadline');
    expect(overflows.length).toBeGreaterThan(0);
    const w = overflows[0];
    expect(w.sprint).toBe('CY26-S1');
    expect(w.detail.toLowerCase()).toMatch(/deadline|before/);
    // The horizon-terminal warning must NOT fire for this project — the overflow is
    // caused by the deadline ceiling, not the horizon.
    const terminal = plan.warnings.filter(w2 => w2.type === 'capacity_overflow_horizon' && w2.project && w2.project.id === 'Acme Industries-DL');
    expect(terminal.length).toBe(0);
    app.teardown();
  });

  it('Pass 2 rollback does not credit overflow slices back to remaining (no phantom capacity / negative used)', async () => {
    // Overflow slices never consumed aggregate capacity when placed — Pass 1 pushes them into the
    // last allowed sprint precisely because there was NO room. releaseProject must not credit them
    // back, or `remaining` inflates above baseCap: the utilization grid goes negative and Pass 3
    // would balance real work into an already saturated sprint.
    // Repro shape: hard-deadline project too big for the WHOLE horizon → Pass 1 fills both
    // sprints and overflows the rest into S2; the deadline miss triggers Pass 2 rollback +
    // retry with ceiling 0. Without the guard, the rollback credits the S2 overflow slice back.
    // Sprints must be in the FUTURE — past-sprint protection (D5) blocks placement into past
    // sprints, which would sidestep the Pass 1 placement this repro depends on.
    const member = makeMember({ name: 'Solo', available_points_per_sprint: 20, primary_skills: ['Data Engineering'] });
    const futureStart = new Date();
    futureStart.setDate(futureStart.getDate() + 7);
    const sprints = makeSprintSequence(2, futureStart.toISOString().slice(0, 10));
    const proj = makeProject({
      id: 'Acme Industries-OFRB',
      name: 'Overflow Rollback DE',
      size_engineering: 45,
      hard_deadline: sprints[0].end_date
    });
    const app = await loadApp(makeDataset({
      team_members: [member],
      sprints,
      projects: [proj]
    }));
    const settings = { ...app.Sprint.allocSettings, spreadWork: false };
    const plan = app.Solver.solve('Acme Industries', settings, app.App.data, app.Sprint);
    // Sanity: the scenario really did overflow past the deadline ceiling.
    expect(plan.warnings.some(w => w.type === 'capacity_overflow_deadline')).toBe(true);
    // The invariant the bug broke: every utilization cell stays within [0, capacity].
    Object.entries(plan.utilizationGrid).forEach(([sid, bySkill]) => {
      Object.entries(bySkill).forEach(([skill, cell]) => {
        expect(cell.used, sid + '/' + skill + ' used must not be negative').toBeGreaterThanOrEqual(0);
        expect(cell.used, sid + '/' + skill + ' used must not exceed capacity').toBeLessThanOrEqual(cell.capacity);
      });
    });
    app.teardown();
  });
});
