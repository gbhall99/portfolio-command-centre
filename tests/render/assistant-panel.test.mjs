// WS7 — render snapshots for the Assistant panel states.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

describe('Assistant panel render', () => {
  it('no-AI connect state matches the snapshot', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.window.localStorage.removeItem(app.AI.STORAGE_KEY);
    app.Assistant.open();
    const html = app.document.getElementById('assistantBody').innerHTML;
    await expect(html).toMatchFileSnapshot('./__snapshots__/assistant-no-ai.html');
    app.teardown();
  });

  it('suggestion empty state (model connected) matches the snapshot', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.activeCustomer = 'Acme Industries';
    const id = app.AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    app.AI.setDefaultProfile(id);
    app.Assistant.open();
    const html = app.document.getElementById('assistantBody').innerHTML;
    await expect(html).toMatchFileSnapshot('./__snapshots__/assistant-suggestions.html');
    app.window.localStorage.removeItem(app.AI.STORAGE_KEY);
    app.teardown();
  });
});
