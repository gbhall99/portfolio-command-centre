import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Logo editor on Customers card persists logo', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('config'));
  await page.locator('button.config-tile', { hasText: 'Customers' }).click();
  const btn = page.locator('button:has-text("Set logo")').first();
  await btn.click();
  await expect(page.locator('#logoEditorOverlay')).toBeVisible();
  await page.locator('#logoEditorValue').fill('https://example.com/logo.png');
  await page.locator('#logoEditorOverlay button:has-text("Save")').click();
  await expect(page.locator('#logoEditorOverlay')).toHaveCount(0);
  const stored = await page.evaluate(() => {
    const customers = (window as any).App.data.customers || [];
    const c = customers.find((x: any) => x.logo);
    return c ? c.logo : null;
  });
  expect(stored).toBe('https://example.com/logo.png');
});

test('White-labelling card has no logo input', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('config'));
  await page.locator('button.config-tile', { hasText: /white-labelling/i }).click();
  await expect(page.locator('#configBody [data-field="logo"]')).toHaveCount(0);
});
