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

// WS-E hardening R11 — the three exporters re-routed through the single print
// path (Reports.open) must still emit a report_generated audit entry, per the
// contract comment above Reports.recordExport. A customer-facing roadmap that
// leaves no audit trace is the regression this guards against.
describe('R11 — re-routed Reports.open call-sites still audit', () => {
  it('Gantt.exportCustomerRoadmap records customer_roadmap scoped to the customer', async () => {
    const p = makeProject({
      customer: 'Acme Industries',
      start_date: '2026-06-01', target_date: '2026-09-01'
    });
    const app = await loadApp(makeDataset({
      projects: [p],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.data.audit_log = [];
    app.Reports.open = () => ({}); // pop-up allowed
    app.Gantt.exportCustomerRoadmap();
    const entry = app.App.data.audit_log.find(e => e.event_type === 'report_generated');
    expect(entry).toBeTruthy();
    expect(entry.meta.report_type).toBe('customer_roadmap');
    expect(entry.meta.scope_arg).toBe('Acme Industries');
    // …and it surfaces in the hub's Recent exports with a friendly title.
    expect(app.ReportsHub._recentHtml('Acme Industries')).toContain('Customer roadmap');
    app.teardown();
  });

  it('Gantt.exportPDF records gantt_pdf scoped to the active customer', async () => {
    const p = makeProject({
      customer: 'Acme Industries',
      start_date: '2026-06-01', target_date: '2026-09-01'
    });
    const app = await loadApp(makeDataset({
      projects: [p],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.data.audit_log = [];
    app.Reports.open = () => ({});
    app.Gantt.exportPDF();
    const entry = app.App.data.audit_log.find(e => e.event_type === 'report_generated');
    expect(entry).toBeTruthy();
    expect(entry.meta.report_type).toBe('gantt_pdf');
    expect(entry.meta.scope_arg).toBe('Acme Industries');
    expect(app.ReportsHub._recentHtml('Acme Industries')).toContain('Gantt timeline (PDF)');
    app.teardown();
  });

  it('WireframeSkill.exportPrint records wireframe scoped to the wireframe customer', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    const def = app.Definitions.loadJson('tableau/wireframe-definition.json');
    const wf = app.Wireframe.create({ customer: 'Acme Industries', definition: def, name: 'Audit concept' });
    app.WireframeSkill._wfId = wf.id;
    // exportPrint serializes the live canvas SVG — give it one.
    const svg = app.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'wfCanvas';
    app.document.body.appendChild(svg);
    app.App.data.audit_log = [];
    app.Reports.open = () => ({});
    app.WireframeSkill.exportPrint();
    const entry = app.App.data.audit_log.find(e => e.event_type === 'report_generated');
    expect(entry).toBeTruthy();
    expect(entry.meta.report_type).toBe('wireframe');
    expect(entry.meta.scope_arg).toBe('Acme Industries');
    expect(app.ReportsHub._recentHtml('Acme Industries')).toContain('Wireframe');
    app.teardown();
  });

  it('blocked pop-up (Reports.open falsy) records no audit entry for any of the three', async () => {
    const p = makeProject({
      customer: 'Acme Industries',
      start_date: '2026-06-01', target_date: '2026-09-01'
    });
    const app = await loadApp(makeDataset({
      projects: [p],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    const def = app.Definitions.loadJson('tableau/wireframe-definition.json');
    const wf = app.Wireframe.create({ customer: 'Acme Industries', definition: def, name: 'Blocked concept' });
    app.WireframeSkill._wfId = wf.id;
    const svg = app.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'wfCanvas';
    app.document.body.appendChild(svg);
    app.App.data.audit_log = [];
    app.Reports.open = () => null; // pop-up blocked — nothing was exported
    app.Gantt.exportCustomerRoadmap();
    app.Gantt.exportPDF();
    app.WireframeSkill.exportPrint();
    expect(app.App.data.audit_log.filter(e => e.event_type === 'report_generated')).toHaveLength(0);
    app.teardown();
  });
});
