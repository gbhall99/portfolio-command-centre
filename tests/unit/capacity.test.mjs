// Capacity math — calcMemberCapacityForSprint + calcSkillCapacityForSprint.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMember, makeSprintSequence } from '../harness/fixtures.mjs';

describe('calcMemberCapacityForSprint', () => {
  it('honours sprint_overrides.available_points', async () => {
    const member = makeMember({
      name: 'Alice',
      available_points_per_sprint: 20,
      sprint_overrides: { 'CY26-S1': { available_points: 5 } }
    });
    const app = await loadApp(makeDataset({
      team_members: [member], sprints: makeSprintSequence(2)
    }));
    expect(app.Sprint.calcMemberCapacityForSprint(member, 'CY26-S1', 'GCC').points).toBe(5);
    expect(app.Sprint.calcMemberCapacityForSprint(member, 'CY26-S2', 'GCC').points).toBe(20);
    app.teardown();
  });

  it('linear ramp profile zeros capacity before start_date', async () => {
    const member = makeMember({
      name: 'RampUp',
      available_points_per_sprint: 20,
      start_date: '2026-06-01',
      ramp_profile: 'linear',
      ramp_weeks: 4
    });
    const app = await loadApp(makeDataset({
      team_members: [member], sprints: makeSprintSequence(1, '2026-01-05')
    }));
    const mc = app.Sprint.calcMemberCapacityForSprint(member, 'CY26-S1', 'GCC');
    expect(mc.points).toBe(0);
    app.teardown();
  });

  it('includes secondary_skills in the returned skills list', async () => {
    const member = makeMember({
      name: 'Polyglot',
      primary_skills: ['Data Engineering'],
      secondary_skills: ['Data Science']
    });
    const app = await loadApp(makeDataset({
      team_members: [member], sprints: makeSprintSequence(1)
    }));
    const mc = app.Sprint.calcMemberCapacityForSprint(member, 'CY26-S1', 'GCC');
    expect(mc.skills).toContain('size_engineering');
    expect(mc.skills).toContain('size_data_science');
    app.teardown();
  });
});

describe('calcSkillCapacityForSprint', () => {
  it('sums members\' capacity for the requested skill and customer', async () => {
    const team = [
      makeMember({ name: 'Alice', customer: 'GCC', available_points_per_sprint: 15, primary_skills: ['Data Engineering'] }),
      makeMember({ name: 'Bob',   customer: 'GCC', available_points_per_sprint: 10, primary_skills: ['Data Engineering'] }),
      makeMember({ name: 'Carol', customer: 'KS',  available_points_per_sprint: 20, primary_skills: ['Data Engineering'] })  // not GCC
    ];
    const app = await loadApp(makeDataset({ team_members: team, sprints: makeSprintSequence(1) }));
    const cap = app.Sprint.calcSkillCapacityForSprint('GCC', 'CY26-S1');
    // Alice + Bob = 25. Carol excluded because customer !== GCC.
    expect(cap.size_engineering).toBe(25);
    app.teardown();
  });
});
