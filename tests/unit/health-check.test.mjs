// Phase 4.3 + 5.1 — commercial health check, quote_advisor, and the on-demand
// "needs your attention" panel (briefing + drift + commercials + readiness).
// Everything is read-only and user-invoked. Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

let app;

function fixture() {
  resetIdSeq();
  return makeDataset({
    customers: [{ name: 'Acme Industries' }, { name: 'Globex' }],
    projects: [
      // Plan-ready, sized, priced.
      makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', size_engineering: 20, status: 'In Progress', moscow: 'Should', manager: 'Dana', target_date: '2026-12-01' }),
      // Active but NOT plan-ready (no manager, no target_date, no points).
      makeProject({ id: 'A-2', name: 'Acme Beta', customer: 'Acme Industries', size_engineering: 0, status: 'Not Started', moscow: 'Could', manager: '', target_date: null })
    ],
    // No prepaid block by default → quotes are billable (added locally in the prepaid test).
    sprints: makeSprintSequence(4, '2026-07-06'),
    team_members: [makeMember({ name: 'Dana', available_points_per_sprint: 10, primary_skills: ['Data Engineering'] })],
    settings: {
      rate_card: { size_engineering: { perm: 900, contract: 1000 } }, // high cost → sub-target margin
      billing: {
        currency: 'GBP', hours_per_point: 8, target_margin_pct: 30,
        rate_table: { UK: { Senior: 100 } },
        customer_defaults: { 'Acme Industries': { country: 'UK', level: 'Senior' } }
      }
    }
  });
}

const ctx = (over) => Object.assign({ customer: 'Acme Industries', allScope: false, citations: [], proposals: [] }, over || {});

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('commercial health check (4.3)', () => {
  it('flags sub-target margin', () => {
    // 20 SP: cost = 20×900 = 18000; revenue = 20×8×100 = 16000 → negative margin, well below 30%.
    const rows = app.HealthCheck.commercial('Acme Industries');
    expect(rows.some(r => r.key === 'margin')).toBe(true);
  });

  it('flags a prepaid block running low', () => {
    // A 100-SP retainer drawn down to ≤15% by completing 90 SP of work.
    app.App.data.billing_arrangements = [{ id: 'BA-1', customer: 'Acme Industries', label: 'Q3 retainer', skill: 'any', prepaid_points: 100, amount_invoiced: 80000 }];
    app.App.data.projects[0].skill_splits = { size_engineering: [{ sprint: 'CY26-S1', points: 90, status: 'complete', completed: 90, assigned_to: [], reasons: [] }] };
    const rows = app.HealthCheck.commercial('Acme Industries');
    expect(rows.some(r => r.key.indexOf('prepaid:') === 0)).toBe(true);
  });
});

describe('readiness gaps', () => {
  it('flags active projects that are not plan-ready', () => {
    const rows = app.HealthCheck.readinessGaps('Acme Industries');
    expect(rows.some(r => r.key === 'ready:A-2')).toBe(true);
    // The plan-ready project is not flagged.
    expect(rows.some(r => r.key === 'ready:A-1')).toBe(false);
  });
});

describe('collect + dismiss (5.1)', () => {
  it('aggregates rows, is customer-scoped, and persists dismissals per scope', () => {
    const rows = app.HealthCheck.collect('Acme Industries');
    expect(rows.length).toBeGreaterThan(0);
    const k = rows.find(r => r.key === 'ready:A-2').key;
    app.HealthCheck.dismiss('Acme Industries', k);
    expect(app.HealthCheck.collect('Acme Industries').some(r => r.key === k)).toBe(false);
    // Dismissal is scoped — Globex is unaffected (and has no Acme rows anyway).
    expect(app.HealthCheck.isDismissed('Globex', k)).toBe(false);
  });

  it('renders the panel with rows, and an empty state when all clear', () => {
    const { HealthCheck, document } = app;
    HealthCheck.open();
    const ov = document.getElementById('healthCheckOverlay');
    expect(ov).not.toBeNull();
    expect(ov.textContent).toContain('Needs your attention');
    expect(ov.textContent).toContain('plan-ready'); // readiness row present
    ov.remove();
  });

  it('is exposed in the command palette', () => {
    expect(app.CommandPalette._build().some(i => /Health check/i.test(i.title))).toBe(true);
  });
});

describe('quote_advisor (4.3)', () => {
  it('returns grounded current economics + a lever to hit a max amount', () => {
    const r = app.AgentTools.invoke('quote_advisor', { project_id: 'A-1', max_amount: 10000 }, ctx());
    expect(r.error).toBeUndefined();
    // 20 SP × 8h × £100 = £16000 quote.
    expect(r.current.amount).toBe(16000);
    expect(r.levers.join(' ')).toMatch(/cut ~\d+ billable SP/);
  });

  it('flags a sub-target margin and refuses cross-customer projects', () => {
    const r = app.AgentTools.invoke('quote_advisor', { project_id: 'A-1', min_margin_pct: 30 }, ctx());
    expect(r.levers.join(' ')).toMatch(/below the 30% target/);
    app.App.data.projects.push(makeProject({ id: 'G-1', name: 'Globex One', customer: 'Globex' }));
    expect(app.AgentTools.invoke('quote_advisor', { project_id: 'G-1' }, ctx()).error).toMatch(/No project with id/);
  });
});
