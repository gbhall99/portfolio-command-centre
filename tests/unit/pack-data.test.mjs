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

describe('Reports.Builders.customerPack', () => {
  it('returns an HTML doc with the 6 sections', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'Acme Industries-RP1', name: 'Alpha' });
    a.narrative = { headline: 'Phase 1 on track', wins: ['win'], asks: ['ask'], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    const app = await loadApp(makeDataset({ projects: [a], sprints: makeSprintSequence(2) }));
    const doc = app.Reports.Builders.customerPack('Acme Industries');
    const html = app.Reports.Doc.toHtml(doc, {});
    expect(html).toMatch(/<html/);
    expect(html).toMatch(/Portfolio health/);
    expect(html).toMatch(/Lifecycle headlines/);
    expect(html).toMatch(/Wins/);
    expect(html).toMatch(/We need from you/);
    expect(html).toMatch(/Customer-visible risks/i);
    expect(html).toMatch(/What's next/);
    expect(html).toMatch(/Phase 1 on track/);
    app.teardown();
  });

  // Legacy parity (buildCustomerPackDoc): the customer-facing pack opens with
  // a Portfolio health RAG-mix summary derived from data.portfolio_health.
  it('Portfolio health section reports the RAG mix, blocked and at-risk counts', async () => {
    resetIdSeq();
    const green = makeProject({ id: 'Acme Industries-PH1', name: 'Green One' });
    const amber = makeProject({ id: 'Acme Industries-PH2', name: 'Amber One', rag_scope: 'Amber' });
    const red = makeProject({ id: 'Acme Industries-PH3', name: 'Red One', rag_schedule: 'Red', status: 'Blocked' });
    const atRisk = makeProject({ id: 'Acme Industries-PH4', name: 'Risky One', status: 'At Risk' });
    const app = await loadApp(makeDataset({ projects: [green, amber, red, atRisk], sprints: makeSprintSequence(2) }));
    const html = app.Reports.Doc.toHtml(app.Reports.Builders.customerPack('Acme Industries'), {});
    expect(html).toMatch(/Portfolio health/);
    // The default auto-RAG rule turns status 'At Risk' into rag_schedule Amber
    // on load, so the at-risk project counts Amber here (Amber: 2, Green: 1).
    expect(html).toMatch(/Green: 1/);
    expect(html).toMatch(/Amber: 2/);
    expect(html).toMatch(/Red: 1/);
    expect(html).toMatch(/Blocked: 1/);
    expect(html).toMatch(/At risk: 1/);
    app.teardown();
  });

  // Legacy parity: headlines are grouped under per-lifecycle-stage <h3>
  // headings, ordered Idea -> Run/BAU (not a flat list).
  it('groups headlines under lifecycle-stage headings in stage order', async () => {
    resetIdSeq();
    const bau = makeProject({ id: 'Acme Industries-ST1', name: 'BAU Thing', lifecycle_stage: 'Run/BAU' });
    bau.narrative = { headline: 'Running steady', wins: [], asks: [], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    const idea = makeProject({ id: 'Acme Industries-ST2', name: 'New Idea', lifecycle_stage: 'Idea' });
    idea.narrative = { headline: 'Shaping scope', wins: [], asks: [], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    const app = await loadApp(makeDataset({ projects: [bau, idea], sprints: makeSprintSequence(2) }));
    const html = app.Reports.Doc.toHtml(app.Reports.Builders.customerPack('Acme Industries'), {});
    expect(html).toMatch(/<h3[^>]*>Idea<\/h3>/);
    expect(html).toMatch(/<h3[^>]*>Run\/BAU<\/h3>/);
    // Idea-stage heading precedes Run/BAU regardless of project order in data.
    expect(html.indexOf('>Idea</h3>')).toBeGreaterThan(-1);
    expect(html.indexOf('>Idea</h3>')).toBeLessThan(html.indexOf('>Run/BAU</h3>'));
    app.teardown();
  });
});

describe('Pack enrichment from project.narrative', () => {
  it('Sponsor pack surfaces narrative.headline as the project current-state line', async () => {
    resetIdSeq();
    const a = makeProject({ id: 'Acme Industries-SP1', name: 'Project Alpha' });
    a.narrative = { headline: 'Phase 1 on track for end-Q2', wins: ['win'], asks: [], customer_visible_risk_ids: [], updated_at: null, updated_by_walkthrough_id: null };
    const app = await loadApp(makeDataset({ projects: [a], sprints: makeSprintSequence(2) }));
    const html = app.Reports.Doc.toHtml(app.Reports.Builders.sponsorPack('Acme Industries-SP1'), {});
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
    // WS-E: the forum pack renders through the unified engine builder.
    const html = app.Reports.Doc.toHtml(app.Reports.Builders.forumAgenda('F1'), {});
    expect(html).toMatch(/Steady delivery/);
    expect(html).toMatch(/UAT prep done/);
    expect(html).toMatch(/Approval for phase 2/);
    app.teardown();
  });
});
