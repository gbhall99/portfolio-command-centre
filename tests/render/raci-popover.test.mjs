import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makePersona, makeMetric, resetIdSeq } from '../harness/fixtures.mjs';

describe('RACI popover', () => {
  it('renderRaciPopover returns rows for all four roles', async () => {
    resetIdSeq();
    const sarah  = makePersona({ id: 'PS', name: 'Sarah Chen' });
    const james  = makePersona({ id: 'PJ', name: 'James Park' });
    const mei    = makePersona({ id: 'PM', name: 'Mei Tanaka' });
    const ben    = makePersona({ id: 'PB', name: 'Ben Walsh'  });
    const m = makeMetric({ id: 'M1', name: 'Total opex',
      raci: { accountable: ['PS'], responsible: ['PJ'], consulted: ['PM'], informed: ['PB'] } });
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
      personas: [sarah, james, mei, ben],
      metrics: [m],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const html = app.Metrics.renderRaciPopover('M1');
    expect(html).toContain('Sarah Chen');
    expect(html).toContain('James Park');
    expect(html).toContain('Mei Tanaka');
    expect(html).toContain('Ben Walsh');
    expect(html.toUpperCase()).toContain('A');
    expect(html.toUpperCase()).toContain('R');
    expect(html.toUpperCase()).toContain('C');
    expect(html.toUpperCase()).toContain('I');
    app.teardown();
  });
});
