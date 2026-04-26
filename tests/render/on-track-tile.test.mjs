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
    app.App.activeCustomer = 'GCC';
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
});
