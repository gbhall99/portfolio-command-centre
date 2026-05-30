// UX benchmark overhaul — Wave 6 (final polish to close the residual gaps).
// R1 customer Outcomes view; R8 unified verdict vocabulary + heuristic tooltips; R4 keyboard-operable RAID headers.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Wave 6 R1 — Metrics shows a plain-language Outcomes view in customer mode', () => {
  it('customer mode renders an Outcomes summary and hides RACI/cascade jargon', async () => {
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries', size_total: 20, skill_splits: { engineering: [{ sprint: 'S1', points: 10, completed: 5 }] } })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.customerMode = true;
    const html = app.MetricsView.render();
    expect(html).toMatch(/Outcomes — value delivered/);
    expect(html).toMatch(/of planned work delivered/);
    expect(html).not.toMatch(/RACI|cascade|holdings/i);
    app.App.customerMode = false;
    app.teardown();
  });
});

describe('Wave 6 R8 — portfolio exec line uses the verdict vocabulary', () => {
  it('uses On Track / Watch / Off Track (not Needs attention / Healthy) and explains severe-risk', async () => {
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries', rag_schedule: 'Green' })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.navigate('portfolio');
    const html = app.document.getElementById('portfolioExecLine').innerHTML;
    expect(html).toMatch(/Portfolio health:/);
    expect(html).toMatch(/On Track|Watch|Off Track/);
    expect(html).not.toMatch(/Needs attention|Healthy/);
    expect(html).toMatch(/impact x probability/); // severe-risk heuristic explained
    app.teardown();
  });
});

describe('Wave 6 R4 — RAID sort headers are keyboard-operable and announce sortability', () => {
  it('every sortable header has tabindex/role/onkeydown and aria-sort (none on inactive)', async () => {
    const app = await loadApp(makeDataset({
      projects: [makeProject({ id: 'P1', customer: 'Acme Industries', risks_register: [{ id: 'r', description: 'X', impact: 5, probability: 5, status: 'open' }] })],
      customers: [{ name: 'Acme Industries', color: '#6366f1' }]
    }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.navigate('raid');
    const html = app.document.getElementById('raidContent').innerHTML;
    expect(html).toMatch(/tabindex="0" onclick="RaidView\.setSort/);
    expect(html).toMatch(/onkeydown="if\(event\.key/);
    expect(html).toMatch(/aria-sort="none"/); // inactive sortable columns announce sortability
    app.teardown();
  });
});
