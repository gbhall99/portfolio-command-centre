// Slot F — Item 14: country-scoped holidays + member country/sub_location.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMember, makeSprintSequence } from '../harness/fixtures.mjs';

describe('Slot F — Item 14: LOCATIONS constant', () => {
  it('LOCATIONS contains exactly the 6 locked countries in order with India sub-locations', async () => {
    const app = await loadApp(makeDataset({}));
    expect(app.App.LOCATIONS.map(l => l.country)).toEqual(['UK', 'US', 'India', 'Netherlands', 'Canada', 'Malaysia']);
    const india = app.App.LOCATIONS.find(l => l.country === 'India');
    expect(india.sub_locations).toEqual(['Hyderabad', 'Bangalore']);
    // Other countries have no sub-locations.
    app.App.LOCATIONS.filter(l => l.country !== 'India').forEach(l => {
      expect(l.sub_locations).toEqual([]);
    });
    app.teardown();
  });

  it('App._subLocationsForCountry returns the sub-list (or [] for non-India)', async () => {
    const app = await loadApp(makeDataset({}));
    expect(app.App._subLocationsForCountry('India')).toEqual(['Hyderabad', 'Bangalore']);
    expect(app.App._subLocationsForCountry('UK')).toEqual([]);
    expect(app.App._subLocationsForCountry('Unknown')).toEqual([]);
    app.teardown();
  });
});

describe('Slot F — schema migration defaults country=UK on legacy data', () => {
  it('legacy team_members + annual_holidays get country=UK on load', async () => {
    const app = await loadApp(makeDataset({
      team_members: [{ name: 'Alice', customer: 'Acme', primary_skills: ['Data Engineering'], available_points_per_sprint: 20 }],
      annual_holidays: [{ name: 'Boxing Day', date: '2026-12-26', recurring: true, customers: [] }]
    }));
    expect(app.App.data.team_members[0].country).toBe('UK');
    expect(app.App.data.annual_holidays[0].country).toBe('UK');
    app.teardown();
  });
});

describe('Slot F — App.setMemberCountry', () => {
  it('writes country + sub_location when valid', async () => {
    const app = await loadApp(makeDataset({
      team_members: [makeMember({ name: 'Hyd-Alice' })]
    }));
    const result = app.App.setMemberCountry('Hyd-Alice', 'India', 'Hyderabad');
    expect(result).toEqual({ country: 'India', sub_location: 'Hyderabad' });
    expect(app.App.data.team_members[0].country).toBe('India');
    expect(app.App.data.team_members[0].sub_location).toBe('Hyderabad');
    app.teardown();
  });

  it('rejects an invalid country (returns null; no mutation)', async () => {
    const app = await loadApp(makeDataset({
      team_members: [makeMember({ name: 'X' })]
    }));
    const result = app.App.setMemberCountry('X', 'Mars', '');
    expect(result).toBe(null);
    expect(app.App.data.team_members[0].country).toBe('UK'); // migration default
    app.teardown();
  });

  it('clears sub_location when set on a country that has no sub-locations', async () => {
    const app = await loadApp(makeDataset({
      team_members: [makeMember({ name: 'Y' })]
    }));
    app.App.setMemberCountry('Y', 'UK', 'Hyderabad'); // sub-location invalid for UK
    expect(app.App.data.team_members[0].sub_location).toBe('');
    app.teardown();
  });
});

describe('Slot F — Capacity calc respects country/sub_location filtering', () => {
  it('a UK holiday does NOT reduce capacity for a US team member', async () => {
    const sprints = makeSprintSequence(1);
    const sprintMid = new Date(new Date(sprints[0].start_date).getTime() + 86400000 * 3);
    const ymd = sprintMid.toISOString().slice(0, 10);
    const usMember = makeMember({ name: 'US-Alice', country: 'US', available_points_per_sprint: 20 });
    const app = await loadApp(makeDataset({
      team_members: [usMember],
      sprints,
      annual_holidays: [{ name: 'UK Test', date: ymd, recurring: false, country: 'UK', customers: [] }]
    }));
    const cap = app.Sprint.calcMemberCapacityForSprint(app.App.data.team_members[0], sprints[0].sprint_id, 'Acme Industries');
    expect(cap.points).toBe(20);
    app.teardown();
  });

  it('a UK holiday DOES reduce capacity for a UK team member', async () => {
    const sprints = makeSprintSequence(1);
    const startWd = new Date(sprints[0].start_date);
    // Find first weekday in the sprint window for the holiday.
    while (startWd.getDay() === 0 || startWd.getDay() === 6) startWd.setDate(startWd.getDate() + 1);
    const ymd = startWd.toISOString().slice(0, 10);
    const ukMember = makeMember({ name: 'UK-Alice', country: 'UK', available_points_per_sprint: 20 });
    const app = await loadApp(makeDataset({
      team_members: [ukMember],
      sprints,
      annual_holidays: [{ name: 'UK Bank', date: ymd, recurring: false, country: 'UK', customers: [] }]
    }));
    const cap = app.Sprint.calcMemberCapacityForSprint(app.App.data.team_members[0], sprints[0].sprint_id, 'Acme Industries');
    expect(cap.points).toBeLessThan(20);
    app.teardown();
  });

  it('an India / Bangalore holiday only hits Bangalore members; Hyderabad members untouched', async () => {
    const sprints = makeSprintSequence(1);
    const sprintMid = new Date(new Date(sprints[0].start_date).getTime() + 86400000 * 3);
    while (sprintMid.getDay() === 0 || sprintMid.getDay() === 6) sprintMid.setDate(sprintMid.getDate() + 1);
    const ymd = sprintMid.toISOString().slice(0, 10);
    const bgMember  = makeMember({ name: 'BG', country: 'India', sub_location: 'Bangalore',  available_points_per_sprint: 20 });
    const hydMember = makeMember({ name: 'HY', country: 'India', sub_location: 'Hyderabad',  available_points_per_sprint: 20 });
    const app = await loadApp(makeDataset({
      team_members: [bgMember, hydMember],
      sprints,
      annual_holidays: [{ name: 'BG Festival', date: ymd, recurring: false, country: 'India', sub_location: 'Bangalore', customers: [] }]
    }));
    const bgCap  = app.Sprint.calcMemberCapacityForSprint(app.App.data.team_members[0], sprints[0].sprint_id, 'Acme Industries');
    const hydCap = app.Sprint.calcMemberCapacityForSprint(app.App.data.team_members[1], sprints[0].sprint_id, 'Acme Industries');
    expect(bgCap.points).toBeLessThan(20);
    expect(hydCap.points).toBe(20);
    app.teardown();
  });

  it('a country-only India holiday (no sub_location) hits BOTH Hyderabad and Bangalore members', async () => {
    const sprints = makeSprintSequence(1);
    const sprintMid = new Date(new Date(sprints[0].start_date).getTime() + 86400000 * 3);
    while (sprintMid.getDay() === 0 || sprintMid.getDay() === 6) sprintMid.setDate(sprintMid.getDate() + 1);
    const ymd = sprintMid.toISOString().slice(0, 10);
    const bgMember  = makeMember({ name: 'BG2', country: 'India', sub_location: 'Bangalore',  available_points_per_sprint: 20 });
    const hydMember = makeMember({ name: 'HY2', country: 'India', sub_location: 'Hyderabad',  available_points_per_sprint: 20 });
    const app = await loadApp(makeDataset({
      team_members: [bgMember, hydMember],
      sprints,
      annual_holidays: [{ name: 'Republic Day', date: ymd, recurring: false, country: 'India', sub_location: '', customers: [] }]
    }));
    const bgCap  = app.Sprint.calcMemberCapacityForSprint(app.App.data.team_members[0], sprints[0].sprint_id, 'Acme Industries');
    const hydCap = app.Sprint.calcMemberCapacityForSprint(app.App.data.team_members[1], sprints[0].sprint_id, 'Acme Industries');
    expect(bgCap.points).toBeLessThan(20);
    expect(hydCap.points).toBeLessThan(20);
    app.teardown();
  });

  it('a legacy holiday with no country still applies globally (back-compat)', async () => {
    // Migration sets country='UK' on legacy holidays. Verify a member without
    // country (legacy = UK after migration) still sees the holiday.
    const sprints = makeSprintSequence(1);
    const sprintMid = new Date(new Date(sprints[0].start_date).getTime() + 86400000 * 3);
    while (sprintMid.getDay() === 0 || sprintMid.getDay() === 6) sprintMid.setDate(sprintMid.getDate() + 1);
    const ymd = sprintMid.toISOString().slice(0, 10);
    const app = await loadApp(makeDataset({
      team_members: [makeMember({ name: 'Legacy', available_points_per_sprint: 20 })], // no country field
      sprints,
      annual_holidays: [{ name: 'Legacy Hol', date: ymd, recurring: false, customers: [] }] // no country field
    }));
    // Both default to UK via migration; capacity drops.
    const cap = app.Sprint.calcMemberCapacityForSprint(app.App.data.team_members[0], sprints[0].sprint_id, 'Acme Industries');
    expect(cap.points).toBeLessThan(20);
    app.teardown();
  });
});
