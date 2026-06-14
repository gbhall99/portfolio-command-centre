// W1b — wireframe build-spec export. Wireframe.toBuildSpec is pure; the Reports
// engine renders it via the wireframe_spec catalogue entry.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }],
    metrics: [makeMetric({ id: 'MET-1', name: 'Revenue', customer: 'Acme Industries' })],
    projects: [makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
  app.App.data.wireframes.push({
    id: 'WF-1', customer: 'Acme Industries', name: 'Exec board', project_id: 'A-1',
    grid: { cols: 12, rows: 8 }, status: 'Concept', template_id: 'default', template_kind: 'tableau',
    components: [
      { id: 'c2', type: 'kpi', title: 'Revenue KPI', x: 0, y: 2, w: 3, h: 2, metric_id: 'MET-1', props: {} },
      { id: 'c1', type: 'title', title: 'Exec board', x: 0, y: 0, w: 12, h: 1, props: {} }
    ],
    metric_ids: ['MET-1'],
    tableau_refs: [{ view_id: 'V1', name: 'Live Exec', workbook: 'Exec WB' }],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  });
});
afterEach(() => app.teardown());

describe('Wireframe.toBuildSpec', () => {
  it('emits components in reading order with geometry + bound metric', () => {
    const wf = app.Wireframe.get('WF-1');
    const spec = app.Wireframe.toBuildSpec(wf);
    expect(spec.grid).toEqual({ cols: 12, rows: 8 });
    // sorted by y then x → title (y0) before kpi (y2)
    expect(spec.components.map(c => c.type)).toEqual(['title', 'kpi']);
    const kpi = spec.components.find(c => c.type === 'kpi');
    expect(kpi).toMatchObject({ x: 0, y: 2, w: 3, h: 2, metric: 'Revenue' });
    expect(spec.metrics).toEqual(['Revenue']);
    expect(spec.references).toEqual([{ name: 'Live Exec', workbook: 'Exec WB' }]);
  });
});

describe('Reports wireframe_spec', () => {
  it('is registered and dispatches to the builder', () => {
    expect(app.Reports.Catalogue.map(c => c.id)).toContain('wireframe_spec');
    const doc = app.Reports._build('wireframe_spec', { wireframeId: 'WF-1' });
    expect(doc.reportType).toBe('wireframe_spec');
    const ids = doc.sections.map(s => s.id);
    expect(ids).toEqual(['ws-overview', 'ws-components', 'ws-refs']);
    const body = doc.sections.map(s => s.html).join(' ');
    expect(body).toContain('Revenue KPI');
    expect(body).toContain('Live Exec');
  });

  it('returns null for a missing wireframe', () => {
    expect(app.Reports._build('wireframe_spec', { wireframeId: 'NOPE' })).toBe(null);
  });

  it('exportBuildSpec routes through Reports.generate', () => {
    const calls = [];
    const orig = app.Reports.generate;
    app.Reports.generate = (id, args) => { calls.push([id, args]); };
    try {
      app.WireframeSkill._wfId = 'WF-1';
      app.WireframeSkill.exportBuildSpec();
    } finally { app.Reports.generate = orig; }
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toBe('wireframe_spec');
    expect(calls[0][1].wireframeId).toBe('WF-1');
  });
});
