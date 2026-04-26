// lifecycle_stage is a first-class field with a fixed enum and a migration
// path that defaults legacy projects to 'Implementation'.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

describe('lifecycle_stage — schema and migration', () => {
  it('exposes the canonical enum on App.LIFECYCLE_STAGES', async () => {
    const app = await loadApp(makeDataset({}));
    expect(app.App.LIFECYCLE_STAGES).toEqual(['Idea', 'Discovery', 'POC', 'Phase-1 Build', 'Implementation', 'Run/BAU']);
    app.teardown();
  });

  it('migrateSchema defaults missing lifecycle_stage to "Implementation"', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Legacy' });
    delete proj.lifecycle_stage;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    expect(app.App.data.projects[0].lifecycle_stage).toBe('Implementation');
    app.teardown();
  });

  it('migrateSchema does NOT overwrite an existing lifecycle_stage', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'POC', lifecycle_stage: 'POC' });
    const app = await loadApp(makeDataset({ projects: [proj] }));
    expect(app.App.data.projects[0].lifecycle_stage).toBe('POC');
    app.teardown();
  });

  it('quickAdd creates new projects with lifecycle_stage = "Implementation" by default', async () => {
    const app = await loadApp(makeDataset({}));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.quickAdd('blank');
    const created = app.App.data.projects[app.App.data.projects.length - 1];
    expect(created.lifecycle_stage).toBe('Implementation');
    app.teardown();
  });
});

describe('lifecycle_stage — wizard capture', () => {
  it('reads lifecycle_stage from the wizard select on Create', async () => {
    const app = await loadApp(makeDataset({}));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel._openQuickAddWizard();
    const sel = app.window.document.getElementById('qaLifecycleStage');
    expect(sel).not.toBeNull();
    sel.value = 'POC';
    app.window.document.getElementById('qaName').value = 'A POC';
    app.DetailPanel._confirmWizard();
    const created = app.App.data.projects.find(p => p.name === 'A POC');
    expect(created).toBeDefined();
    expect(created.lifecycle_stage).toBe('POC');
    app.teardown();
  });
});
