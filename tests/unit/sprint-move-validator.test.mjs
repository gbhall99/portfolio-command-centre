// Sprint._validateSliceMove is the guard that sits in front of moveSkillToSprint.
// It emits `hardFail: true` for moves that would produce an invalid plan (no
// skilled member at destination, move past hard deadline) and soft `warnings`
// for plans that are technically legal but violate phase order or surrender a
// slot to a lower-priority project. UI consults it before invoking the move.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMember, makeProject, makeSprintSequence } from '../harness/fixtures.mjs';

describe('Sprint._validateSliceMove', () => {
  it('hard-fails when destination sprint has zero skill capacity for this skill', async () => {
    const app = await loadApp(makeDataset({
      team_members: [makeMember({ name: 'Alice', available_points_per_sprint: 10, primary_skills: ['Data Engineering'] })],
      sprints: makeSprintSequence(3),
      projects: [makeProject({ id: 'Acme Industries-A', size_engineering: 10 })]
    }));
    const res = app.Sprint._validateSliceMove({
      projectId: 'Acme Industries-A',
      skillKey: 'size_tableau',
      fromSprint: 'CY26-S1',
      toSprint: 'CY26-S2',
      points: 5
    });
    expect(res.hardFail).toBe(true);
    expect(res.warnings.some(w => /no capacity|no.*skilled|no.*member/i.test(w))).toBe(true);
    app.teardown();
  });

  it('emits phase-order warning when moving a later-phase slice earlier than an earlier phase', async () => {
    const app = await loadApp(makeDataset({
      team_members: [
        makeMember({ name: 'Alice', available_points_per_sprint: 20, primary_skills: ['Requirements', 'Data Engineering', 'UAT'] })
      ],
      sprints: makeSprintSequence(3),
      projects: [(() => {
        const p = makeProject({
          id: 'Acme Industries-PH',
          size_requirements: 5,
          size_engineering: 5,
          size_uat_adoption: 5,
          delivery_config: { phase_order: ['Requirements', 'Data Engineering', 'UAT'] }
        });
        p.skill_splits = {
          size_requirements: [{ sprint: 'CY26-S1', points: 5, status: 'pending' }],
          size_engineering:  [{ sprint: 'CY26-S2', points: 5, status: 'pending' }],
          size_uat_adoption: [{ sprint: 'CY26-S3', points: 5, status: 'pending' }]
        };
        return p;
      })()]
    }));
    const res = app.Sprint._validateSliceMove({
      projectId: 'Acme Industries-PH',
      skillKey: 'size_uat_adoption',
      fromSprint: 'CY26-S3',
      toSprint: 'CY26-S1',
      points: 5
    });
    expect(res.hardFail).toBe(false);
    expect(res.warnings.some(w => /phase|earlier|before|start/i.test(w))).toBe(true);
    app.teardown();
  });

  it('hard-fails when destination sprint is after the project hard deadline', async () => {
    const sprints = (() => {
      const seq = [];
      for (let i = 0; i < 3; i++) {
        const startD = new Date('2026-01-05'); startD.setDate(startD.getDate() + i * 35);
        const hard = new Date(startD); hard.setDate(hard.getDate() + 28);
        const end  = new Date(startD); end.setDate(end.getDate() + 34);
        seq.push({
          sprint_id: 'CY26-S' + (i + 1),
          start_date: startD.toISOString().slice(0, 10),
          hardening_start: hard.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10)
        });
      }
      return seq;
    })();
    const p = makeProject({ id: 'Acme Industries-DL', size_engineering: 5, hard_deadline: sprints[0].end_date });
    p.skill_splits = { size_engineering: [{ sprint: 'CY26-S1', points: 5, status: 'pending' }] };
    const app = await loadApp(makeDataset({
      team_members: [makeMember({ available_points_per_sprint: 10 })],
      sprints,
      projects: [p]
    }));
    const res = app.Sprint._validateSliceMove({
      projectId: 'Acme Industries-DL',
      skillKey: 'size_engineering',
      fromSprint: 'CY26-S1',
      toSprint: 'CY26-S3',
      points: 5
    });
    expect(res.hardFail).toBe(true);
    expect(res.warnings.some(w => /deadline/i.test(w))).toBe(true);
    app.teardown();
  });
});
