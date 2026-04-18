// DetailPanel snapshots lock down the field-input migration on risk dropdowns
// plus the priority explainer modal structure.

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, resetIdSeq } from '../harness/fixtures.mjs';

describe('DetailPanel.renderRisks', () => {
  it('renders impact/probability selects with field-input class', async () => {
    resetIdSeq();
    const p = makeProject({
      id: 'GCC-RISK',
      name: 'Risky Business',
      risks_register: [
        { description: 'First risk', action: 'Mitigate', owner: 'Alice', impact: 4, probability: 3, resolution_date: null },
        { description: 'Second risk', action: '', owner: '', impact: 2, probability: 5, resolution_date: null }
      ]
    });
    const app = await loadApp(makeDataset({ projects: [p], team_members: [] }));
    // DetailPanel methods expect App.data.projects to contain the project + currentId set.
    app.DetailPanel.currentId = p.id;
    const html = app.DetailPanel.renderRisks(p);
    // Structural assertions — impact + probability must use .field-input
    const impactSelects = (html.match(/data-risk-field="impact"[^>]*class="field-input"|class="field-input"[^>]*data-risk-field="impact"/g) || []);
    const probSelects   = (html.match(/data-risk-field="probability"[^>]*class="field-input"|class="field-input"[^>]*data-risk-field="probability"/g) || []);
    expect(impactSelects.length).toBe(2);
    expect(probSelects.length).toBe(2);
    await expect(html).toMatchFileSnapshot('./__snapshots__/detailpanel.risks.html');
    app.teardown();
  });
});
