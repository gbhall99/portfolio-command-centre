import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Scenarios — storage shape', () => {
  it('saveScenario captures full data and returns an id', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'X' })], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    const id = app.App.saveScenario('Plan A');
    expect(id).toMatch(/^sc_/);
    const list = app.App.listScenarios();
    expect(list.find(s => s.id === id)).toBeDefined();
    expect(list.find(s => s.id === id).name).toBe('Plan A');
    app.teardown();
  });

  it('loadScenario restores the captured state byte-for-byte', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'Original' })], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    const id = app.App.saveScenario('snap');
    app.App.data.projects[0].name = 'Mutated';
    app.App.loadScenario(id);
    expect(app.App.data.projects[0].name).toBe('Original');
    app.teardown();
  });

  it('deleteScenario removes the entry', async () => {
    const app = await loadApp(makeDataset({}));
    const id = app.App.saveScenario('temp');
    expect(app.App.listScenarios().length).toBe(1);
    app.App.deleteScenario(id);
    expect(app.App.listScenarios().length).toBe(0);
    app.teardown();
  });
});
