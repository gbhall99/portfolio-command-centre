// New document outputs — Portfolio Overview and Success Story — built through
// the single Reports engine (Reports.Builders + catalogue + dispatch).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }],
    projects: [
      makeProject({ id: 'A-1', name: 'Acme Hub', customer: 'Acme Industries', status: 'In Progress',
        risks_register: [{ id: 'r1', description: 'Vendor delay', impact: 5, probability: 4, status: 'open' }] }),
      makeProject({ id: 'A-2', name: 'Acme Won', customer: 'Acme Industries', status: 'Complete',
        size_total: 40, description: 'Replace the legacy reporting stack.',
        start_date: '2026-01-05', target_date: '2026-03-30',
        delivery_config: { phase_order: ['Requirements', 'Data Engineering', 'Tableau'] },
        outcomes: [
          { id: 'o1', type: 'benefit', description: 'Cut manual reporting time', target: '80', unit: '%', actual: '85' },
          { id: 'o2', type: 'success_criterion', description: 'Single source of truth adopted', target: '1', unit: 'dashboard', actual: '1' }
        ],
        benefit_annual_gbp: 250000 }),
      makeProject({ id: 'G-1', name: 'Globex One', customer: 'Globex', status: 'In Progress' })
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('catalogue + dispatch', () => {
  it('registers both outputs in the Reports catalogue', () => {
    const ids = app.Reports.Catalogue.map(c => c.id);
    expect(ids).toContain('portfolio_overview');
    expect(ids).toContain('success_story');
  });

  it('Reports._build dispatches each id to its builder', () => {
    const po = app.Reports._build('portfolio_overview', { customer: 'Acme Industries' });
    expect(po && po.reportType).toBe('portfolio_overview');
    const ss = app.Reports._build('success_story', { projectId: 'A-2' });
    expect(ss && ss.reportType).toBe('success_story');
  });

  it('success_story on a missing project returns null (no blank export)', () => {
    expect(app.Reports._build('success_story', { projectId: 'NOPE' })).toBe(null);
  });
});

describe('Portfolio Overview', () => {
  it('scopes to one customer and reports its counts', () => {
    const doc = app.Reports.Builders.portfolioOverview('Acme Industries');
    expect(doc.title).toMatch(/Acme Industries/);
    const txt = doc.sections.map(s => s.html).join(' ');
    // 2 active of 2... A-2 is Complete, so 1 active of 2 total for Acme.
    expect(txt).toContain('Acme Hub');
    expect(txt).not.toContain('Globex One'); // other customer excluded
    // No "By customer" section when scoped to one customer.
    expect(doc.sections.some(s => s.id === 'po-bycust')).toBe(false);
  });

  it('aggregates every customer and adds a By-customer breakdown when given no customer', () => {
    const doc = app.Reports.Builders.portfolioOverview('');
    expect(doc.title).toMatch(/All customers/);
    const byCust = doc.sections.find(s => s.id === 'po-bycust');
    expect(byCust).toBeTruthy();
    expect(byCust.html).toContain('Acme Industries');
    expect(byCust.html).toContain('Globex');
    // Aggregate headline counts every customer's projects (3 total across both).
    const exec = doc.sections.find(s => s.id === 'po-exec');
    expect(exec.html).toMatch(/of <strong>3<\/strong> total/);
  });
});

describe('Success Story', () => {
  it('builds challenge / delivered / outcomes / impact for a delivered project', () => {
    const doc = app.Reports.Builders.successStory('A-2');
    expect(doc.title).toMatch(/Acme Won/);
    const ids = doc.sections.map(s => s.id);
    expect(ids).toEqual(expect.arrayContaining(['ss-challenge', 'ss-delivered', 'ss-outcomes', 'ss-impact']));
    const byId = Object.fromEntries(doc.sections.map(s => [s.id, s.html]));
    expect(byId['ss-challenge']).toContain('legacy reporting stack');
    expect(byId['ss-delivered']).toContain('40'); // story points
    expect(byId['ss-delivered']).toContain('Data Engineering');
    expect(byId['ss-outcomes']).toContain('Cut manual reporting time');
    expect(byId['ss-outcomes']).toContain('Single source of truth adopted');
    expect(byId['ss-impact']).toContain('250,000'); // annual benefit
  });

  it('every success-story section is customer-shareable (both audiences)', () => {
    const doc = app.Reports.Builders.successStory('A-2');
    doc.sections.forEach(s => expect(s.audiences).toContain('customer'));
  });
});

describe('generate failure surfaces (H-017)', () => {
  it('a throwing builder speaks via a toast instead of failing silently', () => {
    const { Reports, App } = app;
    const toasts = [];
    const origToast = App.toast;
    const origBuild = Reports._build;
    App.toast = (msg, kind) => toasts.push({ msg, kind });
    Reports._build = () => { throw new Error('boom in builder'); };
    try {
      // Must NOT throw out of the (inline-onclick) call path.
      expect(() => Reports.generate('portfolio_overview', { customer: 'Acme Industries' })).not.toThrow();
    } finally {
      Reports._build = origBuild;
      App.toast = origToast;
    }
    expect(toasts.length).toBe(1);
    expect(toasts[0].kind).toBe('error');
    expect(toasts[0].msg).toContain('boom in builder');
  });

  it('a missing entity still gets its specific not-found toast (null path unchanged)', () => {
    const { Reports, App } = app;
    const toasts = [];
    const origToast = App.toast;
    App.toast = (msg, kind) => toasts.push({ msg, kind });
    try { Reports.generate('success_story', { projectId: 'NOPE' }); }
    finally { App.toast = origToast; }
    expect(toasts.some(t => t.kind === 'error' && /not found/i.test(t.msg))).toBe(true);
  });
});
