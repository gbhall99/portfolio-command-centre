import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test.describe('P1 — On-Track Verdict tile', () => {
  test('renders a verdict word in the dashboard', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => (window as any).App.navigate('dashboard'));
    const tile = page.locator('#kpiCards');
    await expect(tile).toContainText(/On Track|Watch|Off Track/);
  });
});

test.describe('P1 — When-by modal', () => {
  test('opens, computes a forecast, copy button is present', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => (window as any).Dashboard.openWhenByModal());
    await page.locator('#wbSize').fill('30');
    await page.locator('button:has-text("Forecast")').click();
    const out = page.locator('#whenByOutput');
    await expect(out).toBeVisible();
    await expect(page.locator('button:has-text("Copy answer")')).toBeVisible();
  });
});

test.describe('P1 — Lifecycle chip helper', () => {
  test('App.lifecycleStageChip produces chip HTML with class lifecycle-chip', async ({ page }) => {
    await openAppWithData(page);
    const html = await page.evaluate(() => {
      const App: any = (window as any).App;
      const p = (App.data && App.data.projects && App.data.projects[0]) || { lifecycle_stage: 'Implementation' };
      return App.lifecycleStageChip(p);
    });
    expect(html).toMatch(/lifecycle-chip/);
    expect(html).toMatch(/Implementation/);
  });
});
