import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test.describe('P0 — Auto-Allocate Cancel revert', () => {
  test('cancel restores skill_splits to pre-preview state', async ({ page }) => {
    await openAppWithData(page);
    const before = await page.evaluate(() => {
      return JSON.stringify((window as any).App.data.projects.map((p: any) => ({ id: p.id, splits: p.skill_splits })));
    });
    await page.evaluate(() => (window as any).Sprint.autoAllocate());
    await page.evaluate(() => (window as any).Sprint.runAllocationFromOptions());
    await page.evaluate(() => (window as any).Sprint.closeAllocResults());
    const after = await page.evaluate(() => {
      return JSON.stringify((window as any).App.data.projects.map((p: any) => ({ id: p.id, splits: p.skill_splits })));
    });
    expect(after).toBe(before);
  });
});

test.describe('P0 — Resourcing Gap report renders', () => {
  test('gap panel shows skill rows in Capacity view', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => (window as any).App.navigate('capacity'));
    // Gap panel auto-renders when Capacity.render fires.
    const panel = page.locator('#capacityGapPanel');
    await expect(panel).toContainText(/Resourcing Gap/);
    await expect(panel).toContainText(/FTE/);
  });
});
