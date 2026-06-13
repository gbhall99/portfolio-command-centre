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

  // RAID (now folds in the former standalone Actions view as a tab)
  await page.click('.nav-item[data-view="raid"]');
  await expect(page.locator('#viewRaid')).toHaveClass(/active/);
  await expect(page.locator('.raid-tab[data-raid-tab="actions"]')).toBeVisible();

  // Settings — tile dashboard is the default landing (post-IA-redesign).
  await page.click('.nav-item[data-view="config"]');
  await expect(page.locator('#configBody .config-tile-grid')).toBeVisible();
  await expect(page.locator('#configBody .config-tile')).toHaveCount(14);
});
