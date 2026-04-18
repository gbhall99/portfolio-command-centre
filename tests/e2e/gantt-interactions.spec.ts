import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Gantt hover surfaces tooltip and highlights', async ({ page }) => {
  await openAppWithData(page);
  await page.click('.nav-item[data-view="roadmap"]');
  await expect(page.locator('#ganttLabels')).toBeVisible();

  // Hover the first project-name row.
  const firstLabelRow = page.locator('.gantt-label-row[data-id]').first();
  await firstLabelRow.hover();
  // Tooltip appears.
  await expect(page.locator('#ganttTooltip, .gantt-tooltip')).toBeVisible({ timeout: 2000 });

  // Enable Detailed toggle — phase sub-rows render.
  await page.locator('#ganttDetailed').check();
  const phaseBar = page.locator('.gantt-phase-bar').first();
  await expect(phaseBar).toBeVisible({ timeout: 5000 });
  // force:true — phase bars are frequently occluded by SVG dependency overlays; the delegated
  // hover handler still fires correctly on the intercepting element's closest .gantt-hoverable.
  await phaseBar.hover({ force: true });
  await expect(page.locator('.gantt-tooltip, #ganttTooltip')).toBeVisible();
});
