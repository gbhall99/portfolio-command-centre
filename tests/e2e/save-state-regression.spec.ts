import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

// Regression guard (requested by SM): loadDemoData() followed by navigate('governance')
// must NOT leave the app in a dirty state. This is the exact invariant that broke —
// the amber #unsavedDot reappeared after a clean demo load + view change. A green test
// here keeps the save-state from regressing again.
test('loadDemoData then navigate(governance) leaves app clean (isDirty false, #unsavedDot hidden)', async ({ page }) => {
  await openAppWithData(page);

  // Trigger the async (fetch-based) demo load, then wait for the demo customers to land.
  await page.evaluate(() => (window as any).App.loadDemoData());
  await page.waitForFunction(() => {
    const App = (window as any).App;
    if (!App || !App.data || !Array.isArray(App.data.customers)) return false;
    return App.data.customers.some((c: any) => c && c.name === 'Acme Industries');
  }, undefined, { timeout: 5000 });

  // The exact reproduction: navigate to governance after the demo load.
  await page.evaluate(() => (window as any).App.navigate('governance'));

  const state = await page.evaluate(() => {
    const App = (window as any).App;
    const dot = document.getElementById('unsavedDot');
    return {
      isDirty: App.isDirty,
      dotHasVisible: !!(dot && dot.classList.contains('visible')),
      // not visible == zero layout box (display:none keeps offsetParent null / size 0)
      dotShown: !!(dot && (dot as HTMLElement).offsetWidth > 0),
    };
  });

  expect(state.isDirty).toBe(false);
  expect(state.dotHasVisible).toBe(false);
  expect(state.dotShown).toBe(false);
});
