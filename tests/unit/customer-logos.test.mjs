import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

describe('App.setCustomerLogo', () => {
  it('exists and writes to data.customers[i].logo', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    expect(typeof app.App.setCustomerLogo).toBe('function');
    app.App.setCustomerLogo('GCC', 'https://example.com/logo.png');
    const c = (app.App.data.customers || []).find(x => x.name === 'GCC');
    expect(c).toBeTruthy();
    expect(c.logo).toBe('https://example.com/logo.png');
    app.teardown();
  });

  it('empty value clears the logo', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject()] }));
    app.App.setCustomerLogo('GCC', 'https://example.com/logo.png');
    app.App.setCustomerLogo('GCC', '');
    const c = (app.App.data.customers || []).find(x => x.name === 'GCC');
    expect(c.logo).toBe('');
    app.teardown();
  });
});
