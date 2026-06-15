// Roadmap/Gantt alignment regression guard.
//
// The label column and the chart (bar) column scroll as one body, so their per-row
// scaffolding must agree pixel-for-pixel or every bar drifts below its project label:
//   1. The label column's "Timeline" header must equal the chart's annotation row height
//      (both = ANNOTATION_H). A mismatch (the old 22px vs 34px) pushed the whole chart down.
//   2. The dependency-arrow geometry's rowH must equal the rendered .gantt-row CSS height
//      (56px), else connector arrows drift further off-row the lower you scroll.
//   3. mainBarMidOffset must point at the bar's true vertical centre (.gantt-bar top 22 +
//      height/2) so arrows attach on the bar, not above it.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const INDEX_HTML = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');

describe('Gantt alignment', () => {
  it('the label "Timeline" header height equals the annotation-row height', async () => {
    resetIdSeq();
    const startMs = Date.now();
    const fmt = ms => new Date(ms).toISOString().slice(0, 10);
    const sprints = [{ sprint_id: 'CY99-S1', start_date: fmt(startMs - 7 * 86400000), hardening_start: fmt(startMs + 21 * 86400000), end_date: fmt(startMs + 28 * 86400000) }];
    const proj = makeProject({ name: 'AlignProject', start_date: fmt(startMs), target_date: fmt(startMs + 60 * 86400000), size_engineering: 10 });
    proj.skill_splits = { size_engineering: [{ sprint: 'CY99-S1', points: 10, status: 'pending' }] };
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('roadmap');
    if (typeof app.Gantt.render === 'function') app.Gantt.render();

    const doc = app.window.document;
    const head = doc.querySelector('.gantt-timeline-head');
    const annotation = doc.querySelector('.gantt-annotation-row');
    expect(head, 'Timeline header should render').not.toBeNull();
    expect(annotation, 'annotation row should render').not.toBeNull();
    // The whole alignment hinges on these two heights being identical.
    expect(head.style.height).toBe(annotation.style.height);
    expect(head.style.height).toBe('34px');
    app.teardown();
  });

  it('arrow geometry constants stay pinned to the CSS (rowH=56, bar-centre attach point)', () => {
    // rowH MUST equal the .gantt-row / .gantt-label-row CSS height (56px). The stale 36 caused
    // cumulative dependency-arrow drift.
    expect(INDEX_HTML).toMatch(/const rowH = 56;/);
    expect(INDEX_HTML).not.toMatch(/const rowH = 36;/);
    // The .gantt-row CSS this depends on is 56px.
    expect(INDEX_HTML).toMatch(/\.gantt-row \{ height: 56px;/);
    // Arrows attach at the main bar's vertical centre = .gantt-bar top (22) + height/2.
    expect(INDEX_HTML).toMatch(/const mainBarMidOffset = 22 \+ 24 \/ 2;/);
  });
});
