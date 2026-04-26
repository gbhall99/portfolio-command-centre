import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Walkthrough session', () => {
  it('startWalkthrough creates a row with id + started_at', async () => {
    const app = await loadApp(makeDataset({}));
    const id = app.App.startWalkthrough('GCC', ['SM', 'PO']);
    expect(id).toMatch(/^wt_/);
    expect(app.App.data.walkthroughs).toHaveLength(1);
    expect(app.App.data.walkthroughs[0].started_at).toBeTruthy();
    expect(app.App.data.walkthroughs[0].attendees).toEqual(['SM', 'PO']);
    app.teardown();
  });

  it('recordWalkthroughDecision appends to session AND audit log', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'X' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const id = app.App.startWalkthrough('GCC', []);
    app.App.recordWalkthroughDecision(id, { projectId: proj.id, text: 'Defer DE', rationale: 'Sponsor concern' });
    const wt = app.App.data.walkthroughs[0];
    expect(wt.decisions).toHaveLength(1);
    expect(wt.decisions[0].text).toBe('Defer DE');
    const audit = app.App.data.audit_log.slice(-1)[0];
    expect(audit.field).toBe('walkthrough_decision');
    expect(audit.rationale).toBe('Sponsor concern');
    app.teardown();
  });

  it('recordWalkthroughAction appends to session AND to forum', async () => {
    const forum = { id: 'GovBoard', name: 'Governance Board', actions: [] };
    const app = await loadApp(makeDataset({ governance_forums: [forum] }));
    const id = app.App.startWalkthrough('GCC', []);
    app.App.recordWalkthroughAction(id, { description: 'Confirm Veena availability', owner: 'PO', due_date: '2026-04-30', forumId: 'GovBoard' });
    expect(app.App.data.walkthroughs[0].actions).toHaveLength(1);
    expect(app.App.data.governance_forums[0].actions).toHaveLength(1);
    expect(app.App.data.governance_forums[0].actions[0].description).toBe('Confirm Veena availability');
    app.teardown();
  });

  it('completeWalkthrough sets completed_at and minutes_html', async () => {
    const app = await loadApp(makeDataset({}));
    const id = app.App.startWalkthrough('GCC', []);
    app.App.completeWalkthrough(id);
    const wt = app.App.data.walkthroughs[0];
    expect(wt.completed_at).toBeTruthy();
    expect(typeof wt.minutes_html).toBe('string');
    expect(wt.minutes_html.length).toBeGreaterThan(0);
    app.teardown();
  });

  it('archives entries past 52 into walkthroughs_archive[]', async () => {
    const app = await loadApp(makeDataset({}));
    for (let i = 0; i < 55; i++) {
      const id = app.App.startWalkthrough('GCC', []);
      app.App.completeWalkthrough(id);
    }
    expect(app.App.data.walkthroughs.length).toBeLessThanOrEqual(52);
    expect(Array.isArray(app.App.data.walkthroughs_archive)).toBe(true);
    expect(app.App.data.walkthroughs_archive.length).toBeGreaterThan(0);
    app.teardown();
  });

  it('getActiveWalkthrough returns the in-progress session for a customer', async () => {
    const app = await loadApp(makeDataset({}));
    expect(app.App.getActiveWalkthrough('GCC')).toBeNull();
    const id = app.App.startWalkthrough('GCC', []);
    expect(app.App.getActiveWalkthrough('GCC').id).toBe(id);
    app.App.completeWalkthrough(id);
    expect(app.App.getActiveWalkthrough('GCC')).toBeNull();
    app.teardown();
  });
});
