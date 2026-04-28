import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.computeCustomerPackData', () => {
  it('rolls up headline/wins/asks/visible_risks per project', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'GCC-PA1', name: 'Alpha' });
    a.narrative = { headline: 'Phase 1 on track', wins: ['UAT-ready'], asks: ['Need DQ SME'], customer_visible_risk_ids: ['risk-1'], updated_at: null, updated_by_walkthrough_id: null };
    a.risks_register = [{ id: 'risk-1', description: 'Data quality', impact: 3, probability: 3, status: 'open' }];
    const b = makeProject({ id: 'GCC-PA2', name: 'Beta' });
    b.narrative = { headline: 'Discovery in progress', wins: [], asks: [], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2) }));
    const data = app.App.computeCustomerPackData('GCC');
    expect(data.customer).toBe('GCC');
    expect(data.projects.length).toBe(2);
    const alpha = data.projects.find(p => p.id === 'GCC-PA1');
    expect(alpha.headline).toBe('Phase 1 on track');
    expect(alpha.visible_risks.length).toBe(1);
    expect(alpha.visible_risks[0].desc).toBe('Data quality');
    app.teardown();
  });

  it('only includes risks listed in customer_visible_risk_ids', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'GCC-PA3' });
    a.risks_register = [
      { id: 'r1', description: 'shown', impact: 2, probability: 2, status: 'open' },
      { id: 'r2', description: 'hidden', impact: 3, probability: 3, status: 'open' }
    ];
    a.narrative = { headline: '', wins: [], asks: [], customer_visible_risk_ids: ['r1'], updated_at: null, updated_by_walkthrough_id: null };
    const app = await loadApp(makeDataset({ projects: [a] }));
    const data = app.App.computeCustomerPackData('GCC');
    expect(data.projects[0].visible_risks.length).toBe(1);
    expect(data.projects[0].visible_risks[0].desc).toBe('shown');
    app.teardown();
  });

  it('aggregates key_asks across all projects', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'GCC-PA4' }); a.narrative = { headline: '', wins: [], asks: ['ask A1', 'ask A2'], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    const b = makeProject({ id: 'GCC-PA5' }); b.narrative = { headline: '', wins: [], asks: ['ask B1'], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    const app = await loadApp(makeDataset({ projects: [a, b] }));
    const data = app.App.computeCustomerPackData('GCC');
    expect(data.key_asks.length).toBe(3);
    app.teardown();
  });
});

describe('Report.buildCustomerPackDoc', () => {
  it('returns an HTML doc with the 6 sections', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'GCC-RP1', name: 'Alpha' });
    a.narrative = { headline: 'Phase 1 on track', wins: ['win'], asks: ['ask'], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    const app = await loadApp(makeDataset({ projects: [a], sprints: makeSprintSequence(2) }));
    const html = app.Report.buildCustomerPackDoc('GCC');
    expect(html).toMatch(/<html/);
    expect(html).toMatch(/Headlines/);
    expect(html).toMatch(/Wins/);
    expect(html).toMatch(/We need from you/);
    expect(html).toMatch(/Risks we're managing/i);
    expect(html).toMatch(/What's next/);
    expect(html).toMatch(/Phase 1 on track/);
    app.teardown();
  });
});
