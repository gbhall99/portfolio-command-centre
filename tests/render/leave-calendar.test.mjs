import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeMember, makeDataset } from '../harness/fixtures.mjs';

describe('Leave calendar', () => {
  it('renders one row per member with their PTO bars', async () => {
    // Pick PTO dates close to "today" so they fall inside the 90-day window.
    const today = new Date();
    const start = new Date(today); start.setDate(start.getDate() + 14);
    const end = new Date(start); end.setDate(end.getDate() + 4);
    const fmt = d => d.toISOString().slice(0, 10);
    const tm = makeMember({ name: 'Alice', holidays: [{ start: fmt(start), end: fmt(end) }] });
    const app = await loadApp(makeDataset({ team_members: [tm] }));
    let host = app.window.document.getElementById('leaveCalendarPanel');
    if (!host) {
      host = app.window.document.createElement('div');
      host.id = 'leaveCalendarPanel';
      app.window.document.body.appendChild(host);
    }
    app.Capacity.renderLeaveCalendar('GCC');
    expect(host.innerHTML).toMatch(/Leave/);
    expect(host.innerHTML).toMatch(/Alice/);
    expect(host.innerHTML).toMatch(/leave-bar/);
    app.teardown();
  });
});
