import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Walkthrough — three-column layout', () => {
  it('renders top bar, project list, centre column, narrative panel, bottom bar', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'Acme Industries-L1', name: 'Alpha' });
    const b = makeProject({ id: 'Acme Industries-L2', name: 'Beta' });
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Walkthrough.open('Acme Industries');
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
    const a = makeProject({ id: 'Acme Industries-L3', name: 'Alpha' });
    const b = makeProject({ id: 'Acme Industries-L4', name: 'Beta' });
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Walkthrough.open('Acme Industries');
    const idBefore = app.Walkthrough.activeProjectId;
    const otherId = idBefore === 'Acme Industries-L3' ? 'Acme Industries-L4' : 'Acme Industries-L3';
    app.Walkthrough.selectProject(otherId);
    expect(app.Walkthrough.activeProjectId).toBe(otherId);
    const overlay = app.window.document.getElementById('walkthroughOverlay');
    const centerHtml = overlay.querySelector('.wt-center').innerHTML;
    expect(centerHtml).toMatch(otherId === 'Acme Industries-L3' ? /Alpha/ : /Beta/);
    app.teardown();
  });

  it('typed text in narrative panel persists across project switches', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'Acme Industries-L5', name: 'Alpha' });
    const b = makeProject({ id: 'Acme Industries-L6', name: 'Beta' });
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Walkthrough.open('Acme Industries');
    app.Walkthrough.selectProject('Acme Industries-L5');
    app.App.updateProjectNarrative('Acme Industries-L5', { headline: 'Headline for Alpha' }, app.App.getActiveWalkthrough('Acme Industries').id);
    app.Walkthrough.selectProject('Acme Industries-L6');
    app.Walkthrough.selectProject('Acme Industries-L5');
    const head = app.window.document.querySelector('[data-narrative-field="headline"]');
    expect(head && head.value).toBe('Headline for Alpha');
    app.teardown();
  });
});

describe('Walkthrough — Project narrative panel', () => {
  it('renders Project narrative header with pack annotations', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'Acme Industries-NP1' });
    const app = await loadApp(makeDataset({ projects: [p], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Walkthrough.open('Acme Industries');
    app.Walkthrough.selectProject('Acme Industries-NP1');
    const cust = app.window.document.querySelector('.wt-cust');
    expect(cust.innerHTML).toMatch(/Project narrative/);
    expect(cust.innerHTML).toMatch(/customer · forum · sponsor/i);
    expect(cust.innerHTML).toMatch(/data-narrative-field="headline"/);
    app.teardown();
  });

  it('typing a headline writes through to project.narrative.headline', async () => {
    resetIdSeq();
    const p = makeProject({ id: 'Acme Industries-NP2' });
    const app = await loadApp(makeDataset({ projects: [p], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Walkthrough.open('Acme Industries');
    app.Walkthrough.selectProject('Acme Industries-NP2');
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
    const a = makeProject({ id: 'Acme Industries-K1', name: 'Alpha' });
    const b = makeProject({ id: 'Acme Industries-K2', name: 'Beta' });
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Walkthrough.open('Acme Industries');
    app.Walkthrough.selectProject('Acme Industries-K1');
    const evt = new app.window.KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true });
    app.window.document.dispatchEvent(evt);
    expect(app.Walkthrough.activeProjectId).toBe('Acme Industries-K2');
    app.teardown();
  });

  it('Cmd+Enter inside a textarea does NOT advance — typing is preserved', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'Acme Industries-K-A', name: 'Alpha' });
    const b = makeProject({ id: 'Acme Industries-K-B', name: 'Beta' });
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.Walkthrough.open('Acme Industries');
    app.Walkthrough.selectProject('Acme Industries-K-A');
    const headline = app.window.document.querySelector('[data-narrative-field="headline"]');
    // Dispatch the keydown FROM the textarea so e.target is the textarea.
    const evt = new app.window.KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true });
    headline.dispatchEvent(evt);
    expect(app.Walkthrough.activeProjectId).toBe('Acme Industries-K-A'); // unchanged
    app.teardown();
  });
});
