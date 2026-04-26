import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Backlog buckets', () => {
  it('groups projects into Unrefined / Refined / Parked', async () => {
    resetIdSeq();
    const unrefined = makeProject({ name: 'Idea', status: 'Not Started' });
    delete unrefined.size_total; unrefined.size_total = 0;
    const refined  = makeProject({ name: 'Ready', status: 'Not Started', business_value: 8, time_criticality: 6, risk_reduction_opportunity: 5, size_engineering: 10 });
    refined.size_total = 10;
    const parked   = makeProject({ name: 'Wont', status: 'On Hold', moscow: "Won't" });
    parked.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [unrefined, refined, parked] }));
    const out = app.App.computeBacklogBuckets('GCC');
    expect(out.unrefined.map(p => p.name)).toContain('Idea');
    expect(out.refined.map(p => p.name)).toContain('Ready');
    expect(out.parked.map(p => p.name)).toContain('Wont');
    app.teardown();
  });

  it('treats projects without sizing as unrefined', async () => {
    resetIdSeq();
    const p = makeProject({ name: 'Empty', status: 'Not Started' });
    delete p.size_total; p.size_total = 0;
    const app = await loadApp(makeDataset({ projects: [p] }));
    const out = app.App.computeBacklogBuckets('GCC');
    expect(out.unrefined).toHaveLength(1);
    expect(out.refined).toHaveLength(0);
    app.teardown();
  });
});
