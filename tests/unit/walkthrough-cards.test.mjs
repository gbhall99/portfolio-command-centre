import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.computeWalkthroughCards', () => {
  it('returns one card per active project, sorted by attention desc', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const blocked = makeProject({ name: 'B', status: 'Blocked', rag_schedule: 'Red', size_total: 5 });
    const green = makeProject({ name: 'G', status: 'In Progress', rag_schedule: 'Green', size_total: 5 });
    const app = await loadApp(makeDataset({ projects: [green, blocked], sprints, team_members: [makeMember()] }));
    const cards = app.App.computeWalkthroughCards('GCC');
    expect(cards).toHaveLength(2);
    expect(cards[0].project.name).toBe('B');
    expect(cards[1].project.name).toBe('G');
    app.teardown();
  });

  it('classifies state correctly', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const critical = makeProject({ name: 'C', status: 'In Progress', rag_schedule: 'Red', size_total: 5 });
    const watch = makeProject({ name: 'W', status: 'In Progress', rag_schedule: 'Amber', size_total: 5 });
    const steady = makeProject({ name: 'S', status: 'In Progress', rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green', size_total: 5 });
    const app = await loadApp(makeDataset({ projects: [critical, watch, steady], sprints }));
    const cards = app.App.computeWalkthroughCards('GCC');
    expect(cards.find(c => c.project.name === 'C').state).toBe('critical');
    expect(cards.find(c => c.project.name === 'W').state).toBe('watch');
    expect(cards.find(c => c.project.name === 'S').state).toBe('steady');
    app.teardown();
  });

  it('excludes Complete and Closed projects', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const done = makeProject({ name: 'D', status: 'Complete', size_total: 5 });
    const live = makeProject({ name: 'L', status: 'In Progress', size_total: 5 });
    const app = await loadApp(makeDataset({ projects: [done, live], sprints }));
    const cards = app.App.computeWalkthroughCards('GCC');
    expect(cards.map(c => c.project.name)).toEqual(['L']);
    app.teardown();
  });
});
