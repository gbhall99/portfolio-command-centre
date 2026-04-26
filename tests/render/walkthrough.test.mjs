import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Walkthrough — sectioned overlay', () => {
  it('renders all 9 section headers in stable order', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(2);
    const proj = makeProject({ name: 'P' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints, team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Sprint.openWalkthrough();
    const overlay = app.window.document.getElementById('walkthroughOverlay');
    expect(overlay).not.toBeNull();
    const html = overlay.innerHTML;
    // The HTML escapes & → &amp; — look for the visible text fragments instead.
    [
      "What's changed",
      'RAG movers',
      'Top risks',
      'Issues',          // "Issues &amp; blocked projects"
      'Governance actions',
      'Chip progress',
      'Backlog refinement',
      'Capacity',        // "Capacity &amp; leave"
      'Decisions'
    ].forEach(s => { expect(html).toContain(s); });
  });

  it('exposes Mark covered / Skip toggles per section', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ name: 'P' })] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Sprint.openWalkthrough();
    const overlay = app.window.document.getElementById('walkthroughOverlay');
    expect(overlay.innerHTML).toContain('Mark covered');
    expect(overlay.innerHTML).toContain('Skip');
    app.teardown();
  });

  it('starts (or resumes) a walkthrough on open and reuses on subsequent opens', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ name: 'P' })] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Sprint.openWalkthrough();
    const len1 = app.App.data.walkthroughs.length;
    app.window.document.getElementById('walkthroughOverlay').remove();
    app.Sprint.openWalkthrough();
    expect(app.App.data.walkthroughs.length).toBe(len1);  // resumed, not duplicated
    app.teardown();
  });
});
