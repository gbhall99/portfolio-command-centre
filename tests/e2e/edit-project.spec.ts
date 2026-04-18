import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('editing a project in the detail panel refreshes the active view', async ({ page }) => {
  await openAppWithData(page);

  // Pick the first project row and open it.
  const firstRow = page.locator('#projectTableBody tr').first();
  const projectId = await firstRow.getAttribute('data-id');
  expect(projectId).toBeTruthy();
  await firstRow.click();

  await expect(page.locator('#detailPanel.open')).toBeVisible();

  // Change the status to Blocked (triggers auto-refresh via App.notifyDataChange).
  await page.locator('.field-input[data-field="status"]').selectOption('Blocked');

  // Row in the Dashboard should reflect the new status.
  await expect(
    page.locator(`#projectTableBody tr[data-id="${projectId}"] .badge-status`)
  ).toContainText('Blocked');
});
