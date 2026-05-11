import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

// 2026-05 IA rework: Strategy is Objectives-only. Metrics and Personas
// (incl. People) moved to their own top-level views under Governance.
describe('Strategy view scaffold', () => {
  it('exposes a single tab — Objectives', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const tabs = app.Strategy.tabs();
    expect(tabs.map(t => t.id)).toEqual(['objectives']);
    app.teardown();
  });

  it('render() returns the Objectives inventory directly', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const html = app.Strategy.render();
    expect(html).toContain('Objectives');
    // Metrics + Personas no longer mount inside Strategy.
    expect(html).not.toContain('strategy-tabs');
    app.teardown();
  });

  it('MetricsView mount renders the metrics library', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const html = app.MetricsView.render();
    expect(html).toContain('Metrics');
    expect(html).toContain('metric-library-table');
    app.teardown();
  });

  it('PersonasView mount carries a Personas + People tab pair', async () => {
    const app = await loadApp(makeDataset({
      customers: [{ name: 'Acme Industries', color: '#6366f1', staleThreshold: 14 }],
    }));
    app.App.activeCustomer = 'Acme Industries';
    const html = app.PersonasView.render();
    expect(html).toContain('Personas');
    expect(html).toContain('People');
    app.teardown();
  });
});
