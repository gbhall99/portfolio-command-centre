import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

describe('On-Track Verdict tile', () => {
  it('renders into the dashboard with the verdict and justification', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Solid', status: 'In Progress', rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'Acme Industries';
    let host = app.window.document.getElementById('kpiCards');
    if (!host) {
      host = app.window.document.createElement('div');
      host.id = 'kpiCards';
      app.window.document.body.appendChild(host);
    }
    app.Dashboard.renderKpiCards();
    const html = host.innerHTML;
    expect(html).toMatch(/On Track/);
    expect(html).toMatch(/all green/);
    app.teardown();
  });

  it('uses the same .dash-card structure as sibling KPI tiles (no inline border-top hack, no kpi-card-value text)', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Solid', status: 'In Progress', rag_schedule: 'Green', rag_resourcing: 'Green', rag_scope: 'Green' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'Acme Industries';
    let host = app.window.document.getElementById('kpiCards');
    if (!host) {
      host = app.window.document.createElement('div');
      host.id = 'kpiCards';
      app.window.document.body.appendChild(host);
    }
    app.Dashboard.renderKpiCards();
    const html = host.innerHTML;
    // First tile in the strip is the verdict tile.
    const firstCard = html.slice(0, html.indexOf('</div>', html.indexOf('dash-card-value')) + 6 + 1);
    // Verdict tile uses the shared dash-card class set, not the legacy kpi-card-value text marker.
    expect(html).toMatch(/dash-card[\s\S]*?Verdict/);
    expect(firstCard).not.toMatch(/border-top:\s*3px/);
    // Verdict word is decorated with a tone class so dark mode works through CSS, not inline colour.
    expect(html).toMatch(/dash-card-verdict-(green|amber|red)/);
    app.teardown();
  });
});
