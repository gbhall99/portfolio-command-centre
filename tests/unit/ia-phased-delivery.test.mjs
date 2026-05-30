// IA Goal 1b — rolling-wave / progressive-elaboration delivery.
// B7: elaborating a previously-unknown phase (its skill went 0 -> N) is NOT scope creep; growing an
// already-sized phase by >20% IS a scope change.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('IA 1b / B7 — classify sizing change: elaboration vs scope-creep', () => {
  it('a skill going 0 -> N is "elaboration" (rolling-wave), never scope-change', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    const c = app.DetailPanel._classifySizeChange.bind(app.DetailPanel);
    // Data Engineering elaborated for the first time: size_engineering 0 -> 8, total 20 -> 28.
    expect(c(0, 8, 20, 28)).toBe('elaboration');
    // First-ever sizing of the whole project (total was 0) is also elaboration, not creep.
    expect(c(0, 5, 0, 5)).toBe('elaboration');
    app.teardown();
  });

  it('growth of an already-sized phase by >20% is "scope-change"', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    const c = app.DetailPanel._classifySizeChange.bind(app.DetailPanel);
    expect(c(10, 17, 30, 37)).toBe('scope-change'); // +7 on a 30 total = 23% growth (> 20%)
    expect(c(10, 16, 30, 36)).toBe('none');          // exactly 20% is not over the strict threshold
    expect(c(10, 11, 30, 31)).toBe('none');          // small growth, below threshold
    expect(c(10, 8, 30, 28)).toBe('none');           // shrink is not flagged
    app.teardown();
  });

  it('end-to-end: elaborating a phase logs phase_elaborated and does NOT open the scope-change prompt', async () => {
    const proj = makeProject({ id: 'P1', name: 'Rolling', customer: 'Acme Industries',
      size_requirements: 12, size_engineering: 0, size_total: 12,
      delivery_config: { include_req: true, include_de: true, include_ds: false, include_tableau: false, include_uat: false, phase_order: ['Requirements', 'Data Engineering'] } });
    const app = await loadApp(makeDataset({ projects: [proj], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    app.App.setActiveCustomer('Acme Industries');
    app.DetailPanel.currentId = 'P1';
    app.DetailPanel._scopeChangePromptActive = false;
    // Simulate the inline editor changing size_engineering 0 -> 10 (elaborating Data Engineering).
    const el = app.document.createElement('input');
    el.type = 'number';
    el.dataset.field = 'size_engineering';
    el.value = '10';
    app.DetailPanel.onFieldChange(el);
    const p = app.App.data.projects.find(x => x.id === 'P1');
    expect(p.size_engineering).toBe(10);
    expect(p.size_total).toBe(22);
    const log = app.App.getProjectAuditLog ? app.App.getProjectAuditLog('P1') : (app.App.data.audit_log || []).filter(e => e.projectId === 'P1');
    expect(log.some(e => e.field === 'phase_elaborated')).toBe(true);
    // No scope-change reason was recorded for this planned elaboration.
    expect(Array.isArray(p.scope_change_log) ? p.scope_change_log.length : 0).toBe(0);
    app.teardown();
  });
});

describe('IA 1b / B6 — tolerant phase readers (mixed string/object phase_order)', () => {
  it('App.phaseName / phaseNames / phaseStatusOf handle both string and object entries', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'P1', customer: 'Acme Industries' })], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    const A = app.App;
    expect(A.phaseName('Requirements')).toBe('Requirements');
    expect(A.phaseName({ phase: 'Tableau', status: 'tbd' })).toBe('Tableau');
    expect(A.phaseNames(['Requirements', { phase: 'UAT', status: 'planned' }])).toEqual(['Requirements', 'UAT']);
    expect(A.phaseStatusOf('Requirements')).toBe('committed'); // a bare string = committed
    expect(A.phaseStatusOf({ phase: 'UAT', status: 'tbd' })).toBe('tbd');
    app.teardown();
  });
});

describe('IA 1b / B9 — Gantt placeholder train (no gantt disconnection)', () => {
  it('future tbd/planned phases render as a continuous flush-butted train after the live bar', async () => {
    const proj = makeProject({ id: 'P1', name: 'Rolling', customer: 'Acme Industries',
      start_date: '2026-02-02', target_date: '2026-05-29',
      size_requirements: 10, size_engineering: 8, size_total: 18,
      delivery_config: { include_req: true, include_de: true, include_ds: true, include_tableau: true, include_uat: true,
        phase_order: ['Requirements', 'Data Engineering',
          { phase: 'Data Science', status: 'planned', placeholder_size: 12 },
          { phase: 'Tableau', status: 'tbd' },
          { phase: 'UAT', status: 'tbd' }] } });
    const app = await loadApp(makeDataset({ projects: [proj], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    app.App.setActiveCustomer('Acme Industries');
    app.App.navigate('roadmap');
    const scroll = app.document.querySelector('.gantt-scroll');
    const panels = scroll ? Array.from(scroll.querySelectorAll('.gantt-tbd')) : [];
    expect(panels.length).toBe(3); // Data Science (planned) + Tableau + UAT (tbd)
    const statuses = panels.map(el => el.getAttribute('data-phase-status'));
    expect(statuses).toEqual(['planned', 'tbd', 'tbd']);
    // Flush-butted: each panel's left == the previous panel's left + width (a continuous train, no gaps).
    const lefts = panels.map(el => parseFloat(el.style.left));
    expect(lefts[1]).toBeGreaterThan(lefts[0]);
    expect(lefts[2]).toBeGreaterThan(lefts[1]);
    app.teardown();
  });
});
