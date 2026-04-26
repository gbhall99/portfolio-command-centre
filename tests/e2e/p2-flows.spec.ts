import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test.describe('P2 — Scenario manager', () => {
  test('opens via header button', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => (window as any).App.openScenarioManager());
    await expect(page.locator('#scenarioManagerOverlay')).toContainText(/Scenarios/);
  });
});

test.describe('P2 — Walkthrough', () => {
  test('opens via Sprint.openWalkthrough', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => (window as any).Sprint.openWalkthrough());
    await expect(page.locator('#walkthroughOverlay')).toContainText(/Walkthrough/);
  });
});

test.describe('P2 — Cost model', () => {
  test('computeProjectCost is callable and returns currency', async ({ page }) => {
    await openAppWithData(page);
    const cost = await page.evaluate(() => {
      const A: any = (window as any).App;
      const p = A.data.projects[0];
      return A.computeProjectCost(p);
    });
    expect(cost.currency).toBe('GBP');
    expect(typeof cost.BAC).toBe('number');
  });
});
