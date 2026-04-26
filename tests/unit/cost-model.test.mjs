import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Cost model', () => {
  it('computeProjectCost returns BAC and AC in £', async () => {
    resetIdSeq();
    const proj = makeProject({
      name: 'Cost', size_engineering: 20,
      skill_splits: { size_engineering: [{ sprint: 'CY26-S1', points: 5, status: 'complete', completed: 5, assigned_to: [], reasons: [] }] }
    });
    proj.size_total = 20;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()],
      settings: { rate_card: { size_engineering: { perm: 750, contract: 1100 } } }
    }));
    const cost = app.App.computeProjectCost(proj);
    expect(cost.BAC).toBe(20 * 750);
    expect(cost.AC).toBe(5 * 750);
    expect(cost.currency).toBe('GBP');
    app.teardown();
  });
});
