import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

describe('Range estimation — schema', () => {
  it('migrateSchema seeds *_max fields equal to their point estimate when missing', async () => {
    resetIdSeq();
    const proj = makeProject({ size_engineering: 10, size_tableau: 5 });
    delete proj.size_engineering_max;
    delete proj.size_tableau_max;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    expect(app.App.data.projects[0].size_engineering_max).toBe(10);
    expect(app.App.data.projects[0].size_tableau_max).toBe(5);
    app.teardown();
  });

  it('does not overwrite an explicit *_max if already set', async () => {
    resetIdSeq();
    const proj = makeProject({ size_engineering: 10 });
    proj.size_engineering_max = 24;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    expect(app.App.data.projects[0].size_engineering_max).toBe(24);
    app.teardown();
  });
});
