import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

// The card-based overlay was replaced by the three-column shell (Walkthrough
// module). The previous card-DOM tests were left skipped and never rewritten —
// so the current rendering had NO coverage (L18 gap). These pin the live shell.
describe('Walkthrough — three-column shell', () => {
  it('renders the shell, top bar (title + cohort pills + progress) and project list', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'Walkthrough Subject', status: 'Blocked', rag_schedule: 'Red', size_engineering: 10,
      skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 2, assigned_to: [], reasons: [] }] }
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Sprint.openWalkthrough();
    const overlay = app.window.document.getElementById('walkthroughOverlay');
    expect(overlay).not.toBeNull();
    // Three-column shell structure.
    expect(overlay.querySelector('.wt-shell')).not.toBeNull();
    expect(overlay.querySelector('[data-wt-list]')).not.toBeNull();
    expect(overlay.querySelector('[data-wt-center]')).not.toBeNull();
    expect(overlay.querySelector('[data-wt-cust]')).not.toBeNull();
    // Top bar: title names the active customer, cohort pills + a progress label.
    const top = overlay.querySelector('[data-wt-top]');
    expect(top.querySelector('.wt-top-ttl').textContent).toContain('Acme Industries');
    expect(top.querySelectorAll('.wt-pill').length).toBe(3);          // critical / watch / steady
    expect(top.textContent).toMatch(/0 \/ 1 reviewed/);                // nothing reviewed yet
    expect(top.textContent).toContain('Mark Done');
    // The project surfaces in the list column.
    expect(overlay.querySelector('[data-wt-list]').textContent).toContain('Walkthrough Subject');
    app.teardown();
  });

  it('reflects reviewed progress in the top bar after marking a project reviewed', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ name: 'P', status: 'Blocked', rag_schedule: 'Red' })], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Sprint.openWalkthrough();
    const wt = app.App.data.walkthroughs[0];
    const pid = app.App.data.projects[0].id;
    app.App.setWalkthroughSectionStatus(wt.id, 'proj:' + pid, 'reviewed');
    app.Sprint.openWalkthrough(); // re-render
    const top = app.window.document.querySelector('[data-wt-top]');
    expect(top.textContent).toMatch(/1 \/ 1 reviewed/);
    app.teardown();
  });

  it('starts (or resumes) a walkthrough on open and reuses on subsequent opens', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ name: 'P' })] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Sprint.openWalkthrough();
    const len1 = app.App.data.walkthroughs.length;
    app.window.document.getElementById('walkthroughOverlay').remove();
    app.Sprint.openWalkthrough();
    expect(app.App.data.walkthroughs.length).toBe(len1);
    app.teardown();
  });
});
