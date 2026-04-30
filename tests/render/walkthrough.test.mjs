import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Walkthrough — card-based redesign', () => {
  // SKIPPED: task 7 replaced the card-based overlay with the three-column shell (Walkthrough module).
  // These card-based assertions will be rewritten in tasks 8-12.
  it.skip('renders the project as a card with attention chip + RAG dots + progress strip', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'P', status: 'Blocked', rag_schedule: 'Red', size_engineering: 10,
      skill_splits: { size_engineering: [{ sprint: sprints[0].sprint_id, points: 10, status: 'pending', completed: 2, assigned_to: [], reasons: [] }] }
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Sprint.openWalkthrough();
    const overlay = app.window.document.getElementById('walkthroughOverlay');
    expect(overlay).not.toBeNull();
    const html = overlay.innerHTML;
    expect(html).toMatch(/wt-card/);
    expect(html).toMatch(/wt-rag-dots/);
    expect(html).toMatch(/wt-progress-bar/);
    expect(html).toMatch(/Attention/);
    app.teardown();
  });

  // SKIPPED: task 7 replaced the card-based overlay with the three-column shell (Walkthrough module).
  it.skip('exposes Reviewed + Pin buttons and the inline status select / RAG dots / risk + chip editors', async () => {
    resetIdSeq();
    const startMs = Date.now();
    const fmt = ms => new Date(ms).toISOString().slice(0, 10);
    const sprints = [{ sprint_id: 'CY99-S1', start_date: fmt(startMs - 7 * 86400000), hardening_start: fmt(startMs + 21 * 86400000), end_date: fmt(startMs + 28 * 86400000) }];
    const proj = makeProject({ name: 'P', status: 'Blocked', rag_schedule: 'Amber', size_engineering: 10,
      skill_splits: { size_engineering: [{ sprint: 'CY99-S1', points: 10, status: 'pending', completed: 2, assigned_to: [], reasons: [] }] }
    });
    proj.risks_register = [{ description: 'R1', impact: 5, probability: 5, status: 'open' }];
    proj.size_total = 10;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Sprint.openWalkthrough();
    const html = app.window.document.getElementById('walkthroughOverlay').innerHTML;
    expect(html).toMatch(/data-wt-card-review/);
    expect(html).toMatch(/data-wt-card-pin/);
    expect(html).toMatch(/data-wt-card-rag/);
    expect(html).toMatch(/_wtStatusChange/);
    expect(html).toMatch(/_wtCardChipChange/);
    expect(html).toMatch(/_wtCardRisk/);
    app.teardown();
  });

  it('starts (or resumes) a walkthrough on open and reuses on subsequent opens', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ name: 'P' })] }));
    app.App.activeCustomer = 'GCC';
    app.Sprint.openWalkthrough();
    const len1 = app.App.data.walkthroughs.length;
    app.window.document.getElementById('walkthroughOverlay').remove();
    app.Sprint.openWalkthrough();
    expect(app.App.data.walkthroughs.length).toBe(len1);
    app.teardown();
  });

  // SKIPPED: task 7 replaced the card-based overlay with the three-column shell (Walkthrough module).
  it.skip('marking a project reviewed collapses its card on next render', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ name: 'P' })] }));
    app.App.activeCustomer = 'GCC';
    app.Sprint.openWalkthrough();
    const wt = app.App.data.walkthroughs[0];
    app.App.setWalkthroughSectionStatus(wt.id, 'proj:GCC-001', 'reviewed');
    app.Sprint.openWalkthrough();
    const html = app.window.document.getElementById('walkthroughOverlay').innerHTML;
    expect(html).toMatch(/wt-card-reviewed/);
    expect(html).toMatch(/✓ P reviewed/);
    app.teardown();
  });
});
