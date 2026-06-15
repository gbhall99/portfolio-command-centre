// WS1 — provider-agnostic AI layer: settings isolation, adapter request
// shaping, capability negotiation, JSON extraction/validation, backoff.
// No network ever: adapters are exercised via their pure buildRequest /
// parseResponse functions and the mock adapter.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeAll(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({ projects: [makeProject()] }));
});
afterAll(() => app.teardown());

describe('AI settings storage', () => {
  it('persists profiles in localStorage, never in App.data', () => {
    const { AI, App, window } = app;
    const id = AI.upsertProfile({ name: 'Test Local', adapter: 'openai', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1', apiKey: 'secret-key-123' });
    expect(AI.getProfile(id).name).toBe('Test Local');
    // The key must never be reachable from the exported data model.
    expect(JSON.stringify(App.data)).not.toContain('secret-key-123');
    expect(window.localStorage.getItem(AI.STORAGE_KEY)).toContain('secret-key-123');
    AI.deleteProfile(id);
    expect(AI.getProfile(id)).toBe(null);
  });

  it('resolves per-task defaults with fallback to the global default', () => {
    const { AI } = app;
    const a = AI.upsertProfile({ name: 'A', adapter: 'openai', model: 'm-a' });
    const b = AI.upsertProfile({ name: 'B', adapter: 'anthropic', model: 'm-b' });
    AI.setDefaultProfile(a);
    expect(AI.profileForTask('chat').id).toBe(a);
    AI.setTaskDefault('drafting', b);
    expect(AI.profileForTask('drafting').id).toBe(b);
    expect(AI.profileForTask('chat').id).toBe(a);
    AI.setTaskDefault('drafting', null);
    expect(AI.profileForTask('drafting').id).toBe(a);
    AI.deleteProfile(a); AI.deleteProfile(b);
  });

  it('degrades to empty settings on corrupt localStorage', () => {
    const { AI, window } = app;
    window.localStorage.setItem(AI.STORAGE_KEY, '{not json');
    const s = AI.getSettings();
    expect(s.profiles).toEqual([]);
    expect(AI.isConfigured()).toBe(false);
    window.localStorage.removeItem(AI.STORAGE_KEY);
  });
});

describe('capability negotiation', () => {
  it('openai adapter honours toolMode json override', () => {
    const { AI } = app;
    expect(AI.capabilities({ adapter: 'openai', toolMode: 'auto' }).tools).toBe(true);
    expect(AI.capabilities({ adapter: 'openai', toolMode: 'json' }).tools).toBe(false);
    expect(AI.capabilities({ adapter: 'anthropic' }).tools).toBe(true);
    expect(AI.capabilities({ adapter: 'gemini' }).tools).toBe(true);
    expect(AI.capabilities({ adapter: 'nonsense' }).tools).toBe(false);
  });
});

describe('adapter request shaping (pure, no network)', () => {
  const messages = [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'hello' }
  ];
  const tools = [{ name: 't1', description: 'd', parameters: { type: 'object', properties: {}, required: [] } }];

  it('openai: base URL, bearer key, tool mapping, tool-result roundtrip', () => {
    const { AI } = app;
    const profile = { adapter: 'openai', baseUrl: 'http://localhost:11434/v1/', model: 'llama3.1', apiKey: 'k', temperature: 0.1 };
    const req = AI.ADAPTERS.openai.buildRequest(profile, messages, { tools });
    expect(req.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(req.headers.Authorization).toBe('Bearer k');
    expect(req.body.tools[0].function.name).toBe('t1');
    // Assistant tool-call + tool-result mapping
    const followup = messages.concat([
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 't1', args: { x: 1 } }] },
      { role: 'tool', toolCallId: 'c1', content: '{"ok":true}' }
    ]);
    const req2 = AI.ADAPTERS.openai.buildRequest(profile, followup, {});
    const mapped = req2.body.messages;
    expect(mapped[2].tool_calls[0].function.arguments).toBe('{"x":1}');
    expect(mapped[3]).toEqual({ role: 'tool', tool_call_id: 'c1', content: '{"ok":true}' });
    // Response parsing incl. unparseable args guard
    const parsed = AI.ADAPTERS.openai.parseResponse({ choices: [{ message: { content: 'hi', tool_calls: [{ id: 'a', function: { name: 'f', arguments: 'not json' } }] } }] });
    expect(parsed.text).toBe('hi');
    expect(parsed.toolCalls[0].args._unparseable).toBe('not json');
  });

  it('anthropic: system extraction, browser header, tool_use blocks', () => {
    const { AI } = app;
    const profile = { adapter: 'anthropic', model: 'claude-fable-5', apiKey: 'k2' };
    const req = AI.ADAPTERS.anthropic.buildRequest(profile, messages, { tools });
    expect(req.url).toBe('https://api.anthropic.com/v1/messages');
    expect(req.headers['x-api-key']).toBe('k2');
    expect(req.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(req.body.system).toBe('sys');
    expect(req.body.messages.every(m => m.role !== 'system')).toBe(true);
    expect(req.body.tools[0].input_schema).toBeTruthy();
    const parsed = AI.ADAPTERS.anthropic.parseResponse({ content: [{ type: 'text', text: 'a' }, { type: 'tool_use', id: 'tu1', name: 'f', input: { y: 2 } }] });
    expect(parsed.text).toBe('a');
    expect(parsed.toolCalls[0]).toEqual({ id: 'tu1', name: 'f', args: { y: 2 } });
  });

  it('groq: served by the openai adapter via a preset (base URL, bearer key, tools)', () => {
    const { AI } = app;
    // Groq is OpenAI-compatible — it ships as a preset on the openai adapter.
    const preset = AI.PRESETS.groq;
    expect(preset.adapter).toBe('openai');
    expect(preset.baseUrl).toBe('https://api.groq.com/openai/v1');
    expect(preset.model).toBeTruthy();
    const profile = { adapter: preset.adapter, baseUrl: preset.baseUrl, model: preset.model, apiKey: 'gsk_test', temperature: 0.1, toolMode: preset.toolMode };
    const req = AI.ADAPTERS.openai.buildRequest(profile, messages, { tools });
    expect(req.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(req.headers.Authorization).toBe('Bearer gsk_test');
    expect(req.body.tools[0].function.name).toBe('t1');
    // Tool calling is available with the preset's default tool mode.
    expect(AI.capabilities(profile).tools).toBe(true);
  });

  it('gemini: key in header not URL, functionDeclarations, role mapping', () => {
    const { AI } = app;
    const profile = { adapter: 'gemini', model: 'gemini-2.0-flash', apiKey: 'k3' };
    const req = AI.ADAPTERS.gemini.buildRequest(profile, messages, { tools });
    expect(req.url).not.toContain('k3');
    expect(req.headers['x-goog-api-key']).toBe('k3');
    expect(req.body.systemInstruction.parts[0].text).toBe('sys');
    expect(req.body.tools[0].functionDeclarations[0].name).toBe('t1');
    const parsed = AI.ADAPTERS.gemini.parseResponse({ candidates: [{ content: { parts: [{ text: 'g' }, { functionCall: { name: 'f', args: {} } }] } }] });
    expect(parsed.text).toBe('g');
    expect(parsed.toolCalls[0].name).toBe('f');
  });
});

describe('JSON extraction and schema validation', () => {
  it('extracts JSON from fences, prose and nested braces', () => {
    const { AI } = app;
    expect(AI.extractJson('```json\n{"a":1}\n```').value).toEqual({ a: 1 });
    expect(AI.extractJson('Sure! Here it is: {"a":{"b":"}"}} extra').value).toEqual({ a: { b: '}' } });
    expect(AI.extractJson('[1,2,3]').value).toEqual([1, 2, 3]);
    expect(AI.extractJson('no json here').ok).toBe(false);
    expect(AI.extractJson('{"unbalanced": ').ok).toBe(false);
    expect(AI.extractJson('').ok).toBe(false);
  });

  it('validates the minimal schema subset', () => {
    const { AI } = app;
    const schema = {
      type: 'object', additionalProperties: false, required: ['name', 'count'],
      properties: {
        name: { type: 'string' },
        count: { type: 'integer' },
        tags: { type: 'array', items: { type: 'string' } },
        level: { type: 'string', enum: ['low', 'high'] }
      }
    };
    expect(AI.validateAgainstSchema({ name: 'x', count: 2, tags: ['a'], level: 'low' }, schema).ok).toBe(true);
    expect(AI.validateAgainstSchema({ name: 'x' }, schema).ok).toBe(false);              // missing required
    expect(AI.validateAgainstSchema({ name: 'x', count: 1.5 }, schema).ok).toBe(false);  // not integer
    expect(AI.validateAgainstSchema({ name: 'x', count: 1, zz: 1 }, schema).ok).toBe(false); // unknown key
    expect(AI.validateAgainstSchema({ name: 'x', count: 1, level: 'mid' }, schema).ok).toBe(false); // enum
  });
});

describe('transport hardening', () => {
  it('backoff is exponential and honours Retry-After with a cap', () => {
    const { AI } = app;
    expect(AI._backoffDelay(0)).toBe(1000);
    expect(AI._backoffDelay(1)).toBe(2000);
    expect(AI._backoffDelay(2)).toBe(4000);
    expect(AI._backoffDelay(10)).toBe(16000);
    expect(AI._backoffDelay(0, 5)).toBe(5000);
    expect(AI._backoffDelay(0, 9999)).toBe(30000);
  });

  it('describes CORS-style failures with actionable guidance', async () => {
    const { AI } = app;
    // The harness stubs fetch to reject — exactly what a CORS failure looks like.
    const profile = { adapter: 'openai', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' };
    const saved = AI.MAX_RETRIES;
    AI.MAX_RETRIES = 0; // keep the test fast
    let err = null;
    try { await AI.chat(profile, [{ role: 'user', content: 'hi' }], {}); }
    catch (e) { err = e; }
    AI.MAX_RETRIES = saved;
    expect(err).toBeTruthy();
    expect(err.aiKind).toBe('cors');
    expect(AI.describeError(err)).toContain('OLLAMA_ORIGINS');
  });
});

describe('mock adapter + structuredOutput repair loop', () => {
  it('repairs invalid structured output once, then succeeds', async () => {
    const { AI } = app;
    AI.ADAPTERS.mock.program([
      { text: 'not json at all' },
      { text: '{"title":"Fixed","points":3}' }
    ]);
    const profile = { adapter: 'mock', model: 'mock' };
    const schema = { type: 'object', required: ['title', 'points'], properties: { title: { type: 'string' }, points: { type: 'integer' } } };
    const out = await AI.structuredOutput(profile, [{ role: 'user', content: 'extract' }], schema);
    expect(out).toEqual({ title: 'Fixed', points: 3 });
    // The second call must carry the repair instruction.
    const secondCall = AI.ADAPTERS.mock._calls[1];
    const lastMsg = secondCall.messages[secondCall.messages.length - 1];
    expect(lastMsg.content).toContain('invalid');
  });

  it('fails cleanly when the model never produces valid output', async () => {
    const { AI } = app;
    AI.ADAPTERS.mock.program([{ text: 'junk' }, { text: 'more junk' }]);
    const profile = { adapter: 'mock', model: 'mock' };
    await expect(AI.structuredOutput(profile, [{ role: 'user', content: 'x' }], { type: 'object', required: ['a'], properties: { a: { type: 'string' } } }))
      .rejects.toThrow(/structured output/);
  });
});
