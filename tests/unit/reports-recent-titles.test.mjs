// WS-E Task 14 (final verification tweak) — Recent exports must always show
// friendly document titles, never raw report ids. Two halves:
//   1. Reports.generate normalizes alias report ids (project_report /
//      portfolio_report) to canonical Catalogue ids before recordExport, so
//      the audit log keys match Catalogue titles.
//   2. ReportsHub._recentHtml has friendly fallbacks for the non-catalogue
//      export types other surfaces record (sow, walkthrough_minutes, ...).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Recent exports — canonical ids + friendly titles', () => {
  it('Reports.generate records canonical catalogue ids for alias report ids', async () => {
    const p = makeProject({ customer: 'Acme Industries' });
    const app = await loadApp(makeDataset({
      projects: [p],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.data.audit_log = [];
    app.Reports.generate('portfolio_report', { customer: 'Acme Industries', audience: 'internal' });
    app.Reports.generate('portfolio_report', { customer: 'Acme Industries', audience: 'customer' });
    app.Reports.generate('project_report', { projectId: p.id, audience: 'internal' });
    const types = app.App.data.audit_log
      .filter(e => e.event_type === 'report_generated')
      .map(e => e.meta.report_type);
    expect(types).toEqual(['portfolio_pack', 'customer_pack', 'sponsor_pack']);
    app.teardown();
  });

  it('Reports.generate records the most specific matchable scope_arg (project beats customer)', async () => {
    const p = makeProject({ customer: 'Acme Industries' });
    const app = await loadApp(makeDataset({
      projects: [p],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.data.audit_log = [];
    // The hub passes BOTH customer and projectId for project-scoped reports —
    // the project id is the scope, not the customer.
    app.Reports.generate('sponsor_pack', { customer: 'Acme Industries', projectId: p.id, audience: 'internal' });
    const entry = app.App.data.audit_log.find(e => e.event_type === 'report_generated');
    expect(entry.meta.scope_arg).toBe(p.id);
    // …and it must therefore match the Recent filter via the project set.
    const html = app.ReportsHub._recentHtml('Acme Industries');
    expect(html).toContain('Project report');
    app.teardown();
  });

  it('walkthrough_minutes scopes to the walkthrough customer and surfaces in Recent', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.data.walkthroughs = [{
      id: 'wt_test_1', customer: 'Acme Industries',
      started_at: '2026-06-10T09:00:00Z', completed_at: '2026-06-10T10:00:00Z',
      attendees: [], section_notes: {}, section_status: {}, decisions: [], actions: [], minutes_html: null
    }];
    app.App.data.audit_log = [];
    app.Reports.generate('walkthrough_minutes', { walkthroughId: 'wt_test_1' });
    const entry = app.App.data.audit_log.find(e => e.event_type === 'report_generated');
    // A walkthrough id is in no matchable set — the customer is the scope; the
    // walkthrough id is preserved in its own meta field.
    expect(entry.meta.scope_arg).toBe('Acme Industries');
    expect(entry.meta.walkthrough_id).toBe('wt_test_1');
    const html = app.ReportsHub._recentHtml('Acme Industries');
    expect(html).toContain('Walkthrough minutes');
    app.teardown();
  });

  it('portfolio-wide status report (no customer arg) scopes to the active customer', async () => {
    const p = makeProject({ customer: 'Acme Industries' });
    const app = await loadApp(makeDataset({
      projects: [p],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.data.audit_log = [];
    // The internal Status Report toolbar button passes no customer at all.
    app.Reports.generate('status_report', { audience: 'internal' });
    const entry = app.App.data.audit_log.find(e => e.event_type === 'report_generated');
    expect(entry.meta.scope_arg).toBe('Acme Industries');
    const html = app.ReportsHub._recentHtml('Acme Industries');
    expect(html).toContain('Status report');
    app.teardown();
  });

  it('ReportsHub._recentHtml renders friendly titles for non-catalogue export types', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.data.audit_log = [
      { ts: '2026-06-11T10:00:00Z', event_type: 'report_generated', meta: { report_type: 'sow', scope_arg: 'Acme Industries', generated_by: 'app' } },
      { ts: '2026-06-11T11:00:00Z', event_type: 'report_generated', meta: { report_type: 'walkthrough_minutes', scope_arg: 'Acme Industries', generated_by: 'app' } }
    ];
    const html = app.ReportsHub._recentHtml('Acme Industries');
    expect(html).toContain('SOW');
    expect(html).toContain('Walkthrough minutes');
    expect(html).not.toContain('walkthrough_minutes');
    app.teardown();
  });
});
