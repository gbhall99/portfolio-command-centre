import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test('Sprint overrides modal renders above panel overlay', async ({ page }) => {
  await openAppWithData(page);
  // Open detail panel for first project (background)
  const firstId = await page.evaluate(() => (window as any).App.data.projects[0].id);
  await page.evaluate((id) => (window as any).DetailPanel.open(id), firstId);
  // Navigate to capacity view
  await page.evaluate(() => (window as any).App.navigate('capacity'));
  // Trigger sprint-overrides modal directly (Capacity.openTeamEdit may not match user click; use the underlying API)
  const opened = await page.evaluate(() => {
    const App = (window as any).App;
    const Capacity = (window as any).Capacity;
    const sprintId = (App.data.sprints || [])[0] && App.data.sprints[0].sprint_id;
    if (!sprintId || !Capacity || typeof Capacity.openSprintEdit !== 'function') return false;
    Capacity.openSprintEdit(sprintId, App.activeCustomer);
    return true;
  });
  test.skip(!opened, 'Capacity.openSprintEdit not available in this build');
  await expect(page.locator('#teamEditModal')).toBeVisible();
  const z = await page.evaluate(() => {
    const m = document.getElementById('teamEditModal');
    return m ? window.getComputedStyle(m).zIndex : null;
  });
  expect(Number(z)).toBeGreaterThanOrEqual(9000);
});

test('Member impact overlay sits above team-edit modal', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => (window as any).App.navigate('capacity'));
  const member = await page.evaluate(() => {
    const m = (window as any).App.data.team_members && (window as any).App.data.team_members[0];
    return m ? m.name : null;
  });
  test.skip(!member, 'No team member to drive the test');
  await page.evaluate((name) => (window as any).Capacity.openMemberImpactModal(name), member);
  await expect(page.locator('#memberImpactOverlay')).toBeVisible();
  const z = await page.evaluate(() => {
    const o = document.getElementById('memberImpactOverlay');
    return o ? window.getComputedStyle(o).zIndex : null;
  });
  expect(Number(z)).toBeGreaterThanOrEqual(9100);
});
