import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Sprint Brief picker opens with a default selection', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('sprint'));
  await page.locator('button[onclick*="Report.openSprintBriefPicker"]').click();
  await expect(page.locator('#sprintBriefPickerOverlay')).toBeVisible();
  const checked = page.locator('#sprintBriefPickerOverlay input[name="sb-picker-sprint"]:checked');
  await expect(checked).toHaveCount(1);
});

test('Sprint Brief picker closes on Cancel', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('sprint'));
  await page.locator('button[onclick*="Report.openSprintBriefPicker"]').click();
  await expect(page.locator('#sprintBriefPickerOverlay')).toBeVisible();
  await page.locator('#sprintBriefPickerOverlay button:has-text("Cancel")').click();
  await expect(page.locator('#sprintBriefPickerOverlay')).toHaveCount(0);
});

test('Sprint Brief picker closes on Esc', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('sprint'));
  await page.locator('button[onclick*="Report.openSprintBriefPicker"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#sprintBriefPickerOverlay')).toHaveCount(0);
});

test('Generate Brief invokes exportSprintBrief with chosen id', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('sprint'));
  await page.evaluate(() => {
    (window as any).__lastBrief = null;
    (window as any).Report.exportSprintBrief = function (customer: string, sprintId: string) {
      (window as any).__lastBrief = { customer, sprintId };
    };
  });
  await page.locator('button[onclick*="Report.openSprintBriefPicker"]').click();
  const chosenId = await page.evaluate(() => {
    const r = document.querySelector('#sprintBriefPickerOverlay input[name="sb-picker-sprint"]:checked') as HTMLInputElement;
    return r ? r.value : null;
  });
  expect(chosenId).not.toBeNull();
  await page.locator('#sprintBriefPickerOverlay button:has-text("Generate Brief")').click();
  const captured = await page.evaluate(() => (window as any).__lastBrief);
  expect(captured.sprintId).toBe(chosenId);
  await expect(page.locator('#sprintBriefPickerOverlay')).toHaveCount(0);
});
