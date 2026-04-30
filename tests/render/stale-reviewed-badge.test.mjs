import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Stale detector — reviewed-vs-updated split', () => {
  it('row shows a "reviewed N days ago" tooltip when last_reviewed_at is set', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'Acme Industries-S1', name: 'Reviewed Recently' });
    p.last_reviewed_at = new Date(Date.now() - 6 * 86400000).toISOString();
    p.last_updated = new Date(Date.now() - 30 * 86400000).toISOString();
    const app = await loadApp(makeDataset({ projects: [p], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    const html = app.Dashboard.buildRowHtml(app.App.data.projects[0]);
    expect(html).toMatch(/Reviewed/);
    expect(html).toMatch(/reviewed-badge/);
    app.teardown();
  });

  it('row does not show the badge when last_reviewed_at is null', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'Acme Industries-S2', name: 'Never reviewed' });
    p.last_reviewed_at = null;
    const app = await loadApp(makeDataset({ projects: [p], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    const html = app.Dashboard.buildRowHtml(app.App.data.projects[0]);
    expect(html).not.toMatch(/reviewed-badge/);
    app.teardown();
  });
});
