import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Load demo dataset replaces project list', async ({ page }) => {
  await openAppWithData(page);
  const before = await page.evaluate(() => (window as any).App.data.projects.length);
  await page.evaluate(() => (window as any).App.navigate('config'));
  await page.locator('button.config-tile', { hasText: 'Data' }).click();
  await page.locator('button:has-text("Load demo dataset")').click();
  // Allow fetch + render — wait for the project count to change away from the seed dataset.
  await page.waitForFunction(
    (initial) => (window as any).App && (window as any).App.data && (window as any).App.data.projects.length !== initial,
    before,
    { timeout: 5000 }
  );
  const after = await page.evaluate(() => (window as any).App.data.projects.length);
  expect(after).toBeGreaterThanOrEqual(10);
  expect(after).not.toBe(before);
});
