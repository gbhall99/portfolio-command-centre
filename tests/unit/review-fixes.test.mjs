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

describe('AgentTools All-customers scope — demand vs capacity alignment (capacity_summary / explain_plan / check_plan_drift)', () => {
  const S1 = 'CY26-S1';
  const engSplit = (pts) => ({
    size_engineering: [{ sprint: S1, points: pts, status: 'pending', completed: 0, assigned_to: [], reasons: [] }]
  });
  const mkCtx = (over) => Object.assign(
    { customer: 'Acme Industries', allScope: false, citations: [], proposals: [] }, over || {});

  function boot(projects, members, settings) {
    resetIdSeq();
    return loadApp(makeDataset({
      customers: [{ name: 'Acme Industries' }, { name: 'Globex' }],
      projects,
      sprints: makeSprintSequence(2),
      team_members: members,
      settings: settings || {}
    }));
  }

  it('capacity_summary under allScope divides all-customer demand by ALL members\' capacity', async () => {
    const app = await boot(
      [
        makeProject({ id: 'A-1', name: 'Acme One', customer: 'Acme Industries', size_engineering: 10, skill_splits: engSplit(10) }),
        makeProject({ id: 'A-2', name: 'Acme Two', customer: 'Acme Industries', size_engineering: 10, skill_splits: engSplit(10) }),
        makeProject({ id: 'G-1', name: 'Globex One', customer: 'Globex', size_engineering: 10, skill_splits: engSplit(10) }),
        makeProject({ id: 'G-2', name: 'Globex Two', customer: 'Globex', size_engineering: 10, skill_splits: engSplit(10) })
      ],
      [
        makeMember({ name: 'Dana', customer: 'Acme Industries', available_points_per_sprint: 20 }),
        makeMember({ name: 'Gary', customer: 'Globex', available_points_per_sprint: 20 })
      ]
    );
    try {
      const { AgentTools, App } = app;
      App.activeCustomer = 'Acme Industries';
      const single = AgentTools.invoke('capacity_summary', { sprint_id: S1 }, mkCtx());
      const all = AgentTools.invoke('capacity_summary', { sprint_id: S1 }, mkCtx({ allScope: true }));
      const sEng = single.sprints[0].skills.size_engineering;
      const aEng = all.sprints[0].skills.size_engineering;
      // Single scope: Acme demand vs Acme-only capacity.
      expect(sEng.demand).toBe(20);
      // All scope: demand doubles (Globex splits counted) AND capacity doubles
      // (Globex's member counted) — utilisation must NOT inflate.
      expect(aEng.demand).toBe(40);
      expect(aEng.capacity).toBe(sEng.capacity * 2);
      expect(aEng.utilisation_pct).toBe(sEng.utilisation_pct);
    } finally { app.teardown(); }
  });

  it('explain_plan ignores the All-customers scope — binding constraints identical with and without it', async () => {
    const app = await boot(
      [
        makeProject({
          id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', size_engineering: 5,
          status: 'In Progress', moscow: 'Must', manager: 'Dana', target_date: '2026-09-01',
          skill_splits: engSplit(5)
        }),
        makeProject({
          id: 'G-1', name: 'Globex Giant', customer: 'Globex', size_engineering: 100,
          status: 'In Progress', moscow: 'Must', manager: 'Gary', target_date: '2026-09-01',
          skill_splits: engSplit(100)
        })
      ],
      [makeMember({ name: 'Dana', customer: 'Acme Industries', available_points_per_sprint: 20 })]
    );
    try {
      const { AgentTools, App } = app;
      App.activeCustomer = 'Acme Industries';
      const single = AgentTools.invoke('explain_plan', {}, mkCtx());
      const all = AgentTools.invoke('explain_plan', {}, mkCtx({ allScope: true }));
      // Acme's 5 SP against its 20-pt capacity is nowhere near binding;
      // Globex's 100 SP must not leak into a per-customer explanation.
      expect(single.binding_constraints).toEqual([]);
      expect(all.binding_constraints).toEqual(single.binding_constraints);
    } finally { app.teardown(); }
  });

  it('check_plan_drift compares only the working customer\'s projects under allScope', async () => {
    const past = new Date(Date.now() - 5 * 3600000).toISOString();
    const app = await boot(
      [
        makeProject({ id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries' }),
        makeProject({ id: 'G-1', name: 'Globex Giant', customer: 'Globex', last_updated: new Date().toISOString() })
      ],
      [makeMember({ name: 'Dana', customer: 'Acme Industries' })],
      { solverRuns: { 'Acme Industries': { at: past, projectCount: 1 } } }
    );
    try {
      const { AgentTools, App } = app;
      App.activeCustomer = 'Acme Industries';
      const single = AgentTools.invoke('check_plan_drift', {}, mkCtx());
      const all = AgentTools.invoke('check_plan_drift', {}, mkCtx({ allScope: true }));
      // Globex's touched project must not count against Acme's solve record.
      expect(all.changed_projects).not.toContain('Globex Giant');
      expect(all.inputs_changed_since).toBe(single.inputs_changed_since);
      expect(all.recommend_rerun).toBe(single.recommend_rerun);
    } finally { app.teardown(); }
  });
});

describe('Skill editors resolve the governed definition by the OPEN document\'s customer (#22)', () => {
  async function boot() {
    resetIdSeq();
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries' }, { name: 'Globex' }]
    }));
    app.App.activeCustomer = 'Acme Industries';
    return app;
  }

  it('a foreign quoted-template SOW keeps its requires_quote Approve gate under a different active customer', async () => {
    const app = await boot();
    const { App, Definitions, Sow, SowSkill } = app;
    try {
      // Globex is governed by the 'quoted' set; Acme (the active customer) stays on 'default'.
      Definitions.setSelectedSetId('sow', 'Globex', 'quoted');
      const def = Definitions.loadJson('sow-quoted/sow-definition.json');
      const filler = Array.from({ length: 45 }, (_, i) => 'w' + i).join(' ');
      const sow = Sow.create({
        customer: 'Globex',
        definition: def,
        generatedSections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true })),
        name: 'Globex Quoted SOW',
        source_text: 'src'
      });
      Sow.get(sow.id).sections.forEach(s => { s.flagged = false; });

      // Open the Globex SOW while Acme is the working customer (All-filter deep-link path).
      App.activeCustomer = 'Acme Industries';
      SowSkill.open({});
      SowSkill.edit(sow.id);

      // _def() must resolve Globex's set, not Acme's.
      expect(SowSkill._def().id).toBe('quoted');

      SowSkill.uiSetStatus('Review');
      expect(Sow.get(sow.id).status).toBe('Review');
      // Approve must stay blocked by the quoted set's requires_quote gate.
      SowSkill.uiSetStatus('Approved');
      expect(Sow.get(sow.id).status).toBe('Review');
      const v = Sow.validate(Sow.get(sow.id), SowSkill._def().files.definition);
      expect(v.ok).toBe(false);
      expect(v.errors.join(' ')).toMatch(/requires a generated quote/);

      // List/new modes (no open document) still fall back to the active customer.
      SowSkill.backToList();
      expect(SowSkill._def().id).toBe('default');
    } finally { app.teardown(); }
  });

  it('WireframeSkill._def and StatusReportSkill._def route through the open document\'s customer', async () => {
    const app = await boot();
    const { App, Definitions, WireframeSkill, StatusReportSkill } = app;
    const orig = Definitions.resolve;
    const calls = [];
    try {
      App.data.wireframes = App.data.wireframes || [];
      App.data.wireframes.push({
        id: 'WF-G1', customer: 'Globex', name: 'Globex WF', status: 'Concept',
        grid: { cols: 12, rows: 8 }, components: [], metric_ids: []
      });
      App.data.status_reports = App.data.status_reports || [];
      App.data.status_reports.push({
        id: 'SR-G1', customer: 'Globex', period: 'FY27 P1', sections: []
      });
      Definitions.resolve = function (kind, customer) {
        calls.push([kind, customer]);
        return orig.call(this, kind, customer);
      };

      App.activeCustomer = 'Acme Industries';
      WireframeSkill._mode = 'edit'; WireframeSkill._wfId = 'WF-G1';
      expect(WireframeSkill._def()).toBeTruthy();
      StatusReportSkill._mode = 'edit'; StatusReportSkill._id = 'SR-G1';
      expect(StatusReportSkill._def()).toBeTruthy();
      expect(calls).toContainEqual(['tableau', 'Globex']);
      expect(calls).toContainEqual(['status-report', 'Globex']);

      // No open document → active-customer fallback.
      calls.length = 0;
      WireframeSkill._mode = 'list'; WireframeSkill._wfId = null;
      StatusReportSkill._mode = 'list'; StatusReportSkill._id = null;
      WireframeSkill._def();
      StatusReportSkill._def();
      expect(calls).toContainEqual(['tableau', 'Acme Industries']);
      expect(calls).toContainEqual(['status-report', 'Acme Industries']);
    } finally {
      Definitions.resolve = orig;
      app.teardown();
    }
  });
});

describe('Dashboard virtual-scroll listener lifecycle — stale closures never repaint the table', () => {
  const bigList = (n) => Array.from({ length: n }, (_, i) => makeProject({
    id: 'Acme Industries-VS-' + i, name: 'Virtual ' + i, priority: i + 1
  }));

  it('re-rendering with a small filtered set detaches the stale virtual listener (scroll keeps filtered rows)', async () => {
    resetIdSeq();
    const projects = bigList(150);
    const app = await loadApp(makeDataset({ projects }));
    const { Dashboard, document, window } = app;
    try {
      const wrapper = document.querySelector('.table-wrapper');
      const tbody = document.getElementById('projectTableBody');

      // Large set → virtual path attaches a scroll listener.
      Dashboard.renderTable(projects);
      expect(Dashboard.virtualEnabled).toBe(true);

      // Scroll BEFORE the re-render so a debounced renderSlice tick is pending.
      wrapper.dispatchEvent(new window.Event('scroll'));

      // Filter down to 5 → non-virtual path.
      const filtered = projects.slice(0, 5);
      Dashboard.renderTable(filtered);
      expect(Dashboard.virtualEnabled).toBe(false);
      expect(tbody.querySelectorAll('tr').length).toBe(5);

      // Scroll AFTER the re-render (horizontal scroll fires 'scroll' too) and
      // let both the pending and any new debounce timers elapse.
      wrapper.dispatchEvent(new window.Event('scroll'));
      await new Promise(r => setTimeout(r, 60));

      // Without the fix the stale handler's renderSlice overwrites tbody with
      // a slice of the pre-filter 150-project list (+ spacer rows).
      const rows = tbody.querySelectorAll('tr');
      expect(rows.length).toBe(5);
      expect(rows[0].dataset.id).toBe(filtered[0].id);
    } finally { app.teardown(); }
  });

  it('repeated virtual renders leave exactly one live scroll listener', async () => {
    resetIdSeq();
    const projects = bigList(120);
    const app = await loadApp(makeDataset({ projects }));
    const { Dashboard, document } = app;
    try {
      const wrapper = document.querySelector('.table-wrapper');
      // The initial data load may already have attached a virtual listener —
      // detach it so the spy counts from a clean slate.
      if (wrapper._virtualHandler) {
        wrapper.removeEventListener('scroll', wrapper._virtualHandler);
        wrapper._virtualHandler = null;
      }
      let live = 0;
      const origAdd = wrapper.addEventListener.bind(wrapper);
      const origRemove = wrapper.removeEventListener.bind(wrapper);
      wrapper.addEventListener = (type, fn, ...rest) => { if (type === 'scroll') live++; return origAdd(type, fn, ...rest); };
      wrapper.removeEventListener = (type, fn, ...rest) => { if (type === 'scroll') live--; return origRemove(type, fn, ...rest); };

      Dashboard.renderTable(projects);
      Dashboard.renderTable(projects);
      Dashboard.renderTable(projects);
      expect(live).toBe(1);

      // Empty-state path detaches too (early return happens after the detach).
      Dashboard.renderTable([]);
      expect(live).toBe(0);
      expect(wrapper._virtualHandler).toBe(null);
    } finally { app.teardown(); }
  });
});

describe('Customer (read-only) mode — hard curtain across navigation, shortcuts, palette and mutators', () => {
  it('navigate() refuses hidden internal views (incl. Alt+N shortcuts) and keeps curated views reachable', async () => {
    const app = await loadApp();
    const { App, document, window } = app;
    try {
      App.customerMode = true;
      App._applyCustomerMode(); // redirects the active view behind the curtain
      expect(App.currentView).toBe('portfolio');

      // Direct navigation to every hidden view is refused.
      App.CUSTOMER_MODE_HIDDEN_VIEWS.forEach(v => {
        App.navigate(v);
        expect(App.currentView).toBe('portfolio');
      });

      // Alt+2 (Sprint Planning shortcut) goes through the same choke point.
      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: '2', altKey: true, bubbles: true, cancelable: true }));
      expect(App.currentView).toBe('portfolio');

      // Curated views stay reachable.
      App.navigate('roadmap');
      expect(App.currentView).toBe('roadmap');

      // Exiting customer mode restores full navigation.
      App.customerMode = false;
      App._applyCustomerMode();
      App.navigate('config');
      expect(App.currentView).toBe('config');
    } finally { app.teardown(); }
  });

  it('undo/redo, scenarios, sandbox and the When-by modal are inert while customer mode is on', async () => {
    const app = await loadApp();
    const { App, Dashboard, document, window } = app;
    try {
      const p = App.data.projects[0];
      const scId = App.saveScenario('cm-guard'); // snapshot with the original status
      const origStatus = p.status;
      App.pushUndo('cm guard test');
      p.status = origStatus === 'On Hold' ? 'Blocked' : 'On Hold';
      const mutatedStatus = p.status;

      App.customerMode = true;
      App._applyCustomerMode();
      const depth = App.undoStack.length;

      App.undo();
      expect(App.undoStack.length).toBe(depth);
      expect(p.status).toBe(mutatedStatus);
      // Ctrl+Z keyboard path hits the same guard.
      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
      expect(App.undoStack.length).toBe(depth);
      expect(p.status).toBe(mutatedStatus);
      App.redo();
      expect(App.data.projects[0].status).toBe(mutatedStatus);

      // loadScenario refuses and mutates nothing.
      expect(App.loadScenario(scId)).toBe(false);
      expect(App.data.projects[0].status).toBe(mutatedStatus);

      // Internal modals/toggles refuse to open.
      App.openScenarioManager();
      expect(document.getElementById('scenarioManagerOverlay')).toBe(null);
      Dashboard.openWhenByModal();
      expect(document.getElementById('whenByOverlay')).toBe(null);
      App.toggleSandboxMode();
      expect(!!App.sandboxMode).toBe(false);

      // Exiting customer mode restores the paths.
      App.customerMode = false;
      App._applyCustomerMode();
      App.undo();
      expect(App.data.projects[0].status).toBe(origStatus);
      expect(App.loadScenario(scId)).toBe(true);
    } finally { app.teardown(); }
  });

  it('the command palette advertises no hidden views or mutation actions in customer mode', async () => {
    const app = await loadApp();
    const { App, CommandPalette } = app;
    try {
      App.customerMode = true;
      App._applyCustomerMode();
      const items = CommandPalette._build();
      const titles = items.map(i => i.title);
      ['Sprint Planning', 'Dashboard', 'Capacity & Workload', 'System Settings',
        'New Project', 'Bulk import projects (CSV)', 'Bulk edit visible projects',
        'Scenarios — save / compare / apply', 'Scenario Lab — compare solver what-ifs',
        'Auto-Prioritise', 'Undo', 'Redo',
        'Generate SOW from document', 'Tableau wireframe builder'].forEach(t => {
        expect(titles).not.toContain(t);
      });
      // Curated entries survive the filter.
      expect(titles).toContain('Portfolio Overview');
      expect(titles).toContain('Roadmap / Gantt');

      App.customerMode = false;
      App._applyCustomerMode();
      const fullTitles = CommandPalette._build().map(i => i.title);
      ['Sprint Planning', 'System Settings', 'New Project', 'Undo'].forEach(t => {
        expect(fullTitles).toContain(t);
      });
    } finally { app.teardown(); }
  });

  it('body.customer-mode CSS hides the header power tools and undo/redo cluster', async () => {
    const app = await loadApp();
    const { document } = app;
    try {
      const css = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
      ['#btnWhenBy', '#btnScenarios', '#btnSandbox', '.undo-group', '#btnRedo'].forEach(sel => {
        expect(css).toMatch(new RegExp('body\\.customer-mode\\s+' + sel.replace('.', '\\.') + ','));
      });
    } finally { app.teardown(); }
  });
});
