import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function withVelocityHistory() {
  resetIdSeq();
  const sprints = makeSprintSequence(6);
  const histProj = makeProject({
    name: 'History', size_engineering: 60,
    skill_splits: {
      size_engineering: [
        { sprint: sprints[0].sprint_id, points: 30, status: 'complete', completed: 30, assigned_to: [], reasons: [] },
        { sprint: sprints[1].sprint_id, points: 30, status: 'complete', completed: 30, assigned_to: [], reasons: [] }
      ]
    }
  });
  histProj.size_total = 60;
  const member = makeMember({ available_points_per_sprint: 30 });
  const app = await loadApp(makeDataset({
    projects: [histProj], sprints, team_members: [member]
  }));
  return { app, sprints };
}

describe('Forecast.forecastForCandidate', () => {
  it('returns a P50 / P80 / P95 sprint count for a hypothetical', async () => {
    const { app } = await withVelocityHistory();
    const result = app.Forecast.forecastForCandidate({
      customer: 'GCC',
      sizeBySkill: { size_engineering: 30 },
      lifecycle_stage: 'Implementation'
    });
    expect(result.distribution).toBeTruthy();
    expect(result.distribution.p50).toBeGreaterThan(0);
    expect(result.distribution.p80).toBeGreaterThanOrEqual(result.distribution.p50);
    expect(result.distribution.p95).toBeGreaterThanOrEqual(result.distribution.p80);
    app.teardown();
  });

  it('classifies achievability against a target_date', async () => {
    const { app } = await withVelocityHistory();
    const farFuture = app.Forecast.forecastForCandidate({
      customer: 'GCC',
      sizeBySkill: { size_engineering: 30 },
      lifecycle_stage: 'Implementation',
      target_date: '2026-12-31'
    });
    expect(['likely', 'stretch', 'no', 'unknown']).toContain(farFuture.verdict);
    app.teardown();
  });

  it('respects lifecycle_stage cone widener', async () => {
    const { app } = await withVelocityHistory();
    let pocSum = 0, implSum = 0;
    for (let i = 0; i < 5; i++) {
      const impl = app.Forecast.forecastForCandidate({ customer: 'GCC', sizeBySkill: { size_engineering: 30 }, lifecycle_stage: 'Implementation' });
      const poc = app.Forecast.forecastForCandidate({ customer: 'GCC', sizeBySkill: { size_engineering: 30 }, lifecycle_stage: 'POC' });
      pocSum += poc.distribution.p95;
      implSum += impl.distribution.p95;
    }
    expect(pocSum).toBeGreaterThanOrEqual(implSum);
    app.teardown();
  });
});
