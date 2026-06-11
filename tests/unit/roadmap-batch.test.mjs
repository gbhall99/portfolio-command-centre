// Roadmap completion batch: streaming (SSE transport + adapter assembly +
// assistant live path), opt-in thread persistence, wireframe metric
// references, project Documents section, masked API keys, a11y helpers.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' })],
    metrics: [makeMetric({ id: 'MET-1', name: 'Churn rate', customer: 'Acme Industries' }), makeMetric({ id: 'MET-2', name: 'NPS', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function configureMock() {
  const { AI } = app;
  const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
  AI.setDefaultProfile(id);
}

describe('SSE parsing (pure)', () => {
  it('splits complete events and keeps the unfinished tail', () => {
    const { AI } = app;
    let r = AI._sseSplit('data: {"a":1}\n\ndata: {"b":2}\n\ndata: {"c"');
    expect(r.events).toEqual(['{"a":1}', '{"b":2}']);
    expect(r.rest).toBe('data: {"c"');
    r = AI._sseSplit('event: ping\r\ndata: {"x":1}\r\n\r\n');
    expect(r.events).toEqual(['{"x":1}']);
    expect(r.rest).toBe('');
  });
});

describe('stream event assembly (pure, per adapter)', () => {
  it('openai: accumulates text deltas and index-assembled tool calls', () => {
    const { AI } = app;
    const a = AI.ADAPTERS.openai;
    const state = { text: '', toolCalls: {} };
    expect(a._applyStreamEvent(state, { choices: [{ delta: { content: 'Hel' } }] })).toBe('Hel');
    expect(a._applyStreamEvent(state, { choices: [{ delta: { content: 'lo' } }] })).toBe('lo');
    a._applyStreamEvent(state, { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'list_projects', arguments: '{"sta' } }] } }] });
    a._applyStreamEvent(state, { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'tus":"Blocked"}' } }] } }] });
    expect(state.text).toBe('Hello');
    expect(state.toolCalls[0]).toEqual({ id: 'c1', name: 'list_projects', args: '{"status":"Blocked"}' });
  });

  it('anthropic: text_delta streams; input_json_delta assembles tool input', () => {
    const { AI } = app;
    const a = AI.ADAPTERS.anthropic;
    const state = { text: '', blocks: {} };
    a._applyStreamEvent(state, { type: 'content_block_start', index: 0, content_block: { type: 'text' } });
    expect(a._applyStreamEvent(state, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi ' } })).toBe('Hi ');
    a._applyStreamEvent(state, { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tu1', name: 'get_project' } });
    a._applyStreamEvent(state, { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"project_id":' } });
    a._applyStreamEvent(state, { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '"A-1"}' } });
    expect(state.text).toBe('Hi ');
    expect(state.blocks[1]).toEqual({ type: 'tool_use', id: 'tu1', name: 'get_project', args: '{"project_id":"A-1"}' });
  });
});

describe('AI.stream dispatcher', () => {
  it('streams chunked mock responses; plain responses arrive as one delta', async () => {
    const { AI } = app;
    const profile = { adapter: 'mock', model: 'mock' };
    AI.ADAPTERS.mock.program([{ chunks: ['Hel', 'lo ', 'there'] }]);
    const deltas = [];
    let res = await AI.stream(profile, [{ role: 'user', content: 'x' }], {}, (c) => deltas.push(c));
    expect(deltas).toEqual(['Hel', 'lo ', 'there']);
    expect(res.text).toBe('Hello there');
    AI.ADAPTERS.mock.program([{ text: 'whole' }]);
    const deltas2 = [];
    res = await AI.stream(profile, [{ role: 'user', content: 'x' }], {}, (c) => deltas2.push(c));
    expect(deltas2).toEqual(['whole']);
  });

  it('assistant send streams the final answer into the transcript', async () => {
    const { AI, Assistant, document } = app;
    configureMock();
    AI.ADAPTERS.mock.program([
      { toolCalls: [{ id: 'c1', name: 'list_projects', args: {} }] },
      { chunks: ['One ', 'project ', 'active.'] }
    ]);
    Assistant.open();
    document.getElementById('assistantInput').value = 'status?';
    await Assistant.send();
    expect(document.getElementById('assistantBody').textContent).toContain('One project active.');
    expect(AI.ADAPTERS.mock._calls.some(c => c.streamed)).toBe(true);
  });
});

describe('thread persistence (opt-in)', () => {
  it('off by default; on opt-in, threads round-trip through localStorage', async () => {
    const { AI, Assistant, window } = app;
    configureMock();
    expect(Assistant.persistEnabled()).toBe(false);
    Assistant.setPersist(true);
    AI.ADAPTERS.mock.program([{ text: 'Remembered answer.' }]);
    Assistant.open();
    app.document.getElementById('assistantInput').value = 'remember me';
    await Assistant.send();
    const stored = JSON.parse(window.localStorage.getItem(Assistant.PERSIST_KEY));
    expect(stored['Acme Industries'].some(m => m.content === 'Remembered answer.')).toBe(true);
    // A fresh load rebuilds the transcript from the store.
    Assistant._threads = {}; Assistant._rendered = {}; Assistant._persistLoaded = false;
    Assistant._loadThreads();
    expect(Assistant._threads['Acme Industries'].length).toBe(2);
    expect(Assistant._rendered['Acme Industries'].map(i => i.kind)).toEqual(['user', 'assistant']);
    // Opting out wipes the store.
    Assistant.setPersist(false);
    expect(window.localStorage.getItem(Assistant.PERSIST_KEY)).toBe(null);
  });
});

describe('wireframe metric references', () => {
  it('toggleMetric links/unlinks customer metrics, audited and undoable', () => {
    const { Wireframe, Definitions, App } = app;
    const def = Definitions.loadJson('tableau/wireframe-definition.json');
    const wf = Wireframe.create({ customer: 'Acme Industries', definition: def, name: 'Concept' });
    expect(wf.metric_ids).toEqual([]);
    Wireframe.toggleMetric(wf.id, 'MET-1');
    expect(Wireframe.get(wf.id).metric_ids).toEqual(['MET-1']);
    expect(App.data.audit_log.some(e => e.field === 'wireframe_metric_link')).toBe(true);
    App.undo();
    expect(Wireframe.get(wf.id).metric_ids).toEqual([]);
    App.redo();
    Wireframe.toggleMetric(wf.id, 'MET-1'); // toggle off
    expect(Wireframe.get(wf.id).metric_ids).toEqual([]);
  });

  it('the editor side panel lists customer metrics with checkboxes', () => {
    const { Wireframe, WireframeSkill, Definitions, document } = app;
    const def = Definitions.loadJson('tableau/wireframe-definition.json');
    const wf = Wireframe.create({ customer: 'Acme Industries', definition: def, name: 'Concept' });
    WireframeSkill.open({});
    WireframeSkill.edit(wf.id);
    const side = document.querySelector('#wfModal .wf-side');
    expect(side.textContent).toContain('Answers these metrics');
    expect(side.textContent).toContain('Churn rate');
    WireframeSkill.uiToggleMetric(0);
    expect(Wireframe.get(wf.id).metric_ids).toEqual(['MET-1']);
  });
});

describe('project Documents section', () => {
  it('linked SOWs and wireframes surface on the detail panel overview', () => {
    const { Sow, Wireframe, Definitions, DetailPanel, document } = app;
    const sowDef = Definitions.loadJson('sow/sow-definition.json');
    const sow = Sow.create({ customer: 'Acme Industries', definition: sowDef, generatedSections: [], name: 'SOW — Alpha', source_text: '' });
    Sow.attachProject(sow.id, 'A-1');
    const wfDef = Definitions.loadJson('tableau/wireframe-definition.json');
    const wf = Wireframe.create({ customer: 'Acme Industries', definition: wfDef, name: 'Alpha concept' });
    Wireframe.attachProject(wf.id, 'A-1');
    DetailPanel.open('A-1');
    const docs = Array.from(document.querySelectorAll('#detailPanel [data-doc-kind]'));
    expect(docs.length).toBe(2);
    expect(document.getElementById('detailPanel').textContent).toContain('SOW — Alpha');
    expect(document.getElementById('detailPanel').textContent).toContain('Alpha concept');
    // Unlinked projects show no Documents section.
    Sow.attachProject(sow.id, null);
    Wireframe.attachProject(wf.id, null);
    expect(DetailPanel.renderDocuments('A-1')).toBe('');
  });
});

describe('API key hygiene in the profile editor', () => {
  it('the stored key is never echoed; blank submit keeps it; table shows last-4', () => {
    const { AI, App, document } = app;
    const id = AI.upsertProfile({ name: 'Cloud', adapter: 'anthropic', model: 'claude-fable-5', apiKey: 'sk-secret-9876' });
    AI.setDefaultProfile(id);
    App.navigate('config');
    App.openConfigCategory('ai');
    expect(document.getElementById('configBody').textContent).toContain('…9876');
    AI.uiEditProfile(id);
    const field = document.getElementById('aiProf_apiKey');
    expect(field.value).toBe('');
    expect(field.getAttribute('placeholder')).toContain('…9876');
    // Saving with the field blank keeps the stored key.
    AI.uiSaveProfile();
    expect(AI.getProfile(id).apiKey).toBe('sk-secret-9876');
    AI.deleteProfile(id);
  });
});

describe('a11y helpers', () => {
  it('modal tab trap wraps focus at both ends', () => {
    const { App, document, window } = app;
    document.body.insertAdjacentHTML('beforeend', '<div id="trapTest"><button id="t1">a</button><button id="t2">b</button></div>');
    const container = document.getElementById('trapTest');
    const t1 = document.getElementById('t1'), t2 = document.getElementById('t2');
    // jsdom offsetParent is null — emulate visibility for the helper.
    [t1, t2].forEach(el => Object.defineProperty(el, 'offsetParent', { get: () => container }));
    t2.focus();
    let prevented = false;
    App._modalTabTrap({ key: 'Tab', shiftKey: false, preventDefault: () => { prevented = true; } }, container);
    expect(prevented).toBe(true);
    expect(document.activeElement.id).toBe('t1');
    App._modalTabTrap({ key: 'Tab', shiftKey: true, preventDefault: () => {} }, container);
    expect(document.activeElement.id).toBe('t2');
    container.remove();
  });

  it('arrow keys nudge the selected wireframe component; Delete removes it', () => {
    const { Wireframe, WireframeSkill, Definitions } = app;
    const def = Definitions.loadJson('tableau/wireframe-definition.json');
    const wf = Wireframe.create({ customer: 'Acme Industries', definition: def, name: 'Concept' });
    const bar = Wireframe.addComponent(wf.id, 'bar', def);
    WireframeSkill.open({});
    WireframeSkill.edit(wf.id);
    WireframeSkill._selId = bar.id;
    const key = (k, shift) => WireframeSkill.onModalKey({ key: k, shiftKey: !!shift, target: { tagName: 'DIV' }, preventDefault: () => {} });
    const x0 = bar.x, w0 = bar.w;
    key('ArrowRight');
    expect(Wireframe.get(wf.id).components.find(c => c.id === bar.id).x).toBe(x0 + 1);
    key('ArrowRight', true);
    expect(Wireframe.get(wf.id).components.find(c => c.id === bar.id).w).toBe(w0 + 1);
    key('Delete');
    expect(Wireframe.get(wf.id).components.some(c => c.id === bar.id)).toBe(false);
  });

  it('SOW comments use the inline input, not prompt()', () => {
    const { Sow, SowSkill, Definitions, document } = app;
    const def = Definitions.loadJson('sow/sow-definition.json');
    const sow = Sow.create({ customer: 'Acme Industries', definition: def, generatedSections: [], name: 'SOW', source_text: '' });
    SowSkill.open({});
    SowSkill.edit(sow.id);
    SowSkill.uiComment('scope');
    const input = document.getElementById('sowCommentInput');
    expect(input).not.toBeNull();
    input.value = 'Needs the API list';
    SowSkill.uiCommentSubmit('scope');
    expect(Sow.get(sow.id).sections.find(s => s.id === 'scope').comments[0].text).toBe('Needs the API list');
  });
});

describe('per-customer board prefs', () => {
  it('WIP and swimlane settings are isolated per customer', () => {
    const { Kanban, App } = app;
    App.navigate('board');
    Kanban.setWipLimit('In Progress', 2);
    Kanban.setSwimlane('manager');
    App.activeCustomer = 'Globex';
    expect(Kanban.wipLimits()['In Progress']).toBeUndefined();
    expect(Kanban.swimlane()).toBe('none');
    App.activeCustomer = 'Acme Industries';
    expect(Kanban.wipLimits()['In Progress']).toBe(2);
    expect(Kanban.swimlane()).toBe('manager');
    App.uiStateSet('board.wip.Acme Industries', null);
    App.uiStateSet('board.swimlane.Acme Industries', null);
  });
});
