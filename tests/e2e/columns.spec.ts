import { test, expect, Page } from '@playwright/test';
import { openAppWithData } from './helpers';

// After page.reload() the bridge script tag is gone and the restore banner
// surfaces again (data is still in localStorage but the app waits for confirm).
// This helper re-clicks restore and re-injects the global handles bridge so
// subsequent page.evaluate(() => (window as any).App...) calls work.
async function reloadAndRebridge(page: Page) {
  await page.reload();
  await page.waitForSelector('#restoreBanner button.btn-primary', { state: 'visible', timeout: 5000 });
  await page.click('#restoreBanner button.btn-primary');
  await page.waitForSelector('#projectTableBody tr, .empty-state', { state: 'visible', timeout: 5000 });
  await page.addScriptTag({
    content: 'window.App = App; window.Solver = Solver; window.Sprint = Sprint; window.Dashboard = Dashboard; window.Gantt = Gantt; window.Capacity = Capacity; window.Governance = Governance; window.DetailPanel = DetailPanel; window.AuditPanel = AuditPanel; window.Forecast = Forecast; window.Report = Report; window.Walkthrough = Walkthrough;'
  });
  await page.waitForFunction(() => !!(window as any).Dashboard);
}

test('column picker hides Manager and persists across reload', async ({ page }) => {
  await openAppWithData(page);
  await expect(page.locator('#projectTableHead th[data-col-id="manager"]')).toBeVisible();
  await page.locator('button[onclick*="ColumnPicker.toggle"]').click();
  await expect(page.locator('.col-picker-popover')).toBeVisible();
  await page.locator('.col-picker-popover input[data-col-id="manager"]').click();
  await expect(page.locator('#projectTableHead th[data-col-id="manager"]')).toHaveCount(0);
  await reloadAndRebridge(page);
  await expect(page.locator('#projectTableHead th[data-col-id="manager"]')).toHaveCount(0);
});

test('Reset restores default columns', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).Dashboard.setColumnVisible('manager', false));
  await page.evaluate(() => (window as any).Dashboard.renderHeader());
  await expect(page.locator('#projectTableHead th[data-col-id="manager"]')).toHaveCount(0);
  await page.locator('button[onclick*="ColumnPicker.toggle"]').click();
  await page.locator('.col-picker-reset').click();
  await expect(page.locator('#projectTableHead th[data-col-id="manager"]')).toBeVisible();
});

test('column resize persists across reload', async ({ page }) => {
  await openAppWithData(page);
  const handle = page.locator('th[data-col-id="manager"] .col-resize-handle');
  // The dashboard view scrolls internally — bring the resize handle into the viewport
  // before driving raw page.mouse events (which use viewport coords without auto-scroll).
  await handle.scrollIntoViewIfNeeded();
  const startBox = await handle.boundingBox();
  await page.mouse.move(startBox!.x + 2, startBox!.y + startBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(startBox!.x + 62, startBox!.y + startBox!.height / 2, { steps: 5 });
  await page.mouse.up();
  const newWidth = await page.evaluate(() => {
    const th = document.querySelector('#projectTableHead th[data-col-id="manager"]') as HTMLElement;
    return th.getBoundingClientRect().width;
  });
  expect(newWidth).toBeGreaterThan(140);
  await reloadAndRebridge(page);
  const afterReload = await page.evaluate(() => {
    const th = document.querySelector('#projectTableHead th[data-col-id="manager"]') as HTMLElement;
    return th.getBoundingClientRect().width;
  });
  expect(Math.abs(afterReload - newWidth)).toBeLessThan(5);
});

test('single-click edits target date', async ({ page }) => {
  await openAppWithData(page);
  const firstRow = page.locator('#projectTableBody tr').first();
  const projectId = await firstRow.getAttribute('data-id');
  const cell = firstRow.locator('td[data-quick-edit="target_date"]');
  await cell.click();
  const input = cell.locator('input[type="date"]');
  await expect(input).toBeVisible();
  await input.fill('2026-12-31');
  await input.blur();
  await expect(page.locator('#projectTableBody tr[data-id="' + projectId + '"] td[data-quick-edit="target_date"]')).toContainText('31 Dec');
  const stored = await page.evaluate((id) => {
    const App = (window as any).App;
    return App.data.projects.find((p: any) => p.id === id).target_date;
  }, projectId);
  expect(stored).toBe('2026-12-31');
});

test('skill cascade updates size_total', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).Dashboard.setColumnVisible('size_engineering', true));
  await page.evaluate(() => {
    const D = (window as any).Dashboard;
    D.renderHeader(); D.renderTable(D.filteredProjects);
  });
  const firstRow = page.locator('#projectTableBody tr').first();
  const projectId = await firstRow.getAttribute('data-id');
  const before = await page.evaluate((id) => {
    return (window as any).App.data.projects.find((p: any) => p.id === id);
  }, projectId);
  const newDe = (before.size_engineering || 0) + 5;
  const expectedTotal = (before.size_total || 0) - (before.size_engineering || 0) + newDe;
  const cell = firstRow.locator('td[data-quick-edit="size_engineering"]');
  await cell.click();
  const input = cell.locator('input[type="number"]');
  await input.fill(String(newDe));
  await input.blur();
  const after = await page.evaluate((id) => {
    return (window as any).App.data.projects.find((p: any) => p.id === id);
  }, projectId);
  expect(after.size_engineering).toBe(newDe);
  expect(after.size_total).toBe(expectedTotal);
});

test('clicking the project name opens detail panel', async ({ page }) => {
  await openAppWithData(page);
  const firstRow = page.locator('#projectTableBody tr').first();
  await firstRow.locator('.project-name-cell').click();
  await expect(page.locator('#detailPanel.open')).toBeVisible();
});

test('clicking a non-name, non-edit cell does nothing', async ({ page }) => {
  await openAppWithData(page);
  const firstRow = page.locator('#projectTableBody tr').first();
  // RAG cell has its own cycle behaviour; sprint range cell is derived (no quick-edit). Click a derived cell.
  const sprintCell = firstRow.locator('td.sprint-cell').first();
  await sprintCell.click();
  await expect(page.locator('#detailPanel.open')).not.toBeVisible();
});
