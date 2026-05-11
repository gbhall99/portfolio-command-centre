import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('navigation through all six views', async ({ page }) => {
  await openAppWithData(page);

  // Dashboard is the default landing.
  await expect(page.locator('#projectTableBody')).toBeVisible();

  // Sprint Planning
  await page.click('.nav-item[data-view="sprint"]');
  await expect(page.locator('#viewSprint')).toHaveClass(/active/);

  // Roadmap / Gantt
  await page.click('.nav-item[data-view="roadmap"]');
  await expect(page.locator('#ganttLabels')).toBeVisible();

  // Capacity & Workload
  await page.click('.nav-item[data-view="capacity"]');
  await expect(page.locator('#viewCapacity')).toHaveClass(/active/);

  // Governance Meetings
  await page.click('.nav-item[data-view="governance"]');
  await expect(page.locator('#viewGovernance')).toHaveClass(/active/);

  // Settings — tile dashboard is the default landing (post-IA-redesign).
  await page.click('.nav-item[data-view="config"]');
  await expect(page.locator('#configBody .config-tile-grid')).toBeVisible();
  await expect(page.locator('#configBody .config-tile')).toHaveCount(11);
});
