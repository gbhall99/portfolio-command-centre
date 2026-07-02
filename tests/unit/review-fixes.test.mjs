// Regression tests pinning review-pipeline fixes. Shared by sequential fix stages.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import {
  makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq
} from '../harness/fixtures.mjs';

async function runSolver(dataset, customer = 'Acme Industries', settingOverrides = {}) {
  const app = await loadApp(dataset);
  const settings = { ...app.Sprint.allocSettings, ...settingOverrides };
  const plan = app.Solver.solve(customer, settings, app.App.data, app.Sprint);
  return { plan, app };
}

function allSlices(plan) {
  const slices = [];
  Object.entries(plan.allocations || {}).forEach(([pid, skills]) => {
    Object.entries(skills || {}).forEach(([sk, arr]) => {
      (arr || []).forEach(slice => slices.push({ ...slice, pid, sk }));
    });
  });
  return slices;
}

describe('Solver.getProjectPhaseMap — B6 object-form phase_order entries (rolling wave)', () => {
  it('maps promoted { phase, status } object entries so their skills are scheduled', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(6);
    const sprintIdx = {};
    sprints.forEach((s, i) => { sprintIdx[s.sprint_id] = i; });
    const proj = makeProject({
      name: 'Rolling Wave',
      size_requirements: 5,
      size_engineering: 12,
      delivery_config: {
        phase_order: ['Requirements', { phase: 'Data Engineering', status: 'planned' }]
      }
    });
    const member = makeMember({
      name: 'Alice',
      primary_skills: ['Requirements', 'Data Engineering'],
      available_points_per_sprint: 10
    });
    const { plan, app } = await runSolver(makeDataset({
      projects: [proj], sprints, team_members: [member]
    }));
    try {
      // The promoted (object-form) phase's map entry follows the string entry
      const map = app.Solver.getProjectPhaseMap(proj);
      expect(map).toEqual({ size_requirements: 1, size_engineering: 2 });

      // Both skills receive allocation slices
      const slices = allSlices(plan);
      const reqPts = slices.filter(s => s.sk === 'size_requirements')
        .reduce((t, s) => t + s.points, 0);
      const engPts = slices.filter(s => s.sk === 'size_engineering')
        .reduce((t, s) => t + s.points, 0);
      expect(reqPts).toBe(5);
      expect(engPts).toBe(12);

      // Phase ordering holds: no DE slice earlier than the last Requirements slice (R1)
      const reqMax = Math.max(...slices.filter(s => s.sk === 'size_requirements')
        .map(s => sprintIdx[s.sprint]));
      const engMin = Math.min(...slices.filter(s => s.sk === 'size_engineering')
        .map(s => sprintIdx[s.sprint]));
      expect(engMin).toBeGreaterThanOrEqual(reqMax);
    } finally {
      app.teardown();
    }
  });

  it('schedules an all-object committed phase_order (previously silently skipped)', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'Committed Object',
      size_engineering: 8,
      delivery_config: {
        phase_order: [{ phase: 'Data Engineering', status: 'committed' }]
      }
    });
    const member = makeMember({ name: 'Bob' });
    const { plan, app } = await runSolver(makeDataset({
      projects: [proj], sprints, team_members: [member]
    }));
    try {
      const engPts = allSlices(plan).filter(s => s.sk === 'size_engineering')
        .reduce((t, s) => t + s.points, 0);
      expect(engPts).toBe(8);
      expect(plan.stats.projectsSkipped).toBe(0);
    } finally {
      app.teardown();
    }
  });

  it('excludes tbd entries from scheduling with no SKILL_PHASE fallback', async () => {
    resetIdSeq();
    const sprints = makeSprintSequence(3);
    const proj = makeProject({
      name: 'All TBD',
      size_engineering: 8,
      delivery_config: {
        phase_order: [{ phase: 'Data Engineering', status: 'tbd', placeholder_size: 8 }]
      }
    });
    const member = makeMember({ name: 'Cara' });
    const { plan, app } = await runSolver(makeDataset({
      projects: [proj], sprints, team_members: [member]
    }));
    try {
      // tbd-only phase_order yields an empty phase map (no hardcoded fallback)
      expect(app.Solver.getProjectPhaseMap(proj)).toEqual({});
      // ...so nothing is scheduled for the project
      expect(allSlices(plan).filter(s => s.pid === proj.id)).toEqual([]);
    } finally {
      app.teardown();
    }
  });
});

describe('DetailPanel RAID tab risk/issue handlers are undoable (undo-persist #8)', () => {
  async function bootWithRegisters() {
    resetIdSeq();
    const proj = makeProject({
      name: 'RAID Undo',
      risks_register: [
        { description: 'Key SME leaves', action: 'Cross-train', owner: 'Alice', impact: 4, probability: 3, resolution_date: null }
      ],
      issues_register: [
        { description: 'Env outage', action: 'Escalate', owner: 'Bob', opened_date: '2026-06-01', resolution_date: null }
      ]
    });
    const app = await loadApp(makeDataset({ projects: [proj] }));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.currentId = proj.id;
    // The handlers re-render these panel fragments after mutating.
    app.document.body.insertAdjacentHTML('beforeend',
      '<div id="riskList"></div><span id="riskCount"></span>' +
      '<div id="issueList"></div><span id="issueCount"></span>');
    return { app, proj };
  }

  it('removeRisk snapshots undo and Ctrl+Z restores the risk intact', async () => {
    const { app, proj } = await bootWithRegisters();
    const { App, DetailPanel } = app;
    try {
      const before = App.undoStack.length;
      DetailPanel.removeRisk(0);
      expect(App.data.projects.find(p => p.id === proj.id).risks_register).toHaveLength(0);
      expect(App.undoStack.length).toBe(before + 1);
      expect(App.undoStack[App.undoStack.length - 1].description).toBe('Remove risk');

      App.undo();
      const restored = App.data.projects.find(p => p.id === proj.id).risks_register;
      expect(restored).toHaveLength(1);
      expect(restored[0].description).toBe('Key SME leaves');
      expect(restored[0].owner).toBe('Alice');
    } finally {
      app.teardown();
    }
  });

  it('removeIssue snapshots undo and Ctrl+Z restores the issue intact', async () => {
    const { app, proj } = await bootWithRegisters();
    const { App, DetailPanel } = app;
    try {
      const before = App.undoStack.length;
      DetailPanel.removeIssue(0);
      expect(App.data.projects.find(p => p.id === proj.id).issues_register).toHaveLength(0);
      expect(App.undoStack.length).toBe(before + 1);
      expect(App.undoStack[App.undoStack.length - 1].description).toBe('Remove issue');

      App.undo();
      const restored = App.data.projects.find(p => p.id === proj.id).issues_register;
      expect(restored).toHaveLength(1);
      expect(restored[0].description).toBe('Env outage');
    } finally {
      app.teardown();
    }
  });

  it('addRisk and addIssue each push exactly one labelled undo snapshot', async () => {
    const { app, proj } = await bootWithRegisters();
    const { App, DetailPanel } = app;
    try {
      const before = App.undoStack.length;
      DetailPanel.addRisk();
      expect(App.undoStack.length).toBe(before + 1);
      expect(App.undoStack[App.undoStack.length - 1].description).toBe('Add risk');
      expect(App.data.projects.find(p => p.id === proj.id).risks_register).toHaveLength(2);

      DetailPanel.addIssue();
      expect(App.undoStack.length).toBe(before + 2);
      expect(App.undoStack[App.undoStack.length - 1].description).toBe('Add issue');
      expect(App.data.projects.find(p => p.id === proj.id).issues_register).toHaveLength(2);

      // Undo the add-issue, then the add-risk — registers return to seed state.
      App.undo();
      App.undo();
      const p = App.data.projects.find(pr => pr.id === proj.id);
      expect(p.risks_register).toHaveLength(1);
      expect(p.issues_register).toHaveLength(1);
    } finally {
      app.teardown();
    }
  });
});
