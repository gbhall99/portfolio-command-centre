// Phase 5 — Inline quick-add chips + reason capture.
// Tests cover AC-5.1 (Phase tracker + Log risk chip; risk appears in RAID + Overview blockers),
// AC-5.2 (WSJF / MoSCoW change → reason prompt → auto-Decision tagged prioritisation),
// AC-5.3 (total points post-baseline change → reason prompt → auto-Decision tagged
// scope-change with meta.delta), and AC-5.4 (modal: cancel reverts; confirm undo
// toast undoes both the field change AND the auto-Decision).
//
// Plan: plans/detail-panel-ia-refactor.md (§5 Phase 5 row).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function bootWithProject(extra = {}) {
  const p = makeProject(Object.assign({ id: 'P5', name: 'P', customer: 'Acme Industries' }, extra));
  const app = await loadApp(makeDataset({
    projects: [p],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return { app, p };
}

describe('Phase 5 / AC-5.1 — Phase tracker + Log risk chip', () => {
  it('renders the + Log risk chip on the Delivery > Delivery Phases section', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('P5');
    const delivery = app.document.querySelector('[data-dp-tab="delivery"]');
    expect(delivery).toBeTruthy();
    const chip = delivery.querySelector('.dp-phase-tracker-log-risk');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toMatch(/Log risk/);
    app.teardown();
  });

  it('addPhaseTrackerRisk appends to risks_register AND surfaces on the Overview blockers strip', async () => {
    const { app } = await bootWithProject({
      risks_register: [{ id: 'r-existing', description: 'Existing critical', impact: 5, probability: 5 }]
    });
    app.DetailPanel.open('P5');
    const before = app.App.data.projects[0].risks_register.length;
    const newRisk = app.DetailPanel.addPhaseTrackerRisk('SME unavailable in sprint 3', { impact: 4, probability: 4 });
    expect(newRisk).toBeTruthy();
    expect(newRisk.id).toMatch(/^risk-/);
    expect(app.App.data.projects[0].risks_register.length).toBe(before + 1);

    // RAID Risks register shows the new row.
    const raid = app.document.querySelector('[data-dp-tab="raid"]');
    expect(raid.innerHTML).toMatch(/SME unavailable in sprint 3/);

    // User-IA-rev: Blockers strip moved from Overview to RAID.
    const blockersStrip = app.document.querySelector('[data-dp-tab="raid"] .dp-blockers-strip');
    expect(blockersStrip).toBeTruthy();
    expect(blockersStrip.textContent).toContain('SME unavailable in sprint 3');
    app.teardown();
  });

  it('inline form open/close/submit round-trip: open form, type, submit → new risk persists', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('P5');
    app.DetailPanel._openPhaseTrackerRiskForm();
    const form = app.document.getElementById('phaseTrackerRiskForm');
    expect(form.style.display).toBe('flex');
    const input = app.document.getElementById('phaseTrackerRiskInput');
    input.value = 'Data quality regression';
    app.DetailPanel._submitPhaseTrackerRisk();
    const risks = app.App.data.projects[0].risks_register || [];
    expect(risks.some(r => r.description === 'Data quality regression')).toBe(true);
    app.teardown();
  });
});

describe('Phase 5 / AC-5.2 — Re-prioritisation reason capture', () => {
  it('_captureChangeReason → confirm with reason creates a Decision tagged "prioritisation" with rationale + meta', async () => {
    const { app } = await bootWithProject({ business_value: 4, decisions_register: [] });
    app.DetailPanel.open('P5');
    app.DetailPanel._captureChangeReason({
      projectId: 'P5',
      field: 'business_value',
      oldValue: 4,
      newValue: 8,
      tag: 'prioritisation'
    });
    expect(app.document.getElementById('reasonModalOverlay')).toBeTruthy();
    app.document.getElementById('reasonInput').value = 'Sponsor escalation in steerco';
    app.DetailPanel._confirmReasonModal();
    const decisions = app.App.data.projects[0].decisions_register;
    expect(Array.isArray(decisions)).toBe(true);
    expect(decisions.length).toBe(1);
    const d = decisions[0];
    expect(d.tag).toBe('prioritisation');
    expect(d.rationale).toBe('Sponsor escalation in steerco');
    expect(d.meta.field).toBe('business_value');
    expect(d.meta.from).toBe(4);
    expect(d.meta.to).toBe(8);
    app.teardown();
  });

  it('confirm with empty reason refuses to close the modal and surfaces an error toast', async () => {
    const { app } = await bootWithProject({ business_value: 4 });
    app.DetailPanel.open('P5');
    app.DetailPanel._captureChangeReason({
      projectId: 'P5', field: 'moscow', oldValue: 'Should', newValue: 'Must', tag: 'prioritisation'
    });
    app.document.getElementById('reasonInput').value = '   ';
    app.DetailPanel._confirmReasonModal();
    expect(app.document.getElementById('reasonModalOverlay')).toBeTruthy();
    expect((app.App.data.projects[0].decisions_register || []).length).toBe(0);
    app.DetailPanel._cancelReasonModal();
    app.teardown();
  });
});

describe('Phase 5 / AC-5.3 — Scope-change reason capture', () => {
  it('_captureChangeReason with tag="scope-change" creates a Decision with meta.delta = newValue - oldValue', async () => {
    const { app } = await bootWithProject({
      size_engineering: 20, size_total: 20,
      estimate_baseline: { size_requirements: 0, size_tableau: 0, size_engineering: 15, size_data_science: 0, size_uat_adoption: 0 }
    });
    app.DetailPanel.open('P5');
    app.DetailPanel._captureChangeReason({
      projectId: 'P5',
      field: 'size_total',
      oldValue: 15,
      newValue: 22,
      tag: 'scope-change'
    });
    app.document.getElementById('reasonInput').value = 'Added 7 SP for UAT scope';
    app.DetailPanel._confirmReasonModal();
    const decisions = app.App.data.projects[0].decisions_register;
    expect(decisions.length).toBe(1);
    expect(decisions[0].tag).toBe('scope-change');
    expect(decisions[0].meta.delta).toBe(7);
    expect(decisions[0].meta.field).toBe('size_total');
    expect(decisions[0].rationale).toBe('Added 7 SP for UAT scope');
    app.teardown();
  });
});

describe('Phase 5 / AC-5.4 — Modal cancel + undo toast', () => {
  it('cancel reverts the field on the project (App.updateProject called with oldValue)', async () => {
    const { app } = await bootWithProject({ business_value: 3 });
    app.DetailPanel.open('P5');
    // Simulate the field having been changed to 9.
    app.App.updateProject('P5', 'business_value', 9);
    expect(app.App.data.projects[0].business_value).toBe(9);
    app.DetailPanel._captureChangeReason({
      projectId: 'P5', field: 'business_value', oldValue: 3, newValue: 9, tag: 'prioritisation'
    });
    app.DetailPanel._cancelReasonModal();
    expect(app.App.data.projects[0].business_value).toBe(3);
    expect((app.App.data.projects[0].decisions_register || []).length).toBe(0);
    app.teardown();
  });

  it('confirm shows an undo toast; clicking Undo removes the Decision AND reverts the field', async () => {
    const { app } = await bootWithProject({ business_value: 3 });
    app.DetailPanel.open('P5');
    app.App.updateProject('P5', 'business_value', 9);
    app.DetailPanel._captureChangeReason({
      projectId: 'P5', field: 'business_value', oldValue: 3, newValue: 9, tag: 'prioritisation'
    });
    app.document.getElementById('reasonInput').value = 'PO request';
    app.DetailPanel._confirmReasonModal();
    // Decision logged + undo toast in DOM.
    expect(app.App.data.projects[0].decisions_register.length).toBe(1);
    const toast = app.document.querySelector('.dp-undo-toast');
    expect(toast).toBeTruthy();
    const undoBtn = toast.querySelector('.dp-undo-toast-btn');
    expect(undoBtn).toBeTruthy();
    undoBtn.click();
    // Decision removed AND field reverted.
    expect(app.App.data.projects[0].decisions_register.length).toBe(0);
    expect(app.App.data.projects[0].business_value).toBe(3);
    app.teardown();
  });
});
