import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

// WS6 — wireframe builder: blank canvas flow, palette placement from the
// governed vocabulary, live conformance feedback, selection + properties.

test('build a wireframe: palette placement, conformance updates, title fix clears warning', async ({ page }) => {
  await openAppWithData(page);
  await page.addScriptTag({ content: 'window.WireframeSkill = WireframeSkill; window.Wireframe = Wireframe; window.App = App;' });

  await page.evaluate(() => (window as any).WireframeSkill.open({}));
  await expect(page.locator('#wfModalOverlay')).toHaveClass(/open/);
  await page.click('text=+ New blank wireframe');

  // Canvas exists with a seeded title; conformance passes initially.
  await expect(page.locator('#wfCanvas')).toBeVisible();
  await expect(page.locator('#wfConf')).toContainText('conforms');

  // Add a bar chart from the palette — untitled chart triggers a warning.
  await page.click('.wf-palette button:has-text("Bar chart")');
  await expect(page.locator('#wfConf')).toContainText('no title');

  // The new component is selected; set a title via the properties panel.
  await page.fill('#wfTitleInput', 'North region drives growth');
  await expect(page.locator('#wfConf')).not.toContainText('no title');

  // W2: a charted component with no bound metric is nudged (the demo customer
  // has metrics). Bind one via the "Shows metric" picker to clear the nudge —
  // then the layout fully conforms.
  await expect(page.locator('#wfConf')).toContainText('not linked to a metric');
  await page.selectOption('#wfMetricSelect', { index: 1 });
  await expect(page.locator('#wfConf')).not.toContainText('not linked to a metric');
  await expect(page.locator('#wfConf')).toContainText('conforms');

  // Vocabulary is the governed one: palette has exactly the definition's components.
  const paletteCount = await page.locator('.wf-palette button').count();
  expect(paletteCount).toBe(12);

  // Entity landed in the data model, customer-scoped.
  const wfState = await page.evaluate(() => {
    const wf = (window as any).Wireframe.list((window as any).App.activeCustomer)[0];
    return { components: wf.components.length, customer: wf.customer };
  });
  expect(wfState.components).toBe(2);
});
