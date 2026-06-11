import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Sprint Brief PDF', () => {
  it('builds a doc with one section per team member with assignments', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'Demo', size_engineering: 10,
      skill_splits: { size_engineering: [
        { sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0,
          assigned_to: [{ member: 'Alice', points: 10 }], reasons: [] }
      ]}
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember({ name: 'Alice' })] }));
    const Reports = app.window.__pcc__.Reports;
    const doc = Reports.Builders.sprintBrief('Acme Industries', sprints[0].sprint_id);
    expect(doc).toBeDefined();
    const html = Reports.Doc.toHtml(doc, {});
    expect(html).toMatch(/Sprint Brief/);
    expect(html).toMatch(/Alice/);
    expect(html).toMatch(/Demo/);
    app.teardown();
  });
});
