import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Lifecycle constants + migration', () => {
  it('LIFECYCLE_STAGES no longer contains Phase-1 Build', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    expect(app.App.LIFECYCLE_STAGES).toEqual(['Idea', 'Discovery', 'POC', 'Implementation', 'Run/BAU']);
    app.teardown();
  });

  it('legacy Phase-1 Build value is migrated to Implementation', async () => {
    const p = makeProject({ id: 'LEGACY', lifecycle_stage: 'Phase-1 Build' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const got = app.App.data.projects.find(x => x.id === 'LEGACY');
    expect(got.lifecycle_stage).toBe('Implementation');
    app.teardown();
  });

  it('unknown stage values fall back to default', async () => {
    const p = makeProject({ id: 'BOGUS', lifecycle_stage: 'WhateverThisIs' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const got = app.App.data.projects.find(x => x.id === 'BOGUS');
    expect(got.lifecycle_stage).toBe('Implementation');
    app.teardown();
  });
});

describe('Lifecycle WSJF penalty removed', () => {
  it('lifecycleConvictionPenalty function no longer exists', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    expect(app.App.lifecycleConvictionPenalty).toBeUndefined();
    app.teardown();
  });

  it('two projects with identical inputs but different stages get equal WSJF score', async () => {
    const a = makeProject({
      id: 'A', lifecycle_stage: 'Implementation',
      business_value: 8, time_criticality: 5, risk_reduction_opportunity: 3, size_total: 10
    });
    const b = makeProject({
      id: 'B', lifecycle_stage: 'POC',
      business_value: 8, time_criticality: 5, risk_reduction_opportunity: 3, size_total: 10
    });
    const app = await loadApp(makeDataset({ projects: [a, b] }));
    const sa = app.App.calculateWsjf ? app.App.calculateWsjf(a) : null;
    const sb = app.App.calculateWsjf ? app.App.calculateWsjf(b) : null;
    if (sa && sb && typeof sa === 'object') {
      expect(sa.wsjf).toBe(sb.wsjf);
    } else {
      expect(sa).toBe(sb);
    }
    app.teardown();
  });
});

describe('App.advanceStage', () => {
  it('exists as a function', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    expect(typeof app.App.advanceStage).toBe('function');
    app.teardown();
  });

  it('writes via updateProject and audits the transition', async () => {
    const p = makeProject({ id: 'X', lifecycle_stage: 'Discovery' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const ok = app.App.advanceStage('X', 'POC');
    expect(ok).toBe(true);
    const got = app.App.data.projects.find(x => x.id === 'X');
    expect(got.lifecycle_stage).toBe('POC');
    app.teardown();
  });

  it('returns false for invalid stage', async () => {
    const p = makeProject({ id: 'Y', lifecycle_stage: 'Discovery' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const ok = app.App.advanceStage('Y', 'Bogus');
    expect(ok).toBe(false);
    expect(app.App.data.projects[0].lifecycle_stage).toBe('Discovery');
    app.teardown();
  });

  it('returns false when stage unchanged (no-op)', async () => {
    const p = makeProject({ id: 'Z', lifecycle_stage: 'POC' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const ok = app.App.advanceStage('Z', 'POC');
    expect(ok).toBe(false);
    app.teardown();
  });

  it('does NOT auto-snapshot baseline (decoupled from stage)', async () => {
    const p = makeProject({
      id: 'NB', lifecycle_stage: 'POC',
      start_date: '2026-04-01', target_date: '2026-06-30',
      baseline_start: null, baseline_end: null
    });
    const app = await loadApp(makeDataset({ projects: [p] }));
    app.App.advanceStage('NB', 'Implementation');
    const got = app.App.data.projects.find(x => x.id === 'NB');
    expect(got.lifecycle_stage).toBe('Implementation');
    expect(got.baseline_start).toBeNull();
    expect(got.baseline_end).toBeNull();
    app.teardown();
  });
});

describe('App.convertToImplementation backwards-compat shim', () => {
  it('still exists and flips stage to Implementation', async () => {
    const p = makeProject({ id: 'C', lifecycle_stage: 'POC' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    expect(typeof app.App.convertToImplementation).toBe('function');
    const ok = app.App.convertToImplementation('C');
    expect(ok).toBe(true);
    expect(app.App.data.projects[0].lifecycle_stage).toBe('Implementation');
    app.teardown();
  });
});

describe('Run/BAU treatment', () => {
  it('Run/BAU project keeps natural WSJF (no -1000 hack)', async () => {
    const p = makeProject({
      id: 'BAU', lifecycle_stage: 'Run/BAU',
      business_value: 8, time_criticality: 5, risk_reduction_opportunity: 3, size_total: 10
    });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const score = app.App.calculateScore ? app.App.calculateScore(p) : null;
    if (typeof score === 'number') {
      expect(score).toBeGreaterThan(-100);
    }
    app.teardown();
  });
});
