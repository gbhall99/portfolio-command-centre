import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('adding a project via App.addProject surfaces in the active view', async ({ page }) => {
  await openAppWithData(page);

  // The Projects nav badge is customer-scoped (matches RAID/My Actions) AND reflects the
  // ACTIVE population (status !== Complete/Closed), matching the Dashboard's headline figures
  // via the canonical App.portfolioHealth helper. The project added below is a 'Not Started'
  // (active) project belonging to the active customer, so the active count increments by one.
  const beforeCount = await page.evaluate(() => {
    const app = (window as any).App;
    return app.portfolioHealth(app.activeCustomer).active;
  });

  // Drive programmatically — the wizard is modal-heavy + covered by unit tests.
  // The E2E surface we care about is: notifyDataChange refreshes visible rows.
  await page.evaluate(() => {
    const newP = {
      id: 'E2E-NEW',
      name: 'E2E Added Project',
      customer: (window as any).App.activeCustomer,
      status: 'Not Started',
      priority: 999,
      size_total: 10,
      size_engineering: 10,
      delivery_config: { phase_order: ['Data Engineering'] }
    };
    (window as any).App.addProject(newP);
  });

  // Project count in the nav badge increments.
  await expect(page.locator('#navBadgeTotal')).toHaveText(String(beforeCount + 1));
  // Row appears in dashboard table.
  await expect(page.locator('#projectTableBody tr[data-id="E2E-NEW"]')).toBeVisible({ timeout: 3000 });
});
