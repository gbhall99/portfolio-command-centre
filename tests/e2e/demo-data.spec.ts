import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Load demo dataset loads the demo customers', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('config'));
  await page.locator('button.config-tile', { hasText: 'Data' }).click();
  await page.locator('button:has-text("Load demo dataset")').click();
  // Allow fetch + render — wait for one of the demo customers to be present.
  await page.waitForFunction(() => {
    const App = (window as any).App;
    if (!App || !App.data || !Array.isArray(App.data.customers)) return false;
    return App.data.customers.some((c: any) => c && c.name === 'Acme Industries');
  }, undefined, { timeout: 5000 });
  const counts = await page.evaluate(() => {
    const App = (window as any).App;
    return { projects: App.data.projects.length, customers: App.data.customers.length };
  });
  expect(counts.projects).toBeGreaterThanOrEqual(10);
  expect(counts.customers).toBe(3);
});
