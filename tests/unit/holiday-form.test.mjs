// WS-C: holidays apply by country/city only; customer scope removed from data + matcher.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMember, makeSprintSequence } from '../harness/fixtures.mjs';

function firstWeekdayInSprint(sprints) {
  const d = new Date(sprints[0].start_date);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('WS-C migration drops customers from holidays', () => {
  it('removes the customers field on load, keeps country', async () => {
    const app = await loadApp(makeDataset({
      annual_holidays: [{ name: 'X', date: '2026-12-25', recurring: true, country: 'UK', customers: ['Acme Industries'] }]
    }));
    const h = app.App.data.annual_holidays[0];
    expect('customers' in h).toBe(false);
    expect(h.country).toBe('UK');
    app.teardown();
  });
});

describe('WS-C matcher ignores any residual customer scope', () => {
  it('a holiday reduces capacity regardless of customerScope (no customer filtering)', async () => {
    const sprints = makeSprintSequence(1);
    const ymd = firstWeekdayInSprint(sprints);
    const app = await loadApp(makeDataset({
      team_members: [makeMember({ name: 'UK-A', country: 'UK', available_points_per_sprint: 20 })],
      sprints,
      annual_holidays: [{ name: 'UK Bank', date: ymd, recurring: false, country: 'UK', customers: ['Globex'] }]
    }));
    const cap = app.Sprint.calcMemberCapacityForSprint(app.App.data.team_members[0], sprints[0].sprint_id, 'Acme Industries');
    expect(cap.points).toBeLessThan(20);
    app.teardown();
  });

  it('an All-countries holiday (country:"") reduces capacity for any country', async () => {
    const sprints = makeSprintSequence(1);
    const ymd = firstWeekdayInSprint(sprints);
    const app = await loadApp(makeDataset({
      team_members: [makeMember({ name: 'US-A', country: 'US', available_points_per_sprint: 20 })],
      sprints,
      annual_holidays: [{ name: 'Global Day', date: ymd, recurring: false, country: '' }]
    }));
    const cap = app.Sprint.calcMemberCapacityForSprint(app.App.data.team_members[0], sprints[0].sprint_id, 'Acme Industries');
    expect(cap.points).toBeLessThan(20);
    app.teardown();
  });
});
