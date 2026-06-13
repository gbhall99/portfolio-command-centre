import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function boot() {
  const app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [makeProject({ id: 'P1', name: 'Proj One', customer: 'Acme Industries', status: 'In Progress' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

describe('Reports.Catalogue — consolidated registry metadata (E3)', () => {
  it('status_report is customer-scoped and skill-fed; every entry carries audiences + contentSource', async () => {
    const app = await boot();
    const byId = Object.fromEntries(app.Reports.Catalogue.map(c => [c.id, c]));
    expect(byId.status_report.scope).toBe('customer');
    expect(byId.status_report.requiresScopeArg).toBe('customer');
    expect(byId.status_report.contentSource).toBe('skill-fed');
    app.Reports.Catalogue.forEach(c => {
      expect(Array.isArray(c.audiences)).toBe(true);
      expect(c.audiences.length).toBeGreaterThan(0);
      expect(['data-derived', 'skill-fed']).toContain(c.contentSource);
    });
    // Audience split per the spec table.
    expect(byId.sponsor_pack.audiences).toEqual(['customer', 'internal']);
    expect(byId.portfolio_pack.audiences).toEqual(['customer', 'internal']);
    expect(byId.status_report.audiences).toEqual(['customer', 'internal']);
    expect(byId.sprint_brief.audiences).toEqual(['internal']);
    expect(byId.meeting_agenda.audiences).toEqual(['internal']);
    expect(byId.costs_report.audiences).toEqual(['internal']);
    app.teardown();
  });
});

describe('ReportsHub — Documents hub view', () => {
  it('renders one card per consolidated catalogue entry, customer-scoped, with Recent exports', async () => {
    const app = await boot();
    app.ReportsHub.render();
    const host = app.document.getElementById('reportsHubHost');
    expect(host).toBeTruthy();
    const html = host.innerHTML;
    for (const title of ['Project report', 'Portfolio report', 'Sprint brief', 'Meeting agenda', 'Status report', 'Costs report']) {
      expect(html).toContain(title);
    }
    // Absorbed audience-variant entries do not appear as standalone cards.
    expect(html).not.toContain('Customer Pack');
    expect(html).not.toContain('Business Case');
    // Recent exports list present.
    expect(html).toContain('Recent exports');
    // Customer-scoped: the active customer name appears.
    expect(html).toContain('Acme Industries');
    app.teardown();
  });

  it('shows audience chips only where the entry offers both audiences', async () => {
    const app = await boot();
    app.ReportsHub.render();
    const host = app.document.getElementById('reportsHubHost');
    const cards = Array.from(host.querySelectorAll('[data-hub-card]'));
    expect(cards.length).toBe(8);
    const cardFor = (title) => cards.find(c => c.querySelector('.hub-card-title').textContent === title);
    const multi = cardFor('Portfolio report');
    expect(multi.querySelectorAll('.hub-aud-chip').length).toBe(2);
    expect(multi.textContent).toContain('Customer-facing');
    expect(multi.textContent).toContain('Internal');
    const single = cardFor('Costs report');
    expect(single.querySelectorAll('.hub-aud-chip').length).toBe(1);
    expect(single.textContent).toContain('Internal');
    app.teardown();
  });

  it('Generate routes through Reports.generate with the active customer + chosen audience', async () => {
    const app = await boot();
    app.ReportsHub.render();
    const calls = [];
    const orig = app.Reports.generate;
    app.Reports.generate = (id, args) => { calls.push([id, args]); };
    try {
      const host = app.document.getElementById('reportsHubHost');
      const cards = Array.from(host.querySelectorAll('[data-hub-card]'));
      const portfolio = cards.find(c => c.querySelector('.hub-card-title').textContent === 'Portfolio report');
      portfolio.querySelector('.hub-generate-btn').click();
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('portfolio_pack');
      expect(calls[0][1].customer).toBe('Acme Industries');
      expect(['customer', 'internal']).toContain(calls[0][1].audience);
    } finally {
      app.Reports.generate = orig;
    }
    app.teardown();
  });

  it('Status report card generates a customer-scoped document with a truthful audit scope', async () => {
    const app = await loadApp(makeDataset({
      customers: [
        { name: 'Acme Industries', color: '#6366f1' },
        { name: 'Globex', color: '#0ea5e9' }
      ],
      projects: [
        makeProject({ id: 'A1', name: 'Acme Alpha', customer: 'Acme Industries', status: 'At Risk' }),
        makeProject({ id: 'G1', name: 'Globex Secret', customer: 'Globex', status: 'Blocked' })
      ]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.ReportsHub.render();
    const writes = [];
    app.window.open = () => ({ document: { write: (s) => writes.push(s), close() {} } });
    const host = app.document.getElementById('reportsHubHost');
    const cards = Array.from(host.querySelectorAll('[data-hub-card]'));
    const status = cards.find(c => c.querySelector('.hub-card-title').textContent === 'Status report');
    status.querySelector('.hub-generate-btn').click();
    const html = writes.join('');
    // Customer-scoped: the active customer's data only — never the rest of the portfolio.
    expect(html).toContain('Acme Alpha');
    expect(html).not.toContain('Globex Secret');
    // The audit scope_arg now truthfully describes a customer-scoped export.
    const entries = (app.App.data.audit_log || []).filter(e => e.event_type === 'report_generated');
    expect(entries.length).toBe(1);
    expect(entries[0].meta.report_type).toBe('status_report');
    expect(entries[0].meta.scope_arg).toBe('Acme Industries');
    app.teardown();
  });

  it('navigating to the reports view renders the hub', async () => {
    const app = await boot();
    app.App.navigate('reports');
    const view = app.document.getElementById('viewReports');
    expect(view).toBeTruthy();
    expect(view.classList.contains('active')).toBe(true);
    expect(app.document.getElementById('reportsHubHost').innerHTML).toContain('Project report');
    app.teardown();
  });
});
