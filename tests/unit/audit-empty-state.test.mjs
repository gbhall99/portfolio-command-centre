// AuditPanel time-window empty state: when the log has entries but the selected
// window hides them all, the feed must offer a one-click way forward rather than
// dead-ending on "No activity matches your filters".

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

function feed() { return app.document.getElementById('auditFeed').innerHTML; }

describe('Activity feed empty-state guidance', () => {
  it('offers "Show all time" when entries fall outside the window', () => {
    const { App, AuditPanel } = app;
    App.data.audit_log = [
      { timestamp: daysAgo(30), projectName: 'Acme Alpha', field: 'status', oldValue: 'A', newValue: 'B', source: 'user' },
      { timestamp: daysAgo(20), projectName: 'Acme Alpha', field: 'rag_schedule', oldValue: 'green', newValue: 'amber', source: 'user' }
    ];
    AuditPanel.currentFilter = '7d'; AuditPanel.sourceFilter = 'all'; AuditPanel.searchText = '';
    AuditPanel.render();
    expect(feed()).toContain('Show all time');
    expect(feed()).toContain('2');               // count of out-of-window changes
    // Widening reveals the entries and clears the empty state.
    AuditPanel.widenToAll();
    expect(AuditPanel.currentFilter).toBe('all');
    expect(feed()).not.toContain('No activity');
    expect(feed()).toContain('Acme Alpha');
  });

  it('offers "Clear filters" when a source/search filter (not the window) hides everything', () => {
    const { App, AuditPanel } = app;
    App.data.audit_log = [
      { timestamp: daysAgo(1), projectName: 'Acme Alpha', field: 'status', oldValue: 'A', newValue: 'B', source: 'user' }
    ];
    AuditPanel.currentFilter = 'all'; AuditPanel.sourceFilter = 'ai'; AuditPanel.searchText = '';
    AuditPanel.render();
    expect(feed()).toContain('Clear filters');
    AuditPanel.clearFilters();
    expect(AuditPanel.sourceFilter).toBe('all');
    expect(feed()).toContain('Acme Alpha');
  });

  it('keeps the plain message when the log is genuinely empty', () => {
    const { App, AuditPanel } = app;
    App.data.audit_log = [];
    AuditPanel.render();
    expect(feed()).toContain('No activity recorded yet');
  });
});
