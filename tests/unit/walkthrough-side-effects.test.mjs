import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Walkthrough write-back helpers', () => {
  it('recordWalkthroughDecision records the decision on the walkthrough without touching the dropped comms_log', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'Acme Industries-WB1' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    app.App.recordWalkthroughDecision(wid, { projectId: 'Acme Industries-WB1', text: 'Park phase 2 until Q3', rationale: 'Capacity constrained' });
    const wt = app.App._findWalkthrough(wid);
    expect(wt.decisions.length).toBe(1);
    expect(wt.decisions[0].text).toContain('Park phase 2 until Q3');
    expect(wt.decisions[0].project_id).toBe('Acme Industries-WB1');
    // comms_log was dropped by the 2026-05 Project Details Overhaul; the migration strips
    // it on load and recordWalkthroughDecision must no longer rehydrate it.
    const proj = app.App.data.projects[0];
    expect(proj.comms_log).toBeUndefined();
    app.teardown();
  });

  it('recordWalkthroughAction tags personal_owner_id when @owner matches a team_members[].name', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'Acme Industries-WB2' });
    const app = await loadApp(makeDataset({ projects: [p], team_members: [makeMember({ name: 'Jordan' }), makeMember({ name: 'Casey' })] }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    app.App.recordWalkthroughAction(wid, { projectId: 'Acme Industries-WB2', description: 'Confirm DQ SME', owner: 'Jordan', due_date: '2026-05-01' });
    const wt = app.App._findWalkthrough(wid);
    expect(wt.actions[0].personal_owner_id).toBe('Jordan');
    app.teardown();
  });

  it('recordWalkthroughAction does not tag personal_owner_id when owner is free-text', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'Acme Industries-WB3' })], team_members: [makeMember({ name: 'Jordan' })] }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    app.App.recordWalkthroughAction(wid, { projectId: 'Acme Industries-WB3', description: 'X', owner: 'External Person' });
    const wt = app.App._findWalkthrough(wid);
    expect(wt.actions[0].personal_owner_id).toBeUndefined();
    app.teardown();
  });

  it('addRiskFromWalkthrough appends to risks_register with added_by_walkthrough_id', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'Acme Industries-WB4' })] }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    app.App.addRiskFromWalkthrough('Acme Industries-WB4', { description: 'data quality', impact: 3, probability: 3 }, wid);
    const proj = app.App.data.projects[0];
    expect(proj.risks_register.length).toBe(1);
    expect(proj.risks_register[0].added_by_walkthrough_id).toBe(wid);
    expect(proj.risks_register[0].added_at).toBeTruthy();
    app.teardown();
  });

  it('updateProjectNarrative patches headline/wins/asks/customer_visible_risk_ids and stamps updated_at', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'Acme Industries-WB5' })] }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    app.App.updateProjectNarrative('Acme Industries-WB5', { headline: 'New headline', wins: ['win1', 'win2'] }, wid);
    const proj = app.App.data.projects[0];
    expect(proj.narrative.headline).toBe('New headline');
    expect(proj.narrative.wins).toEqual(['win1', 'win2']);
    expect(proj.narrative.updated_by_walkthrough_id).toBe(wid);
    expect(proj.narrative.updated_at).toBeTruthy();
    app.teardown();
  });

  it('bumpProjectReviewed sets last_reviewed_at + last_reviewed_by_walkthrough_id', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'Acme Industries-WB6' })] }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    app.App.bumpProjectReviewed('Acme Industries-WB6', wid);
    const proj = app.App.data.projects[0];
    expect(proj.last_reviewed_at).toBeTruthy();
    expect(proj.last_reviewed_by_walkthrough_id).toBe(wid);
    app.teardown();
  });

  it('completeForumAction sets status=Done and completed_at on the forum action', async () => {
    resetIdSeq();
    const forums = [{ id: 'F1', name: 'Reporting & Delivery Strategy', customer: 'Acme Industries', actions: [{ id: 'A1', description: 'Confirm DQ SME', status: 'Open', due_date: '2026-04-25' }], decisions: [] }];
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'Acme Industries-WB7' })], governance_forums: forums }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    app.App.completeForumAction('F1', 'A1', wid);
    const action = app.App.data.governance_forums[0].actions[0];
    expect(action.status).toBe('Done');
    expect(action.completed_at).toBeTruthy();
    app.teardown();
  });

  it('deferForumAction updates due_date', async () => {
    resetIdSeq();
    const forums = [{ id: 'F1', name: 'Reporting & Delivery Strategy', customer: 'Acme Industries', actions: [{ id: 'A1', description: 'Confirm DQ SME', status: 'Open', due_date: '2026-04-25' }], decisions: [] }];
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'Acme Industries-WB8' })], governance_forums: forums }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    app.App.deferForumAction('F1', 'A1', '2026-05-15', wid);
    expect(app.App.data.governance_forums[0].actions[0].due_date).toBe('2026-05-15');
    app.teardown();
  });
});
