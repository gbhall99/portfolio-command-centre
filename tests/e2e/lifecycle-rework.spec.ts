import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Advance-stage from POC to Implementation requests baseline reset', async ({ page }) => {
  await openAppWithData(page);
  // Pick the first project, force its lifecycle to POC for a deterministic starting point.
  const targetId = await page.evaluate(() => {
    const App = (window as any).App;
    const p = App.data.projects[0];
    p.lifecycle_stage = 'POC';
    return p.id;
  });
  // Open the detail panel for that project
  await page.evaluate((id) => (window as any).DetailPanel.open(id), targetId);
  await expect(page.locator('#detailPanel.open')).toBeVisible();
  // Stub window.confirm to accept the baseline reset
  page.on('dialog', dialog => dialog.accept());
  // Pick Implementation in the advance dropdown and click the button
  const sel = page.locator('select[id^="advanceStageSelect-"]').first();
  await sel.selectOption('Implementation');
  await page.locator('button:has-text("Advance stage")').first().click();
  // Assert the stage flipped
  const after = await page.evaluate((id) => {
    return (window as any).App.data.projects.find((p: any) => p.id === id).lifecycle_stage;
  }, targetId);
  expect(after).toBe('Implementation');
});

test('"conviction" copy does not appear in detail panel', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => {
    const App = (window as any).App;
    (window as any).DetailPanel.open(App.data.projects[0].id);
  });
  await expect(page.locator('#detailPanel.open')).toBeVisible();
  const text = await page.locator('#detailPanel').innerText();
  expect(text.toLowerCase()).not.toContain('conviction');
});
