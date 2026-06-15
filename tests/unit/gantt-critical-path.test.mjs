// Gantt critical-path overlay — exposes the (previously dormant) highlight and
// aligns it to the solver's persisted critical path (Phase 2.2), with a live
// zero-slack fallback. Render-layer tests via the jsdom harness.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember } from '../harness/fixtures.mjs';

const P = (over) => makeProject(Object.assign({ customer: 'Acme Industries', start_date: '2026-01-05', target_date: '2026-04-01' }, over));

async function boot(projects, extra = {}) {
  const app = await loadApp(makeDataset(Object.assign({
    projects, sprints: makeSprintSequence(3), team_members: [makeMember()],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }]
  }, extra)));
  app.App.activeCustomer = 'Acme Industries';
  app.App.navigate('roadmap');
  return app;
}
const barClasses = (app, id) => {
  const bar = app.document.querySelector('.gantt-bar[data-id="' + id + '"]');
  return bar ? bar.className : null;
};

describe('toggle + live fallback', () => {
  it('off by default → no critical/faded classes; toggling on highlights the live chain and fades the rest', async () => {
    // A blocks B (blocked_by), C independent.
    const app = await boot([
      P({ id: 'A', name: 'Alpha' }),
      P({ id: 'B', name: 'Bravo', dependencies: [{ kind: 'project', type: 'blocked_by', target_id: 'A' }] }),
      P({ id: 'C', name: 'Charlie' })
    ]);
    app.Gantt.render();
    expect(barClasses(app, 'A')).not.toMatch(/gantt-bar-critical|gantt-bar-faded/);

    app.Gantt.toggleCriticalPath(true);
    expect(app.Gantt.showCriticalPath).toBe(true);
    // A→B is the chain; C is off it.
    expect(barClasses(app, 'A')).toMatch(/gantt-bar-critical/);
    expect(barClasses(app, 'B')).toMatch(/gantt-bar-critical/);
    expect(barClasses(app, 'C')).toMatch(/gantt-bar-faded/);
    // Legend gains the entry while on.
    app.Gantt.renderLegend();
    expect(app.document.getElementById('ganttLegend').textContent).toContain('Critical path');
    app.teardown();
  });

  it('toggling off clears the highlight', async () => {
    const app = await boot([P({ id: 'A', name: 'Alpha' }), P({ id: 'B', name: 'Bravo', dependencies: [{ kind: 'project', type: 'blocked_by', target_id: 'A' }] })]);
    app.Gantt.toggleCriticalPath(true);
    app.Gantt.toggleCriticalPath(false);
    expect(barClasses(app, 'A')).not.toMatch(/gantt-bar-critical|gantt-bar-faded/);
    app.teardown();
  });
});

describe('prefers the solver-persisted critical path', () => {
  it('uses settings.solverRuns[customer].criticalPath when present', async () => {
    // No dependency edges → the live calc would find nothing; the persisted
    // solver chain must still drive the overlay.
    const app = await boot([P({ id: 'A', name: 'Alpha' }), P({ id: 'B', name: 'Bravo' }), P({ id: 'C', name: 'Charlie' })], {
      settings: { solverRuns: { 'Acme Industries': { at: new Date().toISOString(), projectCount: 3, criticalPath: ['A', 'B'] } } }
    });
    app.Gantt.toggleCriticalPath(true);
    expect(barClasses(app, 'A')).toMatch(/gantt-bar-critical/);
    expect(barClasses(app, 'B')).toMatch(/gantt-bar-critical/);
    expect(barClasses(app, 'C')).toMatch(/gantt-bar-faded/);
    // _criticalIdsFor returns the persisted ids (scoped to on-screen projects).
    expect(app.Gantt._criticalIdsFor(app.App.data.projects).sort()).toEqual(['A', 'B']);
    app.teardown();
  });

  it('falls back to the live calc when the persisted path has no on-screen projects', async () => {
    const app = await boot([P({ id: 'A', name: 'Alpha' }), P({ id: 'B', name: 'Bravo', dependencies: [{ kind: 'project', type: 'blocked_by', target_id: 'A' }] })], {
      settings: { solverRuns: { 'Acme Industries': { at: new Date().toISOString(), projectCount: 0, criticalPath: ['GHOST-1', 'GHOST-2'] } } }
    });
    // Ghost ids aren't on screen → fall back to the live A→B chain.
    expect(app.Gantt._criticalIdsFor(app.App.data.projects)).toContain('A');
    app.teardown();
  });
});
