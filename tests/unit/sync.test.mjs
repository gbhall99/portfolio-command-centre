// Roadmap (Gantt) and Sprint Planning read different sources of truth:
//   - Gantt uses project.start_date + project.target_date
//   - Sprint Planning uses project.skill_splits
// Sprint's drag/drop + Auto-Allocate-Apply paths previously mutated skill_splits without
// touching the project dates. Result: Gantt bars stayed anchored to stale dates while the
// Sprint board showed the new layout. These tests pin the sync fix.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Sprint / Gantt sync', () => {
  it('moveSkillToSprint updates project.start_date + target_date from the new split range', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(4, '2027-01-04');
    const proj = makeProject({
      id: 'Acme Industries-SYNC',
      customer: 'Acme Industries',
      size_engineering: 10,
      size_total: 10,
      start_date: sprints[0].start_date,
      target_date: sprints[0].end_date,
      current_sprint: sprints[0].sprint_id,
      target_sprint: sprints[0].sprint_id,
      skill_splits: {
        size_engineering: [{ sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [], reasons: [] }]
      }
    });
    const member = makeMember({ name: 'A', available_points_per_sprint: 20 });
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [member] }));
    const live = app.App.data.projects.find(p => p.id === 'Acme Industries-SYNC');

    app.Sprint.moveSkillToSprint('Acme Industries-SYNC', 'size_engineering', sprints[0].sprint_id, sprints[2].sprint_id, 10);

    expect(live.current_sprint).toBe(sprints[2].sprint_id);
    expect(live.target_sprint).toBe(sprints[2].sprint_id);
    expect(live.start_date).toBe(sprints[2].start_date);
    expect(live.target_date).toBe(sprints[2].end_date);
    app.teardown();
  });

  it('moveSkillToSprint with splits in multiple sprints spans start→end across the widest range', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(4, '2027-01-04');
    const proj = makeProject({
      id: 'Acme Industries-SPAN',
      customer: 'Acme Industries',
      size_engineering: 10,
      size_requirements: 5,
      size_total: 15,
      delivery_config: { phase_order: ['Requirements', 'Data Engineering'] },
      start_date: sprints[0].start_date,
      target_date: sprints[0].end_date,
      current_sprint: sprints[0].sprint_id,
      target_sprint: sprints[0].sprint_id,
      skill_splits: {
        size_requirements:  [{ sprint: sprints[0].sprint_id, points: 5,  status: 'pending', completed: 0, assigned_to: [], reasons: [] }],
        size_engineering:   [{ sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [], reasons: [] }]
      }
    });
    const member = makeMember({ name: 'A', primary_skills: ['Requirements', 'Data Engineering'], available_points_per_sprint: 20 });
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [member] }));
    const live = app.App.data.projects.find(p => p.id === 'Acme Industries-SPAN');

    // Move size_engineering out to sprint 3, leaving Requirements in sprint 0 → bar should span S1→S4.
    app.Sprint.moveSkillToSprint('Acme Industries-SPAN', 'size_engineering', sprints[0].sprint_id, sprints[3].sprint_id, 10);

    expect(live.current_sprint).toBe(sprints[0].sprint_id);
    expect(live.target_sprint).toBe(sprints[3].sprint_id);
    expect(live.start_date).toBe(sprints[0].start_date);
    expect(live.target_date).toBe(sprints[3].end_date);
    app.teardown();
  });

  it('applyAllocation syncs project dates from the new solver plan', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(5, '2027-01-04');
    const proj = makeProject({
      id: 'Acme Industries-APPLY',
      customer: 'Acme Industries',
      size_engineering: 30,
      size_total: 30,
      start_date: sprints[0].start_date,
      target_date: sprints[0].end_date,
      current_sprint: sprints[0].sprint_id,
      target_sprint: sprints[0].sprint_id,
      skill_splits: {}
    });
    const member = makeMember({ name: 'A', available_points_per_sprint: 10 });
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [member] }));

    const plan = app.Solver.solve('Acme Industries', app.Sprint.allocSettings, app.App.data, app.Sprint);
    app.Sprint.pendingAllocation = plan;
    // Stub the alloc-results overlay teardown so we can call applyAllocation headlessly.
    app.Sprint.closeAllocResults = () => {};

    app.Sprint.applyAllocation();

    const live = app.App.data.projects.find(p => p.id === 'Acme Industries-APPLY');
    // 30 SP with 10 SP/sprint member cap → spans at least 3 sprints.
    const sids = Object.values(live.skill_splits).flat().map(s => s.sprint).filter(s => s !== '_backlog');
    const minSid = sids.sort()[0];
    const maxSid = sids.sort()[sids.length - 1];
    expect(live.current_sprint).toBe(minSid);
    expect(live.target_sprint).toBe(maxSid);
    const first = sprints.find(s => s.sprint_id === minSid);
    const last  = sprints.find(s => s.sprint_id === maxSid);
    expect(live.start_date).toBe(first.start_date);
    expect(live.target_date).toBe(last.end_date);
    app.teardown();
  });
});
