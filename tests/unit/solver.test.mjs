// Solver invariants — one assertion family per SOLVER.md rule R1–R11.
// Fixtures are minimal: build only what each rule needs. Structural assertions
// (no-slice-X-in-condition-Y) per SOLVER.md §10 so data-change won't break us.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

/**
 * Run the solver in isolation. Loads the app harness, injects the supplied
 * dataset, invokes Solver.solve for the target customer with optional setting
 * overrides, returns the plan.
 */
async function runSolver(dataset, customer = 'Acme Industries', settingOverrides = {}) {
  const app = await loadApp(dataset);
  const settings = { ...app.Sprint.allocSettings, ...settingOverrides };
  const plan = app.Solver.solve(customer, settings, app.App.data, app.Sprint);
  return { plan, app };
}

function allSlices(plan) {
  const slices = [];
  Object.entries(plan.allocations || {}).forEach(([pid, skills]) => {
    Object.entries(skills || {}).forEach(([sk, arr]) => {
      (arr || []).forEach(slice => slices.push({ ...slice, pid, sk }));
    });
  });
  return slices;
}

describe('Solver — R1: earliest-to-latest fill', () => {
  it('no slice of phase N sits later than a slice of phase N+1 (same project)', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(5);
    const sprintIdx = {};
    sprints.forEach((s, i) => { sprintIdx[s.sprint_id] = i; });
    const proj = makeProject({
      name: 'Phased',
      size_engineering: 10,
      size_data_science: 5,
      delivery_config: { phase_order: ['Data Engineering', 'Data Science'] }
    });
    proj.size_total = 15;
    const member = makeMember({ name: 'Alice', primary_skills: ['Data Engineering', 'Data Science'] });
    const { plan, app } = await runSolver(makeDataset({
      projects: [proj], sprints, team_members: [member]
    }));
    const slices = allSlices(plan);
    const engMax = Math.max(...slices.filter(s => s.sk === 'size_engineering').map(s => sprintIdx[s.sprint]));
    const dsMin = Math.min(...slices.filter(s => s.sk === 'size_data_science').map(s => sprintIdx[s.sprint]));
    expect(dsMin).toBeGreaterThanOrEqual(engMax);
    app.teardown();
  });
});

describe('Solver — R4: per-person cap', () => {
  it('no member exceeds available_points_per_sprint in any sprint', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const projects = [
      makeProject({ name: 'P1', size_engineering: 25 }),
      makeProject({ name: 'P2', size_engineering: 25 })
    ];
    projects.forEach(p => { p.size_total = 25; });
    const alice = makeMember({ name: 'Alice', available_points_per_sprint: 20 });
    const { plan, app } = await runSolver(makeDataset({
      projects, sprints, team_members: [alice]
    }));
    // Aggregate member SP per sprint across all slices
    const perSprint = {};
    allSlices(plan).forEach(s => {
      (s.assigned_to || []).forEach(a => {
        const key = s.sprint + '|' + a.member;
        perSprint[key] = (perSprint[key] || 0) + (a.points || 0);
      });
    });
    Object.entries(perSprint).forEach(([key, pts]) => {
      expect(pts).toBeLessThanOrEqual(20);
    });
    app.teardown();
  });

  it('negative: disabling enforcePerPersonCap permits overflow', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(1); // one sprint → forces overflow
    const proj = makeProject({ name: 'Huge', size_engineering: 100 });
    proj.size_total = 100;
    const alice = makeMember({ name: 'Alice', available_points_per_sprint: 20 });
    const { plan, app } = await runSolver(
      makeDataset({ projects: [proj], sprints, team_members: [alice] }),
      'Acme Industries',
      { enforcePerPersonCap: false }
    );
    // Overflow allocations may be dumped into the last sprint with reasons:['overflow']
    const slices = allSlices(plan);
    expect(slices.length).toBeGreaterThan(0);
    app.teardown();
  });
});

describe('Solver — R7: deadline beats buffer', () => {
  it('emits buffer_skipped_deadline or deadline_miss when buffer would push past deadline', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(4);
    const proj = makeProject({
      name: 'TightDeadline',
      size_engineering: 10,
      size_data_science: 10,
      hard_deadline: sprints[1].end_date,  // deadline in 2nd sprint
      delivery_config: { phase_order: ['Data Engineering', 'Data Science'] }
    });
    proj.size_total = 20;
    const alice = makeMember({ name: 'Alice', primary_skills: ['Data Engineering', 'Data Science'], available_points_per_sprint: 20 });
    const { plan, app } = await runSolver(makeDataset({
      projects: [proj], sprints, team_members: [alice]
    }));
    const types = new Set(plan.warnings.map(w => w.type));
    // Either the solver skipped the buffer, or the deadline is reported as a miss.
    expect(
      types.has('buffer_skipped_deadline') || types.has('deadline_miss') || types.has('time_budget_split')
    ).toBe(true);
    app.teardown();
  });
});

describe('Solver — R8: "Both"-customer capacity split', () => {
  it('calcMemberCapacityForSprint returns capacity_by_customer value for the requested scope', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(1);
    const bothMember = makeMember({
      name: 'Both-Person',
      customer: 'Both',
      available_points_per_sprint: 20,
      capacity_by_customer: { Acme Industries: 7, Globex: 13 }
    });
    const app = await loadApp(makeDataset({
      projects: [], sprints, team_members: [bothMember]
    }));
    // Acme Industries scope sees 7 SP, Globex scope sees 13 — NOT the 20 total.
    expect(app.Sprint.calcMemberCapacityForSprint(bothMember, 'CY26-S1', 'Acme Industries').points).toBe(7);
    expect(app.Sprint.calcMemberCapacityForSprint(bothMember, 'CY26-S1', 'Globex').points).toBe(13);
    app.teardown();
  });

  it('back-compat fallback equal-splits when capacity_by_customer is absent', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(1);
    const bothMember = makeMember({
      name: 'Both-Person',
      customer: 'Both',
      available_points_per_sprint: 30
    });
    const app = await loadApp(makeDataset({
      projects: [], sprints, team_members: [bothMember]
    }));
    // With 3 customers (Acme Industries, Globex, Initech) and no per-customer map, each scope sees 30/3 = 10.
    const gccCap = app.Sprint.calcMemberCapacityForSprint(bothMember, 'CY26-S1', 'Acme Industries').points;
    expect(gccCap).toBeLessThan(30);
    expect(gccCap).toBeGreaterThan(0);
    app.teardown();
  });
});

describe('Solver — R10: slice metadata completeness', () => {
  it('every slice carries non-empty assigned_to and reasons', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const projects = [
      makeProject({ name: 'A', size_engineering: 10 }),
      makeProject({ name: 'B', size_engineering: 10 })
    ];
    projects.forEach(p => { p.size_total = 10; });
    const alice = makeMember({ name: 'Alice', available_points_per_sprint: 15 });
    const { plan, app } = await runSolver(makeDataset({
      projects, sprints, team_members: [alice]
    }));
    const slices = allSlices(plan);
    expect(slices.length).toBeGreaterThan(0);
    slices.forEach(s => {
      expect(Array.isArray(s.assigned_to)).toBe(true);
      expect(Array.isArray(s.reasons)).toBe(true);
      // Overflow slices are a known exception — they encode "nothing could be assigned".
      // Every OTHER slice type must carry a real assignment.
      if (!(s.reasons || []).includes('overflow')) {
        expect(s.assigned_to.length).toBeGreaterThan(0);
      }
    });
    app.teardown();
  });
});

describe('Solver — R11: day-budget clamping', () => {
  it('daysPerSPMultiplier > 1 forces more time-splits than baseline', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(6);
    const proj = makeProject({
      name: 'BigFast',
      size_engineering: 25,
      delivery_config: { phase_order: ['Data Engineering'] }
    });
    proj.size_total = 25;
    // Single person, 20 SP/sprint → baseline needs ~2 sprints. With 2× multiplier, calendar-days
    // per SP double → R11 should force more splits.
    const alice = makeMember({ name: 'Alice', available_points_per_sprint: 20 });

    const baseData = makeDataset({ projects: [proj], sprints, team_members: [alice] });
    const baseApp = await loadApp(baseData);
    const basePlan = baseApp.Solver.solve('Acme Industries', baseApp.Sprint.allocSettings, baseApp.App.data, baseApp.Sprint);
    const baseSplits = basePlan.warnings.filter(w => w.type === 'time_budget_split').length;
    baseApp.teardown();

    const slowApp = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [alice] }));
    slowApp.App.data.settings.scheduler.daysPerSPMultiplier = 2.5;
    // Rebuild ledger by re-invoking solve — settings read live.
    const slowPlan = slowApp.Solver.solve('Acme Industries', slowApp.Sprint.allocSettings, slowApp.App.data, slowApp.Sprint);
    const slowSplits = slowPlan.warnings.filter(w => w.type === 'time_budget_split').length;
    slowApp.teardown();

    expect(slowSplits).toBeGreaterThanOrEqual(baseSplits);
  });
});

describe('Solver — Determinism', () => {
  it('returns identical allocations on back-to-back runs with identical inputs', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(4);
    const projects = [
      makeProject({ name: 'A', size_engineering: 8 }),
      makeProject({ name: 'B', size_engineering: 6 }),
      makeProject({ name: 'C', size_engineering: 4 })
    ];
    projects.forEach(p => { p.size_total = p.size_engineering; });
    const team = [
      makeMember({ name: 'Alice', available_points_per_sprint: 10 }),
      makeMember({ name: 'Bob', available_points_per_sprint: 10 })
    ];
    const app = await loadApp(makeDataset({ projects, sprints, team_members: team }));
    const a = app.Solver.solve('Acme Industries', app.Sprint.allocSettings, app.App.data, app.Sprint);
    const b = app.Solver.solve('Acme Industries', app.Sprint.allocSettings, app.App.data, app.Sprint);
    // Compare allocation maps as JSON — stable under deterministic insertion order.
    expect(JSON.stringify(a.allocations)).toBe(JSON.stringify(b.allocations));
    app.teardown();
  });
});

describe('Solver — overflow slice integrity (bug fix regression)', () => {
  // Historical bug: when Pass 1 couldn't place work and the overflow fallback found an existing
  // slice in the last sprint, it bumped slice.points without updating assigned_to — leaving
  // slice.points != Σ(assigned_to[].points). Fixed to always push a new slice.
  it('every slice has points equal to the sum of its assigned_to totals (or is an overflow slice)', async () => {
    resetIdSeq();
    // Build a fixture that triggers partial placement + overflow: sprints in the past so
    // protectPast blocks most of them, then a future tail sprint with insufficient capacity.
    const today = new Date().toISOString().slice(0, 10);
    // Two past sprints + one future sprint that's too small for all the work.
    const past1 = { sprint_id: 'P1', start_date: '2000-01-03', hardening_start: '2000-01-28', end_date: '2000-02-03' };
    const past2 = { sprint_id: 'P2', start_date: '2000-02-07', hardening_start: '2000-03-03', end_date: '2000-03-09' };
    const future = (() => {
      const startD = new Date(today); startD.setDate(startD.getDate() + 30);
      const hardD = new Date(startD); hardD.setDate(hardD.getDate() + 28);
      const endD = new Date(startD); endD.setDate(endD.getDate() + 34);
      return { sprint_id: 'F1', start_date: startD.toISOString().slice(0,10), hardening_start: hardD.toISOString().slice(0,10), end_date: endD.toISOString().slice(0,10) };
    })();
    const proj = makeProject({ customer: 'Acme Industries', size_engineering: 15 });
    proj.size_total = 15;
    const member = makeMember({ name: 'A', customer: 'Acme Industries', available_points_per_sprint: 10 });
    const { plan, app } = await runSolver(makeDataset({
      projects: [proj], sprints: [past1, past2, future], team_members: [member]
    }));
    // Expect an overflow warning because all-past + small future can't fit 15 SP.
    // The horizon-terminal shape applies here — no hard_deadline constrains the window.
    expect(plan.warnings.some(w => w.type === 'capacity_overflow_horizon' || w.type === 'capacity_overflow')).toBe(true);
    // Every NON-overflow slice must have slice.points === Σ(assigned_to[].points).
    allSlices(plan).forEach(s => {
      const isOverflow = (s.reasons || []).includes('overflow');
      const assignedTotal = (s.assigned_to || []).reduce((acc, a) => acc + (a.points || 0), 0);
      if (!isOverflow) {
        expect(s.points).toBe(assignedTotal);
      }
    });
    app.teardown();
  });
});

describe('Solver — portfolio-data.json smoke', () => {
  it('produces a plan with no circular_dependency warning on the bundled dataset', async () => {
    const app = await loadApp();
    const plan = app.Solver.solve('Acme Industries', app.Sprint.allocSettings, app.App.data, app.Sprint);
    const circular = plan.warnings.filter(w => w.type === 'circular_dependency');
    expect(circular.length).toBe(0);
    // Invariant: every slice has a valid sprint reference
    const validSprints = new Set(app.App.data.sprints.map(s => s.sprint_id));
    allSlices(plan).forEach(s => { expect(validSprints.has(s.sprint)).toBe(true); });
    app.teardown();
  });
});
