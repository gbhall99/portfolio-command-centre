import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

// WS3 — Kanban board: navigation, drag a card between columns (writes
// through App.updateProject), card click opens the detail panel.

test('board renders status columns with customer-scoped cards', async ({ page }) => {
  await openAppWithData(page);
  await page.click('.nav-item[data-view="board"]');
  await expect(page.locator('#kbBoard .kb-col')).toHaveCount(7);
  await expect(page.locator('#kbBoard .kb-card').first()).toBeVisible();
});

test('dragging a card to another column updates the project status', async ({ page }) => {
  await openAppWithData(page);
  await page.click('.nav-item[data-view="board"]');
  const card = page.locator('#kbBoard .kb-card').first();
  const projectId = await card.getAttribute('data-project-id');
  const fromStatus = await card.evaluate(el => el.closest('.kb-col')!.getAttribute('data-status'));
  const targetStatus = fromStatus === 'On Hold' ? 'In Progress' : 'On Hold';
  const target = page.locator(`#kbBoard .kb-col[data-status="${targetStatus}"] .kb-col-body`);
  await card.dragTo(target);
  // The card landed in the target column…
  await expect(page.locator(`#kbBoard .kb-col[data-status="${targetStatus}"] .kb-card[data-project-id="${projectId}"]`)).toBeVisible();
  // …and the write went through the audited App path.
  await page.addScriptTag({ content: 'window.App = App;' });
  const { status, lastAudit } = await page.evaluate((id) => {
    const p = (window as any).App.data.projects.find((x: any) => x.id === id);
    const log = (window as any).App.data.audit_log;
    return { status: p.status, lastAudit: log[log.length - 1] };
  }, projectId);
  expect(status).toBe(targetStatus);
  expect(lastAudit.field).toBe('status');
  expect(lastAudit.source).toBe('board-drag');
});

test('clicking a card opens the project detail panel', async ({ page }) => {
  await openAppWithData(page);
  await page.click('.nav-item[data-view="board"]');
  await page.locator('#kbBoard .kb-card').first().click();
  await expect(page.locator('#detailPanel')).toHaveClass(/open/);
});
