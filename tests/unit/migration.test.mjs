// Schema migration + settings defaults regression net.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, resetIdSeq } from '../harness/fixtures.mjs';

describe('migrateSchema', () => {
  it('strips legacy Hypercare fields from projects', async () => {
    resetIdSeq();
    const legacy = makeProject({ id: 'GCC-LEGACY' });
    legacy.size_hypercare = 42;
    legacy.delivery_config = { phase_order: ['Data Engineering', 'Hypercare'], include_hypercare: true };
    const app = await loadApp(makeDataset({ projects: [legacy] }));
    const p = app.App.data.projects.find(x => x.id === 'GCC-LEGACY');
    expect(p.size_hypercare).toBeUndefined();
    expect(p.delivery_config.include_hypercare).toBeUndefined();
    expect(p.delivery_config.phase_order).not.toContain('Hypercare');
    app.teardown();
  });

  it('is idempotent — running migrate twice leaves state unchanged', async () => {
    const app = await loadApp();
    const before = JSON.stringify(app.App.data.projects);
    app.App.migrateSchema(app.App.data);
    const after = JSON.stringify(app.App.data.projects);
    expect(after).toBe(before);
    app.teardown();
  });

  it('defaults missing project.ownership to "Lead & Delivery" so legacy data does not trigger phantom unsaved-changes', async () => {
    resetIdSeq();
    const legacy = makeProject({ id: 'GCC-OWN' });
    delete legacy.ownership;
    const app = await loadApp(makeDataset({ projects: [legacy] }));
    const p = app.App.data.projects.find(x => x.id === 'GCC-OWN');
    expect(p.ownership).toBe('Lead & Delivery');
    app.teardown();
  });

  it('canonicalises legacy "We Own" / "Requirements Received" values into the dropdown options', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'GCC-OWN-A' }); a.ownership = 'We Own';
    const b = makeProject({ id: 'GCC-OWN-B' }); b.ownership = 'Requirements Received';
    const app = await loadApp(makeDataset({ projects: [a, b] }));
    expect(app.App.data.projects.find(x => x.id === 'GCC-OWN-A').ownership).toBe('Lead & Delivery');
    expect(app.App.data.projects.find(x => x.id === 'GCC-OWN-B').ownership).toBe('Delivery');
    app.teardown();
  });

  it('preserves an already-canonical ownership when present', async () => {
    resetIdSeq();
    const proj = makeProject({ id: 'GCC-OWN2' });
    proj.ownership = 'Delivery';
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const p = app.App.data.projects.find(x => x.id === 'GCC-OWN2');
    expect(p.ownership).toBe('Delivery');
    app.teardown();
  });
});

describe('_ensureSettingsDefaults', () => {
  it('populates scheduler, scoring, thresholds when settings is empty', async () => {
    const app = await loadApp(makeDataset({ projects: [], settings: {} }));
    const s = app.App.data.settings;
    expect(s.scheduler).toBeDefined();
    expect(s.scoring).toBeDefined();
    expect(s.thresholds).toBeDefined();
    expect(s.scheduler.defaultDevDays).toBe(20);
    expect(s.scheduler.daysPerSPMultiplier).toBe(1);
    expect(s.scoring.statusWeights.Blocked).toBe(5);
    app.teardown();
  });

  it('preserves caller-specified values when filling defaults', async () => {
    const app = await loadApp(makeDataset({
      projects: [],
      settings: { scheduler: { defaultDevDays: 99 }, scoring: { sizeDivisor: 3 } }
    }));
    expect(app.App.data.settings.scheduler.defaultDevDays).toBe(99);
    expect(app.App.data.settings.scoring.sizeDivisor).toBe(3);
    // And the missing defaults still land:
    expect(app.App.data.settings.scoring.sizeCap).toBe(20);
    app.teardown();
  });
});
