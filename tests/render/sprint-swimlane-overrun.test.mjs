// Sprint Planning swimlane — sprint name headers must not overrun the
// sticky-left project-name column when scrolled far right (Issue 4).
//
// CSS stack order: the corner cell <th class="sl-project-cell"> needs a
// higher z-index than the rest of the sprint header <th> row, otherwise
// the sprint chips slide on top of the project column when sticky-left
// kicks in.

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

describe('Sprint Planning swimlane — sprint name overrun', () => {
  it('renders the sticky project header and sprint headers', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      projects: [makeProject({ name: 'P1' })],
      sprints: makeSprintSequence(6),
      team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.Sprint.viewMode = 'swimlane';
    const board = app.window.document.getElementById('sprintBoard');
    if (board) app.Sprint.render();
    const html = (board && board.innerHTML) || '';
    expect(html).toMatch(/sl-project-cell[^>]*>\s*Project\s*</);
    expect(html).toMatch(/sl-sprint-hdr/);
    app.teardown();
  });

  it('CSS gives th.sl-project-cell a higher z-index than the sprint headers and clamps long sprint pills', () => {
    // Look for a th.sl-project-cell rule that bumps the corner cell above the rest of the sprint header row.
    expect(INDEX_HTML).toMatch(/\.sprint-swimlane\s+th\.sl-project-cell\s*\{[^}]*z-index:\s*([4-9]|[1-9][0-9]+)/);
    // Long sprint pill copy must clamp; otherwise the sprint title can overrun the project column when sticky-left.
    // Either a generic max-width on the header pill OR overflow:hidden + ellipsis on the inner span.
    expect(INDEX_HTML).toMatch(/\.sl-sprint-hdr[^{]*\{[^}]*(overflow:\s*hidden|max-width:\s*\d+)/i);
  });
});
