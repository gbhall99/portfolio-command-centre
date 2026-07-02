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
  // The chart auto-scrolls to keep Today in view, and the sticky labels column
  // overlays the left edge of the chart — so depending on the CURRENT DATE the
  // first bar's centre can sit underneath the labels column, where hover lands
  // on a non-hoverable label element and no tooltip fires (this exact test
  // passed on 1 Jul and failed on 2 Jul with identical code). Hover a point on
  // the bar's visible chart-side portion instead, like a real cursor would.
  const barBox = await phaseBar.boundingBox();
  const labelsBox = await page.locator('#ganttLabels').boundingBox();
  if (!barBox || !labelsBox) throw new Error('gantt geometry unavailable');
  const fromLeft = Math.max(barBox.x, labelsBox.x + labelsBox.width) + 6;
  const hoverX = Math.min(fromLeft, barBox.x + barBox.width - 4);
  await page.mouse.move(hoverX, barBox.y + barBox.height / 2);
  await expect(page.locator('.gantt-tooltip, #ganttTooltip')).toBeVisible();
});
