// Slot D — Walkthrough additions: EVM tile (Item 2-half), Issues tile (Item 7),
// scope/effort tile (Item 9), pack selector (Item 8), milestone add/review (Item 5).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function bootWithProject(extra = {}) {
  const p = makeProject(Object.assign({ id: 'D1', name: 'P', customer: 'Acme Industries' }, extra));
  const app = await loadApp(makeDataset({
    projects: [p],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }]
  }));
  app.App.activeCustomer = 'Acme Industries';
  app.Walkthrough.open('Acme Industries');
  app.Walkthrough.selectProject('D1');
  return { app, p };
}

describe('Slot D — Item 2-half: EVM tile moved to Walkthrough', () => {
  it('Overview tab no longer renders the .evm-strip', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('D1');
    const overview = app.document.querySelector('[data-dp-tab="overview"]');
    expect(overview).toBeTruthy();
    expect(overview.querySelector('.evm-strip')).toBeFalsy();
    app.teardown();
  });

  it('Walkthrough renders [data-wt-tile="evm"] containing the EVM cells', async () => {
    const { app } = await bootWithProject();
    const evmTile = app.document.querySelector('[data-wt-tile="evm"]');
    expect(evmTile).toBeTruthy();
    expect(evmTile.querySelector('.evm-strip')).toBeTruthy();
    app.teardown();
  });

  it('Overview.renderEvmStrip returns the same HTML the DetailPanel previously rendered (shared)', async () => {
    const { app } = await bootWithProject();
    const direct = app.Overview.renderEvmStrip(app.App.data.projects[0]);
    const dpDirect = app.DetailPanel.renderEvmStrip(app.App.data.projects[0]);
    expect(direct).toBe(dpDirect);
    app.teardown();
  });
});

describe('Slot D — Item 7: Open issues tile in the Walkthrough', () => {
  it('renders [data-wt-tile="open-issues"] alongside open-risks and open-actions', async () => {
    const { app } = await bootWithProject({
      issues_register: [{ id: 'i1', description: 'Late vendor', status: 'open', owner: 'Alice' }]
    });
    const tile = app.document.querySelector('[data-wt-tile="open-issues"]');
    expect(tile).toBeTruthy();
    expect(tile.textContent).toContain('Late vendor');
    expect(tile.textContent).toContain('Alice');
    app.teardown();
  });

  it('RAID.closeIssue marks the issue closed and stamps resolution_date', async () => {
    const { app } = await bootWithProject({
      issues_register: [{ id: 'i2', description: 'X', status: 'open' }]
    });
    app.RAID.closeIssue('D1', 0);
    const proj = app.App.data.projects[0];
    expect(proj.issues_register[0].status).toBe('closed');
    expect(proj.issues_register[0].resolution_date).toBeTruthy();
    app.teardown();
  });

  it('closed issues do NOT appear on the Walkthrough open-issues tile', async () => {
    const { app } = await bootWithProject({
      issues_register: [
        { id: 'a', description: 'OPEN', status: 'open' },
        { id: 'b', description: 'CLOSED', status: 'closed' }
      ]
    });
    const tile = app.document.querySelector('[data-wt-tile="open-issues"]');
    expect(tile.textContent).toContain('OPEN');
    expect(tile.textContent).not.toContain('CLOSED');
    app.teardown();
  });
});

describe('Slot D — Item 9: Walkthrough scope/effort tile', () => {
  it('renders a [data-wt-tile="scope-effort"] tile with one row per skill', async () => {
    const { app } = await bootWithProject({
      size_engineering: 10, size_tableau: 5, size_total: 15
    });
    const tile = app.document.querySelector('[data-wt-tile="scope-effort"]');
    expect(tile).toBeTruthy();
    const rows = tile.querySelectorAll('[data-wt-scope-row]');
    expect(rows.length).toBe(5);
    expect(tile.textContent).toMatch(/15.*SP total/);
    app.teardown();
  });

  it('shows ± delta vs baseline when baseline exists', async () => {
    const { app } = await bootWithProject({
      size_engineering: 12,
      size_total: 12,
      estimate_baseline: { size_engineering: 10 }
    });
    const tile = app.document.querySelector('[data-wt-tile="scope-effort"]');
    expect(tile.querySelector('.wt-scope-delta').textContent).toMatch(/\+2 SP vs baseline/);
    app.teardown();
  });

  it('_onScopeEffortChange writes to the project + triggers the reason modal when baseline present', async () => {
    const { app } = await bootWithProject({
      size_engineering: 10, size_total: 10,
      estimate_baseline: { size_engineering: 10 }
    });
    // Locate the engineering input and simulate a change.
    const input = app.document.querySelector('.wt-scope-input[data-skill="size_engineering"]');
    expect(input).toBeTruthy();
    input.value = '18';
    app.Walkthrough._onScopeEffortChange(input);
    expect(app.App.data.projects[0].size_engineering).toBe(18);
    expect(app.App.data.projects[0].size_total).toBe(18);
    // Reason modal should be open (Phase 5 _captureChangeReason).
    expect(app.document.getElementById('reasonModalOverlay')).toBeTruthy();
    app.DetailPanel._cancelReasonModal();
    app.teardown();
  });
});

describe('Slot D — Item 8: Walkthrough pack selector before button', () => {
  it('renders a [data-wt-pack-select] <select> + disabled button by default', async () => {
    const { app } = await bootWithProject();
    const row = app.document.querySelector('[data-wt-pack-row]');
    expect(row).toBeTruthy();
    const select = row.querySelector('[data-wt-pack-select]');
    const btn = row.querySelector('[data-wt-pack-open]');
    expect(select).toBeTruthy();
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
    app.teardown();
  });

  it('selecting a pack type enables the button', async () => {
    const { app } = await bootWithProject();
    const select = app.document.getElementById('wtPackSelect');
    select.value = 'customer';
    app.Walkthrough._onPackSelectChange();
    const btn = app.document.getElementById('wtPackOpenBtn');
    expect(btn.disabled).toBe(false);
    app.teardown();
  });

  it('the select offers customer / sponsor / meeting / portfolio options', async () => {
    const { app } = await bootWithProject();
    const select = app.document.getElementById('wtPackSelect');
    const values = Array.from(select.options).map(o => o.value).filter(Boolean);
    expect(values).toContain('customer');
    expect(values).toContain('sponsor');
    expect(values).toContain('meeting');
    expect(values).toContain('portfolio');
    app.teardown();
  });
});

describe('Slot D — Item 5: Milestone add + Mark reviewed in the Walkthrough', () => {
  it('renders an inline + Add milestone form in the milestones tile', async () => {
    const { app } = await bootWithProject();
    const tile = app.document.querySelector('.wt-milestones .wt-ms-add-row');
    expect(tile).toBeTruthy();
    expect(tile.querySelector('#wtMsAddName')).toBeTruthy();
    expect(tile.querySelector('#wtMsAddDate')).toBeTruthy();
    app.teardown();
  });

  it('_addMilestoneFromWalkthrough adds to project.customer_milestones', async () => {
    const { app } = await bootWithProject();
    app.document.getElementById('wtMsAddName').value = 'Sponsor demo';
    app.document.getElementById('wtMsAddDate').value = '2026-07-15';
    app.Walkthrough._addMilestoneFromWalkthrough('D1');
    const ms = app.App.data.projects[0].customer_milestones;
    expect(ms.length).toBe(1);
    expect(ms[0].name).toBe('Sponsor demo');
    expect(ms[0].date).toBe('2026-07-15');
    expect(ms[0].status).toBe('Planned');
    app.teardown();
  });

  it('milestones added in the walkthrough surface on the Delivery tab', async () => {
    // Milestones & Dates lives on Delivery (date-centric section).
    const { app } = await bootWithProject();
    app.document.getElementById('wtMsAddName').value = 'WT-added';
    app.document.getElementById('wtMsAddDate').value = '2026-08-01';
    app.Walkthrough._addMilestoneFromWalkthrough('D1');
    app.DetailPanel.open('D1');
    const delivery = app.document.querySelector('[data-dp-tab="delivery"]');
    expect(delivery.innerHTML).toContain('WT-added');
    app.teardown();
  });

  it('_markMilestoneReviewed stamps reviewed_at + reviewed_by_walkthrough_id', async () => {
    const { app } = await bootWithProject({
      customer_milestones: [{ id: 'm1', name: 'M1', date: '2026-06-01', status: 'Planned' }]
    });
    app.Walkthrough._activeWalkthroughId = 'wt-xyz';
    app.Walkthrough._markMilestoneReviewed('D1', 0);
    const m = app.App.data.projects[0].customer_milestones[0];
    expect(m.reviewed_at).toBeTruthy();
    expect(m.reviewed_by_walkthrough_id).toBe('wt-xyz');
    app.teardown();
  });

  it('reviewed milestones render the reviewed badge instead of the Mark-reviewed button', async () => {
    const { app } = await bootWithProject({
      customer_milestones: [{ id: 'm1', name: 'M1', date: '2026-06-01', status: 'Planned', reviewed_at: '2026-05-13T10:00:00Z' }]
    });
    const row = app.document.querySelector('.wt-ms-row-cust[data-wt-ms-idx="0"]');
    expect(row).toBeTruthy();
    expect(row.querySelector('.wt-ms-reviewed')).toBeTruthy();
    expect(row.querySelector('.wt-ms-review-btn')).toBeFalsy();
    app.teardown();
  });
});
