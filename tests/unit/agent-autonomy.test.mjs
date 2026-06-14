// Phase 0 — foundations for user-initiated autonomy:
//   0.1 durable agent memory (goals/facts/worklog) + context injection
//   0.2 batch proposals + Job Runner (single undoable, audit-grouped batch)
//   0.3 per-run policy (propose vs auto-apply within caps; dry-run never mutates)
// All via the mock adapter — no network. Nothing here runs unless the test
// initiates it: there is no scheduler.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

let app;

function fixture() {
  resetIdSeq();
  return makeDataset({
    projects: [
      makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', status: 'At Risk' }),
      makeProject({ id: 'A-2', name: 'Acme Beta', customer: 'Acme Industries', status: 'In Progress' }),
      makeProject({ id: 'G-1', name: 'Globex Gamma', customer: 'Globex', status: 'At Risk' })
    ],
    sprints: makeSprintSequence(2),
    team_members: [makeMember({ name: 'Dana' })]
  });
}

const mockProfile = (toolMode) => ({ id: 'mp', name: 'Mock', adapter: 'mock', model: 'mock', toolMode: toolMode || 'native' });

// Register the mock as the default profile so Assistant.send() (which resolves
// a profile via AI.profileForTask) actually drives the mock adapter.
function configureMock() {
  const { AI } = app;
  const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock', toolMode: 'native' });
  AI.setDefaultProfile(id);
  return id;
}

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('0.1 durable agent memory', () => {
  it('migration seeds an empty, well-formed agent_memory', () => {
    const { App } = app;
    expect(App.data.agent_memory).toEqual({ goals: [], facts: [], worklog: [] });
  });

  it('goals/facts are customer-scoped and never leak across customers', () => {
    const { AgentMemory } = app;
    AgentMemory.addGoal('Acme Industries', 'Ship the Q3 dashboard by September');
    AgentMemory.addFact('Acme Industries', 'Fiscal year starts 1 April');
    AgentMemory.addGoal('Globex', 'Globex-only goal');
    expect(AgentMemory.goals('Acme Industries').map(g => g.text)).toEqual(['Ship the Q3 dashboard by September']);
    expect(AgentMemory.facts('Acme Industries').map(f => f.text)).toEqual(['Fiscal year starts 1 April']);
    expect(AgentMemory.goals('Globex').map(g => g.text)).toEqual(['Globex-only goal']);
    // No scope = everything.
    expect(AgentMemory.goals().length).toBe(2);
  });

  it('pinned goals/facts are injected into the agent system prompt for that customer', async () => {
    const { AI, Agent, AgentMemory } = app;
    AgentMemory.addGoal('Acme Industries', 'Keep Acme Alpha green');
    AgentMemory.addFact('Acme Industries', 'Dana owns the data platform');
    AgentMemory.addGoal('Globex', 'Globex secret goal');
    AI.ADAPTERS.mock.program([{ text: 'ok' }]);
    await Agent.run('hi', { profile: mockProfile(), customer: 'Acme Industries' });
    const sys = AI.ADAPTERS.mock._calls[0].messages[0].content;
    expect(sys).toContain('Keep Acme Alpha green');
    expect(sys).toContain('Dana owns the data platform');
    // The other customer's memory must not bleed in.
    expect(sys).not.toContain('Globex secret goal');
  });

  it('worklog appends and trims to the cap', () => {
    const { AgentMemory } = app;
    AgentMemory.logRun({ customer: 'Acme Industries', summary: 'did a thing', applied_count: 2 });
    const log = AgentMemory.worklog('Acme Industries');
    expect(log.length).toBe(1);
    expect(log[0].summary).toBe('did a thing');
    expect(log[0].applied_count).toBe(2);
    expect(typeof log[0].at).toBe('string');
    for (let i = 0; i < AgentMemory.MAX_WORKLOG + 20; i++) AgentMemory.logRun({ customer: 'Acme Industries', summary: 'x' });
    expect(AgentMemory.worklog('Acme Industries').length).toBe(AgentMemory.MAX_WORKLOG);
  });

  it('set_goal / remember_fact are proposal-gated and audited on apply', () => {
    const { AgentTools, AgentMemory, App } = app;
    const ctx = { customer: 'Acme Industries', proposals: [], citations: [] };
    const r = AgentTools.invoke('set_goal', { text: 'Hold the September deadline' }, ctx);
    expect(r.proposed).toBe(true);
    // Nothing pinned yet.
    expect(AgentMemory.goals('Acme Industries').length).toBe(0);
    ctx.proposals[0].apply();
    expect(AgentMemory.goals('Acme Industries').map(g => g.text)).toEqual(['Hold the September deadline']);
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'agent_goal_added')).toBe(true);
    // Undoable.
    App.undo();
    expect(AgentMemory.goals('Acme Industries').length).toBe(0);

    const r2 = AgentTools.invoke('remember_fact', { text: 'FY starts 1 April' }, ctx);
    expect(r2.proposed).toBe(true);
    ctx.proposals[1].apply();
    expect(AgentMemory.facts('Acme Industries').map(f => f.text)).toEqual(['FY starts 1 April']);
  });

  it('list_memory reads back goals, facts and recent runs (scoped)', () => {
    const { AgentTools, AgentMemory } = app;
    AgentMemory.addGoal('Acme Industries', 'Goal A');
    AgentMemory.addFact('Acme Industries', 'Fact A');
    AgentMemory.addGoal('Globex', 'Goal G');
    AgentMemory.logRun({ customer: 'Acme Industries', summary: 'ran a batch', applied_count: 3 });
    const ctx = { customer: 'Acme Industries', proposals: [], citations: [] };
    const r = AgentTools.invoke('list_memory', {}, ctx);
    expect(r.goals.map(g => g.text)).toEqual(['Goal A']);
    expect(r.facts.map(f => f.text)).toEqual(['Fact A']);
    expect(r.recent_runs.length).toBe(1);
    expect(r.recent_runs[0].applied).toBe(3);
  });
});

describe('0.2 batch apply — single undo, audit-grouped', () => {
  it('applies a batch of proposals atomically and reverts with one undo', () => {
    const { AgentTools, App } = app;
    const ctx = { customer: 'Acme Industries', proposals: [], citations: [] };
    AgentTools.invoke('update_project_field', { project_id: 'A-1', field: 'status', value: 'On Hold' }, ctx);
    AgentTools.invoke('update_project_field', { project_id: 'A-2', field: 'status', value: 'Blocked' }, ctx);
    AgentTools.invoke('create_raid_item', { project_id: 'A-1', kind: 'risk', description: 'Data feed unstable', impact: 4, probability: 3 }, ctx);
    expect(ctx.proposals.length).toBe(3);

    const undoBefore = App.undoStack.length;
    const r = App.runBatch('test batch', ctx.proposals.map(p => () => p.apply()));
    expect(r.applied).toBe(3);
    expect(App.data.projects.find(p => p.id === 'A-1').status).toBe('On Hold');
    expect(App.data.projects.find(p => p.id === 'A-2').status).toBe('Blocked');
    expect(App.data.projects.find(p => p.id === 'A-1').risks_register.length).toBe(1);
    // Exactly ONE undo entry was added for the whole batch.
    expect(App.undoStack.length).toBe(undoBefore + 1);
    // Audit entries from the batch share a run_id.
    const aiEntries = App.data.audit_log.filter(e => e.source === 'ai' && e.run_id);
    expect(aiEntries.length).toBeGreaterThanOrEqual(2);
    expect(new Set(aiEntries.map(e => e.run_id)).size).toBe(1);

    // One Ctrl+Z reverts everything.
    App.undo();
    expect(App.data.projects.find(p => p.id === 'A-1').status).toBe('At Risk');
    expect(App.data.projects.find(p => p.id === 'A-2').status).toBe('In Progress');
    expect(App.data.projects.find(p => p.id === 'A-1').risks_register.length).toBe(0);
  });

  it('runBatch is a no-op for an empty list', () => {
    const { App } = app;
    const undoBefore = App.undoStack.length;
    const r = App.runBatch('empty', []);
    expect(r.applied).toBe(0);
    expect(App.undoStack.length).toBe(undoBefore);
  });
});

describe('0.2/0.3 Assistant batch + auto-apply policy (user-initiated)', () => {
  async function runWithProposals(n) {
    const { AI, Assistant, document } = app;
    configureMock();
    const calls = [];
    for (let i = 1; i <= n; i++) {
      calls.push({ toolCalls: [{ id: 'c' + i, name: 'update_project_field', args: { project_id: i % 2 ? 'A-1' : 'A-2', field: 'priority', value: String(i) } }] });
    }
    calls.push({ text: 'Proposed ' + n + ' changes.' });
    AI.ADAPTERS.mock.program(calls);
    Assistant.open();
    document.getElementById('assistantInput').value = 'make ' + n + ' changes';
    await Assistant.send();
  }

  it('propose mode (default): multiple proposals render as ONE batch card and mutate nothing until confirmed', async () => {
    const { Assistant, App, document } = app;
    await runWithProposals(3);
    const items = Assistant._items();
    const batchIdx = items.findIndex(i => i.kind === 'batch');
    expect(batchIdx).toBeGreaterThanOrEqual(0);
    expect(items[batchIdx].state).toBe('pending');
    expect(items[batchIdx].proposals.length).toBe(3);
    // Nothing applied yet.
    expect(App.data.audit_log.filter(e => e.source === 'ai').length).toBe(0);
    const card = document.querySelector('#assistantBody .assistant-proposal');
    expect(card.textContent).toContain('3 proposed changes');

    // Deselect one, confirm the rest → single undoable batch.
    Assistant.toggleBatchItem(batchIdx, 0);
    const undoBefore = App.undoStack.length;
    Assistant.confirmBatch(batchIdx);
    expect(items[batchIdx].state).toBe('applied');
    expect(items[batchIdx].appliedCount).toBe(2);
    expect(App.undoStack.length).toBe(undoBefore + 1);
    // A worklog entry recorded the run.
    expect(App.data.agent_memory.worklog.some(w => w.mode === 'batch' && w.applied_count === 2)).toBe(true);
  });

  it('auto_apply mode: applies within the cap and downgrades the overflow to a pending card', async () => {
    const { Assistant, App } = app;
    Assistant.setPolicy({ mode: 'auto_apply', maxChanges: 2 });
    await runWithProposals(3);
    const items = Assistant._items();
    // First two auto-applied as one batch...
    const applied = items.find(i => i.kind === 'batch' && i.state === 'applied' && i.auto);
    expect(applied).toBeTruthy();
    expect(applied.appliedCount).toBe(2);
    expect(App.data.audit_log.filter(e => e.source === 'ai').length).toBe(2);
    // ...the third stayed a pending proposal (a single card).
    const pending = items.find(i => i.kind === 'proposal' && i.state === 'pending');
    expect(pending).toBeTruthy();
    // Worklog logged the auto run.
    expect(App.data.agent_memory.worklog.some(w => w.mode === 'auto_apply')).toBe(true);
  });

  it('dry-run preview (propose) never mutates even with auto_apply available', async () => {
    const { Assistant, App } = app;
    // Default policy is propose.
    expect(Assistant.policy().mode).toBe('propose');
    await runWithProposals(2);
    expect(App.data.audit_log.filter(e => e.source === 'ai').length).toBe(0);
  });

  it('policy persists through uiState and clamps the cap', () => {
    const { Assistant } = app;
    Assistant.setPolicy({ mode: 'auto_apply', maxChanges: 999 });
    expect(Assistant.policy()).toEqual({ mode: 'auto_apply', maxChanges: 50 });
    Assistant.setPolicy({ mode: 'propose', maxChanges: 0 });
    expect(Assistant.policy()).toEqual({ mode: 'propose', maxChanges: 5 });
  });
});
