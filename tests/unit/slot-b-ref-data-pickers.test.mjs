// Slot B — Items 1 (wizard reference-data parity) + 6 (compact strategy pickers).
// Plan: plans/post-launch-ui-fixes.md.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

async function bootEmpty() {
  const app = await loadApp(makeDataset({
    projects: [],
    customers: [{ name: 'Acme Industries', color: '#6366f1', sponsors: ['Ada Lovelace', 'Grace Hopper'] }],
    governance_forums: [{ id: 'gf-1', name: 'Acme Weekly', customer: 'Acme Industries' }]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

async function bootWithProject(extra = {}) {
  const p = makeProject(Object.assign({ id: 'B1', name: 'P', customer: 'Acme Industries' }, extra));
  const app = await loadApp(makeDataset({
    projects: [p],
    customers: [{ name: 'Acme Industries', color: '#6366f1' }]
  }));
  app.App.activeCustomer = 'Acme Industries';
  return { app, p };
}

describe('Slot B — Item 1: wizard ref-data parity', () => {
  it('cwSponsor renders as a <select> sourced from customer.sponsors', async () => {
    const app = await bootEmpty();
    app.DetailPanel._openCreateWizard();
    const sponsorEl = app.document.getElementById('cwSponsor');
    expect(sponsorEl).toBeTruthy();
    expect(sponsorEl.tagName).toBe('SELECT');
    const optionValues = Array.from(sponsorEl.options).map(o => o.value);
    expect(optionValues).toContain('Ada Lovelace');
    expect(optionValues).toContain('Grace Hopper');
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });

  it('changing cwCustomer refreshes cwSponsor + cwGovernanceForum options', async () => {
    const app = await loadApp(makeDataset({
      projects: [],
      customers: [
        { name: 'Acme', color: '#aaa', sponsors: ['Alice'] },
        { name: 'Globex', color: '#bbb', sponsors: ['Bob'] }
      ],
      governance_forums: [
        { id: 'g1', name: 'Acme Forum', customer: 'Acme' },
        { id: 'g2', name: 'Globex Forum', customer: 'Globex' }
      ]
    }));
    app.App.activeCustomer = 'Acme';
    app.DetailPanel._openCreateWizard();
    const sponsor = app.document.getElementById('cwSponsor');
    expect(Array.from(sponsor.options).map(o => o.value)).toContain('Alice');
    app.document.getElementById('cwCustomer').value = 'Globex';
    app.DetailPanel._refreshCreateWizardForCustomer('Globex');
    const sponsor2 = app.document.getElementById('cwSponsor');
    expect(Array.from(sponsor2.options).map(o => o.value)).toContain('Bob');
    expect(Array.from(sponsor2.options).map(o => o.value)).not.toContain('Alice');
    const forum2 = app.document.getElementById('cwGovernanceForum');
    expect(Array.from(forum2.options).map(o => o.value)).toContain('Globex Forum');
    expect(Array.from(forum2.options).map(o => o.value)).not.toContain('Acme Forum');
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });

  it('strategy linkage renders three multi-selects (Objectives → Metrics → Personas) in that order', async () => {
    const app = await bootEmpty();
    app.DetailPanel._openCreateWizard();
    app.document.getElementById('cwName').value = 'P';
    app.document.getElementById('cwCustomer').value = 'Acme Industries';
    app.document.getElementById('cwSize').value = '10';
    app.DetailPanel._wizardNext();
    const block = app.document.getElementById('cwStrategyLinkBlock');
    expect(block).toBeTruthy();
    const selects = block.querySelectorAll('select[multiple]');
    expect(selects.length).toBe(3);
    expect(selects[0].id).toBe('cwObjectiveIds');
    expect(selects[1].id).toBe('cwMetricIds');
    expect(selects[2].id).toBe('cwPersonaIds');
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });

  it('phase flow renders checkbox toggles (no free-text input)', async () => {
    const app = await bootEmpty();
    app.DetailPanel._openCreateWizard();
    const block = app.document.getElementById('cwPhaseFlowBlock');
    expect(block).toBeTruthy();
    expect(block.querySelectorAll('input[type="checkbox"][data-cw-phase]').length).toBe(5);
    expect(app.document.getElementById('cwPhaseFlow')).toBeFalsy();
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });

  it('phase flow toggles flow through to created project.delivery_config.phase_order', async () => {
    const app = await bootEmpty();
    app.DetailPanel._openCreateWizard();
    app.document.getElementById('cwName').value = 'PhaseFlowTest';
    app.document.getElementById('cwCustomer').value = 'Acme Industries';
    app.document.getElementById('cwSize').value = '10';
    app.DetailPanel._wizardNext();
    app.DetailPanel._wizardNext();
    const uatCheckbox = app.document.querySelector('#cwPhaseFlowBlock input[data-cw-phase="UAT"]');
    uatCheckbox.checked = false;
    app.DetailPanel._confirmCreateWizard();
    const proj = app.App.data.projects.find(p => p.name === 'PhaseFlowTest');
    expect(proj).toBeTruthy();
    expect(proj.delivery_config.phase_order).not.toContain('UAT');
    app.teardown();
  });

  it('NO free-text inputs survive on Step 2 (the cwSponsor / cwStrategyLink free-text inputs are gone)', async () => {
    const app = await bootEmpty();
    app.DetailPanel._openCreateWizard();
    const step2 = app.document.querySelector('[data-wiz-step="2"]');
    const textInputs = Array.from(step2.querySelectorAll('input[type="text"]'));
    expect(textInputs.length).toBe(0);
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });
});

describe('Slot B — Item 6: compact strategy pickers (chip strip + +button popover)', () => {
  it('renders chip strips for Objectives, Metrics, Personas — no <details> open by default', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('B1');
    const scope = app.document.querySelector('[data-dp-tab="scope"]');
    expect(scope).toBeTruthy();
    const section = scope.querySelector('.dp-strategy-section');
    expect(section).toBeTruthy();
    expect(section.querySelectorAll('.dp-strategy-row').length).toBe(3);
    expect(section.querySelectorAll('details[open]').length).toBe(0);
    app.teardown();
  });

  it('Objectives row comes before Metrics row (Item 4 ordering — Objectives first)', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('B1');
    const scope = app.document.querySelector('[data-dp-tab="scope"]');
    const rows = Array.from(scope.querySelectorAll('.dp-strategy-row'));
    const labels = rows.map(r => r.querySelector('.dp-strategy-label').textContent);
    const oIdx = labels.indexOf('Objectives');
    const mIdx = labels.indexOf('Metrics');
    expect(oIdx).toBeGreaterThanOrEqual(0);
    expect(mIdx).toBeGreaterThanOrEqual(0);
    expect(oIdx).toBeLessThan(mIdx);
    app.teardown();
  });

  it('clicking the "+" button opens the popover with a filter input', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('B1');
    app.DetailPanel._openStrategyPicker('metric_ids', 'metric');
    const pop = app.document.getElementById('dpStrategyPopover');
    expect(pop).toBeTruthy();
    expect(pop.dataset.field).toBe('metric_ids');
    expect(pop.querySelector('.dp-strategy-popover-filter')).toBeTruthy();
    app.DetailPanel._closeStrategyPicker();
    app.teardown();
  });

  it('toggleStrategySelection writes through to project.metric_ids', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('B1');
    app.DetailPanel._toggleStrategySelection('metric_ids', 'metric-test', true);
    expect(app.App.data.projects[0].metric_ids).toContain('metric-test');
    app.DetailPanel._toggleStrategySelection('metric_ids', 'metric-test', false);
    expect(app.App.data.projects[0].metric_ids).not.toContain('metric-test');
    app.teardown();
  });

  it('filterStrategyPicker hides non-matching rows by display:none', async () => {
    const { app } = await bootWithProject();
    app.DetailPanel.open('B1');
    app.DetailPanel._openStrategyPicker('metric_ids', 'metric');
    const pop = app.document.getElementById('dpStrategyPopover');
    const list = pop.querySelector('.dp-strategy-popover-list');
    // Programmatically add two rows via DOM methods so the security hook doesn't flag innerHTML.
    list.replaceChildren();
    const mkRow = (id, label) => {
      const li = app.document.createElement('li');
      li.className = 'dp-strategy-popover-row';
      li.dataset.id = id;
      li.dataset.label = label;
      const lbl = app.document.createElement('label');
      li.appendChild(lbl);
      return li;
    };
    list.appendChild(mkRow('a', 'alpha'));
    list.appendChild(mkRow('b', 'beta'));
    app.DetailPanel._filterStrategyPicker('alp');
    const rows = pop.querySelectorAll('.dp-strategy-popover-row');
    expect(rows[0].style.display).toBe('');
    expect(rows[1].style.display).toBe('none');
    app.DetailPanel._closeStrategyPicker();
    app.teardown();
  });
});
