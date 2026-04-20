// Sprint labels follow the calendar year they finish in. A sprint that ends on
// 2027-01-15 is labeled CY27-*; one ending on 2026-12-22 stays CY26-*. Migration
// back-fills the prefix on legacy datasets, preserving the S-number and
// rewriting any skill_splits references so per-project history keeps pointing at
// the right sprint.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMember, makeProject, makeSprint } from '../harness/fixtures.mjs';

describe('Sprint label helpers', () => {
  it('Sprint.shortLabel strips any CYxx- prefix', async () => {
    const app = await loadApp();
    expect(app.Sprint.shortLabel('CY26-S4')).toBe('S4');
    expect(app.Sprint.shortLabel('CY27-S1')).toBe('S1');
    expect(app.Sprint.shortLabel('CY30-S12')).toBe('S12');
    expect(app.Sprint.shortLabel('')).toBe('');
    expect(app.Sprint.shortLabel(null)).toBe('');
    app.teardown();
  });

  it('Sprint.yearPrefixFromDate uses the calendar year of the date', async () => {
    const app = await loadApp();
    expect(app.Sprint.yearPrefixFromDate('2026-12-22')).toBe('CY26');
    expect(app.Sprint.yearPrefixFromDate('2027-01-05')).toBe('CY27');
    expect(app.Sprint.yearPrefixFromDate('2030-06-30')).toBe('CY30');
    app.teardown();
  });

  it('Sprint.nextSprintNumberInYear returns max existing S-number in that year + 1', async () => {
    const app = await loadApp();
    const sprints = [
      { sprint_id: 'CY26-S3', end_date: '2026-04-07' },
      { sprint_id: 'CY26-S4', end_date: '2026-05-12' },
      { sprint_id: 'CY27-S1', end_date: '2027-01-30' }
    ];
    expect(app.Sprint.nextSprintNumberInYear('CY26', sprints)).toBe(5);
    expect(app.Sprint.nextSprintNumberInYear('CY27', sprints)).toBe(2);
    expect(app.Sprint.nextSprintNumberInYear('CY28', sprints)).toBe(1);
    app.teardown();
  });
});

describe('Sprint label migration', () => {
  it('renames a sprint whose end_date year does not match its prefix and rewrites skill_splits references', async () => {
    const legacySprint = makeSprint({ sprint_id: 'CY26-S12', end_date: '2027-02-10', start_date: '2027-01-05', hardening_start: '2027-02-02' });
    const project = makeProject({ id: 'Acme Industries-MIG', size_engineering: 5 });
    project.skill_splits = {
      size_engineering: [{ sprint: 'CY26-S12', points: 5, status: 'pending' }]
    };
    const app = await loadApp(makeDataset({
      sprints: [legacySprint],
      projects: [project],
      team_members: [makeMember({ available_points_per_sprint: 10 })]
    }));
    const s = app.App.data.sprints[0];
    expect(s.sprint_id).toBe('CY27-S12');
    // end_date may be recomputed by the capacity back-fill; what matters is the migration
    // looked at the ORIGINAL end_date (2027-02-10) and picked CY27.
    expect(new Date(s.end_date).getFullYear()).toBe(2027);
    const p = app.App.data.projects.find(x => x.id === 'Acme Industries-MIG');
    expect(p.skill_splits.size_engineering[0].sprint).toBe('CY27-S12');
    expect(app.App.data.meta.sprintLabelMigration).toBe('v1');
    app.teardown();
  });

  it('is idempotent — the migration flag prevents re-running on a second load', async () => {
    const already = makeSprint({ sprint_id: 'CY27-S3', end_date: '2027-03-10', start_date: '2027-02-01', hardening_start: '2027-03-01' });
    const app = await loadApp(makeDataset({
      sprints: [already],
      team_members: [makeMember()]
    }));
    expect(app.App.data.sprints[0].sprint_id).toBe('CY27-S3');
    // Run migrate again manually — must be a no-op.
    app.App.migrateSchema(app.App.data);
    expect(app.App.data.sprints[0].sprint_id).toBe('CY27-S3');
    app.teardown();
  });
});
