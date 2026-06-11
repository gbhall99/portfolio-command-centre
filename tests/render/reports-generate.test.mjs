import { describe, it, expect, vi } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Reports.open + Reports.generate', () => {
  it('open writes HTML to a new window and records nothing by itself', async () => {
    const app = await loadApp(makeDataset({}));
    const writes = [];
    const fakeWin = { document: { write: (s) => writes.push(s), close() {} } };
    app.window.open = () => fakeWin;
    app.Reports.open('<!DOCTYPE html><html><body>hi</body></html>');
    expect(writes.join('')).toContain('hi');
    app.teardown();
  });
  it('generate looks up the catalogue, builds, serializes, opens, and audits', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1' }],
      projects: [makeProject({ id: 'P1', name: 'Proj', customer: 'Acme Industries', status: 'In Progress' })]
    }));
    app.App.activeCustomer = 'Acme Industries';
    const writes = [];
    app.window.open = () => ({ document: { write: (s) => writes.push(s), close() {} } });
    const before = (app.App.data.audit_log || []).length;
    app.Reports.generate('portfolio_pack', { customer: 'Acme Industries', audience: 'internal' });
    expect(writes.join('')).toMatch(/^<!DOCTYPE html>/);
    expect((app.App.data.audit_log || []).length).toBe(before + 1);
    app.teardown();
  });
});
