// SoW-to-delivery drift monitor + grounded change-order generation.
// On Approve a SoW captures a deterministic grounding snapshot of the linked
// project's scope/dates/milestones/quote; driftReport() measures live delivery
// against it and pricedDelta() prices the gap FROM Billing only. HealthCheck
// surfaces per-drift rows; the sow_drift read tool answers portfolio-wide; the
// generate_change_order write tool returns a confirm-gated, Billing-priced
// proposal. Everything model-free except optional narration prose (which can
// never rewrite a figure). Mock adapter only — no network.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

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
    customers: [{ name: 'Acme Industries', color: '#6366f1' }, { name: 'Globex' }],
    projects: [
      makeProject({
        id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries', status: 'In Progress',
        size_engineering: 24, size_requirements: 0, size_tableau: 0,
        target_date: '2026-03-06',
        customer_milestones: [{ name: 'UAT sign-off', date: '2026-03-01', status: 'Planned', external_commitment: true }],
        skill_splits: {
          size_engineering: [
            { sprint: 'CY26-S1', points: 24, completed: 0, status: 'pending', assigned_to: [], reasons: [] }
          ]
        }
      })
    ],
    sprints: makeSprintSequence(8, '2026-01-05'),
    team_members: [makeMember({ name: 'Dana', available_points_per_sprint: 20, primary_skills: ['Data Engineering'] })],
    settings: billingSettings
  });
}

// Build an Approved SoW linked to a project, so the grounding snapshot is
// captured from the current project state.
function approveSow(a, projectId) {
  const def = a.Definitions.loadJson('sow/sow-definition.json');
  const filler = Array.from({ length: 45 }, (_, i) => 'word' + i).join(' ');
  const sow = a.Sow.create({
    customer: 'Acme Industries', project_id: projectId, definition: def,
    generatedSections: def.sections.map(s => ({ id: s.id, content: filler, supported_by_source: true, phases: s.id === 'deliverables' ? ['Data Engineering'] : [] })),
    name: 'Alpha SoW', source_text: 'src'
  });
  a.Sow.setQuote(sow.id);
  a.Sow.get(sow.id).sections.forEach(s => { s.flagged = false; s.flag_reason = ''; });
  const r1 = a.Sow.setStatus(sow.id, 'Review', def);
  expect(r1.ok).toBe(true);
  a.Sow.get(sow.id).sections.forEach(s => { s.flagged = false; s.flag_reason = ''; });
  const r2 = a.Sow.setStatus(sow.id, 'Approved', def);
  expect(r2.ok).toBe(true);
  return a.Sow.get(sow.id);
}

beforeEach(async () => {
  app = await loadApp(fixture());
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

describe('grounding snapshot on Approve', () => {
  it('captures the linked project scope/dates/quote when the SoW is approved', () => {
    const sow = approveSow(app, 'A-1');
    const snap = sow.grounding_snapshot;
    expect(snap).toBeTruthy();
    expect(snap.project_id).toBe('A-1');
    expect(snap.sizes.size_engineering).toBe(24);
    expect(snap.scheduled_end).toBeTruthy();               // from the sprint calendar
    expect(snap.quote.billable_points).toBe(24);           // 24 SP billable (no prepaid)
    expect(snap.quote.amount).toBe(24 * 8 * 100);
    expect(snap.milestones.some(m => m.name === 'UAT sign-off')).toBe(true);
  });

  it('a legacy SoW with no snapshot is never flagged stale or drifted', () => {
    const { Sow } = app;
    const def = app.Definitions.loadJson('sow/sow-definition.json');
    const sow = Sow.create({ customer: 'Acme Industries', project_id: 'A-1', definition: def, generatedSections: [], name: 'Legacy', source_text: '' });
    // Simulate a pre-feature record: no grounding_snapshot at all.
    delete Sow.get(sow.id).grounding_snapshot;
    expect(Sow.driftReport(Sow.get(sow.id)).has_drift).toBe(false);
    expect(Sow.hasGroundingDrift(Sow.get(sow.id))).toBe(false);
    expect(Sow.isStale(Sow.get(sow.id))).toBe(false);
  });
});

describe('deterministic drift detection', () => {
  it('detects delivered-vs-quoted SP over-run per skill', () => {
    const sow = approveSow(app, 'A-1');
    // Deliver 34 SP of DE vs the 24 quoted (20 complete + 14 completed-in-progress).
    app.App.data.projects[0].skill_splits.size_engineering = [
      { sprint: 'CY26-S1', points: 20, completed: 20, status: 'complete', assigned_to: [], reasons: [] },
      { sprint: 'CY26-S2', points: 20, completed: 14, status: 'in_progress', assigned_to: [], reasons: [] }
    ];
    const drift = app.Sow.driftReport(app.Sow.get(sow.id));
    expect(drift.has_drift).toBe(true);
    const de = drift.items.find(it => it.kind === 'scope_sp' && it.skill === 'size_engineering');
    expect(de).toBeTruthy();
    expect(de.quoted).toBe(24);
    expect(de.delivered).toBe(34);
    expect(de.delta_points).toBe(10);
    expect(de.message).toMatch(/34 SP vs 24/);
  });

  it('detects a re-scoped (planned) SP growth even before delivery', () => {
    const sow = approveSow(app, 'A-1');
    app.App.data.projects[0].size_engineering = 40;   // re-scoped up, nothing delivered yet
    const drift = app.Sow.driftReport(app.Sow.get(sow.id));
    const de = drift.items.find(it => it.kind === 'scope_plan' && it.skill === 'size_engineering');
    expect(de).toBeTruthy();
    expect(de.delta_points).toBe(16);
  });

  it('detects a delivery date slip vs the sprint calendar', () => {
    const sow = approveSow(app, 'A-1');
    const before = app.Sow.get(sow.id).grounding_snapshot.scheduled_end;
    // Push work into a much later sprint → scheduled end moves out.
    app.App.data.projects[0].skill_splits.size_engineering = [
      { sprint: 'CY26-S6', points: 24, completed: 0, status: 'pending', assigned_to: [], reasons: [] }
    ];
    const liveEnd = app.Sow.scheduledEndDate(app.App.data.projects[0]);
    expect(new Date(liveEnd).getTime()).toBeGreaterThan(new Date(before).getTime());
    const drift = app.Sow.driftReport(app.Sow.get(sow.id));
    const slip = drift.items.find(it => it.kind === 'date_slip');
    expect(slip).toBeTruthy();
    expect(slip.weeks).toBeGreaterThanOrEqual(1);
    expect(slip.message).toMatch(/past the SoW date/);
  });

  it('detects a milestone slip past the signed date', () => {
    const sow = approveSow(app, 'A-1');
    app.App.data.projects[0].customer_milestones[0].date = '2026-04-05';  // slipped ~5 weeks
    const drift = app.Sow.driftReport(app.Sow.get(sow.id));
    const ms = drift.items.find(it => it.kind === 'milestone_slip');
    expect(ms).toBeTruthy();
    expect(ms.milestone).toBe('UAT sign-off');
    expect(ms.weeks).toBeGreaterThanOrEqual(4);
  });
});

describe('isStale widened + HealthCheck surfaces the drift', () => {
  it('grounding drift marks the SoW stale', () => {
    const sow = approveSow(app, 'A-1');
    expect(app.Sow.isStale(app.Sow.get(sow.id))).toBe(false);   // fresh at approval
    app.App.data.projects[0].size_engineering = 40;
    expect(app.Sow.isStale(app.Sow.get(sow.id))).toBe(true);
  });

  it('HealthCheck.commercial surfaces a change-order row per drift item', () => {
    const sow = approveSow(app, 'A-1');
    app.App.data.projects[0].skill_splits.size_engineering = [
      { sprint: 'CY26-S1', points: 34, completed: 34, status: 'complete', assigned_to: [], reasons: [] }
    ];
    const rows = app.HealthCheck.commercial('Acme Industries');
    const driftRow = rows.find(r => r.key.indexOf('sowdrift:' + sow.id) === 0);
    expect(driftRow).toBeTruthy();
    expect(driftRow.deep_link).toEqual({ type: 'sow_change_order', id: sow.id });
    expect(driftRow.action_label).toBe('Change order');
    expect(driftRow.text).toMatch(/delivered 34 SP/);
  });
});

describe('priced delta comes from Billing', () => {
  it('prices the change vs the signed snapshot quote at the customer rate band', () => {
    const sow = approveSow(app, 'A-1');
    app.App.data.projects[0].size_engineering = 40;   // +16 SP planned
    const delta = app.Sow.pricedDelta(app.Sow.get(sow.id));
    // Base is the signed 24-SP quote; new is the fresh 40-SP quote — both from Billing.
    const fresh = app.Billing.quoteForProject(app.App.data.projects[0]);
    expect(delta.base_amount).toBe(24 * 8 * 100);
    expect(delta.new_amount).toBe(fresh.totals.amount);
    expect(delta.new_amount).toBe(40 * 8 * 100);
    expect(delta.delta_amount).toBe((40 - 24) * 8 * 100);
    expect(delta.delta_billable_points).toBe(16);
  });
});

describe('change-order generator (write tool) — proposal, confirm-gated, undoable', () => {
  const ctx = (over) => Object.assign({ customer: 'Acme Industries', allScope: false, citations: [], proposals: [] }, over || {});

  it('returns a proposal priced via Billing; nothing mutates until apply()', () => {
    const { AgentTools, App, Sow, Billing } = app;
    const sow = approveSow(app, 'A-1');
    App.data.projects[0].size_engineering = 40;
    const c = ctx();
    const before = App.data.sows.length;
    const res = AgentTools.invoke('generate_change_order', { sow_id: sow.id, reason: 'scope grew' }, c);
    expect(res.proposed).toBe(true);
    expect(c.proposals.length).toBe(1);
    // The proposal carries the Billing-priced figure, not a model number.
    const commercial = c.proposals[0].changes.find(ch => ch.field === 'commercial impact');
    expect(commercial.after).toContain(Billing.fmtMoney((40 - 24) * 8 * 100));
    // No change order created yet.
    expect(App.data.sows.length).toBe(before);
    // Citation to the SoW recorded.
    expect(c.citations.some(x => x.type === 'sow' && x.id === sow.id)).toBe(true);
    // Apply → a change-order record lands, priced from Billing, and is undoable.
    const applied = c.proposals[0].apply();
    expect(applied.created).toBe(true);
    expect(App.data.sows.length).toBe(before + 1);
    const co = Sow.get(applied.sow_id);
    expect(co.doc_type).toBe('change_order');
    expect(co.parent_sow_id).toBe(sow.id);
    expect(co.change_delta.delta_amount).toBe((40 - 24) * 8 * 100);
    // Undo reverts the whole creation.
    App.undo();
    expect(App.data.sows.length).toBe(before);
  });

  it('refuses a SoW that has not drifted, and cross-customer SoWs', () => {
    const { AgentTools } = app;
    approveSow(app, 'A-1');            // no drift yet
    const sows = app.App.data.sows.filter(s => s.doc_type !== 'change_order');
    const res = AgentTools.invoke('generate_change_order', { sow_id: sows[0].id }, ctx());
    expect(res.error).toMatch(/not drifted/);
    const res2 = AgentTools.invoke('generate_change_order', { sow_id: sows[0].id }, ctx({ customer: 'Globex' }));
    expect(res2.error).toMatch(/No SoW with id/);
  });

  it('createChangeOrder validates its own required sections and stays out of the drift scan', () => {
    const { Sow } = app;
    const sow = approveSow(app, 'A-1');
    Sow.get(sow.id).grounding_snapshot.sizes.size_engineering = 10;   // force drift
    const r = Sow.createChangeOrder(sow.id, {});
    expect(r.ok).toBe(true);
    // The change order itself never self-flags as drifted/stale.
    expect(Sow.isStale(r.sow)).toBe(false);
    expect(Sow.driftReport(r.sow).has_drift).toBe(false);
    // Light validate: filled required sections pass.
    expect(Sow.validate(r.sow, null).ok).toBe(true);
    r.sow.sections.find(s => s.id === 'background').content = '';
    expect(Sow.validate(r.sow, null).ok).toBe(false);
  });
});

describe('sow_drift read tool', () => {
  const ctx = (over) => Object.assign({ customer: 'Acme Industries', allScope: false, citations: [], proposals: [] }, over || {});

  it('reports drifted SoWs scoped to the customer, with priced delta and citations, no mutation', () => {
    const { AgentTools, App } = app;
    const sow = approveSow(app, 'A-1');
    App.data.projects[0].size_engineering = 40;
    const before = JSON.stringify(App.data.sows);
    const c = ctx();
    const res = AgentTools.invoke('sow_drift', {}, c);
    expect(res.error).toBeUndefined();
    expect(res.count).toBe(1);
    expect(res.sows[0].sow_id).toBe(sow.id);
    expect(res.sows[0].priced_delta.delta_amount).toBe((40 - 24) * 8 * 100);
    expect(res.sows[0].drift.some(d => d.kind === 'scope_plan')).toBe(true);
    expect(c.citations.some(x => x.type === 'sow' && x.id === sow.id)).toBe(true);
    // Read-only: no mutation.
    expect(JSON.stringify(App.data.sows)).toBe(before);
  });

  it('aggregates across customers under allScope', () => {
    const { AgentTools, App } = app;
    approveSow(app, 'A-1');
    App.data.projects[0].size_engineering = 40;
    // Scoped to Globex → nothing.
    expect(AgentTools.invoke('sow_drift', {}, ctx({ customer: 'Globex' })).count).toBe(0);
    // allScope → sees the Acme drift.
    expect(AgentTools.invoke('sow_drift', {}, ctx({ customer: 'Globex', allScope: true })).count).toBe(1);
  });

  it('validateArgs rejects unknown args', () => {
    const { AgentTools } = app;
    const res = AgentTools.invoke('sow_drift', { bogus: 1 }, ctx());
    expect(res.error).toMatch(/unknown arg/);
  });
});

describe('AI narration adds prose but cannot change the priced figure', () => {
  it('narrated Background/Scope prose is used, but figures stay Billing-derived', async () => {
    const { AI, Sow, SowSkill, App, Billing } = app;
    const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(id);
    const sow = approveSow(app, 'A-1');
    App.data.projects[0].size_engineering = 40;
    // The model tries to smuggle a bogus figure into the prose.
    AI.ADAPTERS.mock.program([{ text: JSON.stringify({ background: 'The client agreed a revised fee of £5,000,000.', scope_change: 'Extra dashboards were added.' }) }]);
    const narrated = await SowSkill.narrateChangeOrder(sow.id);
    expect(narrated.length).toBe(2);
    const r = Sow.createChangeOrder(sow.id, { sections: narrated, source: 'ai' });
    expect(r.ok).toBe(true);
    const bg = r.sow.sections.find(s => s.id === 'background');
    const commercial = r.sow.sections.find(s => s.id === 'commercial_impact');
    // Prose narration landed on the narratable section...
    expect(bg.content).toMatch(/revised fee/);
    // ...but the priced commercial section + change_delta are Billing's, not the model's.
    expect(commercial.content).not.toMatch(/5,000,000/);
    expect(commercial.content).toContain(Billing.fmtMoney((40 - 24) * 8 * 100));
    expect(r.sow.change_delta.delta_amount).toBe((40 - 24) * 8 * 100);
  });
});
