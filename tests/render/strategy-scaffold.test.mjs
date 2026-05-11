import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

describe('Strategy view scaffold', () => {
  it('exposes four tabs: Personas, People, Objectives, Metrics', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const tabs = app.Strategy.tabs();
    expect(tabs.map(t => t.id)).toEqual(['personas', 'people', 'objectives', 'metrics']);
    app.teardown();
  });

  it('render() returns html containing all four tab labels', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const html = app.Strategy.render();
    expect(html).toContain('Personas');
    expect(html).toContain('People');
    expect(html).toContain('Objectives');
    expect(html).toContain('Metrics');
    app.teardown();
  });
});
