import type { Page } from '@playwright/test';

/**
 * Seed localStorage with portfolio-data.json and land on index.html with data already loaded.
 *
 * The app's top-level `const App = ...` doesn't attach to `window`, so we drive the restore
 * path via the actual UI button rather than page.evaluate. After data loads, we inject a
 * bridge that exposes App/Solver/Sprint/... on window so tests CAN poke internals afterwards.
 */
export async function openAppWithData(page: Page) {
  const res = await page.request.get('/portfolio-data.json');
  const json = await res.text();
  await page.goto('/index.html');
  await page.evaluate((data) => {
    localStorage.setItem('portfolio-command-centre-data', data);
    localStorage.setItem(
      'portfolio-command-centre-meta',
      JSON.stringify({ savedAt: new Date().toISOString(), projectCount: JSON.parse(data).projects.length })
    );
  }, json);
  await page.reload();
  // App.init() + checkLocalStorage() will have surfaced the restore banner — click it.
  await page.waitForSelector('#restoreBanner button.btn-primary', { state: 'visible', timeout: 5000 });
  await page.click('#restoreBanner button.btn-primary');
  await page.waitForSelector('#projectTableBody tr, .empty-state', { state: 'visible', timeout: 5000 });

  // Bridge for tests that need to poke internals — const-declared globals are visible to
  // script-context eval, so this script tag can read them and stash on window.
  await page.addScriptTag({
    content: 'window.App = App; window.Solver = Solver; window.Sprint = Sprint; window.Dashboard = Dashboard; window.Gantt = Gantt; window.Capacity = Capacity; window.Governance = Governance; window.DetailPanel = DetailPanel; window.AuditPanel = AuditPanel; window.Forecast = Forecast; window.Reports = Reports; window.Walkthrough = Walkthrough; window.Personas = Personas; window.Person = Person; window.Objectives = Objectives; window.Metrics = Metrics; window.MetricGroups = MetricGroups; window.Strategy = Strategy;'
  });
}
