import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Walkthrough write-back helpers', () => {
  it('recordWalkthroughDecision auto-feeds the project comms_log with source: walkthrough', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-WB1' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const wid = app.App.startWalkthrough('GCC', []);
    app.App.recordWalkthroughDecision(wid, { projectId: 'GCC-WB1', text: 'Park phase 2 until Q3', rationale: 'Capacity constrained' });
    const proj = app.App.data.projects[0];
    expect(Array.isArray(proj.comms_log)).toBe(true);
    const entry = proj.comms_log[proj.comms_log.length - 1];
    expect(entry.note).toContain('Park phase 2 until Q3');
    expect(entry.source).toBe('walkthrough');
    expect(entry.walkthrough_id).toBe(wid);
    app.teardown();
  });

  it('recordWalkthroughAction tags personal_owner_id when @owner matches a team_members[].name', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-WB2' });
    const app = await loadApp(makeDataset({ projects: [p], team_members: [makeMember({ name: 'Shazia' }), makeMember({ name: 'Neil' })] }));
    const wid = app.App.startWalkthrough('GCC', []);
    app.App.recordWalkthroughAction(wid, { projectId: 'GCC-WB2', description: 'Confirm DQ SME', owner: 'Shazia', due_date: '2026-05-01' });
    const wt = app.App._findWalkthrough(wid);
    expect(wt.actions[0].personal_owner_id).toBe('Shazia');
    app.teardown();
  });

  it('recordWalkthroughAction does not tag personal_owner_id when owner is free-text', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'GCC-WB3' })], team_members: [makeMember({ name: 'Shazia' })] }));
    const wid = app.App.startWalkthrough('GCC', []);
    app.App.recordWalkthroughAction(wid, { projectId: 'GCC-WB3', description: 'X', owner: 'External Person' });
    const wt = app.App._findWalkthrough(wid);
    expect(wt.actions[0].personal_owner_id).toBeUndefined();
    app.teardown();
  });

  it('addRiskFromWalkthrough appends to risks_register with added_by_walkthrough_id', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'GCC-WB4' })] }));
    const wid = app.App.startWalkthrough('GCC', []);
    app.App.addRiskFromWalkthrough('GCC-WB4', { description: 'data quality', impact: 3, probability: 3 }, wid);
    const proj = app.App.data.projects[0];
    expect(proj.risks_register.length).toBe(1);
    expect(proj.risks_register[0].added_by_walkthrough_id).toBe(wid);
    expect(proj.risks_register[0].added_at).toBeTruthy();
    app.teardown();
  });

  it('updateProjectNarrative patches headline/wins/asks/customer_visible_risk_ids and stamps updated_at', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'GCC-WB5' })] }));
    const wid = app.App.startWalkthrough('GCC', []);
    app.App.updateProjectNarrative('GCC-WB5', { headline: 'New headline', wins: ['win1', 'win2'] }, wid);
    const proj = app.App.data.projects[0];
    expect(proj.narrative.headline).toBe('New headline');
    expect(proj.narrative.wins).toEqual(['win1', 'win2']);
    expect(proj.narrative.updated_by_walkthrough_id).toBe(wid);
    expect(proj.narrative.updated_at).toBeTruthy();
    app.teardown();
  });

  it('bumpProjectReviewed sets last_reviewed_at + last_reviewed_by_walkthrough_id', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'GCC-WB6' })] }));
    const wid = app.App.startWalkthrough('GCC', []);
    app.App.bumpProjectReviewed('GCC-WB6', wid);
    const proj = app.App.data.projects[0];
    expect(proj.last_reviewed_at).toBeTruthy();
    expect(proj.last_reviewed_by_walkthrough_id).toBe(wid);
    app.teardown();
  });

  it('completeForumAction sets status=Done and completed_at on the forum action', async () => {
    resetIdSeq();
    const forums = [{ id: 'F1', name: 'Reporting & Delivery Strategy', customer: 'GCC', actions: [{ id: 'A1', description: 'Confirm DQ SME', status: 'Open', due_date: '2026-04-25' }], decisions: [] }];
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'GCC-WB7' })], governance_forums: forums }));
    const wid = app.App.startWalkthrough('GCC', []);
    app.App.completeForumAction('F1', 'A1', wid);
    const action = app.App.data.governance_forums[0].actions[0];
    expect(action.status).toBe('Done');
    expect(action.completed_at).toBeTruthy();
    app.teardown();
  });

  it('deferForumAction updates due_date', async () => {
    resetIdSeq();
    const forums = [{ id: 'F1', name: 'Reporting & Delivery Strategy', customer: 'GCC', actions: [{ id: 'A1', description: 'Confirm DQ SME', status: 'Open', due_date: '2026-04-25' }], decisions: [] }];
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'GCC-WB8' })], governance_forums: forums }));
    const wid = app.App.startWalkthrough('GCC', []);
    app.App.deferForumAction('F1', 'A1', '2026-05-15', wid);
    expect(app.App.data.governance_forums[0].actions[0].due_date).toBe('2026-05-15');
    app.teardown();
  });
});
