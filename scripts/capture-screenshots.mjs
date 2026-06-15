// Capture real screenshots of the running app for the capability deck.
// Boots index.html with the bundled demo data (mirrors tests/e2e/helpers.ts),
// navigates to key views and writes PNGs to dist/shots/.
// Requires a static server on 127.0.0.1:8765 (python3 -m http.server) + Playwright.
// Run via scripts (see package note); not part of the app build.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'dist', 'shots');
const BASE = 'http://127.0.0.1:8765';

const BRIDGE =
  'window.App = App; window.Sprint = Sprint; window.Gantt = Gantt; window.Kanban = Kanban; window.Capacity = Capacity; window.Dashboard = Dashboard;';

// [filename, view-id, settle-ms]
const VIEWS = [
  ['projects', 'dashboard', 700],
  ['board', 'board', 800],
  ['roadmap', 'roadmap', 1100],
  ['capacity', 'capacity', 900],
  ['raid', 'raid', 800],
  ['strategy', 'metrics', 800]
];

async function launch() {
  try { return await chromium.launch({ channel: 'chromium-headless-shell' }); }
  catch (e) { return await chromium.launch(); }
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: 2 });

// Boot with demo data (mirror openAppWithData).
const res = await page.request.get(BASE + '/portfolio-data.json');
const json = await res.text();
await page.goto(BASE + '/index.html');
await page.evaluate((data) => {
  localStorage.setItem('portfolio-command-centre-data', data);
  localStorage.setItem('portfolio-command-centre-meta', JSON.stringify({ savedAt: new Date().toISOString(), projectCount: JSON.parse(data).projects.length }));
}, json);
await page.reload();
await page.waitForSelector('#restoreBanner button.btn-primary', { state: 'visible', timeout: 8000 });
await page.click('#restoreBanner button.btn-primary');
await page.waitForSelector('#projectTableBody tr, .empty-state', { state: 'visible', timeout: 8000 });
await page.addScriptTag({ content: BRIDGE });
await page.evaluate(() => { try { window.App.setActiveCustomer('Acme Industries'); } catch (e) {} });
// Dismiss the assistant briefing / any open panel so shots are clean.
await page.evaluate(() => { try { document.querySelectorAll('.assistant-panel.open .panel-close, .modal-overlay.open .panel-close').forEach(b => b.click()); } catch (e) {} });

fs.mkdirSync(SHOTS, { recursive: true });
for (const [name, view, settle] of VIEWS) {
  try {
    await page.evaluate((v) => window.App.navigate(v), view);
    await page.waitForTimeout(settle);
    await page.screenshot({ path: path.join(SHOTS, name + '.png') });
    console.log('shot:', name, '(' + view + ')');
  } catch (e) {
    console.warn('skip', name, '-', e.message);
  }
}
await browser.close();
console.log('Screenshots in', SHOTS);
