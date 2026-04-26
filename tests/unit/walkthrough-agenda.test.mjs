import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeProject, makeSprintSequence, makeMember, makeDataset, resetIdSeq } from '../harness/fixtures.mjs';

describe('App.computeWalkthroughAgenda', () => {
  it('returns nine sections in stable order', async () => {
    resetIdSeq();
    const app = await loadApp(makeDataset({ projects: [makeProject({ name: 'X' })] }));
    const a = app.App.computeWalkthroughAgenda('Acme Industries');
    const ids = a.sections.map(s => s.id);
    expect(ids).toEqual(['whats_changed', 'rag_movers', 'risks', 'issues', 'actions_due', 'chip_progress', 'backlog', 'capacity', 'decisions']);
  });

  it('signals are arrays scoped to the customer', async () => {
    resetIdSeq();
    const proj = makeProject({ name: 'Red', status: 'Blocked', rag_schedule: 'Red' });
    proj.size_total = 5;
    proj.risks_register = [{ description: 'Big risk', impact: 5, probability: 5 }];
    const app = await loadApp(makeDataset({ projects: [proj] }));
    const a = app.App.computeWalkthroughAgenda('Acme Industries');
    const issues = a.sections.find(s => s.id === 'issues');
    expect(issues.signals.some(s => s.projectName === 'Red')).toBe(true);
    const risks = a.sections.find(s => s.id === 'risks');
    expect(risks.signals.length).toBeGreaterThan(0);
  });
});
