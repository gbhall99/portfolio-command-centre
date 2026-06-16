// Report-pack enhancements (R1–R9): Gantt pipeline section, exec KPI band,
// commercial summary, charts, milestone ribbon, call-outs, appendix, composer.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [
      makeProject({ id: 'A-1', name: 'Alpha', customer: 'Acme Industries', status: 'In Progress', manager: 'Dana', priority: 1,
        start_date: '2026-06-01', target_date: '2026-09-01', hard_deadline: '2026-08-20', rag_schedule: 'Amber', size_total: 8 }),
      makeProject({ id: 'A-2', name: 'Beta', customer: 'Acme Industries', status: 'In Progress', manager: 'Lee', priority: 2,
        start_date: '2026-07-01', target_date: '2026-10-15', rag_schedule: 'Green', size_total: 5 })
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('R1 Gantt pipeline fragment', () => {
  it('renders a scoped, print-safe timeline for the given projects', () => {
    const { Gantt } = app;
    const html = Gantt.pipelineHtml(app.App.data.projects);
    expect(html).toContain('gp-wrap');
    expect(html).toContain('Alpha');
    expect(html).toContain('Beta');
    expect(html).toContain('gp-bar');        // a positioned bar per project
    expect(html).toContain('gp-ms');         // a hard-deadline diamond (Alpha)
    expect(html).toContain('Hard deadline'); // legend
  });
  it('degrades gracefully with no scheduled projects', () => {
    const { Gantt } = app;
    expect(Gantt.pipelineHtml([])).toContain('No scheduled projects');
  });
});

describe('R3–R9 pack sections', () => {
  it('portfolioPack embeds the pipeline + enhancement sections', () => {
    const doc = app.Reports.Builders.portfolioPack('Acme Industries');
    const ids = doc.sections.map(s => s.id);
    ['exec', 'pipeline', 'charts', 'callouts', 'commercials', 'milestone-ribbon', 'appendix'].forEach(id =>
      expect(ids).toContain(id));
    const pipeline = doc.sections.find(s => s.id === 'pipeline');
    expect(pipeline.html).toContain('gp-bar');
    // R4: commercial summary is grounded in Billing.plannedEconomics.
    const commercials = doc.sections.find(s => s.id === 'commercials');
    expect(commercials.html).toMatch(/Planned revenue|Planned margin/);
    // R3: exec KPI band tiles.
    expect(doc.sections.find(s => s.id === 'exec').html).toContain('On track');
  });

  it('customerPack embeds the pipeline (customer-safe)', () => {
    const doc = app.Reports.Builders.customerPack('Acme Industries');
    const ids = doc.sections.map(s => s.id);
    expect(ids).toContain('pipeline');
    expect(ids).toContain('milestone-ribbon');
    // No internal-only commercials/appendix in the customer pack section set.
    expect(ids).not.toContain('commercials');
    expect(ids).not.toContain('appendix');
  });
});

describe('R2 pack composer', () => {
  it('generatePack drops excluded sections before serializing', () => {
    const { Reports } = app;
    let captured = null;
    const origOpen = Reports.open;
    Reports.open = (html) => { captured = html; return { closed: false }; };
    try {
      Reports.generatePack({ audience: 'internal', exclude: ['pipeline', 'appendix'] });
    } finally { Reports.open = origOpen; }
    expect(captured).not.toBeNull();
    // Pipeline excluded → its signature class is gone; a kept section remains.
    expect(captured).not.toContain('gp-bar');
    expect(captured).toContain('Executive summary');
  });
});
