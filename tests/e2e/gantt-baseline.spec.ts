import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

// SKIPPED: this test asserts the old bracket DOM (.gantt-baseline-bracket) and tooltip
// content from PR #15. Tasks 6+7 of the v2 plan add the new hover handlers (paint/erase
// + buildTooltip branches for delta-pill / phase-tag / phase-baseline). Task 8 then
// rewrites this test to hover the new .gantt-delta-pill and assert "Slip contributors".
// Re-enabled by Task 8.
test.skip('Gantt baseline bracket: hover surfaces Plan vs actual', async ({ page }) => {
  await openAppWithData(page);

  // Navigate to roadmap.
  await page.click('.nav-item[data-view="roadmap"]');
  await expect(page.locator('#ganttLabels')).toBeVisible();

  // Set a baseline programmatically through the bridge — avoids the named-baseline modal.
  await page.evaluate(() => {
    const w = window as any;
    const cust = w.App.activeCustomer;
    const proj = w.App.data.projects.find((p: any) => p.customer === cust);
    if (!proj) return;
    proj.baseline_start = proj.start_date;
    proj.baseline_end = proj.target_date;
    // Slip target by 14 days.
    const d = new Date(proj.target_date);
    d.setDate(d.getDate() + 14);
    proj.target_date = d.toISOString().split('T')[0];
    // Force the legacy fallback path — no named baseline needed.
    const cb = document.getElementById('ganttBaseline') as HTMLInputElement;
    if (cb) cb.checked = true;
    w.Gantt.render();
  });

  // Allow layout to settle after programmatic render.
  await page.waitForTimeout(100);

  // Bracket should be present.
  const bracket = page.locator('.gantt-baseline-bracket').first();
  await expect(bracket).toBeVisible();

  // Hover surfaces tooltip with Plan vs actual block.
  await bracket.hover({ force: true });
  await expect(page.locator('#ganttTooltip')).toContainText('Plan vs actual');
  await expect(page.locator('#ganttTooltip')).toContainText('Baseline');
  await expect(page.locator('#ganttTooltip')).toContainText('Current');
});
