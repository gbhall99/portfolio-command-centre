import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('Walkthrough minutes', () => {
  it('builds a doc with attendees, decisions, and actions sections', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'X' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const id = app.App.startWalkthrough('Acme Industries', ['SM', 'PO']);
    app.App.recordWalkthroughDecision(id, { projectId: proj.id, text: 'Defer DE', rationale: 'Sponsor concern' });
    app.App.recordWalkthroughAction(id, { description: 'Confirm Veena', owner: 'PO', due_date: '2026-04-30' });
    const Report = app.window.__pcc__.Report;
    const html = Report.buildWalkthroughMinutesDoc(id);
    expect(typeof html).toBe('string');
    expect(html).toMatch(/Walkthrough/i);
    expect(html).toMatch(/SM/);
    expect(html).toMatch(/Defer DE/);
    expect(html).toMatch(/Confirm Veena/);
    app.teardown();
  });
});
