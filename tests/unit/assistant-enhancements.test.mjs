// AS1 — Assistant enhancements: portfolio-aware read scope, skills exposed as
// confirm-gated tools (draft_sow / draft_wireframe / generate_report), and a
// scope-aware system prompt. Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex', color: '#ec4899' }],
    projects: [
      makeProject({ id: 'A-1', name: 'Acme One', customer: 'Acme Industries' }),
      makeProject({ id: 'G-1', name: 'Globex One', customer: 'Globex' })
    ]
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

const ctx = (over) => Object.assign({ customer: 'Acme Industries', allScope: false, citations: [], proposals: [] }, over || {});

describe('portfolio-aware read scope', () => {
  it('read tools scope to one customer by default and aggregate under allScope', () => {
    const { AgentTools } = app;
    expect(AgentTools.invoke('list_projects', {}, ctx()).projects.map(p => p.id).sort()).toEqual(['A-1']);
    expect(AgentTools.invoke('list_projects', {}, ctx({ allScope: true })).projects.map(p => p.id).sort()).toEqual(['A-1', 'G-1']);
  });
});

describe('scope-aware system prompt + thread key', () => {
  it('the system prompt reflects single vs portfolio scope', () => {
    expect(app.Agent._systemPrompt({ customer: 'Acme Industries', allScope: false })).toMatch(/scoped to this customer only/i);
    expect(app.Agent._systemPrompt({ customer: 'Acme Industries', allScope: true })).toMatch(/ALL customers/);
  });
  it('the Assistant uses a separate __all__ thread under the All filter', () => {
    app.App.allCustomers = false;
    expect(app.Assistant._customerKey()).toBe('Acme Industries');
    app.App.allCustomers = true; app.App.customerMode = false;
    expect(app.Assistant._customerKey()).toBe('__all__');
  });
});

describe('skills as confirm-gated tools', () => {
  it('all three skill tools are registered for the adapters', () => {
    const names = app.AgentTools.defs().map(d => d.name);
    expect(names).toEqual(expect.arrayContaining(['draft_sow', 'draft_wireframe', 'generate_report']));
  });

  it('draft_sow proposes (no mutation) and apply launches the SOW skill for the project', () => {
    const { AgentTools, SowSkill } = app;
    const c = ctx();
    const res = AgentTools.invoke('draft_sow', { project_id: 'A-1' }, c);
    expect(res.proposed).toBe(true);
    expect(c.proposals).toHaveLength(1);
    let launched = null;
    const gen = SowSkill.generateFromProject, open = SowSkill.open;
    SowSkill.generateFromProject = (pid) => { launched = pid; };
    SowSkill.open = () => {};
    try { c.proposals[0].apply(); } finally { SowSkill.generateFromProject = gen; SowSkill.open = open; }
    expect(launched).toBe('A-1');
  });

  it('draft_sow on a missing project errors without proposing', () => {
    const c = ctx();
    expect(app.AgentTools.invoke('draft_sow', { project_id: 'NOPE' }, c).error).toBeTruthy();
    expect(c.proposals).toHaveLength(0);
  });

  it('draft_wireframe proposes and apply launches the builder with the brief', () => {
    const { AgentTools, WireframeSkill } = app;
    const c = ctx();
    expect(AgentTools.invoke('draft_wireframe', { brief: 'exec sales overview' }, c).proposed).toBe(true);
    let brief = null;
    const draft = WireframeSkill.aiDraft, open = WireframeSkill.open;
    WireframeSkill.aiDraft = (b) => { brief = b; };
    WireframeSkill.open = () => {};
    try { c.proposals[0].apply(); } finally { WireframeSkill.aiDraft = draft; WireframeSkill.open = open; }
    expect(brief).toBe('exec sales overview');
  });

  it('generate_report proposes; apply routes through Reports.generate; success_story needs a project', () => {
    const { AgentTools, Reports } = app;
    const c = ctx();
    expect(AgentTools.invoke('generate_report', { report_type: 'success_story' }, c).error).toBeTruthy();
    expect(AgentTools.invoke('generate_report', { report_type: 'portfolio_overview' }, c).proposed).toBe(true);
    let call = null;
    const gen = Reports.generate;
    Reports.generate = (t, a) => { call = [t, a]; };
    try { c.proposals[c.proposals.length - 1].apply(); } finally { Reports.generate = gen; }
    expect(call[0]).toBe('portfolio_overview');
    expect(call[1].customer).toBe('Acme Industries');
  });
});
