// Slot G — Items 15 (milestone diamonds + legend), 16 (unallocated viz),
// 17 (label consistency + segment-status visualisation).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember } from '../harness/fixtures.mjs';

async function bootWithProjects(projects, extraDataset = {}) {
  const app = await loadApp(makeDataset(Object.assign({
    projects,
    sprints: makeSprintSequence(3),
    team_members: [makeMember()],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }]
  }, extraDataset)));
  app.App.activeCustomer = 'Acme Industries';
  app.App.navigate('roadmap');
  if (typeof app.Gantt.render === 'function') app.Gantt.render();
  if (typeof app.Gantt.renderLegend === 'function') app.Gantt.renderLegend();
  return app;
}

describe('Slot G — Item 15: customer milestones on Gantt + legend', () => {
  it('Gantt legend includes a "Milestone" entry with a diamond SVG', async () => {
    const app = await bootWithProjects([makeProject({ id: 'G1', name: 'P', customer: 'Acme Industries', start_date: '2026-01-05', target_date: '2026-04-01' })]);
    const legend = app.document.getElementById('ganttLegend');
    expect(legend).toBeTruthy();
    expect(legend.querySelector('[data-gantt-legend="milestone"]')).toBeTruthy();
    expect(legend.querySelector('[data-gantt-legend="milestone"] svg polygon')).toBeTruthy();
    app.teardown();
  });

  it('a project with customer_milestones renders msMilestone diamonds on the bar', async () => {
    const app = await bootWithProjects([
      makeProject({
        id: 'G2', name: 'P', customer: 'Acme Industries',
        start_date: '2026-01-05', target_date: '2026-04-01',
        customer_milestones: [
          { id: 'm1', name: 'Sponsor demo', date: '2026-02-15', status: 'Planned' },
          { id: 'm2', name: 'Launch decision', date: '2026-03-15', status: 'Planned' }
        ]
      })
    ]);
    const diamonds = app.document.querySelectorAll('.gantt-ms-milestone');
    expect(diamonds.length).toBe(2);
    app.teardown();
  });

  it('milestone diamond carries the milestone name in its aria-label', async () => {
    const app = await bootWithProjects([
      makeProject({
        id: 'G3', name: 'P', customer: 'Acme Industries',
        start_date: '2026-01-05', target_date: '2026-04-01',
        customer_milestones: [{ id: 'm1', name: 'Sponsor demo', date: '2026-02-15', status: 'Planned' }]
      })
    ]);
    const diamond = app.document.querySelector('.gantt-ms-milestone');
    expect(diamond).toBeTruthy();
    expect(diamond.getAttribute('aria-label')).toMatch(/Sponsor demo/);
    app.teardown();
  });
});

describe('Slot G — Item 16: unallocated skill segments + legend', () => {
  it('Gantt legend includes an "Unallocated" entry', async () => {
    const app = await bootWithProjects([makeProject({ id: 'U1', name: 'P', customer: 'Acme Industries' })]);
    const legend = app.document.getElementById('ganttLegend');
    expect(legend.querySelector('[data-gantt-legend="unallocated"]')).toBeTruthy();
    app.teardown();
  });

  it('a project with size_engineering > 0 but no skill_splits renders an unallocated segment', async () => {
    const app = await bootWithProjects([
      makeProject({
        id: 'U2', name: 'P', customer: 'Acme Industries',
        start_date: '2026-01-05', target_date: '2026-04-01',
        size_engineering: 10, size_total: 10,
        skill_splits: {}
      })
    ]);
    const unallocated = app.document.querySelectorAll('[data-gantt-unallocated="true"]');
    expect(unallocated.length).toBe(1);
    expect(unallocated[0].dataset.skillKey).toBe('size_engineering');
    expect(unallocated[0].dataset.pts).toBe('10');
    app.teardown();
  });

  it('a project with allocated skill_splits does NOT render an unallocated segment for that skill', async () => {
    const app = await bootWithProjects([
      makeProject({
        id: 'U3', name: 'P', customer: 'Acme Industries',
        start_date: '2026-01-05', target_date: '2026-04-01',
        size_engineering: 10, size_total: 10,
        skill_splits: { size_engineering: [{ sprint: 'CY26-S1', points: 10 }] }
      })
    ]);
    const unallocated = Array.from(app.document.querySelectorAll('[data-gantt-unallocated="true"][data-skill-key="size_engineering"]'));
    expect(unallocated.length).toBe(0);
    app.teardown();
  });
});

describe('Slot G — Item 17: label consistency + segment status', () => {
  it('long-bar (w>60) renders an inline .bar-label inside the bar', async () => {
    const app = await bootWithProjects([
      makeProject({
        id: 'L1', name: 'Long-window project', customer: 'Acme Industries',
        start_date: '2026-01-05', target_date: '2026-06-01',
        size_engineering: 10, size_total: 10
      })
    ]);
    const bar = app.document.querySelector('.gantt-bar');
    expect(bar.querySelector('.bar-label')).toBeTruthy();
    app.teardown();
  });

  it('short-bar projects still get a .bar-label-outside (sits beside the bar)', async () => {
    const app = await bootWithProjects([
      makeProject({
        id: 'S1', name: 'Tiny', customer: 'Acme Industries',
        start_date: '2026-01-05', target_date: '2026-01-09', // very short window → narrow bar
        size_engineering: 1, size_total: 1
      })
    ]);
    const outside = app.document.querySelector('.bar-label-outside');
    expect(outside).toBeTruthy();
    expect(outside.textContent).toBe('Tiny');
    app.teardown();
  });

  it('a "complete" skill split renders its segment with gantt-seg-complete class', async () => {
    const app = await bootWithProjects([
      makeProject({
        id: 'C1', name: 'P', customer: 'Acme Industries',
        start_date: '2026-01-05', target_date: '2026-04-01',
        size_engineering: 10, size_total: 10,
        skill_splits: { size_engineering: [{ sprint: 'CY26-S1', points: 10, completed: 10, status: 'complete' }] }
      })
    ]);
    const seg = app.document.querySelector('.gantt-seg[data-phase-status="complete"]');
    expect(seg).toBeTruthy();
    expect(seg.classList.contains('gantt-seg-complete')).toBe(true);
    app.teardown();
  });

  it('an "in-progress" skill split renders its segment with gantt-seg-in-progress class', async () => {
    const app = await bootWithProjects([
      makeProject({
        id: 'I1', name: 'P', customer: 'Acme Industries',
        start_date: '2026-01-05', target_date: '2026-04-01',
        size_engineering: 10, size_total: 10,
        skill_splits: { size_engineering: [{ sprint: 'CY26-S1', points: 10, completed: 4, status: 'in_progress' }] }
      })
    ]);
    const seg = app.document.querySelector('.gantt-seg[data-phase-status="in-progress"]');
    expect(seg).toBeTruthy();
    expect(seg.classList.contains('gantt-seg-in-progress')).toBe(true);
    app.teardown();
  });

  it('no .gantt-seg has the legacy 2px fallback width (post Item 17 fix; ≥6px minimum)', async () => {
    const app = await bootWithProjects([
      makeProject({
        id: 'G6', name: 'P', customer: 'Acme Industries',
        start_date: '2026-01-05', target_date: '2026-04-01',
        size_engineering: 10, size_tableau: 5, size_total: 15,
        skill_splits: {
          size_engineering: [{ sprint: 'CY26-S1', points: 10 }],
          size_tableau: [{ sprint: 'CY26-S1', points: 5 }]
        }
      })
    ]);
    const segs = Array.from(app.document.querySelectorAll('.gantt-seg'));
    segs.forEach(s => {
      const w = parseInt(s.style.width || '0', 10);
      expect(w).toBeGreaterThanOrEqual(6);
    });
    app.teardown();
  });
});
