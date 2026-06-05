// WS-G: add-project wizard restyled to app tokens/classes (flow unchanged).

import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset } from '../harness/fixtures.mjs';

async function boot() {
  const app = await loadApp(makeDataset({ projects: [], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
  app.App.activeCustomer = 'Acme Industries';
  return app;
}

describe('WS-G wizard restyle', () => {
  it('fields use shared classes, not inline font/border styles', async () => {
    const app = await boot();
    app.DetailPanel._openCreateWizard();
    const wiz = app.document.getElementById('createWizard');
    expect(wiz).toBeTruthy();
    const html = wiz.innerHTML;
    expect(wiz.querySelectorAll('.wiz-input').length).toBeGreaterThanOrEqual(8);
    expect(wiz.querySelectorAll('.wiz-label').length).toBeGreaterThanOrEqual(8);
    expect(html).not.toMatch(/font-size:11px/);
    expect(html).not.toMatch(/font-size:12px/);
    expect(html).not.toMatch(/#f1f5f9/);
    expect(html).not.toMatch(/rgba\(59,130,246,0\.15\)/);
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });

  it('the .wiz-input / .wiz-label CSS rules exist', async () => {
    const app = await boot();
    const styleText = Array.from(app.document.querySelectorAll('style')).map(s => s.textContent).join('\n');
    expect(styleText).toMatch(/\.wiz-input\s*\{/);
    expect(styleText).toMatch(/\.wiz-label\s*\{/);
    app.teardown();
  });
});
