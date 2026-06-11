// WS1 — agent runtime over the capability registry. Exercises BOTH modes:
// native tool-use and the structured-output JSON fallback, plus arg
// validation, customer scoping, write-proposal gating and audit entries.
// All via the mock adapter — no network.

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

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

const mockProfile = (toolMode) => ({ id: 'mp', name: 'Mock', adapter: 'mock', model: 'mock', toolMode: toolMode || 'native' });

describe('native tool-use mode', () => {
  it('answers grounded questions via read tools and cites entities', async () => {
    const { AI, Agent } = app;
    AI.ADAPTERS.mock.program([
      { toolCalls: [{ id: 'c1', name: 'list_projects', args: { status: 'At Risk' } }] },
      { text: 'Acme Alpha is at risk.' }
    ]);
    const res = await Agent.run('which projects are at risk?', { profile: mockProfile() });
    expect(res.text).toBe('Acme Alpha is at risk.');
    expect(res.trace).toEqual([{ tool: 'list_projects', args: { status: 'At Risk' }, ok: true, error: null }]);
    expect(res.citations).toEqual([{ type: 'project', id: 'A-1', name: 'Acme Alpha' }]);
    // The adapter received the registry's tool definitions.
    expect(AI.ADAPTERS.mock._calls[0].opts.tools).toContain('list_projects');
    // The tool result fed back to the model is customer-scoped: no Globex.
    const toolMsg = AI.ADAPTERS.mock._calls[1].messages.find(m => m.role === 'tool');
    expect(toolMsg.content).toContain('Acme Alpha');
    expect(toolMsg.content).not.toContain('Globex Gamma');
  });

  it('rejects invalid tool args and reports the error to the model', async () => {
    const { AI, Agent } = app;
    AI.ADAPTERS.mock.program([
      { toolCalls: [{ id: 'c1', name: 'list_projects', args: { status: 'Bogus', junk: 1 } }] },
      { text: 'done' }
    ]);
    const res = await Agent.run('x', { profile: mockProfile() });
    expect(res.trace[0].ok).toBe(false);
    expect(res.trace[0].error).toMatch(/must be one of/);
    expect(res.trace[0].error).toMatch(/unknown arg "junk"/);
  });

  it('unknown tools are surfaced, not executed', async () => {
    const { AI, Agent } = app;
    AI.ADAPTERS.mock.program([
      { toolCalls: [{ id: 'c1', name: 'drop_database', args: {} }] },
      { text: 'ok' }
    ]);
    const res = await Agent.run('x', { profile: mockProfile() });
    expect(res.trace[0].error).toMatch(/Unknown tool: drop_database/);
  });

  it('stops at MAX_ROUNDS instead of looping forever', async () => {
    const { AI, Agent } = app;
    const spin = { toolCalls: [{ id: 'c', name: 'list_sprints', args: {} }] };
    AI.ADAPTERS.mock.program([spin, spin, spin, spin, spin, spin, spin, spin]);
    const res = await Agent.run('x', { profile: mockProfile() });
    expect(res.trace.length).toBe(Agent.MAX_ROUNDS);
    expect(res.text).toMatch(/tool-call limit/);
  });
});

describe('structured-output JSON fallback mode', () => {
  it('drives the same registry via the JSON protocol', async () => {
    const { AI, Agent } = app;
    AI.ADAPTERS.mock.program([
      { text: '{"type":"tool_call","tool":"list_projects","args":{}}' },
      { text: '{"type":"final","text":"You have 2 projects."}' }
    ]);
    const res = await Agent.run('how many projects?', { profile: mockProfile('json') });
    expect(res.text).toBe('You have 2 projects.');
    expect(res.trace[0].tool).toBe('list_projects');
    // No native tools were passed to the adapter; the protocol is in the system prompt.
    expect(AI.ADAPTERS.mock._calls[0].opts.tools).toEqual([]);
    expect(AI.ADAPTERS.mock._calls[0].messages[0].content).toContain('"type":"tool_call"');
    // Tool result is delivered as a user message.
    const calls2 = AI.ADAPTERS.mock._calls[1].messages;
    expect(calls2[calls2.length - 1].content).toContain('Tool result for list_projects');
  });

  it('repairs malformed protocol output, then gives up cleanly', async () => {
    const { AI, Agent } = app;
    AI.ADAPTERS.mock.program([
      { text: 'I think I should call a tool' },
      { text: '{"type":"final","text":"Recovered."}' }
    ]);
    let res = await Agent.run('x', { profile: mockProfile('json') });
    expect(res.text).toBe('Recovered.');

    AI.ADAPTERS.mock.program([{ text: 'junk' }, { text: 'junk' }, { text: 'junk' }]);
    res = await Agent.run('x', { profile: mockProfile('json') });
    expect(res.protocolError).toBe(true);
    expect(res.text).toMatch(/Settings → AI/);
  });
});

describe('write proposals — confirmation-gated, audited', () => {
  it('update_project_field proposes without mutating; apply() routes through App.updateProject with source ai', async () => {
    const { AI, Agent, App } = app;
    AI.ADAPTERS.mock.program([
      { toolCalls: [{ id: 'c1', name: 'update_project_field', args: { project_id: 'A-1', field: 'status', value: 'On Hold', reason: 'blocked on data' } }] },
      { text: 'Proposed moving Acme Alpha to On Hold.' }
    ]);
    const res = await Agent.run('put alpha on hold', { profile: mockProfile() });
    expect(res.proposals.length).toBe(1);
    const prop = res.proposals[0];
    expect(prop.kind).toBe('update_project');
    expect(prop.changes).toEqual([{ field: 'status', before: 'At Risk', after: 'On Hold' }]);
    // Nothing applied yet.
    expect(App.data.projects.find(p => p.id === 'A-1').status).toBe('At Risk');
    expect(App.data.audit_log.filter(e => e.source === 'ai').length).toBe(0);
    // User confirms.
    prop.apply();
    expect(App.data.projects.find(p => p.id === 'A-1').status).toBe('On Hold');
    const aiEntries = App.data.audit_log.filter(e => e.source === 'ai');
    expect(aiEntries.length).toBe(1);
    expect(aiEntries[0].field).toBe('status');
    // And it is undoable through the normal stack.
    App.undo();
    expect(App.data.projects.find(p => p.id === 'A-1').status).toBe('At Risk');
  });

  it('refuses non-whitelisted fields and cross-customer targets', async () => {
    const { AgentTools, App } = app;
    const ctx = { customer: 'Acme Industries', proposals: [], citations: [] };
    let r = AgentTools.invoke('update_project_field', { project_id: 'A-1', field: 'skill_splits', value: 'x' }, ctx);
    expect(r.error).toMatch(/not writable/);
    r = AgentTools.invoke('update_project_field', { project_id: 'G-1', field: 'status', value: 'On Hold' }, ctx);
    expect(r.error).toMatch(/No project with id G-1/);
    expect(ctx.proposals.length).toBe(0);
    expect(App.data.projects.find(p => p.id === 'G-1').status).toBe('At Risk');
  });

  it('create_project proposal builds a schema-complete project on apply', async () => {
    const { AgentTools, App } = app;
    const ctx = { customer: 'Acme Industries', proposals: [], citations: [] };
    const r = AgentTools.invoke('create_project', {
      name: 'AI Drafted Project', phases: ['Requirements', 'Data Engineering', 'Tableau'],
      size_engineering: 8, size_requirements: 3, hard_deadline: '2026-09-01'
    }, ctx);
    expect(r.proposed).toBe(true);
    const before = App.data.projects.length;
    const out = ctx.proposals[0].apply();
    expect(App.data.projects.length).toBe(before + 1);
    const p = App.data.projects.find(x => x.id === out.project_id);
    expect(p.customer).toBe('Acme Industries');
    expect(p.delivery_config.phase_order).toEqual(['Requirements', 'Data Engineering', 'Tableau']);
    expect(p.delivery_config.include_ds).toBe(false);
    expect(p.size_engineering).toBe(8);
    expect(p.size_total).toBe(11);
    expect(p.status).toBe('Not Started');
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'project_created')).toBe(true);
    // Survives the app's own integrity validation.
    const issues = App.validateDataIntegrity().filter(i => i.projectId === p.id);
    expect(issues).toEqual([]);
  });

  it('create_project with no valid phases is rejected', () => {
    const { AgentTools } = app;
    const ctx = { customer: 'Acme Industries', proposals: [], citations: [] };
    const r = AgentTools.invoke('create_project', { name: 'X', phases: ['Hypercare'] }, ctx);
    expect(r.error).toMatch(/No valid phases/);
  });
});

describe('no-AI mode', () => {
  it('Agent.run with an explicitly emptied profile list throws a clear config error', async () => {
    const { Agent, AI, window } = app;
    // First-run state seeds a local Ollama profile; "no AI" is the state
    // after the user deletes every profile (stored empty list).
    window.localStorage.setItem(AI.STORAGE_KEY, JSON.stringify({ profiles: [], defaultProfileId: null, taskDefaults: {} }));
    await expect(Agent.run('hello', {})).rejects.toThrow(/Settings → AI/);
  });

  it('a fresh install seeds a ready local Ollama profile (gemma4, /v1, JSON fallback)', () => {
    const { AI, window } = app;
    window.localStorage.removeItem(AI.STORAGE_KEY);
    const p = AI.profileForTask('chat');
    expect(p.id).toBe('seed-ollama');
    expect(p.baseUrl).toBe('http://localhost:11434/v1');
    expect(p.model).toBe('gemma4');
    expect(p.toolMode).toBe('json');
    expect(p.timeoutMs).toBe(120000);
    expect(AI.isConfigured()).toBe(true);
    // Deleting it stores an explicit empty list — the seed never resurrects.
    AI.deleteProfile('seed-ollama');
    expect(AI.isConfigured()).toBe(false);
  });
});

describe('registry definitions', () => {
  it('every tool exposes a well-formed definition for the adapters', () => {
    const { AgentTools } = app;
    const defs = AgentTools.defs();
    expect(defs.length).toBeGreaterThanOrEqual(10);
    defs.forEach(d => {
      expect(d.name).toMatch(/^[a-z_]+$/);
      expect(d.description.length).toBeGreaterThan(10);
      expect(d.parameters.type).toBe('object');
      expect(Array.isArray(d.parameters.required)).toBe(true);
    });
    const names = defs.map(d => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
