import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

// WS2 — Assistant panel: header toggle, no-AI empty state routing to
// Settings → AI, keyboard shortcut, and a full mock-adapter chat round trip.

test('assistant opens from the header, shows connect-a-model state, routes to Settings → AI', async ({ page }) => {
  await openAppWithData(page);
  // Fresh installs seed a local Ollama profile; the connect state is the
  // explicitly-emptied-profiles state.
  await page.evaluate(() => localStorage.setItem('pcc_ai_settings', JSON.stringify({ profiles: [], defaultProfileId: null, taskDefaults: {} })));
  await page.click('#btnAssistant');
  await expect(page.locator('#assistantPanel')).toHaveClass(/open/);
  await expect(page.locator('#assistantBody')).toContainText('Connect a model');
  await page.click('#assistantBody .btn-primary');
  // Lands on the AI settings category.
  await expect(page.locator('#configBody')).toContainText('Model profiles');
  await expect(page.locator('#assistantPanel')).not.toHaveClass(/open/);
});

test('Ctrl+J toggles the assistant', async ({ page }) => {
  await openAppWithData(page);
  await page.keyboard.press('Control+j');
  await expect(page.locator('#assistantPanel')).toHaveClass(/open/);
  await page.keyboard.press('Control+j');
  await expect(page.locator('#assistantPanel')).not.toHaveClass(/open/);
});

test('mock-adapter chat round trip renders answer and citation chip', async ({ page }) => {
  await openAppWithData(page);
  // Configure the mock adapter through the real AI settings API and program a
  // grounded answer with a tool call.
  await page.addScriptTag({
    content: `
      window.AI = AI; window.Assistant = Assistant;
      const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock', toolMode: 'native' });
      AI.setDefaultProfile(id);
      AI.ADAPTERS.mock.program([
        { toolCalls: [{ id: 'c1', name: 'list_projects', args: {} }] },
        { text: 'Here is your portfolio summary.' }
      ]);
    `
  });
  await page.click('#btnAssistant');
  await page.fill('#assistantInput', 'summarise my portfolio');
  await page.click('#assistantSend');
  await expect(page.locator('#assistantBody')).toContainText('Here is your portfolio summary.');
  await expect(page.locator('#assistantBody .assistant-cite').first()).toBeVisible();
  // Citation chip opens the project detail panel.
  await page.locator('#assistantBody .assistant-cite').first().click();
  await expect(page.locator('#detailPanel')).toHaveClass(/open/);
});
