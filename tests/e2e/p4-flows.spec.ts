import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test.describe('P4 — Backlog tab', () => {
  test('App.computeBacklogBuckets is callable', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const A: any = (window as any).App;
      const out = A.computeBacklogBuckets('GCC');
      return !!(out && Array.isArray(out.unrefined) && Array.isArray(out.refined) && Array.isArray(out.parked));
    });
    expect(ok).toBe(true);
  });
});

test.describe('P4 — Sandbox banner', () => {
  test('toggleSandboxMode flips the banner visible', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => (window as any).App.toggleSandboxMode());
    const banner = page.locator('#sandboxBanner');
    await expect(banner).toBeVisible();
  });
});

test.describe('P4 — Member impact + Sprint Brief + View as + ceremony helpers', () => {
  test('Capacity.simulateMemberImpact returns shape', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const C: any = (window as any).Capacity;
      const tm = ((window as any).App.data.team_members || [])[0];
      const sp = ((window as any).App.data.sprints || [])[0];
      if (!tm || !sp) return true;
      const r = C.simulateMemberImpact(tm.name, sp.sprint_id);
      return !!(r && typeof r.supplyDelta === 'number');
    });
    expect(ok).toBe(true);
  });

  test('Report.buildSprintBriefDoc returns content', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const R: any = (window as any).Report;
      const sp = ((window as any).App.data.sprints || [])[0];
      if (!sp) return true;
      const doc = R.buildSprintBriefDoc((window as any).App.activeCustomer, sp.sprint_id);
      return !!(doc && String(doc).length);
    });
    expect(ok).toBe(true);
  });

  test('App.setViewAsMember updates state', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => (window as any).App.setViewAsMember('Alice'));
    const v = await page.evaluate(() => (window as any).App.viewAsMember);
    expect(v).toBe('Alice');
  });

  test('App.convertToImplementation flips lifecycle on a POC', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const A: any = (window as any).App;
      const p = (A.data.projects || []).find((pr: any) => pr.lifecycle_stage === 'POC') || A.data.projects[0];
      if (!p) return true;
      const original = p.lifecycle_stage;
      p.lifecycle_stage = 'POC';
      const ok = A.convertToImplementation(p.id, { sponsor: 'Test', notes: 'E2E test' });
      const after = p.lifecycle_stage;
      // restore
      p.lifecycle_stage = original;
      return ok && after === 'Implementation';
    });
    expect(ok).toBe(true);
  });
});
