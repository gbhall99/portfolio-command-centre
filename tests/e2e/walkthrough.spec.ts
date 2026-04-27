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

test.describe('Walkthrough — data updates roundtrip', () => {
  test('flip a RAG, close a risk, update a chip — all persist + minutes show them', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const A: any = (window as any).App;
      const p = A.data.projects[0];
      const wid = A.startWalkthrough(p.customer, ['SM']);
      const ragOk = A.updateProjectRag(p.id, 'schedule', 'Red', wid, 'E2E flip');
      const newStatus = p.status === 'Blocked' ? 'In Progress' : 'Blocked';
      const statusOk = A.updateProjectStatus(p.id, newStatus, wid, 'E2E status');
      let riskOk = true;
      if ((p.risks_register || []).length) {
        riskOk = A.updateRiskStatus(p.id, 0, 'closed', wid, 'E2E close');
      }
      let progOk = true;
      const splitsObj = p.skill_splits || {};
      const firstKey = Object.keys(splitsObj).find(k => Array.isArray(splitsObj[k]) && splitsObj[k].length);
      if (firstKey) {
        const arr = splitsObj[firstKey];
        progOk = A.updateChipProgress(p.id, firstKey, arr[0].sprint, (arr[0].completed || 0) + 1, wid);
      }
      A.completeWalkthrough(wid);
      const wt = A.data.walkthroughs.find((w: any) => w.id === wid);
      return ragOk && statusOk && riskOk && progOk && Array.isArray(wt.data_updates) && wt.data_updates.length >= 1 && (wt.minutes_html || '').indexOf('Data updates') >= 0;
    });
    expect(ok).toBe(true);
  });
});
