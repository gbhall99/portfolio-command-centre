import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

/**
 * Regression guard for the 1280px header overflow that pushed the power-tools /
 * customer-mode / theme controls outside their container and clipped them off-screen.
 *
 * At the default 1280px viewport (playwright.config.ts), every header control must sit
 * fully within the bounds of its parent `.header-actions` cluster — i.e. not clipped by
 * the tools pill, not spilling past the right edge of the header. If the cluster ever
 * overflows again, one of these controls will render with a box that escapes the
 * container and this test will fail.
 */
const HEADER_CONTROL_IDS = [
  'btnPresent',
  'btnWhenBy',
  'btnScenarios',
  'btnSandbox',
  'viewAsPicker',
  'btnCustomerMode',
  'btnTheme',
];

test('every header control stays within .header-actions bounds at 1280px (no clipping)', async ({ page }) => {
  await openAppWithData(page);
  // Assert we are at the documented default viewport this guard is written against.
  const vp = page.viewportSize();
  expect(vp?.width).toBe(1280);

  const result = await page.evaluate((ids) => {
    const container = document.querySelector('.header-actions') as HTMLElement | null;
    if (!container) return { containerFound: false, controls: [] as any[] };
    const c = container.getBoundingClientRect();
    const controls = ids.map((id) => {
      const el = document.getElementById(id);
      if (!el) return { id, found: false };
      const r = el.getBoundingClientRect();
      return {
        id,
        found: true,
        visible: r.width > 0 && r.height > 0,
        // 1px tolerance for sub-pixel rounding / borders.
        withinLeft: r.left >= c.left - 1,
        withinRight: r.right <= c.right + 1,
        withinTop: r.top >= c.top - 1,
        withinBottom: r.bottom <= c.bottom + 1,
        // Not clipped past the viewport's right edge.
        withinViewport: r.right <= window.innerWidth + 1,
      };
    });
    return { containerFound: true, controls };
  }, HEADER_CONTROL_IDS);

  expect(result.containerFound).toBe(true);

  for (const ctrl of result.controls) {
    expect(ctrl.found, `header control #${ctrl.id} should exist`).toBe(true);
    expect(ctrl.visible, `header control #${ctrl.id} should be visible (non-zero box)`).toBe(true);
    expect(ctrl.withinLeft, `header control #${ctrl.id} should not overflow left of .header-actions`).toBe(true);
    expect(ctrl.withinRight, `header control #${ctrl.id} should not overflow right of .header-actions`).toBe(true);
    expect(ctrl.withinTop, `header control #${ctrl.id} should not overflow above .header-actions`).toBe(true);
    expect(ctrl.withinBottom, `header control #${ctrl.id} should not overflow below .header-actions`).toBe(true);
    expect(ctrl.withinViewport, `header control #${ctrl.id} should not be clipped past the viewport right edge`).toBe(true);
  }
});
