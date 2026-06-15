// Issues 5, 6, 7 — Gantt cleanup.
// 5. Removed ganttExecutive / ganttConfidence toggles + priority recommendation chip overlay.
//    (The Critical Path toggle was re-introduced — now solver-backed — at user request.)
// 6. --gantt-labels-width default = 440px
// 7. Lifecycle chip is no longer rendered inside Gantt bar labels

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const INDEX_HTML = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');

describe('Gantt cleanup — Issues 5, 6, 7', () => {
  it('the toolbar no longer contains the Executive / Confidence checkboxes', () => {
    expect(INDEX_HTML).not.toMatch(/id="ganttExecutive"/);
    expect(INDEX_HTML).not.toMatch(/id="ganttConfidence"/);
  });

  it('the Critical Path toggle is present (re-introduced, solver-backed)', () => {
    expect(INDEX_HTML).toMatch(/id="ganttCriticalPath"/);
  });

  it('default --gantt-labels-width CSS variable is 440px', () => {
    // The desktop default lives at the top-level :root rule (the responsive overrides at narrower
    // breakpoints intentionally clamp it back down).
    const m = INDEX_HTML.match(/--gantt-labels-width:\s*(\d+)px[^;]*;/);
    expect(m).not.toBeNull();
    expect(parseInt(m[1], 10)).toBe(440);
  });

  it('Gantt bar label HTML no longer renders App.lifecycleStageChip', async () => {
    resetIdSeq();
    const startMs = Date.now();
    const fmt = ms => new Date(ms).toISOString().slice(0, 10);
    const sprints = [{ sprint_id: 'CY99-S1', start_date: fmt(startMs - 7 * 86400000), hardening_start: fmt(startMs + 21 * 86400000), end_date: fmt(startMs + 28 * 86400000) }];
    const proj = makeProject({ name: 'BarTestProject', start_date: fmt(startMs), target_date: fmt(startMs + 60 * 86400000), size_engineering: 10 });
    proj.skill_splits = { size_engineering: [{ sprint: 'CY99-S1', points: 10, status: 'pending' }] };
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('roadmap');
    if (typeof app.Gantt.render === 'function') app.Gantt.render();
    const ganttHtml = app.window.document.getElementById('ganttContainer')
      ? app.window.document.getElementById('ganttContainer').innerHTML
      : (app.window.document.querySelector('.gantt-container') || {}).innerHTML || '';
    // Bar labels no longer carry a lifecycle-chip span. (Other surfaces — Projects table, Detail Panel — still do.)
    const bars = ganttHtml.match(/class="bar-label"[\s\S]*?<\/span>/g) || [];
    bars.forEach(bar => {
      expect(bar).not.toMatch(/lifecycle-chip/);
    });
    app.teardown();
  });
});
