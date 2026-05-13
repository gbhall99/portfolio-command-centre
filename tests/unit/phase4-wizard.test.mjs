// Phase 4 — Create wizard (3-step, only Step 1 mandatory). Tests cover AC-4.1
// (create with only Step 1 lands on Overview with readiness chip showing the
// gap), AC-4.2 ("Add details later →" button on Step 1), AC-4.3 (template
// auto-fill with Suggested label on MoSCoW / phase flow / governance forum /
// strategy link), AC-4.4 (per-field "Add later" affordance on Steps 2 + 3).
//
// The plan lives at plans/detail-panel-ia-refactor.md (§3.7, §5 row Phase 4).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

async function boot() {
  const app = await loadApp(makeDataset({
    projects: [],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

function openWizard(app) {
  app.DetailPanel._openCreateWizard();
  return app.document.getElementById('createWizard');
}

describe('Phase 4 / AC-4.2 — Step 1 + Add details later shortcut', () => {
  it('renders 3 step pills with Step 1 active and an "Add details later →" button visible on Step 1', async () => {
    const app = await boot();
    const wiz = openWizard(app);
    expect(wiz).toBeTruthy();
    const pills = wiz.querySelectorAll('[data-wiz-step-pill]');
    expect(pills.length).toBe(3);
    const addLater = wiz.querySelector('.wiz-add-later');
    expect(addLater).toBeTruthy();
    expect(addLater.textContent).toMatch(/Add details later/);
    // The mandatory fields on Step 1 are rendered.
    expect(wiz.querySelector('#cwName')).toBeTruthy();
    expect(wiz.querySelector('#cwCustomer')).toBeTruthy();
    expect(wiz.querySelector('#cwSize')).toBeTruthy();
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });

  it('Add details later button is hidden once the user advances to Step 2', async () => {
    const app = await boot();
    openWizard(app);
    app.document.getElementById('cwName').value = 'P';
    app.document.getElementById('cwCustomer').value = 'Acme Industries';
    app.document.getElementById('cwSize').value = '10';
    app.DetailPanel._wizardNext();
    const addLater = app.document.getElementById('cwAddLater');
    expect(addLater.style.display).toBe('none');
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });
});

describe('Phase 4 / AC-4.1 — Create with only Step 1 → Overview + readiness chip', () => {
  it('creating with just name + customer + size lands on Overview and the readiness chip shows "backlog ✓ · planning ✗ · steerco ✗"', async () => {
    const app = await boot();
    openWizard(app);
    app.document.getElementById('cwName').value = 'Phase4 Test';
    app.document.getElementById('cwCustomer').value = 'Acme Industries';
    app.document.getElementById('cwSize').value = '15';
    app.DetailPanel._addDetailsLater();

    // The wizard closes and the detail panel opens on the new project.
    expect(app.document.getElementById('createWizard')).toBeFalsy();
    expect(app.DetailPanel.activeTab).toBe('overview');

    // Project actually persisted.
    const proj = app.App.data.projects.find(p => p.name === 'Phase4 Test');
    expect(proj).toBeTruthy();
    expect(proj.size_total).toBe(15);
    expect(proj.customer).toBe('Acme Industries');

    // The readiness chip is in the sticky-header DOM, with backlog ✓ + planning ✗ + steerco ✗.
    const chip = app.document.querySelector('.dp-readiness-chip');
    expect(chip).toBeTruthy();
    const text = chip.textContent;
    expect(text).toMatch(/backlog\s*✓/);
    expect(text).toMatch(/planning\s*✗/);
    expect(text).toMatch(/steerco\s*✗/);

    app.teardown();
  });

  it('clicking Next on Step 1 with empty name surfaces an error and stays on Step 1', async () => {
    const app = await boot();
    openWizard(app);
    app.document.getElementById('cwName').value = '';
    app.document.getElementById('cwSize').value = '10';
    app.DetailPanel._wizardNext();
    expect(app.DetailPanel._cwState.step).toBe(1);
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });
});

describe('Phase 4 / AC-4.3 — Template auto-fill + Suggested labels', () => {
  it('picking a template auto-fills MoSCoW / phase flow / governance forum / strategy link with explicit "Suggested" labels', async () => {
    const app = await boot();
    // Seed a template that exercises every suggested-field path.
    app.App.data.project_templates = (app.App.data.project_templates || []).concat([{
      id: 'tpl-phase4-test',
      name: 'Phase 4 Test Template',
      category: 'General',
      moscow: 'Must',
      governance_forum: 'Acme Weekly',
      metric_ids: ['metric-1'],
      objective_ids: ['obj-1'],
      persona_ids: ['per-1'],
      delivery_config: { phase_order: ['Requirements', 'Data Engineering', 'Tableau'] }
    }]);

    openWizard(app);
    app.document.getElementById('cwName').value = 'P';
    app.document.getElementById('cwCustomer').value = 'Acme Industries';
    app.document.getElementById('cwSize').value = '10';
    app.DetailPanel._wizardNext();

    // Apply template suggestions.
    const tplSel = app.document.getElementById('cwTemplate');
    tplSel.value = 'tpl-phase4-test';
    app.DetailPanel._applyTemplateSuggestions(tplSel.value);

    // Each downstream field is filled.
    expect(app.document.getElementById('cwMoscow').value).toBe('Must');
    expect(app.document.getElementById('cwGovernanceForum').value).toBe('Acme Weekly');
    // Strategy linkage now uses 3 multi-selects (Slot B / Item 1) — selections set on the matching <select multiple>.
    // Note: the template-suggested rows aren't in the option list of the wizard's selects because the
    // wizard's selects are populated from Objectives.list() / Metrics.list() / Personas.list() (customer-scoped).
    // The suggested label flag is the AC for templated strategy linkage; option binding is exercised separately.
    expect(app.document.querySelector('[data-wiz-suggested="strategy_link"]').style.display).not.toBe('none');

    // Step 3 field also gets the phase flow suggestion — phase flow now uses checkbox toggles.
    app.DetailPanel._wizardNext();
    const phaseBlock = app.document.getElementById('cwPhaseFlowBlock');
    expect(phaseBlock).toBeTruthy();
    const checkedPhases = Array.from(phaseBlock.querySelectorAll('input[data-cw-phase]:checked')).map(i => i.dataset.cwPhase);
    expect(checkedPhases).toContain('Requirements');
    expect(checkedPhases).toContain('Data Engineering');
    expect(checkedPhases).toContain('Tableau');

    // Suggested labels are visible for the populated fields.
    const visibleSuggested = Array.from(app.document.querySelectorAll('[data-wiz-suggested]')).filter(el => el.style.display !== 'none');
    const fields = visibleSuggested.map(el => el.dataset.wizSuggested);
    expect(fields).toContain('moscow');
    expect(fields).toContain('governance_forum');
    expect(fields).toContain('strategy_link');
    expect(fields).toContain('phase_flow');

    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });

  it('clearing the template removes the Suggested labels', async () => {
    const app = await boot();
    app.App.data.project_templates = (app.App.data.project_templates || []).concat([{
      id: 'tpl-x', name: 'X', moscow: 'Could', delivery_config: { phase_order: ['Requirements'] }
    }]);
    openWizard(app);
    app.document.getElementById('cwName').value = 'P';
    app.document.getElementById('cwCustomer').value = 'Acme Industries';
    app.document.getElementById('cwSize').value = '10';
    app.DetailPanel._wizardNext();
    app.DetailPanel._applyTemplateSuggestions('tpl-x');
    expect(app.document.querySelector('[data-wiz-suggested="moscow"]').style.display).not.toBe('none');
    app.DetailPanel._applyTemplateSuggestions('');
    expect(app.document.querySelector('[data-wiz-suggested="moscow"]').style.display).toBe('none');
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });
});

describe('Phase 4 / AC-4.4 — Per-field "Add later" affordance on Steps 2 + 3', () => {
  it('every field row on Steps 2 + 3 has a .wiz-skip-field button', async () => {
    const app = await boot();
    openWizard(app);
    const step2Fields = Array.from(app.document.querySelectorAll('[data-wiz-step="2"] .wiz-field-row'));
    const step3Fields = Array.from(app.document.querySelectorAll('[data-wiz-step="3"] .wiz-field-row'));
    expect(step2Fields.length).toBeGreaterThan(0);
    expect(step3Fields.length).toBeGreaterThan(0);
    [...step2Fields, ...step3Fields].forEach(row => {
      expect(row.querySelector('.wiz-skip-field')).toBeTruthy();
    });
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });

  it('clicking the skip button on a Step 2 field disables its inputs; skipped values are omitted from the created project', async () => {
    const app = await boot();
    openWizard(app);
    app.document.getElementById('cwName').value = 'WithSkippedSponsor';
    app.document.getElementById('cwCustomer').value = 'Acme Industries';
    app.document.getElementById('cwSize').value = '12';
    app.DetailPanel._wizardNext();

    // Sponsor is now a <select> (Slot B / Item 1) — seed an option then pick it.
    const sponsorSel = app.document.getElementById('cwSponsor');
    const opt = app.document.createElement('option');
    opt.value = 'Bob';
    opt.textContent = 'Bob';
    sponsorSel.appendChild(opt);
    sponsorSel.value = 'Bob';
    app.DetailPanel._toggleWizardSkip('sponsor');
    const sponsorRow = app.document.querySelector('[data-wiz-field="sponsor"]');
    // The select inside the row is disabled when the field is skipped.
    expect(sponsorRow.querySelector('select').disabled).toBe(true);

    // Advance to Step 3 then create.
    app.DetailPanel._wizardNext();
    app.DetailPanel._confirmCreateWizard();

    const proj = app.App.data.projects.find(p => p.name === 'WithSkippedSponsor');
    expect(proj).toBeTruthy();
    expect(proj.sponsor).toBe('');
    app.teardown();
  });
});
