import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.updateProjectRag', () => {
  it('updates the project RAG, audit-logs with walkthrough source, records data_update', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P', rag_schedule: 'Green' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    app.App.updateProjectRag(proj.id, 'schedule', 'Red', wid, 'Sponsor escalation');
    const after = app.App.data.projects[0];
    expect(after.rag_schedule).toBe('Red');
    const audit = app.App.data.audit_log.slice(-1)[0];
    expect(audit.field).toBe('rag_schedule');
    expect(audit.source).toBe('walkthrough');
    expect(audit.rationale).toBe('Sponsor escalation');
    const wt = app.App.data.walkthroughs[0];
    expect(wt.data_updates).toHaveLength(1);
    expect(wt.data_updates[0]).toMatchObject({ kind: 'rag', project_id: proj.id, dimension: 'schedule', from: 'Green', to: 'Red' });
    app.teardown();
  });

  it('rejects invalid dimensions', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    expect(app.App.updateProjectRag(proj.id, 'bogus', 'Red', wid, '')).toBe(false);
    app.teardown();
  });
});

describe('App.updateProjectStatus', () => {
  it('updates the project status with audit + data_update', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P', status: 'In Progress' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    app.App.updateProjectStatus(proj.id, 'Blocked', wid, 'Dep slipped');
    expect(app.App.data.projects[0].status).toBe('Blocked');
    const audit = app.App.data.audit_log.slice(-1)[0];
    expect(audit.field).toBe('status');
    expect(audit.source).toBe('walkthrough');
    const wt = app.App.data.walkthroughs[0];
    expect(wt.data_updates[0]).toMatchObject({ kind: 'status', project_id: proj.id, from: 'In Progress', to: 'Blocked' });
    app.teardown();
  });
});

describe('App.updateRiskStatus / updateRiskScore', () => {
  it('closes a risk with audit + data_update', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P' });
    proj.risks_register = [{ description: 'R1', impact: 4, probability: 3, status: 'open' }];
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    app.App.updateRiskStatus(proj.id, 0, 'closed', wid, 'Mitigation landed');
    expect(app.App.data.projects[0].risks_register[0].status).toBe('closed');
    const wt = app.App.data.walkthroughs[0];
    expect(wt.data_updates[0]).toMatchObject({ kind: 'risk_status', project_id: proj.id, risk_index: 0, from: 'open', to: 'closed' });
    app.teardown();
  });

  it('rescores a risk', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P' });
    proj.risks_register = [{ description: 'R1', impact: 4, probability: 3, status: 'open' }];
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    app.App.updateRiskScore(proj.id, 0, 5, 5, wid);
    expect(app.App.data.projects[0].risks_register[0].impact).toBe(5);
    expect(app.App.data.projects[0].risks_register[0].probability).toBe(5);
    const wt = app.App.data.walkthroughs[0];
    expect(wt.data_updates[0].kind).toBe('risk_score');
    app.teardown();
  });
});

describe('App.updateChipProgress', () => {
  it('updates the chip completed value with audit + data_update', async () => {
    resetIdSeq();
    const sprints = [{ sprint_id: 'CY26-S1', start_date: '2026-04-01', end_date: '2026-05-05', hardening_start: '2026-05-01' }];
    const proj = makeProject({ name: 'P', size_engineering: 10,
      skill_splits: { size_engineering: [{ sprint: 'CY26-S1', points: 10, status: 'pending', completed: 2, assigned_to: [], reasons: [] }] }
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    app.App.updateChipProgress(proj.id, 'size_engineering', 'CY26-S1', 8, wid);
    expect(app.App.data.projects[0].skill_splits.size_engineering[0].completed).toBe(8);
    const wt = app.App.data.walkthroughs[0];
    expect(wt.data_updates[0]).toMatchObject({ kind: 'progress', project_id: proj.id, skill: 'size_engineering', sprint: 'CY26-S1', from: 2, to: 8 });
    app.teardown();
  });
});
