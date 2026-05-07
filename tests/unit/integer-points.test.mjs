// Story points must be whole integers everywhere except sanctioned statistics
// (velocity averages, days-per-SP). Covers the helpers and the migration rounder.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.toInteger', () => {
  it('rounds fractional input half-up, never truncates', async () => {
    const app = await loadApp();
    expect(app.App.toInteger(2.5)).toBe(3);
    expect(app.App.toInteger(2.4)).toBe(2);
    expect(app.App.toInteger('10.5')).toBe(11);
    expect(app.App.toInteger(0)).toBe(0);
    expect(app.App.toInteger('')).toBe(0);
    expect(app.App.toInteger(null)).toBe(0);
    expect(app.App.toInteger(undefined)).toBe(0);
    expect(app.App.toInteger('garbage')).toBe(0);
    expect(app.App.toInteger(-3)).toBe(0);  // clamped ≥ 0
    app.teardown();
  });
});

describe('App.fmtPoints', () => {
  it('formats as integer string for any numeric input', async () => {
    const app = await loadApp();
    expect(app.App.fmtPoints(7)).toBe('7');
    expect(app.App.fmtPoints(7.4)).toBe('7');
    expect(app.App.fmtPoints(7.5)).toBe('8');
    expect(app.App.fmtPoints('12.9')).toBe('13');
    app.teardown();
  });
});

describe('App.fmtAverage', () => {
  it('preserves one decimal by default — used for velocity/capacity statistics', async () => {
    const app = await loadApp();
    expect(app.App.fmtAverage(14.06)).toBe('14.1');
    expect(app.App.fmtAverage(14.06, 2)).toBe('14.06');
    expect(app.App.fmtAverage(15)).toBe('15.0');
    expect(app.App.fmtAverage(NaN)).toBe('—');
    app.teardown();
  });
});

describe('migrateSchema — integer points', () => {
  it('rounds fractional story points on projects and splits', async () => {
    resetIdSeq();
    const dirty = makeProject({
      id: 'Acme Industries-DIRTY',
      size_engineering: 5.5,
      size_total: 5.5,
      skill_splits: {
        size_engineering: [
          { sprint: 'CY26-S1', points: 2.5, completed: 1.2, assigned_to: [{ member: 'Alice', points: 2.5 }] }
        ]
      }
    });
    const app = await loadApp(makeDataset({ projects: [dirty] }));
    const p = app.App.data.projects.find(x => x.id === 'Acme Industries-DIRTY');
    expect(p.size_engineering).toBe(6);
    expect(p.size_total).toBe(6);
    const split = p.skill_splits.size_engineering[0];
    expect(split.points).toBe(3);
    expect(split.completed).toBe(1);
    expect(split.assigned_to[0].points).toBe(3);
    app.teardown();
  });

  it('rounds fractional team member capacity fields', async () => {
    const app = await loadApp(makeDataset({
      projects: [],
      team_members: [{
        name: 'Bob',
        role: 'Dev',
        customer: 'Acme Industries',
        primary_skills: ['size_engineering'],
        secondary_skills: [],
        available_points_per_sprint: 14.06,
        story_points_per_sprint: 14.06,
        capacity_by_customer: { 'Acme Industries': 7.5, 'Globex': 6.56 },
        sprint_overrides: { 'CY26-S1': { available_points: 12.4 } },
        holidays: [],
        holiday_impact_per_sprint: 0
      }]
    }));
    const tm = app.App.data.team_members[0];
    expect(tm.available_points_per_sprint).toBe(14);
    expect(tm.story_points_per_sprint).toBe(14);
    expect(tm.capacity_by_customer['Acme Industries']).toBe(8);
    expect(tm.capacity_by_customer['Globex']).toBe(7);
    expect(tm.sprint_overrides['CY26-S1'].available_points).toBe(12);
    app.teardown();
  });

  it('is idempotent — running migrate twice leaves integer points unchanged', async () => {
    const app = await loadApp();
    app.App.migrateSchema(app.App.data);
    const before = JSON.stringify(app.App.data.projects);
    app.App.migrateSchema(app.App.data);
    expect(JSON.stringify(app.App.data.projects)).toBe(before);
    app.teardown();
  });
});
