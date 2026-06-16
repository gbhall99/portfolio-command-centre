import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

// Every page must fit the viewport width (no surprise horizontal scroll) and be
// vertically scrollable when its content overflows — checked at a phone width.
const VIEWS = [
  'portfolio', 'projects', 'board', 'raid', 'backlog', 'roadmap', 'sprint',
  'capacity', 'reports', 'metrics', 'personas', 'products', 'activity', 'config'
];

test.use({ viewport: { width: 390, height: 780 } });

test('scroll-health: every page fits the width and scrolls vertically', async ({ page }) => {
  await openAppWithData(page);
  await page.evaluate(() => { if (window.App.setActiveCustomer) window.App.setActiveCustomer('Acme Industries'); });

  const failures: string[] = [];
  for (const v of VIEWS) {
    await page.evaluate((view) => window.App.navigate(view), v);
    await page.waitForTimeout(120);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const overflowX = de.scrollWidth - window.innerWidth;
      const view = document.querySelector('.view.active') as HTMLElement | null;
      let scrolledOk = true;
      if (view && view.scrollHeight > view.clientHeight + 4) {
        view.scrollTop = view.scrollHeight;     // try to reach the bottom
        scrolledOk = view.scrollTop > 0;        // it actually moved (not clipped/locked)
        view.scrollTop = 0;
      }
      return { overflowX, scrolledOk };
    });
    // A few px of slop for scrollbars; a real horizontal-scroll bug is tens/hundreds of px.
    if (m.overflowX > 16) failures.push(`${v}: horizontal overflow ${m.overflowX}px`);
    if (!m.scrolledOk) failures.push(`${v}: not vertically scrollable`);
  }
  expect(failures, failures.join('\n')).toEqual([]);
});
