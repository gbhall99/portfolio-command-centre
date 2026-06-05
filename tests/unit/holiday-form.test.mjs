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

describe('WS-C holiday add/edit modal form', () => {
  function bootForm() {
    return loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1' }],
      annual_holidays: [{ name: 'Existing', date: '2026-01-01', recurring: true, country: 'India', sub_location: 'Bangalore' }]
    }));
  }

  it('openHolidayForm() builds a blank add form defaulting to All/All', async () => {
    const app = await bootForm();
    app.App.openHolidayForm();
    expect(app.document.getElementById('holidayFormName')).toBeTruthy();
    expect(app.document.getElementById('holidayFormDate').type).toBe('date');
    expect(app.document.getElementById('holidayFormCountry').value).toBe('');
    expect(app.document.getElementById('holidayFormCity').value).toBe('');
    app.App.closeHolidayForm();
    app.teardown();
  });

  it('saveHolidayForm() appends a holiday with All=empty for country/city', async () => {
    const app = await bootForm();
    app.App.openHolidayForm();
    app.document.getElementById('holidayFormName').value = 'New Year';
    app.document.getElementById('holidayFormDate').value = '2027-01-01';
    app.document.getElementById('holidayFormRecurring').checked = true;
    app.App.saveHolidayForm();
    const hols = app.App.data.annual_holidays;
    const added = hols[hols.length - 1];
    expect(added).toMatchObject({ name: 'New Year', date: '2027-01-01', recurring: true, country: '', sub_location: '' });
    expect('customers' in added).toBe(false);
    app.teardown();
  });

  it('openHolidayForm(index) pre-fills and save updates that index', async () => {
    const app = await bootForm();
    app.App.openHolidayForm(0);
    expect(app.document.getElementById('holidayFormName').value).toBe('Existing');
    expect(app.document.getElementById('holidayFormCountry').value).toBe('India');
    expect(app.document.getElementById('holidayFormCity').value).toBe('Bangalore');
    app.document.getElementById('holidayFormName').value = 'Renamed';
    app.App.saveHolidayForm();
    expect(app.App.data.annual_holidays[0].name).toBe('Renamed');
    expect(app.App.data.annual_holidays.length).toBe(1);
    app.teardown();
  });

  it('_holidayFormCountryChanged() rebuilds city options for the chosen country', async () => {
    const app = await bootForm();
    app.App.openHolidayForm();
    const countrySel = app.document.getElementById('holidayFormCountry');
    countrySel.value = 'India';
    app.App._holidayFormCountryChanged();
    const cityOpts = Array.from(app.document.getElementById('holidayFormCity').options).map(o => o.value);
    expect(cityOpts).toEqual(['', 'Hyderabad', 'Bangalore']);
    app.App.closeHolidayForm();
    app.teardown();
  });

  it('saveHolidayForm() rejects an empty name (no append)', async () => {
    const app = await bootForm();
    const before = app.App.data.annual_holidays.length;
    app.App.openHolidayForm();
    app.document.getElementById('holidayFormName').value = '';
    app.document.getElementById('holidayFormDate').value = '2027-05-01';
    app.App.saveHolidayForm();
    expect(app.App.data.annual_holidays.length).toBe(before);
    app.App.closeHolidayForm();
    app.teardown();
  });

  it('saveHolidayForm() rejects an empty/invalid date (no append, no undo)', async () => {
    const app = await loadApp(makeDataset({ annual_holidays: [] }));
    app.App.openHolidayForm();
    app.document.getElementById('holidayFormName').value = 'No Date';
    app.document.getElementById('holidayFormDate').value = ''; // cleared native date input
    app.App.saveHolidayForm();
    expect(app.App.data.annual_holidays.length).toBe(0); // not appended
    // modal stays open (save did not close it on validation failure)
    expect(app.document.getElementById('holidayFormOverlay')).toBeTruthy();
    app.App.closeHolidayForm();
    app.teardown();
  });

  it('opening the form twice does not leave two overlays', async () => {
    const app = await loadApp(makeDataset({ annual_holidays: [] }));
    app.App.openHolidayForm();
    app.App.openHolidayForm();
    expect(app.document.querySelectorAll('#holidayFormOverlay').length).toBe(1);
    app.App.closeHolidayForm();
    app.teardown();
  });
});
