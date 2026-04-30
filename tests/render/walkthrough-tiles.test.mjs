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

describe('Walkthrough centre — open lists + capture', () => {
  it('renders Open risks and Open actions blocks', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-O1', name: 'OpenItems' });
    p.risks_register = [{ description: 'data quality', impact: 3, probability: 3, status: 'open', added_at: new Date().toISOString() }];
    const forums = [{ id: 'F1', name: 'Reporting & Delivery Strategy', customer: 'GCC', actions: [{ id: 'A1', description: 'Confirm SME', status: 'Open', due_date: '2026-04-25', project_id: 'GCC-O1' }], decisions: [] }];
    const app = await loadApp(makeDataset({ projects: [p], governance_forums: forums, sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    app.Walkthrough.selectProject('GCC-O1');
    const lists = app.window.document.querySelector('[data-wt-open-lists]');
    expect(lists.innerHTML).toMatch(/Open risks/);
    expect(lists.innerHTML).toMatch(/data quality/);
    expect(lists.innerHTML).toMatch(/Open actions/);
    expect(lists.innerHTML).toMatch(/Confirm SME/);
    app.teardown();
  });

  it('capture row renders 3 tabs only — Decision, Action, Risk (no Comms note)', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-CAP1' });
    const app = await loadApp(makeDataset({ projects: [p], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    app.Walkthrough.selectProject('GCC-CAP1');
    const cap = app.window.document.querySelector('[data-wt-capture]');
    const tabs = cap.querySelectorAll('[data-wt-cap-tab]');
    expect(tabs.length).toBe(3);
    const labels = Array.from(tabs).map(t => t.textContent.trim());
    expect(labels).toEqual(['+ Decision', '+ Action', '+ Risk']);
    app.teardown();
  });
});

describe('Walkthrough centre — hover popovers', () => {
  it('project name area carries DevOps/WFA links when present', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-HV1' });
    p.devops_link = 'https://dev.azure.com/x'; p.wfa_link = 'https://wfa/y';
    const app = await loadApp(makeDataset({ projects: [p], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    app.Walkthrough.selectProject('GCC-HV1');
    const center = app.window.document.querySelector('[data-wt-center]');
    expect(center.innerHTML).toMatch(/dash-tip[\s\S]*DevOps[\s\S]*WFA/);
    app.teardown();
  });

  it('trajectory bar embeds an assignees popover sourced from skill_splits.assigned_to', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const p = makeProject({ id: 'GCC-HV2' });
    p.skill_splits = { size_engineering: [{ sprint: sprints[0].sprint_id, points: 10, completed: 0, status: 'in_progress', assigned_to: [{ name: 'Alex', points: 5 }, { name: 'Sam', points: 5 }] }] };
    const app = await loadApp(makeDataset({ projects: [p], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    app.Walkthrough.selectProject('GCC-HV2');
    const bar = app.window.document.querySelector('[data-wt-trajectory-bar]');
    expect(bar.innerHTML).toMatch(/Alex/);
    expect(bar.innerHTML).toMatch(/Sam/);
    app.teardown();
  });

  it('dependency row carries target headline + RAG hover popover', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'GCC-HV-A', name: 'Onboard API', rag_schedule: 'Amber' });
    a.narrative = { headline: 'API in flight', wins: [], asks: [], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    const b = makeProject({ id: 'GCC-HV-B', name: 'Reporting' });
    b.dependencies = [{ type: 'project', kind: 'blocked_by', target_id: 'GCC-HV-A' }];
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    app.Walkthrough.selectProject('GCC-HV-B');
    const dep = app.window.document.querySelector('[data-wt-dep-row]');
    expect(dep.innerHTML).toMatch(/API in flight/);
    app.teardown();
  });
});
