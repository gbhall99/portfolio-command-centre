// Sprint window helper: configurable past/future counts, 'all', and 0; setting accessors.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const iso = (offsetDays) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString().split('T')[0]; };
function boot() {
  const sprints = [
    { sprint_id: 'CY-P3', start_date: iso(-150) },
    { sprint_id: 'CY-P2', start_date: iso(-110) },
    { sprint_id: 'CY-P1', start_date: iso(-40) },
    { sprint_id: 'CY-CUR', start_date: iso(-1) },
    { sprint_id: 'CY-F1', start_date: iso(40) },
    { sprint_id: 'CY-F2', start_date: iso(80) },
    { sprint_id: 'CY-F3', start_date: iso(120) }
  ];
  return loadApp(makeDataset({
    projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    sprints
  }));
}
function bootGap() {
  const sprints = [
    { sprint_id: 'CY-GP1', start_date: iso(-110) },
    { sprint_id: 'CY-GP0', start_date: iso(-45) }, // past: ends ~today-11
    { sprint_id: 'CY-GF1', start_date: iso(10) },  // future: starts ~today+10 (gap over today)
    { sprint_id: 'CY-GF2', start_date: iso(60) }
  ];
  return loadApp(makeDataset({
    projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    sprints
  }));
}
const ids = (r) => r.sprints.map(s => s.sprint_id);

describe('Sprint._windowedSprints with opts', () => {
  it('default (1 past + current + all future)', async () => {
    const app = await boot();
    const r = app.Sprint._windowedSprints(app.App.data.sprints, { past: 1, future: 'all' });
    expect(ids(r)).toEqual(['CY-P1', 'CY-CUR', 'CY-F1', 'CY-F2', 'CY-F3']);
    expect(r.focusId).toBe('CY-CUR');
    app.teardown();
  });
  it('past 0, future 2', async () => {
    const app = await boot();
    const r = app.Sprint._windowedSprints(app.App.data.sprints, { past: 0, future: 2 });
    expect(ids(r)).toEqual(['CY-CUR', 'CY-F1', 'CY-F2']);
    app.teardown();
  });
  it('all past + all future = everything', async () => {
    const app = await boot();
    const r = app.Sprint._windowedSprints(app.App.data.sprints, { past: 'all', future: 'all' });
    expect(ids(r)).toEqual(['CY-P3', 'CY-P2', 'CY-P1', 'CY-CUR', 'CY-F1', 'CY-F2', 'CY-F3']);
    app.teardown();
  });
  it('reads persisted sprint.window when opts omitted', async () => {
    const app = await boot();
    app.App.uiStateSet('sprint.window', { past: 2, future: 1 });
    const r = app.Sprint._windowedSprints(app.App.data.sprints);
    expect(ids(r)).toEqual(['CY-P2', 'CY-P1', 'CY-CUR', 'CY-F1']);
    app.teardown();
  });
  it('partial opts fall back to defaults per-key (future => "all")', async () => {
    const app = await boot();
    // { past: 0 } with no future => future should default to 'all', not 0.
    const r = app.Sprint._windowedSprints(app.App.data.sprints, { past: 0 });
    expect(ids(r)).toEqual(['CY-CUR', 'CY-F1', 'CY-F2', 'CY-F3']);
    app.teardown();
  });
});

describe('Sprint._windowedSprints between cycles (no current sprint)', () => {
  it('{past:1, future:0} => only the past, focusId null (nothing in window to focus)', async () => {
    const app = await bootGap();
    const r = app.Sprint._windowedSprints(app.App.data.sprints, { past: 1, future: 0 });
    expect(ids(r)).toEqual(['CY-GP0']);
    expect(r.focusId).toBe(null);
    app.teardown();
  });
  it('{past:1, future:1} => nearest future shown and is the focus', async () => {
    const app = await bootGap();
    const r = app.Sprint._windowedSprints(app.App.data.sprints, { past: 1, future: 1 });
    expect(ids(r)).toEqual(['CY-GP0', 'CY-GF1']);
    expect(r.focusId).toBe('CY-GF1');
    app.teardown();
  });
});

describe('Sprint._windowOpts normalisation', () => {
  it('defaults to {past:1, future:"all"} when unset', async () => {
    const app = await boot();
    expect(app.Sprint._windowOpts()).toEqual({ past: 1, future: 'all' });
    app.teardown();
  });
  it('coerces string-number and passes "all" through; bad values fall back', async () => {
    const app = await boot();
    app.App.uiStateSet('sprint.window', { past: '3', future: 'all' });
    expect(app.Sprint._windowOpts()).toEqual({ past: 3, future: 'all' });
    app.App.uiStateSet('sprint.window', { past: 'garbage', future: -5 });
    expect(app.Sprint._windowOpts()).toEqual({ past: 1, future: 'all' });
    app.teardown();
  });
});
