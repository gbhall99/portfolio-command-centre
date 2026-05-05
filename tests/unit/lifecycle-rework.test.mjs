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
