import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Business case generator', () => {
  it('produces a doc with cost, benefit, and NPV sections', async () => {
    resetIdSeq();
    const proj = makeProject({
      name: 'Cost', size_engineering: 10,
      business_value: 8, time_criticality: 6, risk_reduction_opportunity: 4
    });
    proj.size_total = 10;
    proj.benefit_annual_gbp = 250000;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()],
      settings: { rate_card: { size_engineering: { perm: 750 } }, business_case_discount_rate: 0.07 }
    }));
    const Report = app.window.__pcc__.Report;
    const doc = Report.buildBusinessCaseDoc(proj.id);
    expect(doc).toBeDefined();
    const html = String(doc);
    expect(html).toMatch(/Cost/);
    expect(html).toMatch(/Benefit/);
    expect(html).toMatch(/NPV/);
    app.teardown();
  });
});
