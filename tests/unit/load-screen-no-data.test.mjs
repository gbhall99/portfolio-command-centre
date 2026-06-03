// With no data loaded, navigation must not activate any view; the load screen owns the
// screen. After data loads, the no-data state clears and views can activate.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('no-data load screen', () => {
  it('navigate() does not activate a view while App.data is null', async () => {
    // Boot without data (file-loader state) so no view is ever activated.
    const app = await loadApp(null);
    // App.data is null; init() will have added no-data class.
    expect(app.App.data).toBeNull();
    expect(app.document.body.classList.contains('no-data')).toBe(true);
    // Confirm all views are inactive before the navigate call.
    app.document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    app.App.navigate('dashboard');
    const active = app.document.querySelectorAll('.view.active');
    expect(active.length).toBe(0);
    expect(app.document.body.classList.contains('no-data')).toBe(true);
    app.teardown();
  });

  it('after data + onDataLoaded, the no-data class is cleared and a view can activate', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    expect(app.document.body.classList.contains('no-data')).toBe(false);
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('dashboard');
    expect(app.document.querySelectorAll('.view.active').length).toBeGreaterThan(0);
    app.teardown();
  });
});
