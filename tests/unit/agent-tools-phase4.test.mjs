// Phase 4 — new Assistant tools: billing_summary (read), create_raid_item,
// close_raid_item, move_skill_split (proposal-gated writes). All via the
// registry directly plus one end-to-end run through the mock adapter.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeSprintSequence, makeMember, resetIdSeq } from '../harness/fixtures.mjs';

let app;

beforeEach(async () => {
  resetIdSeq();
  app = await loadApp(makeDataset({
    projects: [
      makeProject({
        id: 'A-1', name: 'Acme Alpha', customer: 'Acme Industries',
        size_engineering: 10,
        risks_register: [{ description: 'Data quality risk', action: '', owner: 'Dana', resolution_date: null, impact: 4, probability: 3 }],
        issues_register: [{ description: 'API blocked', action: '', owner: '', opened_date: '2026-06-01', resolution_date: null }],
        skill_splits: {
          size_engineering: [
            { sprint: 'CY26-S1', points: 6, status: 'complete', completed: 6, assigned_to: [], reasons: [] },
            { sprint: 'CY26-S2', points: 4, status: 'pending', completed: 0, assigned_to: [], reasons: [] }
          ]
        }
      }),
      makeProject({ id: 'G-1', name: 'Globex Gamma', customer: 'Globex' })
    ],
    sprints: makeSprintSequence(3),
    team_members: [makeMember({ name: 'Dana', available_points_per_sprint: 20 })],
    settings: { billing: { currency: 'GBP', sell_rates: { size_engineering: 900 } } }
  }));
  app.App.activeCustomer = 'Acme Industries';
});
afterEach(() => app.teardown());

const ctx = () => ({ customer: 'Acme Industries', proposals: [], citations: [] });

describe('billing_summary read tool', () => {
  it('reports arrangement balances and per-project billing, customer-scoped', () => {
    const { AgentTools, Billing } = app;
    Billing.addArrangement({ customer: 'Acme Industries', label: 'Retainer', skill: 'any', prepaid_points: 4, amount_invoiced: 3200 });
    const c = ctx();
    const res = AgentTools.invoke('billing_summary', {}, c);
    expect(res.error).toBeUndefined();
    expect(res.arrangements[0]).toMatchObject({ label: 'Retainer', drawn_points: 4, remaining_points: 0 });
    expect(res.projects[0]).toMatchObject({ id: 'A-1', consumed_points: 6, prepaid_covered_points: 4, billable_points: 2, billable_amount: 1800 });
    expect(res.projects.some(p => p.id === 'G-1')).toBe(false);
    expect(c.citations.some(x => x.id === 'A-1')).toBe(true);
  });
});

describe('create_raid_item', () => {
  it('proposes; apply pushes the correct register shape, audited as ai and undoable', () => {
    const { AgentTools, App } = app;
    const c = ctx();
    const res = AgentTools.invoke('create_raid_item', {
      project_id: 'A-1', kind: 'risk', description: 'SME availability may slip during summer leave',
      impact: 9, probability: 2, mitigation: 'Book SME time now', owner: 'Lee', reason: 'raised in standup'
    }, c);
    expect(res.proposed).toBe(true);
    const p = App.data.projects.find(x => x.id === 'A-1');
    expect(p.risks_register.length).toBe(1); // unchanged until confirm
    c.proposals[0].apply();
    expect(p.risks_register.length).toBe(2);
    const risk = p.risks_register[1];
    expect(risk).toMatchObject({ description: 'SME availability may slip during summer leave', action: 'Book SME time now', owner: 'Lee', resolution_date: null, probability: 2 });
    expect(risk.impact).toBe(5); // clamped to 1-5
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'raid_risk_added')).toBe(true);
    App.undo();
    expect(App.data.projects.find(x => x.id === 'A-1').risks_register.length).toBe(1);
  });

  it('builds assumption/issue/decision shapes matching the app registers', () => {
    const { AgentTools, App } = app;
    const c = ctx();
    ['assumption', 'issue', 'decision'].forEach(kind => {
      AgentTools.invoke('create_raid_item', { project_id: 'A-1', kind, description: 'A ' + kind + ' raised by the assistant' }, c);
    });
    c.proposals.forEach(p => p.apply());
    const p = App.data.projects.find(x => x.id === 'A-1');
    expect(p.assumptions_register[p.assumptions_register.length - 1]).toMatchObject({ text: 'A assumption raised by the assistant', made_by: 'Assistant' });
    expect(p.issues_register[1]).toMatchObject({ description: 'A issue raised by the assistant', resolution_date: null });
    expect(p.decisions_register[p.decisions_register.length - 1]).toMatchObject({ decision: 'A decision raised by the assistant', tag: 'assistant' });
  });

  it('rejects cross-customer targets and trivial descriptions', () => {
    const { AgentTools } = app;
    const c = ctx();
    expect(AgentTools.invoke('create_raid_item', { project_id: 'G-1', kind: 'risk', description: 'A real description' }, c).error).toMatch(/No project/);
    expect(AgentTools.invoke('create_raid_item', { project_id: 'A-1', kind: 'risk', description: 'hm' }, c).error).toMatch(/too short/);
    expect(c.proposals.length).toBe(0);
  });
});

describe('close_raid_item', () => {
  it('closes by index from list_raid_items; refuses double-close', () => {
    const { AgentTools, App } = app;
    const c = ctx();
    const listed = AgentTools.invoke('list_raid_items', { kind: 'issue' }, c);
    expect(listed.items[0]).toMatchObject({ project_id: 'A-1', index: 0, closed: false });
    const res = AgentTools.invoke('close_raid_item', { project_id: 'A-1', kind: 'issue', index: 0 }, c);
    expect(res.proposed).toBe(true);
    c.proposals[0].apply();
    const issue = App.data.projects.find(x => x.id === 'A-1').issues_register[0];
    expect(issue.status).toBe('closed');
    expect(issue.resolution_date).toBeTruthy();
    expect(App.data.audit_log.some(e => e.source === 'ai' && e.field === 'raid_issue_closed')).toBe(true);
    // Already closed → error, no proposal.
    const again = AgentTools.invoke('close_raid_item', { project_id: 'A-1', kind: 'issue', index: 0 }, ctx());
    expect(again.error).toMatch(/already closed/);
    // Out-of-range index → precise error.
    expect(AgentTools.invoke('close_raid_item', { project_id: 'A-1', kind: 'risk', index: 7 }, ctx()).error).toMatch(/No risk at index 7/);
  });
});

describe('move_skill_split', () => {
  it('validates via Sprint._validateSliceMove, then apply moves through the audited path', () => {
    const { AgentTools, App } = app;
    const c = ctx();
    const res = AgentTools.invoke('move_skill_split', {
      project_id: 'A-1', skill: 'size_engineering', from_sprint: 'CY26-S2', to_sprint: 'CY26-S3', reason: 'free up S2'
    }, c);
    expect(res.proposed).toBe(true);
    const p = App.data.projects.find(x => x.id === 'A-1');
    expect(p.skill_splits.size_engineering.some(sp => sp.sprint === 'CY26-S3')).toBe(false); // gated
    c.proposals[0].apply();
    expect(p.skill_splits.size_engineering.some(sp => sp.sprint === 'CY26-S3' && sp.points === 4)).toBe(true);
    expect(p.skill_splits.size_engineering.some(sp => sp.sprint === 'CY26-S2')).toBe(false);
    // The move itself is audited as an AI write (other automatic entries,
    // e.g. skill_auto_complete, may follow it in the log).
    const entry = App.data.audit_log.slice().reverse().find(e => e.field === 'skill_splits.size_engineering');
    expect(entry).toBeTruthy();
    expect(entry.oldValue).toBe('CY26-S2');
    expect(entry.newValue).toBe('CY26-S3');
    expect(entry.source).toBe('ai');
    // Completed work never moves; unknown sprints are refused with the known list.
    expect(AgentTools.invoke('move_skill_split', { project_id: 'A-1', skill: 'size_engineering', from_sprint: 'CY26-S1', to_sprint: 'CY26-S3' }, ctx()).error).toMatch(/complete/);
    expect(AgentTools.invoke('move_skill_split', { project_id: 'A-1', skill: 'size_engineering', from_sprint: 'CY26-S3', to_sprint: 'CY99-S9' }, ctx()).error).toMatch(/Unknown destination/);
  });

  it('hard validation failures refuse the proposal outright', () => {
    const { AgentTools } = app;
    // No Tableau-skilled member exists -> moving a tableau slice hard-fails.
    const p = app.App.data.projects.find(x => x.id === 'A-1');
    p.size_tableau = 5;
    p.skill_splits.size_tableau = [{ sprint: 'CY26-S1', points: 5, status: 'pending', completed: 0, assigned_to: [], reasons: [] }];
    const res = AgentTools.invoke('move_skill_split', { project_id: 'A-1', skill: 'size_tableau', from_sprint: 'CY26-S1', to_sprint: 'CY26-S2' }, ctx());
    expect(res.error).toMatch(/refused by plan validation/);
  });
});

describe('end-to-end through the assistant (mock adapter)', () => {
  it('"close the blocked issue" round trip: tool call -> proposal card -> confirm applies', async () => {
    const { AI, Assistant, App, document } = app;
    const id = AI.upsertProfile({ name: 'Mock', adapter: 'mock', model: 'mock' });
    AI.setDefaultProfile(id);
    AI.ADAPTERS.mock.program([
      { toolCalls: [{ id: 'c1', name: 'list_raid_items', args: { kind: 'issue' } }] },
      { toolCalls: [{ id: 'c2', name: 'close_raid_item', args: { project_id: 'A-1', kind: 'issue', index: 0, reason: 'API unblocked yesterday' } }] },
      { text: 'I proposed closing the API issue on Acme Alpha.' }
    ]);
    Assistant.open();
    document.getElementById('assistantInput').value = 'close the blocked API issue on alpha';
    await Assistant.send();
    const card = document.querySelector('#assistantBody .assistant-proposal');
    expect(card.textContent).toContain('Close issue on “Acme Alpha”');
    const items = Assistant._items();
    Assistant.confirmProposal(items.findIndex(i => i.kind === 'proposal'));
    expect(App.data.projects.find(x => x.id === 'A-1').issues_register[0].status).toBe('closed');
  });
});
