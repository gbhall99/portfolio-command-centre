// sow-interview — conversational, slot-based SoW intake (ProjectWizard pattern).
// Slots prefill from the linked project's delivery_config/dates/quote/attached
// wireframes; free-form answers parse into slots (AI, mock); the skeleton
// compiles deterministically; progress persists per customer in uiState; and
// "Use form" falls back to the classic blank-from-template path. Works fully
// with no model. Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

let app;

const billingSettings = {
  billing: {
    currency: 'GBP', hours_per_point: 8, target_margin_pct: 30,
    rate_table: { 'United Kingdom': { Consultant: 100 } },
    customer_defaults: { 'Acme Industries': { country: 'United Kingdom', level: 'Consultant' } }
  }
};

function fixture() {
  resetIdSeq();
  return makeDataset({
    projects: [makeProject({
      id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries',
      size_engineering: 10, size_tableau: 6, size_requirements: 0,
      sponsor: 'Jane Cooper', target_date: '2026-06-01',
      customer_milestones: [{ name: 'UAT sign-off', date: '2026-05-15' }],
      delivery_config: { phase_order: ['Requirements', 'Data Engineering', 'Tableau'] }
    })],
    wireframes: [{ id: 'WF-1', customer: 'Acme Industries', project_id: 'A-1', name: 'Exec Dashboard', status: 'Concept', grid: { cols: 12, rows: 8 }, components: [], metric_ids: [], tableau_refs: [] }],
    settings: billingSettings
  });
}

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('prefill from the linked project', () => {
  it('prefills scope (phases + wireframes), commercial basis (quote), milestones and sign-off', () => {
    const { SowInterview, App } = app;
    const project = App.data.projects.find(p => p.id === 'A-1');
    const pre = SowInterview.prefill(project);
    expect(pre.scope_summary).toMatch(/Requirements, Data Engineering, Tableau/);
    expect(pre.scope_summary).toMatch(/Exec Dashboard/);           // attached wireframe
    expect(pre.commercial_basis).toMatch(/Quoted/);                // priced quote exists
    expect(pre.milestones).toMatch(/2026-06-01/);                  // target date
    expect(pre.milestones).toMatch(/UAT sign-off/);                // customer milestone
    expect(pre.signoff).toMatch(/Jane Cooper/);
  });

  it('no project → empty prefill (asks everything)', () => {
    const { SowInterview } = app;
    expect(Object.keys(SowInterview.prefill(null)).length).toBe(0);
  });
});

describe('deterministic skeleton compilation', () => {
  it('compiles answers into definition-ordered sections without a model', () => {
    const { SowInterview, Definitions } = app;
    const def = Definitions.loadJson('sow/sow-definition.json');
    const gen = SowInterview.compileSkeleton({
      scope_summary: 'Build the exec dashboard.',
      exclusions: 'Mobile app\nData migration',
      milestones: 'Kickoff 5 Jan\nUAT 15 May',
      commercial_basis: 'Quoted (fixed price)',
      signoff: 'Jane Cooper (sponsor)'
    }, def);
    const byId = Object.fromEntries(gen.map(g => [g.id, g.content]));
    expect(byId.scope).toMatch(/exec dashboard/);
    expect(byId.out_of_scope).toMatch(/- Mobile app/);
    expect(byId.timeline_milestones).toMatch(/- Kickoff 5 Jan/);
    expect(byId.commercials).toMatch(/Quoted \(fixed price\)/);
    expect(byId.signoff).toMatch(/Jane Cooper/);
    // Only sections with answers are emitted.
    expect(gen.every(g => g.content && g.content.trim())).toBe(true);
  });
});

describe('progress persistence in uiState', () => {
  it('saves the draft per customer as answers accumulate', () => {
    const { SowInterview, App } = app;
    SowInterview.open('Acme Industries', 'A-1');
    // Answer the current (first unfilled) slot; prefill already populated most.
    const key = 'sow.interview.draft.Acme Industries';
    SowInterview.submitAnswer('Deliver a clean exec dashboard');
    const draft = App.uiStateGet(key, null);
    expect(draft).toBeTruthy();
    expect(draft.project_id).toBe('A-1');
    expect(Object.keys(draft.answers).length).toBeGreaterThan(0);
    SowInterview.close();
  });
});

describe('AI free-form parse (mock)', () => {
  it('maps a pasted brief onto the slots via the model', async () => {
    const { SowInterview, AI, document } = app;
    AI.upsertProfile({ id: 'mp', name: 'Mock', adapter: 'mock', model: 'mock', toolMode: 'native' });
    AI.setDefaultProfile('mp');
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({
      scope_summary: 'Deliver a finance analytics dashboard',
      commercial_basis: 'Time & materials',
      exclusions: 'No mobile'
    }) }]);
    SowInterview.open('Acme Industries', 'A-1');
    const el = document.getElementById('sowInterviewInput');
    el.value = 'We want a finance analytics dashboard on T&M, mobile is out.';
    await SowInterview.pasteBrief();
    expect(SowInterview._state.answers.scope_summary).toMatch(/finance analytics/);
    expect(SowInterview._state.answers.commercial_basis).toMatch(/Time & materials/);
    expect(SowInterview._state.answers.exclusions).toMatch(/No mobile/);
    SowInterview.close();
  });
});

describe('create + Use form fallback', () => {
  it('create() compiles a real SoW with no AI (skeleton drafts)', async () => {
    const { SowInterview, Sow } = app;
    SowInterview.open('Acme Industries', 'A-1');
    SowInterview._state.answers = { scope_summary: 'Build it', exclusions: 'Mobile', commercial_basis: 'Quoted (fixed price)' };
    const sow = await SowInterview.create({ skipAi: true });
    expect(sow).toBeTruthy();
    expect(sow.project_id).toBe('A-1');
    const scope = Sow.get(sow.id).sections.find(s => s.id === 'scope');
    expect(scope.content).toMatch(/Build it/);
    SowInterview.close();
  });

  it('useForm falls back to the classic blank-from-template path', () => {
    const { SowInterview, SowSkill, Sow } = app;
    SowInterview.open('Acme Industries', 'A-1');
    const before = (Sow.list('Acme Industries') || []).length;
    SowInterview.useForm();
    expect(SowSkill._mode).toBe('edit');
    expect((Sow.list('Acme Industries') || []).length).toBe(before + 1);
    SowSkill.close();
  });
});
