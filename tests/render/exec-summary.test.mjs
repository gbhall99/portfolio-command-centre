// Executive Summary at-risk count must include Red RAG, not only status=At Risk.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function bootstrap(project) {
  resetIdSeq();
  const sprints = makeSprintSequence(2);
  const app = await loadApp(makeDataset({
    projects: [project], sprints, team_members: [makeMember()]
  }));
  // Production HTML already has #execSummary; reuse if present.
  let host = app.window.document.getElementById('execSummary');
  if (!host) {
    host = app.window.document.createElement('div');
    host.id = 'execSummary';
    app.window.document.body.appendChild(host);
  }
  app.App.activeCustomer = 'GCC';
  app.Dashboard.renderExecSummary();
  return { app, host };
}

describe('Dashboard.renderExecSummary — RAG/status reconciliation', () => {
  it('counts a Red-RAG / In-Progress project as "at risk"', async () => {
    const proj = makeProject({
      name: 'Red on schedule', status: 'In Progress',
      rag_schedule: 'Red', rag_resourcing: 'Green', rag_scope: 'Green'
    });
    proj.size_total = 5;
    const { app, host } = await bootstrap(proj);
    expect(host.innerHTML).not.toMatch(/0 at risk/);
    expect(host.innerHTML).toMatch(/1 at risk/);
    app.teardown();
  });

  it('still counts status=At Risk projects as at risk (back-compat)', async () => {
    const proj = makeProject({ name: 'Status at risk', status: 'At Risk' });
    proj.size_total = 5;
    const { app, host } = await bootstrap(proj);
    expect(host.innerHTML).toMatch(/1 at risk/);
    app.teardown();
  });

  it('does not double-count when status=At Risk AND RAG=Red', async () => {
    const proj = makeProject({
      name: 'Both', status: 'At Risk', rag_schedule: 'Red'
    });
    proj.size_total = 5;
    const { app, host } = await bootstrap(proj);
    expect(host.innerHTML).toMatch(/1 at risk/);
    expect(host.innerHTML).not.toMatch(/2 at risk/);
    app.teardown();
  });
});

describe('Exec Summary — What Changed', () => {
  it('renders a 7-day change summary when the audit log has entries', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'P', status: 'In Progress' });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({ projects: [proj], sprints: makeSprintSequence(2), team_members: [makeMember()] }));
    app.App.activeCustomer = 'GCC';
    app.App.logChange(proj.id, 'priority', 5, 1, 'user');
    let host = app.window.document.getElementById('execSummary');
    if (!host) {
      host = app.window.document.createElement('div');
      host.id = 'execSummary';
      app.window.document.body.appendChild(host);
    }
    app.Dashboard.renderExecSummary();
    expect(host.innerHTML).toMatch(/changes.*last 7 days/i);
    app.teardown();
  });
});
