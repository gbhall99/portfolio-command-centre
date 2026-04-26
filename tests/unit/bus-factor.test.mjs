import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Bus factor', () => {
  it('returns N=1 for skills with only one eligible member', async () => {
    resetIdSeq();
    const proj = makeProject({ size_engineering: 10 });
    proj.size_total = 10;
    const lone = makeMember({ name: 'Solo', primary_skills: ['Data Engineering'] });
    const app = await loadApp(makeDataset({ projects: [proj], team_members: [lone] }));
    const bf = app.App.computeBusFactor(proj);
    expect(bf.size_engineering).toBe(1);
    app.teardown();
  });

  it('returns N=2 when two members can do the skill', async () => {
    resetIdSeq();
    const proj = makeProject({ size_engineering: 10 });
    proj.size_total = 10;
    const a = makeMember({ name: 'Alice', primary_skills: ['Data Engineering'] });
    const b = makeMember({ name: 'Bob', primary_skills: ['Data Engineering'] });
    const app = await loadApp(makeDataset({ projects: [proj], team_members: [a, b] }));
    const bf = app.App.computeBusFactor(proj);
    expect(bf.size_engineering).toBe(2);
    app.teardown();
  });
});
