// WS2 — Assistant panel: no-AI empty state, customer-scoped threads,
// grounded Q&A with citations, confirmation-gated proposal cards.
// Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [
      makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', status: 'At Risk' }),
      makeProject({ id: 'G-1', name: 'Globex Gamma', customer: 'Globex' })
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function configureMock() {
  const { AI } = app;
  const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock', toolMode: 'native' });
  AI.setDefaultProfile(id);
  return id;
}

describe('no-AI mode', () => {
  it('shows the connect-a-model empty state and leaves the app functional', () => {
    const { Assistant, AI, window, document } = app;
    // "No AI" = explicitly emptied profiles (a fresh install seeds Ollama).
    window.localStorage.setItem(AI.STORAGE_KEY, JSON.stringify({ profiles: [], defaultProfileId: null, taskDefaults: {} }));
    Assistant.open();
    const body = document.getElementById('assistantBody');
    expect(body.textContent).toContain('Connect a model');
    expect(body.innerHTML).toContain("App.openConfigCategory('ai')");
    // The panel is open and ARIA state tracks it.
    expect(document.getElementById('assistantPanel').classList.contains('open')).toBe(true);
    expect(document.getElementById('assistantPanel').getAttribute('aria-hidden')).toBe('false');
    Assistant.close();
    expect(document.getElementById('assistantPanel').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('grounded Q&A', () => {
  it('sends a message, renders the answer and clickable citations', async () => {
    const { AI, Assistant, document } = app;
    configureMock();
    AI.ADAPTERS.mock.program([
      { toolCalls: [{ id: 'c1', name: 'list_projects', args: { status: 'At Risk' } }] },
      { text: 'Acme Alpha is at risk because schedule is slipping.' }
    ]);
    Assistant.open();
    document.getElementById('assistantInput').value = 'what is at risk?';
    await Assistant.send();
    const body = document.getElementById('assistantBody');
    expect(body.textContent).toContain('Acme Alpha is at risk because schedule is slipping.');
    const cite = body.querySelector('.assistant-cite');
    expect(cite).not.toBeNull();
    expect(cite.textContent).toBe('Acme Alpha');
    expect(cite.getAttribute('title')).toBe('Open project');
    // Clicking the chip opens the project detail panel.
    cite.click();
    expect(document.getElementById('detailPanel').classList.contains('open')).toBe(true);
  });

  it('threads are customer-scoped: switching customer swaps the conversation', async () => {
    const { AI, Assistant, App, document } = app;
    configureMock();
    AI.ADAPTERS.mock.program([{ text: 'Answer for Acme.' }]);
    Assistant.open();
    document.getElementById('assistantInput').value = 'hello';
    await Assistant.send();
    expect(document.getElementById('assistantBody').textContent).toContain('Answer for Acme.');
    App.setActiveCustomer('Globex');
    const body = document.getElementById('assistantBody');
    expect(body.textContent).not.toContain('Answer for Acme.');
    expect(document.getElementById('assistantScope').textContent).toBe('Globex');
    // Switching back restores the original thread.
    App.setActiveCustomer('Acme Industries');
    expect(document.getElementById('assistantBody').textContent).toContain('Answer for Acme.');
  });

  it('renders provider failures as an inline error message, not a crash', async () => {
    const { AI, Assistant, document } = app;
    configureMock();
    AI.ADAPTERS.mock.program([]); // empty queue -> mock throws
    Assistant.open();
    document.getElementById('assistantInput').value = 'hi';
    await Assistant.send();
    const err = document.querySelector('#assistantBody .assistant-msg.error');
    expect(err).not.toBeNull();
    expect(err.textContent.length).toBeGreaterThan(5);
  });
});

describe('proposal cards', () => {
  async function proposeStatusChange() {
    const { AI, Assistant, document } = app;
    configureMock();
    AI.ADAPTERS.mock.program([
      { toolCalls: [{ id: 'c1', name: 'update_project_field', args: { project_id: 'A-1', field: 'status', value: 'On Hold', reason: 'data blocked' } }] },
      { text: 'I proposed putting Acme Alpha on hold.' }
    ]);
    Assistant.open();
    document.getElementById('assistantInput').value = 'put alpha on hold';
    await Assistant.send();
  }

  it('renders a diff card; Confirm applies through App and marks it applied', async () => {
    await proposeStatusChange();
    const { Assistant, App, document } = app;
    const card = document.querySelector('#assistantBody .assistant-proposal');
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('Update status on “Acme Alpha”');
    expect(card.textContent).toContain('data blocked');
    expect(card.querySelector('.old-val').textContent).toBe('At Risk');
    expect(card.querySelector('.new-val').textContent).toBe('On Hold');
    expect(App.data.projects.find(p => p.id === 'A-1').status).toBe('At Risk');
    const idx = Array.from(document.querySelectorAll('#assistantBody > *')).indexOf(card);
    // Confirm via the module API (same path as the button onclick).
    const items = Assistant._items();
    const propIdx = items.findIndex(i => i.kind === 'proposal');
    Assistant.confirmProposal(propIdx);
    expect(App.data.projects.find(p => p.id === 'A-1').status).toBe('On Hold');
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'status')).toBe(true);
    const applied = document.querySelector('#assistantBody .assistant-proposal.applied');
    expect(applied).not.toBeNull();
    expect(applied.textContent).toContain('Applied');
  });

  it('Discard never touches the data and cannot be re-applied', async () => {
    await proposeStatusChange();
    const { Assistant, App, document } = app;
    const items = Assistant._items();
    const propIdx = items.findIndex(i => i.kind === 'proposal');
    Assistant.discardProposal(propIdx);
    expect(App.data.projects.find(p => p.id === 'A-1').status).toBe('At Risk');
    expect(document.querySelector('#assistantBody .assistant-proposal.discarded')).not.toBeNull();
    // A discarded proposal is inert.
    Assistant.confirmProposal(propIdx);
    expect(App.data.projects.find(p => p.id === 'A-1').status).toBe('At Risk');
  });
});

describe('XSS hygiene', () => {
  it('model output and project names are escaped in the transcript', async () => {
    const { AI, Assistant, App, document } = app;
    App.data.projects[0].name = '<img src=x onerror=alert(1)>';
    configureMock();
    AI.ADAPTERS.mock.program([
      { toolCalls: [{ id: 'c1', name: 'list_projects', args: {} }] },
      { text: '<script>alert("xss")<\/script> done' }
    ]);
    Assistant.open();
    document.getElementById('assistantInput').value = 'list';
    await Assistant.send();
    const body = document.getElementById('assistantBody');
    expect(body.querySelector('script')).toBeNull();
    expect(body.querySelector('img')).toBeNull();
    expect(body.textContent).toContain('done');
  });
});
