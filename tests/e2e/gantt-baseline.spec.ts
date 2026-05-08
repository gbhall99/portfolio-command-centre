import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Gantt slip pill: hover surfaces Plan vs actual + Slip contributors', async ({ page }) => {
  await openAppWithData(page);

  // Navigate to roadmap.
  await page.click('.nav-item[data-view="roadmap"]');
  await expect(page.locator('#ganttLabels')).toBeVisible();

  // Set up a slipped baseline programmatically: pick a project with skill_splits and slip 14 days.
  await page.evaluate(() => {
    const w = window as any;
    const cust = w.App.activeCustomer;
    const proj = w.App.data.projects.find((p: any) => p.customer === cust && p.skill_splits);
    if (!proj) return;
    proj.baseline_start = proj.start_date;
    proj.baseline_end = proj.target_date;
    const d = new Date(proj.target_date);
    d.setDate(d.getDate() + 14);
    proj.target_date = d.toISOString().split('T')[0];
    const cb = document.getElementById('ganttBaseline') as HTMLInputElement;
    if (cb) cb.checked = true;
    w.Gantt.render();
  });

  const pill = page.locator('.gantt-delta-pill').first();
  await expect(pill).toBeVisible();
  await pill.hover({ force: true });
  await expect(page.locator('#ganttTooltip')).toContainText('Plan vs actual');
  await expect(page.locator('#ganttTooltip')).toContainText('Originally planned');
});
