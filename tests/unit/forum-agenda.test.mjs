import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Forum agenda generator', () => {
  it('builds an agenda doc with linked projects and open actions', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Linked', governance_forum: 'GovBoard' });
    proj.size_total = 5;
    const forum = {
      id: 'GovBoard', name: 'Governance Board', cadence: 'Monthly',
      next_date: '2026-05-15',
      actions: [{ description: 'Approve scope', owner: 'Alice', due_date: '2026-05-01', status: 'Open' }],
      decisions: []
    };
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()],
      governance_forums: [forum]
    }));
    const Governance = app.window.__pcc__.Governance;
    expect(Governance).toBeDefined();
    const doc = Governance.buildAgendaDoc('GovBoard');
    expect(doc).toBeDefined();
    const html = String(doc);
    expect(html).toMatch(/Governance Board/);
    expect(html).toMatch(/Linked/);
    expect(html).toMatch(/Approve scope/);
    app.teardown();
  });
});
