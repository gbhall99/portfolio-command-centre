import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

describe('Gantt cone of uncertainty', () => {
  it('renders a dashed extension when *_max exceeds point estimate', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'Ranged',
      start_date: '2026-01-05', target_date: '2026-02-09',
      size_engineering: 10, size_engineering_max: 24
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints, team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'GCC';
    app.Gantt.render();
    const html = app.window.document.getElementById("ganttRows").innerHTML;
    expect(html).toMatch(/gantt-cone/);
    app.teardown();
  });

  it('does not render a cone when *_max equals point estimate', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'No cone', start_date: '2026-01-05', target_date: '2026-02-09',
      size_engineering: 10, size_engineering_max: 10
    });
    proj.size_total = 10;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints, team_members: [makeMember()]
    }));
    app.App.activeCustomer = 'GCC';
    app.Gantt.render();
    const html = app.window.document.getElementById("ganttRows").innerHTML;
    expect(html).not.toMatch(/gantt-cone/);
    app.teardown();
  });
});

describe('Gantt — TBD phase bar', () => {
  it('renders a dashed open-ended bar for projects with a tbd phase', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'Discovery only',
      start_date: '2026-01-05', target_date: '2026-02-09',
      size_requirements: 5,
      delivery_config: { phase_order: ['Requirements', { phase: 'Data Engineering', status: 'tbd' }] }
    });
    proj.size_total = 5;
    const app = await loadApp(makeDataset({
      projects: [proj], sprints, team_members: [makeMember({ primary_skills: ['Requirements'] })]
    }));
    app.App.activeCustomer = 'GCC';
    app.Gantt.render();
    const html = app.window.document.getElementById('ganttRows').innerHTML;
    expect(html).toMatch(/gantt-tbd/);
    app.teardown();
  });
});
