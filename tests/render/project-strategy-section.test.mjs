import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeMetric, makeObjective, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

// 2026-05 rework: Strategy section in the project detail panel is now an
// editable multi-select. Metrics / Objectives / Personas each render as a
// <details> picker with checkboxes inside; selected items show as chips in
// the summary, and objectives derived via linked metrics still surface
// (read-only) so the user sees the implied OKR.
describe('Project detail — Strategy section', () => {
  it('renders three multi-select pickers populated with the customer entities', async () => {
    resetIdSeq();
    const obj = makeObjective({ id: 'O1', name: 'Grow regional revenue' });
    const m   = makeMetric({ id: 'M1', name: 'Revenue', objective_ids: ['O1'], dimensions: ['region'] });
    const sarah = makePersona({ id: 'PS', name: 'CFO' });
    sarah.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }];
    const project = makeProject({ id: 'PR1', metric_ids: ['M1'], persona_ids: [] });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      objectives: [obj], metrics: [m], personas: [sarah], projects: [project],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const out = app.DetailPanel.renderStrategySection(project);
    // Three pickers, one per entity type.
    expect(out).toMatch(/data-field="metric_ids"/);
    expect(out).toMatch(/data-field="objective_ids"/);
    expect(out).toMatch(/data-field="persona_ids"/);
    // Checkbox per option.
    expect(out).toMatch(/<input type="checkbox" value="M1" checked/);
    expect(out).toMatch(/<input type="checkbox" value="O1"(?! checked)/);
    expect(out).toMatch(/<input type="checkbox" value="PS"(?! checked)/);
    // Metric label visible in the picker.
    expect(out).toContain('Revenue');
    // Objective surfaces as a derived chip in the Objectives picker.
    expect(out).toContain('Grow regional revenue');
    expect(out).toContain('strategy-picker-chip-derived');
    // Persona archetype appears as a selectable option.
    expect(out).toContain('CFO');
    await expect(out).toMatchFileSnapshot('./__snapshots__/project-strategy-section.html');
    app.teardown();
  });

  it('checking a persona option calls DetailPanel.onStrategyCheckboxChange', async () => {
    resetIdSeq();
    const project = makeProject({ id: 'PR1' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [makePersona({ id: 'PS', name: 'CFO' })],
      projects: [project],
    }));
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.currentId = 'PR1';
    const fakeInput = { value: 'PS', checked: true };
    app.DetailPanel.onStrategyCheckboxChange('persona_ids', fakeInput);
    const saved = app.App.data.projects.find(pr => pr.id === 'PR1');
    expect(saved.persona_ids).toEqual(['PS']);
    app.teardown();
  });
});
