import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Settings shows the tile dashboard by default', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('config'));
  await expect(page.locator('#configBody .config-tile-grid')).toBeVisible();
  const tiles = page.locator('#configBody .config-tile');
  await expect(tiles).toHaveCount(11);
});

test('Clicking the Customers tile opens the customers detail panel', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('config'));
  await page.locator('button.config-tile', { hasText: 'Customers' }).click();
  await expect(page.locator('#configBody .config-breadcrumb')).toBeVisible();
  await expect(page.locator('#configBody')).toContainText(/customer/i);
});

test('Back button returns to the tile dashboard', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('config'));
  await page.locator('button.config-tile', { hasText: 'Customers' }).click();
  await page.locator('#configBody .config-breadcrumb button:has-text("Settings")').click();
  await expect(page.locator('#configBody .config-tile-grid')).toBeVisible();
});

test('Esc returns to the tile dashboard', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('config'));
  await page.locator('button.config-tile', { hasText: 'Customers' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#configBody .config-tile-grid')).toBeVisible();
});

test('Annual Holidays toolbar shortcut lands in the Team category', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('capacity'));
  await page.locator('button[aria-label="Edit annual holidays"]').click();
  await expect(page.locator('#configBody .config-breadcrumb')).toContainText(/team/i);
});
