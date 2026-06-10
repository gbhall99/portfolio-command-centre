// Phase 1 hardening (post-WS7 review): customer-switch race in the
// Assistant, quote-safe gallery handlers, escAttr for attribute contexts,
// AI bucket in the Activity filter, per-profile timeouts.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [
      makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' }),
      makeProject({ id: 'G-1', name: 'Globex Gamma', customer: 'Globex' })
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function configureMock() {
  const { AI } = app;
  const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
  AI.setDefaultProfile(id);
}

describe('Assistant customer-switch race', () => {
  it('a response arriving after a customer switch lands on the asking customer, not the new one', async () => {
    const { AI, Assistant, App, document } = app;
    configureMock();
    // The mock "model" switches the active customer mid-request — the worst case.
    AI.ADAPTERS.mock.program([
      (messages) => {
        App.setActiveCustomer('Globex');
        return { text: 'Answer about Acme.' };
      }
    ]);
    Assistant.open();
    document.getElementById('assistantInput').value = 'how is acme doing?';
    await Assistant.send();
    // Model-facing thread and transcript both belong to Acme…
    expect(Assistant._threads['Acme Industries'].some(m => m.content === 'Answer about Acme.')).toBe(true);
    expect((Assistant._rendered['Acme Industries'] || []).some(i => i.text === 'Answer about Acme.')).toBe(true);
    // …and nothing leaked into Globex's context.
    expect(Assistant._threads['Globex'] || []).toEqual([]);
    expect(Assistant._rendered['Globex'] || []).toEqual([]);
  });

  it('the agent runs against the customer captured at send time', async () => {
    const { AI, Assistant, App, document } = app;
    configureMock();
    AI.ADAPTERS.mock.program([
      (messages) => {
        App.setActiveCustomer('Globex');
        return { toolCalls: [{ id: 'c1', name: 'list_projects', args: {} }] };
      },
      { text: 'done' }
    ]);
    App.setActiveCustomer('Acme Industries');
    Assistant.open();
    document.getElementById('assistantInput').value = 'list projects';
    await Assistant.send();
    // The tool executed with Acme scope even though the active customer changed mid-run.
    const toolMsg = AI.ADAPTERS.mock._calls[1].messages.find(m => m.role === 'tool');
    expect(toolMsg.content).toContain('Acme Alpha');
    expect(toolMsg.content).not.toContain('Globex Gamma');
  });
});

describe('quote-safe rendering', () => {
  it('escAttr escapes both quote kinds; esc remains unchanged for text', () => {
    const { Dashboard } = app;
    expect(Dashboard.escAttr('O\'Brien "and" <Co>')).toBe('O&#39;Brien &quot;and&quot; &lt;Co&gt;');
    expect(Dashboard.esc('<b>')).toBe('&lt;b&gt;');
  });

  it('skills gallery survives a customer name containing quotes', () => {
    const { App, Skills, Definitions } = app;
    App.activeCustomer = "O'Brien & \"Co\"";
    const html = Skills.renderGalleryCard();
    // Index-based handlers: no customer name inside any onclick/onchange.
    const handlers = html.match(/on(click|change)="[^"]*"/g) || [];
    handlers.forEach(h => expect(h).not.toContain('Brien'));
    // Round trip: the index-based toggle writes settings for the quoted customer.
    Skills.uiToggle(0, false);
    expect(Skills.isEnabled(Skills.REGISTRY[0].id, "O'Brien & \"Co\"")).toBe(false);
    App.activeCustomer = 'Acme Industries';
  });

  it('kanban search box round-trips a value containing quotes', () => {
    const { App, Kanban, document } = app;
    App.navigate('board');
    Kanban._search = '"alpha\'s"';
    Kanban.renderToolbar();
    expect(document.getElementById('kbSearch').value).toBe('"alpha\'s"');
    Kanban._search = '';
  });
});

describe('Activity feed AI filter', () => {
  it('the source dropdown offers AI and filtering isolates AI entries', () => {
    const { App, AuditPanel, document } = app;
    App.updateProject('A-1', 'status', 'On Hold', 'ai');
    App.updateProject('A-1', 'priority', 5, 'user');
    App.navigate('activity');
    const opts = Array.from(document.querySelectorAll('#activitySource option')).map(o => o.value);
    expect(opts).toContain('ai');
    AuditPanel.setSourceFilter('ai');
    const feedText = document.getElementById('activityFeed') ? document.getElementById('activityFeed').textContent : document.body.textContent;
    expect(feedText).toContain('status');
    expect(AuditPanel._sourceBucket('ai')).toBe('ai');
    expect(AuditPanel._sourceBucket('ai-sow')).toBe('ai');
    expect(AuditPanel._sourceBucket('board-drag')).toBe('drag');
    AuditPanel.setSourceFilter('all');
  });
});

describe('per-profile timeout', () => {
  it('profile.timeoutMs reaches the transport; explicit call-site timeout wins', async () => {
    const { AI } = app;
    const captured = [];
    const orig = AI._request;
    AI._request = async (url, init, opts) => { captured.push(opts); return { choices: [{ message: { content: 'ok' } }] }; };
    try {
      const profile = { adapter: 'openai', baseUrl: 'http://x/v1', model: 'm', timeoutMs: 300000 };
      await AI.ADAPTERS.openai.chat(profile, [{ role: 'user', content: 'hi' }], {});
      expect(captured[0].timeoutMs).toBe(300000);
      await AI.ADAPTERS.openai.chat(profile, [{ role: 'user', content: 'hi' }], { timeoutMs: 5000 });
      expect(captured[1].timeoutMs).toBe(5000);
    } finally {
      AI._request = orig;
    }
  });
});
