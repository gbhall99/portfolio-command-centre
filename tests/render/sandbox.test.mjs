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

  it('sandboxed edits never reach localStorage; exit + keep persists them', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Sandboxed' });
    const app = await loadApp(makeDataset({ projects: [proj] }));
    app.App.saveToLocalStorage();
    const before = app.window.localStorage.getItem(app.App.LS_KEY);
    expect(before).toBeTruthy();

    app.App.toggleSandboxMode();
    expect(app.App.sandboxMode).toBe(true);
    const id = app.App.data.projects[0].id;
    app.App.updateProject(id, 'status', 'On Hold', 'user');
    // Live in memory, but nothing persisted while sandboxed.
    expect(app.App.data.projects[0].status).toBe('On Hold');
    expect(app.window.localStorage.getItem(app.App.LS_KEY)).toBe(before);

    // Exit + Keep (confirm resolves false = "Keep changes"): edits persist.
    app.App.confirm = async () => false;
    await app.App.toggleSandboxMode();
    expect(app.App.sandboxMode).toBe(false);
    const persisted = JSON.parse(app.window.localStorage.getItem(app.App.LS_KEY));
    expect(persisted.projects[0].status).toBe('On Hold');
    app.teardown();
  });

  it('exit + discard restores pre-sandbox data, persists it, and is undoable', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Sandboxed' });
    const app = await loadApp(makeDataset({ projects: [proj] }));
    app.App.toggleSandboxMode();
    const id = app.App.data.projects[0].id;
    app.App.updateProject(id, 'status', 'On Hold', 'user');
    expect(app.App.data.projects[0].status).toBe('On Hold');

    // Exit + Discard (confirm resolves true = "Discard sandbox edits").
    app.App.confirm = async () => true;
    await app.App.toggleSandboxMode();
    expect(app.App.sandboxMode).toBe(false);
    expect(app.App.data.projects[0].status).toBe('In Progress');
    const persisted = JSON.parse(app.window.localStorage.getItem(app.App.LS_KEY));
    expect(persisted.projects[0].status).toBe('In Progress');
    // The discard snapshotted the pre-change (sandbox-edited) state: one undo returns to it.
    app.App.undo();
    expect(app.App.data.projects[0].status).toBe('On Hold');
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
