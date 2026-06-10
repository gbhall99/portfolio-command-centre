// Billing layer: sell rates, prepaid/fixed arrangement drawdown, customer +
// project reporting, quote generation with prepaid netting, migration.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

function fixture() {
  resetIdSeq();
  return makeDataset({
    projects: [
      // 10 SP DE complete, 5 SP Tableau complete.
      makeProject({
        id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries',
        size_engineering: 20, size_tableau: 10,
        skill_splits: {
          size_engineering: [{ sprint: 'CY26-S1', points: 10, status: 'complete', completed: 10, assigned_to: [], reasons: [] }],
          size_tableau: [{ sprint: 'CY26-S1', points: 8, status: 'in_progress', completed: 5, assigned_to: [], reasons: [] }]
        }
      }),
      // 6 SP DE complete on a second project.
      makeProject({
        id: 'A-2', name: 'Acme Beta', customer: 'Acme Industries',
        size_engineering: 12,
        skill_splits: {
          size_engineering: [{ sprint: 'CY26-S1', points: 6, status: 'complete', completed: 6, assigned_to: [], reasons: [] }]
        }
      }),
      // Other customer — must never appear in Acme's numbers.
      makeProject({
        id: 'G-1', name: 'Globex Gamma', customer: 'Globex',
        size_engineering: 10,
        skill_splits: {
          size_engineering: [{ sprint: 'CY26-S1', points: 10, status: 'complete', completed: 10, assigned_to: [], reasons: [] }]
        }
      })
    ],
    settings: {
      rate_card: { size_engineering: { perm: 500 }, size_tableau: { perm: 400 } },
      billing: {
        currency: 'GBP', hours_per_point: 8,
        rate_table: { EMEA: { Consultant: 100, Principal: 150 } },
        customer_defaults: { 'Acme Industries': { region: 'EMEA', level: 'Consultant' }, 'Globex': { region: 'EMEA', level: 'Consultant' } }
      }
    }
  });
}

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('migration + settings', () => {
  it('legacy datasets gain billing_arrangements and billing settings', async () => {
    resetIdSeq();
    const legacy = makeDataset({ projects: [makeProject()] });
    delete legacy.billing_arrangements;
    const a2 = await loadApp(legacy);
    expect(Array.isArray(a2.App.data.billing_arrangements)).toBe(true);
    expect(a2.App.data.settings.billing.currency).toBe('GBP');
    expect(a2.App.data.settings.billing.rate_table).toEqual({});
    expect(a2.App.data.settings.billing.customer_defaults).toEqual({});
    expect(a2.App.data.settings.billing.hours_per_point).toBe(8);
    a2.teardown();
  });
});

describe('pure T&M (no arrangements)', () => {
  it('bills completed work as hours at the default band and reports margin vs internal cost', () => {
    const { Billing } = app;
    // 1 SP = 8h at EMEA/Consultant £100/h => £800 per SP.
    const s = Billing.customerSummary('Acme Industries');
    expect(s.projects.map(r => r.id)).toEqual(['A-1', 'A-2']);
    const a1 = s.projects[0];
    expect(a1.consumed_points).toBe(15);
    expect(a1.prepaid_covered_points).toBe(0);
    expect(a1.billable_amount).toBe(15 * 8 * 100);   // 12000
    expect(a1.by_skill.size_engineering.billable_hours).toBe(80);
    expect(a1.by_skill.size_engineering.hourly_rate).toBe(100);
    expect(a1.cost).toBe(10 * 500 + 5 * 400);        // EV cost 7000
    expect(a1.margin).toBe(12000 - 7000);
    expect(s.totals.billable_amount).toBe(12000 + 6 * 8 * 100);
    expect(s.totals.fixed_invoiced).toBe(0);
  });

  it('work done by a member with a rate band bills at that band (blended per skill)', () => {
    const { Billing, App } = app;
    // Make the A-2 split attributable to a Principal (£150/h).
    App.data.team_members.push({ name: 'Pat', customer: 'Acme Industries', region: 'EMEA', level: 'Principal', primary_skills: ['Data Engineering'], available_points_per_sprint: 10 });
    App.data.projects.find(p => p.id === 'A-2').skill_splits.size_engineering[0].assigned_to = [{ member: 'Pat', points: 6 }];
    const s = Billing.customerSummary('Acme Industries');
    const a2 = s.projects.find(r => r.id === 'A-2');
    expect(a2.by_skill.size_engineering.hourly_rate).toBe(150);
    expect(a2.billable_amount).toBe(6 * 8 * 150);
  });
});

describe('prepaid drawdown', () => {
  it('skill-specific prepaid covers first; remainder bills as T&M; pools never go negative', () => {
    const { Billing } = app;
    Billing.addArrangement({ customer: 'Acme Industries', label: 'DE retainer', skill: 'size_engineering', prepaid_points: 12, amount_invoiced: 9600 });
    const s = Billing.customerSummary('Acme Industries');
    // 16 DE points consumed total (10 + 6); 12 prepaid -> 4 billable DE + 5 billable Tab.
    const arr = s.arrangements[0];
    expect(arr.drawn_points).toBe(12);
    expect(arr.remaining_points).toBe(0);
    expect(s.totals.prepaid_covered_points).toBe(12);
    expect(s.totals.billable_points).toBe(9);
    expect(s.totals.billable_amount).toBe(9 * 8 * 100);
    // Revenue = T&M + drawdown at the implied prepaid rate (9600/12 = 800/SP).
    expect(s.totals.revenue).toBe(9 * 8 * 100 + 12 * 800);
    // Deterministic: A-1 (lower id) draws before A-2.
    expect(s.projects[0].prepaid_covered_points).toBe(10);
    expect(s.projects[1].prepaid_covered_points).toBe(2);
  });

  it('an "any" pool covers every skill and is isolated per customer', () => {
    const { Billing } = app;
    Billing.addArrangement({ customer: 'Acme Industries', label: 'Blanket retainer', skill: 'any', prepaid_points: 100, amount_invoiced: 50000 });
    const s = Billing.customerSummary('Acme Industries');
    expect(s.totals.prepaid_covered_points).toBe(21);  // everything covered
    expect(s.totals.billable_amount).toBe(0);
    expect(s.arrangements[0].remaining_points).toBe(79);
    // Globex is untouched by Acme's arrangement.
    const g = Billing.customerSummary('Globex');
    expect(g.totals.prepaid_covered_points).toBe(0);
    expect(g.totals.billable_amount).toBe(10 * 8 * 100);
  });

  it('skill-specific pools drain before "any" pools', () => {
    const { Billing } = app;
    Billing.addArrangement({ customer: 'Acme Industries', label: 'Any pool', skill: 'any', prepaid_points: 50, amount_invoiced: 0, start_date: '2026-01-01' });
    Billing.addArrangement({ customer: 'Acme Industries', label: 'DE pool', skill: 'size_engineering', prepaid_points: 10, amount_invoiced: 0, start_date: '2026-02-01' });
    const s = Billing.customerSummary('Acme Industries');
    const de = s.arrangements.find(a => a.skill === 'size_engineering');
    const any = s.arrangements.find(a => a.skill === 'any');
    expect(de.drawn_points).toBe(10);             // DE-specific drains fully first
    expect(any.drawn_points).toBe(6 + 5);         // remaining DE + all Tableau
  });

  it('arrangement CRUD is audited and undoable', () => {
    const { Billing, App } = app;
    const arr = Billing.addArrangement({ customer: 'Acme Industries', label: 'Retainer', skill: 'any', prepaid_points: 10, amount_invoiced: 5000 });
    expect(App.data.audit_log.some(e => e.field === 'billing_arrangement_added')).toBe(true);
    App.undo();
    expect(App.data.billing_arrangements.length).toBe(0);
    App.redo();
    expect(App.data.billing_arrangements.length).toBe(1);
    Billing.removeArrangement(App.data.billing_arrangements[0].id);
    expect(App.data.billing_arrangements.length).toBe(0);
    App.undo();
    expect(App.data.billing_arrangements.length).toBe(1);
  });
});

describe('project breakdown', () => {
  it('per-project numbers agree with the customer summary', () => {
    const { Billing } = app;
    Billing.addArrangement({ customer: 'Acme Industries', label: 'DE retainer', skill: 'size_engineering', prepaid_points: 12, amount_invoiced: 9600 });
    const s = Billing.customerSummary('Acme Industries');
    const b = Billing.projectBreakdown('A-2');
    expect(b).toEqual(s.projects.find(r => r.id === 'A-2'));
    expect(b.prepaid_covered_points).toBe(2);
    expect(b.billable_amount).toBe(4 * 8 * 100);
  });
});

describe('quoting (planned work, prepaid netting)', () => {
  it('quotes planned hours at the customer default band, netting only the REMAINING prepaid balance', () => {
    const { Billing, App } = app;
    // 12-point DE pool; 16 DE already consumed -> 0 remaining for the quote.
    Billing.addArrangement({ customer: 'Acme Industries', label: 'DE retainer', skill: 'size_engineering', prepaid_points: 12, amount_invoiced: 9600 });
    const newProj = { id: 'A-9', customer: 'Acme Industries', size_engineering: 10, size_tableau: 4 };
    let q = Billing.quoteForProject(newProj);
    expect(q.totals.points).toBe(14);
    expect(q.totals.prepaid_covered).toBe(0);   // pool already exhausted by consumed work
    expect(q.rate_band).toBe('EMEA / Consultant');
    expect(q.hourly_rate).toBe(100);
    expect(q.totals.hours).toBe(14 * 8);
    expect(q.totals.amount).toBe(14 * 8 * 100);
    // Top the pool up: 30 prepaid - 16 consumed = 14 remaining -> 10 DE covered.
    App.data.billing_arrangements[0].prepaid_points = 30;
    q = Billing.quoteForProject(newProj);
    const deLine = q.lines.find(l => l.skill === 'size_engineering');
    expect(deLine.prepaid_covered).toBe(10);
    expect(deLine.billable_points).toBe(0);
    expect(q.totals.amount).toBe(4 * 8 * 100);
  });

  it('quoteAsText renders hours, hourly rate, band basis and validity terms', () => {
    const { Billing } = app;
    Billing.addArrangement({ customer: 'Acme Industries', label: 'Pool', skill: 'any', prepaid_points: 100, amount_invoiced: 0 });
    const q = Billing.quoteForProject({ id: 'X', customer: 'Acme Industries', size_engineering: 8 });
    const text = Billing.quoteAsText(q);
    expect(text).toContain('Data Engineering: 8 SP');
    expect(text).toContain('covered by prepaid');
    expect(text).toContain('Rates basis: EMEA / Consultant');
    expect(text).toContain('/hour');
    expect(text).toContain('1 story point = 8 hours');
    expect(text).toContain('Prices hold for 30 days');
    expect(text).not.toMatch(/\d\.\d+ SP/);  // points stay integers
  });
});

describe('settings UI + report', () => {
  it('billing settings card renders rates, arrangements and the report control', () => {
    const { App, Billing, document } = app;
    Billing.addArrangement({ customer: 'Acme Industries', label: 'FY27 retainer', skill: 'any', prepaid_points: 40, amount_invoiced: 20000 });
    App.navigate('config');
    App.openConfigCategory('billing');
    const body = document.getElementById('configBody');
    expect(body.textContent).toContain('Hourly rate table');
    expect(body.textContent).toContain('Team rate bands');
    expect(body.textContent).toContain('Customer default band');
    expect(body.textContent).toContain('FY27 retainer');
    expect(body.textContent).toContain('Billing & Costs report');
    expect(body.querySelector('#billingReportCustomer')).not.toBeNull();
    // Rate edits go through the audited setter.
    Billing.setHourlyRate('EMEA', 'Principal', '175');
    expect(App.data.settings.billing.rate_table.EMEA.Principal).toBe(175);
    expect(App.data.audit_log.some(e => e.field === 'billing_rate:EMEA/Principal')).toBe(true);
  });

  it('exportReport writes a print document and logs report_generated', () => {
    const { Billing, App, window } = app;
    let written = '';
    window.open = () => ({ document: { write(h) { written += h; }, close() {} } });
    Billing.exportReport('Acme Industries');
    expect(written).toContain('Billing &amp; Costs — Acme Industries');
    expect(written).toContain('Projects (completed work to date)');
    expect(written).toContain('Margin');
    expect(App.data.audit_log.some(e => e.field === 'report_generated' && e.newValue === 'billing_costs:Acme Industries')).toBe(true);
  });
});
