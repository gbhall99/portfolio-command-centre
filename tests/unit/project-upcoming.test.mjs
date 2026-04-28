import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.computeProjectUpcoming', () => {
  it('returns target_date with day-to + state', async () => {
    resetIdSeq();
    const fmt = ms => new Date(ms).toISOString().slice(0, 10);
    const p = makeProject({ id: 'Acme Industries-U1', target_date: fmt(Date.now() + 27 * 86400000) });
    const app = await loadApp(makeDataset({ projects: [p], sprints: makeSprintSequence(2) }));
    const u = app.App.computeProjectUpcoming('Acme Industries-U1');
    expect(u.target_date).toBeDefined();
    expect(u.target_date.days_to).toBe(27);
    expect(u.target_date.state).toBe('green');
    app.teardown();
  });

  it('flags target_date amber within 14 days, red within 7', async () => {
    resetIdSeq();
    const fmt = ms => new Date(ms).toISOString().slice(0, 10);
    const a = makeProject({ id: 'Acme Industries-U-A', target_date: fmt(Date.now() + 5 * 86400000) });
    const b = makeProject({ id: 'Acme Industries-U-B', target_date: fmt(Date.now() + 12 * 86400000) });
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2) }));
    expect(app.App.computeProjectUpcoming('Acme Industries-U-A').target_date.state).toBe('red');
    expect(app.App.computeProjectUpcoming('Acme Industries-U-B').target_date.state).toBe('amber');
    app.teardown();
  });

  it('resolves dependency target_name from App.data.projects', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'Acme Industries-DEP-A', name: 'Onboarding API' });
    const b = makeProject({ id: 'Acme Industries-DEP-B', name: 'Reporting' });
    b.dependencies = [{ type: 'project', kind: 'blocked_by', target_id: 'Acme Industries-DEP-A' }];
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2) }));
    const u = app.App.computeProjectUpcoming('Acme Industries-DEP-B');
    expect(u.dependencies.length).toBe(1);
    expect(u.dependencies[0].target_name).toBe('Onboarding API');
    expect(u.dependencies[0].kind).toBe('blocked_by');
    app.teardown();
  });
});
