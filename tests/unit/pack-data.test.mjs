import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.computeCustomerPackData', () => {
  it('rolls up headline/wins/asks/visible_risks per project', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'Acme Industries-PA1', name: 'Alpha' });
    a.narrative = { headline: 'Phase 1 on track', wins: ['UAT-ready'], asks: ['Need DQ SME'], customer_visible_risk_ids: ['risk-1'], updated_at: null, updated_by_walkthrough_id: null };
    a.risks_register = [{ id: 'risk-1', description: 'Data quality', impact: 3, probability: 3, status: 'open' }];
    const b = makeProject({ id: 'Acme Industries-PA2', name: 'Beta' });
    b.narrative = { headline: 'Discovery in progress', wins: [], asks: [], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    const app = await loadApp(makeDataset({ projects: [a, b], sprints: makeSprintSequence(2) }));
    const data = app.App.computeCustomerPackData('Acme Industries');
    expect(data.customer).toBe('Acme Industries');
    expect(data.projects.length).toBe(2);
    const alpha = data.projects.find(p => p.id === 'Acme Industries-PA1');
    expect(alpha.headline).toBe('Phase 1 on track');
    expect(alpha.visible_risks.length).toBe(1);
    expect(alpha.visible_risks[0].desc).toBe('Data quality');
    app.teardown();
  });

  it('only includes risks listed in customer_visible_risk_ids', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'Acme Industries-PA3' });
    a.risks_register = [
      { id: 'r1', description: 'shown', impact: 2, probability: 2, status: 'open' },
      { id: 'r2', description: 'hidden', impact: 3, probability: 3, status: 'open' }
    ];
    a.narrative = { headline: '', wins: [], asks: [], customer_visible_risk_ids: ['r1'], updated_at: null, updated_by_walkthrough_id: null };
    const app = await loadApp(makeDataset({ projects: [a] }));
    const data = app.App.computeCustomerPackData('Acme Industries');
    expect(data.projects[0].visible_risks.length).toBe(1);
    expect(data.projects[0].visible_risks[0].desc).toBe('shown');
    app.teardown();
  });

  it('aggregates key_asks across all projects', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'Acme Industries-PA4' }); a.narrative = { headline: '', wins: [], asks: ['ask A1', 'ask A2'], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    const b = makeProject({ id: 'Acme Industries-PA5' }); b.narrative = { headline: '', wins: [], asks: ['ask B1'], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    const app = await loadApp(makeDataset({ projects: [a, b] }));
    const data = app.App.computeCustomerPackData('Acme Industries');
    expect(data.key_asks.length).toBe(3);
    app.teardown();
  });
});

describe('Report.buildCustomerPackDoc', () => {
  it('returns an HTML doc with the 6 sections', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'Acme Industries-RP1', name: 'Alpha' });
    a.narrative = { headline: 'Phase 1 on track', wins: ['win'], asks: ['ask'], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    const app = await loadApp(makeDataset({ projects: [a], sprints: makeSprintSequence(2) }));
    const html = app.Report.buildCustomerPackDoc('Acme Industries');
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

describe('Pack enrichment from project.narrative', () => {
  it('Sponsor pack surfaces narrative.headline as the project current-state line', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'Acme Industries-SP1', name: 'Project Alpha' });
    a.narrative = { headline: 'Phase 1 on track for end-Q2', wins: ['win'], asks: [], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    const app = await loadApp(makeDataset({ projects: [a], sprints: makeSprintSequence(2) }));
    const html = app.Report.buildProjectPackDoc('Acme Industries-SP1');
    expect(html).toMatch(/Phase 1 on track for end-Q2/);
    app.teardown();
  });

  it('Forum pack surfaces narrative.headline + wins + asks for each linked project', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'Acme Industries-FP1', name: 'Linked Project' });
    a.narrative = { headline: 'Steady delivery', wins: ['UAT prep done'], asks: ['Approval for phase 2'], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    a.governance_forum = 'Reporting & Delivery Strategy';
    const forums = [{ id: 'F1', name: 'Reporting & Delivery Strategy', customer: 'Acme Industries', actions: [], decisions: [] }];
    const app = await loadApp(makeDataset({ projects: [a], governance_forums: forums, sprints: makeSprintSequence(2) }));
    const builder = app.Report.buildForumPackDoc || app.Report.buildAgendaDoc;
    const html = builder.call(app.Report, 'F1');
    expect(html).toMatch(/Steady delivery/);
    expect(html).toMatch(/UAT prep done/);
    expect(html).toMatch(/Approval for phase 2/);
    app.teardown();
  });
});
