import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq, makeSprintSequence, makeMember } from '../harness/fixtures.mjs';

describe('Sandbox + scenario comparison', () => {
  it('toggleSandboxMode flips a flag and the banner appears', async () => {
    const app = await loadApp(makeDataset({}));
    expect(app.App.sandboxMode).toBeFalsy();
    app.App.toggleSandboxMode();
    expect(app.App.sandboxMode).toBe(true);
    const banner = app.window.document.getElementById('sandboxBanner');
    expect(banner).not.toBeNull();
    expect(banner.style.display).not.toBe('none');
    app.teardown();
  });

  it('compareScenarios returns project-level deltas', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'X' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    const a = app.App.saveScenario('A');
    app.App.data.projects[0].name = 'X-Mutated';
    app.App.data.projects[0].size_total = 12;
    const b = app.App.saveScenario('B');
    const diff = app.App.compareScenarios(a, b);
    expect(diff).toBeDefined();
    expect(diff.changedProjects.length).toBeGreaterThan(0);
    expect(diff.changedProjects[0].field).toMatch(/name|size_total/);
    app.teardown();
  });
});
