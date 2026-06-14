// Phase 3.2 — wireframe build-to-spec++ (field/calc map + acceptance checklist)
// and the vision "compare to built" diff. Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

let app;

const tdef = () => app.Definitions.loadJson('tableau/wireframe-definition.json');

function buildWireframe() {
  const { Wireframe } = app;
  const def = tdef();
  const wf = Wireframe.create({ customer: 'Acme Industries', definition: def, name: 'Exec Overview', source: 'test' });
  // A title (top row), a KPI bound to a metric, and a line chart.
  const title = Wireframe.addComponent(wf.id, 'title', def, { x: 0, y: 0 });
  Wireframe.updateComponent(wf.id, title.id, { x: 0, y: 0, w: 6, h: 1, title: 'Sales Overview' }, def);
  const kpi = Wireframe.addComponent(wf.id, 'kpi', def, { x: 0, y: 1 });
  Wireframe.updateComponent(wf.id, kpi.id, { x: 0, y: 1, w: 2, h: 1, title: 'Revenue' }, def);
  Wireframe.setComponentMetric(wf.id, kpi.id, 'MET-1', def);
  const line = Wireframe.addComponent(wf.id, 'line', def, { x: 0, y: 3 });
  Wireframe.updateComponent(wf.id, line.id, { x: 0, y: 3, w: 6, h: 3, title: 'Revenue trend' }, def);
  Wireframe.setComponentMetric(wf.id, line.id, 'MET-1', def);
  return Wireframe.get(wf.id);
}

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries' }],
    metrics: [makeMetric({ id: 'MET-1', name: 'Revenue', customer: 'Acme Industries', unit: '£' })]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('field/calc map', () => {
  it('maps each data-bearing component to a field + aggregation; flags unbound', () => {
    const wf = buildWireframe();
    const fm = app.Wireframe.fieldMap(wf);
    // title is excluded; kpi + line are mapped.
    expect(fm.map(r => r.component).sort()).toEqual(['kpi', 'line']);
    const kpi = fm.find(r => r.component === 'kpi');
    expect(kpi.field).toBe('[Revenue]');
    expect(kpi.aggregation).toMatch(/headline/i);
    expect(kpi.calc).toBe(''); // bound → no calc note
    // Unbind the line and re-map → it now needs a calc/source.
    const lineComp = wf.components.find(c => c.type === 'line');
    app.Wireframe.setComponentMetric(wf.id, lineComp.id, '', tdef());
    const fm2 = app.Wireframe.fieldMap(app.Wireframe.get(wf.id));
    expect(fm2.find(r => r.component === 'line').calc).toMatch(/Define the calc/);
  });
});

describe('acceptance checklist', () => {
  it('includes a grid item, the answers, and a per-component check', () => {
    const wf = buildWireframe();
    const items = app.Wireframe.acceptanceChecklist(wf, tdef());
    expect(items.some(x => /grid/i.test(x))).toBe(true);
    expect(items.some(x => /KPI .*Revenue.*headline/i.test(x))).toBe(true);
    expect(items.some(x => /line chart .*takeaway/i.test(x))).toBe(true);
    expect(items.some(x => /governed design rules/i.test(x))).toBe(true);
  });
});

describe('build spec report carries the new sections', () => {
  it('wireframe_spec doc includes Field & calc map and Acceptance checklist', () => {
    const wf = buildWireframe();
    const doc = app.Reports.Builders.wireframeSpec(wf.id);
    expect(doc).not.toBeNull();
    const ids = doc.sections.map(s => s.id);
    expect(ids).toContain('ws-fieldmap');
    expect(ids).toContain('ws-checklist');
    const fmSection = doc.sections.find(s => s.id === 'ws-fieldmap');
    expect(fmSection.html).toContain('[Revenue]');
  });
});

describe('compare to built — vision/text branching', () => {
  it('attaches the screenshot only when the model is vision-capable; spec always grounds it', () => {
    const wf = buildWireframe();
    const image = { mime: 'image/png', data: 'AAAA' };
    const visionMsgs = app.WireframeSkill._compareMessages(wf, image, true);
    expect(visionMsgs[1].images).toEqual([{ mime: 'image/png', data: 'AAAA' }]);
    expect(visionMsgs[1].content).toContain('APPROVED SPEC');
    expect(visionMsgs[1].content).toContain('field_map');
    expect(visionMsgs[0].content).toMatch(/screenshot .* attached/i);

    const textMsgs = app.WireframeSkill._compareMessages(wf, image, false);
    expect(textMsgs[1].images).toBeUndefined();           // text-only: no image
    expect(textMsgs[1].content).toContain('APPROVED SPEC'); // still grounded
    expect(textMsgs[0].content).toMatch(/text-only/i);
  });

  it('_parseDataUrl splits a data URL into mime + base64', () => {
    expect(app.WireframeSkill._parseDataUrl('data:image/png;base64,QUJD')).toEqual({ mime: 'image/png', data: 'QUJD' });
    expect(app.WireframeSkill._parseDataUrl('not-a-data-url')).toBeNull();
  });

  it('compareToBuilt runs end-to-end through the mock and shows a result', async () => {
    const { AI, WireframeSkill, document } = app;
    const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(id);
    const wf = buildWireframe();
    WireframeSkill._wfId = wf.id; WireframeSkill._mode = 'edit';
    AI.ADAPTERS.mock.program([{ text: 'Matches: KPI and trend present. Mismatch: filter missing. Verdict: mostly conforms.' }]);
    await WireframeSkill.compareToBuilt('data:image/png;base64,QUJD');
    const ov = document.getElementById('wfCompareOverlay');
    expect(ov).not.toBeNull();
    expect(ov.textContent).toContain('Verdict: mostly conforms');
    ov.remove();
  });
});
