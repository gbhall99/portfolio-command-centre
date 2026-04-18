import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('adding a project via App.addProject surfaces in the active view', async ({ page }) => {
  await openAppWithData(page);

  const beforeCount = await page.evaluate(() => (window as any).App.data.projects.length);

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
