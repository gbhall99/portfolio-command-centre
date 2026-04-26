import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

describe('TBD phases — solver exclusion', () => {
  it('a phase_order entry with status: tbd does not get scheduled', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'Discovery only', size_requirements: 5, size_engineering: 10,
      delivery_config: {
        phase_order: ['Requirements', { phase: 'Data Engineering', status: 'tbd' }]
      }
    });
    proj.size_total = 15;
    const member = makeMember({ name: 'Alice', primary_skills: ['Requirements', 'Data Engineering'], available_points_per_sprint: 20 });
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [member] }));
    const plan = app.Solver.solve('Acme Industries', app.Sprint.allocSettings, app.App.data, app.Sprint);
    const reqSlices = (plan.allocations[proj.id] && plan.allocations[proj.id].size_requirements) || [];
    const deSlices = (plan.allocations[proj.id] && plan.allocations[proj.id].size_engineering) || [];
    expect(reqSlices.length).toBeGreaterThan(0);
    expect(deSlices.length).toBe(0);
    app.teardown();
  });
});
