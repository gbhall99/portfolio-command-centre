import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function boot() {
  const app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [makeProject({
      id: 'P1',
      customer: 'Acme Industries',
      risks_register: [{ description: 'R', impact: 3, probability: 3, owner: 'A' }],
      issues_register: [{ id: 'i1', description: 'I', status: 'open', owner: 'A' }]
    })]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

describe('D2 RAID editor capture', () => {
  it('risk editor exposes a target_date input', async () => {
    const app = await boot();
    app.DetailPanel.open('P1');
    // Navigate to the RAID tab where risks are rendered
    if (app.DetailPanel.switchTab) app.DetailPanel.switchTab('raid');
    const raidPanel = app.document.querySelector('[data-dp-tab="raid"]');
    expect(raidPanel).toBeTruthy();
    expect(raidPanel.querySelector('[data-raid-field="target_date"]')).toBeTruthy();
    app.teardown();
  });

  it('issue editor exposes an opened_date input', async () => {
    const app = await boot();
    app.DetailPanel.open('P1');
    if (app.DetailPanel.switchTab) app.DetailPanel.switchTab('raid');
    const raidPanel = app.document.querySelector('[data-dp-tab="raid"]');
    expect(raidPanel).toBeTruthy();
    expect(raidPanel.querySelector('[data-raid-field="opened_date"]')).toBeTruthy();
    app.teardown();
  });

  it('new issue defaults opened_date to today', async () => {
    const app = await boot();
    const today = new Date().toISOString().split('T')[0];
    app.DetailPanel.open('P1');
    if (app.DetailPanel.switchTab) app.DetailPanel.switchTab('raid');
    // Trigger addIssue — this adds a second issue with today as opened_date
    app.DetailPanel.addIssue();
    const p = app.App.data.projects.find(pr => pr.id === 'P1');
    const newIssue = p.issues_register[p.issues_register.length - 1];
    expect(newIssue.opened_date).toBe(today);
    app.teardown();
  });

  it('risk target_date persists via onRiskChange', async () => {
    const app = await boot();
    app.DetailPanel.open('P1');
    if (app.DetailPanel.switchTab) app.DetailPanel.switchTab('raid');
    const raidPanel = app.document.querySelector('[data-dp-tab="raid"]');
    const input = raidPanel.querySelector('[data-raid-field="target_date"]');
    expect(input).toBeTruthy();
    // Simulate a change
    input.value = '2026-09-30';
    input.dispatchEvent(new app.window.Event('change'));
    const p = app.App.data.projects.find(pr => pr.id === 'P1');
    expect(p.risks_register[0].target_date).toBe('2026-09-30');
    app.teardown();
  });

  it('issue opened_date persists via onIssueChange', async () => {
    const app = await boot();
    app.DetailPanel.open('P1');
    if (app.DetailPanel.switchTab) app.DetailPanel.switchTab('raid');
    const raidPanel = app.document.querySelector('[data-dp-tab="raid"]');
    const input = raidPanel.querySelector('[data-raid-field="opened_date"]');
    expect(input).toBeTruthy();
    // Simulate a change
    input.value = '2026-01-15';
    input.dispatchEvent(new app.window.Event('change'));
    const p = app.App.data.projects.find(pr => pr.id === 'P1');
    expect(p.issues_register[0].opened_date).toBe('2026-01-15');
    app.teardown();
  });
});
