import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('Settings IA registry', () => {
  it('App.CONFIG_CATEGORIES has 13 entries', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    expect(Array.isArray(app.App.CONFIG_CATEGORIES)).toBe(true);
    expect(app.App.CONFIG_CATEGORIES.length).toBe(13);
    app.teardown();
  });

  it('every category has id, label, summary, render', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    for (const c of app.App.CONFIG_CATEGORIES) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.label).toBe('string');
      expect(typeof c.summary).toBe('function');
      expect(typeof c.render).toBe('function');
    }
    app.teardown();
  });

  it('expected category ids are present', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    const ids = app.App.CONFIG_CATEGORIES.map(c => c.id);
    expect(ids.sort()).toEqual(['ai','customers','data','display','metrics','objectives','people','personas','scheduler','scoring','sprints','team','templates']);
    app.teardown();
  });
});

describe('Settings IA navigation', () => {
  it('openConfigCategory sets active category', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.openConfigCategory('customers');
    expect(app.App._configActiveCategory).toBe('customers');
    app.teardown();
  });

  it('openConfigCategory ignores unknown id', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App._configActiveCategory = null;
    app.App.openConfigCategory('does-not-exist');
    expect(app.App._configActiveCategory).toBeNull();
    app.teardown();
  });

  it('closeConfigCategory clears active', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App._configActiveCategory = 'customers';
    app.App.closeConfigCategory();
    expect(app.App._configActiveCategory).toBeNull();
    app.teardown();
  });
});

describe('Dashboard rendering', () => {
  it('renders 13 tile buttons by default', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('config');
    const tiles = app.window.document.querySelectorAll('#configBody .config-tile');
    expect(tiles.length).toBe(13);
    app.teardown();
  });

  it('renders the chosen category when active', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.activeCustomer = 'Acme Industries';
    app.App.navigate('config');
    app.App.openConfigCategory('customers');
    const breadcrumb = app.window.document.querySelector('#configBody .config-breadcrumb');
    expect(breadcrumb).not.toBeNull();
    expect(breadcrumb.textContent.toLowerCase()).toContain('customers');
    app.teardown();
  });
});
