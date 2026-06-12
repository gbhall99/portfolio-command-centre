import { describe, it, expect } from 'vitest';
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
  it('generate clamps audience to the catalogue entry’s declared audiences (internal-only report + audience:customer must not export a cover-only "Internal — shared" PDF)', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1' }],
      projects: [makeProject({ id: 'P1', name: 'Proj', customer: 'Acme Industries', status: 'In Progress' })]
    }));
    app.App.activeCustomer = 'Acme Industries';
    const writes = [];
    app.window.open = () => ({ document: { write: (s) => writes.push(s), close() {} } });
    // costs_report declares audiences:['internal'] in the Catalogue — a
    // 'customer' arg (reachable via the generate API / future deep links)
    // must fall back to a declared audience, not strip every section.
    app.Reports.generate('costs_report', { customer: 'Acme Industries', audience: 'customer' });
    const html = writes.join('');
    expect(html).toContain('<div class="rp-section" id='); // sections survived the audience filter
    expect(html).not.toContain('— shared');             // no contradictory 'Internal — shared' cover line
    app.teardown();
  });
  it('generate still honours a declared customer audience (portfolio_pack)', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1' }],
      projects: [makeProject({ id: 'P1', name: 'Proj', customer: 'Acme Industries', status: 'In Progress' })]
    }));
    app.App.activeCustomer = 'Acme Industries';
    const writes = [];
    app.window.open = () => ({ document: { write: (s) => writes.push(s), close() {} } });
    app.Reports.generate('portfolio_pack', { customer: 'Acme Industries', audience: 'customer' });
    const html = writes.join('');
    expect(html).toContain('<div class="rp-section" id=');
    expect(html).toContain('— shared'); // customer is a declared audience — shared suffix stays
    app.teardown();
  });
  it('generate does NOT audit when the pop-up is blocked (open returns null)', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1' }],
      projects: [makeProject({ id: 'P1', name: 'Proj', customer: 'Acme Industries', status: 'In Progress' })]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.window.open = () => null; // simulate browser pop-up blocker
    const before = (app.App.data.audit_log || []).length;
    app.Reports.generate('portfolio_pack', { customer: 'Acme Industries', audience: 'internal' });
    // the export never happened, so no report_generated entry may be persisted
    expect((app.App.data.audit_log || []).length).toBe(before);
    app.teardown();
  });
});
