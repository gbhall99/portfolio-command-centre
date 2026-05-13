import { describe, it, expect } from 'vitest';
import { loadApp } from '../harness/loadApp.mjs';
import { makeDataset, makeProject } from '../harness/fixtures.mjs';

// Phase 2 — Detail Panel IA refactor. Tests cover AC-2.1 (2-row sticky header
// with <540 px collapse), AC-2.2 (inline-edit affordance), AC-2.3 (computed
// fields exempt), AC-2.4 (undo toast on edit).
//
// The plan lives at plans/detail-panel-ia-refactor.md.

async function openDetailPanel(app, projectId) {
  app.DetailPanel.open(projectId);
  // Give renderBody + the post-render hooks a tick.
  await new Promise(r => setTimeout(r, 10));
}

describe('Phase 2 / AC-2.1 — 2-row sticky header', () => {
  it('renders panel-sticky-meta as two rows (psm-row-1 + psm-row-2)', async () => {
    const p = makeProject({
      id: 'S1', name: 'P', customer: 'Acme Industries',
      sponsor: 'Sponsor', manager: 'Alice', target_date: '2026-12-31',
      current_sprint: 'CY26-S5'
    });
    const app = await loadApp(makeDataset({ projects: [p] }));
    await openDetailPanel(app, 'S1');
    const meta = app.document.getElementById('panelStickyMeta');
    expect(meta).toBeTruthy();
    expect(meta.querySelector('.psm-row-1')).toBeTruthy();
    expect(meta.querySelector('.psm-row-2')).toBeTruthy();
    app.teardown();
  });

  it('row 2 collapse uses <details>/<summary> with single-chip summary', async () => {
    const p = makeProject({
      id: 'S2', name: 'P', customer: 'Acme Industries',
      current_sprint: 'CY26-S5'
    });
    const app = await loadApp(makeDataset({ projects: [p] }));
    await openDetailPanel(app, 'S2');
    const meta = app.document.getElementById('panelStickyMeta');
    const details = meta.querySelector('details.psm-collapse');
    expect(details).toBeTruthy();
    const summary = details.querySelector('summary');
    expect(summary).toBeTruthy();
    expect(summary.querySelectorAll('.psm-chip').length).toBe(1);
    // The single summary chip's text starts with the sprint id short form.
    expect(summary.textContent).toMatch(/S5/);
    app.teardown();
  });

  it('summary chip shows "X/Y SP" when committed points present', async () => {
    const p = makeProject({
      id: 'S3', name: 'P', customer: 'Acme Industries',
      current_sprint: 'CY26-S7',
      skill_splits: {
        size_engineering: [{ sprint: 'CY26-S7', points: 10, completed: 4 }]
      }
    });
    const app = await loadApp(makeDataset({ projects: [p] }));
    await openDetailPanel(app, 'S3');
    const meta = app.document.getElementById('panelStickyMeta');
    const summaryChip = meta.querySelector('details.psm-collapse > summary > .psm-chip');
    expect(summaryChip).toBeTruthy();
    expect(summaryChip.textContent).toMatch(/4\/10 SP/);
    app.teardown();
  });

  it('falls back to "No active sprint" chip in row 2 when no current_sprint', async () => {
    const p = makeProject({ id: 'S4', name: 'P', customer: 'Acme Industries' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    await openDetailPanel(app, 'S4');
    const meta = app.document.getElementById('panelStickyMeta');
    const row2 = meta.querySelector('.psm-row-2');
    expect(row2).toBeTruthy();
    expect(row2.textContent).toContain('No active sprint');
    app.teardown();
  });
});

describe('Phase 2 / AC-2.2 — inline-edit affordance', () => {
  it('adds .dp-inline-edit to every <input type="text|number|date">', async () => {
    const p = makeProject({ id: 'IE1', name: 'P', customer: 'Acme Industries' });
    const app = await loadApp(makeDataset({ projects: [p] }));
    await openDetailPanel(app, 'IE1');
    const body = app.document.getElementById('panelBody');
    const inputs = body.querySelectorAll('input[type="text"], input[type="number"], input[type="date"]');
    expect(inputs.length).toBeGreaterThan(0);
    let countWithClass = 0;
    inputs.forEach(el => { if (el.classList.contains('dp-inline-edit')) countWithClass++; });
    expect(countWithClass).toBe(inputs.length);
    app.teardown();
  });

  it('skips checkbox and radio inputs (AC-2.3 exemption pattern)', async () => {
    const p = makeProject({
      id: 'IE2', name: 'P', customer: 'Acme Industries',
      customer_milestones: [{ name: 'M1', date: '2026-01-01', status: 'Planned', notes: '', external_commitment: false }]
    });
    const app = await loadApp(makeDataset({ projects: [p] }));
    await openDetailPanel(app, 'IE2');
    const body = app.document.getElementById('panelBody');
    const checkboxes = body.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes.forEach(cb => {
      expect(cb.classList.contains('dp-inline-edit')).toBe(false);
    });
    app.teardown();
  });
});

describe('Phase 2 / AC-2.3 — computed/derived fields exempt', () => {
  it('the EVM strip cells do not carry .dp-inline-edit', async () => {
    // Build a project with size + skill_splits so the EVM strip renders content.
    const p = makeProject({
      id: 'EVM1', name: 'P', customer: 'Acme Industries',
      size_engineering: 10, size_total: 10,
      start_date: '2026-01-01', target_date: '2026-06-30',
      skill_splits: {
        size_engineering: [{ sprint: 'CY26-S1', points: 5, completed: 5, status: 'complete' }]
      }
    });
    const app = await loadApp(makeDataset({ projects: [p] }));
    await openDetailPanel(app, 'EVM1');
    const body = app.document.getElementById('panelBody');
    const evmStrip = body.querySelector('.evm-strip');
    if (evmStrip) {
      const cells = evmStrip.querySelectorAll('*');
      cells.forEach(c => {
        expect(c.classList.contains('dp-inline-edit')).toBe(false);
      });
    }
    app.teardown();
  });

  it('the sprint-window readonly displays (<div class="field-input">) are NOT classed', async () => {
    const p = makeProject({
      id: 'SW1', name: 'P', customer: 'Acme Industries',
      current_sprint: 'CY26-S1',
      skill_splits: {
        size_engineering: [{ sprint: 'CY26-S1', points: 5 }]
      }
    });
    const app = await loadApp(makeDataset({ projects: [p] }));
    await openDetailPanel(app, 'SW1');
    const body = app.document.getElementById('panelBody');
    // Read-only displays use <div class="field-input"> — they're NOT inputs so
    // they're inherently exempt from the inline-edit class (which only applies
    // to <input>/<textarea>). Verify the divs don't accidentally inherit it.
    const readonlyDivs = body.querySelectorAll('div.field-input');
    readonlyDivs.forEach(d => {
      expect(d.classList.contains('dp-inline-edit')).toBe(false);
    });
    app.teardown();
  });
});

describe('Phase 2 / AC-2.4 — undo toast', () => {
  it('showUndoToast creates a single .dp-undo-toast in document.body', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'UT1', customer: 'Acme Industries' })] }));
    let called = false;
    app.DetailPanel.showUndoToast('Test message', () => { called = true; });
    const toast = app.document.querySelector('.dp-undo-toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toContain('Test message');
    // Multiple calls replace, not stack
    app.DetailPanel.showUndoToast('Replacement', () => {});
    expect(app.document.querySelectorAll('.dp-undo-toast').length).toBe(1);
    expect(app.document.querySelector('.dp-undo-toast').textContent).toContain('Replacement');
    app.DetailPanel._dismissUndoToast();
    app.teardown();
  });

  it('clicking the Undo button invokes the callback and dismisses the toast', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'UT2', customer: 'Acme Industries' })] }));
    let called = false;
    app.DetailPanel.showUndoToast('X', () => { called = true; });
    const btn = app.document.querySelector('.dp-undo-toast .dp-undo-toast-btn');
    expect(btn).toBeTruthy();
    btn.click();
    expect(called).toBe(true);
    expect(app.document.querySelector('.dp-undo-toast')).toBeFalsy();
    app.teardown();
  });

  it('clicking the close (×) button dismisses without invoking the callback', async () => {
    const app = await loadApp(makeDataset({ projects: [makeProject({ id: 'UT3', customer: 'Acme Industries' })] }));
    let called = false;
    app.DetailPanel.showUndoToast('Y', () => { called = true; });
    const close = app.document.querySelector('.dp-undo-toast .dp-undo-toast-close');
    expect(close).toBeTruthy();
    close.click();
    expect(called).toBe(false);
    expect(app.document.querySelector('.dp-undo-toast')).toBeFalsy();
    app.teardown();
  });
});
