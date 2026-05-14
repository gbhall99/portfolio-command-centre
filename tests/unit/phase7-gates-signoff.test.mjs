// Phase 7 — Gate reviews + Sponsor sign-off log.
// AC-7.1: project.gate_reviews[] accepts {gate_name, planned_date, actual_date?,
//         decision, sign_off_by?, evidence_link?}; gate-name picker offers
//         exactly 6 values: Discovery / Design / Build / UAT / Live / Hypercare.
// AC-7.2: Overview "Last gate / Next gate" chip rolls up from gate_reviews[]
//         (last = max(actual_date where decision !== null);
//          next = min(planned_date where actual_date is null)).
// AC-7.3: Sponsor sign-off log row accepts {date, scope_version, sponsor,
//         status, evidence_link?} and round-trips through JSON serialisation.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function bootWithProject(extra = {}) {
  const p = makeProject(Object.assign({ id: 'P7', name: 'P', customer: 'Acme Industries' }, extra));
  const app = await loadApp(makeDataset({
    projects: [p],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return { app, p };
}

describe('Phase 7 / AC-7.1 — gate_reviews schema + picker', () => {
  it('GATE_NAMES is exactly the locked 6 values in order: Discovery / Design / Build / UAT / Live / Hypercare', async () => {
    const { app } = await bootWithProject();
    expect(app.DetailPanel.GATE_NAMES).toEqual(['Discovery', 'Design', 'Build', 'UAT', 'Live', 'Hypercare']);
    app.teardown();
  });

  it('addGateReview accepts a valid entry and appends to project.gate_reviews[]', async () => {
    const { app } = await bootWithProject();
    const row = app.DetailPanel.addGateReview('P7', {
      gate_name: 'Design',
      planned_date: '2026-03-01',
      decision: 'Go',
      sign_off_by: 'Ada Lovelace',
      evidence_link: 'https://wiki.example.com/gate/design'
    });
    expect(row).toBeTruthy();
    expect(row.id).toMatch(/^gate-/);
    expect(app.App.data.projects[0].gate_reviews).toHaveLength(1);
    const stored = app.App.data.projects[0].gate_reviews[0];
    expect(stored.gate_name).toBe('Design');
    expect(stored.planned_date).toBe('2026-03-01');
    expect(stored.decision).toBe('Go');
    expect(stored.sign_off_by).toBe('Ada Lovelace');
    expect(stored.evidence_link).toBe('https://wiki.example.com/gate/design');
    app.teardown();
  });

  it('addGateReview rejects invalid gate_name values', async () => {
    const { app } = await bootWithProject();
    const row = app.DetailPanel.addGateReview('P7', { gate_name: 'NotARealGate' });
    expect(row).toBe(null);
    expect((app.App.data.projects[0].gate_reviews || []).length).toBe(0);
    app.teardown();
  });

  it('renderGateReviews picker offers exactly 6 options', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.addGateReview('P7', { gate_name: 'Discovery', planned_date: '2026-02-01' });
    app.DetailPanel.open('P7');
    const scope = app.document.querySelector('[data-dp-tab="scope"]');
    expect(scope).toBeTruthy();
    const picker = scope.querySelector('.dp-gate-name-select');
    expect(picker).toBeTruthy();
    const options = Array.from(picker.options).map(o => o.value);
    expect(options).toEqual(['Discovery', 'Design', 'Build', 'UAT', 'Live', 'Hypercare']);
    app.teardown();
  });
});

describe('Phase 7 / AC-7.2 — Last gate / Next gate rollup chip', () => {
  it('returns null/null when no gate reviews exist', async () => {
    const { app } = await bootWithProject();
    expect(app.DetailPanel.computeGateRollup(app.App.data.projects[0])).toEqual({ last: null, next: null });
    app.teardown();
  });

  it('picks max(actual_date) for `last` and min(planned_date with null actual) for `next`', async () => {
    const { app } = await bootWithProject();
    const projectId = 'P7';
    app.DetailPanel.addGateReview(projectId, { gate_name: 'Discovery', planned_date: '2026-01-10', actual_date: '2026-01-12', decision: 'Go' });
    app.DetailPanel.addGateReview(projectId, { gate_name: 'Design', planned_date: '2026-02-15', actual_date: '2026-02-20', decision: 'Conditional' });
    app.DetailPanel.addGateReview(projectId, { gate_name: 'Build', planned_date: '2026-04-01', actual_date: null });
    app.DetailPanel.addGateReview(projectId, { gate_name: 'UAT', planned_date: '2026-05-15', actual_date: null });
    const rollup = app.DetailPanel.computeGateRollup(app.App.data.projects[0]);
    expect(rollup.last).toBeTruthy();
    expect(rollup.last.gate_name).toBe('Design'); // 2026-02-20 > 2026-01-12
    expect(rollup.next).toBeTruthy();
    expect(rollup.next.gate_name).toBe('Build'); // 2026-04-01 < 2026-05-15
    app.teardown();
  });

  it('Overview chip displays the rollup values', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.addGateReview('P7', { gate_name: 'Discovery', planned_date: '2026-01-10', actual_date: '2026-01-12', decision: 'Go' });
    app.DetailPanel.addGateReview('P7', { gate_name: 'Build', planned_date: '2026-04-01', actual_date: null });
    app.DetailPanel.open('P7');
    const overview = app.document.querySelector('[data-dp-tab="overview"]');
    const last = overview.querySelector('.dp-gate-chip-last');
    const next = overview.querySelector('.dp-gate-chip-next');
    expect(last).toBeTruthy();
    expect(next).toBeTruthy();
    expect(last.textContent).toMatch(/Discovery/);
    expect(last.textContent).toMatch(/2026-01-12/);
    expect(last.textContent).toMatch(/Go/);
    expect(next.textContent).toMatch(/Build/);
    expect(next.textContent).toMatch(/2026-04-01/);
    app.teardown();
  });
});

describe('Phase 7 / AC-7.3 — Sponsor sign-off log', () => {
  it('addSponsorSignOff accepts a valid entry and appends to stakeholders[]', async () => {
    const { app } = await bootWithProject();
    const row = app.DetailPanel.addSponsorSignOff('P7', {
      date: '2026-03-15',
      scope_version: 'v1.2',
      sponsor: 'CFO',
      status: 'Approved',
      evidence_link: 'https://wiki/signoff'
    });
    expect(row).toBeTruthy();
    expect(row.type).toBe('sponsor_sign_off');
    expect(row.id).toMatch(/^so-/);
    const stakeholders = app.App.data.projects[0].stakeholders;
    expect(stakeholders.some(s => s.type === 'sponsor_sign_off' && s.sponsor === 'CFO')).toBe(true);
    app.teardown();
  });

  it('rejects invalid status values', async () => {
    const { app } = await bootWithProject();
    const row = app.DetailPanel.addSponsorSignOff('P7', {
      date: '2026-03-15', scope_version: 'v1', sponsor: 'X', status: 'Maybe'
    });
    expect(row).toBe(null);
    app.teardown();
  });

  it('round-trips through JSON.stringify / JSON.parse without data loss', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.addSponsorSignOff('P7', {
      date: '2026-03-15', scope_version: 'v1.2', sponsor: 'CFO', status: 'Conditional', evidence_link: 'https://w'
    });
    const json = JSON.stringify(app.App.data);
    const restored = JSON.parse(json);
    const restoredProj = restored.projects.find(x => x.id === 'P7');
    const signOff = (restoredProj.stakeholders || []).find(s => s.type === 'sponsor_sign_off');
    expect(signOff).toBeTruthy();
    expect(signOff.date).toBe('2026-03-15');
    expect(signOff.scope_version).toBe('v1.2');
    expect(signOff.sponsor).toBe('CFO');
    expect(signOff.status).toBe('Conditional');
    expect(signOff.evidence_link).toBe('https://w');
    app.teardown();
  });

  it('renderSponsorSignOffLog renders one row per sign-off on Scope & Value tab', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.addSponsorSignOff('P7', { date: '2026-01-01', scope_version: 'v1', sponsor: 'A', status: 'Approved' });
    app.DetailPanel.addSponsorSignOff('P7', { date: '2026-02-01', scope_version: 'v2', sponsor: 'B', status: 'Rejected' });
    app.DetailPanel.open('P7');
    // User-IA-rev: Sponsor sign-off log moved from Delivery to Scope.
    const scope = app.document.querySelector('[data-dp-tab="scope"]');
    const rows = scope.querySelectorAll('.dp-sponsor-signoff-row');
    expect(rows.length).toBe(2);
    app.teardown();
  });
});
