// Phase 8 — Readiness gate enforcement.
// AC-8.1: Walkthrough project list shows a "setup incomplete" chip on projects
//         where App.computeReadiness(p).steerco === false.
// AC-8.2: Weekly-review banner shows "N project(s) need setup" linking to the
//         unfit-for-steerco list.
// AC-8.3: Solver.solve flags + skips projects where computeReadiness(p).planning === false.
// AC-8.4: In-flight projects (status ∈ {In Progress, On Hold, At Risk, Blocked})
//         on the day the gate ships are auto-marked legacy_grandfathered = true
//         and NOT skipped retroactively.
// AC-8.5: Readiness chip popover opens on click; lists missing fields with
//         deep-links to the owning tab.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember } from '../harness/fixtures.mjs';

async function bootFull(extra = {}) {
  const app = await loadApp(makeDataset(Object.assign({
    projects: [],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }]
  }, extra)));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

describe('Phase 8 / AC-8.1 — Walkthrough list "setup incomplete" chip', () => {
  it('renders the chip on a project that is not steerco-ready', async () => {
    const incompleteProj = makeProject({
      id: 'PI', name: 'Incomplete', customer: 'Acme Industries',
      status: 'Not Started', // avoid auto-grandfathering at load time
      // Steerco requires sponsor + governance_forum + outcome + RAG triplet —
      // omit some so steerco === false.
      sponsor: '', governance_forum: '', benefits: [], success_criteria: []
    });
    const app = await loadApp(makeDataset({
      projects: [incompleteProj],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Walkthrough.open('Acme Industries');
    const item = app.document.querySelector('[data-wt-list-pid="PI"] [data-setup-incomplete]');
    expect(item).toBeTruthy();
    app.teardown();
  });

  it('does NOT render the chip when the project is legacy_grandfathered (AC-8.4)', async () => {
    const grandfathered = makeProject({
      id: 'PG', name: 'Grandfathered', customer: 'Acme Industries',
      sponsor: '', governance_forum: '', benefits: [], success_criteria: [],
      legacy_grandfathered: true
    });
    const app = await loadApp(makeDataset({
      projects: [grandfathered],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Walkthrough.open('Acme Industries');
    const item = app.document.querySelector('[data-wt-list-pid="PG"] [data-setup-incomplete]');
    expect(item).toBeFalsy();
    app.teardown();
  });
});

describe('Phase 8 / AC-8.2 — Weekly-review setup-gap banner', () => {
  it('weeklyReviewSetupGapCount counts projects where steerco === false', async () => {
    const ok = makeProject({
      id: 'OK', name: 'Steerco-ready', customer: 'Acme Industries',
      status: 'Not Started',
      moscow: 'Must', lifecycle_stage: 'Implementation',
      size_engineering: 10, size_total: 10, target_date: '2026-12-31', manager: 'A',
      sponsor: 'S', governance_forum: 'G',
      benefits: [{ description: 'X' }],
      rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green'
    });
    const gap = makeProject({
      id: 'GAP', name: 'No sponsor', customer: 'Acme Industries',
      status: 'Not Started',
      moscow: 'Must', lifecycle_stage: 'Implementation',
      size_engineering: 10, size_total: 10, target_date: '2026-12-31', manager: 'A',
      sponsor: '', governance_forum: '', benefits: [],
      rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green'
    });
    const app = await loadApp(makeDataset({
      projects: [ok, gap],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.App.weeklyReviewSetupGapCount('Acme Industries')).toBe(1);
    app.teardown();
  });

  it('renderWeeklyReviewBanner returns "N project(s) need setup" markup with a count attr', async () => {
    const gap = makeProject({
      id: 'GAP', name: 'No sponsor', customer: 'Acme Industries',
      status: 'Not Started',
      sponsor: '', governance_forum: ''
    });
    const app = await loadApp(makeDataset({
      projects: [gap],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    const html = app.App.renderWeeklyReviewBanner('Acme Industries');
    expect(html).toMatch(/dp-weekly-review-banner/);
    expect(html).toMatch(/data-setup-gap-count="1"/);
    expect(html).toMatch(/need setup/);
    app.teardown();
  });

  it('renderWeeklyReviewBanner returns empty string when zero gaps', async () => {
    const ok = makeProject({
      id: 'OK', name: 'P', customer: 'Acme Industries',
      moscow: 'Must', lifecycle_stage: 'Implementation',
      size_engineering: 10, size_total: 10, target_date: '2026-12-31', manager: 'A',
      sponsor: 'S', governance_forum: 'G',
      benefits: [{ description: 'X' }],
      rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green'
    });
    const app = await loadApp(makeDataset({
      projects: [ok],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.App.renderWeeklyReviewBanner('Acme Industries')).toBe('');
    app.teardown();
  });
});

describe('Phase 8 / AC-8.3 + AC-8.4 — Solver readiness gate + grandfathering', () => {
  it('Solver.solve emits a "readiness_gate" warning for projects that are not planning-ready', async () => {
    const unplanned = makeProject({
      id: 'NP', name: 'Unplanned', customer: 'Acme Industries',
      status: 'Not Started',
      // Missing target_date + manager → planning === false
      moscow: 'Must', lifecycle_stage: 'Implementation',
      size_engineering: 10, size_total: 10
    });
    const app = await loadApp(makeDataset({
      projects: [unplanned],
      sprints: makeSprintSequence(2),
      team_members: [makeMember()],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    const result = app.Solver.solve('Acme Industries', { startFromSprint: 'CY26-S1' }, app.App.data, app.Sprint);
    const readinessWarnings = (result.warnings || []).filter(w => w.type === 'readiness_gate');
    expect(readinessWarnings.length).toBe(1);
    expect(readinessWarnings[0].project).toBeTruthy();
    expect(readinessWarnings[0].project.id).toBe('NP');
    // The project is excluded from allocations.
    expect(result.allocations.NP).toBeUndefined();
    app.teardown();
  });

  it('AC-8.4: grandfathered projects (legacy_grandfathered = true) are NOT skipped retroactively', async () => {
    const grandfathered = makeProject({
      id: 'GR', name: 'Grandfathered',
      customer: 'Acme Industries',
      status: 'In Progress',
      // Missing target_date so planning would otherwise fail, but flag is set:
      legacy_grandfathered: true,
      moscow: 'Must', lifecycle_stage: 'Implementation',
      size_engineering: 5, size_total: 5
    });
    const app = await loadApp(makeDataset({
      projects: [grandfathered],
      sprints: makeSprintSequence(2),
      team_members: [makeMember()],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    const result = app.Solver.solve('Acme Industries', { startFromSprint: 'CY26-S1' }, app.App.data, app.Sprint);
    const readinessSkips = (result.warnings || []).filter(w => w.type === 'readiness_gate');
    expect(readinessSkips.length).toBe(0);
    app.teardown();
  });

  it('applyReadinessGrandfathering marks in-flight projects (one-time, idempotent)', async () => {
    // Load with all Not-Started so the auto-run on validateAndLoad doesn't pre-grandfather them.
    const live = makeProject({ id: 'L', status: 'Not Started', customer: 'Acme Industries' });
    const blocked = makeProject({ id: 'B', status: 'Not Started', customer: 'Acme Industries' });
    const notStarted = makeProject({ id: 'NS', status: 'Not Started', customer: 'Acme Industries' });
    const app = await loadApp(makeDataset({
      projects: [live, blocked, notStarted],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    // Flip the statuses to in-flight AFTER load so the explicit run is the one observed.
    app.App.data.projects.find(p => p.id === 'L').status = 'In Progress';
    app.App.data.projects.find(p => p.id === 'B').status = 'Blocked';
    const firstRun = app.App.applyReadinessGrandfathering();
    expect(firstRun.marked).toBe(2);
    expect(app.App.data.projects.find(p => p.id === 'L').legacy_grandfathered).toBe(true);
    expect(app.App.data.projects.find(p => p.id === 'B').legacy_grandfathered).toBe(true);
    expect(app.App.data.projects.find(p => p.id === 'NS').legacy_grandfathered).toBeUndefined();
    // Second run: idempotent.
    const secondRun = app.App.applyReadinessGrandfathering();
    expect(secondRun.marked).toBe(0);
    app.teardown();
  });

  it('settings.enforceReadinessGate=false disables the skip', async () => {
    const unplanned = makeProject({
      id: 'NP2', name: 'Unplanned', customer: 'Acme Industries', status: 'Not Started',
      moscow: 'Must', lifecycle_stage: 'Implementation', size_engineering: 5, size_total: 5
    });
    const app = await loadApp(makeDataset({
      projects: [unplanned],
      sprints: makeSprintSequence(2),
      team_members: [makeMember()],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    const result = app.Solver.solve('Acme Industries', { startFromSprint: 'CY26-S1', enforceReadinessGate: false }, app.App.data, app.Sprint);
    const readinessSkips = (result.warnings || []).filter(w => w.type === 'readiness_gate');
    expect(readinessSkips.length).toBe(0);
    app.teardown();
  });
});

describe('Phase 8 / AC-8.5 — Readiness chip popover with deep-links', () => {
  it('clicking the readiness chip opens a popover that lists missing fields as deep-links', async () => {
    const gap = makeProject({
      id: 'POP', name: 'Pop', customer: 'Acme Industries',
      sponsor: '', governance_forum: '',
      moscow: 'Must', lifecycle_stage: 'Implementation',
      size_engineering: 5, size_total: 5, target_date: '2026-12-31', manager: 'A',
      benefits: [{ description: 'X' }],
      rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green'
    });
    const app = await loadApp(makeDataset({
      projects: [gap],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.open('POP');
    const chip = app.document.querySelector('.dp-readiness-chip');
    expect(chip).toBeTruthy();
    chip.click();
    const popover = app.document.querySelector('#dpReadinessPopover');
    expect(popover).toBeTruthy();
    // Sponsor missing → deep-link visible
    const sponsorLink = popover.querySelector('[data-readiness-field="sponsor"]');
    expect(sponsorLink).toBeTruthy();
    expect(sponsorLink.dataset.readinessTab).toBe('scope');
    app.teardown();
  });

  it('clicking a missing-field link switches Detail panel to the owning tab', async () => {
    const gap = makeProject({
      id: 'POP2', name: 'P', customer: 'Acme Industries',
      // Missing manager → planning_missing includes 'manager' → tab=delivery
      moscow: 'Must', lifecycle_stage: 'Implementation',
      size_engineering: 5, size_total: 5, target_date: '2026-12-31'
    });
    const app = await loadApp(makeDataset({
      projects: [gap],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.open('POP2');
    app.DetailPanel._openReadinessPopover('POP2');
    app.DetailPanel._jumpToReadinessField('POP2', 'manager');
    expect(app.DetailPanel.activeTab).toBe('delivery');
    // Popover closed.
    expect(app.document.querySelector('#dpReadinessPopover')).toBeFalsy();
    app.teardown();
  });

  it('clicking the chip a second time closes the popover (toggle)', async () => {
    const gap = makeProject({
      id: 'POP3', name: 'P', customer: 'Acme Industries', sponsor: ''
    });
    const app = await loadApp(makeDataset({
      projects: [gap],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.open('POP3');
    const chip = app.document.querySelector('.dp-readiness-chip');
    chip.click();
    expect(app.document.querySelector('#dpReadinessPopover')).toBeTruthy();
    chip.click();
    expect(app.document.querySelector('#dpReadinessPopover')).toBeFalsy();
    app.teardown();
  });
});
