import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test.describe('Walkthrough — full ritual', () => {
  test('open → record decision → record action → complete', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const A: any = (window as any).App;
      const id = A.startWalkthrough('GCC', ['SM']);
      A.recordWalkthroughDecision(id, { text: 'E2E decision', rationale: 'E2E rationale' });
      A.recordWalkthroughAction(id, { description: 'E2E action', owner: 'PO', due_date: '2026-04-30' });
      const completed = A.completeWalkthrough(id);
      const wt = A.data.walkthroughs.find((w: any) => w.id === id);
      return completed && !!wt.completed_at && wt.decisions.length === 1 && wt.actions.length === 1 && (typeof wt.minutes_html === 'string') && wt.minutes_html.length > 0;
    });
    expect(ok).toBe(true);
  });

  test('Sprint.openWalkthrough renders sectioned overlay', async ({ page }) => {
    await openAppWithData(page);
    await page.evaluate(() => (window as any).Sprint.openWalkthrough());
    await expect(page.locator('#walkthroughOverlay')).toContainText(/Weekly Walkthrough/);
    await expect(page.locator('#walkthroughOverlay')).toContainText(/Decisions/);
  });
});
