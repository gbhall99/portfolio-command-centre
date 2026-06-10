import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

// WS5 — SOW skill: blank-template flow, definition validation blocking
// approval, resolve-and-approve, export gating. (Generation itself is
// covered by unit tests with the mock adapter.)

test('blank SOW → flags block approval → fill + resolve → approve', async ({ page }) => {
  await openAppWithData(page);
  await page.addScriptTag({ content: 'window.SowSkill = SowSkill; window.Sow = Sow; window.App = App;' });

  // Launch the skill and start from the blank template (no AI needed).
  await page.evaluate(() => (window as any).SowSkill.open({}));
  await expect(page.locator('#sowModalOverlay')).toHaveClass(/open/);
  await expect(page.locator('#sowModal')).toContainText('No SOWs yet');
  await page.click('text=Start blank from template');

  // Every required section is flagged; approval is impossible from Draft.
  await expect(page.locator('#sowModal .sow-status-chip.Draft').first()).toBeVisible();
  const flagged = await page.locator('#sowModal .sow-section.flagged').count();
  expect(flagged).toBeGreaterThanOrEqual(8);
  await expect(page.locator('#sowSide .sow-validation .err').first()).toBeVisible();

  // Move to Review, try to approve — blocked by validation.
  await page.click('text=Send to Review');
  await expect(page.locator('#sowModal .sow-status-chip.Review').first()).toBeVisible();
  await page.click('button:has-text("Approve")');
  await expect(page.locator('#sowModal .sow-status-chip.Approved')).toHaveCount(0);

  // Fill all sections + resolve flags through the entity API (faster than
  // typing 11 textareas), then approve through the real button.
  await page.evaluate(() => {
    const Sow = (window as any).Sow;
    const sow = Sow.list((window as any).App.activeCustomer)[0];
    const filler = Array.from({ length: 45 }, (_, i) => 'word' + i).join(' ');
    sow.sections.forEach((sec: any) => {
      Sow.updateSection(sow.id, sec.id, filler);
      Sow.resolveFlag(sow.id, sec.id);
    });
    (window as any).SowSkill.render();
  });
  await expect(page.locator('#sowSide .sow-validation .ok')).toBeVisible();
  await page.click('button:has-text("Approve")');
  await expect(page.locator('#sowModal .sow-status-chip.Approved').first()).toBeVisible();

  // Approved SOW locks its section editors.
  const disabled = await page.locator('#sowModal .sow-section textarea[disabled]').count();
  expect(disabled).toBeGreaterThanOrEqual(11);
});
