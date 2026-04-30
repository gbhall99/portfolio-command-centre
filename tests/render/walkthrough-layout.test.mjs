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

describe('Walkthrough — Project narrative panel', () => {
  it('renders Project narrative header with pack annotations', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-NP1' });
    const app = await loadApp(makeDataset({ projects: [p], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    app.Walkthrough.selectProject('GCC-NP1');
    const cust = app.window.document.querySelector('.wt-cust');
    expect(cust.innerHTML).toMatch(/Project narrative/);
    expect(cust.innerHTML).toMatch(/customer · forum · sponsor/i);
    expect(cust.innerHTML).toMatch(/data-narrative-field="headline"/);
    app.teardown();
  });

  it('typing a headline writes through to project.narrative.headline', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'GCC-NP2' });
    const app = await loadApp(makeDataset({ projects: [p], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    app.Walkthrough.selectProject('GCC-NP2');
    const head = app.window.document.querySelector('[data-narrative-field="headline"]');
    head.value = 'Phase 1 on track';
    head.dispatchEvent(new app.window.Event('change', { bubbles: true }));
    expect(app.App.data.projects[0].narrative.headline).toBe('Phase 1 on track');
    app.teardown();
  });
});

describe('Walkthrough — keyboard shortcuts', () => {
  it('Cmd+Enter advances to the next unreviewed project', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'GCC-K1', name: 'Alpha' });
    const b = makeProject({ id: 'GCC-K2', name: 'Beta' });
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    app.Walkthrough.selectProject('GCC-K1');
    const evt = new app.window.KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true });
    app.window.document.dispatchEvent(evt);
    expect(app.Walkthrough.activeProjectId).toBe('GCC-K2');
    app.teardown();
  });

  it('Cmd+Enter inside a textarea does NOT advance — typing is preserved', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'GCC-K-A', name: 'Alpha' });
    const b = makeProject({ id: 'GCC-K-B', name: 'Beta' });
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.Walkthrough.open('GCC');
    app.Walkthrough.selectProject('GCC-K-A');
    const headline = app.window.document.querySelector('[data-narrative-field="headline"]');
    // Dispatch the keydown FROM the textarea so e.target is the textarea.
    const evt = new app.window.KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true });
    headline.dispatchEvent(evt);
    expect(app.Walkthrough.activeProjectId).toBe('GCC-K-A'); // unchanged
    app.teardown();
  });
});
