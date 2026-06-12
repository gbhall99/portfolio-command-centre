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
    const Reports = app.window.__pcc__.Reports;
    const html = Reports.Doc.toHtml(Reports.Builders.walkthroughMinutes(id), {});
    expect(typeof html).toBe('string');
    expect(html).toMatch(/Walkthrough/i);
    expect(html).toMatch(/SM/);
    expect(html).toMatch(/Defer DE/);
    expect(html).toMatch(/Confirm Veena/);
    app.teardown();
  });
});

describe('Walkthrough minutes — data updates', () => {
  it('lists data_updates with their type, project, before/after', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P', rag_schedule: 'Green' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    app.App.updateProjectRag(proj.id, 'schedule', 'Red', wid, 'urgent');
    const Reports = app.window.__pcc__.Reports;
    const html = Reports.Doc.toHtml(Reports.Builders.walkthroughMinutes(wid), {});
    expect(html).toMatch(/Data updates/);
    expect(html).toMatch(/rag/);
    expect(html).toMatch(/Green/);
    expect(html).toMatch(/Red/);
    app.teardown();
  });

  it('escapes risk_score and progress update values from imported data (no raw markup)', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const wid = app.App.startWalkthrough('Acme Industries', []);
    const wt = app.App.data.walkthroughs.find(w => w.id === wid);
    // Crafted data_updates as they could arrive via a malicious portfolio JSON import.
    wt.data_updates = [
      {
        kind: 'risk_score', project_id: proj.id, description: 'r1',
        from: { impact: '<img src=x onerror=alert(1)>', probability: '<b>p</b>' },
        to: { impact: '<script>x()</script>', probability: 3 }
      },
      { kind: 'progress', project_id: proj.id, skill: 'DE', sprint: 'S1', from: '<img src=x onerror=alert(2)>', to: '<i>9</i>' }
    ];
    const Reports = app.window.__pcc__.Reports;
    const html = Reports.Doc.toHtml(Reports.Builders.walkthroughMinutes(wid), {});
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script>x()</script>');
    expect(html).not.toContain('<b>p</b>');
    expect(html).not.toContain('<img src=x onerror=alert(2)>');
    expect(html).not.toContain('<i>9</i>');
    // Escaped values still appear in the rendered minutes.
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;i&gt;9&lt;/i&gt;');
    app.teardown();
  });
});
