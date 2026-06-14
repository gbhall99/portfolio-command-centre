// Phase 1.1 — NL-to-action coverage. New read + write tools so the assistant
// can edit dependencies, milestones, capacity, strategy, billing and governance
// by sentence. Every write is proposal-gated, routes through the canonical
// mutator, audits as 'ai', and is undoable. Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, makeObjective, resetIdSeq } from '../harness/fixtures.mjs';

let app;

function fixture() {
  resetIdSeq();
  return makeDataset({
    customers: [{ name: 'Acme Industries' }, { name: 'Globex' }],
    projects: [
      makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', status: 'At Risk', dependencies: [], customer_milestones: [] }),
      makeProject({ id: 'A-2', name: 'Acme Beta', customer: 'Acme Industries', status: 'In Progress', dependencies: [], customer_milestones: [] }),
      makeProject({ id: 'G-1', name: 'Globex Gamma', customer: 'Globex', status: 'At Risk' })
    ],
    sprints: makeSprintSequence(3),
    team_members: [makeMember({ name: 'Dana', available_points_per_sprint: 20 })],
    objectives: [makeObjective({ id: 'OBJ-1', name: 'Grow adoption', customer: 'Acme Industries' })]
  });
}

const ctx = (over) => Object.assign({ customer: 'Acme Industries', allScope: false, citations: [], proposals: [] }, over || {});

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('manage_dependency', () => {
  it('proposes a project link, applies through the canonical path, audits ai, and undoes', () => {
    const { AgentTools, App } = app;
    const c = ctx();
    const r = AgentTools.invoke('manage_dependency', { project_id: 'A-1', action: 'add', type: 'blocked_by', target_id: 'A-2' }, c);
    expect(r.proposed).toBe(true);
    expect(App.data.projects.find(p => p.id === 'A-1').dependencies.length).toBe(0); // not yet
    c.proposals[0].apply();
    const deps = App.data.projects.find(p => p.id === 'A-1').dependencies;
    expect(deps).toEqual([{ kind: 'project', type: 'blocked_by', target_id: 'A-2' }]);
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'dependency_added')).toBe(true);
    App.undo();
    expect(App.data.projects.find(p => p.id === 'A-1').dependencies.length).toBe(0);
  });

  it('adds an external blocker and removes by index', () => {
    const { AgentTools, App } = app;
    let c = ctx();
    AgentTools.invoke('manage_dependency', { project_id: 'A-1', action: 'add', label: 'Vendor API access' }, c);
    c.proposals[0].apply();
    expect(App.data.projects.find(p => p.id === 'A-1').dependencies[0]).toMatchObject({ kind: 'external', label: 'Vendor API access' });
    c = ctx();
    AgentTools.invoke('manage_dependency', { project_id: 'A-1', action: 'remove', index: 0 }, c);
    c.proposals[0].apply();
    expect(App.data.projects.find(p => p.id === 'A-1').dependencies.length).toBe(0);
  });

  it('refuses a cross-customer target and self-dependency without proposing', () => {
    const { AgentTools } = app;
    const c = ctx();
    expect(AgentTools.invoke('manage_dependency', { project_id: 'A-1', action: 'add', target_id: 'G-1' }, c).error).toMatch(/No target project/);
    expect(AgentTools.invoke('manage_dependency', { project_id: 'A-1', action: 'add', target_id: 'A-1' }, c).error).toMatch(/cannot depend on itself/);
    expect(c.proposals.length).toBe(0);
  });
});

describe('set_milestone', () => {
  it('adds, updates and removes a customer milestone (audited ai, undoable)', () => {
    const { AgentTools, App } = app;
    let c = ctx();
    AgentTools.invoke('set_milestone', { project_id: 'A-1', action: 'add', name: 'Go live', date: '2026-09-30', status: 'Planned', external_commitment: true }, c);
    c.proposals[0].apply();
    let ms = App.data.projects.find(p => p.id === 'A-1').customer_milestones;
    expect(ms[0]).toMatchObject({ name: 'Go live', date: '2026-09-30', status: 'Planned', external_commitment: true });
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'customer_milestone_add')).toBe(true);

    c = ctx();
    AgentTools.invoke('set_milestone', { project_id: 'A-1', action: 'update', index: 0, status: 'Achieved' }, c);
    c.proposals[0].apply();
    expect(App.data.projects.find(p => p.id === 'A-1').customer_milestones[0].status).toBe('Achieved');

    c = ctx();
    AgentTools.invoke('set_milestone', { project_id: 'A-1', action: 'remove', index: 0 }, c);
    c.proposals[0].apply();
    expect(App.data.projects.find(p => p.id === 'A-1').customer_milestones.length).toBe(0);
  });

  it('rejects add without name/date and update with nothing to change', () => {
    const { AgentTools } = app;
    const c = ctx();
    expect(AgentTools.invoke('set_milestone', { project_id: 'A-1', action: 'add', name: 'x' }, c).error).toMatch(/needs name and date/);
    app.App.data.projects.find(p => p.id === 'A-1').customer_milestones.push({ name: 'm', date: '2026-01-01', status: 'Planned' });
    expect(AgentTools.invoke('set_milestone', { project_id: 'A-1', action: 'update', index: 0 }, c).error).toMatch(/at least one/);
  });
});

describe('update_capacity', () => {
  it('sets the default and a per-sprint override, audited and undoable', () => {
    const { AgentTools, App } = app;
    const sprintId = App.data.sprints[1].sprint_id;
    const c = ctx();
    const r = AgentTools.invoke('update_capacity', { member_name: 'Dana', available_points: 25, sprint_id: sprintId, sprint_points: 10 }, c);
    expect(r.proposed).toBe(true);
    const m = App.data.team_members.find(x => x.name === 'Dana');
    expect(m.available_points_per_sprint).toBe(20); // not yet
    c.proposals[0].apply();
    expect(m.available_points_per_sprint).toBe(25);
    expect(m.sprint_overrides[sprintId].available_points).toBe(10);
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'team_member_capacity')).toBe(true);
    App.undo();
    expect(App.data.team_members.find(x => x.name === 'Dana').available_points_per_sprint).toBe(20);
  });

  it('errors on unknown member and missing values', () => {
    const { AgentTools } = app;
    const c = ctx();
    expect(AgentTools.invoke('update_capacity', { member_name: 'Nobody', available_points: 5 }, c).error).toMatch(/No team member/);
    expect(AgentTools.invoke('update_capacity', { member_name: 'Dana' }, c).error).toMatch(/Provide available_points/);
  });
});

describe('update_strategy', () => {
  it('creates an objective and updates an existing one (audited ai)', () => {
    const { AgentTools, App, Objectives } = app;
    let c = ctx();
    AgentTools.invoke('update_strategy', { entity: 'objective', action: 'create', name: 'Reduce churn', status: 'active' }, c);
    const out = c.proposals[0].apply();
    expect(App.data.objectives.some(o => o.name === 'Reduce churn' && o.customer === 'Acme Industries')).toBe(true);
    expect(out.id).toBeTruthy();
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'objective_created')).toBe(true);

    c = ctx();
    AgentTools.invoke('update_strategy', { entity: 'objective', action: 'update', id: 'OBJ-1', status: 'achieved' }, c);
    c.proposals[0].apply();
    expect(Objectives.byId('OBJ-1').status).toBe('achieved');
  });

  it('creates a metric using the customer default group, and refuses cross-customer update', () => {
    const { AgentTools, App } = app;
    const c = ctx();
    AgentTools.invoke('update_strategy', { entity: 'metric', action: 'create', name: 'NPS', definition: 'Net promoter score', unit: 'pts' }, c);
    c.proposals[0].apply();
    const met = App.data.metrics.find(m => m.name === 'NPS');
    expect(met).toBeTruthy();
    expect(met.customer).toBe('Acme Industries');
    expect(met.group_id).toBeTruthy();
    // Updating an id that doesn't belong to the customer errors.
    expect(AgentTools.invoke('update_strategy', { entity: 'objective', action: 'update', id: 'OBJ-NONE', name: 'x' }, c).error).toMatch(/No objective with id/);
  });
});

describe('update_billing_arrangement', () => {
  it('adds and removes a prepaid block, audited ai', () => {
    const { AgentTools, App } = app;
    let c = ctx();
    AgentTools.invoke('update_billing_arrangement', { action: 'add', label: 'FY26 retainer', skill: 'size_engineering', prepaid_points: 100, amount_invoiced: 50000 }, c);
    c.proposals[0].apply();
    const arr = App.data.billing_arrangements.find(a => a.label === 'FY26 retainer');
    expect(arr).toMatchObject({ customer: 'Acme Industries', skill: 'size_engineering', prepaid_points: 100 });
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'billing_arrangement_added')).toBe(true);

    c = ctx();
    AgentTools.invoke('update_billing_arrangement', { action: 'remove', id: arr.id }, c);
    c.proposals[0].apply();
    expect(App.data.billing_arrangements.some(a => a.id === arr.id)).toBe(false);
  });

  it('rejects add with no points and remove of a missing id', () => {
    const { AgentTools } = app;
    const c = ctx();
    expect(AgentTools.invoke('update_billing_arrangement', { action: 'add', label: 'x' }, c).error).toMatch(/prepaid_points/);
    expect(AgentTools.invoke('update_billing_arrangement', { action: 'remove', id: 'nope' }, c).error).toMatch(/No billing arrangement/);
  });
});

describe('update_governance', () => {
  it('adds a forum and logs a project decision (audited ai, undoable)', () => {
    const { AgentTools, App } = app;
    let c = ctx();
    AgentTools.invoke('update_governance', { action: 'add_forum', name: 'Steering Committee', cadence: 'Monthly', next_date: '2026-07-01' }, c);
    c.proposals[0].apply();
    expect(App.data.governance_forums.some(f => f.name === 'Steering Committee' && f.customer === 'Acme Industries')).toBe(true);
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'governance_forum_added')).toBe(true);

    c = ctx();
    AgentTools.invoke('update_governance', { action: 'log_decision', project_id: 'A-1', decision: 'Adopt the phased rollout plan', rationale: 'Lowers delivery risk' }, c);
    c.proposals[0].apply();
    const dec = App.data.projects.find(p => p.id === 'A-1').decisions_register;
    expect(dec[dec.length - 1]).toMatchObject({ decision: 'Adopt the phased rollout plan' });
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'decision_logged')).toBe(true);
    App.undo();
    const dec2 = App.data.projects.find(p => p.id === 'A-1').decisions_register || [];
    expect(dec2.some(d => d.decision === 'Adopt the phased rollout plan')).toBe(false);
  });

  it('refuses a duplicate forum and a decision on a cross-customer project', () => {
    const { AgentTools } = app;
    const c = ctx();
    AgentTools.invoke('update_governance', { action: 'add_forum', name: 'Dup' }, c);
    c.proposals[0].apply();
    expect(AgentTools.invoke('update_governance', { action: 'add_forum', name: 'Dup' }, ctx()).error).toMatch(/already exists/);
    expect(AgentTools.invoke('update_governance', { action: 'log_decision', project_id: 'G-1', decision: 'cross-customer' }, ctx()).error).toMatch(/valid project_id/);
  });
});

describe('read tools', () => {
  it('list_dependencies / list_milestones / list_objectives are customer-scoped', () => {
    const { AgentTools, App } = app;
    App.data.projects.find(p => p.id === 'A-1').dependencies.push({ kind: 'project', type: 'blocks', target_id: 'A-2' });
    App.data.projects.find(p => p.id === 'A-1').customer_milestones.push({ name: 'M1', date: '2026-08-01', status: 'Planned' });
    const c = ctx();
    expect(AgentTools.invoke('list_dependencies', {}, c).dependencies).toHaveLength(1);
    expect(AgentTools.invoke('list_milestones', {}, c).milestones).toHaveLength(1);
    const objs = AgentTools.invoke('list_objectives', {}, c).objectives;
    expect(objs.map(o => o.id)).toContain('OBJ-1');
  });
});

describe('registry shape', () => {
  it('the new write tools expose valid, unique definitions', () => {
    const { AgentTools } = app;
    const names = AgentTools.defs().map(d => d.name);
    ['manage_dependency', 'set_milestone', 'update_capacity', 'update_strategy', 'update_billing_arrangement', 'update_governance', 'list_dependencies', 'list_milestones', 'list_objectives']
      .forEach(n => expect(names).toContain(n));
    expect(new Set(names).size).toBe(names.length);
  });
});
