import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Per-project sponsor pack', () => {
  it('buildProjectPackDoc returns a doc with sections for narrative/milestones/risks/EVM', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Demo', sponsor: 'Sandra Lee', manager: 'Owen' });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    const Report = app.window.__pcc__.Report;
    expect(Report).toBeDefined();
    const doc = Report.buildProjectPackDoc(proj.id);
    expect(doc).toBeDefined();
    const html = String(doc);
    expect(html).toMatch(/Demo/);
    expect(html).toMatch(/Narrative/i);
    expect(html).toMatch(/Risks/i);
    expect(html).toMatch(/Sandra Lee/);
    app.teardown();
  });
});
