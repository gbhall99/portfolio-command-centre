import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function boot() {
  const app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    projects: [makeProject({ id: 'P1', name: 'Proj One', customer: 'Acme Industries', status: 'At Risk',
      narrative: { headline: 'Phase 1 tracking', wins: ['UAT ready'], asks: ['Approve phase 2'], customer_visible_risk_ids: ['r1'] },
      risks_register: [
        { id: 'r1', description: 'Shown to customer', impact: 4, probability: 3 },
        { id: 'r2', description: 'Internal only risk', impact: 5, probability: 5 }
      ],
      business_value: 8, time_criticality: 6, risk_reduction_opportunity: 5
    })]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

describe('Brief builders emit the section contract', () => {
  it('project report: business case section is internal-only', async () => {
    const app = await boot();
    const doc = app.Reports.Builders.sponsorPack('P1');
    expect(Array.isArray(doc.sections)).toBe(true);
    doc.sections.forEach(s => { expect(s).toHaveProperty('id'); expect(s).toHaveProperty('title'); expect(s).toHaveProperty('html'); });
    const bc = doc.sections.find(s => /business case|cost|npv|financ/i.test(s.title));
    if (bc) expect(bc.audiences).toEqual(['internal']);
    app.teardown();
  });
  it('portfolio customer audience redacts to customer_visible_risk_ids', async () => {
    const app = await boot();
    const doc = app.Reports.Builders.customerPack('Acme Industries');
    const html = app.Reports.Doc.toHtml({ ...doc, audience: 'customer' }, {});
    expect(html).toContain('Shown to customer');
    expect(html).not.toContain('Internal only risk');
    app.teardown();
  });
});
