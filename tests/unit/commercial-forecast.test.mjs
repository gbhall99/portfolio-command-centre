// Phase 4.1/4.2 — commercials & forecasting. Planned £ economics (Billing.
// plannedEconomics) feed scenario economics (Scenario Lab £ deltas) and a
// commercial_forecast read tool. Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

let app;

function fixture() {
  resetIdSeq();
  return makeDataset({
    customers: [{ name: 'Acme Industries' }, { name: 'Globex' }],
    projects: [
      makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', size_engineering: 20, status: 'In Progress', moscow: 'Should', manager: 'Dana', target_date: '2026-12-01' })
    ],
    sprints: makeSprintSequence(4, '2026-07-06'),
    team_members: [makeMember({ name: 'Dana', available_points_per_sprint: 10, primary_skills: ['Data Engineering'] })],
    settings: {
      // Cost rate card (per SP) + sell rate table so economics is non-zero.
      rate_card: { size_engineering: { perm: 400, contract: 500 } },
      billing: {
        currency: 'GBP', hours_per_point: 8,
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

describe('Billing.plannedEconomics', () => {
  it('computes planned revenue, cost and margin from the rate card + sell rates', () => {
    const e = app.Billing.plannedEconomics('Acme Industries');
    // 20 SP engineering: cost = 20 × 400 = 8000; revenue = 20 SP × 8 h × £100 = 16000.
    expect(e.cost).toBe(8000);
    expect(e.revenue).toBe(16000);
    expect(e.margin).toBe(8000);
    expect(e.margin_pct).toBe(50);
    expect(e.planned_points).toBe(20);
  });

  it('excludes Complete/Closed projects', () => {
    app.App.data.projects[0].status = 'Complete';
    const e = app.Billing.plannedEconomics('Acme Industries');
    expect(e.revenue).toBe(0);
    expect(e.cost).toBe(0);
  });
});

describe('scenario economics (4.2)', () => {
  it('simulate_plan carries baseline + hypothetical £ economics and a margin delta; never mutates', () => {
    const before = JSON.stringify(app.App.data);
    const r = app.AgentTools.invoke('simulate_plan', { hypothesis: 'add_project', name: 'New work', size_engineering: 10 }, ctx());
    expect(r.error).toBeUndefined();
    expect(r.baseline_economics.margin).toBe(8000);
    // +10 SP → +£4000 cost, +£8000 revenue → +£4000 margin.
    expect(r.economics.margin).toBe(12000);
    expect(r.economics_delta.margin).toBe(4000);
    expect(r.economics_delta.revenue).toBe(8000);
    expect(JSON.stringify(app.App.data)).toBe(before);
  });

  it('a saved scenario stores its economics; compare reports the £ delta vs baseline', () => {
    const { ScenarioLab } = app;
    const sc = ScenarioLab.save('Bigger', 'Acme Industries', [{ hypothesis: 'add_project', name: 'Y', size_engineering: 10 }]);
    expect(sc.economics.margin).toBe(12000);
    expect(sc.baseline_economics.margin).toBe(8000);
    const cmp = ScenarioLab.compare('Acme Industries');
    expect(cmp.baseline.economics.margin).toBe(8000);
    const row = cmp.scenarios.find(s => s.id === sc.id);
    expect(row.economics.margin).toBe(12000);
    expect(row.economics_delta.margin).toBe(4000);
  });

  it('openUI renders the Margin column', () => {
    const { ScenarioLab, document } = app;
    ScenarioLab.save('Shown', 'Acme Industries', [{ hypothesis: 'add_project', name: 'Z', size_engineering: 10 }]);
    ScenarioLab.openUI();
    const ov = document.getElementById('scenarioLabOverlay');
    expect(ov.textContent).toContain('Margin (£)');
    ov.remove();
  });
});

describe('commercial_forecast tool (4.1)', () => {
  it('returns planned economics + a completion forecast (or insufficient-history note)', () => {
    const r = app.AgentTools.invoke('commercial_forecast', {}, ctx());
    expect(r.error).toBeUndefined();
    expect(r.economics.margin).toBe(8000);
    expect(r.completion).toBeTruthy();
    // No completed sprints in the fixture → insufficient history, honestly flagged.
    expect(r.completion.insufficient_history).toBe(true);
    expect(r.note).toMatch(/do not invent/i);
  });

  it('errors without an active customer', () => {
    expect(app.AgentTools.invoke('commercial_forecast', {}, ctx({ customer: null })).error).toMatch(/No active customer/);
  });
});
