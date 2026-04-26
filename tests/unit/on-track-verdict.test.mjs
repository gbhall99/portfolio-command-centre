import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function setup(projects) {
  resetIdSeq();
  const sprints = makeSprintSequence(2);
  const app = await loadApp(makeDataset({
    projects, sprints, team_members: [makeMember()]
  }));
  return app;
}

describe('Dashboard.computeOnTrackVerdict', () => {
  it('returns On Track when all signals are clean', async () => {
    const proj = makeProject({ status: 'In Progress', rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green' });
    proj.size_total = 5;
    const app = await setup([proj]);
    const v = app.Dashboard.computeOnTrackVerdict('GCC');
    expect(v.verdict).toBe('On Track');
    expect(v.justification.length).toBeGreaterThan(0);
    expect(Array.isArray(v.inputs)).toBe(true);
    app.teardown();
  });

  it('returns Off Track when 2+ signals are red', async () => {
    const proj = makeProject({ status: 'Blocked', rag_schedule: 'Red', rag_resourcing: 'Red', rag_scope: 'Red' });
    proj.size_total = 5;
    const app = await setup([proj]);
    const v = app.Dashboard.computeOnTrackVerdict('GCC');
    expect(v.verdict).toBe('Off Track');
    app.teardown();
  });

  it('returns Watch when one signal is amber', async () => {
    const proj = makeProject({ status: 'In Progress', rag_schedule: 'Amber', rag_resourcing: 'Green', rag_scope: 'Green' });
    proj.size_total = 5;
    const app = await setup([proj]);
    const v = app.Dashboard.computeOnTrackVerdict('GCC');
    expect(v.verdict).toBe('Watch');
    app.teardown();
  });
});
