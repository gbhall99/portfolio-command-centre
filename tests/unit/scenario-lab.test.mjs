// Phase 2.1 — Scenario Lab. Saved, named, comparable solver what-ifs built on
// the shared engine refactored out of simulate_plan. save/compare/promote;
// promote emits confirm-gated write proposals. Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

let app;

function fixture() {
  resetIdSeq();
  return makeDataset({
    customers: [{ name: 'Acme Industries' }, { name: 'Globex' }],
    projects: [
      makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', size_engineering: 10, status: 'Not Started', moscow: 'Should', manager: 'Dana', target_date: '2026-12-01', hard_deadline: '2026-12-01' })
    ],
    sprints: makeSprintSequence(4, '2026-07-06'),
    team_members: [makeMember({ name: 'Dana', available_points_per_sprint: 10, primary_skills: ['Data Engineering'] })]
  });
}

const ctx = (over) => Object.assign({ customer: 'Acme Industries', allScope: false, citations: [], proposals: [] }, over || {});

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('engine parity with simulate_plan', () => {
  it('ScenarioLab.simulate matches the simulate_plan tool output and never mutates', () => {
    const { AgentTools, ScenarioLab, App } = app;
    const before = JSON.stringify(App.data);
    const viaTool = AgentTools.invoke('simulate_plan', { hypothesis: 'add_project', name: 'X', size_engineering: 20 }, ctx());
    const viaEngine = ScenarioLab.simulate('Acme Industries', { hypothesis: 'add_project', name: 'X', size_engineering: 20 });
    expect(viaTool.hypothetical.total_points).toBe(viaEngine.hypothetical.total_points);
    expect(viaTool.baseline.makespan_sprints).toBe(viaEngine.baseline.makespan_sprints);
    expect(JSON.stringify(App.data)).toBe(before);
  });
});

describe('capacity overflow summarisation', () => {
  it('_summarise surfaces the suffixed capacity_overflow_* warning types in capacity_overflows', () => {
    const { ScenarioLab } = app;
    // 4 sprints x 10 DE pts = 40 pts capacity; 10 pts baseline + 500 hypothetical
    // saturates the horizon, so the solver emits capacity_overflow_horizon (the
    // plain 'capacity_overflow' type is no longer emitted since the type split).
    const out = ScenarioLab.simulate('Acme Industries', { hypothesis: 'add_project', name: 'Huge', size_engineering: 500 });
    const counts = out.hypothetical.warning_counts;
    expect((counts.capacity_overflow_horizon || 0) + (counts.capacity_overflow_deadline || 0)).toBeGreaterThan(0);
    expect(out.hypothetical.capacity_overflows.length).toBeGreaterThan(0);
    expect(out.hypothetical.capacity_overflows.some(w =>
      w.type === 'capacity_overflow_horizon' || w.type === 'capacity_overflow_deadline')).toBe(true);
  });
});

describe('save / list / compare', () => {
  it('migration seeds plan_scenarios as an empty array', () => {
    expect(Array.isArray(app.App.data.plan_scenarios)).toBe(true);
    expect(app.App.data.plan_scenarios.length).toBe(0);
  });

  it('save_scenario proposes (no store) then apply() persists a scenario with its solver result', () => {
    const { AgentTools, App, ScenarioLab } = app;
    const c = ctx();
    const r = AgentTools.invoke('save_scenario', { scenario_name: 'Big Q3', hypothesis: 'add_project', name: 'New DB', size_engineering: 30 }, c);
    expect(r.proposed).toBe(true);
    expect(r.projected.makespan_sprints).toBeGreaterThan(0);
    expect(App.data.plan_scenarios.length).toBe(0); // not yet
    c.proposals[0].apply();
    expect(App.data.plan_scenarios.length).toBe(1);
    const sc = App.data.plan_scenarios[0];
    expect(sc.name).toBe('Big Q3');
    expect(sc.customer).toBe('Acme Industries');
    expect(sc.hypotheses[0].hypothesis).toBe('add_project');
    expect(sc.result.total_points).toBe(40); // 10 baseline + 30
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'plan_scenario_saved')).toBe(true);
    App.undo();
    expect(App.data.plan_scenarios.length).toBe(0);
  });

  it('compare_scenarios returns baseline + each saved scenario with deltas', () => {
    const { ScenarioLab, AgentTools } = app;
    ScenarioLab.save('Stretch', 'Acme Industries', [{ hypothesis: 'add_project', name: 'Y', size_engineering: 30 }]);
    const cmp = AgentTools.invoke('compare_scenarios', {}, ctx());
    expect(cmp.scenarios.length).toBe(1);
    expect(cmp.baseline.makespan_sprints).toBeGreaterThan(0);
    const row = cmp.scenarios[0];
    expect(row.name).toBe('Stretch');
    expect(row.delta.makespan_sprints).toBe(row.makespan_sprints - cmp.baseline.makespan_sprints);
  });

  it('scenarios are customer-scoped', () => {
    const { ScenarioLab } = app;
    ScenarioLab.save('Acme one', 'Acme Industries', []);
    ScenarioLab.save('Globex one', 'Globex', []);
    expect(ScenarioLab.list('Acme Industries').map(s => s.name)).toEqual(['Acme one']);
    expect(ScenarioLab.list('Globex').map(s => s.name)).toEqual(['Globex one']);
  });
});

describe('promote', () => {
  it('turns a saved scenario into confirm-gated write proposals; applying mutates live data', () => {
    const { ScenarioLab, App } = app;
    const sc = ScenarioLab.save('Pull in A-1', 'Acme Industries', [{ hypothesis: 'change_deadline', project_id: 'A-1', hard_deadline: '2026-08-01' }]);
    const c = ctx();
    const r = ScenarioLab.promote(sc.id, c);
    expect(r.proposed).toBe(1);
    expect(c.proposals.length).toBe(1);
    // Nothing applied yet.
    expect(App.data.projects.find(p => p.id === 'A-1').hard_deadline).toBe('2026-12-01');
    App.runBatch('promote', c.proposals.map(p => () => p.apply()));
    expect(App.data.projects.find(p => p.id === 'A-1').hard_deadline).toBe('2026-08-01');
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'hard_deadline')).toBe(true);
  });

  it('promote_scenario tool expands into proposals and reports skips for non-promotable hypotheses', () => {
    const { ScenarioLab, AgentTools } = app;
    const sc = ScenarioLab.save('Lose Dana', 'Acme Industries', [{ hypothesis: 'remove_member', member_name: 'Dana' }]);
    const c = ctx();
    const r = AgentTools.invoke('promote_scenario', { scenario_id: sc.id }, c);
    expect(r.promoting).toBe(true);
    expect(r.proposed).toBe(0);
    expect(r.skipped.join(' ')).toMatch(/remove_member/);
    expect(c.proposals.length).toBe(0);
  });

  it('add_project promotion proposes a real project creation', () => {
    const { ScenarioLab, App } = app;
    const sc = ScenarioLab.save('New work', 'Acme Industries', [{ hypothesis: 'add_project', name: 'Promoted DB', size_engineering: 15, phases: ['Data Engineering'] }]);
    const c = ctx();
    ScenarioLab.promote(sc.id, c);
    expect(c.proposals.length).toBe(1);
    const before = App.data.projects.length;
    c.proposals[0].apply();
    expect(App.data.projects.length).toBe(before + 1);
    expect(App.data.projects.some(p => p.name === 'Promoted DB')).toBe(true);
  });
});

describe('UI + palette', () => {
  it('openUI renders the compare table; CommandPalette exposes Scenario Lab', () => {
    const { ScenarioLab, CommandPalette, document } = app;
    ScenarioLab.save('Shown', 'Acme Industries', [{ hypothesis: 'add_project', name: 'Z', size_engineering: 20 }]);
    ScenarioLab.openUI();
    const ov = document.getElementById('scenarioLabOverlay');
    expect(ov).not.toBeNull();
    expect(ov.textContent).toContain('Scenario Lab');
    expect(ov.textContent).toContain('Shown');
    expect(ov.textContent).toContain('Baseline');
    ov.remove();
    expect(CommandPalette._build().some(i => /Scenario Lab/.test(i.title))).toBe(true);
  });
});
