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

describe('WS-G wizard interaction', () => {
  async function boot2() {
    const app = await loadApp(makeDataset({ projects: [], customers: [{ name: 'Acme Industries', color: '#6366f1' }] }));
    app.App.activeCustomer = 'Acme Industries';
    return app;
  }

  it('dismissTopModal (Esc) closes the wizard', async () => {
    const app = await boot2();
    app.DetailPanel._openCreateWizard();
    expect(app.document.getElementById('createWizard')).toBeTruthy();
    const handled = app.App.dismissTopModal();
    expect(handled).toBe(true);
    expect(app.document.getElementById('createWizard')).toBeFalsy();
    expect(app.DetailPanel._cwState).toBe(null);
    app.teardown();
  });

  it('clicking the backdrop does NOT close the wizard (protects input)', async () => {
    const app = await boot2();
    app.DetailPanel._openCreateWizard();
    const overlay = app.document.getElementById('createWizard');
    overlay.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true }));
    expect(app.document.getElementById('createWizard')).toBeTruthy();
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });

  it('Step-1 validation blocks Next and flags the empty field', async () => {
    const app = await boot2();
    app.DetailPanel._openCreateWizard();
    app.document.getElementById('cwName').value = '';
    app.DetailPanel._wizardNext();
    expect(app.DetailPanel._cwState.step).toBe(1);
    expect(app.document.getElementById('cwName').classList.contains('wiz-invalid')).toBe(true);
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });

  it('size <= 0 flags the size field', async () => {
    const app = await boot2();
    app.DetailPanel._openCreateWizard();
    app.document.getElementById('cwName').value = 'Valid Name';
    app.document.getElementById('cwSize').value = '0';
    app.DetailPanel._wizardNext();
    expect(app.DetailPanel._cwState.step).toBe(1);
    expect(app.document.getElementById('cwSize').classList.contains('wiz-invalid')).toBe(true);
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });

  it('correcting a field via input clears its red cue', async () => {
    const app = await boot2();
    app.DetailPanel._openCreateWizard();
    const nameEl = app.document.getElementById('cwName');
    nameEl.value = '';
    app.DetailPanel._wizardNext();
    expect(nameEl.classList.contains('wiz-invalid')).toBe(true);
    nameEl.value = 'Fixed';
    nameEl.dispatchEvent(new app.window.Event('input', { bubbles: true }));
    expect(nameEl.classList.contains('wiz-invalid')).toBe(false);
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });

  it('the create path (Add details later) also flags an empty name', async () => {
    const app = await boot2();
    app.DetailPanel._openCreateWizard();
    app.document.getElementById('cwName').value = '';
    app.DetailPanel._addDetailsLater();
    expect(app.document.getElementById('cwName').classList.contains('wiz-invalid')).toBe(true);
    // wizard still open on step 1
    expect(app.document.getElementById('createWizard')).toBeTruthy();
    app.DetailPanel._closeCreateWizard();
    app.teardown();
  });
});
