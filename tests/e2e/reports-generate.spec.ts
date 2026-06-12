import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

// WS-E Task 6 — every brief export surface routes through Reports.generate
// (the unified engine) instead of the legacy Report.export* methods.

test('brief export surfaces are wired to Reports.generate, not legacy Report.export*', async ({ page }) => {
  await openAppWithData(page);

  // Static surfaces: portfolio overview header, governance exports card, quick-nav.
  const body = await page.evaluate(() => document.body.innerHTML);
  expect(body).not.toContain('Report.exportCustomerPack');
  expect(body).not.toContain('Report.exportPortfolioPack');
  expect(body).toContain("Reports.generate('portfolio_report'");

  // Project report buttons live in the EVM strip (rendered per-project) —
  // render it directly for a project with earned-value data.
  const strip = await page.evaluate(() => {
    const w = window as any;
    const projects = w.App.data.projects.filter((x: any) => x.customer === w.App.activeCustomer);
    const candidates = projects.length ? projects : w.App.data.projects;
    let html = '';
    for (const p of candidates) {
      const s = w.DetailPanel.renderEvmStrip(p);
      if (s && s.indexOf('<button') >= 0) { html = s; break; }
    }
    return html;
  });
  expect(strip).not.toContain('Report.exportProjectPack');
  expect(strip).not.toContain('Report.exportBusinessCase');
  expect(strip).toContain("Reports.generate('project_report'");
});

test('governance Portfolio Pack button calls Reports.generate with internal audience', async ({ page }) => {
  await openAppWithData(page);
  // Stub generate so no print window opens; record the call args.
  await page.evaluate(() => {
    const w = window as any;
    w.__calls = [];
    w.Reports.generate = (...a: any[]) => { w.__calls.push(a); };
  });
  await page.evaluate(() => (window as any).App.navigate('governance'));
  await page.locator('#govExportPortfolioPackBtn').click();
  const calls = await page.evaluate(() => (window as any).__calls);
  expect(calls.length).toBe(1);
  expect(calls[0][0]).toBe('portfolio_report');
  expect(calls[0][1].audience).toBe('internal');
  const activeCustomer = await page.evaluate(() => (window as any).App.activeCustomer);
  expect(calls[0][1].customer).toBe(activeCustomer);
});
