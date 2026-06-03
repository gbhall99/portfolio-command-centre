// Detail panel: editing a field auto-saves; closing never invokes a confirm() dialog.

import { describe, it, expect, vi } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

const boot = () => loadApp(makeDataset({
  projects: [makeProject({ id: 'P1', name: 'Orig Name', customer: 'Acme Industries' })],
  customers: [{ name: 'Acme Industries', color: '#6366f1' }]
}));

describe('Detail panel silent close', () => {
  it('does not call confirm() on close, even after a field edit', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.open('P1');
    const nameEl = app.document.querySelector('[data-field="name"]');
    expect(nameEl).toBeTruthy();
    nameEl.value = 'Edited Name';
    app.App.updateProject('P1', 'name', 'Edited Name');
    const confirmSpy = vi.spyOn(app.window, 'confirm').mockReturnValue(true);
    app.DetailPanel.close();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(app.App.data.projects.find(p => p.id === 'P1').name).toBe('Edited Name');
    confirmSpy.mockRestore();
    app.teardown();
  });

  it('does not call confirm() on close even when DOM value differs from stored (phantom mismatch)', async () => {
    const app = await boot();
    app.App.activeCustomer = 'Acme Industries';
    app.DetailPanel.open('P1');
    const nameEl = app.document.querySelector('[data-field="name"]');
    expect(nameEl).toBeTruthy();
    // Simulate a DOM edit without auto-save having fired yet (e.g. jsdom blur doesn't trigger onchange).
    // In production the close() blur-flush + onchange would handle this, but the test confirms
    // that the close-time diff check confirm() path is gone, not just papered over.
    nameEl.value = 'Phantom Edit';
    // Do NOT call updateProject — leaves a DOM-vs-stored mismatch that the old code would warn about.
    const confirmSpy = vi.spyOn(app.window, 'confirm').mockReturnValue(true);
    app.DetailPanel.close();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(app.App.data.projects.find(p => p.id === 'P1').name).toBe('Orig Name');
    confirmSpy.mockRestore();
    app.teardown();
  });
});
