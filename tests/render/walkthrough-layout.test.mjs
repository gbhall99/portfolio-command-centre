import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Walkthrough — three-column layout', () => {
  it('renders top bar, project list, centre column, narrative panel, bottom bar', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'GCC-L1', name: 'Alpha' });
    const b = makeProject({ id: 'GCC-L2', name: 'Beta' });
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    const overlay = app.window.document.getElementById('walkthroughOverlay');
    expect(overlay).not.toBeNull();
    const html = overlay.innerHTML;
    expect(html).toMatch(/wt-top/);
    expect(html).toMatch(/wt-list/);
    expect(html).toMatch(/wt-center/);
    expect(html).toMatch(/wt-cust/);
    expect(html).toMatch(/wt-bottom/);
    app.teardown();
  });

  it('selecting a project from the left rail updates activeProjectId and re-renders centre', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'GCC-L3', name: 'Alpha' });
    const b = makeProject({ id: 'GCC-L4', name: 'Beta' });
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    const idBefore = app.Walkthrough.activeProjectId;
    const otherId = idBefore === 'GCC-L3' ? 'GCC-L4' : 'GCC-L3';
    app.Walkthrough.selectProject(otherId);
    expect(app.Walkthrough.activeProjectId).toBe(otherId);
    const overlay = app.window.document.getElementById('walkthroughOverlay');
    const centerHtml = overlay.querySelector('.wt-center').innerHTML;
    expect(centerHtml).toMatch(otherId === 'GCC-L3' ? /Alpha/ : /Beta/);
    app.teardown();
  });

  it('typed text in narrative panel persists across project switches', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'GCC-L5', name: 'Alpha' });
    const b = makeProject({ id: 'GCC-L6', name: 'Beta' });
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    app.Walkthrough.selectProject('GCC-L5');
    app.App.updateProjectNarrative('GCC-L5', { headline: 'Headline for Alpha' }, app.App.getActiveWalkthrough('GCC').id);
    app.Walkthrough.selectProject('GCC-L6');
    app.Walkthrough.selectProject('GCC-L5');
    const head = app.window.document.querySelector('[data-narrative-field="headline"]');
    expect(head && head.value).toBe('Headline for Alpha');
    app.teardown();
  });
});
