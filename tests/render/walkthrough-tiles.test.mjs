import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Walkthrough centre — signal grid tiles', () => {
  it('renders the prompts strip when computeWalkthroughPrompts returns rows', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-T1', name: 'Amber', rag_schedule: 'Amber' });
    p.last_updated = new Date(Date.now() - 14 * 86400000).toISOString();
    const app = await loadApp(makeDataset({ projects: [p], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    app.Walkthrough.selectProject('GCC-T1');
    const promptsHost = app.window.document.querySelector('[data-wt-prompts]');
    expect(promptsHost.innerHTML).toMatch(/Schedule has been amber/);
    app.teardown();
  });

  it('renders 4 tiles: Health, Trajectory, Dates, Since', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(4);
    const p = makeProject({ id: 'GCC-T2', name: 'Bigp', size_engineering: 20 });
    p.skill_splits = { size_engineering: [{ sprint: sprints[0].sprint_id, points: 20, completed: 5, status: 'in_progress' }] };
    const app = await loadApp(makeDataset({ projects: [p], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    app.Walkthrough.selectProject('GCC-T2');
    const grid = app.window.document.querySelector('[data-wt-grid]');
    const html = grid.innerHTML;
    expect(html).toMatch(/data-wt-tile="health"/);
    expect(html).toMatch(/data-wt-tile="trajectory"/);
    expect(html).toMatch(/data-wt-tile="dates"/);
    expect(html).toMatch(/data-wt-tile="since"/);
    app.teardown();
  });

  it('trajectory tile renders bars for each sprint frame from computeProjectDeliveryTrajectory', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(4);
    const p = makeProject({ id: 'GCC-T3' });
    p.skill_splits = { size_engineering: sprints.map(s => ({ sprint: s.sprint_id, points: 5, completed: 0, status: 'pending' })) };
    const app = await loadApp(makeDataset({ projects: [p], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    app.Walkthrough.selectProject('GCC-T3');
    const bars = app.window.document.querySelectorAll('[data-wt-trajectory-bar]');
    expect(bars.length).toBeGreaterThanOrEqual(1);
    expect(bars.length).toBeLessThanOrEqual(5);
    app.teardown();
  });
});
