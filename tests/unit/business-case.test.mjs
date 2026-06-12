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
    const Reports = app.window.__pcc__.Reports;
    const doc = Reports.Builders.businessCase(proj.id);
    expect(doc).toBeDefined();
    const html = Reports.Doc.toHtml(doc, {});
    expect(html).toMatch(/Cost/);
    expect(html).toMatch(/benefit/i);
    expect(html).toMatch(/NPV/);
    app.teardown();
  });

  it('clamps an absurd benefit_horizon_years instead of looping the main thread', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Huge horizon', size_engineering: 10 });
    proj.benefit_annual_gbp = 250000;
    proj.benefit_horizon_years = 2e8; // reachable via JSON import; unclamped this froze the tab for ~8s
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()],
      settings: { rate_card: { size_engineering: { perm: 750 } }, business_case_discount_rate: 0.07 }
    }));
    const Reports = app.window.__pcc__.Reports;
    const t0 = Date.now();
    const html = Reports.Builders._businessCaseSummaryHtml(proj);
    expect(Date.now() - t0).toBeLessThan(500); // 2e8 unclamped iterations measured ~8,300ms
    expect(html).toContain('over 50 years'); // clamped to the 50-year cap
    expect(html).not.toMatch(/NaN/);
    app.teardown();
  });

  it('falls back to the 3-year default for non-numeric benefit_horizon_years (no NaN in the doc)', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Garbage horizon', size_engineering: 10 });
    proj.benefit_annual_gbp = 250000;
    proj.benefit_horizon_years = 'garbage';
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()],
      settings: { rate_card: { size_engineering: { perm: 750 } }, business_case_discount_rate: 0.07 }
    }));
    const Reports = app.window.__pcc__.Reports;
    const html = Reports.Builders._businessCaseSummaryHtml(proj);
    expect(html).toContain('over 3 years'); // default horizon, previously rendered 'over NaN years'
    expect(html).not.toMatch(/NaN/);
    app.teardown();
  });

  it('sponsor pack generation stays fast with an absurd horizon (builds bcHtml unconditionally)', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Sponsor horizon', size_engineering: 10 });
    proj.benefit_annual_gbp = 250000;
    proj.benefit_horizon_years = 1e15; // unclamped this hangs effectively forever
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()],
      settings: { rate_card: { size_engineering: { perm: 750 } }, business_case_discount_rate: 0.07 }
    }));
    const Reports = app.window.__pcc__.Reports;
    const t0 = Date.now();
    const doc = Reports.Builders.sponsorPack(proj.id);
    expect(Date.now() - t0).toBeLessThan(500);
    expect(doc).toBeDefined();
    app.teardown();
  });
});
