// W1a — multimodal (vision) message layer across every adapter. Pure
// buildRequest shaping + capability negotiation; no network. Images travel as
// a normalized { mime, data } part on a message and each adapter translates it
// to its own image block.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;
beforeAll(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({ projects: [makeProject()] }));
});
afterAll(() => app.teardown());

const PNG = 'iVBORw0KGgoAAAANS'; // a stand-in base64 blob — content is opaque to the layer
const DATA_URL = 'data:image/png;base64,' + PNG;

describe('image normalization helpers', () => {
  it('parses a data URL into { mime, data }', () => {
    expect(app.AI._normImage(DATA_URL)).toEqual({ mime: 'image/png', data: PNG });
  });
  it('passes through an object and rebuilds a data URL', () => {
    const img = { mime: 'image/jpeg', data: 'abc' };
    expect(app.AI._normImage(img)).toEqual(img);
    expect(app.AI._dataUrl(img)).toBe('data:image/jpeg;base64,abc');
  });
  it('returns null for non-image / malformed input', () => {
    expect(app.AI._normImage('not-a-data-url')).toBe(null);
    expect(app.AI._normImage(null)).toBe(null);
  });
});

describe('capability negotiation — vision', () => {
  const { } = {};
  it('detects vision from the model name across cloud + local families', () => {
    const { AI } = app;
    expect(AI.capabilities({ adapter: 'openai', model: 'gpt-4o' }).vision).toBe(true);
    expect(AI.capabilities({ adapter: 'openai', model: 'gpt-3.5-turbo' }).vision).toBe(false);
    expect(AI.capabilities({ adapter: 'anthropic', model: 'claude-sonnet-4-6' }).vision).toBe(true);
    expect(AI.capabilities({ adapter: 'gemini', model: 'gemini-2.0-flash' }).vision).toBe(true);
    // local vision models served through the OpenAI-compatible adapter
    expect(AI.capabilities({ adapter: 'openai', model: 'llava:13b' }).vision).toBe(true);
    expect(AI.capabilities({ adapter: 'openai', model: 'llama3.2-vision' }).vision).toBe(true);
    expect(AI.capabilities({ adapter: 'openai', model: 'qwen2.5-vl' }).vision).toBe(true);
    expect(AI.capabilities({ adapter: 'openai', model: 'gemma3:12b' }).vision).toBe(true);
    expect(AI.capabilities({ adapter: 'openai', model: 'llama3.1' }).vision).toBe(false);
  });
  it('an explicit profile.vision flag overrides the heuristic', () => {
    const { AI } = app;
    expect(AI.capabilities({ adapter: 'openai', model: 'llama3.1', vision: true }).vision).toBe(true);
    expect(AI.capabilities({ adapter: 'openai', model: 'gpt-4o', vision: false }).vision).toBe(false);
  });
  it('mock vision is programmable via the profile', () => {
    const { AI } = app;
    expect(AI.capabilities({ adapter: 'mock' }).vision).toBe(false);
    expect(AI.capabilities({ adapter: 'mock', vision: true }).vision).toBe(true);
  });
});

describe('adapter request shaping — images', () => {
  const messages = () => [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'look at this', images: [{ mime: 'image/png', data: PNG }] }
  ];

  it('openai builds an image_url content part with a data URL', () => {
    const req = app.AI.ADAPTERS.openai.buildRequest({ adapter: 'openai', model: 'gpt-4o' }, messages(), {});
    const userMsg = req.body.messages.find(m => m.role === 'user');
    expect(Array.isArray(userMsg.content)).toBe(true);
    expect(userMsg.content[0]).toEqual({ type: 'text', text: 'look at this' });
    expect(userMsg.content[1]).toEqual({ type: 'image_url', image_url: { url: DATA_URL } });
  });

  it('anthropic builds a base64 image source block', () => {
    const req = app.AI.ADAPTERS.anthropic.buildRequest({ adapter: 'anthropic', model: 'claude-sonnet-4-6' }, messages(), {});
    const userMsg = req.body.messages.find(m => m.role === 'user');
    expect(userMsg.content[0]).toEqual({ type: 'text', text: 'look at this' });
    expect(userMsg.content[1]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG } });
  });

  it('gemini builds an inline_data part', () => {
    const req = app.AI.ADAPTERS.gemini.buildRequest({ adapter: 'gemini', model: 'gemini-2.0-flash' }, messages(), {});
    const userContent = req.body.contents.find(c => c.role === 'user');
    expect(userContent.parts[0]).toEqual({ text: 'look at this' });
    expect(userContent.parts[1]).toEqual({ inline_data: { mime_type: 'image/png', data: PNG } });
  });

  it('text-only messages keep the plain string content shape (no regression)', () => {
    const plain = [{ role: 'user', content: 'hello' }];
    const req = app.AI.ADAPTERS.openai.buildRequest({ adapter: 'openai', model: 'gpt-4o' }, plain, {});
    expect(req.body.messages[0]).toEqual({ role: 'user', content: 'hello' });
  });
});
