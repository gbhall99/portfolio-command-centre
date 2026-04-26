// Named baselines must capture per-project dates and sizes alongside skill_splits,
// so a single Set Baseline drives the variance report AND the movers legend.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function setup() {
  resetIdSeq();
  const sprints = makeSprintSequence(3);
  const proj = makeProject({
    name: 'Dated project',
    size_engineering: 10,
    start_date: '2026-04-01',
    target_date: '2026-06-30',
    hard_deadline: '2026-07-15',
    skill_splits: {
      size_engineering: [
        { sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 0, assigned_to: [], reasons: [] }
      ]
    }
  });
  proj.size_total = 10;
  const app = await loadApp(makeDataset({
    projects: [proj], sprints, team_members: [makeMember()]
  }));
  app.App.prompt = async () => 'April commit';
  return { app, proj };
}

describe('Named baseline — extended snapshot', () => {
  it('captures dates and sizes per project, not just skill_splits', async () => {
    const { app, proj } = await setup();
    await app.Gantt.openSetBaseline();
    const baselines = app.App.data.baselines || [];
    expect(baselines).toHaveLength(1);
    const snap = baselines[0].snapshot[proj.id];
    expect(snap).toBeDefined();
    expect(snap.skill_splits).toBeDefined();
    expect(snap.start_date).toBe('2026-04-01');
    expect(snap.target_date).toBe('2026-06-30');
    expect(snap.hard_deadline).toBe('2026-07-15');
    expect(snap.size_total).toBe(10);
    expect(snap.size_engineering).toBe(10);
    app.teardown();
  });
});

describe('Movers legend — reads snapshot.target_date', () => {
  it('detects projects whose target_date moved since the baseline', async () => {
    const { app, proj } = await setup();
    await app.Gantt.openSetBaseline();
    proj.target_date = '2026-07-28';
    app.Gantt.renderLegend();
    const legend = app.window.document.getElementById('ganttLegend');
    expect(legend).not.toBeNull();
    expect(legend.innerHTML).toMatch(/Since baseline/);
    expect(legend.innerHTML).toMatch(/1 moved right/);
    expect(legend.innerHTML).not.toMatch(/no target dates moved/);
    app.teardown();
  });

  it('reports "no target dates moved" only when nothing actually moved', async () => {
    const { app } = await setup();
    await app.Gantt.openSetBaseline();
    app.Gantt.renderLegend();
    const legend = app.window.document.getElementById('ganttLegend');
    expect(legend.innerHTML).toMatch(/no target dates moved/);
    app.teardown();
  });
});

describe('Gantt._projectBaselineSpan — tolerates new shape', () => {
  it('reads sprint span from snapshot.skill_splits (new shape)', async () => {
    const { app, proj } = await setup();
    await app.Gantt.openSetBaseline();
    const span = app.Gantt._projectBaselineSpan(proj.id);
    expect(span).not.toBeNull();
    expect(span.startSprint).toBe('CY26-S1');
    app.teardown();
  });
});

describe('Variance Report — reads named baseline first', () => {
  it('returns drift relative to the active named baseline, not p.baseline_start/end', async () => {
    const { app, proj } = await setup();
    await app.Gantt.openSetBaseline();
    proj.target_date = '2026-07-28';
    const variance = app.Gantt.getBaselineVariance();
    expect(variance).toHaveLength(1);
    expect(variance[0].endDrift).toBe(28);
    expect(variance[0].trend).toBe('slipping');
    app.teardown();
  });

  it('falls back to p.baseline_start/end when no named baseline is active', async () => {
    const { app, proj } = await setup();
    proj.baseline_start = '2026-04-01';
    proj.baseline_end = '2026-06-30';
    proj.target_date = '2026-07-28';
    const variance = app.Gantt.getBaselineVariance();
    expect(variance).toHaveLength(1);
    expect(variance[0].endDrift).toBe(28);
    app.teardown();
  });
});
