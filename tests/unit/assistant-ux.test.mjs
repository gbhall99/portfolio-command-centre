// AS2 (proactive briefing), AS3 (visible tool steps) and AS4 (view-aware
// quick prompts) for the Assistant. Pure render/helper tests — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [makeProject({ id: 'A-1', name: 'Acme One', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

const recentStatusChange = () => ({
  timestamp: new Date().toISOString(), field: 'status', projectId: 'A-1',
  projectName: 'Acme One', oldValue: 'Not Started', newValue: 'In Progress', source: 'user'
});

describe('AS2 — proactive briefing', () => {
  it('produces no briefing when nothing changed and no deadlines loom', () => {
    expect(app.Assistant._computeBriefing()).toBe(null);
  });

  it('briefs on recent changes and renders a dismissible card', () => {
    app.App.data.audit_log.push(recentStatusChange());
    const d = app.Assistant._computeBriefing();
    expect(d).toBeTruthy();
    expect(d.counts.status).toBeGreaterThanOrEqual(1);
    const html = app.Assistant._briefingHtml(d);
    expect(html).toContain('Since last week');
    expect(html).toMatch(/status change/);
    expect(html).toContain('dismissBriefing');
  });

  it('dismissBriefing suppresses it for the current scope key', () => {
    app.App.data.audit_log.push(recentStatusChange());
    expect(app.Assistant._computeBriefing()).toBeTruthy();
    app.Assistant.dismissBriefing();
    expect(app.Assistant._briefDismissed[app.Assistant._customerKey()]).toBe(true);
  });
});

describe('AS3 — visible tool steps', () => {
  it('renders the chained tool names and marks failures', () => {
    const html = app.Assistant._traceHtml([{ tool: 'list_projects', ok: true }, { tool: 'get_project', ok: false }]);
    expect(html).toContain('list_projects');
    expect(html).toContain('get_project ✗');
    expect(app.Assistant._traceHtml([])).toBe('');
    expect(app.Assistant._traceHtml(undefined)).toBe('');
  });
});

describe('AS4 — view-aware quick prompts', () => {
  it('prepends a view-specific prompt for the current view', () => {
    app.App.currentView = 'raid';
    expect(app.Assistant._suggestions()[0]).toMatch(/RAID/i);
    app.App.currentView = 'capacity';
    expect(app.Assistant._suggestions()[0]).toMatch(/capacity/i);
  });

  it('offers a draft-SOW prompt when a project detail panel is open', () => {
    app.App.currentView = 'dashboard';
    app.DetailPanel.currentId = 'A-1';
    try {
      expect(app.Assistant._suggestions().some(s => /SOW for the project I have open/.test(s))).toBe(true);
    } finally { app.DetailPanel.currentId = null; }
  });

  it('uses the portfolio-wide prompt set under the All filter', () => {
    app.App.allCustomers = true; app.App.customerMode = false; app.App.currentView = 'dashboard';
    const s = app.Assistant._suggestions();
    expect(s.some(x => /across all customers|whole team|portfolio/i.test(x))).toBe(true);
  });
});
