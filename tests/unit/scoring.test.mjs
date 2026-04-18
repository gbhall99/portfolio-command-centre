// Scoring + priority tests — locks down the recent wave of priority work:
// recommended_priority as a separate field, explainer breakdown, apply flows.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, makeSprintSequence, resetIdSeq } from '../harness/fixtures.mjs';

describe('calculateRiskScore — bug fix regression', () => {
  // Historical bug: the function read r.severity + r.probability as strings, but the risk form
  // stores them as numeric impact + probability. Every risk scored a flat 6 × multiplier
  // regardless of user input. Fixed to read numeric impact/probability primarily.
  it('scales linearly with user-entered impact and probability', async () => {
    resetIdSeq();
    const heavy = makeProject({ id: 'HEAVY', risks_register: [
      { description: 'x', impact: 5, probability: 5 },
      { description: 'y', impact: 5, probability: 5 }
    ]});
    const light = makeProject({ id: 'LIGHT', risks_register: [
      { description: 'x', impact: 1, probability: 1 },
      { description: 'y', impact: 1, probability: 1 }
    ]});
    const app = await loadApp(makeDataset({ projects: [heavy, light] }));
    const h = app.App.calculateRiskScore(heavy);
    const l = app.App.calculateRiskScore(light);
    // With default riskMultiplier (1): heavy = 2×25 = 50, light = 2×1 = 2.
    expect(h).toBe(50);
    expect(l).toBe(2);
    app.teardown();
  });

  it('empty risks_register contributes 0', async () => {
    resetIdSeq();
    const clean = makeProject({ id: 'CLEAN', risks_register: [] });
    const app = await loadApp(makeDataset({ projects: [clean] }));
    expect(app.App.calculateRiskScore(clean)).toBe(0);
    app.teardown();
  });
});

describe('calculateProjectPriorityScore', () => {
  it('component formula reconciles with explainPriorityScore total', async () => {
    resetIdSeq();
    const proj = makeProject({
      id: 'Acme Industries-TEST',
      status: 'Blocked',
      rag_schedule: 'Red', rag_resourcing: 'Amber', rag_scope: 'Green',
      size_requirements: 2, size_engineering: 8, size_uat_adoption: 2
    });
    const app = await loadApp(makeDataset({ projects: [proj], sprints: makeSprintSequence(1) }));
    const score = app.App.calculateProjectPriorityScore(proj, 0);
    const breakdown = app.App.explainPriorityScore('Acme Industries-TEST');
    const sum = breakdown.rows.reduce((a, r) => a + r.contribution, 0);
    // Total is Math.round; allow ±1 for rounding delta.
    expect(Math.abs(Math.round(sum) - score)).toBeLessThanOrEqual(1);
    expect(breakdown.total).toBe(score);
    app.teardown();
  });

  it('On-Hold/Complete status scores 0 for status component', async () => {
    resetIdSeq();
    const onHold = makeProject({ id: 'Acme Industries-HOLD', status: 'On Hold' });
    const complete = makeProject({ id: 'Acme Industries-DONE', status: 'Complete' });
    const app = await loadApp(makeDataset({ projects: [onHold, complete] }));
    const holdBreak = app.App.explainPriorityScore('Acme Industries-HOLD');
    const doneBreak = app.App.explainPriorityScore('Acme Industries-DONE');
    const holdStatus = holdBreak.rows.find(r => r.label === 'Status');
    const doneStatus = doneBreak.rows.find(r => r.label === 'Status');
    // On Hold has weight 1, Complete 0.
    expect(doneStatus.contribution).toBe(0);
    expect(holdStatus.contribution).toBeGreaterThan(0);
    app.teardown();
  });

  it('deadline score follows the graded tier ramp (R9)', async () => {
    resetIdSeq();
    const today = new Date();
    const inDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    const p7  = makeProject({ id: 'P7',  hard_deadline: inDays(5), status: 'In Progress' });
    const p14 = makeProject({ id: 'P14', hard_deadline: inDays(12), status: 'In Progress' });
    const p30 = makeProject({ id: 'P30', hard_deadline: inDays(25), status: 'In Progress' });
    const p60 = makeProject({ id: 'P60', hard_deadline: inDays(55), status: 'In Progress' });
    const pNone = makeProject({ id: 'PNONE', hard_deadline: null, status: 'In Progress' });
    const app = await loadApp(makeDataset({ projects: [p7, p14, p30, p60, pNone] }));
    // Default tiers: ≤7→60, ≤14→40, ≤30→20, ≤60→10, else 0.
    expect(app.App.calculateDeadlineScore(p7)).toBe(60);
    expect(app.App.calculateDeadlineScore(p14)).toBe(40);
    expect(app.App.calculateDeadlineScore(p30)).toBe(20);
    expect(app.App.calculateDeadlineScore(p60)).toBe(10);
    expect(app.App.calculateDeadlineScore(pNone)).toBe(0);
    app.teardown();
  });
});

describe('_computePriorityOrderings', () => {
  it('ancestors rank above descendants even with lower scores', async () => {
    resetIdSeq();
    // Ancestor is Not Started (low score), descendant is Blocked (high score) but blocked_by ancestor.
    const ancestor = makeProject({
      id: 'Acme Industries-ANC', name: 'Ancestor', status: 'Not Started',
      rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green'
    });
    const descendant = makeProject({
      id: 'Acme Industries-DESC', name: 'Descendant', status: 'Blocked',
      rag_schedule: 'Red', rag_resourcing: 'Red', rag_scope: 'Red',
      dependencies: [{ type: 'blocked_by', target_id: 'Acme Industries-ANC' }]
    });
    const app = await loadApp(makeDataset({ projects: [descendant, ancestor] }));
    const { perCustomerOrder } = app.App._computePriorityOrderings();
    const gcc = perCustomerOrder.Acme Industries.map(p => p.id);
    expect(gcc.indexOf('Acme Industries-ANC')).toBeLessThan(gcc.indexOf('Acme Industries-DESC'));
    app.teardown();
  });
});

describe('autoPrioritise / applyRecommendedPriority', () => {
  it('autoPrioritise writes recommended_priority but does NOT mutate priority', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'Acme Industries-A', priority: 99, status: 'Blocked', rag_schedule: 'Red', rag_resourcing: 'Red', rag_scope: 'Red' });
    const b = makeProject({ id: 'Acme Industries-B', priority: 1,  status: 'Not Started' });
    const app = await loadApp(makeDataset({ projects: [a, b] }));
    app.App.autoPrioritise();
    const aAfter = app.App.data.projects.find(p => p.id === 'Acme Industries-A');
    const bAfter = app.App.data.projects.find(p => p.id === 'Acme Industries-B');
    expect(aAfter.priority).toBe(99);
    expect(bAfter.priority).toBe(1);
    expect(aAfter.recommended_priority).toBeDefined();
    expect(bAfter.recommended_priority).toBeDefined();
    // Blocked+triple-Red should out-rank Not Started+triple-Green.
    expect(aAfter.recommended_priority).toBeLessThan(bAfter.recommended_priority);
    app.teardown();
  });

  it('applyRecommendedPriority copies recommended → priority and logs audit entry', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'Acme Industries-A', priority: 5, status: 'Blocked' });
    const app = await loadApp(makeDataset({ projects: [a] }));
    // Force recommendation to 1 so there's something to apply.
    app.App.data.projects[0].recommended_priority = 1;
    const auditBefore = (app.App.data.audit_log || []).length;
    app.App.applyRecommendedPriority('Acme Industries-A');
    expect(app.App.data.projects[0].priority).toBe(1);
    expect((app.App.data.audit_log || []).length).toBeGreaterThan(auditBefore);
    app.teardown();
  });

  it('applyAllRecommendations changes only projects where priority !== recommended_priority', async () => {
    resetIdSeq();
    const already = makeProject({ id: 'Acme Industries-MATCH', priority: 2 });
    const diff    = makeProject({ id: 'Acme Industries-DIFF',  priority: 7 });
    const app = await loadApp(makeDataset({ projects: [already, diff] }));
    app.App.data.projects[0].recommended_priority = 2; // already matches
    app.App.data.projects[1].recommended_priority = 1; // differs
    // Stub confirm to accept
    app.window.confirm = () => true;
    app.App.applyAllRecommendations();
    expect(app.App.data.projects[0].priority).toBe(2);
    expect(app.App.data.projects[1].priority).toBe(1);
    app.teardown();
  });
});

describe('explainPriorityScore', () => {
  it('returns 6 rows in documented order', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'Acme Industries-EXP', status: 'In Progress' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    const b = app.App.explainPriorityScore('Acme Industries-EXP');
    expect(b.rows.map(r => r.label)).toEqual(['Status', 'RAG', 'Risks', 'Size', 'Deadline', 'Dep lever']);
    app.teardown();
  });

  it('returns null for unknown project id', async () => {
    const app = await loadApp(makeDataset({ projects: [] }));
    expect(app.App.explainPriorityScore('nonexistent')).toBeNull();
    app.teardown();
  });
});
