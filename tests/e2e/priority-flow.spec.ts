import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('recommendation chip appears, Apply clears it', async ({ page }) => {
  await openAppWithData(page);

  // Force a known drift: pick project P1, set priority to a very high number so the
  // recommended value will almost certainly differ.
  const projectId = await page.evaluate(() => {
    const p = (window as any).App.data.projects.find((pr: any) =>
      pr.customer === (window as any).App.activeCustomer && pr.status !== 'Complete' && pr.status !== 'Closed');
    (window as any).App.updateProject(p.id, 'priority', 99);
    (window as any).App.computeRecommendedPriorities();
    (window as any).App.notifyDataChange();
    return p.id;
  });

  // Row should now have the violet recommendation chip.
  const chip = page.locator(`#projectTableBody tr[data-id="${projectId}"] .priority-cell span[onclick*="applyRecommendedPriority"]`);
  await expect(chip).toBeVisible();

  // Click it → chip disappears, priority updates.
  await chip.click();
  await expect(chip).toBeHidden();
  const newPriority = await page.evaluate((id) =>
    (window as any).App.data.projects.find((p: any) => p.id === id).priority,
    projectId
  );
  expect(newPriority).not.toBe(99);
});
