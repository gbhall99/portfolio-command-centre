// Report-pack enhancements (R1–R9): Gantt pipeline section, exec KPI band,
// commercial summary, charts, milestone ribbon, call-outs, appendix, composer.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [
      makeProject({ id: 'A-1', name: 'Alpha', customer: 'Acme Industries', status: 'In Progress', manager: 'Dana', priority: 1,
        start_date: '2026-06-01', target_date: '2026-09-01', hard_deadline: '2026-08-20', rag_schedule: 'Amber', size_total: 8 }),
      makeProject({ id: 'A-2', name: 'Beta', customer: 'Acme Industries', status: 'In Progress', manager: 'Lee', priority: 2,
        start_date: '2026-07-01', target_date: '2026-10-15', rag_schedule: 'Green', size_total: 5 })
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('R1 Gantt pipeline fragment', () => {
  it('renders a scoped, print-safe timeline for the given projects', () => {
    const { Gantt } = app;
    const html = Gantt.pipelineHtml(app.App.data.projects);
    expect(html).toContain('gp-wrap');
    expect(html).toContain('Alpha');
    expect(html).toContain('Beta');
    expect(html).toContain('gp-bar');        // a positioned bar per project
    expect(html).toContain('gp-ms');         // a hard-deadline diamond (Alpha)
    expect(html).toContain('Hard deadline'); // legend
  });
  it('degrades gracefully with no scheduled projects', () => {
    const { Gantt } = app;
    expect(Gantt.pipelineHtml([])).toContain('No scheduled projects');
  });
});

describe('R3–R9 pack sections', () => {
  it('portfolioPack embeds the pipeline + enhancement sections', () => {
    const doc = app.Reports.Builders.portfolioPack('Acme Industries');
    const ids = doc.sections.map(s => s.id);
    ['exec', 'pipeline', 'charts', 'callouts', 'commercials', 'milestone-ribbon', 'appendix'].forEach(id =>
      expect(ids).toContain(id));
    const pipeline = doc.sections.find(s => s.id === 'pipeline');
    expect(pipeline.html).toContain('gp-bar');
    // R4: commercial summary is grounded in Billing.plannedEconomics.
    const commercials = doc.sections.find(s => s.id === 'commercials');
    expect(commercials.html).toMatch(/Planned revenue|Planned margin/);
    // R3: exec KPI band tiles.
    expect(doc.sections.find(s => s.id === 'exec').html).toContain('On track');
  });

  it('customerPack embeds the pipeline (customer-safe)', () => {
    const doc = app.Reports.Builders.customerPack('Acme Industries');
    const ids = doc.sections.map(s => s.id);
    expect(ids).toContain('pipeline');
    expect(ids).toContain('milestone-ribbon');
    // No internal-only commercials/appendix in the customer pack section set.
    expect(ids).not.toContain('commercials');
    expect(ids).not.toContain('appendix');
  });
});

describe('R2 pack composer', () => {
  it('generatePack drops excluded sections before serializing', () => {
    const { Reports } = app;
    let captured = null;
    const origOpen = Reports.open;
    Reports.open = (html) => { captured = html; return { closed: false }; };
    try {
      Reports.generatePack({ audience: 'internal', exclude: ['pipeline', 'appendix'] });
    } finally { Reports.open = origOpen; }
    expect(captured).not.toBeNull();
    // Pipeline excluded → its signature class is gone; a kept section remains.
    expect(captured).not.toContain('gp-bar');
    expect(captured).toContain('Executive summary');
  });
});

// Review fix: _kpiBand ships in both-audience sections of packs serialized for
// customers, so its commercial tiles (planned margin / prepaid balance) are
// fail-closed — rendered only when a caller passes { commercials: true }.
// Neither pack does; internal margin figures live only in the internal-only
// _commercialSummary section.
describe('KPI band commercial gating', () => {
  function configureBilling() {
    const d = app.App.data;
    d.settings.rate_card = { size_engineering: { perm: 300 } };
    d.settings.billing = {
      currency: 'GBP', hours_per_point: 8, target_margin_pct: 30,
      rate_table: { 'United Kingdom': { Consultant: 100 } },
      customer_defaults: { 'Acme Industries': { country: 'United Kingdom', level: 'Consultant' } }
    };
    // Small prepaid block: leaves billable points so planned revenue is > 0.
    d.billing_arrangements = [
      { id: 'BA-1', customer: 'Acme Industries', skill: 'any', prepaid_points: 2, amount_invoiced: 1000 }
    ];
  }

  it('economics are live and the explicit opt-in still renders the tiles', () => {
    configureBilling();
    // Sanity: with billing configured the tiles WOULD render if not gated.
    const eco = app.Billing.plannedEconomics('Acme Industries');
    expect(eco.revenue).toBeGreaterThan(0);
    expect(eco.prepaid_remaining_points).toBeGreaterThan(0);
    const band = app.Reports.Builders._kpiBand('Acme Industries', [], { commercials: true });
    expect(band).toContain('>Margin</div>');
    expect(band).toContain('>Prepaid left</div>');
    // Default (no opts) is fail-closed.
    const plain = app.Reports.Builders._kpiBand('Acme Industries', []);
    expect(plain).not.toContain('>Margin</div>');
    expect(plain).not.toContain('>Prepaid left</div>');
  });

  it('customerPack HTML never carries margin or prepaid tiles', () => {
    configureBilling();
    const doc = app.Reports.Builders.customerPack('Acme Industries');
    expect(doc.audience).toBe('customer');
    const html = app.Reports.Doc.toHtml(doc, {});
    expect(html).not.toContain('>Margin</div>');
    expect(html).not.toContain('>Prepaid left</div>');
  });

  it('portfolioPack exec band omits the tiles even when serialized as customer; internal commercials section keeps the figures', () => {
    configureBilling();
    const doc = app.Reports.Builders.portfolioPack('Acme Industries');
    // The exec section is both-audience — it must not carry commercial tiles.
    const exec = doc.sections.find(s => s.id === 'exec');
    expect(exec.html).not.toContain('>Margin</div>');
    expect(exec.html).not.toContain('>Prepaid left</div>');
    const customerHtml = app.Reports.Doc.toHtml({ ...doc, audience: 'customer' }, {});
    expect(customerHtml).not.toContain('>Margin</div>');
    expect(customerHtml).not.toContain('>Prepaid left</div>');
    // Internal serialization keeps the full figures via _commercialSummary.
    const internalHtml = app.Reports.Doc.toHtml(doc, {});
    expect(internalHtml).toContain('Planned margin');
  });
});
