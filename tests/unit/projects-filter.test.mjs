import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject, makeMetric, makeObjective, makePersona, resetIdSeq } from '../harness/fixtures.mjs';

describe('Projects filter — strategy', () => {
  it('filterByMetric returns projects directly linked to the metric', async () => {
    resetIdSeq();
    const m1 = makeMetric({ id: 'M1' });
    const m2 = makeMetric({ id: 'M2' });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [m1, m2],
      projects: [
        makeProject({ id: 'PR1', metric_ids: ['M1'] }),
        makeProject({ id: 'PR2', metric_ids: ['M2'] }),
        makeProject({ id: 'PR3', metric_ids: [] }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const ids = app.Dashboard.filterByMetric('M1').map(p => p.id);
    expect(ids).toEqual(['PR1']);
    app.teardown();
  });

  it('filterByObjective returns projects via metric.objective_ids', async () => {
    resetIdSeq();
    const obj = makeObjective({ id: 'O1' });
    const m = makeMetric({ id: 'M1', objective_ids: ['O1'] });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      objectives: [obj], metrics: [m],
      projects: [makeProject({ id: 'PR1', metric_ids: ['M1'] })],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Dashboard.filterByObjective('O1').map(p => p.id)).toEqual(['PR1']);
    app.teardown();
  });

  it('filterByPersona returns projects via metric holders OR explicit persona_ids', async () => {
    resetIdSeq();
    const m = makeMetric({ id: 'M1' });
    const persona = makePersona({ id: 'P1' });
    persona.metric_holdings = [{ id: 'H1', metric_id: 'M1', filter: {}, targets: [] }];
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      metrics: [m], personas: [persona],
      projects: [
        makeProject({ id: 'PR1', metric_ids: ['M1'] }),
        makeProject({ id: 'PR2', persona_ids: ['P1'] }),
        makeProject({ id: 'PR3' }),
      ],
    }));
    app.App.activeCustomer = 'Acme Industries';
    expect(app.Dashboard.filterByPersona('P1').map(p => p.id).sort()).toEqual(['PR1', 'PR2']);
    app.teardown();
  });
});
