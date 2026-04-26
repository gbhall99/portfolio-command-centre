// jsdom harness — loads the production index.html into a fresh jsdom instance,
// hydrates it with fixture data, and returns handles to App/Solver/Sprint/etc.
//
// The production file uses top-level `const` declarations for each subsystem.
// `const`s at script scope live in the shared "Script Record" scope and are
// visible to subsequent <script> tags in the same realm, so we append a small
// bridge script that stashes them on window.__pcc__.

import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const INDEX_HTML_PATH = path.join(REPO_ROOT, 'index.html');

/**
 * Boot a jsdom instance with the production app loaded and hydrated.
 *
 * @param {object} [fixture]  Optional portfolio-data-shaped object. If omitted,
 *                            portfolio-data.json is used. Pass `null` to boot
 *                            without any data hydration (file-loader state).
 * @param {object} [opts]
 * @param {boolean} [opts.silent=true]  Suppress console.* from the app.
 * @returns {Promise<{ window, document, App, Solver, Sprint, Dashboard, Gantt, Capacity, Governance, DetailPanel, AuditPanel, teardown }>}
 */
export async function loadApp(fixture, opts = {}) {
  const silent = opts.silent !== false;

  let indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

  // Bridge script: fires after all top-level declarations are bound. We inject BEFORE the final
  // </body> only — the source contains other </body> substrings inside JS template strings (report
  // generation code), and replacing those would corrupt the inline scripts.
  const bridge =
    '<script>window.__pcc__ = { App, Solver, Sprint, Dashboard, Gantt, Capacity, Governance, DetailPanel, AuditPanel, Forecast };</script>';
  const lastBody = indexHtml.lastIndexOf('</body>');
  if (lastBody === -1) throw new Error('Could not find </body> in index.html');
  indexHtml = indexHtml.slice(0, lastBody) + bridge + indexHtml.slice(lastBody);

  const virtualConsole = new VirtualConsole();
  if (!silent) virtualConsole.sendTo(console);
  // Always surface hard errors so real bugs don't silently swallow.
  virtualConsole.on('jsdomError', (err) => {
    console.error('[jsdom]', err.message, err.detail || '');
  });

  const dom = new JSDOM(indexHtml, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/',
    virtualConsole,
    beforeParse(window) {
      // Stub APIs jsdom doesn't implement or that would pollute test output.
      window.HTMLCanvasElement.prototype.getContext = () => ({
        fillRect() {}, clearRect() {}, getImageData: () => ({ data: [] }),
        putImageData() {}, createImageData: () => ([]), setTransform() {},
        drawImage() {}, save() {}, restore() {}, beginPath() {}, moveTo() {},
        lineTo() {}, closePath() {}, stroke() {}, fill() {}, arc() {},
        rect() {}, fillText() {}, measureText: () => ({ width: 0 }),
        translate() {}, scale() {}, rotate() {}, strokeRect() {}
      });
      window.open = () => ({ document: { write() {}, close() {} } });
      window.print = () => {};
      // Fetch gets a benign stub — real network should never happen in tests.
      window.fetch = () => Promise.reject(new Error('fetch is stubbed in tests'));
      // alert/confirm/prompt stubs so tests don't hang on dialogs
      window.alert = () => {};
      window.confirm = () => true;
      window.prompt = () => null;
    }
  });

  // Wait for DOMContentLoaded + load events. App.init() runs on DOMContentLoaded.
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for load event')), 8000);
    dom.window.addEventListener('load', () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  const handles = dom.window.__pcc__;
  if (!handles || !handles.App) {
    throw new Error('Bridge script did not expose window.__pcc__. Check that index.html still uses top-level const declarations.');
  }

  // Clear the 60-second auto-save interval; tests shouldn't race it.
  if (handles.App.autoSaveTimer) {
    dom.window.clearInterval(handles.App.autoSaveTimer);
    handles.App.autoSaveTimer = 0;
  }

  // Hydrate with fixture data unless explicitly suppressed.
  if (fixture !== null) {
    const data = fixture || JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'portfolio-data.json'), 'utf8'));
    handles.App.validateAndLoad(data);
    // Re-clear the interval that onDataLoaded -> startAutoSave restarted.
    if (handles.App.autoSaveTimer) {
      dom.window.clearInterval(handles.App.autoSaveTimer);
      handles.App.autoSaveTimer = 0;
    }
  }

  const teardown = () => dom.window.close();

  return {
    window: dom.window,
    document: dom.window.document,
    App: handles.App,
    Solver: handles.Solver,
    Sprint: handles.Sprint,
    Dashboard: handles.Dashboard,
    Gantt: handles.Gantt,
    Capacity: handles.Capacity,
    Governance: handles.Governance,
    DetailPanel: handles.DetailPanel,
    AuditPanel: handles.AuditPanel,
    Forecast: handles.Forecast,
    teardown
  };
}
