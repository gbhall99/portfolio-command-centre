import { test, expect } from '@playwright/test';
import { openAppWithData } from './helpers';

test.describe('P3 — Forum agenda', () => {
  test('Governance.buildAgendaDoc is callable', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const G: any = (window as any).Governance;
      const f = ((window as any).App.data.governance_forums || [])[0];
      if (!f) return true;
      const doc = G.buildAgendaDoc(f.id || f.name);
      return !!(doc && String(doc).length);
    });
    expect(ok).toBe(true);
  });
});

test.describe('P3 — Bus factor + business case', () => {
  test('App.computeBusFactor returns a map', async ({ page }) => {
    await openAppWithData(page);
    const bf = await page.evaluate(() => {
      const App: any = (window as any).App;
      const p = App.data.projects[0];
      return App.computeBusFactor(p);
    });
    expect(typeof bf).toBe('object');
  });

  test('Reports.Builders.businessCase returns content', async ({ page }) => {
    await openAppWithData(page);
    const ok = await page.evaluate(() => {
      const Reports: any = (window as any).Reports;
      const App: any = (window as any).App;
      const p = App.data.projects[0];
      const doc = Reports.Builders.businessCase(p.id);
      const html = Reports.Doc.toHtml(doc, {});
      return !!(doc && doc.sections.length && html.length);
    });
    expect(ok).toBe(true);
  });
});
