import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

/**
 * Task 24: filter the Projects table by Metric.
 *
 * Mirrors the data-bridge pattern of strategy-flow.spec.ts: seeds a metric and
 * links it to the first project for the active customer, then drives the
 * projects filter dropdown via Playwright clicks/selects.
 */
test('Projects table can filter by metric', async ({ page }) => {
  await openAppWithData(page);

  const seed = await page.evaluate(() => {
    const App = (window as any).App;
    const Metrics = (window as any).Metrics;
    if (!App.activeCustomer) {
      const c = (App.getCustomers() || [])[0];
      if (c) App.setActiveCustomer(c);
    }
    const cust = App.activeCustomer;
    const m = Metrics.add({ name: 'E2E-Filter Revenue', group_id: 'performance', dimensions: [], status: 'live', customer: cust });
    // Link to one project; choose another to remain unlinked
    const projects = (App.data.projects || []).filter((p: any) => p.customer === cust);
    const linked = projects[0];
    const unlinked = projects[1] || projects[0];
    if (linked) {
      linked.metric_ids = (linked.metric_ids || []).concat([m.id]);
      App._save && App._save();
    }
    return { metricId: m.id, linkedId: linked && linked.id, linkedName: linked && linked.name, unlinkedId: unlinked && unlinked.id, unlinkedName: unlinked && unlinked.name };
  });

  // Make sure we're on Projects view
  await page.click('.nav-item[data-view="dashboard"]');
  await expect(page.locator('#projectTableBody')).toBeVisible();

  // Re-render filters with the new metric option
  await page.evaluate(() => {
    const Dashboard = (window as any).Dashboard;
    if (Dashboard && Dashboard.init) Dashboard.init();
  });

  // Apply the metric filter
  await page.selectOption('select[name="filter-metric"]', { value: seed.metricId });

  // The linked project should still be visible; unlinked should be hidden
  if (seed.linkedId) {
    await expect(page.locator(`#projectTableBody tr[data-id="${seed.linkedId}"]`).first()).toBeVisible();
  }
  if (seed.unlinkedId && seed.unlinkedId !== seed.linkedId) {
    await expect(page.locator(`#projectTableBody tr[data-id="${seed.unlinkedId}"]`)).toHaveCount(0);
  }
});
