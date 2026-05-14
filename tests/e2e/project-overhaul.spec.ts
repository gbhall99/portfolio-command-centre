import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Communications section is gone from detail panel', async ({ page }) => {
  await openAppWithData(page);
  const id = await page.evaluate(() => (window as any).App.data.projects[0].id);
  await page.evaluate((pid) => (window as any).DetailPanel.open(pid), id);
  await expect(page.locator('#detailPanel.open')).toBeVisible();
  // Look only for the panel-section title heading, not arbitrary occurrences of the word
  await expect(page.locator('#detailPanel .panel-section-title', { hasText: /Communications/ })).toHaveCount(0);
});

test('Sponsor select offers Add-new option', async ({ page }) => {
  await openAppWithData(page);
  const id = await page.evaluate(() => (window as any).App.data.projects[0].id);
  await page.evaluate((pid) => (window as any).DetailPanel.open(pid), id);
  await expect(page.locator('#detailPanel.open')).toBeVisible();
  const options = page.locator('#detailPanel select[data-field="sponsor"] option');
  await expect(options.last()).toContainText(/add new sponsor/i);
});

test('Sprint window section is read-only', async ({ page }) => {
  await openAppWithData(page);
  const id = await page.evaluate(() => (window as any).App.data.projects[0].id);
  await page.evaluate((pid) => (window as any).DetailPanel.open(pid), id);
  await expect(page.locator('#detailPanel .panel-section-title', { hasText: /Sprint window/i })).toHaveCount(1);
  // Editors for current_sprint / target_sprint must be gone
  await expect(page.locator('#detailPanel input[data-field="current_sprint"], #detailPanel input[data-field="target_sprint"], #detailPanel select[data-field="current_sprint"], #detailPanel select[data-field="target_sprint"]')).toHaveCount(0);
});

test('Dates sub-block in Customer Milestones has only hard_deadline + target_date editors (user-IA-rev: Dates embedded inside Customer Milestones)', async ({ page }) => {
  await openAppWithData(page);
  const id = await page.evaluate(() => (window as any).App.data.projects[0].id);
  await page.evaluate((pid) => (window as any).DetailPanel.open(pid), id);
  await expect(page.locator('#detailPanel.open')).toBeVisible();
  // Dates is no longer a standalone panel-section — it's a sub-block inside Customer Milestones.
  await expect(page.locator('#detailPanel [data-dates-subblock]')).toHaveCount(1);
  // start_date / actual_date / product_release_date / external_delivery_date / comms_date editors should be gone
  await expect(page.locator('#detailPanel input[data-field="start_date"], #detailPanel input[data-field="actual_date"], #detailPanel input[data-field="product_release_date"], #detailPanel input[data-field="external_delivery_date"], #detailPanel input[data-field="comms_date"]')).toHaveCount(0);
  // hard_deadline + target_date inputs ARE present (inside the Customer Milestones panel-section now)
  await expect(page.locator('#detailPanel input[data-field="hard_deadline"]')).toHaveCount(1);
  await expect(page.locator('#detailPanel input[data-field="target_date"]')).toHaveCount(1);
});

test('Adding a benefit and a success criterion persists', async ({ page }) => {
  await openAppWithData(page);
  const id = await page.evaluate(() => (window as any).App.data.projects[0].id);
  await page.evaluate((pid) => (window as any).DetailPanel.open(pid), id);
  // Benefits + Success criteria live in the Setup tab; the panel defaults to Health.
  await page.evaluate(() => (window as any).DetailPanel.switchTab('setup'));
  // Add a benefit
  await page.locator('#detailPanel button:has-text("+ Add Benefit")').first().click();
  // Add a success criterion
  await page.locator('#detailPanel button:has-text("+ Add success criterion")').first().click();
  const counts = await page.evaluate((pid) => {
    const p = (window as any).App.data.projects.find((x: any) => x.id === pid);
    return { benefits: (p.benefits || []).length, success: (p.success_criteria || []).length };
  }, id);
  expect(counts.benefits).toBeGreaterThan(0);
  expect(counts.success).toBeGreaterThan(0);
});
